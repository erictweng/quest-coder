import { cookies } from "next/headers";
import { sessionForToken } from "./progress-store";

export const SESSION_COOKIE = "quest_coder_session";

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 24 * 365
} as const;

export async function currentSession() {
  const jar = await cookies();
  return sessionForToken(jar.get(SESSION_COOKIE)?.value);
}
