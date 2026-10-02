import { createHash, randomBytes } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

const DB_PATH = process.env.QUEST_CODER_DATABASE_PATH || resolve(process.cwd(), ".data/quest-coder.sqlite");
let database: DatabaseSync | null = null;

type StoredProgress = Record<string, unknown> & {
  cleared?: Record<string, boolean>;
  reviews?: Record<string, unknown>;
  rewards?: { xp?: number; shards?: number; grants?: unknown[]; shopPreviewUnlocked?: boolean };
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
  return database;
}

export function newSession(displayName: string) {
  const token = randomBytes(32).toString("base64url");
  const hash = tokenHash(token);
  const now = new Date().toISOString();
  db().prepare("INSERT INTO sessions(token_hash, display_name, created_at, last_seen_at) VALUES(?, ?, ?, ?)").run(hash, displayName, now, now);
  writeRawProgress(hash, emptyProgress());
  return { token, displayName };
}

export function sessionForToken(token: string | undefined) {
  if (!token) return null;
  const hash = tokenHash(token);
  const row = db().prepare("SELECT display_name FROM sessions WHERE token_hash = ?").get(hash) as { display_name?: string } | undefined;
  if (!row?.display_name) return null;
  db().prepare("UPDATE sessions SET last_seen_at = ? WHERE token_hash = ?").run(new Date().toISOString(), hash);
  return { tokenHash: hash, displayName: row.display_name };
}

export function deleteSession(token: string | undefined) {
  if (token) db().prepare("DELETE FROM sessions WHERE token_hash = ?").run(tokenHash(token));
}

export function readServerProgress(hash: string): StoredProgress | null {
  const row = db().prepare("SELECT payload FROM progress WHERE token_hash = ?").get(hash) as { payload?: string } | undefined;
  if (!row?.payload) return null;
  try { return JSON.parse(row.payload) as StoredProgress; } catch { return null; }
}

/** Saves client-owned drafts/attempt UI while preserving server-owned clears, reviews and rewards. */
export function writeServerProgress(hash: string, payload: unknown) {
  const incoming = payload && typeof payload === "object" ? payload as StoredProgress : {};
  const authoritative = readServerProgress(hash) ?? emptyProgress();
  writeRawProgress(hash, {
    ...incoming,
    cleared: authoritative.cleared ?? {},
    reviews: authoritative.reviews ?? {},
    rewards: authoritative.rewards ?? emptyProgress().rewards
  });
}

/** Idempotent first-clear transaction. The client cannot award itself XP or unlocks. */
export function applyAuthoritativeClear(hash: string, challenge: { id: string; xp: number; shards: number }) {
  const current = readServerProgress(hash) ?? emptyProgress();
  const cleared = { ...(current.cleared ?? {}) };
  const currentRewards = current.rewards ?? emptyProgress().rewards!;
  const rewards = { ...currentRewards, grants: [...(currentRewards.grants ?? [])] };
  if (!cleared[challenge.id]) {
    cleared[challenge.id] = true;
    rewards.xp = Number(rewards.xp ?? 0) + challenge.xp;
    rewards.shards = Number(rewards.shards ?? 0) + challenge.shards;
    rewards.grants = [{ id: `${challenge.id}-first-clear`, at: new Date().toISOString(), challengeId: challenge.id, xp: challenge.xp, shards: challenge.shards, reason: challenge.shards ? "boss reward grant" : "quest reward grant" }, ...rewards.grants].slice(0, 20);
  }
  writeRawProgress(hash, { ...current, cleared, rewards });
}

function writeRawProgress(hash: string, payload: unknown) {
  const serialized = JSON.stringify(payload);
  if (Buffer.byteLength(serialized, "utf8") > 1_000_000) throw new Error("progress payload too large");
  const now = new Date().toISOString();
  db().prepare(`INSERT INTO progress(token_hash, payload, updated_at) VALUES(?, ?, ?)
    ON CONFLICT(token_hash) DO UPDATE SET payload=excluded.payload, updated_at=excluded.updated_at`).run(hash, serialized, now);
}

function emptyProgress(): StoredProgress {
  return { cleared: {}, solutionOpened: {}, hintsOpened: {}, attempts: {}, savedCode: {}, reviews: {}, rewards: { xp: 0, shards: 0, grants: [], shopPreviewUnlocked: false }, friendsEnabled: false };
}

function tokenHash(token: string) { return createHash("sha256").update(token).digest("hex"); }
