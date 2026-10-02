import { NextResponse } from "next/server";
import { findChallenge, loadQuestPack } from "../../../lib/quests";
import { applyAuthoritativeClear, readServerProgress, serverOwned, type RewardGrant } from "../../../lib/progress-store";
import { createRateLimiter, createUsageLimiter } from "../../../lib/rate-limit";
import { parseRunRequest, RunValidationError } from "../../../lib/run-contract";
import { RunnerBoundaryError, submitToRunner } from "../../../lib/runner-client";
import { currentSession } from "../../../lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const runLimit = createRateLimiter({ limit: 30, windowMs: 60_000 });
// The runner has few slots, so a session gets one at a time and a bounded share of runner time.
// Slow (for example non-terminating) submissions use the share up quickly; normal ones barely touch it.
const runnerTime = createUsageLimiter({ budget: 20_000, windowMs: 60_000, maxConcurrent: 1 });

export async function POST(request: Request) {
  try {
    // Everything that can reject a request happens before the runner is asked to execute anything.
    const session = await currentSession();
    if (!session) return NextResponse.json({ error: "Sign in before running code.", code: "unauthorized" }, { status: 401 });
    const limit = runLimit(session.rateLimitKey);
    if (!limit.allowed) {
      return NextResponse.json({ error: `Too many runs. Try again in ${limit.retryAfterSeconds}s.`, code: "rate_limited" }, { status: 429, headers: { "retry-after": String(limit.retryAfterSeconds) } });
    }
    const payload = parseRunRequest(await request.json().catch(() => null));
    const pack = loadQuestPack(payload.packSlug);
    const challenge = findChallenge(pack, payload.challengeId);
    const required = challenge.unlock?.requiresQuestIds ?? [];
    const { cleared } = await readServerProgress(session.progressKey);
    if (required.some((id) => !cleared[id])) {
      return NextResponse.json({ error: "Clear the previous quest with Submit all first.", code: "prerequisite_locked" }, { status: 409 });
    }

    const slot = runnerTime.begin(session.rateLimitKey);
    if (!slot.allowed) {
      const error = slot.reason === "busy" ? "Your previous run is still in progress." : `You have used your runner time for now. Try again in ${slot.retryAfterSeconds}s.`;
      return NextResponse.json({ error, code: "rate_limited" }, { status: 429, headers: { "retry-after": String(slot.retryAfterSeconds) } });
    }
    const startedAt = Date.now();
    let result: Record<string, unknown>;
    try {
      result = await submitToRunner(payload);
    } finally {
      runnerTime.end(session.rateLimitKey, Date.now() - startedAt);
    }

    let reward: RewardGrant | null = null;
    if (payload.mode === "submit" && result.passed === true) {
      const isBoss = challenge.id === pack.boss.id;
      reward = (await applyAuthoritativeClear(session.progressKey, {
        challengeId: challenge.id,
        baseXp: challenge.rewards?.xp ?? 0,
        shards: challenge.rewards?.shards ?? 0,
        hintMultiplier: pack.rewards?.xp?.hintAssistedMultiplier,
        solutionMultiplier: pack.rewards?.xp?.solutionAssistedMultiplier,
        review: isBoss && pack.review?.enabled ? { packSlug: pack.slug, topic: pack.concepts[0] ?? pack.title, schedule: pack.review.defaultSchedule } : undefined
      })).grant;
    }
    return NextResponse.json({
      ...result,
      pack: { id: pack.id, slug: pack.slug, title: pack.title },
      challenge: { id: challenge.id, title: challenge.title },
      mode: payload.mode,
      reward,
      progress: serverOwned(await readServerProgress(session.progressKey)),
      security: { profile: "isolated-runner-service-v1", grading: "authoritative-execution", fallback: "disabled" }
    });
  } catch (error) {
    if (error instanceof RunValidationError) return NextResponse.json({ error: error.message, code: "invalid_request" }, { status: 400 });
    if (error instanceof RunnerBoundaryError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    return NextResponse.json({ error: "Unable to process this run.", code: "internal_error" }, { status: 500 });
  }
}
