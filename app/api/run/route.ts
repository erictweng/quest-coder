import { spawn } from "node:child_process";
import { NextResponse } from "next/server";
import { findChallenge, loadQuestPack, packPath } from "../../../lib/quests";

const RUNNER_TIMEOUT_MS = 7000;

type RunRequest = {
  source?: unknown;
  packSlug?: unknown;
  challengeId?: unknown;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as RunRequest;
  if (typeof body.source !== "string" || body.source.trim().length === 0) {
    return NextResponse.json({ error: "source must be a non-empty Python string" }, { status: 400 });
  }

  const packSlugValue = typeof body.packSlug === "string" ? body.packSlug : "timequake-search-rotated-array";
  const challengeIdValue = typeof body.challengeId === "string" ? body.challengeId : "boss-search";

  try {
    const pack = loadQuestPack(packSlugValue);
    const challenge = findChallenge(pack, challengeIdValue);
    const result = await runQuestRunner({
      source: body.source,
      packPath: packPath(packSlugValue),
      challengeId: challenge.id
    });
    return NextResponse.json({ ...result, pack: { id: pack.id, slug: pack.slug, title: pack.title }, challenge: { id: challenge.id, title: challenge.title } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "runner bridge failed" },
      { status: 500 }
    );
  }
}

function runQuestRunner(payload: { source: string; packPath: string; challengeId: string }) {
  return new Promise<Record<string, unknown>>((resolve, reject) => {
    const repoRoot = process.cwd();
    const child = spawn("python3", ["runner/quest_runner_cli.py"], {
      cwd: repoRoot,
      stdio: ["pipe", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("runner bridge timed out"));
    }, RUNNER_TIMEOUT_MS);

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timeout);
      if (code !== 0) {
        reject(new Error(stderr || `runner exited with code ${code}`));
        return;
      }
      try {
        resolve(JSON.parse(stdout) as Record<string, unknown>);
      } catch (error) {
        reject(new Error(`runner returned invalid JSON: ${error instanceof Error ? error.message : "parse failed"}`));
      }
    });

    child.stdin.end(JSON.stringify(payload));
  });
}
