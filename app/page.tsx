"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CompletionMoment } from "../components/completion-moment";
import { ResultSummary } from "../components/result-summary";
import climbingStairsPack from "../content/public/forest-of-patience-climbing-stairs.json";
import { appendAttempt, attemptFromFailure, attemptFromResult, describeAttempt, type AttemptRecord } from "../lib/attempts";
import { backspaceEdit, colonEdit, enterEdit, shiftTabEdit, tabEdit, type EditorEdit } from "../lib/python-editing";

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
  ref?: { structure: "array"; name: string; index?: number; nodeId?: string; field?: string };
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
  input: { structure: "array" | "linked_list"; values: number[]; target?: number; expectedIndex: unknown };
  arguments?: Record<string, unknown>;
  events: TimelineEvent[];
};

type RunResult = {
  schemaVersion: "timeline.v0";
  questId: string;
  language: "python";
  status: Status;
  passed: boolean;
  startedAt: string;
  execution: { passes: string[]; replayCaseIndex: number; mode?: "run" | "submit"; suiteSize?: number; replayCaseId?: string | null };
  cases: ReplayCase[];
  replay: ReplayCase | null;
  limits: { maxEvents: number; maxDurationMs: number; maxReads?: number };
  security?: { profile: string; grading: string; fallback: string };
};
/** State only the server can change. Run and action responses return it so the client never computes it. */
type ServerOwned = Pick<ProgressState, "cleared" | "solutionOpened" | "hintsOpened" | "reviews" | "rewards">;
type RunResponse = RunResult & { reward: RewardGrant | null; progress: ServerOwned };
/** Hint text and solutions the server has released for this player, keyed by challenge id. */
type Revealed = { hints: Record<string, string[]>; solutions: Record<string, string> };

type Hint = { id: string; cost: string };
type ProblemExample = { input: string; output: string; explanation: string };
type ProblemPrompt = { statement: string; gamifiedStatement: string; inputs: string[]; output: string; guarantees: string[]; examples: ProblemExample[] };
type ReviewVariant = { id: string; title: string; mutation: string };
type PackReview = { enabled: boolean; defaultSchedule: number[]; variants: ReviewVariant[]; rules?: Record<string, unknown> };
type Pack = {
  slug: string;
  title: string;
  metadata: { shortDescription: string; displayName?: string; category?: string; topic?: string };
  concepts: string[];
  scene: { type: "array" | "linked_list" };
  quests: BaseChallenge[];
  boss: BaseChallenge;
  review?: PackReview;
  rewards?: { xp?: { solutionAssistedMultiplier?: number; hintAssistedMultiplier?: number } };
};
type BaseChallenge = {
  id: string;
  order?: number;
  title: string;
  brief: string;
  starterCode: string;
  problem?: ProblemPrompt;
  hints?: Hint[];
  unlock: { requiresQuestIds: string[]; requiresPassed: boolean };
  rewards?: { xp?: number; shards?: number };
};
type PackChallenge = BaseChallenge & {
  packSlug: string;
  packTitle: string;
  packSceneType: "array" | "linked_list";
  packConcepts: string[];
  isBoss: boolean;
};
type Challenge = PackChallenge;
type Attempt = AttemptRecord;
type ReviewRecord = {
  packSlug: string;
  bossId: string;
  topic: string;
  intervalDays: number;
  nextDueAt: string;
  lastOutcome: Status;
  streak: number;
  rating: number;
  snoozedUntil?: string;
};
type RewardGrant = { id: string; at: string; challengeId: string; xp: number; shards: number; reason: string };
type RewardWallet = { xp: number; shards: number; grants: RewardGrant[]; shopPreviewUnlocked: boolean };
type AppSurface = "hub" | "profile" | "campaigns" | "campaignDetail" | "questions" | "solve";
type QuestionFilter = "All" | "Available" | "Cleared" | "Review" | "Boss";
type SolveTab = "Question" | "Animation" | "Hints" | "Solution" | "Submissions";
const SOLVE_TABS: SolveTab[] = ["Question", "Animation", "Hints", "Solution", "Submissions"];
type ProgressState = {
  cleared: Record<string, boolean>;
  solutionOpened: Record<string, boolean>;
  hintsOpened: Record<string, number>;
  attempts: Record<string, Attempt[]>;
  savedCode: Record<string, string>;
  reviews: Record<string, ReviewRecord>;
  rewards: RewardWallet;
  friendsEnabled: boolean;
};

const PACKS = [climbingStairsPack] as Pack[];
const DEFAULT_PACK = climbingStairsPack as Pack;
const PACK_BY_SLUG = Object.fromEntries(PACKS.map((pack) => [pack.slug, pack]));
const CHALLENGES: Challenge[] = PACKS.flatMap((pack) => [...pack.quests, pack.boss].map((challenge) => ({
  ...challenge,
  packSlug: pack.slug,
  packTitle: pack.title,
  packSceneType: pack.scene.type,
  packConcepts: pack.concepts,
  isBoss: challenge.id === pack.boss.id
})));
const CHALLENGE_BY_ID = Object.fromEntries(CHALLENGES.map((challenge) => [challenge.id, challenge]));
const PLAY_SPEEDS = [0.5, 1, 2, 4];
const EMPTY_REWARDS: RewardWallet = { xp: 0, shards: 0, grants: [], shopPreviewUnlocked: false };
const EMPTY_REVEALED: Revealed = { hints: {}, solutions: {} };
const SESSION_NAME_KEY = "quest-coder:session";
const SIGNED_OUT_KEY = "quest-coder:signed-out";
const SAVE_DEBOUNCE_MS = 400;
// Chromium rejects keepalive request bodies somewhere under 64 KiB; stay well below it.
const KEEPALIVE_MAX_BYTES = 48_000;
const LOCKED_REASON = "Clear the previous quest with Submit all first";
const EMPTY_PROGRESS: ProgressState = { cleared: {}, solutionOpened: {}, hintsOpened: {}, attempts: {}, savedCode: {}, reviews: {}, rewards: EMPTY_REWARDS, friendsEnabled: false };

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
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const gutterRef = useRef<HTMLPreElement | null>(null);
  const [userNameDraft, setUserNameDraft] = useState("");
  const [userName, setUserName] = useState<string | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [progress, setProgress] = useState<ProgressState>(EMPTY_PROGRESS);
  const [revealed, setRevealed] = useState<Revealed>(EMPTY_REVEALED);
  const [surface, setSurface] = useState<AppSurface>("hub");
  const [selectedPackSlug, setSelectedPackSlug] = useState(DEFAULT_PACK.slug);
  const [questionFilter, setQuestionFilter] = useState<QuestionFilter>("All");
  const [solveTab, setSolveTab] = useState<SolveTab>("Question");
  const [questNotebookOpen, setQuestNotebookOpen] = useState(false);
  const [solutionConfirmOpen, setSolutionConfirmOpen] = useState(false);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [activeId, setActiveId] = useState(DEFAULT_PACK.quests[0]?.id ?? DEFAULT_PACK.boss.id);
  const activeChallenge = useMemo(() => CHALLENGES.find((challenge) => challenge.id === activeId) ?? CHALLENGES[0], [activeId]);
  const [code, setCode] = useState(activeChallenge.starterCode);
  const [result, setResult] = useState<RunResult | null>(null);
  // The source that produced `result`, so the line trace still matches after the editor changes.
  const [ranSource, setRanSource] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [cursor, setCursor] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [recentReward, setRecentReward] = useState<RewardGrant | null>(null);
  const [passMoment, setPassMoment] = useState(false);

  const replay = result?.replay ?? null;
  const events = replay?.events ?? [];
  const activeEvent = events[Math.min(cursor, Math.max(events.length - 1, 0))];
  const activeLine = activeEvent?.line;
  const activeReadIndex = activeEvent?.kind === "read" ? activeEvent.ref?.index : undefined;
  const latestVars = useMemo(() => collectVars(events, cursor), [events, cursor]);
  const sceneMode = replay?.input.structure === "linked_list" ? "portals" : (replay?.input.values.length ?? 0) > 24 ? "skyline" : "doors";
  const activeAttempts = progress.attempts[activeChallenge.id] ?? [];
  const reviewItems = useMemo(() => buildReviewItems(progress), [progress]);
  const dueReviews = reviewItems.filter((item) => item.isDue && !item.isSnoozed);
  const topicStats = useMemo(() => buildTopicStats(progress), [progress]);
  const statBar = useMemo(() => buildStatBar(progress), [progress]);
  const activePack = PACK_BY_SLUG[activeChallenge.packSlug];
  const selectedPack = PACK_BY_SLUG[selectedPackSlug] ?? DEFAULT_PACK;
  const bossUnlocked = activePack.boss.unlock.requiresQuestIds.every((id) => progress.cleared[id]);
  const isActiveLocked = !isUnlocked(activeChallenge, progress);
  const activePath = useMemo(() => [...activePack.quests, activePack.boss] as BaseChallenge[], [activePack]);
  const nextChallenge = useMemo(() => {
    const index = activePath.findIndex((challenge) => challenge.id === activeChallenge.id);
    if (index < 0) return null;
    return activePath[index + 1] ? CHALLENGE_BY_ID[activePath[index + 1].id] : null;
  }, [activePath, activeChallenge.id]);

  const activeChallengeRef = useRef(activeChallenge);
  activeChallengeRef.current = activeChallenge;

  /** Adopts the server's save file, including the draft for the open challenge. */
  const applySave = useCallback((displayName: string, saved: unknown, released: Revealed | undefined) => {
    const loaded = normalizeProgress(saved);
    const challenge = activeChallengeRef.current;
    setUserName(displayName);
    setUserNameDraft(displayName);
    setProgress(loaded);
    setRevealed(released ?? EMPTY_REVEALED);
    // Set the editor in the same render as the progress, so the draft autosave below
    // never sees starter code next to a loaded profile and writes it over the draft.
    setCode(loaded.savedCode[challenge.id] ?? challenge.starterCode);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const lastName = safeLocalStorageGet(SESSION_NAME_KEY);
    if (lastName) setUserNameDraft(lastName);
    // Logging out keeps the server save and its cookie; this flag only stops the auto-resume.
    if (safeLocalStorageGet(SIGNED_OUT_KEY)) return;
    void (async () => {
      try {
        const session = await (await fetch("/api/session", { cache: "no-store" })).json() as { authenticated?: boolean; displayName?: string };
        if (cancelled || !session.authenticated || !session.displayName) return;
        const response = await fetch("/api/progress", { cache: "no-store" });
        if (!response.ok || cancelled) return;
        const saved = await response.json() as { progress?: unknown; revealed?: Revealed };
        if (!cancelled) applySave(session.displayName, saved.progress, saved.revealed);
      } catch {
        if (!cancelled) setSessionError("Could not reach the server. Sign in to retry.");
      }
    })();
    return () => { cancelled = true; };
  }, [applySave]);

  // Drafts, attempts and preferences are the only state the client writes; the server ignores the rest.
  const { attempts, savedCode, friendsEnabled } = progress;
  const unsavedRef = useRef<string | null>(null);
  /**
   * Sends any pending save now. Pass `closing` when the page may be going away: the request is
   * then marked keepalive so it can outlive the page. Browsers refuse large keepalive bodies, so
   * ordinary saves never use it and an oversized closing save falls back to a normal request.
   */
  const flushSave = useCallback((closing = false) => {
    const body = unsavedRef.current;
    if (body === null) return;
    unsavedRef.current = null;
    const keepalive = closing && new Blob([body]).size <= KEEPALIVE_MAX_BYTES;
    const keepForRetry = () => { if (unsavedRef.current === null) unsavedRef.current = body; };
    fetch("/api/progress", { method: "PUT", headers: { "content-type": "application/json" }, body, keepalive })
      .then((response) => { if (!response.ok && response.status !== 401) keepForRetry(); })
      // A save that did not go through stays pending, so the next change or flush sends it again.
      .catch(keepForRetry);
  }, []);
  useEffect(() => {
    if (!userName) return;
    unsavedRef.current = JSON.stringify({ progress: { attempts, savedCode, friendsEnabled } });
    const timer = window.setTimeout(() => flushSave(), SAVE_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [attempts, savedCode, friendsEnabled, userName, flushSave]);
  useEffect(() => {
    const onPageHide = () => flushSave(true);
    window.addEventListener("pagehide", onPageHide);
    return () => window.removeEventListener("pagehide", onPageHide);
  }, [flushSave]);

  useEffect(() => {
    setCode(progress.savedCode[activeChallenge.id] ?? activeChallenge.starterCode);
    setResult(null);
    setCursor(0);
    setPlaying(false);
  }, [activeChallenge.id]);

  useEffect(() => {
    if (!userName) return;
    setProgress((current) => current.savedCode[activeChallenge.id] === code ? current : ({ ...current, savedCode: { ...current.savedCode, [activeChallenge.id]: code } }));
  }, [activeChallenge.id, code, userName]);

  // A ref, not state: the keyboard shortcut can fire twice before a re-render disables anything.
  const runInFlightRef = useRef(false);
  const submit = useCallback(async (mode: "run" | "submit" = "run") => {
    if (runInFlightRef.current || !userName) return;
    if (isActiveLocked) {
      setRunError("This challenge is locked. Clear the prerequisite quests first.");
      return;
    }
    runInFlightRef.current = true;
    setIsRunning(true);
    setRunError(null);
    setResult(null);
    setRecentReward(null);
    setPassMoment(false);
    setPlaying(false);
    const context = {
      challengeId: activeChallenge.id,
      packSlug: activeChallenge.packSlug,
      mode,
      solutionAssisted: Boolean(progress.solutionOpened[activeChallenge.id]),
      hintCount: progress.hintsOpened[activeChallenge.id] ?? 0
    };
    // The player may switch quests while this runs; only show the outcome on the quest it belongs to.
    const stillOnThisQuest = () => activeChallengeRef.current.id === context.challengeId;
    try {
      const response = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: code, challengeId: context.challengeId, packSlug: context.packSlug, mode })
      });
      const payload = await response.json();
      if (response.status === 401) {
        // The server no longer knows this session; stop presenting the profile as signed in.
        setUserName(null);
        setSessionError("Your session ended. Sign in again to keep going.");
        return;
      }
      if (!response.ok) throw new Error(payload.error ?? "Runner request failed");
      const runResult = payload as RunResponse;
      if (stillOnThisQuest()) {
        setResult(runResult);
        setRanSource(code);
        setCursor(0);
        if (runResult.passed && mode === "submit") {
          setPassMoment(true);
          window.setTimeout(() => setPassMoment(false), 1800);
        }
        setRecentReward(runResult.reward);
      }
      recordAttempt(attemptFromResult(runResult, context), runResult.progress);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown run error";
      if (stillOnThisQuest()) {
        setRunError(message);
        setResult(null);
      }
      // A failed bridge call is still an attempt the player made; keep it in the history so the
      // Submissions tab never silently stays empty after Run basic / Submit all.
      recordAttempt(attemptFromFailure(message, context));
    } finally {
      runInFlightRef.current = false;
      setIsRunning(false);
    }
  }, [activeChallenge, code, isActiveLocked, progress.hintsOpened, progress.solutionOpened, userName]);

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

  async function signIn() {
    const displayName = userNameDraft.trim();
    if (!displayName) {
      setSessionError("Enter a name to sign in.");
      return;
    }
    setSessionError(null);
    try {
      const response = await fetch("/api/session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ displayName }) });
      const session = await response.json() as { displayName?: string; progress?: unknown; revealed?: Revealed; error?: string };
      if (!response.ok) throw new Error(session.error ?? "Sign-in failed.");
      safeLocalStorageSet(SESSION_NAME_KEY, displayName);
      safeLocalStorageRemove(SIGNED_OUT_KEY);
      applySave(session.displayName ?? displayName, session.progress, session.revealed);
    } catch (error) {
      setSessionError(error instanceof Error ? error.message : "Could not reach the server. Try again.");
    }
  }

  /** Hides the profile on this browser. The save stays on the server and resumes at the next sign-in. */
  function signOut() {
    flushSave(true);
    safeLocalStorageSet(SIGNED_OUT_KEY, "1");
    setUserName(null);
    setProgress(EMPTY_PROGRESS);
    setRevealed(EMPTY_REVEALED);
    setCode(activeChallenge.starterCode);
    setResult(null);
    setRunError(null);
    setRecentReward(null);
    setPassMoment(false);
  }

  function recordAttempt(attempt: Attempt, serverOwned?: ServerOwned) {
    setProgress((current) => ({ ...current, ...serverOwned, attempts: appendAttempt(current.attempts, attempt) }));
  }

  /** Asks the server to change server-owned state, then adopts what it returns. */
  async function progressAction(action: "open_hint" | "open_solution" | "unlock_shop_preview", challengeId?: string) {
    try {
      const response = await fetch("/api/progress", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, challengeId }) });
      const payload = await response.json() as { progress?: unknown; revealed?: Revealed; error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Could not save that action.");
      const { cleared, solutionOpened, hintsOpened, reviews, rewards } = normalizeProgress(payload.progress);
      setProgress((current) => ({ ...current, cleared, solutionOpened, hintsOpened, reviews, rewards }));
      setRevealed(payload.revealed ?? EMPTY_REVEALED);
    } catch (error) {
      setRunError(error instanceof Error ? error.message : "Could not save that action.");
    }
  }

  function applyEditorEdit(edit: EditorEdit) {
    setCode(edit.value);
    window.requestAnimationFrame(() => {
      const element = textareaRef.current;
      if (!element) return;
      element.focus();
      element.setSelectionRange(edit.selectionStart, edit.selectionEnd);
    });
  }

  function openCampaign(packSlug: string) {
    const pack = PACK_BY_SLUG[packSlug] ?? DEFAULT_PACK;
    setSelectedPackSlug(pack.slug);
    setActiveId(pack.quests[0]?.id ?? pack.boss.id);
    setSurface("campaignDetail");
  }

  function selectChallenge(id: string) {
    const challenge = CHALLENGE_BY_ID[id];
    if (challenge) setSelectedPackSlug(challenge.packSlug);
    setActiveId(id);
    setSurface("solve");
    setQuestNotebookOpen(false);
    setSolutionConfirmOpen(false);
    setResetConfirmOpen(false);
    setRecentReward(null);
    setPassMoment(false);
    setRunError(null);
  }

  function moveToNextQuest() {
    if (!nextChallenge) {
      setSurface("campaignDetail");
      setResult(null);
      return;
    }
    selectChallenge(nextChallenge.id);
  }

  function handleEditorKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      void submit("run");
      return;
    }
    if (event.altKey || event.metaKey || event.ctrlKey) return;
    // Read the live textarea value rather than React state so a keystroke that lands before the
    // previous onChange re-render still sees the latest text (for example the ':' just typed).
    const { value, selectionStart, selectionEnd } = event.currentTarget;
    if (event.key === "Tab") {
      event.preventDefault();
      applyEditorEdit(event.shiftKey ? shiftTabEdit(value, selectionStart, selectionEnd) : tabEdit(value, selectionStart, selectionEnd));
      return;
    }
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      applyEditorEdit(enterEdit(value, selectionStart, selectionEnd));
      return;
    }
    if (event.key === "Backspace") {
      const edit = backspaceEdit(value, selectionStart, selectionEnd);
      if (edit) {
        event.preventDefault();
        applyEditorEdit(edit);
      }
      return;
    }
    if (event.key === ":") {
      const edit = colonEdit(value, selectionStart, selectionEnd);
      if (edit) {
        event.preventDefault();
        applyEditorEdit(edit);
      }
    }
  }

  return (
    <main className="cyber-bit-world maze-grid-field pixel-console min-h-screen text-[var(--qc-text)]">
      <section className="relative z-10 mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 lg:px-8">
        <header className={surface === "solve" ? "sticky top-0 z-40 rounded-none border-b border-cyan-300/20 bg-slate-950/95 px-3 py-2 backdrop-blur" : "pixel-panel rounded-3xl p-6"}>
          {surface === "solve" ? (
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <button className="control px-3 py-1" onClick={() => setSurface("hub")}>Home</button>
                <span className="rounded-lg border border-cyan-300/30 bg-cyan-300/10 px-2 py-1 text-cyan-100">Quest Coder</span>
                <span className="max-w-[40vw] truncate text-slate-300">{activeChallenge.title}</span>
                <StatusPill label={result?.execution.mode ? `${result.execution.mode} · ${result.cases.length} cases` : "compiler ready"} tone={result?.passed ? "green" : "cyan"} />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {userName ? <><span className="text-slate-400">{userName}</span><button className="control px-3 py-1" onClick={signOut}>Log out</button></> : <><input className="w-24 rounded-lg border border-white/10 bg-slate-950 px-2 py-1" value={userNameDraft} placeholder="Your name" onChange={(event) => setUserNameDraft(event.target.value)} aria-label="User name" /><button className="rounded-lg bg-cyan-300 px-3 py-1 font-bold text-slate-950" onClick={signIn}>Sign in</button></>}
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.35em] text-cyan-300">Quest Coder</p>
                  <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-5xl">Choose your node path</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300 sm:text-base">Boot the Cyberpunk Bit terminal: choose Profile, Campaign, or Questions, then open the compiler when the quest starts.</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                  {userName ? (
                    <div className="flex flex-wrap items-center gap-3"><span className="text-sm text-slate-300">Signed in as <b className="text-cyan-200">{userName}</b></span><button className="control" onClick={signOut}>Log out</button></div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2"><input className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm" value={userNameDraft} placeholder="Your name" onChange={(event) => setUserNameDraft(event.target.value)} aria-label="User name" /><button className="rounded-xl bg-cyan-300 px-4 py-2 text-sm font-bold text-slate-950" onClick={signIn}>Sign in</button></div>
                  )}
                </div>
              </div>
              <nav className="mt-5 flex flex-wrap gap-2 text-sm" aria-label="Quest Coder primary surfaces">
                <button className={surface === "hub" ? "rounded-xl bg-cyan-300 px-3 py-2 font-bold text-slate-950" : "control"} onClick={() => setSurface("hub")}>Hub</button>
                <button className={surface === "profile" ? "rounded-xl bg-cyan-300 px-3 py-2 font-bold text-slate-950" : "control"} onClick={() => setSurface("profile")}>Profile</button>
                <button className={surface === "campaigns" || surface === "campaignDetail" ? "rounded-xl bg-cyan-300 px-3 py-2 font-bold text-slate-950" : "control"} onClick={() => setSurface("campaigns")}>Campaign</button>
                <button className={surface === "questions" ? "rounded-xl bg-cyan-300 px-3 py-2 font-bold text-slate-950" : "control"} onClick={() => setSurface("questions")}>Questions</button>
                <button className="control" onClick={() => setSurface("solve")}>Solve</button>
              </nav>
              <div className="mt-4 grid gap-2 text-sm sm:grid-cols-4">
                <Metric label="Streak/rating" value={`${topicStats[0]?.streak ?? 0}/${topicStats[0]?.rating ?? 1000}`} />
                <Metric label="Bosses defeated" value={statBar.label} />
                <Metric label="Active quest" value={activeChallenge.title} />
                <Metric label="Boss" value={bossUnlocked ? "unlocked" : "locked"} />
                <Metric label="Reviews due" value={`${dueReviews.length}`} />
                <Metric label="XP" value={`${progress.rewards.xp}`} />
                <Metric label="Shards" value={`${progress.rewards.shards}`} />
              </div>
              <StatBar stat={statBar} />
            </>
          )}
          {sessionError ? <p className="mt-2 text-xs text-rose-200" role="alert">{sessionError}</p> : null}
        </header>

        {surface === "hub" ? (
          <section className="space-y-5">
            <div className="pixel-dialogue terminal-card rounded-3xl p-5 shadow-xl">
              <div className="flex items-start gap-4"><img className="cyber-asset bit-sprite h-14 w-14 border border-cyan-300/30 bg-slate-950 p-1" src="/art/cyberpunk-bit/operator.svg" alt="" aria-hidden="true" /><div><h2 className="text-xl font-black text-[var(--qc-pac-yellow)]">Pixel operator</h2><p className="mt-1 text-slate-200">“Pick a maze node first. I’ll open the compiler when the quest starts.”</p></div></div>
            </div>
            <div className="grid gap-4 lg:grid-cols-3">
              <button className="neon-maze-panel pixel-button rounded-3xl p-6 text-left shadow-xl hover:bg-cyan-300/10" onClick={() => setSurface("profile")}>
                <div className="flex items-start justify-between gap-3"><div><p className="text-xs uppercase tracking-[0.3em] text-cyan-300">Profile</p><h2 className="mt-3 text-2xl font-black">Score file</h2></div><div className="pellet-node grid h-10 w-10 place-items-center border border-yellow-200/30 bg-yellow-300/10 p-1" aria-hidden="true"><img className="cyber-asset h-7 w-7" src="/art/cyberpunk-bit/rematch-ping.svg" alt="" /></div></div><p className="mt-2 text-sm text-slate-300">XP, Shards, rematch pings, recent attempts, and solo/social settings.</p><p className="mt-4 text-xs text-cyan-100">{progress.rewards.xp} XP · {progress.rewards.shards} Shards · {dueReviews.length} rematches</p>
              </button>
              <button className="neon-maze-panel pixel-button rounded-3xl p-6 text-left shadow-xl hover:bg-purple-300/10" onClick={() => setSurface("campaigns")}>
                <div className="flex items-start justify-between gap-3"><div><p className="text-xs uppercase tracking-[0.3em] text-purple-300">Campaign</p><h2 className="mt-3 text-2xl font-black">Neon districts</h2></div><div className="power-node grid h-10 w-10 place-items-center border border-cyan-200/30 bg-cyan-300/10 p-1" aria-hidden="true"><img className="cyber-asset h-7 w-7" src="/art/cyberpunk-bit/power-node.svg" alt="" /></div></div><p className="mt-2 text-sm text-slate-300">Pick a topic district before the compiler appears.</p><p className="mt-4 text-xs text-purple-100">{PACKS.length} districts · {statBar.label}</p>
              </button>
              <button className="terminal-card pixel-button rounded-3xl p-6 text-left shadow-xl hover:bg-yellow-300/10" onClick={() => setSurface("questions")}>
                <div className="flex items-start justify-between gap-3"><div><p className="text-xs uppercase tracking-[0.3em] text-yellow-300">Questions</p><h2 className="mt-3 text-2xl font-black">Encounter board</h2></div><div className="firewall-gate grid h-10 w-10 place-items-center border bg-pink-300/10 p-1" aria-hidden="true"><img className="cyber-asset h-7 w-7" src="/art/cyberpunk-bit/firewall-gate.svg" alt="" /></div></div><p className="mt-2 text-sm text-slate-300">Choose an available pellet quest, review ping, or firewall boss.</p><p className="mt-4 text-xs text-yellow-100">{CHALLENGES.length} quests and bosses</p>
              </button>
            </div>
            <button className="pixel-button terminal-card w-full rounded-3xl p-5 text-left shadow-xl" onClick={() => selectChallenge(activeChallenge.id)}><b>Continue Last Quest</b><p className="mt-1 text-sm text-emerald-100">{activeChallenge.title} · opens the encounter console</p></button>
          </section>
        ) : surface === "profile" ? (
          <section className="grid gap-4 lg:grid-cols-[1fr_1fr]">
            <div className="rounded-3xl border border-cyan-300/20 bg-slate-950/80 p-5"><h2 className="text-2xl font-black">Profile save file</h2><p className="mt-2 text-slate-300">{userName ?? "Guest"} · {progress.rewards.xp} XP · {progress.rewards.shards} Shards · {dueReviews.length} reviews due</p><div className="mt-4 grid gap-2 sm:grid-cols-2"><Metric label="Bosses defeated" value={statBar.label} /><Metric label="Attempts logged" value={`${Object.values(progress.attempts).flat().length}`} /></div><div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-3"><h3 className="font-bold">Recent attempts</h3><div className="mt-2 space-y-2 text-xs">{Object.values(progress.attempts).flat().slice(0, 4).length ? Object.values(progress.attempts).flat().slice(0, 4).map((attempt) => <p key={attempt.id} className="rounded-xl bg-slate-950/70 p-2">{attempt.challengeId} · {attempt.status} · {attempt.solutionAssisted ? "solution-assisted" : "unassisted"}</p>) : <p className="text-slate-400">No attempts logged yet.</p>}</div></div><div className="mt-4 rounded-2xl border border-purple-300/20 bg-purple-300/5 p-3"><h3 className="font-bold">Review reminders</h3><p className="mt-1 text-sm text-slate-300">{dueReviews.length ? `${dueReviews.length} rematch queued.` : "No reviews due. Beat a boss to start spaced rematches."}</p></div></div>
            <div className="space-y-4"><RewardPanel rewards={progress.rewards} onSpend={() => void progressAction("unlock_shop_preview")} /></div>
          </section>
        ) : surface === "campaigns" ? (
          <section className="grid gap-4 lg:grid-cols-2">
            {PACKS.map((pack) => { const cleared = [...pack.quests, pack.boss].filter((challenge) => progress.cleared[challenge.id]).length; const total = pack.quests.length + 1; const bossOpen = pack.boss.unlock.requiresQuestIds.every((id) => progress.cleared[id]); const reviewDue = dueReviews.some((item) => item.pack.slug === pack.slug); return <button key={pack.slug} className="neon-maze-panel rounded-3xl p-5 text-left hover:bg-purple-300/10" onClick={() => openCampaign(pack.slug)}><div className="flex items-start justify-between gap-3"><div><p className="text-xs uppercase tracking-[0.3em] text-purple-300">Neon district</p><h2 className="mt-2 text-2xl font-black">{pack.title}</h2></div><div className="power-node cyber-asset-soft grid h-12 w-12 place-items-center border border-cyan-200/30 bg-cyan-300/10 p-1" aria-hidden="true"><img className="cyber-asset h-8 w-8" src="/art/cyberpunk-bit/glitch-patrol.svg" alt="" /></div></div><p className="mt-2 text-sm text-slate-300">{pack.metadata.shortDescription}</p><div className="mt-4 flex flex-wrap gap-2 text-xs"><StatusPill label={`${cleared}/${total} cleared`} tone="cyan" /><StatusPill label={bossOpen ? "firewall open" : "firewall locked"} tone={bossOpen ? "gold" : "muted"} />{reviewDue ? <StatusPill label="review due" tone="purple" /> : null}</div><p className="mt-3 text-xs text-slate-400">Concepts: {pack.concepts.join(" · ")}</p></button>; })}
          </section>
        ) : surface === "campaignDetail" ? (
          <section className="neon-maze-panel rounded-3xl p-5"><div className="mb-5 flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs uppercase tracking-[0.3em] text-purple-300">Neon maze route</p><h2 className="mt-2 text-3xl font-black">{selectedPack.title}</h2><p className="mt-2 max-w-3xl text-sm text-slate-300">{selectedPack.metadata.shortDescription}</p><div className="mt-3 flex flex-wrap gap-2 text-xs">{selectedPack.concepts.map((concept) => <StatusPill key={concept} label={concept} tone="purple" />)}</div></div><button className="control" onClick={() => setSurface("campaigns")}>Back to campaigns</button></div><div className="grid gap-3 md:grid-cols-[repeat(auto-fit,minmax(180px,1fr))]">{[...selectedPack.quests, selectedPack.boss].map((challenge) => { const full = CHALLENGE_BY_ID[challenge.id]; const locked = full ? !isUnlocked(full, progress) : false; const cleared = Boolean(progress.cleared[challenge.id]); const isBoss = challenge.id === selectedPack.boss.id; const reviewDue = dueReviews.some((item) => item.record.bossId === challenge.id); const status = reviewDue ? "review due" : cleared ? "cleared" : locked ? "locked" : isBoss ? "boss" : "available"; return <button key={challenge.id} className={`rounded-2xl border p-4 text-left transition ${locked ? "cursor-not-allowed opacity-60" : "hover:-translate-y-0.5"} ${isBoss ? "firewall-gate" : "terminal-card"}`} onClick={() => selectChallenge(challenge.id)} disabled={locked} title={locked ? LOCKED_REASON : undefined}><div className="flex items-start justify-between gap-3"><div><p className="text-xs uppercase tracking-[0.25em] text-slate-400">{isBoss ? "Firewall gate" : `Pellet node ${challenge.order ?? ""}`}</p><h3 className="mt-2 font-bold">{challenge.title}</h3></div><div className={`cyber-asset-soft grid h-9 w-9 place-items-center border p-1 ${isBoss ? "firewall-gate" : "pellet-node border-yellow-200/30 bg-yellow-300/10"}`} aria-hidden="true"><img className="cyber-asset h-6 w-6" src={isBoss ? "/art/cyberpunk-bit/firewall-gate.svg" : "/art/cyberpunk-bit/pellet-node.svg"} alt="" /></div></div><p className="mt-2 text-xs text-slate-400">{challenge.brief}</p><div className="mt-3 flex flex-wrap gap-2"><StatusPill label={status} tone={reviewDue ? "purple" : cleared ? "green" : locked ? "muted" : isBoss ? "pink" : "cyan"} />{isBoss ? <StatusPill label={locked ? "firewall locked" : "firewall open"} tone={locked ? "muted" : "gold"} /> : null}</div></button>; })}</div></section>
        ) : surface === "questions" ? (
          <section className="rounded-3xl border border-white/10 bg-slate-950/80 p-5"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-2xl font-black">Questions list</h2><p className="text-sm text-slate-400">Select a question to open the focused solve screen.</p></div><div className="flex flex-wrap gap-2 text-xs">{(["All", "Available", "Cleared", "Review", "Boss"] as QuestionFilter[]).map((filter) => <button key={filter} className={questionFilter === filter ? "rounded-xl bg-cyan-300 px-3 py-2 font-bold text-slate-950" : "control"} onClick={() => setQuestionFilter(filter)}>{filter}</button>)}</div></div><div className="grid gap-3 md:grid-cols-2">{CHALLENGES.filter((challenge) => { const locked = !isUnlocked(challenge, progress); const cleared = Boolean(progress.cleared[challenge.id]); const reviewDue = dueReviews.some((item) => item.record.bossId === challenge.id); if (questionFilter === "Available") return !locked && !cleared && !challenge.isBoss; if (questionFilter === "Cleared") return cleared; if (questionFilter === "Review") return reviewDue; if (questionFilter === "Boss") return challenge.isBoss; return true; }).map((challenge) => { const locked = !isUnlocked(challenge, progress); const cleared = Boolean(progress.cleared[challenge.id]); const reviewDue = dueReviews.some((item) => item.record.bossId === challenge.id); const status = reviewDue ? "review due" : cleared ? "cleared" : locked ? "locked" : challenge.isBoss ? "boss" : "available"; return <button key={challenge.id} className={`rounded-2xl border border-white/10 bg-white/5 p-4 text-left ${locked ? "cursor-not-allowed opacity-60" : "hover:border-cyan-300"}`} onClick={() => selectChallenge(challenge.id)} disabled={locked} title={locked ? LOCKED_REASON : undefined}><b>{challenge.isBoss ? "Boss" : `Quest ${challenge.order ?? ""}`}: {challenge.title}</b><p className="mt-1 text-xs text-slate-400">{challenge.packTitle} · {(progress.attempts[challenge.id] ?? []).length} attempts</p><div className="mt-3 flex flex-wrap gap-2"><StatusPill label={status} tone={reviewDue ? "purple" : cleared ? "green" : locked ? "muted" : challenge.isBoss ? "pink" : "cyan"} />{challenge.packConcepts.slice(0, 2).map((concept) => <StatusPill key={concept} label={concept} tone="purple" />)}</div></button>; })}</div></section>
        ) : (
          <section className="one-question-workspace relative min-h-[calc(100vh-4rem)]" aria-label="Full-screen compiler workspace">
            <section className="pixel-panel rounded-2xl p-3 shadow-xl" aria-label="Code editor">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.25em] text-emerald-300">Python 3</p>
                  <h2 className="text-xl font-black">{activeChallenge.title}</h2>
                  <p className="text-xs text-slate-400">Run basic checks the example cases. Submit runs the full suite and clears the quest.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {resetConfirmOpen ? <><span className="self-center text-xs text-amber-100">Replace your code with the starter code?</span><button className="rounded-xl bg-amber-300 px-3 py-2 text-sm font-bold text-slate-950" onClick={() => { setCode(activeChallenge.starterCode); setResetConfirmOpen(false); }}>Reset code</button><button className="control" onClick={() => setResetConfirmOpen(false)}>Keep my code</button></> : <button className="rounded-xl border border-white/10 px-3 py-2 text-sm hover:bg-white/10" onClick={() => setResetConfirmOpen(true)}>Reset</button>}
                  <button className="rounded-xl bg-cyan-300 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-cyan-200 disabled:opacity-60" disabled={isRunning || isActiveLocked || !userName} onClick={() => void submit("run")}>{isRunning ? "Running…" : "Run basic ▶"}</button>
                  <button className="rounded-xl bg-yellow-300 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-yellow-200 disabled:opacity-60" disabled={isRunning || isActiveLocked || !userName} onClick={() => void submit("submit")}>{activeChallenge.isBoss ? "Submit Boss" : "Submit all"}</button>
                </div>
              </div>
              <div className="rounded-2xl border border-slate-700 bg-slate-950/95 p-3">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400"><span>solution.py</span><span>Tab/Shift+Tab indent · Ctrl/Cmd+Enter runs basic cases</span></div>
                <div className="grid grid-cols-[3rem_1fr] gap-3">
                  <pre ref={gutterRef} aria-hidden="true" className="select-none overflow-hidden text-right font-mono text-sm leading-6 text-slate-500">{lineNumbers(code)}</pre>
                  <textarea ref={textareaRef} aria-label="Python solution editor" className="min-h-[62vh] resize-y bg-transparent font-mono text-sm leading-6 text-slate-100 outline-none [font-feature-settings:'liga'_0,'calt'_0]" spellCheck={false} wrap="off" value={code} onChange={(event) => setCode(event.target.value)} onKeyDown={handleEditorKeyDown} onScroll={(event) => { if (gutterRef.current) gutterRef.current.scrollTop = event.currentTarget.scrollTop; }} />
                </div>
              </div>
              <div className="mt-3 rounded-2xl border border-emerald-300/20 bg-black/40 p-4" aria-label="Console result drawer">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-bold">Console</h3>
                  <div className="flex flex-wrap items-center gap-2"><StatusPill label={result?.execution.mode ? `${result.execution.mode} suite` : runError ? "runner message" : "waiting for run"} tone={result?.passed ? "green" : runError ? "cyan" : "muted"} />{result?.execution.replayCaseId ? <StatusPill label={`animation ${result.execution.replayCaseId}`} tone="purple" /> : null}<button className="control px-3 py-1 text-xs" onClick={() => { setQuestNotebookOpen(true); setSolveTab("Submissions"); }}>Submissions ({activeAttempts.length})</button></div>
                </div>
                {!userName ? <p className="mb-3 rounded-xl border border-yellow-300/40 bg-yellow-300/10 p-3 text-sm text-yellow-50" data-testid="signed-out-prompt"><b>Sign in to run code.</b> Enter a name in the top bar; your drafts and clears are saved to that profile.</p> : isActiveLocked ? <p className="mb-3 rounded-xl border border-slate-500/40 bg-slate-500/10 p-3 text-sm text-slate-200">This quest is locked. {LOCKED_REASON}.</p> : null}
                {runError ? <p className="mb-3 rounded-xl border border-cyan-300/40 bg-cyan-500/10 p-3 text-sm text-cyan-100" role="alert">{runError}</p> : null}
                {result?.passed && result.execution.mode === "run" ? <p className="mb-3 rounded-xl border border-cyan-300/40 bg-cyan-300/10 p-3 text-sm text-cyan-50" role="status"><b>Basic checks passed.</b> Submit all to clear this quest and unlock the next stage.</p> : null}
                {result ? <ResultSummary result={result} onHint={() => { setQuestNotebookOpen(true); setSolveTab("Hints"); }} /> : null}
                {result ? <CasesPanel result={result} /> : <p className="text-sm text-slate-400">Run basic cases or submit the full suite. Open the Quest Notebook if you need the prompt, examples, hints, animation, or solution gate.</p>}
                {result?.replay ? <button className="control mt-3" onClick={() => { setQuestNotebookOpen(true); setSolveTab("Animation"); }}>View Animation</button> : null}
              </div>
            </section>

            {result?.passed && result.execution.mode === "submit" ? <div className="fixed bottom-24 left-1/2 z-40 w-[min(42rem,calc(100vw-2rem))] -translate-x-1/2" data-testid="completion-floating-panel"><CompletionMoment showFireworks={passMoment} reward={recentReward} isBoss={activeChallenge.isBoss} nextTitle={nextChallenge?.title ?? null} onNext={moveToNextQuest} /></div> : null}

            <button className="quest-notebook-toggle fixed bottom-5 right-5 z-50 rounded-2xl border-2 border-yellow-200/60 bg-yellow-300 px-4 py-3 font-black text-slate-950 shadow-2xl shadow-yellow-500/20" aria-label={questNotebookOpen ? "Close quest notebook" : "Open quest notebook"} onClick={() => setQuestNotebookOpen((value) => !value)}>📓 Quest Notebook</button>

            {questNotebookOpen ? (
              <aside className="quest-notebook-panel fixed bottom-24 right-5 z-50 max-h-[78vh] w-[min(42rem,calc(100vw-2.5rem))] overflow-auto rounded-3xl border-2 border-cyan-300/40 bg-slate-950/98 p-5 shadow-2xl shadow-cyan-950/40" aria-label="Quest notebook pop-out">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div><p className="text-xs uppercase tracking-[0.3em] text-cyan-300">Quest Notebook</p><h2 className="mt-1 text-2xl font-black">{activeChallenge.title}</h2><p className="text-sm text-slate-400">{activePack.title} · {isActiveLocked ? "locked" : activeChallenge.isBoss ? "boss fight" : "available"}</p></div>
                  <button className="control" onClick={() => setQuestNotebookOpen(false)}>Close</button>
                </div>

                <div className="neon-maze-panel mb-4 rounded-2xl p-3" aria-label="Mini quest path">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><p className="text-xs uppercase tracking-[0.25em] text-purple-200">Quest path</p><span className="text-xs text-slate-400">one question at a time</span></div>
                  <div className="flex flex-wrap gap-2">{[...activePack.quests, activePack.boss].map((challenge) => { const full = CHALLENGE_BY_ID[challenge.id]; const locked = full ? !isUnlocked(full, progress) : false; const cleared = Boolean(progress.cleared[challenge.id]); const isCurrent = challenge.id === activeChallenge.id; const isBoss = challenge.id === activePack.boss.id; return <button key={challenge.id} className={`pellet-node rounded-xl border px-3 py-2 text-xs font-bold ${isCurrent ? "border-cyan-200 bg-cyan-300 text-slate-950" : cleared ? "border-emerald-300/40 bg-emerald-300/10 text-emerald-100" : locked ? "border-slate-600 bg-slate-800/60 text-slate-400" : isBoss ? "border-pink-300/40 bg-pink-300/10 text-pink-100" : "border-white/10 bg-white/5 text-slate-200"}`} onClick={() => { if (!locked) selectChallenge(challenge.id); }} disabled={locked} aria-disabled={locked} title={locked ? LOCKED_REASON : undefined}>{isBoss ? "Boss" : `Q${challenge.order ?? "?"}`}</button>; })}</div>
                </div>

                <div className="mb-4 flex flex-wrap gap-2 text-xs" role="tablist" aria-label="Quest notebook tabs">
                  {SOLVE_TABS.map((tab) => (
                    <button key={tab} role="tab" aria-selected={solveTab === tab} className={solveTab === tab ? "rounded-xl bg-cyan-300 px-3 py-2 font-bold text-slate-950" : "control"} onClick={() => { if (tab !== "Solution") setSolutionConfirmOpen(false); setSolveTab(tab); }}>{tab}</button>
                  ))}
                </div>

                {solveTab === "Question" ? <ProblemDetails challenge={activeChallenge} attempts={activeAttempts.length} helpUsed={progress.hintsOpened[activeChallenge.id] ?? 0} /> : null}
                {solveTab === "Animation" && !replay ? <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300"><h3 className="font-bold text-cyan-100">No replay yet</h3><p className="mt-2">Run basic or Submit all, then come back here to step through one test case line by line.</p></div> : null}
                {solveTab === "Animation" && replay ? <div className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 p-3"><OutcomeBadge status={replay.status} passed={replay.passed} /><p className="rounded-xl border border-slate-600 bg-slate-900/80 px-3 py-2 text-xs text-slate-300">Replay case: {result?.execution.replayCaseId ?? result?.replay?.caseId ?? "run code first"}</p><PlaybackControls cursor={cursor} total={events.length} playing={playing} speed={speed} onBack={() => setCursor((value) => Math.max(0, value - 1))} onStep={() => setCursor((value) => Math.min(events.length - 1, value + 1))} onSkipStart={() => setCursor(0)} onSkipEnd={() => setCursor(Math.max(events.length - 1, 0))} onToggle={() => setPlaying((value) => !value)} onSpeed={() => setSpeed((value) => PLAY_SPEEDS[(PLAY_SPEEDS.indexOf(value) + 1) % PLAY_SPEEDS.length])} /></div><SceneRenderer replay={replay} activeReadIndex={activeReadIndex} vars={latestVars} mode={sceneMode} /><div className="grid gap-4 lg:grid-cols-2"><CodeTrace code={ranSource} activeLine={activeLine} /><VarsPanel vars={latestVars} event={activeEvent} /></div></div> : null}
                {solveTab === "Hints" ? <HintsPanel opened={revealed.hints[activeChallenge.id] ?? []} total={activeChallenge.hints?.length ?? 0} signedIn={userName !== null} xpShare={activePack.rewards?.xp?.hintAssistedMultiplier ?? 1} onReveal={() => void progressAction("open_hint", activeChallenge.id)} /> : null}
                {solveTab === "Solution" ? <SolutionGate solution={revealed.solutions[activeChallenge.id]} signedIn={userName !== null} xpShare={activePack.rewards?.xp?.solutionAssistedMultiplier ?? 0.5} confirming={solutionConfirmOpen} onAskConfirm={() => setSolutionConfirmOpen(true)} onCancel={() => setSolutionConfirmOpen(false)} onReveal={() => { void progressAction("open_solution", activeChallenge.id); setSolutionConfirmOpen(false); }} /> : null}
                {solveTab === "Submissions" ? <div className="space-y-4">{runError ? <p className="rounded-xl border border-cyan-300/40 bg-cyan-500/10 p-3 text-sm text-cyan-100">{runError}</p> : null}<CasesPanel result={result} /><AttemptHistory attempts={activeAttempts} /></div> : null}
              </aside>
            ) : null}
          </section>
        )}
      </section>
    </main>
  );
}

function ProblemDetails({ challenge, attempts, helpUsed }: { challenge: Challenge; attempts: number; helpUsed: number }) {
  const problem = challenge.problem;
  if (!problem) {
    return <div className="terminal-card rounded-2xl p-4"><p className="text-xs uppercase tracking-[0.25em] text-cyan-200">Problem statement</p><p className="mt-3 text-base leading-7 text-slate-100">{challenge.brief}</p></div>;
  }
  return <div className="space-y-4">
    <div className="terminal-card rounded-2xl p-4">
      <p className="text-xs uppercase tracking-[0.25em] text-cyan-200">Problem statement</p>
      <h3 className="mt-2 text-xl font-black">{challenge.title}</h3>
      <p className="mt-3 text-base leading-7 text-slate-100">{problem.statement}</p>
      <p className="mt-3 rounded-xl border border-purple-300/20 bg-purple-300/10 p-3 text-sm leading-6 text-purple-50">{problem.gamifiedStatement}</p>
    </div>
    <div className="grid gap-3 sm:grid-cols-2">
      <Metric label="Runtime" value="Python 3 · CPython" />
      <Metric label="Attempts" value={`${attempts}`} />
      <Metric label="Help used" value={`${helpUsed} hints`} />
      <Metric label="Goal" value={challenge.isBoss ? "final solve" : "learning quest"} />
    </div>
    <div className="grid gap-3 lg:grid-cols-2">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4"><h4 className="font-bold text-cyan-100">Inputs</h4><ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-300">{problem.inputs.map((item) => <li key={item}>{item}</li>)}</ul></div>
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4"><h4 className="font-bold text-cyan-100">Output</h4><p className="mt-2 text-sm text-slate-300">{problem.output}</p></div>
    </div>
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4"><h4 className="font-bold text-cyan-100">Guarantees</h4><ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-300">{problem.guarantees.map((item) => <li key={item}>{item}</li>)}</ul></div>
    <div className="grid gap-3 lg:grid-cols-2">{problem.examples.map((example, index) => <div key={`${example.input}-${index}`} className="rounded-2xl border border-yellow-300/20 bg-yellow-300/5 p-4"><h4 className="font-bold text-yellow-100">Example {index + 1}</h4><pre className="mt-2 whitespace-pre-wrap rounded-xl bg-slate-950 p-3 text-xs text-slate-100">Input: {example.input}{"\n"}Output: {example.output}</pre><p className="mt-2 text-sm text-slate-300">{example.explanation}</p></div>)}</div>
  </div>;
}

const SIGN_IN_FOR_HELP = "Sign in to open hints and solutions.";
function percent(share: number) { return `${Math.round(share * 100)}%`; }

function HintsPanel({ opened, total, signedIn, xpShare, onReveal }: { opened: string[]; total: number; signedIn: boolean; xpShare: number; onReveal: () => void }) {
  const remaining = total - opened.length;
  return <div className="rounded-2xl border border-amber-300/20 bg-amber-300/5 p-4 text-sm text-amber-50">
    <h3 className="font-bold">Hints</h3>
    <p className="mt-2">Opened {opened.length} of {total}. {xpShare < 1 ? `A clear after opening any hint earns ${percent(xpShare)} of the quest XP.` : "Hints do not reduce the quest XP."}</p>
    {opened.length ? <ol className="mt-3 list-decimal space-y-2 pl-5 leading-6">{opened.map((text, index) => <li key={index}>{text}</li>)}</ol> : null}
    {total === 0 ? <p className="mt-3">No hints for this quest yet.</p> : !signedIn ? <p className="mt-3 text-amber-200">{SIGN_IN_FOR_HELP}</p> : remaining > 0 ? <button className="control mt-4" onClick={onReveal}>{opened.length ? "Reveal another hint" : "Reveal a hint"}</button> : <p className="mt-3 text-amber-200">All hints are open.</p>}
  </div>;
}

function SolutionGate({ solution, signedIn, xpShare, confirming, onAskConfirm, onCancel, onReveal }: { solution: string | undefined; signedIn: boolean; xpShare: number; confirming: boolean; onAskConfirm: () => void; onCancel: () => void; onReveal: () => void }) {
  if (solution !== undefined) return <div className="rounded-2xl border border-amber-300/20 bg-amber-300/5 p-4"><h3 className="font-bold text-amber-100">Solution revealed — solution-assisted</h3><pre className="mt-3 max-h-[28rem] overflow-auto whitespace-pre-wrap rounded-xl bg-slate-950 p-3 font-mono text-xs text-amber-50">{solution}</pre></div>;
  if (!signedIn) return <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300"><h3 className="font-bold text-amber-100">Solution is hidden</h3><p className="mt-2">{SIGN_IN_FOR_HELP}</p></div>;
  if (confirming) return <div className="rounded-2xl border border-amber-300/30 bg-amber-300/10 p-4 text-sm text-amber-50"><h3 className="font-bold">Reveal solution?</h3><p className="mt-2 leading-6">This will show the reference solution and mark future clears as solution-assisted, which earns {percent(xpShare)} of the quest XP. Use it only if you want to study the answer.</p><div className="mt-4 flex flex-wrap gap-2"><button className="control" onClick={onCancel}>Cancel</button><button className="rounded-xl bg-amber-300 px-4 py-2 font-bold text-slate-950" onClick={onReveal}>Reveal solution</button></div></div>;
  return <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300"><h3 className="font-bold text-amber-100">Solution is hidden</h3><p className="mt-2">Opening this tab does not reveal the answer. Confirm first if you want to view it.</p><button className="control mt-4" onClick={onAskConfirm}>I want to view the solution</button></div>;
}

function StatusPill({ label, tone }: { label: string; tone: "cyan" | "gold" | "green" | "purple" | "pink" | "muted" }) {
  const tones = {
    cyan: "border-cyan-300/40 bg-cyan-300/10 text-cyan-100",
    gold: "border-yellow-300/40 bg-yellow-300/10 text-yellow-100",
    green: "border-emerald-300/40 bg-emerald-300/10 text-emerald-100",
    purple: "border-purple-300/40 bg-purple-300/10 text-purple-100",
    pink: "border-pink-300/40 bg-pink-300/10 text-pink-100",
    muted: "border-slate-500/40 bg-slate-500/10 text-slate-300"
  };
  return <span className={`status-label rounded-xl border px-2 py-1 ${tones[tone]}`}>{label}</span>;
}

type ReviewItem = { pack: Pack; record: ReviewRecord; isDue: boolean; isSnoozed: boolean };
function RewardPanel({ rewards, onSpend }: { rewards: RewardWallet; onSpend: () => void }) {
  return <aside className="rounded-3xl border border-yellow-300/20 bg-yellow-950/20 p-4"><h2 className="text-xl font-bold">Rewards</h2><p className="text-sm text-slate-400">XP tracks effort. Shards come from boss clears only.</p><div className="mt-3 grid grid-cols-2 gap-2"><Metric label="XP" value={`${rewards.xp}`} /><Metric label="Shards" value={`${rewards.shards}`} /></div><button className="control mt-3" onClick={onSpend}>Spend 1 Shard: unlock cosmetic shop preview</button><p className="mt-2 text-xs text-yellow-100">{rewards.shopPreviewUnlocked ? "Shop preview unlocked." : "Shop preview locked."}</p><div className="mt-3 max-h-36 space-y-2 overflow-auto text-xs">{rewards.grants.length ? rewards.grants.map((grant) => <div key={grant.id} className="rounded-xl bg-white/5 p-2">+{grant.xp} XP · +{grant.shards} Shards · {grant.reason}</div>) : <p className="text-slate-400">Reward grant events appear after first-time quest or boss clears.</p>}</div></aside>;
}


function StatBar({ stat }: { stat: StatBarData }) {
  return <div className="mt-4 rounded-2xl border border-cyan-300/20 bg-cyan-500/10 p-3"><div className="mb-2 flex items-center justify-between text-sm"><b>Stat bar</b><span>{stat.label}</span></div><div className="h-3 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-cyan-300" style={{ width: `${stat.percent}%` }} /></div><p className="mt-2 text-xs text-cyan-100">{stat.detail}</p></div>;
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-2xl border border-white/10 bg-white/5 p-3"><p className="text-[0.65rem] uppercase tracking-[0.2em] text-slate-500">{label}</p><p className="mt-1 truncate font-bold text-cyan-100">{value}</p></div>; }
function OutcomeBadge({ status, passed }: { status: Status; passed: boolean }) { const copy = OUTCOME_COPY[status]; return <div className={`rounded-2xl border px-4 py-3 ${copy.tone}`}><p className="text-sm font-bold">{passed ? "Victory replay ready" : copy.title}</p></div>; }
function PlaybackControls(props: { cursor: number; total: number; playing: boolean; speed: number; onBack: () => void; onStep: () => void; onSkipStart: () => void; onSkipEnd: () => void; onToggle: () => void; onSpeed: () => void }) { return <div className="flex flex-wrap items-center gap-2 text-sm"><button className="control" onClick={props.onSkipStart}>⏮</button><button className="control" onClick={props.onBack}>Back</button><button className="control bg-cyan-300 text-slate-950" onClick={props.onToggle}>{props.playing ? "Pause" : "Play"}</button><button className="control" onClick={props.onStep}>Step</button><button className="control" onClick={props.onSkipEnd}>⏭</button><button className="control" onClick={props.onSpeed}>{props.speed}×</button><span className="min-w-24 text-slate-400">{props.total ? props.cursor + 1 : 0}/{props.total}</span></div>; }

function SceneRenderer(props: { replay: ReplayCase | null; activeReadIndex?: number; vars: Record<string, unknown>; mode: string }) {
  if (props.replay?.input.structure === "linked_list") return <LinkedListScene replay={props.replay} vars={props.vars} />;
  if (props.replay && props.replay.input.values.length === 0) return <CallScene replay={props.replay} />;
  return <ArrayScene {...props} />;
}
/** Replay header for challenges whose inputs are plain values rather than a list to draw. */
function CallScene({ replay }: { replay: ReplayCase }) {
  return <div className="rounded-3xl border border-cyan-300/20 bg-gradient-to-b from-slate-900 to-slate-950 p-4">
    <h2 className="text-xl font-bold">Replayed call</h2>
    <p className="mt-2 font-mono text-sm text-cyan-100">{formatCaseArguments(replay)}</p>
    <p className="mt-2 text-sm text-slate-300">expected <span className="font-mono text-emerald-200">{formatValue(replay.expected)}</span> · returned <span className={`font-mono ${replay.passed ? "text-emerald-200" : "text-rose-200"}`}>{formatValue(replay.actual)}</span></p>
    <p className="mt-2 text-xs text-slate-400">Step through the line trace and variables below to follow this call.</p>
  </div>;
}
function LinkedListScene({ replay, vars }: { replay: ReplayCase | null; vars: Record<string, unknown> }) { const values = replay?.input.values ?? []; return <div className="rounded-3xl border border-purple-300/20 bg-gradient-to-b from-slate-900 to-slate-950 p-4"><div className="mb-3 flex items-center justify-between"><h2 className="text-xl font-bold">Linked-list pointer scene</h2><p className="text-sm text-slate-400">pointer movement / relinking visible</p></div><div className="flex flex-wrap items-center gap-3">{values.map((value, index) => <div key={`${index}-${value}`} className="flex items-center gap-3"><div className="relative rounded-full border border-purple-200/50 bg-purple-300/15 px-4 py-3 text-center shadow-lg shadow-purple-950/40"><span className="block text-[0.65rem] text-purple-200">node {index}</span><b>{value}</b>{Object.values(vars).includes(index) ? <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded bg-yellow-300 px-1 text-[0.6rem] font-bold text-slate-950">ptr</span> : null}</div>{index < values.length - 1 ? <span className="text-purple-200">⟶ portal</span> : null}</div>)}</div><p className="mt-3 text-xs text-slate-400">Replay reads `.val` and `.next` through ListNode proxies so portal checks are counted and shown in the event stream.</p></div>; }
function ArrayScene({ replay, activeReadIndex, vars, mode }: { replay: ReplayCase | null; activeReadIndex?: number; vars: Record<string, unknown>; mode: string }) { const values = replay?.input.values ?? []; const target = replay?.input.target; const expected = replay?.input.expectedIndex; const large = mode === "skyline"; const shown = large ? values.slice(0, 80) : values; return <div className="rounded-3xl border border-cyan-300/20 bg-gradient-to-b from-slate-900 to-slate-950 p-4"><div className="mb-3 flex items-center justify-between"><h2 className="text-xl font-bold">Array scene: {large ? "skyline" : "doors"}</h2><p className="text-sm text-slate-400">target relic: <span className="text-cyan-200">{String(target ?? "?")}</span></p></div><div className={`grid gap-2 ${large ? "grid-cols-[repeat(40,minmax(0,1fr))]" : "grid-cols-7"}`}>{shown.map((value, index) => { const isRead = index === activeReadIndex; const isExpected = index === expected; const hasPointer = Object.values(vars).includes(index); return <div key={`${index}-${value}`} className={`relative flex items-end justify-center rounded-xl border text-xs transition-all ${large ? "h-28" : "h-20"} ${isRead ? "border-cyan-200 bg-cyan-300/30 shadow-lg shadow-cyan-300/30" : "border-white/10 bg-white/5"} ${isExpected ? "ring-2 ring-emerald-300" : ""}`}>{large ? <div className="w-full rounded-t-lg bg-cyan-400/50" style={{ height: `${Math.max(8, (Number(value) / Math.max(1, values.length)) * 100)}%` }} /> : <><span className="absolute top-2 text-[0.65rem] text-slate-500">#{index}</span><span className="pb-4 font-bold">{value}</span></>}{hasPointer ? <span className="absolute -top-3 rounded bg-yellow-300 px-1 text-[0.6rem] font-bold text-slate-950">var</span> : null}</div>; })}</div>{large && values.length > shown.length ? <p className="mt-2 text-xs text-slate-500">Showing first {shown.length} of {values.length} skyline bars to keep 3,000-step replays responsive.</p> : null}</div>; }
function CodeTrace({ code, activeLine }: { code: string; activeLine?: number }) { return <div className="rounded-2xl border border-white/10 bg-black/30 p-3"><h3 className="mb-2 font-bold">Line movement</h3><pre className="max-h-80 overflow-auto font-mono text-xs leading-6">{code.split("\n").map((line, index) => <div key={index} className={activeLine === index + 1 ? "rounded bg-cyan-300/20 text-cyan-100" : "text-slate-400"}><span className="mr-3 inline-block w-6 text-right text-slate-600">{index + 1}</span>{line || " "}</div>)}</pre></div>; }
function VarsPanel({ vars, event }: { vars: Record<string, unknown>; event?: TimelineEvent }) { return <div className="rounded-2xl border border-white/10 bg-black/30 p-3"><h3 className="font-bold">Variables + event</h3><pre className="mt-2 overflow-auto text-xs text-slate-300">{JSON.stringify({ vars, event }, null, 2)}</pre></div>; }
function CasesPanel({ result }: { result: RunResult | null }) {
  const cases = result?.cases ?? [];
  const passedCount = cases.filter((testCase) => testCase.passed).length;
  return <div className="rounded-2xl border border-white/10 bg-black/30 p-3" data-testid="cases-panel">
    <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-bold">Cases</h3>{result ? <span className={`text-xs ${result.passed ? "text-emerald-300" : "text-rose-300"}`}>{passedCount}/{cases.length} passed · {result.execution.mode ?? "run"} suite</span> : null}</div>
    <div className="mt-2 space-y-2 text-sm">
      {!result ? <p className="text-slate-500">Waiting for runner…</p> : cases.length === 0 ? <p className="text-slate-500">The runner returned no cases for this suite.</p> : cases.map((testCase) => (
        <div key={testCase.caseId} className="rounded-xl bg-white/5 px-3 py-2" data-testid="case-row">
          <div className="flex items-center justify-between gap-3"><span>{testCase.caseId === result.execution.replayCaseId ? "▶ " : ""}{testCase.caseId}</span><span className={testCase.passed ? "text-emerald-300" : "text-rose-300"}>{testCase.status}</span></div>
          {result.execution.mode === "submit" && testCase.caseId.startsWith("hidden-") ? <p className="mt-1 text-xs text-slate-400">Hidden case · inputs and expected value stay server-side</p> : <p className="mt-1 font-mono text-xs text-slate-400">{formatCaseArguments(testCase)} → expected {formatValue(testCase.expected)}{testCase.passed ? "" : ` · got ${formatValue(testCase.actual)}`}</p>}
          {testCase.error ? <p className="mt-1 text-xs text-rose-200">{testCase.error.message}{testCase.error.line ? ` (line ${testCase.error.line})` : ""}</p> : null}
        </div>
      ))}
    </div>
  </div>;
}
function AttemptHistory({ attempts }: { attempts: Attempt[] }) { return <div className="rounded-2xl border border-white/10 bg-black/30 p-3" data-testid="attempt-history"><h3 className="font-bold">Attempt history</h3><div className="mt-2 max-h-52 space-y-2 overflow-auto text-xs">{attempts.length ? attempts.map((attempt) => <div key={attempt.id} className="rounded-xl bg-white/5 p-2" data-testid="attempt-row"><b>{describeAttempt(attempt)}</b> · {formatTime(attempt.at)}<br />replay: {attempt.replayCaseId ?? "none"} · timeline: {attempt.timelinePointer}<br />{attempt.solutionAssisted ? "solution-assisted" : "unassisted"} · hints {attempt.hintCount}{attempt.message ? <><br /><span className="text-rose-200">{attempt.message}</span></> : null}</div>) : <p className="text-slate-500">No attempts yet. Run basic or Submit all to log one.</p>}</div></div>; }
function formatValue(value: unknown) { if (value === undefined) return "—"; try { return JSON.stringify(value); } catch { return String(value); } }
function formatCaseArguments(testCase: ReplayCase) {
  const args = testCase.arguments;
  if (args && Object.keys(args).length > 0) return Object.entries(args).map(([name, value]) => `${name}=${formatValue(value)}`).join(", ");
  const parts: string[] = [];
  if (testCase.input?.values?.length) parts.push(`${testCase.input.structure === "linked_list" ? "list" : "nums"}=${formatValue(testCase.input.values)}`);
  if (testCase.input?.target !== undefined && testCase.input?.target !== null) parts.push(`target=${formatValue(testCase.input.target)}`);
  return parts.length ? parts.join(", ") : "input";
}
function formatTime(value: string) { try { return new Date(value).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }); } catch { return value; } }

function isUnlocked(challenge: Challenge, progress: ProgressState) { return challenge.unlock.requiresQuestIds.every((id) => progress.cleared[id]); }
function collectVars(events: TimelineEvent[], cursor: number) { const vars: Record<string, unknown> = {}; for (let i = 0; i <= cursor && i < events.length; i += 1) Object.assign(vars, events[i].vars ?? {}); return vars; }
function lineNumbers(code: string) { return code.split("\n").map((_, index) => index + 1).join("\n"); }
function normalizeProgress(value: unknown): ProgressState {
  if (!value || typeof value !== "object") return EMPTY_PROGRESS;
  const raw = value as Partial<ProgressState>;
  return {
    ...EMPTY_PROGRESS,
    ...raw,
    cleared: raw.cleared && typeof raw.cleared === "object" ? raw.cleared : {},
    solutionOpened: raw.solutionOpened && typeof raw.solutionOpened === "object" ? raw.solutionOpened : {},
    hintsOpened: raw.hintsOpened && typeof raw.hintsOpened === "object" ? raw.hintsOpened : {},
    attempts: raw.attempts && typeof raw.attempts === "object" ? raw.attempts : {},
    savedCode: raw.savedCode && typeof raw.savedCode === "object" ? raw.savedCode : {},
    reviews: raw.reviews && typeof raw.reviews === "object" ? raw.reviews : {},
    rewards: { ...EMPTY_REWARDS, ...(raw.rewards ?? {}) },
    friendsEnabled: Boolean(raw.friendsEnabled)
  };
}
function safeLocalStorageGet(key: string) { try { return window.localStorage.getItem(key); } catch { return null; } }
function safeLocalStorageSet(key: string, value: string) { try { window.localStorage.setItem(key, value); } catch {} }
function safeLocalStorageRemove(key: string) { try { window.localStorage.removeItem(key); } catch {} }
function buildReviewItems(progress: ProgressState): ReviewItem[] {
  const now = Date.now();
  return Object.values(progress.reviews).map((record) => {
    const pack: Pack | undefined = PACK_BY_SLUG[record.packSlug];
    const snoozedUntil = record.snoozedUntil ? new Date(record.snoozedUntil).getTime() : 0;
    return { pack, record, isDue: new Date(record.nextDueAt).getTime() <= now, isSnoozed: snoozedUntil > now };
  }).filter((item): item is ReviewItem => item.pack !== undefined);
}
type TopicStat = { topic: string; defeated: number; attempts: number; hints: number; solutions: number; streak: number; rating: number };
function buildTopicStats(progress: ProgressState): TopicStat[] {
  const byTopic: Record<string, TopicStat> = {};
  for (const pack of PACKS) {
    const topic = pack.concepts[0] ?? pack.title;
    byTopic[topic] ??= { topic, defeated: 0, attempts: 0, hints: 0, solutions: 0, streak: 0, rating: 1000 };
    if (progress.cleared[pack.boss.id]) byTopic[topic].defeated += 1;
    const review = progress.reviews[pack.slug];
    if (review) { byTopic[topic].streak += review.streak; byTopic[topic].rating = Math.max(byTopic[topic].rating, review.rating); }
  }
  for (const attempts of Object.values(progress.attempts)) for (const attempt of attempts) {
    const challenge = CHALLENGE_BY_ID[attempt.challengeId];
    const topic = challenge?.packConcepts[0] ?? "mixed";
    byTopic[topic] ??= { topic, defeated: 0, attempts: 0, hints: 0, solutions: 0, streak: 0, rating: 1000 };
    byTopic[topic].attempts += 1;
    byTopic[topic].hints += attempt.hintCount;
    if (attempt.solutionAssisted) byTopic[topic].solutions += 1;
  }
  return Object.values(byTopic);
}


type StatBarData = { label: string; percent: number; detail: string };
function buildStatBar(progress: ProgressState): StatBarData {
  const totalBosses = PACKS.length;
  const defeated = PACKS.filter((pack) => progress.cleared[pack.boss.id]).length;
  const percent = Math.round((defeated / Math.max(1, totalBosses)) * 100);
  return { label: `${defeated}/${totalBosses} bosses defeated`, percent, detail: `${progress.rewards.xp} XP · ${progress.rewards.shards} Shards · ${Object.values(progress.attempts).flat().length} attempts logged` };
}
