import { createHash, randomBytes } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

const DB_PATH = process.env.QUEST_CODER_DATABASE_PATH || resolve(process.cwd(), ".data/quest-coder.sqlite");
const SESSION_MAX_IDLE_MS = 400 * 24 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_GRANTS = 20;
const MAX_ATTEMPTS_PER_CHALLENGE = 15;
const MAX_SAVED_CODE_BYTES = 24_000;
let database: DatabaseSync | null = null;

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

/** Everything the server decides. The client can read these but never write them directly. */
export type ServerOwnedProgress = {
  cleared: Record<string, boolean>;
  solutionOpened: Record<string, boolean>;
  hintsOpened: Record<string, number>;
  reviews: Record<string, ReviewRecord>;
  rewards: RewardWallet;
};

/** Editor drafts and attempt history: the client is the only writer. */
export type ClientOwnedProgress = {
  attempts: Record<string, unknown[]>;
  savedCode: Record<string, string>;
  friendsEnabled: boolean;
};

export type StoredProgress = ServerOwnedProgress & ClientOwnedProgress;

export type ClearInput = {
  challengeId: string;
  baseXp: number;
  shards: number;
  /** Share of the XP kept after opening hints or the solution. Defaults: hints are free, the solution halves it. */
  hintMultiplier?: number;
  solutionMultiplier?: number;
  /** Present for boss clears, which schedule a spaced review. */
  review?: { packSlug: string; topic: string; schedule: number[] };
};

function db() {
  if (database) return database;
  mkdirSync(dirname(DB_PATH), { recursive: true });
  database = new DatabaseSync(DB_PATH);
  database.exec(`
    PRAGMA journal_mode=WAL;
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      display_name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS progress (
      token_hash TEXT PRIMARY KEY REFERENCES sessions(token_hash) ON DELETE CASCADE,
      payload TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
  // Sessions idle for longer than the cookie lifetime can never come back.
  database.prepare("DELETE FROM sessions WHERE last_seen_at < ?").run(new Date(Date.now() - SESSION_MAX_IDLE_MS).toISOString());
  return database;
}

export function newSession(displayName: string) {
  const token = randomBytes(32).toString("base64url");
  const hash = tokenHash(token);
  const now = new Date().toISOString();
  db().prepare("INSERT INTO sessions(token_hash, display_name, created_at, last_seen_at) VALUES(?, ?, ?, ?)").run(hash, displayName, now, now);
  writeProgress(hash, emptyProgress());
  return { token, tokenHash: hash, displayName };
}

export function sessionForToken(token: string | undefined) {
  if (!token) return null;
  const hash = tokenHash(token);
  const row = db().prepare("SELECT display_name FROM sessions WHERE token_hash = ?").get(hash) as { display_name?: string } | undefined;
  if (!row?.display_name) return null;
  db().prepare("UPDATE sessions SET last_seen_at = ? WHERE token_hash = ?").run(new Date().toISOString(), hash);
  return { tokenHash: hash, displayName: row.display_name };
}

/**
 * Deletes sessions that were created but never used: the save is still exactly
 * the empty one and nothing has been seen from the cookie for `idleMs`.
 * Removing them loses nothing, which makes this a safe response to a flood of
 * sign-ups. Returns how many were deleted.
 */
export function pruneUntouchedSessions(idleMs: number, now = new Date()): number {
  const cutoff = new Date(now.getTime() - idleMs).toISOString();
  const untouched = JSON.stringify(emptyProgress());
  const result = db().prepare(`DELETE FROM sessions WHERE last_seen_at < ? AND token_hash IN (SELECT token_hash FROM progress WHERE payload = ?)`).run(cutoff, untouched);
  // Explicit, so this does not depend on foreign-key enforcement being on.
  db().prepare("DELETE FROM progress WHERE token_hash NOT IN (SELECT token_hash FROM sessions)").run();
  return Number(result.changes);
}

export function renameSession(hash: string, displayName: string) {
  db().prepare("UPDATE sessions SET display_name = ? WHERE token_hash = ?").run(displayName, hash);
}

export function readServerProgress(hash: string): StoredProgress {
  const row = db().prepare("SELECT payload FROM progress WHERE token_hash = ?").get(hash) as { payload?: string } | undefined;
  if (!row?.payload) return emptyProgress();
  try { return normalizeProgress(JSON.parse(row.payload)); } catch { return emptyProgress(); }
}

export function serverOwned(progress: StoredProgress): ServerOwnedProgress {
  const { cleared, solutionOpened, hintsOpened, reviews, rewards } = progress;
  return { cleared, solutionOpened, hintsOpened, reviews, rewards };
}

/** Saves drafts and attempt history. Anything server-owned in the payload is ignored. */
export function writeClientProgress(hash: string, payload: unknown) {
  const incoming = normalizeClientProgress(payload);
  writeProgress(hash, { ...readServerProgress(hash), ...incoming });
}

/** Counts one more opened hint, up to the number of hints the challenge has. */
export function recordHintOpened(hash: string, challengeId: string, hintTotal: number): StoredProgress {
  const current = readServerProgress(hash);
  const opened = Math.min(hintTotal, (current.hintsOpened[challengeId] ?? 0) + 1);
  return writeProgress(hash, { ...current, hintsOpened: { ...current.hintsOpened, [challengeId]: opened } });
}

export function recordSolutionOpened(hash: string, challengeId: string): StoredProgress {
  const current = readServerProgress(hash);
  return writeProgress(hash, { ...current, solutionOpened: { ...current.solutionOpened, [challengeId]: true } });
}

/** Spends one shard on the shop preview. No-op when already unlocked or the wallet is empty. */
export function unlockShopPreview(hash: string): StoredProgress {
  const current = readServerProgress(hash);
  if (current.rewards.shopPreviewUnlocked || current.rewards.shards < 1) return current;
  return writeProgress(hash, { ...current, rewards: { ...current.rewards, shards: current.rewards.shards - 1, shopPreviewUnlocked: true } });
}

/**
 * Records a passing submit. The reward is granted once per challenge and is
 * scaled by the help the server saw the player open, not by anything the
 * client claims. A boss clear schedules the pack's spaced review; later boss
 * clears advance it only when the review is due.
 */
export function applyAuthoritativeClear(hash: string, clear: ClearInput, now = new Date()): { progress: StoredProgress; grant: RewardGrant | null } {
  const current = readServerProgress(hash);
  const hintCount = current.hintsOpened[clear.challengeId] ?? 0;
  const solutionAssisted = Boolean(current.solutionOpened[clear.challengeId]);
  const next: StoredProgress = { ...current };
  let grant: RewardGrant | null = null;

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
  }
  // A rematch only counts once the review is due, so resubmitting cannot farm streak or rating.
  const existingReview = clear.review ? current.reviews[clear.review.packSlug] : undefined;
  const reviewIsDue = !existingReview || now.getTime() >= new Date(existingReview.nextDueAt).getTime();
  if (clear.review && reviewIsDue) {
    const { packSlug, topic, schedule } = clear.review;
    next.reviews = {
      ...current.reviews,
      [packSlug]: nextReview(current.reviews[packSlug], { packSlug, bossId: clear.challengeId, topic, schedule, hintCount, solutionAssisted, now })
    };
  }
  return { progress: writeProgress(hash, next), grant };
}

/** Spaced-review schedule after a passing boss submit. Unassisted wins climb the schedule; assisted wins come back sooner. */
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

function writeProgress(hash: string, progress: StoredProgress): StoredProgress {
  const serialized = JSON.stringify(progress);
  if (Buffer.byteLength(serialized, "utf8") > 1_000_000) throw new Error("progress payload too large");
  const now = new Date().toISOString();
  db().prepare(`INSERT INTO progress(token_hash, payload, updated_at) VALUES(?, ?, ?)
    ON CONFLICT(token_hash) DO UPDATE SET payload=excluded.payload, updated_at=excluded.updated_at`).run(hash, serialized, now);
  return progress;
}

function emptyProgress(): StoredProgress {
  return { cleared: {}, solutionOpened: {}, hintsOpened: {}, attempts: {}, savedCode: {}, reviews: {}, rewards: { xp: 0, shards: 0, grants: [], shopPreviewUnlocked: false }, friendsEnabled: false };
}

function normalizeProgress(value: unknown): StoredProgress {
  const raw = isRecord(value) ? value : {};
  const rewards = isRecord(raw.rewards) ? raw.rewards : {};
  return {
    cleared: isRecord(raw.cleared) ? raw.cleared as Record<string, boolean> : {},
    solutionOpened: isRecord(raw.solutionOpened) ? raw.solutionOpened as Record<string, boolean> : {},
    hintsOpened: isRecord(raw.hintsOpened) ? raw.hintsOpened as Record<string, number> : {},
    reviews: isRecord(raw.reviews) ? raw.reviews as Record<string, ReviewRecord> : {},
    rewards: {
      xp: Number(rewards.xp) || 0,
      shards: Number(rewards.shards) || 0,
      grants: Array.isArray(rewards.grants) ? rewards.grants as RewardGrant[] : [],
      shopPreviewUnlocked: rewards.shopPreviewUnlocked === true
    },
    ...normalizeClientProgress(raw)
  };
}

function normalizeClientProgress(value: unknown): ClientOwnedProgress {
  const raw = isRecord(value) ? value : {};
  const attempts: Record<string, unknown[]> = {};
  for (const [id, list] of Object.entries(isRecord(raw.attempts) ? raw.attempts : {})) {
    if (Array.isArray(list)) attempts[id] = list.slice(0, MAX_ATTEMPTS_PER_CHALLENGE);
  }
  const savedCode: Record<string, string> = {};
  for (const [id, code] of Object.entries(isRecord(raw.savedCode) ? raw.savedCode : {})) {
    if (typeof code === "string" && Buffer.byteLength(code, "utf8") <= MAX_SAVED_CODE_BYTES) savedCode[id] = code;
  }
  return { attempts, savedCode, friendsEnabled: raw.friendsEnabled === true };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function tokenHash(token: string) { return createHash("sha256").update(token).digest("hex"); }
