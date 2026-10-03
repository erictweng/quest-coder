"use client";

import { useState } from "react";
import { FramedParchment, Panel, PixelButton, QuestStatus, StatBar, type QuestState } from "../../components/medieval/primitives";
import { PixelSprite, type SpriteName } from "../../components/medieval/sprites";
import { MEDIEVAL, SWATCHES } from "../../components/medieval/tokens";
import { contrastRatio, wcagLevel } from "../../lib/contrast";

const QUESTS: { title: string; brief: string; xp: number; state: QuestState }[] = [
  { title: "Quest 1: The last jump", brief: "Find how many routes reach the final ledge.", xp: 25, state: "cleared" },
  { title: "Quest 2: The route scroll", brief: "Write every ledge's route count onto one scroll.", xp: 30, state: "available" },
  { title: "Quest 3: Two-slot pouch", brief: "Carry only the last two counts as you climb.", xp: 30, state: "locked" }
];

const JOURNAL_TABS = ["Quest", "Path", "Hints", "Replay", "Solution", "Attempts"] as const;

function Section({ id, title, note, children }: { id: string; title: string; note?: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="space-y-4">
      <div className="flex flex-wrap items-baseline gap-3">
        <h2 id={id} className="mq-title">{title}</h2>
        {note ? <p className="m-0 text-[15px]" style={{ color: "var(--mq-textMuted)" }}>{note}</p> : null}
      </div>
      {children}
    </section>
  );
}

export function StyleTile() {
  const [tab, setTab] = useState<(typeof JOURNAL_TABS)[number]>("Quest");
  const [momentKey, setMomentKey] = useState(0);

  return (
    <main className="mx-auto max-w-6xl space-y-12 px-4 py-8 sm:px-8">
      {/* Header doubles as the HUD sample. */}
      <header className="mq-panel mq-panel--oak mq-notch flex flex-wrap items-center justify-between gap-4 !py-3">
        <div className="flex items-center gap-3">
          <PixelSprite name="castle" scale={3} />
          <div>
            <h1 className="text-3xl" style={{ color: "var(--mq-gold)", textShadow: "3px 3px 0 #000" }}>Quest Coder</h1>
            <p className="m-0 text-[15px]">Style tile: medieval pixel MMO, step 1 of the redesign</p>
          </div>
        </div>
        <nav aria-label="Style tile sections" className="flex flex-wrap gap-2 text-[15px]">
          {[["palette", "Palette"], ["type", "Type"], ["frames", "Frames"], ["hub", "Town hub"], ["solve", "Solve screen"], ["moments", "Moments"]].map(([id, label]) => (
            <a key={id} href={`#${id}`} className="mq-btn mq-btn--wood mq-notch !min-h-0 !px-3 !py-1">{label}</a>
          ))}
        </nav>
      </header>

      <Section id="palette" title="Palette" note="Dark stone and oak frame the UI; parchment is for reading. Ratios are computed live against WCAG.">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {SWATCHES.map(({ token, role, on }) => {
            const ratio = contrastRatio(MEDIEVAL[token], MEDIEVAL[on]);
            return (
              <div key={token} className="mq-panel mq-panel--stone mq-notch !p-3">
                <div className="mq-swatch mq-notch" style={{ background: MEDIEVAL[token], color: MEDIEVAL[on] }}>Aa</div>
                <p className="m-0 mt-2 text-[15px]">{token}</p>
                <p className="m-0 text-[13px]" style={{ color: "var(--mq-textMuted)" }}>{role}</p>
                <p className="m-0 text-[13px]" style={{ color: "var(--mq-textMuted)" }}>{MEDIEVAL[token]} · {ratio.toFixed(1)}:1 {wcagLevel(ratio)}</p>
              </div>
            );
          })}
        </div>
      </Section>

      <Section id="type" title="Type" note="One pixel font (Pixelify Sans) for all UI text. Code stays monospace.">
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel tone="stone">
            <p className="m-0 text-4xl" style={{ color: "var(--mq-gold)" }}>Old Bramblehorn</p>
            <p className="m-0 text-2xl">Forest of Patience</p>
            <p className="m-0 text-lg">Quest 2: The route scroll</p>
            <p className="m-0 text-[15px]" style={{ color: "var(--mq-textMuted)" }}>Labels, badges and numbers · 15px minimum</p>
          </Panel>
          <Panel tone="stone" title="Long text check">
            <p className="m-0 text-[13px]" style={{ color: "var(--mq-textMuted)" }}>Same paragraph in the pixel font and in a plain font, so we can decide for problem statements.</p>
            <FramedParchment className="mt-3">
              <p className="m-0">Given n stairs, count how many distinct ways you can reach the top when each move climbs either 1 stair or 2 stairs.</p>
            </FramedParchment>
            <FramedParchment className="mt-3">
              <p className="m-0" style={{ fontFamily: "system-ui, sans-serif", WebkitFontSmoothing: "auto" }}>Given n stairs, count how many distinct ways you can reach the top when each move climbs either 1 stair or 2 stairs.</p>
            </FramedParchment>
          </Panel>
        </div>
      </Section>

      <Section id="frames" title="Frames, buttons, bars" note="Hard 4px edges, notched corners, no blur. Buttons press 2px down-right.">
        <div className="grid gap-4 md:grid-cols-3">
          <Panel tone="stone" title="Stone panel"><p className="m-0 text-[15px]">Menus, HUD, character sheet.</p></Panel>
          <Panel tone="oak" title="Oak panel"><p className="m-0 text-[15px]">Headers, quest board, tabs.</p></Panel>
          <Panel tone="parchment" title="Parchment"><p className="m-0 text-[15px]">Problem text, notices, journal pages.</p></Panel>
        </div>
        <Panel tone="stone">
          <div className="flex flex-wrap items-center gap-3">
            <PixelButton variant="primary" icon="banner">Submit</PixelButton>
            <PixelButton variant="secondary" icon="sword">Run</PixelButton>
            <PixelButton variant="wood">Return to town</PixelButton>
            <PixelButton variant="secondary" disabled>Locked</PixelButton>
            <a className="mq-btn mq-btn--google mq-notch" href="#frames" onClick={(event) => event.preventDefault()}>
              <svg aria-hidden="true" width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.9 6.1C12.5 13.6 17.8 9.5 24 9.5z" /><path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.4-4.7 7l7.6 5.9c4.4-4.1 6.8-10.1 6.8-17.4z" /><path fill="#FBBC05" d="M10.6 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.1C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7l7.9-6.1z" /><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.9 2.3-8.3 2.3-6.2 0-11.5-4.1-13.4-9.9l-7.9 6.1C6.6 42.6 14.6 48 24 48z" /></svg>
              Sign in with Google
            </a>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <StatBar label="Experience" value={340} max={500} unit="XP" color={MEDIEVAL.gold} />
            <StatBar label="Forest of Patience" value={1} max={4} unit="quests" color={MEDIEVAL.emerald} />
          </div>
          <div className="mt-5 flex flex-wrap items-end gap-6">
            {(Object.keys({ knight: 1, castle: 1, tree: 1, coin: 1, gem: 1, scroll: 1, lock: 1, sword: 1, banner: 1, check: 1, cross: 1 }) as SpriteName[]).map((name) => (
              <figure key={name} className="m-0 flex flex-col items-center gap-1">
                <PixelSprite name={name} scale={4} />
                <figcaption className="text-[13px]" style={{ color: "var(--mq-textMuted)" }}>{name}</figcaption>
              </figure>
            ))}
          </div>
        </Panel>
      </Section>

      <Section id="hub" title="Town hub" note="Character sheet, world map and quest board: Profile, Campaign and Questions in MMO form.">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
          <Panel tone="stone" as="article" labelledBy="sheet-name" className="self-start">
            <div className="flex items-center gap-4">
              <div className="mq-panel mq-panel--oak mq-notch !p-2"><PixelSprite name="knight" scale={5} className="mq-idle" /></div>
              <div>
                <h3 id="sheet-name" className="text-xl">RiceBoy</h3>
                <p className="m-0 text-[15px]" style={{ color: "var(--mq-gold)" }}>Level 4 · Apprentice coder</p>
              </div>
            </div>
            <div className="mt-4 space-y-3">
              <StatBar label="Experience" value={340} max={500} unit="XP" color={MEDIEVAL.gold} />
              <dl className="m-0 grid grid-cols-2 gap-2 text-[15px]">
                <div className="mq-panel mq-panel--raised mq-notch !p-2"><dt style={{ color: "var(--mq-textMuted)" }}>Shards</dt><dd className="m-0 flex items-center gap-2"><PixelSprite name="coin" scale={2} />1</dd></div>
                <div className="mq-panel mq-panel--raised mq-notch !p-2"><dt style={{ color: "var(--mq-textMuted)" }}>Quests cleared</dt><dd className="m-0 flex items-center gap-2"><PixelSprite name="gem" scale={2} />1 / 4</dd></div>
              </dl>
            </div>
          </Panel>

          <div className="space-y-4">
            <div className="mq-panel mq-panel--oak mq-frame mq-notch">
              <div className="mq-map mq-notch" role="img" aria-label="World map: Forest of Patience is open, its boss gate is ahead, and further regions are hidden in fog.">
                <svg className="mq-map__path" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                  <polyline className="mq-map__route mq-map__route--wide" points="12,70 34,40 55,64 66,35" fill="none" stroke={MEDIEVAL.inkMuted} strokeWidth="1.2" strokeDasharray="2 2" vectorEffect="non-scaling-stroke" />
                  <polyline className="mq-map__route mq-map__route--narrow" points="14,80 30,30 50,70 70,40" fill="none" stroke={MEDIEVAL.inkMuted} strokeWidth="1.2" strokeDasharray="2 2" vectorEffect="non-scaling-stroke" />
                </svg>
                <div className="mq-map__node mq-map__node--you"><PixelSprite name="knight" scale={3} /><span className="mq-map__label">You</span></div>
                <div className="mq-map__node mq-map__node--forest"><PixelSprite name="tree" scale={4} /><span className="mq-map__label">Forest of Patience</span></div>
                <div className="mq-map__node mq-map__node--gate"><PixelSprite name="castle" scale={3} /><span className="mq-map__label">Bramblehorn&apos;s gate</span></div>
                <div className="mq-fog" aria-hidden="true"><span>Unexplored<br />Coming soon</span></div>
              </div>
            </div>
            <div className="mq-board mq-notch">
              <h3 className="mb-3 text-lg">Quest board</h3>
              <ul className="m-0 grid list-none gap-4 p-0 md:grid-cols-3">
                {QUESTS.map((quest) => (
                  <li key={quest.title} className={`mq-notice mq-notch ${quest.state === "locked" ? "mq-notice--locked" : ""}`}>
                    <QuestStatus state={quest.state} />
                    <h4 className="m-0 mt-1 text-[17px] font-bold">{quest.title}</h4>
                    <p className="m-0 mt-1 text-[15px]" style={{ color: "var(--mq-inkMuted)" }}>{quest.brief}</p>
                    <p className="m-0 mt-2 flex items-center gap-2 text-[15px] font-bold"><PixelSprite name="gem" scale={2} />{quest.xp} XP</p>
                  </li>
                ))}
              </ul>
            </div>
            <article className="mq-panel mq-panel--stone mq-notch flex flex-wrap items-center gap-4" style={{ borderColor: "#5A1A20" }} aria-labelledby="boss-name">
              <PixelSprite name="castle" scale={6} />
              <div className="min-w-0 flex-1">
                <p className="m-0 text-[15px]" style={{ color: "var(--mq-ruby)" }}>Boss encounter</p>
                <h3 id="boss-name" className="text-2xl">Old Bramblehorn</h3>
                <p className="m-0 text-[15px]" style={{ color: "var(--mq-textMuted)" }}>Guards the summit gate. Clear all three quests to challenge him.</p>
                <p className="m-0 mt-1 flex flex-wrap items-center gap-3 text-[15px]"><span className="flex items-center gap-1"><PixelSprite name="gem" scale={2} />125 XP</span><span className="flex items-center gap-1"><PixelSprite name="coin" scale={2} />1 shard</span></p>
              </div>
              <QuestStatus state="locked" tone="stone" />
            </article>
          </div>
        </div>
      </Section>

      <Section id="solve" title="Solve screen" note="The editor stays plain and readable. The game frame lives around it, never behind the code.">
        <div className="mq-panel mq-panel--stone mq-notch !p-0">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b-4 px-4 py-2" style={{ borderColor: "var(--mq-stoneEdge)", background: "var(--mq-oak)" }}>
            <div className="flex items-center gap-3">
              <PixelButton variant="wood">← Town</PixelButton>
              <span className="text-[15px]">Boss: Old Bramblehorn</span>
            </div>
            <div className="flex min-w-[220px] items-center gap-3">
              <PixelSprite name="knight" scale={2} />
              <span className="text-[15px]">Lv 4</span>
              <div className="flex-1"><StatBar label="XP" value={340} max={500} color={MEDIEVAL.gold} /></div>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-0 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="min-w-0 p-4">
              <pre className="mq-editor mq-code" tabIndex={0} aria-label="Code editor preview"><code><span className="kw">class</span> <span className="fn">Solution</span>:{"\n"}    <span className="kw">def</span> <span className="fn">climbStairs</span>(self, n: int) -&gt; int:{"\n"}        <span className="cm"># two-slot pouch: routes to the last two ledges</span>{"\n"}        a, b = <span className="num">1</span>, <span className="num">1</span>{"\n"}        <span className="kw">for</span> _ <span className="kw">in</span> range(<span className="num">2</span>, n + <span className="num">1</span>):{"\n"}            a, b = b, a + b{"\n"}        <span className="kw">return</span> b</code></pre>
              <div className="mt-4 flex flex-wrap gap-3" role="group" aria-label="Actions">
                <PixelButton variant="secondary" icon="sword">Run</PixelButton>
                <PixelButton variant="primary" icon="banner">Submit</PixelButton>
              </div>
              <h3 className="mt-5 mb-2 text-lg">Combat log</h3>
              <ol className="mq-log m-0 list-none mq-code">
                <li><PixelSprite name="check" scale={2} title="Passed" /><span>Case 1 passed · n = 2 → 2</span></li>
                <li><PixelSprite name="check" scale={2} title="Passed" /><span>Case 2 passed · n = 5 → 8</span></li>
                <li><PixelSprite name="cross" scale={2} title="Failed" /><span style={{ color: "var(--mq-ruby)" }}>Case 3 failed · n = 1: expected 1, got 0</span></li>
              </ol>
            </div>
            <aside className="mq-panel mq-panel--oak mq-notch m-4 !p-3" aria-label="Quest journal">
              <div className="mq-tabs" role="tablist" aria-label="Journal sections">
                {JOURNAL_TABS.map((name) => (
                  <button key={name} type="button" role="tab" id={`tab-${name}`} aria-selected={tab === name} aria-controls="journal-page" className="mq-tab mq-notch" onClick={() => setTab(name)}>{name}</button>
                ))}
              </div>
              <div id="journal-page" role="tabpanel" aria-labelledby={`tab-${tab}`} className="mq-panel mq-panel--parchment !mt-0">
                {tab === "Quest" ? (
                  <>
                    <p className="m-0 text-[15px]" style={{ color: "var(--mq-inkRuby)" }}>Old Bramblehorn guards the summit gate.</p>
                    <p className="m-0 mt-2">Count every legal route up <code>n</code> stairs, climbing 1 or 2 at a time.</p>
                  </>
                ) : <p className="m-0">The {tab.toLowerCase()} page opens here.</p>}
              </div>
            </aside>
          </div>
        </div>
      </Section>

      <Section id="moments" title="Moments" note="Short, stepped animations. Turned off when your device asks for reduced motion.">
        <div key={momentKey} className="mq-animate grid gap-4 md:grid-cols-2" aria-live="polite">
          <div className="mq-toast mq-notch">
            <PixelSprite name="coin" scale={4} />
            <div>
              <p className="m-0 text-lg" style={{ color: "var(--mq-gold)" }}>Quest complete!</p>
              <p className="m-0 text-[15px]">+30 XP · The route scroll</p>
            </div>
          </div>
          <div className="mq-levelup mq-notch">Level up! · Level 5</div>
        </div>
        <PixelButton variant="wood" onClick={() => setMomentKey((key) => key + 1)}>Replay moments</PixelButton>
      </Section>

      <footer className="pb-6 text-[13px]" style={{ color: "var(--mq-textMuted)" }}>
        Sample data only (the level system does not exist yet). All art is drawn in code (components/medieval/sprites.tsx) and can be swapped for drawn sprites later. Not shown on production.
      </footer>
    </main>
  );
}
