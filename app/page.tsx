"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import samplePack from "../content/packs/timequake-search-rotated-array.json";

type Status =
  | "passed"
  | "wrong_answer"
  | "compile_error"
  | "runtime_error"
  | "over_budget"
  | "loop_guard"
  | "off_end_read"
  | "internal_error";

type TimelineEvent = {
  i: number;
  t?: number;
  kind: "line" | "read" | "write" | "compare" | "call" | "return" | "outcome" | "note";
  line?: number;
  vars?: Record<string, unknown>;
  ref?: { structure: "array"; name: string; index: number };
  value?: unknown;
  readCount?: number;
  status?: Status;
  expected?: unknown;
  actual?: unknown;
  message?: string;
  offEnd?: boolean;
};

type ReplayCase = {
  caseId: string;
  status: Status;
  passed: boolean;
  expected?: unknown;
  actual?: unknown;
  error?: { kind: Status; message: string; line?: number } | null;
  budget: { enabled: boolean; limit?: number; used: number; unit: string; exceeded: boolean };
  summary: { durationMs: number; eventCount: number; truncated: boolean; memoryKb?: number };
  input: { structure: "array"; values: number[]; target: number; expectedIndex: number };
  events: TimelineEvent[];
};

type RunResult = {
  schemaVersion: "timeline.v0";
  questId: string;
  language: "python";
  status: Status;
  passed: boolean;
  startedAt: string;
  execution: { passes: string[]; replayCaseIndex: number };
  cases: ReplayCase[];
  replay: ReplayCase | null;
  limits: { maxEvents: number; maxDurationMs: number; maxReads?: number };
};

type Challenge = typeof samplePack.quests[number] | typeof samplePack.boss;
type Attempt = { id: string; at: string; challengeId: string; status: Status; passed: boolean; replayCaseId?: string; eventCount: number; timelinePointer: string; solutionAssisted: boolean };
type ProgressState = { cleared: Record<string, boolean>; solutionOpened: Record<string, boolean>; attempts: Record<string, Attempt[]>; savedCode: Record<string, string> };

const PACK_SLUG = samplePack.slug;
const CHALLENGES: Challenge[] = [...samplePack.quests, samplePack.boss];
const STARTER_CODE = samplePack.boss.starterCode;
const PASSING_CODE = samplePack.boss.solution.code;
const TABS = "    ";
const PLAY_SPEEDS = [0.5, 1, 2, 4];
const EMPTY_PROGRESS: ProgressState = { cleared: {}, solutionOpened: {}, attempts: {}, savedCode: {} };

const OUTCOME_COPY: Record<Status, { title: string; visual: string; tone: string }> = {
  passed: { title: "passed:", visual: "gold relic glow", tone: "text-emerald-200 bg-emerald-500/15 border-emerald-300/40" },
  wrong_answer: { title: "wrong_answer:", visual: "red wrong room, green expected", tone: "text-rose-200 bg-rose-500/15 border-rose-300/40" },
  compile_error: { title: "compile_error:", visual: "broken spell scroll", tone: "text-amber-200 bg-amber-500/15 border-amber-300/40" },
  runtime_error: { title: "runtime_error:", visual: "spark burst", tone: "text-orange-200 bg-orange-500/15 border-orange-300/40" },
  over_budget: { title: "over_budget:", visual: "empty chrono meter", tone: "text-fuchsia-200 bg-fuchsia-500/15 border-fuchsia-300/40" },
  loop_guard: { title: "loop_guard:", visual: "spinning pathfinder", tone: "text-sky-200 bg-sky-500/15 border-sky-300/40" },
  off_end_read: { title: "off_end_read:", visual: "ghost room fall", tone: "text-violet-200 bg-violet-500/15 border-violet-300/40" },
  internal_error: { title: "internal_error:", visual: "theater lights out", tone: "text-slate-200 bg-slate-500/15 border-slate-300/40" }
};

export default function Home() {
  const pack = samplePack;
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [userNameDraft, setUserNameDraft] = useState("Eric");
  const [userName, setUserName] = useState<string | null>(null);
  const [progress, setProgress] = useState<ProgressState>(EMPTY_PROGRESS);
  const [activeId, setActiveId] = useState(samplePack.quests[0]?.id ?? samplePack.boss.id);
  const activeChallenge = useMemo(() => CHALLENGES.find((challenge) => challenge.id === activeId) ?? samplePack.boss, [activeId]);
  const [code, setCode] = useState(activeChallenge.starterCode);
  const [result, setResult] = useState<RunResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [cursor, setCursor] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);

  const storageKey = userName ? `quest-coder:profile:${userName}` : null;
  const replay = result?.replay ?? null;
  const events = replay?.events ?? [];
  const activeEvent = events[Math.min(cursor, Math.max(events.length - 1, 0))];
  const activeLine = activeEvent?.line;
  const activeReadIndex = activeEvent?.kind === "read" ? activeEvent.ref?.index : undefined;
  const latestVars = useMemo(() => collectVars(events, cursor), [events, cursor]);
  const sceneMode = (replay?.input.values.length ?? 0) > 24 ? "skyline" : "doors";
  const activeAttempts = progress.attempts[activeChallenge.id] ?? [];
  const bossUnlocked = samplePack.boss.unlock.requiresQuestIds.every((id) => progress.cleared[id]);
  const isActiveLocked = !isUnlocked(activeChallenge, progress);

  useEffect(() => {
    const savedUser = safeLocalStorageGet("quest-coder:session");
    if (savedUser) {
      setUserName(savedUser);
      setUserNameDraft(savedUser);
    }
  }, []);

  useEffect(() => {
    if (!storageKey) return;
    setProgress(readProgress(storageKey));
  }, [storageKey]);

  useEffect(() => {
    if (!storageKey) return;
    writeProgress(storageKey, progress);
  }, [progress, storageKey]);

  useEffect(() => {
    const saved = progress.savedCode[activeChallenge.id];
    setCode(saved ?? activeChallenge.starterCode);
    setResult(null);
    setCursor(0);
    setPlaying(false);
  }, [activeChallenge, progress.savedCode]);

  useEffect(() => {
    if (!storageKey) return;
    setProgress((current) => ({ ...current, savedCode: { ...current.savedCode, [activeChallenge.id]: code } }));
  }, [activeChallenge.id, code, storageKey]);

  const submit = useCallback(async () => {
    if (isActiveLocked) {
      setRunError("This challenge is locked. Clear the prerequisite quests first.");
      return;
    }
    setIsRunning(true);
    setRunError(null);
    setPlaying(false);
    try {
      const response = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: code, packSlug: PACK_SLUG, challengeId: activeChallenge.id })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Runner request failed");
      const runResult = payload as RunResult;
      setResult(runResult);
      setCursor(0);
      recordAttempt(runResult);
    } catch (error) {
      setRunError(error instanceof Error ? error.message : "Unknown run error");
    } finally {
      setIsRunning(false);
    }
  }, [activeChallenge.id, code, isActiveLocked]);

  useEffect(() => {
    if (!playing || events.length === 0) return;
    const id = window.setInterval(() => {
      setCursor((current) => {
        if (current >= events.length - 1) {
          setPlaying(false);
          return current;
        }
        return current + 1;
      });
    }, 450 / speed);
    return () => window.clearInterval(id);
  }, [events.length, playing, speed]);

  function signIn() {
    const normalized = userNameDraft.trim() || "Eric";
    safeLocalStorageSet("quest-coder:session", normalized);
    setUserName(normalized);
  }

  function signOut() {
    safeLocalStorageRemove("quest-coder:session");
    setUserName(null);
    setProgress(EMPTY_PROGRESS);
    setResult(null);
  }

  function recordAttempt(runResult: RunResult) {
    const attempt: Attempt = {
      id: `${activeChallenge.id}-${Date.now()}`,
      at: new Date().toISOString(),
      challengeId: activeChallenge.id,
      status: runResult.status,
      passed: runResult.passed,
      replayCaseId: runResult.replay?.caseId,
      eventCount: runResult.replay?.summary.eventCount ?? 0,
      timelinePointer: `${activeChallenge.id}:${runResult.replay?.caseId ?? "none"}:${runResult.startedAt}`,
      solutionAssisted: Boolean(progress.solutionOpened[activeChallenge.id])
    };
    setProgress((current) => ({
      ...current,
      cleared: { ...current.cleared, [activeChallenge.id]: current.cleared[activeChallenge.id] || runResult.passed },
      attempts: { ...current.attempts, [activeChallenge.id]: [attempt, ...(current.attempts[activeChallenge.id] ?? [])].slice(0, 15) }
    }));
  }

  function openSolution() {
    setProgress((current) => ({ ...current, solutionOpened: { ...current.solutionOpened, [activeChallenge.id]: true } }));
  }

  function handleEditorKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      void submit();
      return;
    }
    if (event.key === "Tab") {
      event.preventDefault();
      const target = event.currentTarget;
      const { selectionStart, selectionEnd } = target;
      if (event.shiftKey) outdentSelection(code, selectionStart, selectionEnd, setCode, textareaRef);
      else insertAtSelection(code, selectionStart, selectionEnd, TABS, setCode, textareaRef);
      return;
    }
    if (event.key === "Enter") {
      const target = event.currentTarget;
      const lineStart = code.lastIndexOf("\n", target.selectionStart - 1) + 1;
      const line = code.slice(lineStart, target.selectionStart);
      const indent = line.match(/^\s*/)?.[0] ?? "";
      const extra = line.trimEnd().endsWith(":") ? TABS : "";
      event.preventDefault();
      insertAtSelection(code, target.selectionStart, target.selectionEnd, `\n${indent}${extra}`, setCode, textareaRef);
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#123456_0,#020617_48%,#01030a_100%)] text-slate-100">
      <section className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 lg:px-8">
        <header className="rounded-3xl border border-cyan-300/25 bg-slate-950/70 p-6 shadow-2xl shadow-cyan-950/30">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-cyan-300">Quest Coder · Sprint 4 Personal MVP App Loop</p><span className="sr-only">Quest Coder · Sprint 2 Replay Theater</span>
              <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-5xl">{pack.title}</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300 sm:text-base">{pack.metadata.shortDescription} Sign in, clear quests, unlock the boss, save attempts, and keep progress across logout/login.</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
              {userName ? (
                <div className="flex flex-wrap items-center gap-3"><span className="text-sm text-slate-300">Signed in as <b className="text-cyan-200">{userName}</b></span><button className="control" onClick={signOut}>Log out</button></div>
              ) : (
                <div className="flex flex-wrap items-center gap-2"><input className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm" value={userNameDraft} onChange={(event) => setUserNameDraft(event.target.value)} aria-label="User name" /><button className="rounded-xl bg-cyan-300 px-4 py-2 text-sm font-bold text-slate-950" onClick={signIn}>Sign in</button></div>
              )}
            </div>
          </div>
          <div className="mt-4 grid gap-2 text-sm sm:grid-cols-4">
            <Metric label="Replay case" value={replay?.caseId ?? "none"} />
            <Metric label="Events" value={`${events.length}/${result?.limits.maxEvents ?? 3000}`} />
            <Metric label="Mode" value={sceneMode} />
            <Metric label="Boss" value={bossUnlocked ? "unlocked" : "locked"} />
          </div>
        </header>

        <div className="grid gap-6 xl:grid-cols-[18rem_minmax(420px,0.85fr)_minmax(520px,1.15fr)]">
          <LibraryPanel progress={progress} activeId={activeChallenge.id} onSelect={setActiveId} />

          <section className="rounded-3xl border border-white/10 bg-slate-950/80 p-4 shadow-xl">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold">Question + code editor</h2>
                <p className="text-sm text-slate-400">Line numbers, Tab/Shift+Tab, auto-indent, and Ctrl/Cmd+Enter are wired. Ligatures are disabled.</p>
                <p className="mt-1 text-xs text-slate-500">{activeChallenge.title} · {isActiveLocked ? "locked" : "available"}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button className="rounded-xl border border-white/10 px-3 py-2 text-sm hover:bg-white/10" onClick={() => setCode(activeChallenge.solution.code)}>Load passing</button>
                <button className="rounded-xl border border-white/10 px-3 py-2 text-sm hover:bg-white/10" onClick={() => setCode(activeChallenge.starterCode)}>Reset</button>
                <button className="rounded-xl border border-amber-300/40 px-3 py-2 text-sm text-amber-100 hover:bg-amber-300/10" onClick={openSolution}>Open solution scroll</button>
                <button className="rounded-xl bg-cyan-300 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-cyan-200 disabled:opacity-60" disabled={isRunning || isActiveLocked || !userName} onClick={() => void submit()}>{isRunning ? "Running…" : "Run ▶"}</button>
              </div>
            </div>
            <p className="mb-3 rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-slate-300">{activeChallenge.brief}</p>
            <div className="rounded-2xl border border-slate-700 bg-slate-900/80 p-3">
              <div className="grid grid-cols-[3rem_1fr] gap-3">
                <pre aria-hidden="true" className="select-none text-right font-mono text-sm leading-6 text-slate-500">{lineNumbers(code)}</pre>
                <textarea ref={textareaRef} aria-label="Python solution editor" className="min-h-[30rem] resize-y bg-transparent font-mono text-sm leading-6 text-slate-100 outline-none [font-feature-settings:'liga'_0,'calt'_0]" spellCheck={false} value={code} onChange={(event) => setCode(event.target.value)} onKeyDown={handleEditorKeyDown} />
              </div>
            </div>
            <details className="mt-3 rounded-2xl border border-amber-300/20 bg-amber-300/5 p-3" open={Boolean(progress.solutionOpened[activeChallenge.id])}>
              <summary className="cursor-pointer text-sm font-bold text-amber-100">Solution scroll {progress.solutionOpened[activeChallenge.id] ? "opened — solution-assisted" : "hidden"}</summary>
              {progress.solutionOpened[activeChallenge.id] ? <pre className="mt-3 overflow-auto whitespace-pre-wrap text-xs text-amber-50">{activeChallenge.solution.code}</pre> : <p className="mt-2 text-sm text-slate-400">Click “Open solution scroll” to reveal and record solution use.</p>}
            </details>
            {runError ? <p className="mt-3 rounded-xl border border-red-300/40 bg-red-500/10 p-3 text-sm text-red-200">{runError}</p> : null}
          </section>

          <section className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-slate-950/80 p-4 shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <OutcomeBadge status={result?.status ?? "internal_error"} passed={result?.passed ?? false} />
              <PlaybackControls cursor={cursor} total={events.length} playing={playing} speed={speed} onBack={() => setCursor((value) => Math.max(0, value - 1))} onStep={() => setCursor((value) => Math.min(events.length - 1, value + 1))} onSkipStart={() => setCursor(0)} onSkipEnd={() => setCursor(Math.max(events.length - 1, 0))} onToggle={() => setPlaying((value) => !value)} onSpeed={() => setSpeed((value) => PLAY_SPEEDS[(PLAY_SPEEDS.indexOf(value) + 1) % PLAY_SPEEDS.length])} />
            </div>

            <ArrayScene replay={replay} activeReadIndex={activeReadIndex} vars={latestVars} mode={sceneMode} />

            <div className="grid gap-4 lg:grid-cols-2">
              <CodeTrace code={code} activeLine={activeLine} />
              <div className="space-y-4"><VarsPanel vars={latestVars} event={activeEvent} /><CasesPanel result={result} /><AttemptHistory attempts={activeAttempts} /></div>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}

function LibraryPanel({ progress, activeId, onSelect }: { progress: ProgressState; activeId: string; onSelect: (id: string) => void }) {
  return <aside className="rounded-3xl border border-white/10 bg-slate-950/80 p-4"><h2 className="text-xl font-bold">Library by category</h2><p className="mt-1 text-sm text-slate-400">Binary search · Timequake pack</p><div className="mt-4 space-y-2">{CHALLENGES.map((challenge) => { const locked = !isUnlocked(challenge, progress); const cleared = Boolean(progress.cleared[challenge.id]); return <button key={challenge.id} className={`w-full rounded-2xl border p-3 text-left text-sm ${activeId === challenge.id ? "border-cyan-300 bg-cyan-300/10" : "border-white/10 bg-white/5"}`} onClick={() => onSelect(challenge.id)}><span className="font-bold">{challenge.id === samplePack.boss.id ? "Boss" : `Quest ${"order" in challenge ? challenge.order : ""}`}: {challenge.title}</span><span className="mt-1 block text-xs text-slate-400">{cleared ? "cleared" : locked ? "locked" : "unlocked"} · {(progress.attempts[challenge.id] ?? []).length} attempts</span></button>; })}</div></aside>;
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-2xl border border-white/10 bg-white/5 p-3"><p className="text-[0.65rem] uppercase tracking-[0.2em] text-slate-500">{label}</p><p className="mt-1 truncate font-bold text-cyan-100">{value}</p></div>; }
function OutcomeBadge({ status, passed }: { status: Status; passed: boolean }) { const copy = OUTCOME_COPY[status]; return <div className={`rounded-2xl border px-4 py-3 ${copy.tone}`}><p className="text-sm font-bold">{passed ? "Victory replay ready" : copy.title}</p><p className="text-xs opacity-80">Visual: {copy.visual}</p></div>; }
function PlaybackControls(props: { cursor: number; total: number; playing: boolean; speed: number; onBack: () => void; onStep: () => void; onSkipStart: () => void; onSkipEnd: () => void; onToggle: () => void; onSpeed: () => void }) { return <div className="flex flex-wrap items-center gap-2 text-sm"><button className="control" onClick={props.onSkipStart}>⏮</button><button className="control" onClick={props.onBack}>Back</button><button className="control bg-cyan-300 text-slate-950" onClick={props.onToggle}>{props.playing ? "Pause" : "Play"}</button><button className="control" onClick={props.onStep}>Step</button><button className="control" onClick={props.onSkipEnd}>⏭</button><button className="control" onClick={props.onSpeed}>{props.speed}×</button><span className="min-w-24 text-slate-400">{props.total ? props.cursor + 1 : 0}/{props.total}</span></div>; }

function ArrayScene({ replay, activeReadIndex, vars, mode }: { replay: ReplayCase | null; activeReadIndex?: number; vars: Record<string, unknown>; mode: string }) {
  const values = replay?.input.values ?? []; const target = replay?.input.target; const expected = replay?.input.expectedIndex; const large = mode === "skyline"; const shown = large ? values.slice(0, 80) : values;
  return <div className="rounded-3xl border border-cyan-300/20 bg-gradient-to-b from-slate-900 to-slate-950 p-4"><div className="mb-3 flex items-center justify-between"><h2 className="text-xl font-bold">Array scene: {large ? "skyline" : "doors"}</h2><p className="text-sm text-slate-400">target relic: <span className="text-cyan-200">{String(target ?? "?")}</span></p></div><div className={`grid gap-2 ${large ? "grid-cols-[repeat(40,minmax(0,1fr))]" : "grid-cols-7"}`}>{shown.map((value, index) => { const isRead = index === activeReadIndex; const isExpected = index === expected; const hasPointer = Object.values(vars).includes(index); return <div key={`${index}-${value}`} className={`relative flex items-end justify-center rounded-xl border text-xs transition-all ${large ? "h-28" : "h-20"} ${isRead ? "border-cyan-200 bg-cyan-300/30 shadow-lg shadow-cyan-300/30" : "border-white/10 bg-white/5"} ${isExpected ? "ring-2 ring-emerald-300" : ""}`}>{large ? <div className="w-full rounded-t-lg bg-cyan-400/50" style={{ height: `${Math.max(8, (Number(value) / Math.max(1, values.length)) * 100)}%` }} /> : <><span className="absolute top-2 text-[0.65rem] text-slate-500">#{index}</span><span className="pb-4 font-bold">{value}</span></>}{hasPointer ? <span className="absolute -top-3 rounded bg-yellow-300 px-1 text-[0.6rem] font-bold text-slate-950">var</span> : null}</div>; })}</div>{large && values.length > shown.length ? <p className="mt-2 text-xs text-slate-500">Showing first {shown.length} of {values.length} skyline bars to keep 3,000-step replays responsive.</p> : null}</div>;
}
function CodeTrace({ code, activeLine }: { code: string; activeLine?: number }) { return <div className="rounded-2xl border border-white/10 bg-black/30 p-3"><h3 className="mb-2 font-bold">Line movement</h3><pre className="max-h-80 overflow-auto font-mono text-xs leading-6">{code.split("\n").map((line, index) => <div key={index} className={activeLine === index + 1 ? "rounded bg-cyan-300/20 text-cyan-100" : "text-slate-400"}><span className="mr-3 inline-block w-6 text-right text-slate-600">{index + 1}</span>{line || " "}</div>)}</pre></div>; }
function VarsPanel({ vars, event }: { vars: Record<string, unknown>; event?: TimelineEvent }) { return <div className="rounded-2xl border border-white/10 bg-black/30 p-3"><h3 className="font-bold">Variables + event</h3><pre className="mt-2 overflow-auto text-xs text-slate-300">{JSON.stringify({ vars, event }, null, 2)}</pre></div>; }
function CasesPanel({ result }: { result: RunResult | null }) { return <div className="rounded-2xl border border-white/10 bg-black/30 p-3"><h3 className="font-bold">Cases</h3><div className="mt-2 space-y-2 text-sm">{result?.cases.map((testCase, index) => <div key={testCase.caseId} className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2"><span>{index === result.execution.replayCaseIndex ? "▶ " : ""}{testCase.caseId}</span><span className={testCase.passed ? "text-emerald-300" : "text-rose-300"}>{testCase.status}</span></div>) ?? <p className="text-slate-500">Waiting for runner…</p>}</div></div>; }
function AttemptHistory({ attempts }: { attempts: Attempt[] }) { return <div className="rounded-2xl border border-white/10 bg-black/30 p-3"><h3 className="font-bold">Attempt history</h3><div className="mt-2 max-h-52 space-y-2 overflow-auto text-xs">{attempts.length ? attempts.map((attempt) => <div key={attempt.id} className="rounded-xl bg-white/5 p-2"><b>{attempt.status}</b> · {attempt.replayCaseId ?? "no replay"}<br />timeline: {attempt.timelinePointer}<br />{attempt.solutionAssisted ? "solution-assisted" : "unassisted"}</div>) : <p className="text-slate-500">No attempts yet.</p>}</div></div>; }

function isUnlocked(challenge: Challenge, progress: ProgressState) { return challenge.unlock.requiresQuestIds.every((id) => progress.cleared[id]); }
function collectVars(events: TimelineEvent[], cursor: number) { const vars: Record<string, unknown> = {}; for (let i = 0; i <= cursor && i < events.length; i += 1) Object.assign(vars, events[i].vars ?? {}); return vars; }
function lineNumbers(code: string) { return code.split("\n").map((_, index) => index + 1).join("\n"); }
function insertAtSelection(code: string, start: number, end: number, text: string, setCode: (value: string) => void, ref: React.RefObject<HTMLTextAreaElement | null>) { const next = `${code.slice(0, start)}${text}${code.slice(end)}`; setCode(next); window.requestAnimationFrame(() => { ref.current?.focus(); ref.current?.setSelectionRange(start + text.length, start + text.length); }); }
function outdentSelection(code: string, start: number, end: number, setCode: (value: string) => void, ref: React.RefObject<HTMLTextAreaElement | null>) { const lineStart = code.lastIndexOf("\n", start - 1) + 1; const block = code.slice(lineStart, end); const replacement = block.replace(/^ {1,4}/gm, ""); const removedBeforeCursor = block.length - replacement.length; setCode(`${code.slice(0, lineStart)}${replacement}${code.slice(end)}`); window.requestAnimationFrame(() => { ref.current?.focus(); const nextCursor = Math.max(lineStart, start - Math.min(4, removedBeforeCursor)); ref.current?.setSelectionRange(nextCursor, Math.max(nextCursor, end - removedBeforeCursor)); }); }
function readProgress(key: string): ProgressState { try { return { ...EMPTY_PROGRESS, ...JSON.parse(window.localStorage.getItem(key) || "{}") }; } catch { return EMPTY_PROGRESS; } }
function writeProgress(key: string, value: ProgressState) { try { window.localStorage.setItem(key, JSON.stringify(value)); } catch {} }
function safeLocalStorageGet(key: string) { try { return window.localStorage.getItem(key); } catch { return null; } }
function safeLocalStorageSet(key: string, value: string) { try { window.localStorage.setItem(key, value); } catch {} }
function safeLocalStorageRemove(key: string) { try { window.localStorage.removeItem(key); } catch {} }
