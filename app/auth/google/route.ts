import { NextResponse } from "next/server";
import { configuredProgressBackend } from "../../../lib/progress-store";
import { createSupabaseServerClient } from "../../../lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Starts Google sign-in through Supabase Auth (PKCE). Supabase stores the code verifier in a
 * cookie on this response; /auth/callback exchanges the returned code for a session.
 */
export async function GET(request: Request) {
  const requestOrigin = new URL(request.url).origin;
  const failure = (reason: string) => {
    const destination = new URL("/", requestOrigin);
    destination.searchParams.set("auth_error", reason);
    return NextResponse.redirect(destination, 303);
  };
  if (configuredProgressBackend() !== "supabase") return failure("google_unavailable");

  const configuredSite = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  const origin = configuredSite || requestOrigin;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${origin}/auth/callback`, skipBrowserRedirect: true }
  });
  if (error || !data?.url) {
    console.error("supabase google oauth start failed", { code: (error as { code?: string } | null)?.code ?? null, status: (error as { status?: number } | null)?.status ?? null });
    return failure("google_failed");
  }
  return NextResponse.redirect(data.url, 303);
}
