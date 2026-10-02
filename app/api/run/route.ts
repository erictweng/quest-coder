import { spawn } from "node:child_process";
import { NextResponse } from "next/server";
import { findChallenge, loadQuestPack, packPath } from "../../../lib/quests";
import { PYTHON_ENV_VAR, getPythonCommand, invalidatePythonCommand, pythonArgsPrefix, withPythonSearchPath, type PythonResolution } from "../../../lib/python-runtime";
import { canUseClimbingStairsFallback, runClimbingStairsFallback } from "../../../lib/climbing-stairs-fallback";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RUNNER_TIMEOUT_MS = 7000;
const MAX_SOURCE_BYTES = 24_000;
const MAX_CONCURRENT_RUNS = 2;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_RUNS = 20;

const rateBuckets = new Map<string, { count: number; resetAt: number }>();
let activeRuns = 0;
let queuedRuns = 0;

type RunMode = "run" | "submit";
type RunRequest = {
  source?: unknown;
  packSlug?: unknown;
  challengeId?: unknown;
  mode?: unknown;
};

export async function POST(request: Request) {
  const clientId = clientKey(request);
  const rate = takeRateLimit(clientId);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "rate limit exceeded", queue: queueSnapshot(), retryAfterMs: rate.retryAfterMs },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rate.retryAfterMs / 1000)) } }
    );
  }

  const body = (await request.json().catch(() => ({}))) as RunRequest;
  const sourceCheck = validateSource(body.source);
  if (!sourceCheck.ok) return NextResponse.json({ error: sourceCheck.error, queue: queueSnapshot() }, { status: 400 });

  const packSlugValue = typeof body.packSlug === "string" ? body.packSlug : "forest-of-patience-climbing-stairs";
  const challengeIdValue = typeof body.challengeId === "string" ? body.challengeId : "boss-old-bramblehorn";
  const mode: RunMode = body.mode === "submit" ? "submit" : "run";

  try {
    const pack = loadQuestPack(packSlugValue);
    const challenge = findChallenge(pack, challengeIdValue);
    let result: Record<string, unknown>;
    try {
      result = await withRunnerSlot(() => runQuestRunnerWithRetry({
        source: body.source as string,
        packPath: packPath(packSlugValue),
        challengeId: challenge.id,
        mode
      }));
    } catch (error) {
      if (!isPythonUnavailable(error) || !canUseClimbingStairsFallback(pack.slug)) throw error;
      result = runClimbingStairsFallback({ source: body.source as string, pack, challenge, mode });
    }
    return NextResponse.json({
      ...result,
      pack: { id: pack.id, slug: pack.slug, title: pack.title },
      challenge: { id: challenge.id, title: challenge.title },
      mode,
      queue: queueSnapshot(),
      security: { profile: "public-hardening-v0", network: "blocked-by-no-import-runner", filesystem: "read-only-by-no-open-runner", timelineRetention: "compressed-to-3000-events" }
    });
  } catch (error) {
    return NextResponse.json(
      { error: describeRunnerError(error), queue: queueSnapshot() },
      { status: 500 }
    );
  }
}

type RunnerPayload = { source: string; packPath: string; challengeId: string; mode: RunMode };

/**
 * Resolves the Python command once per server process and spawns the runner. If the cached
 * command disappears (ENOENT), the cache is dropped and resolution runs again before giving up.
 */
async function runQuestRunnerWithRetry(payload: RunnerPayload) {
  try {
    return await runQuestRunner(payload);
  } catch (error) {
    if (!isSpawnNotFound(error)) throw error;
    invalidatePythonCommand();
    return runQuestRunner(payload);
  }
}

function runQuestRunner(payload: RunnerPayload) {
  return new Promise<Record<string, unknown>>((resolve, reject) => {
    const repoRoot = process.cwd();
    const env = withPythonSearchPath({ ...process.env, QUEST_CODER_PUBLIC_HARDENED: "1", PYTHONSAFEPATH: "1" });
    let python: PythonResolution;
    try {
      python = getPythonCommand(env);
    } catch (error) {
      reject(error);
      return;
    }
    const child = spawn(python.command, [...pythonArgsPrefix(python.command), "runner/quest_runner_cli.py"], {
      cwd: repoRoot,
      stdio: ["pipe", "pipe", "pipe"],
      env
    });

    let stdout = "";
    let stderr = "";
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("runner bridge timed out"));
    }, RUNNER_TIMEOUT_MS);

    child.stdout.on("data", (chunk: Buffer) => { stdout += chunk.toString(); });
    child.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });
    child.on("error", (error) => { clearTimeout(timeout); reject(error); });
    child.on("close", (code) => {
      clearTimeout(timeout);
      if (code !== 0) { reject(new Error(runnerStderrMessage(stderr, code))); return; }
      try { resolve(JSON.parse(stdout) as Record<string, unknown>); }
      catch (error) { reject(new Error(`runner returned invalid JSON: ${error instanceof Error ? error.message : "parse failed"}`)); }
    });

    child.stdin.on("error", () => { /* the close handler reports the real failure */ });
    child.stdin.end(JSON.stringify(payload));
  });
}

function isSpawnNotFound(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && (error as NodeJS.ErrnoException).code === "ENOENT");
}

function isPythonUnavailable(error: unknown): boolean {
  return isSpawnNotFound(error) || (error instanceof Error && error.message.includes("Python 3 runtime not found"));
}

function runnerStderrMessage(stderr: string, code: number | null): string {
  const text = stderr.trim();
  if (!text) return `runner exited with code ${code}`;
  try {
    const parsed = JSON.parse(text) as { error?: string };
    if (parsed.error) return parsed.error;
  } catch { /* plain-text stderr */ }
  return text;
}

function describeRunnerError(error: unknown): string {
  if (isSpawnNotFound(error)) {
    const command = (error as NodeJS.ErrnoException & { path?: string }).path ?? "python3";
    return `Python runtime not found (spawn ${command} ENOENT). Install Python 3 or set ${PYTHON_ENV_VAR} to a python3 executable path and restart the server.`;
  }
  return error instanceof Error ? error.message : "runner bridge failed";
}

async function withRunnerSlot<T>(fn: () => Promise<T>): Promise<T> {
  queuedRuns += 1;
  while (activeRuns >= MAX_CONCURRENT_RUNS) await new Promise((resolve) => setTimeout(resolve, 50));
  queuedRuns -= 1;
  activeRuns += 1;
  try { return await fn(); }
  finally { activeRuns -= 1; }
}

function queueSnapshot() { return { activeRuns, queuedRuns, maxConcurrentRuns: MAX_CONCURRENT_RUNS }; }

function clientKey(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "local";
}

function takeRateLimit(key: string) {
  const now = Date.now();
  const bucket = rateBuckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    rateBuckets.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true, retryAfterMs: 0 };
  }
  if (bucket.count >= RATE_LIMIT_MAX_RUNS) return { allowed: false, retryAfterMs: bucket.resetAt - now };
  bucket.count += 1;
  return { allowed: true, retryAfterMs: 0 };
}

function validateSource(source: unknown): { ok: true } | { ok: false; error: string } {
  if (typeof source !== "string" || source.trim().length === 0) return { ok: false, error: "source must be a non-empty Python string" };
  if (Buffer.byteLength(source, "utf8") > MAX_SOURCE_BYTES) return { ok: false, error: `source exceeds ${MAX_SOURCE_BYTES} byte public limit` };
  const blocked = [/\bimport\b/, /__import__/, /\bopen\s*\(/, /\beval\s*\(/, /\bexec\s*\(/, /\bcompile\s*\(/, /\binput\s*\(/, /\bglobals\s*\(/, /\blocals\s*\(/, /__/, /\bsocket\b/, /\bsubprocess\b/, /\bos\b/, /\bsys\b/];
  if (blocked.some((pattern) => pattern.test(source))) return { ok: false, error: "source uses a public-disabled capability" };
  return { ok: true };
}
