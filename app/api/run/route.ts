import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { findChallenge, loadQuestPack } from "../../../lib/quests";
import { parseRunRequest, RunValidationError } from "../../../lib/run-contract";
import { RunnerBoundaryError, submitToRunner } from "../../../lib/runner-client";
import { applyAuthoritativeClear, readServerProgress, sessionForToken } from "../../../lib/progress-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const payload = parseRunRequest(await request.json().catch(() => null));
    const pack = loadQuestPack(payload.packSlug);
    const challenge = findChallenge(pack, payload.challengeId);
    const result = await submitToRunner(payload);
    if (payload.mode === "submit" && result.passed === true) {
      const jar = await cookies();
      const session = sessionForToken(jar.get("quest_coder_session")?.value);
      if (!session) return NextResponse.json({ error: "Sign in again before submitting.", code: "unauthorized" }, { status: 401 });
      const serverProgress = readServerProgress(session.tokenHash);
      const cleared = (serverProgress?.cleared ?? {}) as Record<string, boolean>;
      const required = (challenge as { unlock?: { requiresQuestIds?: string[] } }).unlock?.requiresQuestIds ?? [];
      if (required.some((id) => !cleared[id])) {
        return NextResponse.json({ error: "Clear the previous quest with Submit all first.", code: "prerequisite_locked" }, { status: 409 });
      }
      const rewards = (challenge as { rewards?: { xp?: number; shards?: number } }).rewards;
      const baseXp = rewards?.xp ?? 0;
      const factor = payload.solutionAssisted ? 0.5 : payload.hintCount > 0 ? 0.75 : 1;
      applyAuthoritativeClear(session.tokenHash, { id: challenge.id, xp: Math.max(5, Math.round(baseXp * factor)), shards: rewards?.shards ?? 0 });
    }
    return NextResponse.json({
      ...result,
      pack: { id: pack.id, slug: pack.slug, title: pack.title },
      challenge: { id: challenge.id, title: challenge.title },
      mode: payload.mode,
      security: { profile: "isolated-runner-service-v1", grading: "authoritative-execution", fallback: "disabled" }
    });
  } catch (error) {
    if (error instanceof RunValidationError) return NextResponse.json({ error: error.message, code: "invalid_request" }, { status: 400 });
    if (error instanceof RunnerBoundaryError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    return NextResponse.json({ error: "Unable to process this run.", code: "internal_error" }, { status: 500 });
  }
}
