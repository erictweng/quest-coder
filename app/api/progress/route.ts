import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { readServerProgress, sessionForToken, writeServerProgress } from "../../../lib/progress-store";

const COOKIE = "quest_coder_session";

async function currentSession() {
  const jar = await cookies();
  return sessionForToken(jar.get(COOKIE)?.value);
}

export async function GET() {
  const session = await currentSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ progress: readServerProgress(session.tokenHash) });
}

export async function PUT(request: Request) {
  const session = await currentSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null) as { progress?: unknown } | null;
  if (!body || typeof body.progress !== "object" || body.progress === null) return NextResponse.json({ error: "invalid progress" }, { status: 400 });
  try { writeServerProgress(session.tokenHash, body.progress); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "write failed" }, { status: 400 }); }
  return NextResponse.json({ saved: true });
}
