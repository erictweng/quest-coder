import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { configuredProgressBackend, newSession, pruneUntouchedSessions, readServerProgress, renameSession, sessionForToken } from "../../../lib/progress-store";
import { revealedContent } from "../../../lib/quests";
import { createRateLimiter } from "../../../lib/rate-limit";
import { clientAddress } from "../../../lib/client-address";
import { currentSession, SESSION_COOKIE, SESSION_COOKIE_OPTIONS } from "../../../lib/session";
import { createSupabaseServerClient } from "../../../lib/supabase/server";
import { JsonRequestError, readCappedJson } from "../../../lib/read-json-request";

const HOUR_MS = 60 * 60_000;
const newSessionsPerAddress = createRateLimiter({ limit: 30, windowMs: HOUR_MS });
const signUpSurge = createRateLimiter({ limit: 500, windowMs: HOUR_MS });
const pruneThrottle = createRateLimiter({ limit: 1, windowMs: 60_000 });

export async function GET() {
  const session = await currentSession();
  return NextResponse.json(session ? {
    authenticated: true,
    displayName: session.displayName,
    email: session.email,
    provider: session.provider
  } : { authenticated: false, provider: configuredProgressBackend() });
}

export async function POST(request: Request) {
  try {
    const body = await readCappedJson(request, 4_096) as { email?: unknown; displayName?: unknown };
    if (configuredProgressBackend() === "supabase") return requestMagicLink(request, body);
    return createLocalSession(request, body);
  } catch (error) {
    if (error instanceof JsonRequestError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    throw error;
  }
}

export async function DELETE() {
  if (configuredProgressBackend() === "supabase") {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signOut();
    if (error) return NextResponse.json({ error: "Could not sign out." }, { status: 500 });
  } else {
    // Local logout intentionally only hides the profile in this browser. The
    // opaque cookie remains so signing in again can resume the same save.
  }
  return NextResponse.json({ authenticated: false });
}

async function requestMagicLink(request: Request, body: { email?: unknown }) {
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase().slice(0, 254) : "";
  if (!/^\S+@\S+\.\S+$/.test(email)) return NextResponse.json({ error: "a valid email is required" }, { status: 400 });

  const configuredSite = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  const origin = configuredSite || new URL(request.url).origin;
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${origin}/auth/callback` }
  });
  if (error) return NextResponse.json({ error: "Could not send the sign-in link." }, { status: 400 });
  return NextResponse.json({ pending: true, message: "Check your email for a secure sign-in link." });
}

async function createLocalSession(request: Request, body: { displayName?: unknown }) {
  const displayName = typeof body.displayName === "string" ? body.displayName.trim().slice(0, 40) : "";
  if (!displayName) return NextResponse.json({ error: "display name is required" }, { status: 400 });

  const jar = await cookies();
  const existing = sessionForToken(jar.get(SESSION_COOKIE)?.value);
  if (existing) {
    if (existing.displayName !== displayName) renameSession(existing.tokenHash, displayName);
    return localSessionResponse(existing.tokenHash, displayName);
  }

  const address = clientAddress(request);
  const limit = address ? newSessionsPerAddress(address) : { allowed: true, retryAfterSeconds: 0 };
  if (!signUpSurge("all").allowed && pruneThrottle("prune").allowed) pruneUntouchedSessions(HOUR_MS);
  if (!limit.allowed) {
    return NextResponse.json({ error: "Too many new sessions. Try again later.", code: "rate_limited" }, { status: 429, headers: { "retry-after": String(limit.retryAfterSeconds) } });
  }
  const session = newSession(displayName);
  const response = await localSessionResponse(session.tokenHash, displayName);
  response.cookies.set(SESSION_COOKIE, session.token, SESSION_COOKIE_OPTIONS);
  return response;
}

async function localSessionResponse(progressKey: string, displayName: string) {
  const progress = await readServerProgress(progressKey);
  return NextResponse.json({ authenticated: true, displayName, provider: "local", progress, revealed: revealedContent(progress) });
}
