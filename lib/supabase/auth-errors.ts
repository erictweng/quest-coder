export type MagicLinkFailure = { code: string; status: number; message: string };

/**
 * Maps Supabase Auth error codes (non-secret identifiers) to actionable, user-safe messages.
 * The raw Supabase message is never returned, because it can echo request details.
 */
export function describeMagicLinkError(error: { code?: string; status?: number }): MagicLinkFailure {
  const code = error.code ?? (error.status === 429 ? "over_email_send_rate_limit" : "unknown");
  switch (code) {
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return { code, status: 429, message: "Too many sign-in emails were requested. Wait a few minutes and try again." };
    case "email_address_invalid":
    case "validation_failed":
      return { code, status: 400, message: "That email address was not accepted. Check it and try again." };
    case "signup_disabled":
    case "otp_disabled":
    case "email_provider_disabled":
      return { code, status: 503, message: "Email sign-in is not enabled for this site yet." };
    default:
      return { code, status: 502, message: "Could not send the sign-in link. Try again shortly." };
  }
}
