import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { newSession, pruneUntouchedSessions, readServerProgress, renameSession, sessionForToken } from "../../../lib/progress-store";
import { revealedContent } from "../../../lib/quests";
import { createRateLimiter } from "../../../lib/rate-limit";
import { clientAddress } from "../../../lib/client-address";
import { SESSION_COOKIE, SESSION_COOKIE_OPTIONS } from "../../../lib/session";

const HOUR_MS = 60 * 60_000;
// Callers are only limited individually, and only when a trusted proxy tells us who they are.
// A cap shared by everyone would let one caller lock all new players out, so a surge of sign-ups
// is answered by deleting sessions nobody ever used instead of refusing new ones.
const newSessionsPerAddress = createRateLimiter({ limit: 30, windowMs: HOUR_MS });
const signUpSurge = createRateLimiter({ limit: 500, windowMs: HOUR_MS });
const pruneThrottle = createRateLimiter({ limit: 1, windowMs: 60_000 });

export async function GET() {
  const jar = await cookies();
  const session = sessionForToken(jar.get(SESSION_COOKIE)?.value);
  return NextResponse.json(session ? { authenticated: true, displayName: session.displayName } : { authenticated: false });
}

/**
 * Signs in on this browser. The cookie is the save file's only key, so an
 * existing session is resumed (and renamed) instead of being replaced: signing
 * in again never orphans progress.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as { displayName?: unknown };
  const displayName = typeof body.displayName === "string" ? body.displayName.trim().slice(0, 40) : "";
  if (!displayName) return NextResponse.json({ error: "display name is required" }, { status: 400 });

  const jar = await cookies();
  const existing = sessionForToken(jar.get(SESSION_COOKIE)?.value);
  if (existing) {
    if (existing.displayName !== displayName) renameSession(existing.tokenHash, displayName);
    return sessionResponse(existing.tokenHash, displayName);
  }

  const address = clientAddress(request);
  const limit = address ? newSessionsPerAddress(address) : { allowed: true, retryAfterSeconds: 0 };
  if (!signUpSurge("all").allowed && pruneThrottle("prune").allowed) pruneUntouchedSessions(HOUR_MS);
  if (!limit.allowed) {
    return NextResponse.json({ error: "Too many new sessions. Try again later.", code: "rate_limited" }, { status: 429, headers: { "retry-after": String(limit.retryAfterSeconds) } });
  }
  const session = newSession(displayName);
  const response = sessionResponse(session.tokenHash, displayName);
  response.cookies.set(SESSION_COOKIE, session.token, SESSION_COOKIE_OPTIONS);
  return response;
}

function sessionResponse(tokenHash: string, displayName: string) {
  const progress = readServerProgress(tokenHash);
  return NextResponse.json({ authenticated: true, displayName, progress, revealed: revealedContent(progress) });
}
