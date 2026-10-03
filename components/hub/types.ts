import type { QuestState } from "../medieval/primitives";

/** View models the page computes from progress; hub components only render them. */
export type HubQuest = {
  id: string;
  title: string;
  brief: string;
  xp: number;
  shards: number;
  isBoss: boolean;
  state: QuestState;
  lockedReason?: string;
};

export type HubRegion = {
  slug: string;
  title: string;
  cleared: number;
  total: number;
  boss: HubQuest;
};

export type HubCharacter = {
  name: string | null;
  xp: number;
  shards: number;
  questsCleared: number;
  questsTotal: number;
  bossesLabel: string; // e.g. "1/1 bosses defeated"
  rematchesDue: number;
};
