import { QuestStatus } from "../medieval/primitives";
import { PixelSprite } from "../medieval/sprites";
import type { HubQuest } from "./types";

/** Parchment notices for a region's quests, plus the boss encounter card. */
export function QuestBoard({ regionTitle, quests, boss, onOpen }: { regionTitle: string; quests: HubQuest[]; boss: HubQuest; onOpen: (id: string) => void }) {
  return (
    <section className="mq-board mq-notch" aria-labelledby="quest-board-title">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="quest-board-title" className="text-lg font-bold">Quest board</h2>
        <p className="m-0 text-xs">{regionTitle}</p>
      </div>
      <ul className="m-0 grid list-none gap-4 p-0 md:grid-cols-3">
        {quests.map((quest) => (
          <li key={quest.id}>
            <button
              type="button"
              className={`mq-notice mq-notice-button mq-notch ${quest.state === "locked" ? "mq-notice--locked" : ""}`}
              onClick={() => onOpen(quest.id)}
              disabled={quest.state === "locked"}
              title={quest.state === "locked" ? quest.lockedReason : undefined}
            >
              <QuestStatus state={quest.state} />
              <span className="mt-1 block text-[17px] font-bold">{quest.title}</span>
              <span className="mt-1 block text-sm text-[var(--mq-inkMuted)]">{quest.brief}</span>
              <span className="mt-2 flex items-center gap-2 text-sm font-bold"><PixelSprite name="gem" scale={2} />{quest.xp} XP</span>
              {quest.state === "locked" && quest.lockedReason ? <span className="mt-1 block text-xs text-[var(--mq-inkMuted)]">{quest.lockedReason}.</span> : null}
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="mq-boss-card mq-panel mq-panel--stone mq-notch mt-4 flex w-full flex-wrap items-center gap-4 text-left"
        onClick={() => onOpen(boss.id)}
        disabled={boss.state === "locked"}
        title={boss.state === "locked" ? boss.lockedReason : undefined}
      >
        <PixelSprite name="castle" scale={5} />
        <span className="min-w-0 flex-1">
          <span className="block text-xs uppercase tracking-[0.25em] text-[var(--mq-ruby)]">Boss encounter</span>
          <span className="block text-2xl font-bold">{boss.title}</span>
          <span className="block text-sm text-[var(--mq-textMuted)]">{boss.brief}</span>
          <span className="mt-1 flex flex-wrap items-center gap-3 text-sm">
            <span className="flex items-center gap-1"><PixelSprite name="gem" scale={2} />{boss.xp} XP</span>
            {boss.shards ? <span className="flex items-center gap-1"><PixelSprite name="coin" scale={2} />{boss.shards} {boss.shards === 1 ? "shard" : "shards"}</span> : null}
          </span>
          {boss.state === "locked" && boss.lockedReason ? <span className="mt-1 block text-xs text-[var(--mq-textMuted)]">{boss.lockedReason}.</span> : null}
        </span>
        <QuestStatus state={boss.state} tone="stone" />
      </button>
    </section>
  );
}
