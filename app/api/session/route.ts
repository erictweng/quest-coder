import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { newSession, readServerProgress, renameSession, sessionForToken } from "../../../lib/progress-store";
import { revealedContent } from "../../../lib/quests";
import { createRateLimiter } from "../../../lib/rate-limit";
import { clientAddress } from "../../../lib/client-address";
import { SESSION_COOKIE, SESSION_COOKIE_OPTIONS } from "../../../lib/session";

const HOUR_MS = 60 * 60_000;
// Per caller when a trusted proxy tells us who the caller is; the global cap bounds database growth either way.
const newSessionsPerAddress = createRateLimiter({ limit: 30, windowMs: HOUR_MS });
const newSessionsGlobal = createRateLimiter({ limit: 2_000, windowMs: HOUR_MS });

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
  const perAddress = address ? newSessionsPerAddress(address) : null;
  const limit = perAddress && !perAddress.allowed ? perAddress : newSessionsGlobal("all");
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
