/**
 * The design style tile is a review tool, not a product page: available in local development
 * and on Vercel preview deployments, never on production.
 */
export function styleguideEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.NODE_ENV !== "production" || env.VERCEL_ENV === "preview";
}
