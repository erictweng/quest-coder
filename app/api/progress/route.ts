import { NextResponse } from "next/server";
import { readServerProgress, recordHintOpened, recordSolutionOpened, unlockShopPreview, writeClientProgress, type StoredProgress } from "../../../lib/progress-store";
import { findChallengeById, revealedContent } from "../../../lib/quests";
import { currentSession } from "../../../lib/session";
import { JsonRequestError, readCappedJson } from "../../../lib/read-json-request";

const MAX_BODY_BYTES = 1_000_000;

function progressResponse(progress: StoredProgress) {
  return NextResponse.json({ progress, revealed: revealedContent(progress) });
}

export async function GET() {
  const session = await currentSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return progressResponse(await readServerProgress(session.progressKey));
}

/** Saves client-owned state: editor drafts, attempt history, and UI preferences. */
export async function PUT(request: Request) {
  const session = await currentSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let body: { progress?: unknown };
  try { body = await readCappedJson(request, MAX_BODY_BYTES) as { progress?: unknown }; }
  catch (error) { return jsonBodyError(error); }
  if (!body || typeof body.progress !== "object" || body.progress === null) return NextResponse.json({ error: "invalid progress" }, { status: 400 });
  try { return progressResponse(await writeClientProgress(session.progressKey, body.progress)); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "write failed" }, { status: 400 }); }
}

/** Player actions that change server-owned state: opening help and spending shards. */
export async function POST(request: Request) {
  const session = await currentSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let body: { action?: unknown; challengeId?: unknown };
  try { body = await readCappedJson(request, MAX_BODY_BYTES) as { action?: unknown; challengeId?: unknown }; }
  catch (error) { return jsonBodyError(error); }
  const found = typeof body?.challengeId === "string" ? findChallengeById(body.challengeId) : null;
  // Help is only available for quests the player has reached.
  const { cleared } = await readServerProgress(session.progressKey);
  const locked = found ? (found.challenge.unlock?.requiresQuestIds ?? []).some((id) => !cleared[id]) : false;
  const lockedResponse = () => NextResponse.json({ error: "Clear the previous quest with Submit all first.", code: "prerequisite_locked" }, { status: 409 });

  switch (body?.action) {
    case "open_hint":
      if (!found) return NextResponse.json({ error: "unknown challenge" }, { status: 400 });
      if (locked) return lockedResponse();
      return progressResponse(await recordHintOpened(session.progressKey, found.challenge.id, found.challenge.hints?.length ?? 0));
    case "open_solution":
      if (!found) return NextResponse.json({ error: "unknown challenge" }, { status: 400 });
      if (locked) return lockedResponse();
      return progressResponse(await recordSolutionOpened(session.progressKey, found.challenge.id));
    case "unlock_shop_preview":
      return progressResponse(await unlockShopPreview(session.progressKey));
    default:
      return NextResponse.json({ error: "unknown action" }, { status: 400 });
  }
}

function jsonBodyError(error: unknown) {
  if (error instanceof JsonRequestError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
  return NextResponse.json({ error: "invalid request", code: "invalid_request" }, { status: 400 });
}
