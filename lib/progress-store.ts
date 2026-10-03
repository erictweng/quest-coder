import { createHash, randomBytes } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  applyClear,
  emptyProgress,
  mergeClientProgress,
  nextReview,
  normalizeProgress,
  recordHint,
  recordSolution,
  serverOwned,
  unlockShop,
  type ClearInput,
  type RewardGrant,
  type StoredProgress
} from "./progress.ts";

export type { ClearInput, RewardGrant, ServerOwnedProgress, StoredProgress } from "./progress.ts";
export { nextReview, serverOwned };

const DEFAULT_DB_PATH = process.env.QUEST_CODER_DATABASE_PATH || resolve(process.cwd(), ".data/quest-coder.sqlite");
const SESSION_MAX_IDLE_MS = 400 * 24 * 60 * 60 * 1000;
const MAX_PROGRESS_BYTES = 1_000_000;

export type ProgressStore = {
  read(userId: string): Promise<StoredProgress>;
  writeClient(userId: string, payload: unknown): Promise<StoredProgress>;
  recordHintOpened(userId: string, challengeId: string, hintTotal: number): Promise<StoredProgress>;
  recordSolutionOpened(userId: string, challengeId: string): Promise<StoredProgress>;
  unlockShopPreview(userId: string): Promise<StoredProgress>;
  applyAuthoritativeClear(userId: string, clear: ClearInput, now?: Date): Promise<{ progress: StoredProgress; grant: RewardGrant | null }>;
};

export type ProgressBackend = "local" | "supabase";
type SupabaseEnv = Record<string, string | undefined>;

type SupabaseRpcClient = Pick<SupabaseClient, "schema">;

export function configuredProgressBackend(env: SupabaseEnv = process.env): ProgressBackend {
  const values = [env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, env.SUPABASE_SERVICE_ROLE_KEY];
  const count = values.filter(Boolean).length;
  if (count === 0) return "local";
  if (count !== values.length) {
    throw new Error("Supabase configuration is incomplete; set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, and SUPABASE_SERVICE_ROLE_KEY together");
  }
  return "supabase";
}

export class LocalProgressStore implements ProgressStore {
  private database: DatabaseSync;

  constructor(path = DEFAULT_DB_PATH) {
    mkdirSync(dirname(path), { recursive: true });
    this.database = new DatabaseSync(path);
    this.database.exec(`
      PRAGMA journal_mode=WAL;
      PRAGMA foreign_keys=ON;
      PRAGMA busy_timeout=5000;
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
    this.database.prepare("DELETE FROM sessions WHERE last_seen_at < ?").run(new Date(Date.now() - SESSION_MAX_IDLE_MS).toISOString());
    this.database.prepare("DELETE FROM progress WHERE token_hash NOT IN (SELECT token_hash FROM sessions)").run();
  }

  createSession(displayName: string) {
    const token = randomBytes(32).toString("base64url");
    const hash = tokenHash(token);
    const now = new Date().toISOString();
    this.transaction(() => {
      this.database.prepare("INSERT INTO sessions(token_hash, display_name, created_at, last_seen_at) VALUES(?, ?, ?, ?)").run(hash, displayName, now, now);
      this.writeRow(hash, emptyProgress(), now);
    });
    return { token, tokenHash: hash, displayName };
  }

  sessionForToken(token: string | undefined) {
    if (!token) return null;
    const hash = tokenHash(token);
    const row = this.database.prepare("SELECT display_name FROM sessions WHERE token_hash = ?").get(hash) as { display_name?: string } | undefined;
    if (!row?.display_name) return null;
    this.database.prepare("UPDATE sessions SET last_seen_at = ? WHERE token_hash = ?").run(new Date().toISOString(), hash);
    return { tokenHash: hash, displayName: row.display_name };
  }

  renameSession(hash: string, displayName: string) {
    this.database.prepare("UPDATE sessions SET display_name = ? WHERE token_hash = ?").run(displayName, hash);
  }

  pruneUntouchedSessions(idleMs: number, now = new Date()): number {
    const cutoff = new Date(now.getTime() - idleMs).toISOString();
    const untouched = JSON.stringify(emptyProgress());
    return this.transaction(() => {
      const result = this.database.prepare(`DELETE FROM sessions WHERE last_seen_at < ? AND token_hash IN (SELECT token_hash FROM progress WHERE payload = ?)`).run(cutoff, untouched);
      this.database.prepare("DELETE FROM progress WHERE token_hash NOT IN (SELECT token_hash FROM sessions)").run();
      return Number(result.changes);
    });
  }

  async read(userId: string): Promise<StoredProgress> {
    return this.readRow(userId);
  }

  async writeClient(userId: string, payload: unknown): Promise<StoredProgress> {
    return this.mutate(userId, (current) => ({ progress: mergeClientProgress(current, payload), result: null })).progress;
  }

  async recordHintOpened(userId: string, challengeId: string, hintTotal: number): Promise<StoredProgress> {
    return this.mutate(userId, (current) => ({ progress: recordHint(current, challengeId, hintTotal), result: null })).progress;
  }

  async recordSolutionOpened(userId: string, challengeId: string): Promise<StoredProgress> {
    return this.mutate(userId, (current) => ({ progress: recordSolution(current, challengeId), result: null })).progress;
  }

  async unlockShopPreview(userId: string): Promise<StoredProgress> {
    return this.mutate(userId, (current) => ({ progress: unlockShop(current), result: null })).progress;
  }

  async applyAuthoritativeClear(userId: string, clear: ClearInput, now = new Date()): Promise<{ progress: StoredProgress; grant: RewardGrant | null }> {
    return this.mutate(userId, (current) => {
      const applied = applyClear(current, clear, now);
      return { progress: applied.progress, result: applied.grant };
    }, (progress, grant) => ({ progress, grant }));
  }

  private readRow(userId: string): StoredProgress {
    const row = this.database.prepare("SELECT payload FROM progress WHERE token_hash = ?").get(userId) as { payload?: string } | undefined;
    if (!row?.payload) return emptyProgress();
    try { return normalizeProgress(JSON.parse(row.payload)); } catch { return emptyProgress(); }
  }

  private writeRow(userId: string, progress: StoredProgress, now = new Date().toISOString()) {
    const serialized = JSON.stringify(progress);
    if (Buffer.byteLength(serialized, "utf8") > MAX_PROGRESS_BYTES) throw new Error("progress payload too large");
    this.database.prepare(`INSERT INTO progress(token_hash, payload, updated_at) VALUES(?, ?, ?)
      ON CONFLICT(token_hash) DO UPDATE SET payload=excluded.payload, updated_at=excluded.updated_at`).run(userId, serialized, now);
  }

  private mutate<T, R = { progress: StoredProgress; result: T }>(
    userId: string,
    operation: (current: StoredProgress) => { progress: StoredProgress; result: T },
    map: (progress: StoredProgress, result: T) => R = ((progress, result) => ({ progress, result }) as R)
  ): R {
    return this.transaction(() => {
      const { progress, result } = operation(this.readRow(userId));
      this.writeRow(userId, progress);
      return map(progress, result);
    });
  }

  private transaction<T>(operation: () => T): T {
    this.database.exec("BEGIN IMMEDIATE");
    try {
      const result = operation();
      this.database.exec("COMMIT");
      return result;
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }
}

export class SupabaseProgressStore implements ProgressStore {
  private client: SupabaseRpcClient;

  constructor(client: SupabaseRpcClient) {
    this.client = client;
  }

  async read(userId: string): Promise<StoredProgress> {
    return normalizeProgress(await this.rpc("quest_coder_read_progress", { p_user_id: userId }));
  }

  async writeClient(userId: string, payload: unknown): Promise<StoredProgress> {
    return normalizeProgress(await this.rpc("quest_coder_merge_client_progress", { p_user_id: userId, p_client: payload }));
  }

  async recordHintOpened(userId: string, challengeId: string, hintTotal: number): Promise<StoredProgress> {
    return normalizeProgress(await this.rpc("quest_coder_record_hint", { p_user_id: userId, p_challenge_id: challengeId, p_hint_total: hintTotal }));
  }

  async recordSolutionOpened(userId: string, challengeId: string): Promise<StoredProgress> {
    return normalizeProgress(await this.rpc("quest_coder_record_solution", { p_user_id: userId, p_challenge_id: challengeId }));
  }

  async unlockShopPreview(userId: string): Promise<StoredProgress> {
    return normalizeProgress(await this.rpc("quest_coder_unlock_shop_preview", { p_user_id: userId }));
  }

  async applyAuthoritativeClear(userId: string, clear: ClearInput, now = new Date()): Promise<{ progress: StoredProgress; grant: RewardGrant | null }> {
    const value = await this.rpc("quest_coder_apply_clear", { p_user_id: userId, p_clear: clear, p_now: now.toISOString() });
    const result = isObject(value) ? value : {};
    return { progress: normalizeProgress(result.progress), grant: isObject(result.grant) ? result.grant as RewardGrant : null };
  }

  private async rpc(name: string, args: Record<string, unknown>): Promise<unknown> {
    const { data, error } = await this.client.schema("quest_coder").rpc(name, args);
    if (error) throw new Error(`Supabase progress RPC ${name} failed: ${error.message}`);
    return data;
  }
}

let localStore: LocalProgressStore | null = null;
let selectedStore: ProgressStore | null = null;

export function getLocalProgressStore(): LocalProgressStore {
  localStore ??= new LocalProgressStore();
  return localStore;
}

export async function getProgressStore(): Promise<ProgressStore> {
  if (selectedStore) return selectedStore;
  if (configuredProgressBackend() === "local") selectedStore = getLocalProgressStore();
  else {
    const { createClient } = await import("@supabase/supabase-js");
    const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
    });
    selectedStore = new SupabaseProgressStore(client);
  }
  return selectedStore;
}

/** Test hook for dependency injection; production code should use getProgressStore(). */
export function setProgressStoreForTests(store: ProgressStore | null) {
  selectedStore = store;
}

export function newSession(displayName: string) { return getLocalProgressStore().createSession(displayName); }
export function sessionForToken(token: string | undefined) { return getLocalProgressStore().sessionForToken(token); }
export function renameSession(hash: string, displayName: string) { getLocalProgressStore().renameSession(hash, displayName); }
export function pruneUntouchedSessions(idleMs: number, now = new Date()) { return getLocalProgressStore().pruneUntouchedSessions(idleMs, now); }
export async function readServerProgress(userId: string) { return (await getProgressStore()).read(userId); }
export async function writeClientProgress(userId: string, payload: unknown) { return (await getProgressStore()).writeClient(userId, payload); }
export async function recordHintOpened(userId: string, challengeId: string, hintTotal: number) { return (await getProgressStore()).recordHintOpened(userId, challengeId, hintTotal); }
export async function recordSolutionOpened(userId: string, challengeId: string) { return (await getProgressStore()).recordSolutionOpened(userId, challengeId); }
export async function unlockShopPreview(userId: string) { return (await getProgressStore()).unlockShopPreview(userId); }
export async function applyAuthoritativeClear(userId: string, clear: ClearInput, now = new Date()) { return (await getProgressStore()).applyAuthoritativeClear(userId, clear, now); }

function tokenHash(token: string) { return createHash("sha256").update(token).digest("hex"); }
function isObject(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
