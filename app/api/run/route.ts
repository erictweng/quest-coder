import { spawn } from "node:child_process";
import { NextResponse } from "next/server";
import { findChallenge, loadQuestPack, packPath } from "../../../lib/quests";

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
    const result = await withRunnerSlot(() => runQuestRunner({
      source: body.source as string,
      packPath: packPath(packSlugValue),
      challengeId: challenge.id,
      mode
    }));
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
      { error: error instanceof Error ? error.message : "runner bridge failed", queue: queueSnapshot() },
      { status: 500 }
    );
  }
}

function runQuestRunner(payload: { source: string; packPath: string; challengeId: string; mode: RunMode }) {
  return new Promise<Record<string, unknown>>((resolve, reject) => {
    const repoRoot = process.cwd();
    const child = spawn("python3", ["runner/quest_runner_cli.py"], {
      cwd: repoRoot,
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, QUEST_CODER_PUBLIC_HARDENED: "1", PYTHONSAFEPATH: "1" }
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
      if (code !== 0) { reject(new Error(stderr || `runner exited with code ${code}`)); return; }
      try { resolve(JSON.parse(stdout) as Record<string, unknown>); }
      catch (error) { reject(new Error(`runner returned invalid JSON: ${error instanceof Error ? error.message : "parse failed"}`)); }
    });

    child.stdin.end(JSON.stringify(payload));
  });
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
