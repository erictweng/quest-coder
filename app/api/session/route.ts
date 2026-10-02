import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { deleteSession, newSession, sessionForToken } from "../../../lib/progress-store";

const COOKIE = "quest_coder_session";

export async function GET() {
  const jar = await cookies();
  const session = sessionForToken(jar.get(COOKIE)?.value);
  return NextResponse.json(session ? { authenticated: true, displayName: session.displayName } : { authenticated: false });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as { displayName?: unknown };
  const displayName = typeof body.displayName === "string" ? body.displayName.trim().slice(0, 40) : "";
  if (!displayName) return NextResponse.json({ error: "display name is required" }, { status: 400 });
  const session = newSession(displayName);
  const response = NextResponse.json({ authenticated: true, displayName: session.displayName });
  response.cookies.set(COOKIE, session.token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 365 });
  return response;
}

export async function DELETE() {
  const jar = await cookies();
  deleteSession(jar.get(COOKIE)?.value);
  const response = NextResponse.json({ authenticated: false });
  response.cookies.set(COOKIE, "", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 0 });
  return response;
}
