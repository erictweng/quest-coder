import { NextResponse } from "next/server";
import { readServerProgress, recordHintOpened, recordSolutionOpened, unlockShopPreview, writeClientProgress, type StoredProgress } from "../../../lib/progress-store";
import { findChallengeById, revealedContent } from "../../../lib/quests";
import { currentSession } from "../../../lib/session";

const MAX_BODY_BYTES = 1_000_000;

function progressResponse(progress: StoredProgress) {
  return NextResponse.json({ progress, revealed: revealedContent(progress) });
}

export async function GET() {
  const session = await currentSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return progressResponse(readServerProgress(session.tokenHash));
}

/** Saves client-owned state: editor drafts, attempt history, and UI preferences. */
export async function PUT(request: Request) {
  const session = await currentSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await readJsonBody(request) as { progress?: unknown } | null;
  if (!body || typeof body.progress !== "object" || body.progress === null) return NextResponse.json({ error: "invalid progress" }, { status: 400 });
  try { writeClientProgress(session.tokenHash, body.progress); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "write failed" }, { status: 400 }); }
  return NextResponse.json({ saved: true });
}

/** Player actions that change server-owned state: opening help and spending shards. */
export async function POST(request: Request) {
  const session = await currentSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await readJsonBody(request) as { action?: unknown; challengeId?: unknown } | null;
  const found = typeof body?.challengeId === "string" ? findChallengeById(body.challengeId) : null;
  // Help is only available for quests the player has reached.
  const { cleared } = readServerProgress(session.tokenHash);
  const locked = found ? (found.challenge.unlock?.requiresQuestIds ?? []).some((id) => !cleared[id]) : false;
  const lockedResponse = () => NextResponse.json({ error: "Clear the previous quest with Submit all first.", code: "prerequisite_locked" }, { status: 409 });

  switch (body?.action) {
    case "open_hint":
      if (!found) return NextResponse.json({ error: "unknown challenge" }, { status: 400 });
      if (locked) return lockedResponse();
      return progressResponse(recordHintOpened(session.tokenHash, found.challenge.id, found.challenge.hints?.length ?? 0));
    case "open_solution":
      if (!found) return NextResponse.json({ error: "unknown challenge" }, { status: 400 });
      if (locked) return lockedResponse();
      return progressResponse(recordSolutionOpened(session.tokenHash, found.challenge.id));
    case "unlock_shop_preview":
      return progressResponse(unlockShopPreview(session.tokenHash));
    default:
      return NextResponse.json({ error: "unknown action" }, { status: 400 });
  }
}

async function readJsonBody(request: Request): Promise<unknown> {
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) return null;
  const text = await request.text().catch(() => "");
  if (Buffer.byteLength(text, "utf8") > MAX_BODY_BYTES) return null;
  try { return JSON.parse(text); } catch { return null; }
}
