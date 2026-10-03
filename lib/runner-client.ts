import type { RunRequest } from "./run-contract";

const DEFAULT_TIMEOUT_MS = 8_000;
const MAX_RESPONSE_BYTES = 1_000_000;

export class RunnerBoundaryError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(message: string, status: number, code: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/** Trimmed so a pasted trailing newline or space in the Vercel value does not break auth. */
function runnerConfig() {
  const baseUrl = process.env.QUEST_CODER_RUNNER_URL?.trim().replace(/\/$/, "");
  const token = process.env.QUEST_CODER_RUNNER_TOKEN?.trim();
  return { baseUrl, token };
}

export async function submitToRunner(payload: RunRequest): Promise<Record<string, unknown>> {
  const { baseUrl, token } = runnerConfig();
  if (!baseUrl || !token) throw new RunnerBoundaryError("The execution service is not configured. Start the runner service, then try again.", 503, "runner_unavailable");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const response = await fetch(`${baseUrl}/v1/runs`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ source: payload.source, packSlug: payload.packSlug, challengeId: payload.challengeId, mode: payload.mode }),
      signal: controller.signal,
      cache: "no-store"
    });
    const text = await readCappedResponse(response);
    const parsed = safeJson(text);
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        // The app's runner credential was rejected. This is a server misconfiguration, never the
        // player's session: a 401 here would make the browser sign the player out.
        console.error(JSON.stringify({ event: "runner_auth_rejected", status: response.status }));
        throw new RunnerBoundaryError("The execution service is misconfigured. Try again later.", 503, "runner_misconfigured");
      }
      const message = typeof parsed.error === "string" ? parsed.error : `execution service returned ${response.status}`;
      const code = typeof parsed.code === "string" ? parsed.code : "runner_error";
      throw new RunnerBoundaryError(message, normalizeStatus(response.status), code);
    }
    if (!parsed || typeof parsed !== "object" || typeof parsed.status !== "string" || !Array.isArray(parsed.cases)) {
      throw new RunnerBoundaryError("execution service returned an invalid result", 502, "invalid_runner_response");
    }
    return parsed;
  } catch (error) {
    if (error instanceof RunnerBoundaryError) throw error;
    if (error instanceof Error && error.name === "AbortError") throw new RunnerBoundaryError("Execution timed out. Try again with a terminating solution.", 504, "runner_timeout");
    throw new RunnerBoundaryError("The execution service is unavailable. Try again shortly.", 503, "runner_unavailable");
  } finally { clearTimeout(timer); }
}

export async function runnerHealth(): Promise<{ available: boolean; mode: string; version?: string }> {
  const { baseUrl, token } = runnerConfig();
  if (!baseUrl || !token) return { available: false, mode: "external-service" };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 1500);
  try {
    // Not /readyz: Cloud Run reserves paths ending in "z".
    const response = await fetch(`${baseUrl}/ready`, { headers: { authorization: `Bearer ${token}` }, signal: controller.signal, cache: "no-store" });
    const value = response.ok ? safeJson(await readCappedResponse(response)) : {};
    return { available: response.ok, mode: "external-service", version: typeof value.version === "string" ? value.version : undefined };
  } catch { return { available: false, mode: "external-service" }; }
  finally { clearTimeout(timer); }
}

export async function readCappedResponse(response: Response, maxBytes = MAX_RESPONSE_BYTES): Promise<string> {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let total = 0;
  let text = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel("runner response too large").catch(() => undefined);
        throw new RunnerBoundaryError("execution service response was too large", 502, "runner_response_too_large");
      }
      text += decoder.decode(value, { stream: true });
    }
    return text + decoder.decode();
  } catch (error) {
    if (error instanceof RunnerBoundaryError) throw error;
    throw new RunnerBoundaryError("execution service returned an invalid response", 502, "invalid_runner_response");
  } finally {
    reader.releaseLock();
  }
}
function safeJson(text: string): Record<string, unknown> { try { return JSON.parse(text) as Record<string, unknown>; } catch { return {}; } }
// 401/403 are deliberately absent: those belong to the player's own session.
function normalizeStatus(status: number) { return [400, 404, 409, 422, 429, 503, 504].includes(status) ? status : 502; }
