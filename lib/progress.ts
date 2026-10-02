const DAY_MS = 24 * 60 * 60 * 1000;
export const MAX_GRANTS = 20;
export const MAX_ATTEMPTS_PER_CHALLENGE = 15;
export const MAX_SAVED_CODE_BYTES = 24_000;

export type RewardGrant = { id: string; at: string; challengeId: string; xp: number; shards: number; reason: string };
export type RewardWallet = { xp: number; shards: number; grants: RewardGrant[]; shopPreviewUnlocked: boolean };
export type ReviewRecord = {
  packSlug: string;
  bossId: string;
  topic: string;
  intervalDays: number;
  nextDueAt: string;
  lastOutcome: "passed";
  streak: number;
  rating: number;
  snoozedUntil?: string;
};

export type ServerOwnedProgress = {
  cleared: Record<string, boolean>;
  solutionOpened: Record<string, boolean>;
  hintsOpened: Record<string, number>;
  reviews: Record<string, ReviewRecord>;
  rewards: RewardWallet;
};

export type ClientOwnedProgress = {
  attempts: Record<string, unknown[]>;
  savedCode: Record<string, string>;
  friendsEnabled: boolean;
  /** Per-challenge optimistic revisions used to reject stale draft overwrites. */
  savedCodeVersions: Record<string, number>;
};

export type StoredProgress = ServerOwnedProgress & ClientOwnedProgress & { version: number };

export type ClearInput = {
  challengeId: string;
  baseXp: number;
  shards: number;
  hintMultiplier?: number;
  solutionMultiplier?: number;
  review?: { packSlug: string; topic: string; schedule: number[] };
};

export function emptyProgress(): StoredProgress {
  return {
    version: 0,
    cleared: {},
    solutionOpened: {},
    hintsOpened: {},
    attempts: {},
    savedCode: {},
    savedCodeVersions: {},
    reviews: {},
    rewards: { xp: 0, shards: 0, grants: [], shopPreviewUnlocked: false },
    friendsEnabled: false
  };
}

export function normalizeProgress(value: unknown): StoredProgress {
  const raw = isRecord(value) ? value : {};
  const rewards = isRecord(raw.rewards) ? raw.rewards : {};
  return {
    version: nonNegativeInteger(raw.version),
    cleared: booleanRecord(raw.cleared),
    solutionOpened: booleanRecord(raw.solutionOpened),
    hintsOpened: numberRecord(raw.hintsOpened),
    reviews: isRecord(raw.reviews) ? raw.reviews as Record<string, ReviewRecord> : {},
    rewards: {
      xp: Number(rewards.xp) || 0,
      shards: Number(rewards.shards) || 0,
      grants: Array.isArray(rewards.grants) ? rewards.grants.slice(0, MAX_GRANTS) as RewardGrant[] : [],
      shopPreviewUnlocked: rewards.shopPreviewUnlocked === true
    },
    ...normalizeClientProgress(raw)
  };
}

export function normalizeClientProgress(value: unknown): ClientOwnedProgress {
  const raw = isRecord(value) ? value : {};
  const attempts: Record<string, unknown[]> = {};
  for (const [id, list] of Object.entries(isRecord(raw.attempts) ? raw.attempts : {})) {
    if (Array.isArray(list)) attempts[id] = list.slice(0, MAX_ATTEMPTS_PER_CHALLENGE);
  }
  const savedCode: Record<string, string> = {};
  for (const [id, code] of Object.entries(isRecord(raw.savedCode) ? raw.savedCode : {})) {
    if (typeof code === "string" && Buffer.byteLength(code, "utf8") <= MAX_SAVED_CODE_BYTES) savedCode[id] = code;
  }
  return {
    attempts,
    savedCode,
    friendsEnabled: raw.friendsEnabled === true,
    savedCodeVersions: numberRecord(raw.savedCodeVersions)
  };
}

/**
 * Merges browser-owned fields without replacing whole maps. Attempts are unioned
 * by attempt id. A draft is accepted only when its per-challenge revision still
 * matches, so a delayed tab cannot overwrite a newer edit.
 */
export function mergeClientProgress(current: StoredProgress, payload: unknown): StoredProgress {
  const incoming = normalizeClientProgress(payload);
  const attempts = { ...current.attempts };
  let changed = false;
  for (const [challengeId, list] of Object.entries(incoming.attempts)) {
    const byId = new Map<string, unknown>();
    for (const attempt of [...list, ...(attempts[challengeId] ?? [])]) {
      const id = isRecord(attempt) && typeof attempt.id === "string" ? attempt.id : JSON.stringify(attempt);
      if (!byId.has(id)) byId.set(id, attempt);
    }
    const merged = [...byId.values()].slice(0, MAX_ATTEMPTS_PER_CHALLENGE);
    if (JSON.stringify(merged) !== JSON.stringify(attempts[challengeId] ?? [])) changed = true;
    attempts[challengeId] = merged;
  }

  const savedCode = { ...current.savedCode };
  const savedCodeVersions = { ...current.savedCodeVersions };
  for (const [challengeId, code] of Object.entries(incoming.savedCode)) {
    const currentRevision = savedCodeVersions[challengeId] ?? 0;
    const expectedRevision = incoming.savedCodeVersions[challengeId] ?? 0;
    if (expectedRevision !== currentRevision) continue;
    if (savedCode[challengeId] === code) continue;
    savedCode[challengeId] = code;
    savedCodeVersions[challengeId] = currentRevision + 1;
    changed = true;
  }

  if (current.friendsEnabled !== incoming.friendsEnabled) changed = true;

  return {
    ...current,
    version: current.version + (changed ? 1 : 0),
    attempts,
    savedCode,
    savedCodeVersions,
    friendsEnabled: incoming.friendsEnabled
  };
}

export function recordHint(current: StoredProgress, challengeId: string, hintTotal: number): StoredProgress {
  const opened = Math.min(Math.max(0, hintTotal), (current.hintsOpened[challengeId] ?? 0) + 1);
  return { ...current, version: current.version + 1, hintsOpened: { ...current.hintsOpened, [challengeId]: opened } };
}

export function recordSolution(current: StoredProgress, challengeId: string): StoredProgress {
  if (current.solutionOpened[challengeId]) return current;
  return { ...current, version: current.version + 1, solutionOpened: { ...current.solutionOpened, [challengeId]: true } };
}

export function unlockShop(current: StoredProgress): StoredProgress {
  if (current.rewards.shopPreviewUnlocked || current.rewards.shards < 1) return current;
  return {
    ...current,
    version: current.version + 1,
    rewards: { ...current.rewards, shards: current.rewards.shards - 1, shopPreviewUnlocked: true }
  };
}

export function applyClear(current: StoredProgress, clear: ClearInput, now = new Date()): { progress: StoredProgress; grant: RewardGrant | null } {
  const hintCount = current.hintsOpened[clear.challengeId] ?? 0;
  const solutionAssisted = Boolean(current.solutionOpened[clear.challengeId]);
  const next: StoredProgress = { ...current };
  let grant: RewardGrant | null = null;
  let changed = false;

  if (!current.cleared[clear.challengeId]) {
    const factor = solutionAssisted ? clear.solutionMultiplier ?? 0.5 : hintCount > 0 ? clear.hintMultiplier ?? 1 : 1;
    grant = {
      id: `${clear.challengeId}-first-clear`,
      at: now.toISOString(),
      challengeId: clear.challengeId,
      xp: Math.max(5, Math.round(clear.baseXp * factor)),
      shards: clear.shards,
      reason: clear.review ? "boss reward grant" : "quest reward grant"
    };
    next.cleared = { ...current.cleared, [clear.challengeId]: true };
    next.rewards = {
      ...current.rewards,
      xp: current.rewards.xp + grant.xp,
      shards: current.rewards.shards + grant.shards,
      grants: [grant, ...current.rewards.grants].slice(0, MAX_GRANTS)
    };
    changed = true;
  }

  const existingReview = clear.review ? current.reviews[clear.review.packSlug] : undefined;
  const reviewIsDue = !existingReview || now.getTime() >= new Date(existingReview.nextDueAt).getTime();
  if (clear.review && reviewIsDue) {
    const { packSlug, topic, schedule } = clear.review;
    next.reviews = {
      ...current.reviews,
      [packSlug]: nextReview(current.reviews[packSlug], { packSlug, bossId: clear.challengeId, topic, schedule, hintCount, solutionAssisted, now })
    };
    changed = true;
  }
  if (changed) next.version = current.version + 1;
  return { progress: next, grant };
}

export function nextReview(
  existing: ReviewRecord | undefined,
  input: { packSlug: string; bossId: string; topic: string; schedule: number[]; hintCount: number; solutionAssisted: boolean; now: Date }
): ReviewRecord {
  const schedule = input.schedule.length ? input.schedule : [1, 3, 7, 14, 30];
  const prior = existing?.intervalDays ?? 0;
  const assisted = input.solutionAssisted || input.hintCount > 0;
  const intervalDays = assisted
    ? Math.max(1, Math.min(prior || schedule[0], input.hintCount >= 2 ? 3 : 7))
    : schedule.find((days) => days > prior) ?? Math.min(prior * 2, schedule[schedule.length - 1]);
  return {
    packSlug: input.packSlug,
    bossId: input.bossId,
    topic: input.topic,
    intervalDays,
    nextDueAt: new Date(input.now.getTime() + intervalDays * DAY_MS).toISOString(),
    lastOutcome: "passed",
    streak: (existing?.streak ?? 0) + 1,
    rating: Math.max(0, Math.min(2400, (existing?.rating ?? 1000) + (assisted ? 20 : 80)))
  };
}

export function serverOwned(progress: StoredProgress): ServerOwnedProgress {
  const { cleared, solutionOpened, hintsOpened, reviews, rewards } = progress;
  return { cleared, solutionOpened, hintsOpened, reviews, rewards };
}

function booleanRecord(value: unknown): Record<string, boolean> {
  if (!isRecord(value)) return {};
  return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, boolean] => typeof entry[1] === "boolean"));
}

function numberRecord(value: unknown): Record<string, number> {
  if (!isRecord(value)) return {};
  const entries: [string, number][] = [];
  for (const [key, item] of Object.entries(value)) {
    const number = nonNegativeInteger(item);
    if (number >= 0 && Number.isFinite(Number(item))) entries.push([key, number]);
  }
  return Object.fromEntries(entries);
}

function nonNegativeInteger(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.floor(number) : 0;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
