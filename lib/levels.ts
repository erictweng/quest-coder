/**
 * Character level, derived from XP for display only (the server stores XP, not levels).
 * Reaching level L takes 10·(L−1)·(L+4) XP: 60 for Lv 2, 140 for Lv 3, 240 for Lv 4.
 * Clearing the whole Forest of Patience (210 XP) lands a new player in Lv 3.
 */
export const LEVEL_TITLES = ["Squire", "Apprentice", "Journeyman", "Adept", "Knight", "Champion", "Hero", "Legend"] as const;

export function xpForLevel(level: number): number {
  if (!Number.isInteger(level) || level < 1) throw new RangeError("level must be an integer >= 1");
  return 10 * (level - 1) * (level + 4);
}

export type LevelInfo = { level: number; title: string; xpIntoLevel: number; xpForNext: number; totalXp: number };

export function levelFromXp(totalXp: number): LevelInfo {
  const xp = Number.isFinite(totalXp) && totalXp > 0 ? Math.floor(totalXp) : 0;
  let level = 1;
  while (xpForLevel(level + 1) <= xp) level += 1;
  const start = xpForLevel(level);
  return {
    level,
    title: LEVEL_TITLES[Math.min(level, LEVEL_TITLES.length) - 1],
    xpIntoLevel: xp - start,
    xpForNext: xpForLevel(level + 1) - start,
    totalXp: xp
  };
}
