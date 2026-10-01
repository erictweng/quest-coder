import { spawn } from "node:child_process";
import path from "node:path";
import { NextResponse } from "next/server";

const RUNNER_TIMEOUT_MS = 7000;

type RunRequest = {
  source?: unknown;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as RunRequest;
  if (typeof body.source !== "string" || body.source.trim().length === 0) {
    return NextResponse.json({ error: "source must be a non-empty Python string" }, { status: 400 });
  }

  try {
    const result = await runQuestRunner(body.source);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "runner bridge failed" },
      { status: 500 }
    );
  }
}

function runQuestRunner(source: string) {
  return new Promise((resolve, reject) => {
    const repoRoot = process.cwd();
    const runnerPath = path.join(repoRoot, "runner", "quest_runner_cli.py");
    const child = spawn("python3", [runnerPath], {
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
        resolve(JSON.parse(stdout));
      } catch (error) {
        reject(new Error(`runner returned invalid JSON: ${error instanceof Error ? error.message : "parse failed"}`));
      }
    });

    child.stdin.end(JSON.stringify({ source }));
  });
}
