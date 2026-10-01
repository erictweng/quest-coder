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

const STARTER_CODE = samplePack.boss.starterCode;
const PASSING_CODE = samplePack.boss.solution.code;

const TABS = "    ";
const PLAY_SPEEDS = [0.5, 1, 2, 4];

const OUTCOME_COPY: Record<Status, { title: string; visual: string; tone: string }> = {
  passed: { title: "Found / victory", visual: "gold relic glow", tone: "text-emerald-200 bg-emerald-500/15 border-emerald-300/40" },
  wrong_answer: { title: "Wrong answer", visual: "red wrong room, green expected", tone: "text-rose-200 bg-rose-500/15 border-rose-300/40" },
  compile_error: { title: "Compile error", visual: "broken spell scroll", tone: "text-amber-200 bg-amber-500/15 border-amber-300/40" },
  runtime_error: { title: "Crash", visual: "spark burst", tone: "text-orange-200 bg-orange-500/15 border-orange-300/40" },
  over_budget: { title: "Over budget", visual: "empty chrono meter", tone: "text-fuchsia-200 bg-fuchsia-500/15 border-fuchsia-300/40" },
  loop_guard: { title: "Loop guard", visual: "spinning pathfinder", tone: "text-sky-200 bg-sky-500/15 border-sky-300/40" },
  off_end_read: { title: "Off-end read", visual: "ghost room fall", tone: "text-violet-200 bg-violet-500/15 border-violet-300/40" },
  internal_error: { title: "Internal error", visual: "theater lights out", tone: "text-slate-200 bg-slate-500/15 border-slate-300/40" }
};

export default function Home() {
  const pack = samplePack;
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [code, setCode] = useState(STARTER_CODE);
  const [result, setResult] = useState<RunResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [cursor, setCursor] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);

  const replay = result?.replay ?? null;
  const events = replay?.events ?? [];
  const activeEvent = events[Math.min(cursor, Math.max(events.length - 1, 0))];
  const activeLine = activeEvent?.line;
  const activeReadIndex = activeEvent?.kind === "read" ? activeEvent.ref?.index : undefined;
  const latestVars = useMemo(() => collectVars(events, cursor), [events, cursor]);
  const sceneMode = (replay?.input.values.length ?? 0) > 24 ? "skyline" : "doors";

  const submit = useCallback(async () => {
    setIsRunning(true);
    setRunError(null);
    setPlaying(false);
    try {
      const response = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: code })
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Runner request failed");
      }
      setResult(payload as RunResult);
      setCursor(0);
    } catch (error) {
      setRunError(error instanceof Error ? error.message : "Unknown run error");
    } finally {
      setIsRunning(false);
    }
  }, [code]);

  useEffect(() => {
    void submit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!playing || events.length === 0) {
      return;
    }
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
      if (event.shiftKey) {
        outdentSelection(code, selectionStart, selectionEnd, setCode, textareaRef);
      } else {
        insertAtSelection(code, selectionStart, selectionEnd, TABS, setCode, textareaRef);
      }
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
        <header className="flex flex-col gap-4 rounded-3xl border border-cyan-300/25 bg-slate-950/70 p-6 shadow-2xl shadow-cyan-950/30 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-cyan-300">Quest Coder · Sprint 2 Replay Theater</p>
            <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-5xl">{pack.title}</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300 sm:text-base">{pack.boss.brief} The first failing test opens automatically, while passing submissions play the victory replay.</p>
          </div>
          <div className="grid gap-2 text-sm sm:grid-cols-3 lg:w-[30rem]">
            <Metric label="Replay case" value={replay?.caseId ?? "loading"} />
            <Metric label="Events" value={`${events.length}/${result?.limits.maxEvents ?? 3000}`} />
            <Metric label="Mode" value={sceneMode} />
          </div>
        </header>

        <div className="grid gap-6 xl:grid-cols-[minmax(420px,0.9fr)_minmax(520px,1.1fr)]">
          <section className="rounded-3xl border border-white/10 bg-slate-950/80 p-4 shadow-xl">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold">Question + code editor</h2>
                <p className="text-sm text-slate-400">Line numbers, Tab/Shift+Tab, auto-indent, and Ctrl/Cmd+Enter are wired. Ligatures are disabled.</p>
              </div>
              <div className="flex gap-2">
                <button className="rounded-xl border border-white/10 px-3 py-2 text-sm hover:bg-white/10" onClick={() => setCode(PASSING_CODE)}>Load passing</button>
                <button className="rounded-xl border border-white/10 px-3 py-2 text-sm hover:bg-white/10" onClick={() => setCode(STARTER_CODE)}>Reset</button>
                <button className="rounded-xl bg-cyan-300 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-cyan-200 disabled:opacity-60" disabled={isRunning} onClick={() => void submit()}>{isRunning ? "Running…" : "Run ▶"}</button>
              </div>
            </div>
            <div className="rounded-2xl border border-slate-700 bg-slate-900/80 p-3">
              <div className="grid grid-cols-[3rem_1fr] gap-3">
                <pre aria-hidden="true" className="select-none text-right font-mono text-sm leading-6 text-slate-500">{lineNumbers(code)}</pre>
                <textarea
                  ref={textareaRef}
                  aria-label="Python solution editor"
                  className="min-h-[30rem] resize-y bg-transparent font-mono text-sm leading-6 text-slate-100 outline-none [font-feature-settings:'liga'_0,'calt'_0]"
                  spellCheck={false}
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  onKeyDown={handleEditorKeyDown}
                />
              </div>
            </div>
            {runError ? <p className="mt-3 rounded-xl border border-red-300/40 bg-red-500/10 p-3 text-sm text-red-200">{runError}</p> : null}
          </section>

          <section className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-slate-950/80 p-4 shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <OutcomeBadge status={result?.status ?? "internal_error"} passed={result?.passed ?? false} />
              <PlaybackControls
                cursor={cursor}
                total={events.length}
                playing={playing}
                speed={speed}
                onBack={() => setCursor((value) => Math.max(0, value - 1))}
                onStep={() => setCursor((value) => Math.min(events.length - 1, value + 1))}
                onSkipStart={() => setCursor(0)}
                onSkipEnd={() => setCursor(Math.max(events.length - 1, 0))}
                onToggle={() => setPlaying((value) => !value)}
                onSpeed={() => setSpeed((value) => PLAY_SPEEDS[(PLAY_SPEEDS.indexOf(value) + 1) % PLAY_SPEEDS.length])}
              />
            </div>

            <ArrayScene replay={replay} activeReadIndex={activeReadIndex} vars={latestVars} mode={sceneMode} />

            <div className="grid gap-4 lg:grid-cols-2">
              <CodeTrace code={code} activeLine={activeLine} />
              <div className="space-y-4">
                <VarsPanel vars={latestVars} event={activeEvent} />
                <CasesPanel result={result} />
              </div>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-white/10 bg-white/5 p-3"><p className="text-[0.65rem] uppercase tracking-[0.2em] text-slate-500">{label}</p><p className="mt-1 truncate font-bold text-cyan-100">{value}</p></div>;
}

function OutcomeBadge({ status, passed }: { status: Status; passed: boolean }) {
  const copy = OUTCOME_COPY[status];
  return <div className={`rounded-2xl border px-4 py-3 ${copy.tone}`}><p className="text-sm font-bold">{passed ? "Victory replay ready" : copy.title}</p><p className="text-xs opacity-80">Visual: {copy.visual}</p></div>;
}

function PlaybackControls(props: { cursor: number; total: number; playing: boolean; speed: number; onBack: () => void; onStep: () => void; onSkipStart: () => void; onSkipEnd: () => void; onToggle: () => void; onSpeed: () => void }) {
  return <div className="flex flex-wrap items-center gap-2 text-sm"><button className="control" onClick={props.onSkipStart}>⏮</button><button className="control" onClick={props.onBack}>Back</button><button className="control bg-cyan-300 text-slate-950" onClick={props.onToggle}>{props.playing ? "Pause" : "Play"}</button><button className="control" onClick={props.onStep}>Step</button><button className="control" onClick={props.onSkipEnd}>⏭</button><button className="control" onClick={props.onSpeed}>{props.speed}×</button><span className="min-w-24 text-slate-400">{props.total ? props.cursor + 1 : 0}/{props.total}</span></div>;
}

function ArrayScene({ replay, activeReadIndex, vars, mode }: { replay: ReplayCase | null; activeReadIndex?: number; vars: Record<string, unknown>; mode: string }) {
  const values = replay?.input.values ?? [];
  const target = replay?.input.target;
  const expected = replay?.input.expectedIndex;
  const large = mode === "skyline";
  const shown = large ? values.slice(0, 80) : values;
  return <div className="rounded-3xl border border-cyan-300/20 bg-gradient-to-b from-slate-900 to-slate-950 p-4"><div className="mb-3 flex items-center justify-between"><h2 className="text-xl font-bold">Array scene: {large ? "skyline" : "doors"}</h2><p className="text-sm text-slate-400">target relic: <span className="text-cyan-200">{String(target ?? "?")}</span></p></div><div className={`grid gap-2 ${large ? "grid-cols-[repeat(40,minmax(0,1fr))]" : "grid-cols-7"}`}>{shown.map((value, index) => { const isRead = index === activeReadIndex; const isExpected = index === expected; const hasPointer = Object.values(vars).includes(index); return <div key={`${index}-${value}`} className={`relative flex items-end justify-center rounded-xl border text-xs transition-all ${large ? "h-28" : "h-20"} ${isRead ? "border-cyan-200 bg-cyan-300/30 shadow-lg shadow-cyan-300/30" : "border-white/10 bg-white/5"} ${isExpected ? "ring-2 ring-emerald-300" : ""}`}>{large ? <div className="w-full rounded-t-lg bg-cyan-400/50" style={{ height: `${Math.max(8, (Number(value) / Math.max(1, values.length)) * 100)}%` }} /> : <><span className="absolute top-2 text-[0.65rem] text-slate-500">#{index}</span><span className="pb-4 font-bold">{value}</span></>}{hasPointer ? <span className="absolute -top-3 rounded bg-yellow-300 px-1 text-[0.6rem] font-bold text-slate-950">var</span> : null}</div>; })}</div>{large && values.length > shown.length ? <p className="mt-2 text-xs text-slate-500">Showing first {shown.length} of {values.length} skyline bars to keep 3,000-step replays responsive.</p> : null}</div>;
}

function CodeTrace({ code, activeLine }: { code: string; activeLine?: number }) {
  return <div className="rounded-2xl border border-white/10 bg-black/30 p-3"><h3 className="mb-2 font-bold">Line movement</h3><pre className="max-h-80 overflow-auto font-mono text-xs leading-6">{code.split("\n").map((line, index) => <div key={index} className={activeLine === index + 1 ? "rounded bg-cyan-300/20 text-cyan-100" : "text-slate-400"}><span className="mr-3 inline-block w-6 text-right text-slate-600">{index + 1}</span>{line || " "}</div>)}</pre></div>;
}

function VarsPanel({ vars, event }: { vars: Record<string, unknown>; event?: TimelineEvent }) {
  return <div className="rounded-2xl border border-white/10 bg-black/30 p-3"><h3 className="font-bold">Variables + event</h3><pre className="mt-2 overflow-auto text-xs text-slate-300">{JSON.stringify({ vars, event }, null, 2)}</pre></div>;
}

function CasesPanel({ result }: { result: RunResult | null }) {
  return <div className="rounded-2xl border border-white/10 bg-black/30 p-3"><h3 className="font-bold">Cases</h3><div className="mt-2 space-y-2 text-sm">{result?.cases.map((testCase, index) => <div key={testCase.caseId} className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2"><span>{index === result.execution.replayCaseIndex ? "▶ " : ""}{testCase.caseId}</span><span className={testCase.passed ? "text-emerald-300" : "text-rose-300"}>{testCase.status}</span></div>) ?? <p className="text-slate-500">Waiting for runner…</p>}</div></div>;
}

function collectVars(events: TimelineEvent[], cursor: number) {
  const vars: Record<string, unknown> = {};
  for (let i = 0; i <= cursor && i < events.length; i += 1) {
    Object.assign(vars, events[i].vars ?? {});
  }
  return vars;
}

function lineNumbers(code: string) {
  return code.split("\n").map((_, index) => index + 1).join("\n");
}

function insertAtSelection(code: string, start: number, end: number, text: string, setCode: (value: string) => void, ref: React.RefObject<HTMLTextAreaElement | null>) {
  const next = `${code.slice(0, start)}${text}${code.slice(end)}`;
  setCode(next);
  window.requestAnimationFrame(() => {
    ref.current?.focus();
    ref.current?.setSelectionRange(start + text.length, start + text.length);
  });
}

function outdentSelection(code: string, start: number, end: number, setCode: (value: string) => void, ref: React.RefObject<HTMLTextAreaElement | null>) {
  const lineStart = code.lastIndexOf("\n", start - 1) + 1;
  const block = code.slice(lineStart, end);
  const replacement = block.replace(/^ {1,4}/gm, "");
  const removedBeforeCursor = block.length - replacement.length;
  setCode(`${code.slice(0, lineStart)}${replacement}${code.slice(end)}`);
  window.requestAnimationFrame(() => {
    ref.current?.focus();
    const nextCursor = Math.max(lineStart, start - Math.min(4, removedBeforeCursor));
    ref.current?.setSelectionRange(nextCursor, Math.max(nextCursor, end - removedBeforeCursor));
  });
}
