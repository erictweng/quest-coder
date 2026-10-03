import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "../../../lib/supabase/server";

const EMAIL_OTP_TYPES = new Set<EmailOtpType>(["email", "signup", "invite", "magiclink", "recovery", "email_change"]);

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get("token_hash");
  const rawType = url.searchParams.get("type");
  const destination = new URL("/", url.origin);
  if (!tokenHash || !rawType || !EMAIL_OTP_TYPES.has(rawType as EmailOtpType)) {
    destination.searchParams.set("auth_error", "invalid_confirmation");
    return NextResponse.redirect(destination);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: rawType as EmailOtpType });
  if (error) destination.searchParams.set("auth_error", "confirmation_failed");
  else destination.searchParams.set("signed_in", "1");
  return NextResponse.redirect(destination);
}
