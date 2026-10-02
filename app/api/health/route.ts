import { NextResponse } from "next/server";
import { listPackSlugs } from "../../../lib/quests";
import { runnerHealth } from "../../../lib/runner-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const runner = await runnerHealth();
  return NextResponse.json({
    status: runner.available ? "ok" : "degraded",
    app: "quest-coder",
    launchStage: "trusted-vertical-slice",
    version: process.env.NEXT_PUBLIC_APP_VERSION ?? "local",
    packs: listPackSlugs().length,
    runner
  });
}
