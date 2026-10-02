/**
 * Caller address for rate limiting, or null when it cannot be known.
 *
 * `x-forwarded-for` is only trustworthy for the entries appended by proxies we
 * run, so QUEST_CODER_TRUSTED_PROXY_HOPS says how many there are (1 for a
 * single load balancer or platform edge). With 0, the header is caller
 * controlled and is ignored.
 */
export function clientAddress(request: Request): string | null {
  const hops = Number(process.env.QUEST_CODER_TRUSTED_PROXY_HOPS ?? 0);
  if (!Number.isInteger(hops) || hops < 1) return null;
  const forwarded = (request.headers.get("x-forwarded-for") ?? "").split(",").map((entry) => entry.trim()).filter(Boolean);
  // Each trusted proxy appends the address it saw, so the client is `hops` entries from the right.
  return forwarded[forwarded.length - hops] ?? null;
}
