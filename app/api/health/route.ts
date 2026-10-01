import { NextResponse } from "next/server";
import { listPackSlugs } from "../../../lib/quests";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({
    status: "ok",
    app: "quest-coder",
    launchStage: "public-beta",
    version: process.env.NEXT_PUBLIC_APP_VERSION ?? "local",
    packs: listPackSlugs().length,
    runner: {
      mode: "child-process-python",
      publicHardeningProfile: "public-hardening-v0",
      maxConcurrentRuns: 2,
      rateLimitWindowSeconds: 60
    }
  });
}
