export type VersionedServerProgress = {
  version: number;
  cleared: Record<string, boolean>;
  solutionOpened: Record<string, boolean>;
  hintsOpened: Record<string, number>;
  reviews: Record<string, unknown>;
  rewards: unknown;
};

/** Server-owned snapshots are monotonic. Late responses may not roll them back. */
export function shouldApplyServerSnapshot(currentVersion: number, incomingVersion: number) {
  return Number.isFinite(incomingVersion) && incomingVersion >= currentVersion;
}

export function mergeServerSnapshot<T extends VersionedServerProgress>(current: T, incoming: VersionedServerProgress): T {
  if (!shouldApplyServerSnapshot(current.version, incoming.version)) return current;
  return {
    ...current,
    version: incoming.version,
    cleared: incoming.cleared,
    solutionOpened: incoming.solutionOpened,
    hintsOpened: incoming.hintsOpened,
    reviews: incoming.reviews,
    rewards: incoming.rewards
  } as T;
}

export function mergeRevisionRecord(current: Record<string, number>, incoming: Record<string, number>) {
  const merged = { ...current };
  for (const [key, revision] of Object.entries(incoming)) merged[key] = Math.max(merged[key] ?? 0, revision);
  return merged;
}

export function validLastChallengeId(value: unknown, knownIds: ReadonlySet<string>) {
  return typeof value === "string" && knownIds.has(value) ? value : undefined;
}
