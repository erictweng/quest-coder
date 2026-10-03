import { cookies } from "next/headers";
import { configuredProgressBackend, sessionForToken } from "./progress-store";
import { createSupabaseServerClient } from "./supabase/server";
import { sessionFromSupabaseUser, type QuestCoderSession } from "./auth-identity";

export { sessionFromSupabaseUser, type QuestCoderSession } from "./auth-identity";

export const SESSION_COOKIE = "quest_coder_session";

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 24 * 365
} as const;

export async function currentSession(): Promise<QuestCoderSession | null> {
  if (configuredProgressBackend() === "supabase") {
    const supabase = await createSupabaseServerClient();
    // getUser verifies the access token with Supabase Auth. Do not authorize
    // requests from getSession(), whose cookie contents are not server-verified.
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return null;
    return sessionFromSupabaseUser(user);
  }

  const jar = await cookies();
  const local = sessionForToken(jar.get(SESSION_COOKIE)?.value);
  if (!local) return null;
  return {
    userId: local.tokenHash,
    progressKey: local.tokenHash,
    rateLimitKey: `local:${local.tokenHash}`,
    displayName: local.displayName,
    provider: "local"
  };
}
