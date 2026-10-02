/**
 * Fixed-window rate limiter kept in process memory.
 *
 * This bounds abuse for a single app instance. A horizontally scaled
 * deployment needs a shared store instead, because each instance counts alone.
 */
export type RateLimitResult = { allowed: boolean; retryAfterSeconds: number };

export function createRateLimiter(options: { limit: number; windowMs: number; maxKeys?: number }) {
  const { limit, windowMs, maxKeys = 10_000 } = options;
  const windows = new Map<string, { startedAt: number; count: number }>();

  return function check(key: string, now = Date.now()): RateLimitResult {
    const current = windows.get(key);
    if (!current || now - current.startedAt >= windowMs) {
      if (windows.size >= maxKeys) evictExpired(now);
      windows.set(key, { startedAt: now, count: 1 });
      return { allowed: true, retryAfterSeconds: 0 };
    }
    if (current.count >= limit) {
      return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((current.startedAt + windowMs - now) / 1000)) };
    }
    current.count += 1;
    return { allowed: true, retryAfterSeconds: 0 };
  };

  function evictExpired(now: number) {
    for (const [key, window] of windows) {
      if (now - window.startedAt >= windowMs) windows.delete(key);
    }
    // Still full of live windows: drop the oldest so memory stays bounded.
    if (windows.size >= maxKeys) {
      const oldest = windows.keys().next().value;
      if (oldest !== undefined) windows.delete(oldest);
    }
  }
}

/**
 * Limits how much of a shared resource one key may use: a spend budget per
 * window (for example runner seconds per minute) plus a cap on how many
 * operations the key may have in flight at once.
 *
 * Counting requests alone is not enough when requests differ in cost: a few
 * slow runs can occupy every runner slot while staying under a request limit.
 */
export function createUsageLimiter(options: { budget: number; windowMs: number; maxConcurrent: number; maxKeys?: number }) {
  const { budget, windowMs, maxConcurrent, maxKeys = 10_000 } = options;
  const usage = new Map<string, { startedAt: number; spent: number; inFlight: number }>();

  function current(key: string, now: number) {
    let entry = usage.get(key);
    if (!entry) {
      if (usage.size >= maxKeys) evictIdle(now);
      entry = { startedAt: now, spent: 0, inFlight: 0 };
      usage.set(key, entry);
    } else if (now - entry.startedAt >= windowMs) {
      entry.startedAt = now;
      entry.spent = 0;
    }
    return entry;
  }

  function evictIdle(now: number) {
    for (const [key, entry] of usage) {
      if (entry.inFlight === 0 && now - entry.startedAt >= windowMs) usage.delete(key);
    }
  }

  return {
    /** Reserves a slot for one operation, or says why not. Every allowed `begin` must be paired with `end`. */
    begin(key: string, now = Date.now()): RateLimitResult & { reason?: "busy" | "budget" } {
      const entry = current(key, now);
      if (entry.inFlight >= maxConcurrent) return { allowed: false, retryAfterSeconds: 1, reason: "busy" };
      if (entry.spent >= budget) {
        return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((entry.startedAt + windowMs - now) / 1000)), reason: "budget" };
      }
      entry.inFlight += 1;
      return { allowed: true, retryAfterSeconds: 0 };
    },
    /** Releases the slot and charges what the operation cost. */
    end(key: string, cost: number, now = Date.now()) {
      const entry = current(key, now);
      entry.inFlight = Math.max(0, entry.inFlight - 1);
      entry.spent += Math.max(0, cost);
    }
  };
}
