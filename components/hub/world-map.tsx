import { PixelSprite } from "../medieval/sprites";
import type { HubRegion } from "./types";

/** Map slots for the first regions; with more regions than slots, the rest appear in a list. */
const SLOTS = [
  { region: { left: "28%", top: "38%" }, gate: { left: "52%", top: "66%" }, route: "10,78 28,38 52,66" },
  { region: { left: "68%", top: "30%" }, gate: { left: "84%", top: "62%" }, route: "52,66 68,30 84,62" }
];

export function WorldMap({ regions, onOpenRegion, onOpenBoss }: { regions: HubRegion[]; onOpenRegion: (slug: string) => void; onOpenBoss: (id: string) => void }) {
  const placed = regions.slice(0, SLOTS.length);
  const overflow = regions.slice(SLOTS.length);
  const fogged = placed.length < SLOTS.length;
  return (
    <section className="mq-panel mq-panel--oak mq-frame mq-notch" aria-labelledby="world-map-title">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2 px-1">
        <h2 id="world-map-title" className="text-lg font-bold">World map</h2>
        <p className="m-0 text-xs text-[var(--mq-textMuted)]">Choose a region or face its boss.</p>
      </div>
      <div className="mq-map mq-world-map mq-notch">
        <svg className="mq-map__path" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <polyline points={placed.map((_, index) => SLOTS[index].route).join(" ")} fill="none" stroke="var(--mq-inkMuted)" strokeWidth="1.2" strokeDasharray="2 2" vectorEffect="non-scaling-stroke" />
        </svg>
        <div className="mq-map__node" style={{ left: "10%", top: "78%" }} aria-hidden="true"><PixelSprite name="knight" scale={3} /><span className="mq-map__label">You</span></div>
        {placed.map((region, index) => {
          const slot = SLOTS[index];
          const bossLocked = region.boss.state === "locked";
          return (
            <div key={region.slug}>
              <button type="button" className="mq-map__node mq-map__button" style={slot.region} onClick={() => onOpenRegion(region.slug)}>
                <PixelSprite name="tree" scale={4} />
                <span className="mq-map__label">{region.title}<span className="block text-xs font-normal">{region.cleared}/{region.total} cleared</span></span>
              </button>
              <button
                type="button"
                className="mq-map__node mq-map__button"
                style={slot.gate}
                onClick={() => onOpenBoss(region.boss.id)}
                disabled={bossLocked}
                title={bossLocked ? region.boss.lockedReason : undefined}
                aria-label={`${region.boss.title}: ${bossLocked ? "boss gate locked" : region.boss.state === "cleared" ? "boss defeated" : "boss gate open"}`}
              >
                <PixelSprite name={bossLocked ? "lock" : "castle"} scale={3} />
                <span className="mq-map__label" aria-hidden="true">{bossLocked ? "Gate locked" : region.boss.state === "cleared" ? "Boss defeated" : "Gate open"}</span>
              </button>
            </div>
          );
        })}
        {fogged ? <div className="mq-fog" aria-hidden="true"><span>Unexplored<br />More regions coming</span></div> : null}
      </div>
      {overflow.length ? (
        <ul className="m-0 mt-3 flex list-none flex-wrap gap-2 p-0">
          {overflow.map((region) => <li key={region.slug}><button type="button" className="control text-sm" onClick={() => onOpenRegion(region.slug)}>{region.title} · {region.cleared}/{region.total}</button></li>)}
        </ul>
      ) : null}
    </section>
  );
}
