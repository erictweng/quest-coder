import { levelFromXp } from "../../lib/levels";
import { StatBar } from "../medieval/primitives";
import { PixelSprite } from "../medieval/sprites";
import { MEDIEVAL } from "../medieval/tokens";
import type { HubCharacter } from "./types";

export function CharacterSheet({ character, onOpenProfile }: { character: HubCharacter; onOpenProfile: () => void }) {
  const level = levelFromXp(character.xp);
  return (
    <article className="mq-panel mq-panel--stone mq-notch" aria-labelledby="character-name" data-testid="character-sheet">
      <p className="m-0 text-xs uppercase tracking-[0.25em] text-[var(--mq-gold)]">Character sheet</p>
      <div className="mt-3 flex items-center gap-4">
        <div className="mq-panel mq-panel--oak mq-notch !p-2"><PixelSprite name="knight" scale={5} className="mq-idle" /></div>
        <div className="min-w-0">
          <h2 id="character-name" className="truncate text-xl font-bold">{character.name ?? "Wandering guest"}</h2>
          <p className="m-0 text-sm text-[var(--mq-gold)]">Level {level.level} · {level.title}</p>
        </div>
      </div>
      <div className="mt-4">
        <StatBar label={`XP to level ${level.level + 1}`} value={level.xpIntoLevel} max={level.xpForNext} unit="XP" color={MEDIEVAL.gold} />
        <p className="m-0 mt-1 text-xs text-[var(--mq-textMuted)]">{character.xp} XP total</p>
      </div>
      <dl className="m-0 mt-4 grid grid-cols-2 gap-2 text-sm">
        <Stat label="Shards" icon="coin" value={String(character.shards)} />
        <Stat label="Quests cleared" icon="gem" value={`${character.questsCleared} / ${character.questsTotal}`} />
        <Stat label="Bosses" icon="castle" value={character.bossesLabel} />
        <Stat label="Rematches due" icon="banner" value={String(character.rematchesDue)} />
      </dl>
      <button type="button" className="control mt-4 w-full text-sm" onClick={onOpenProfile}>Open full character sheet</button>
    </article>
  );
}

function Stat({ label, icon, value }: { label: string; icon: "coin" | "gem" | "castle" | "banner"; value: string }) {
  return (
    <div className="mq-panel mq-panel--raised mq-panel--stone mq-notch !p-2">
      <dt className="text-xs text-[var(--mq-textMuted)]">{label}</dt>
      <dd className="m-0 flex items-center gap-2"><PixelSprite name={icon} scale={2} />{value}</dd>
    </div>
  );
}
