import { NextResponse } from "next/server";
import { listPackSlugs } from "../../../lib/quests";
import { PYTHON_ENV_VAR, pythonRuntimeStatus } from "../../../lib/python-runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  const python = pythonRuntimeStatus();
  return NextResponse.json({
    status: python.available ? "ok" : "degraded",
    app: "quest-coder",
    launchStage: "public-beta",
    version: process.env.NEXT_PUBLIC_APP_VERSION ?? "local",
    packs: listPackSlugs().length,
    runner: {
      mode: "child-process-python",
      publicHardeningProfile: "public-hardening-v0",
      maxConcurrentRuns: 2,
      rateLimitWindowSeconds: 60,
      python,
      pythonOverrideEnv: PYTHON_ENV_VAR
    }
  });
}
