import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "../../../lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const destination = new URL("/", url.origin);
  if (!code) {
    // Providers such as Google return ?error=access_denied when the player cancels.
    destination.searchParams.set("auth_error", url.searchParams.get("error") === "access_denied" ? "access_denied" : "missing_code");
    return NextResponse.redirect(destination);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) destination.searchParams.set("auth_error", "callback_failed");
  else destination.searchParams.set("signed_in", "1");
  return NextResponse.redirect(destination);
}
