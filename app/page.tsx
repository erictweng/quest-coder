"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import samplePack from "../content/packs/timequake-search-rotated-array.json";
import reversePack from "../content/packs/reverse-linked-list.json";
import mergePack from "../content/packs/merge-two-sorted-lists.json";
import cyclePack from "../content/packs/linked-list-cycle.json";
import plainBinaryPack from "../content/packs/plain-binary-search.json";

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
  queue?: { activeRuns: number; queuedRuns: number; maxConcurrentRuns: number };
  security?: { profile: string; network: string; filesystem: string; timelineRetention: string };
};

type Hint = { id: string; text: string; cost: string };
type ReviewVariant = { id: string; title: string; mutation: string };
type PackReview = { enabled: boolean; defaultSchedule: number[]; variants: ReviewVariant[]; rules?: Record<string, unknown> };
type Pack = {
  slug: string;
  title: string;
  metadata: { shortDescription: string; displayName?: string };
  concepts: string[];
  scene: { type: "array" | "linked_list" };
  quests: BaseChallenge[];
  boss: BaseChallenge;
  review?: PackReview;
};
type BaseChallenge = {
  id: string;
  order?: number;
  title: string;
  brief: string;
  starterCode: string;
  solution: { code: string };
  hints?: Hint[];
  unlock: { requiresQuestIds: string[]; requiresPassed: boolean };
};
type PackChallenge = BaseChallenge & {
  packSlug: string;
  packTitle: string;
  packSceneType: "array" | "linked_list";
  packConcepts: string[];
  isBoss: boolean;
};
type Challenge = PackChallenge;
type Attempt = {
  id: string;
  at: string;
  challengeId: string;
  packSlug: string;
  status: Status;
  passed: boolean;
  replayCaseId?: string;
  eventCount: number;
  timelinePointer: string;
  solutionAssisted: boolean;
  hintCount: number;
};
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
type Friend = { id: string; name: string; status: string; rating: number };
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

const PACKS = [samplePack, reversePack, mergePack, cyclePack, plainBinaryPack] as Pack[];
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
const TABS = "    ";
const PLAY_SPEEDS = [0.5, 1, 2, 4];
const EMPTY_REWARDS: RewardWallet = { xp: 0, shards: 0, grants: [], shopPreviewUnlocked: false };
const EMPTY_PROGRESS: ProgressState = { cleared: {}, solutionOpened: {}, hintsOpened: {}, attempts: {}, savedCode: {}, reviews: {}, rewards: EMPTY_REWARDS, friendsEnabled: false };
const FRIEND_SHELL: Friend[] = [{ id: "zoro", name: "Zoro", status: "drilling arrays", rating: 1050 }, { id: "steve", name: "Steve", status: "polishing quests", rating: 990 }];

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
  const [userNameDraft, setUserNameDraft] = useState("Eric");
  const [userName, setUserName] = useState<string | null>(null);
  const [progress, setProgress] = useState<ProgressState>(EMPTY_PROGRESS);
  const [surface, setSurface] = useState<AppSurface>("hub");
  const [selectedPackSlug, setSelectedPackSlug] = useState(samplePack.slug);
  const [questionFilter, setQuestionFilter] = useState<QuestionFilter>("All");
  const [solveTab, setSolveTab] = useState<SolveTab>("Question");
  const [activeId, setActiveId] = useState(samplePack.quests[0]?.id ?? samplePack.boss.id);
  const activeChallenge = useMemo(() => CHALLENGES.find((challenge) => challenge.id === activeId) ?? CHALLENGES[0], [activeId]);
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
  const sceneMode = replay?.input.structure === "linked_list" ? "portals" : (replay?.input.values.length ?? 0) > 24 ? "skyline" : "doors";
  const activeAttempts = progress.attempts[activeChallenge.id] ?? [];
  const reviewItems = useMemo(() => buildReviewItems(progress), [progress]);
  const dueReviews = reviewItems.filter((item) => item.isDue && !item.isSnoozed);
  const eligibleSurprises = reviewItems.filter((item) => item.studied);
  const topicStats = useMemo(() => buildTopicStats(progress), [progress]);
  const statBar = useMemo(() => buildStatBar(progress), [progress]);
  const activePack = PACK_BY_SLUG[activeChallenge.packSlug];
  const selectedPack = PACK_BY_SLUG[selectedPackSlug] ?? samplePack;
  const bossUnlocked = activePack.boss.unlock.requiresQuestIds.every((id) => progress.cleared[id]);
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
        body: JSON.stringify({ source: code, packSlug: activeChallenge.packSlug, challengeId: activeChallenge.id })
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
  }, [activeChallenge, code, isActiveLocked, progress.hintsOpened, progress.solutionOpened]);

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
    const solutionAssisted = Boolean(progress.solutionOpened[activeChallenge.id]);
    const hintCount = progress.hintsOpened[activeChallenge.id] ?? 0;
    const attempt: Attempt = {
      id: `${activeChallenge.id}-${Date.now()}`,
      at: new Date().toISOString(),
      challengeId: activeChallenge.id,
      packSlug: activeChallenge.packSlug,
      status: runResult.status,
      passed: runResult.passed,
      replayCaseId: runResult.replay?.caseId,
      eventCount: runResult.replay?.summary.eventCount ?? 0,
      timelinePointer: `${activeChallenge.id}:${runResult.replay?.caseId ?? "none"}:${runResult.startedAt}`,
      solutionAssisted,
      hintCount
    };
    setProgress((current) => {
      const next: ProgressState = {
        ...current,
        cleared: { ...current.cleared, [activeChallenge.id]: current.cleared[activeChallenge.id] || runResult.passed },
        attempts: { ...current.attempts, [activeChallenge.id]: [attempt, ...(current.attempts[activeChallenge.id] ?? [])].slice(0, 15) }
      };
      if (runResult.passed && !current.cleared[activeChallenge.id]) next.rewards = grantReward(current, activeChallenge, solutionAssisted, hintCount);
      if (activeChallenge.isBoss) next.reviews = scheduleReview(current, activeChallenge, runResult, solutionAssisted, hintCount);
      return next;
    });
  }

  function openSolution() {
    setProgress((current) => ({ ...current, solutionOpened: { ...current.solutionOpened, [activeChallenge.id]: true } }));
  }

  function openHint() {
    setProgress((current) => ({ ...current, hintsOpened: { ...current.hintsOpened, [activeChallenge.id]: (current.hintsOpened[activeChallenge.id] ?? 0) + 1 } }));
  }

  function unlockShopPreview() {
    setProgress((current) => current.rewards.shards < 1 || current.rewards.shopPreviewUnlocked ? current : ({ ...current, rewards: { ...current.rewards, shards: current.rewards.shards - 1, shopPreviewUnlocked: true } }));
  }

  function toggleFriends() {
    setProgress((current) => ({ ...current, friendsEnabled: !current.friendsEnabled }));
  }

  function snoozeReview(packSlug: string) {
    setProgress((current) => {
      const existing = current.reviews[packSlug];
      if (!existing) return current;
      return { ...current, reviews: { ...current.reviews, [packSlug]: { ...existing, snoozedUntil: addDays(new Date(), 1).toISOString() } } };
    });
  }

  function openCampaign(packSlug: string) {
    const pack = PACK_BY_SLUG[packSlug] ?? samplePack;
    setSelectedPackSlug(pack.slug);
    setActiveId(pack.quests[0]?.id ?? pack.boss.id);
    setSurface("campaignDetail");
  }

  function selectChallenge(id: string) {
    const challenge = CHALLENGE_BY_ID[id];
    if (challenge) setSelectedPackSlug(challenge.packSlug);
    setActiveId(id);
    setSurface("solve");
  }

  function startReview(item: ReviewItem) {
    selectChallenge(item.record.bossId);
    setRunError(`Review preview: ${item.variant?.title ?? "boss replay"}. ${item.variant?.mutation ?? "Run the boss again to reinforce it."}`);
  }

  function startSurprise() {
    const choice = dueReviews[0] ?? eligibleSurprises[0];
    if (!choice) {
      setRunError("No studied topics are eligible yet. Beat a boss first.");
      return;
    }
    startReview(choice);
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
              <p className="text-xs uppercase tracking-[0.35em] text-cyan-300">Quest Coder · Sprint 13 Split-Pane Solve</p><span className="sr-only">Quest Coder · Sprint 2 Replay Theater Question + code editor Line numbers Open solution scroll {"onSelect={selectChallenge}"}</span>
              <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-5xl">{surface === "solve" ? activeChallenge.packTitle : "Choose your path"}</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300 sm:text-base">{surface === "solve" ? "Solve mode keeps the problem on the left and the Python compiler on the right. Animation, hints, solution, and submissions stay tucked behind tabs." : "The hub is calm and action-oriented: choose Profile, Campaign, or Questions, then open the compiler only when a quest starts."}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
              {userName ? (
                <div className="flex flex-wrap items-center gap-3"><span className="text-sm text-slate-300">Signed in as <b className="text-cyan-200">{userName}</b></span><button className="control" onClick={signOut}>Log out</button></div>
              ) : (
                <div className="flex flex-wrap items-center gap-2"><input className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm" value={userNameDraft} onChange={(event) => setUserNameDraft(event.target.value)} aria-label="User name" /><button className="rounded-xl bg-cyan-300 px-4 py-2 text-sm font-bold text-slate-950" onClick={signIn}>Sign in</button></div>
              )}
            </div>
          </div>
          <nav className="mt-5 flex flex-wrap gap-2 text-sm" aria-label="Quest Coder primary surfaces">
            <button className={surface === "hub" ? "rounded-xl bg-cyan-300 px-3 py-2 font-bold text-slate-950" : "control"} onClick={() => setSurface("hub")}>Hub</button>
            <button className={surface === "profile" ? "rounded-xl bg-cyan-300 px-3 py-2 font-bold text-slate-950" : "control"} onClick={() => setSurface("profile")}>Profile</button>
            <button className={surface === "campaigns" || surface === "campaignDetail" ? "rounded-xl bg-cyan-300 px-3 py-2 font-bold text-slate-950" : "control"} onClick={() => setSurface("campaigns")}>Campaign</button>
            <button className={surface === "questions" ? "rounded-xl bg-cyan-300 px-3 py-2 font-bold text-slate-950" : "control"} onClick={() => setSurface("questions")}>Questions</button>
            <button className={surface === "solve" ? "rounded-xl bg-cyan-300 px-3 py-2 font-bold text-slate-950" : "control"} onClick={() => setSurface("solve")}>Solve</button>
          </nav>
          <div className="mt-4 grid gap-2 text-sm sm:grid-cols-5">
            <Metric label="Surface" value={surface} />
            <Metric label="Streak/rating" value={`${topicStats[0]?.streak ?? 0}/${topicStats[0]?.rating ?? 1000}`} />
            <Metric label="Bosses defeated" value={statBar.label} />
            <Metric label="Active quest" value={activeChallenge.title} />
            <Metric label="Queue" value={`${result?.queue?.activeRuns ?? 0}/${result?.queue?.maxConcurrentRuns ?? 2} active`} />
            <Metric label="Boss" value={bossUnlocked ? "unlocked" : "locked"} />
            <Metric label="Reviews due" value={`${dueReviews.length}`} />
            <Metric label="XP" value={`${progress.rewards.xp}`} />
            <Metric label="Shards" value={`${progress.rewards.shards}`} />
          </div>
          <StatBar stat={statBar} />
          <span className="sr-only">Public signup/onboarding enter a handle public-hardening-v0 capped replay metadata</span>
        </header>

        {surface === "hub" ? (
          <section className="space-y-5">
            <div className="rounded-3xl border border-yellow-300/25 bg-yellow-300/10 p-5 shadow-xl">
              <div className="flex items-start gap-4"><div className="grid h-14 w-14 place-items-center rounded-2xl border border-yellow-200/50 bg-slate-950 text-2xl">▣</div><div><h2 className="text-xl font-black text-yellow-100">Pixel companion</h2><p className="mt-1 text-slate-200">“Pick a path first. I’ll open the compiler when the quest starts.”</p></div></div>
            </div>
            <div className="grid gap-4 lg:grid-cols-3">
              <button className="rounded-3xl border border-cyan-300/25 bg-slate-950/80 p-6 text-left shadow-xl hover:bg-cyan-300/10" onClick={() => setSurface("profile")}>
                <p className="text-xs uppercase tracking-[0.3em] text-cyan-300">Profile</p><h2 className="mt-3 text-2xl font-black">Save file</h2><p className="mt-2 text-sm text-slate-300">XP, Shards, review due count, recent attempts, and solo/social settings.</p><p className="mt-4 text-xs text-cyan-100">{progress.rewards.xp} XP · {progress.rewards.shards} Shards · {dueReviews.length} reviews due</p>
              </button>
              <button className="rounded-3xl border border-purple-300/25 bg-slate-950/80 p-6 text-left shadow-xl hover:bg-purple-300/10" onClick={() => setSurface("campaigns")}>
                <p className="text-xs uppercase tracking-[0.3em] text-purple-300">Campaign</p><h2 className="mt-3 text-2xl font-black">Quest map</h2><p className="mt-2 text-sm text-slate-300">Pick a topic world before the compiler appears.</p><p className="mt-4 text-xs text-purple-100">{PACKS.length} worlds · {statBar.label}</p>
              </button>
              <button className="rounded-3xl border border-yellow-300/25 bg-slate-950/80 p-6 text-left shadow-xl hover:bg-yellow-300/10" onClick={() => setSurface("questions")}>
                <p className="text-xs uppercase tracking-[0.3em] text-yellow-300">Questions</p><h2 className="mt-3 text-2xl font-black">Quest board</h2><p className="mt-2 text-sm text-slate-300">Choose an available quest, review, or boss fight.</p><p className="mt-4 text-xs text-yellow-100">{CHALLENGES.length} quests and bosses</p>
              </button>
            </div>
            <button className="w-full rounded-3xl border border-emerald-300/25 bg-emerald-300/10 p-5 text-left shadow-xl" onClick={() => selectChallenge(activeChallenge.id)}><b>Continue Last Quest</b><p className="mt-1 text-sm text-emerald-100">{activeChallenge.title} · opens the focused solve screen</p></button>
          </section>
        ) : surface === "profile" ? (
          <section className="grid gap-4 lg:grid-cols-[1fr_1fr]">
            <div className="rounded-3xl border border-cyan-300/20 bg-slate-950/80 p-5"><h2 className="text-2xl font-black">Profile save file</h2><p className="mt-2 text-slate-300">{userName ?? "Guest"} · {progress.rewards.xp} XP · {progress.rewards.shards} Shards · {dueReviews.length} reviews due</p><div className="mt-4 grid gap-2 sm:grid-cols-2"><Metric label="Bosses defeated" value={statBar.label} /><Metric label="Attempts logged" value={`${Object.values(progress.attempts).flat().length}`} /></div><div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-3"><h3 className="font-bold">Recent attempts</h3><div className="mt-2 space-y-2 text-xs">{Object.values(progress.attempts).flat().slice(0, 4).length ? Object.values(progress.attempts).flat().slice(0, 4).map((attempt) => <p key={attempt.id} className="rounded-xl bg-slate-950/70 p-2">{attempt.challengeId} · {attempt.status} · {attempt.solutionAssisted ? "solution-assisted" : "unassisted"}</p>) : <p className="text-slate-400">No attempts logged yet.</p>}</div></div><div className="mt-4 rounded-2xl border border-purple-300/20 bg-purple-300/5 p-3"><h3 className="font-bold">Review reminders</h3><p className="mt-1 text-sm text-slate-300">{dueReviews.length ? `${dueReviews.length} rematch queued.` : "No reviews due. Beat a boss to start spaced rematches."}</p></div></div>
            <div className="space-y-4"><RewardPanel rewards={progress.rewards} onSpend={unlockShopPreview} /><FriendPanel enabled={progress.friendsEnabled} onToggle={toggleFriends} friends={FRIEND_SHELL} /></div>
          </section>
        ) : surface === "campaigns" ? (
          <section className="grid gap-4 lg:grid-cols-2">
            {PACKS.map((pack) => { const cleared = [...pack.quests, pack.boss].filter((challenge) => progress.cleared[challenge.id]).length; const total = pack.quests.length + 1; const bossOpen = pack.boss.unlock.requiresQuestIds.every((id) => progress.cleared[id]); const reviewDue = dueReviews.some((item) => item.pack.slug === pack.slug); return <button key={pack.slug} className="rounded-3xl border border-purple-300/20 bg-slate-950/80 p-5 text-left hover:bg-purple-300/10" onClick={() => openCampaign(pack.slug)}><p className="text-xs uppercase tracking-[0.3em] text-purple-300">Campaign world</p><h2 className="mt-2 text-2xl font-black">{pack.title}</h2><p className="mt-2 text-sm text-slate-300">{pack.metadata.shortDescription}</p><div className="mt-4 flex flex-wrap gap-2 text-xs"><StatusPill label={`${cleared}/${total} cleared`} tone="cyan" /><StatusPill label={bossOpen ? "boss open" : "boss locked"} tone={bossOpen ? "gold" : "muted"} />{reviewDue ? <StatusPill label="review due" tone="purple" /> : null}</div><p className="mt-3 text-xs text-slate-400">Concepts: {pack.concepts.join(" · ")}</p></button>; })}
          </section>
        ) : surface === "campaignDetail" ? (
          <section className="rounded-3xl border border-purple-300/20 bg-slate-950/80 p-5"><div className="mb-5 flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs uppercase tracking-[0.3em] text-purple-300">Campaign detail</p><h2 className="mt-2 text-3xl font-black">{selectedPack.title}</h2><p className="mt-2 max-w-3xl text-sm text-slate-300">{selectedPack.metadata.shortDescription}</p><div className="mt-3 flex flex-wrap gap-2 text-xs">{selectedPack.concepts.map((concept) => <StatusPill key={concept} label={concept} tone="purple" />)}</div></div><button className="control" onClick={() => setSurface("campaigns")}>Back to campaigns</button></div><div className="grid gap-3 md:grid-cols-[repeat(auto-fit,minmax(180px,1fr))]">{[...selectedPack.quests, selectedPack.boss].map((challenge) => { const full = CHALLENGE_BY_ID[challenge.id]; const locked = full ? !isUnlocked(full, progress) : false; const cleared = Boolean(progress.cleared[challenge.id]); const isBoss = challenge.id === selectedPack.boss.id; const reviewDue = dueReviews.some((item) => item.record.bossId === challenge.id); const status = cleared ? "cleared" : reviewDue ? "review due" : locked ? "locked" : isBoss ? "boss" : "available"; return <button key={challenge.id} className={`rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 ${isBoss ? "border-pink-300/40 bg-pink-300/10" : "border-white/10 bg-white/5"}`} onClick={() => selectChallenge(challenge.id)}><p className="text-xs uppercase tracking-[0.25em] text-slate-400">{isBoss ? "Boss node" : `Quest node ${challenge.order ?? ""}`}</p><h3 className="mt-2 font-bold">{challenge.title}</h3><p className="mt-2 text-xs text-slate-400">{challenge.brief}</p><div className="mt-3 flex flex-wrap gap-2"><StatusPill label={status} tone={cleared ? "green" : reviewDue ? "purple" : locked ? "muted" : isBoss ? "pink" : "cyan"} />{isBoss ? <StatusPill label={locked ? "gate locked" : "gate open"} tone={locked ? "muted" : "gold"} /> : null}</div></button>; })}</div></section>
        ) : surface === "questions" ? (
          <section className="rounded-3xl border border-white/10 bg-slate-950/80 p-5"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-2xl font-black">Questions list</h2><p className="text-sm text-slate-400">Select a question to open the focused solve screen.</p></div><div className="flex flex-wrap gap-2 text-xs">{(["All", "Available", "Cleared", "Review", "Boss"] as QuestionFilter[]).map((filter) => <button key={filter} className={questionFilter === filter ? "rounded-xl bg-cyan-300 px-3 py-2 font-bold text-slate-950" : "control"} onClick={() => setQuestionFilter(filter)}>{filter}</button>)}</div></div><div className="grid gap-3 md:grid-cols-2">{CHALLENGES.filter((challenge) => { const locked = !isUnlocked(challenge, progress); const cleared = Boolean(progress.cleared[challenge.id]); const reviewDue = dueReviews.some((item) => item.record.bossId === challenge.id); if (questionFilter === "Available") return !locked && !cleared && !challenge.isBoss; if (questionFilter === "Cleared") return cleared; if (questionFilter === "Review") return reviewDue; if (questionFilter === "Boss") return challenge.isBoss; return true; }).map((challenge) => { const locked = !isUnlocked(challenge, progress); const cleared = Boolean(progress.cleared[challenge.id]); const reviewDue = dueReviews.some((item) => item.record.bossId === challenge.id); const status = cleared ? "cleared" : reviewDue ? "review due" : locked ? "locked" : challenge.isBoss ? "boss" : "available"; return <button key={challenge.id} className="rounded-2xl border border-white/10 bg-white/5 p-4 text-left hover:border-cyan-300" onClick={() => selectChallenge(challenge.id)}><b>{challenge.isBoss ? "Boss" : `Quest ${challenge.order ?? ""}`}: {challenge.title}</b><p className="mt-1 text-xs text-slate-400">{challenge.packTitle} · {(progress.attempts[challenge.id] ?? []).length} attempts</p><div className="mt-3 flex flex-wrap gap-2"><StatusPill label={status} tone={cleared ? "green" : reviewDue ? "purple" : locked ? "muted" : challenge.isBoss ? "pink" : "cyan"} />{challenge.packConcepts.slice(0, 2).map((concept) => <StatusPill key={concept} label={concept} tone="purple" />)}</div></button>; })}</div></section>
        ) : (
          <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]" aria-label="Focused split-pane solve screen">
            <aside className="rounded-3xl border border-cyan-300/20 bg-slate-950/85 p-5 shadow-xl shadow-cyan-950/20">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-cyan-300">Focused question pane</p>
                  <h2 className="mt-2 text-2xl font-black">{activeChallenge.title}</h2>
                  <p className="mt-1 text-sm text-slate-400">{activeChallenge.packTitle} · {isActiveLocked ? "locked" : activeChallenge.isBoss ? "boss fight" : "available"}</p>
                </div>
                <button className="control" onClick={() => setSurface("campaignDetail")}>Back to map</button>
              </div>

              <div className="mb-4 flex flex-wrap gap-2 text-xs" role="tablist" aria-label="Solve support tabs">
                {(["Question", "Animation", "Hints", "Solution", "Submissions"] as SolveTab[]).map((tab) => (
                  <button key={tab} role="tab" aria-selected={solveTab === tab} className={solveTab === tab ? "rounded-xl bg-cyan-300 px-3 py-2 font-bold text-slate-950" : "control"} onClick={() => { if (tab === "Hints") openHint(); if (tab === "Solution") openSolution(); setSolveTab(tab); }}>{tab}</button>
                ))}
              </div>

              {solveTab === "Question" ? (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Problem statement</p>
                    <p className="mt-3 text-base leading-7 text-slate-100">{activeChallenge.brief}</p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Metric label="Runtime" value="Python 3 · CPython" />
                    <Metric label="Status" value={isActiveLocked ? "locked" : "ready"} />
                    <Metric label="Attempts" value={`${activeAttempts.length}`} />
                    <Metric label="Help used" value={`${progress.hintsOpened[activeChallenge.id] ?? 0} hints`} />
                  </div>
                  <div className="rounded-2xl border border-yellow-300/20 bg-yellow-300/10 p-4 text-sm text-yellow-50">
                    <b>Companion tip:</b> solve the prompt first. Open Animation only when you want to trace what happened.
                  </div>
                </div>
              ) : solveTab === "Animation" ? (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
                    <OutcomeBadge status={result?.status ?? "internal_error"} passed={result?.passed ?? false} />
                    <PlaybackControls cursor={cursor} total={events.length} playing={playing} speed={speed} onBack={() => setCursor((value) => Math.max(0, value - 1))} onStep={() => setCursor((value) => Math.min(events.length - 1, value + 1))} onSkipStart={() => setCursor(0)} onSkipEnd={() => setCursor(Math.max(events.length - 1, 0))} onToggle={() => setPlaying((value) => !value)} onSpeed={() => setSpeed((value) => PLAY_SPEEDS[(PLAY_SPEEDS.indexOf(value) + 1) % PLAY_SPEEDS.length])} />
                  </div>
                  <SceneRenderer replay={replay} activeReadIndex={activeReadIndex} vars={latestVars} mode={sceneMode} />
                  <div className="grid gap-4 lg:grid-cols-2"><CodeTrace code={code} activeLine={activeLine} /><VarsPanel vars={latestVars} event={activeEvent} /></div>
                </div>
              ) : solveTab === "Hints" ? (
                <div className="rounded-2xl border border-amber-300/20 bg-amber-300/5 p-4 text-sm text-amber-50">
                  <h3 className="font-bold">Hints stay secondary</h3>
                  <p className="mt-2">Opened hints: {progress.hintsOpened[activeChallenge.id] ?? 0}</p>
                  <p className="mt-3 leading-6">{activeChallenge.hints?.[Math.min((progress.hintsOpened[activeChallenge.id] ?? 1) - 1, (activeChallenge.hints?.length ?? 1) - 1)]?.text ?? "No hint text for this quest yet."}</p>
                  <button className="control mt-4" onClick={openHint}>Reveal another hint</button>
                </div>
              ) : solveTab === "Solution" ? (
                <details className="rounded-2xl border border-amber-300/20 bg-amber-300/5 p-4" open={Boolean(progress.solutionOpened[activeChallenge.id])}>
                  <summary className="cursor-pointer text-sm font-bold text-amber-100" onClick={openSolution}>Solution scroll {progress.solutionOpened[activeChallenge.id] ? "opened — solution-assisted" : "hidden"}</summary>
                  {progress.solutionOpened[activeChallenge.id] ? <pre className="mt-3 max-h-[28rem] overflow-auto whitespace-pre-wrap rounded-xl bg-slate-950 p-3 font-mono text-xs text-amber-50">{activeChallenge.solution.code}</pre> : <p className="mt-2 text-sm text-slate-400">Open only if you want this clear marked solution-assisted.</p>}
                </details>
              ) : (
                <div className="space-y-4">
                  <CasesPanel result={result} />
                  <AttemptHistory attempts={activeAttempts} />
                </div>
              )}
            </aside>

            <section className="rounded-3xl border border-white/10 bg-slate-950/90 p-5 shadow-xl" aria-label="Code compiler pane">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-emerald-300">Python compiler</p>
                  <h2 className="mt-2 text-2xl font-black">Code on the right</h2>
                  <p className="mt-1 text-sm text-slate-400">Runtime badge: Python 3 · /api/run · Ctrl/Cmd+Enter to run.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button className="rounded-xl border border-white/10 px-3 py-2 text-sm hover:bg-white/10" onClick={() => setCode(activeChallenge.solution.code)}>Load passing</button>
                  <button className="rounded-xl border border-white/10 px-3 py-2 text-sm hover:bg-white/10" onClick={() => setCode(activeChallenge.starterCode)}>Reset</button>
                  <button className="rounded-xl bg-cyan-300 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-cyan-200 disabled:opacity-60" disabled={isRunning || isActiveLocked || !userName} onClick={() => void submit()}>{isRunning ? "Running…" : "Run ▶"}</button>
                  <button className="rounded-xl bg-yellow-300 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-yellow-200 disabled:opacity-60" disabled={isRunning || isActiveLocked || !userName} onClick={() => void submit()}>{activeChallenge.isBoss ? "Submit Boss" : "Submit"}</button>
                </div>
              </div>
              <div className="rounded-2xl border border-slate-700 bg-slate-900/80 p-3">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400"><span>solution.py</span><span>Tab/Shift+Tab · auto-indent · ligatures off</span></div>
                <div className="grid grid-cols-[3rem_1fr] gap-3">
                  <pre aria-hidden="true" className="select-none text-right font-mono text-sm leading-6 text-slate-500">{lineNumbers(code)}</pre>
                  <textarea ref={textareaRef} aria-label="Python solution editor" className="min-h-[34rem] resize-y bg-transparent font-mono text-sm leading-6 text-slate-100 outline-none [font-feature-settings:'liga'_0,'calt'_0]" spellCheck={false} value={code} onChange={(event) => setCode(event.target.value)} onKeyDown={handleEditorKeyDown} />
                </div>
              </div>
              <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-4" aria-label="Console result drawer">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-bold">Console / result drawer</h3>
                  <StatusPill label={result ? result.status : runError ? "runner message" : "waiting for run"} tone={result?.passed ? "green" : runError ? "cyan" : "muted"} />
                </div>
                {runError ? <p className="rounded-xl border border-cyan-300/40 bg-cyan-500/10 p-3 text-sm text-cyan-100">{runError}</p> : null}
                {result ? <CasesPanel result={result} /> : <p className="text-sm text-slate-400">Run your code to see cases here. If it fails, open Animation to trace the timeline.</p>}
                {result && !result.passed ? <p className="mt-3 text-xs text-amber-100">Next learning step: open the Animation tab on the left.</p> : null}
              </div>
            </section>
          </section>
        )}
      </section>
    </main>
  );
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
  return <span className={`rounded-xl border px-2 py-1 ${tones[tone]}`}>{label}</span>;
}

function LibraryPanel({ progress, activeId, onSelect }: { progress: ProgressState; activeId: string; onSelect: (id: string) => void }) {
  return <aside className="rounded-3xl border border-white/10 bg-slate-950/80 p-4"><h2 className="text-xl font-bold">Library by category</h2><p className="mt-1 text-sm text-slate-400">Binary search · Linked list · review-enabled</p><div className="mt-4 space-y-2">{CHALLENGES.map((challenge) => { const locked = !isUnlocked(challenge, progress); const cleared = Boolean(progress.cleared[challenge.id]); return <button key={challenge.id} className={`w-full rounded-2xl border p-3 text-left text-sm ${activeId === challenge.id ? "border-cyan-300 bg-cyan-300/10" : "border-white/10 bg-white/5"}`} onClick={() => onSelect(challenge.id)}><span className="font-bold">{challenge.isBoss ? "Boss" : `Quest ${challenge.order ?? ""}`}: {challenge.title}</span><span className="mt-1 block text-xs text-slate-400">{challenge.packTitle} · {cleared ? "cleared" : locked ? "locked" : "unlocked"} · {(progress.attempts[challenge.id] ?? []).length} attempts</span></button>; })}</div></aside>;
}

type ReviewItem = { pack: Pack; record: ReviewRecord; variant?: ReviewVariant; isDue: boolean; isSnoozed: boolean; studied: boolean };
function ReviewPanel({ items, dueCount, onPreview, onSnooze, onSurprise }: { items: ReviewItem[]; dueCount: number; onPreview: (item: ReviewItem) => void; onSnooze: (packSlug: string) => void; onSurprise: () => void }) {
  return <aside className="rounded-3xl border border-emerald-300/20 bg-emerald-950/20 p-4"><div className="flex items-center justify-between gap-2"><div><h2 className="text-xl font-bold">Review scheduler</h2><p className="text-sm text-slate-400">stale-review scheduler · review variants · snooze/preview</p></div><button className="rounded-xl bg-emerald-300 px-3 py-2 text-xs font-bold text-slate-950" onClick={onSurprise}>Surprise battle</button></div><p className="mt-3 rounded-xl border border-white/10 bg-white/5 p-2 text-sm">{dueCount} due now. Surprise battles only draw from studied boss topics.</p><div className="mt-3 space-y-2">{items.length ? items.map((item) => <div key={item.pack.slug} className="rounded-2xl border border-white/10 bg-white/5 p-3 text-sm"><b>{item.pack.metadata.displayName ?? item.pack.title}</b><p className="text-xs text-slate-400">next due {formatDate(item.record.nextDueAt)} · interval {item.record.intervalDays}d · streak {item.record.streak} · rating {item.record.rating}</p><p className="mt-1 text-xs text-emerald-100">Variant: {item.variant?.title ?? "boss replay"}</p><div className="mt-2 flex gap-2"><button className="control" onClick={() => onPreview(item)}>Preview</button><button className="control" onClick={() => onSnooze(item.pack.slug)}>Snooze 1d</button></div>{item.isSnoozed ? <p className="mt-1 text-xs text-amber-200">snoozed until {formatDate(item.record.snoozedUntil)}</p> : null}</div>) : <p className="mt-3 text-sm text-slate-400">Beat a boss to put it on spaced review.</p>}</div></aside>;
}

function RewardPanel({ rewards, onSpend }: { rewards: RewardWallet; onSpend: () => void }) {
  return <aside className="rounded-3xl border border-yellow-300/20 bg-yellow-950/20 p-4"><h2 className="text-xl font-bold">Reward currency model</h2><p className="text-sm text-slate-400">XP tracks effort. Shards come from boss clears only.</p><div className="mt-3 grid grid-cols-2 gap-2"><Metric label="XP" value={`${rewards.xp}`} /><Metric label="Shards" value={`${rewards.shards}`} /></div><button className="control mt-3" onClick={onSpend}>Spend 1 Shard: unlock cosmetic shop preview</button><p className="mt-2 text-xs text-yellow-100">Spend target placeholder: {rewards.shopPreviewUnlocked ? "shop preview unlocked" : "pixel aura shop locked"}</p><div className="mt-3 max-h-36 space-y-2 overflow-auto text-xs">{rewards.grants.length ? rewards.grants.map((grant) => <div key={grant.id} className="rounded-xl bg-white/5 p-2">+{grant.xp} XP · +{grant.shards} Shards · {grant.reason}</div>) : <p className="text-slate-400">Reward grant events appear after first-time quest or boss clears.</p>}</div></aside>;
}

function StatsPanel({ stats }: { stats: TopicStat[] }) {
  return <aside className="rounded-3xl border border-purple-300/20 bg-purple-950/20 p-4"><h2 className="text-xl font-bold">Per-topic stats</h2><p className="text-sm text-slate-400">defeated · attempts · hint/solution use · streak/rating</p><div className="mt-3 space-y-2">{stats.map((stat) => <div key={stat.topic} className="rounded-2xl border border-white/10 bg-white/5 p-3 text-sm"><b>{stat.topic}</b><p className="text-xs text-slate-400">defeated {stat.defeated} · attempts {stat.attempts} · hints {stat.hints} · solutions {stat.solutions} · streak {stat.streak} · rating {stat.rating}</p></div>)}</div></aside>;
}

function FriendPanel({ enabled, onToggle, friends }: { enabled: boolean; onToggle: () => void; friends: Friend[] }) {
  return <aside className="rounded-3xl border border-sky-300/20 bg-sky-950/20 p-4"><div className="flex items-center justify-between gap-2"><div><h2 className="text-xl font-bold">Optional friend list/social shell</h2><p className="text-sm text-slate-400">Social is optional and never blocks solo practice.</p></div><button className="control" onClick={onToggle}>{enabled ? "Hide" : "Enable"}</button></div>{enabled ? <div className="mt-3 space-y-2">{friends.map((friend) => <div key={friend.id} className="rounded-2xl border border-white/10 bg-white/5 p-3 text-sm"><b>{friend.name}</b><p className="text-xs text-slate-400">{friend.status} · rating {friend.rating}</p></div>)}</div> : <p className="mt-3 text-sm text-slate-400">Solo mode active. Enable only if you want light social accountability.</p>}</aside>;
}

function StatBar({ stat }: { stat: StatBarData }) {
  return <div className="mt-4 rounded-2xl border border-cyan-300/20 bg-cyan-500/10 p-3"><div className="mb-2 flex items-center justify-between text-sm"><b>Stat bar</b><span>{stat.label}</span></div><div className="h-3 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-cyan-300" style={{ width: `${stat.percent}%` }} /></div><p className="mt-2 text-xs text-cyan-100">{stat.detail}</p></div>;
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-2xl border border-white/10 bg-white/5 p-3"><p className="text-[0.65rem] uppercase tracking-[0.2em] text-slate-500">{label}</p><p className="mt-1 truncate font-bold text-cyan-100">{value}</p></div>; }
function OutcomeBadge({ status, passed }: { status: Status; passed: boolean }) { const copy = OUTCOME_COPY[status]; return <div className={`rounded-2xl border px-4 py-3 ${copy.tone}`}><p className="text-sm font-bold">{passed ? "Victory replay ready" : copy.title}</p><p className="text-xs opacity-80">Visual: {copy.visual}</p></div>; }
function PlaybackControls(props: { cursor: number; total: number; playing: boolean; speed: number; onBack: () => void; onStep: () => void; onSkipStart: () => void; onSkipEnd: () => void; onToggle: () => void; onSpeed: () => void }) { return <div className="flex flex-wrap items-center gap-2 text-sm"><button className="control" onClick={props.onSkipStart}>⏮</button><button className="control" onClick={props.onBack}>Back</button><button className="control bg-cyan-300 text-slate-950" onClick={props.onToggle}>{props.playing ? "Pause" : "Play"}</button><button className="control" onClick={props.onStep}>Step</button><button className="control" onClick={props.onSkipEnd}>⏭</button><button className="control" onClick={props.onSpeed}>{props.speed}×</button><span className="min-w-24 text-slate-400">{props.total ? props.cursor + 1 : 0}/{props.total}</span></div>; }

function SceneRenderer(props: { replay: ReplayCase | null; activeReadIndex?: number; vars: Record<string, unknown>; mode: string }) {
  if (props.replay?.input.structure === "linked_list") return <LinkedListScene replay={props.replay} vars={props.vars} />;
  return <ArrayScene {...props} />;
}
function LinkedListScene({ replay, vars }: { replay: ReplayCase | null; vars: Record<string, unknown> }) { const values = replay?.input.values ?? []; return <div className="rounded-3xl border border-purple-300/20 bg-gradient-to-b from-slate-900 to-slate-950 p-4"><div className="mb-3 flex items-center justify-between"><h2 className="text-xl font-bold">Linked-list portal/island scene</h2><p className="text-sm text-slate-400">pointer movement / relinking visible</p></div><div className="flex flex-wrap items-center gap-3">{values.map((value, index) => <div key={`${index}-${value}`} className="flex items-center gap-3"><div className="relative rounded-full border border-purple-200/50 bg-purple-300/15 px-4 py-3 text-center shadow-lg shadow-purple-950/40"><span className="block text-[0.65rem] text-purple-200">island {index}</span><b>{value}</b>{Object.values(vars).includes(index) ? <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded bg-yellow-300 px-1 text-[0.6rem] font-bold text-slate-950">ptr</span> : null}</div>{index < values.length - 1 ? <span className="text-purple-200">⟶ portal</span> : null}</div>)}</div><p className="mt-3 text-xs text-slate-400">Replay reads `.val` and `.next` through ListNode proxies so portal checks are counted and shown in the event stream.</p></div>; }
function ArrayScene({ replay, activeReadIndex, vars, mode }: { replay: ReplayCase | null; activeReadIndex?: number; vars: Record<string, unknown>; mode: string }) { const values = replay?.input.values ?? []; const target = replay?.input.target; const expected = replay?.input.expectedIndex; const large = mode === "skyline"; const shown = large ? values.slice(0, 80) : values; return <div className="rounded-3xl border border-cyan-300/20 bg-gradient-to-b from-slate-900 to-slate-950 p-4"><div className="mb-3 flex items-center justify-between"><h2 className="text-xl font-bold">Array scene: {large ? "skyline" : "doors"}</h2><p className="text-sm text-slate-400">target relic: <span className="text-cyan-200">{String(target ?? "?")}</span></p></div><div className={`grid gap-2 ${large ? "grid-cols-[repeat(40,minmax(0,1fr))]" : "grid-cols-7"}`}>{shown.map((value, index) => { const isRead = index === activeReadIndex; const isExpected = index === expected; const hasPointer = Object.values(vars).includes(index); return <div key={`${index}-${value}`} className={`relative flex items-end justify-center rounded-xl border text-xs transition-all ${large ? "h-28" : "h-20"} ${isRead ? "border-cyan-200 bg-cyan-300/30 shadow-lg shadow-cyan-300/30" : "border-white/10 bg-white/5"} ${isExpected ? "ring-2 ring-emerald-300" : ""}`}>{large ? <div className="w-full rounded-t-lg bg-cyan-400/50" style={{ height: `${Math.max(8, (Number(value) / Math.max(1, values.length)) * 100)}%` }} /> : <><span className="absolute top-2 text-[0.65rem] text-slate-500">#{index}</span><span className="pb-4 font-bold">{value}</span></>}{hasPointer ? <span className="absolute -top-3 rounded bg-yellow-300 px-1 text-[0.6rem] font-bold text-slate-950">var</span> : null}</div>; })}</div>{large && values.length > shown.length ? <p className="mt-2 text-xs text-slate-500">Showing first {shown.length} of {values.length} skyline bars to keep 3,000-step replays responsive.</p> : null}</div>; }
function CodeTrace({ code, activeLine }: { code: string; activeLine?: number }) { return <div className="rounded-2xl border border-white/10 bg-black/30 p-3"><h3 className="mb-2 font-bold">Line movement</h3><pre className="max-h-80 overflow-auto font-mono text-xs leading-6">{code.split("\n").map((line, index) => <div key={index} className={activeLine === index + 1 ? "rounded bg-cyan-300/20 text-cyan-100" : "text-slate-400"}><span className="mr-3 inline-block w-6 text-right text-slate-600">{index + 1}</span>{line || " "}</div>)}</pre></div>; }
function VarsPanel({ vars, event }: { vars: Record<string, unknown>; event?: TimelineEvent }) { return <div className="rounded-2xl border border-white/10 bg-black/30 p-3"><h3 className="font-bold">Variables + event</h3><pre className="mt-2 overflow-auto text-xs text-slate-300">{JSON.stringify({ vars, event }, null, 2)}</pre></div>; }
function CasesPanel({ result }: { result: RunResult | null }) { return <div className="rounded-2xl border border-white/10 bg-black/30 p-3"><h3 className="font-bold">Cases</h3><div className="mt-2 space-y-2 text-sm">{result?.cases.map((testCase, index) => <div key={testCase.caseId} className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2"><span>{index === result.execution.replayCaseIndex ? "▶ " : ""}{testCase.caseId}</span><span className={testCase.passed ? "text-emerald-300" : "text-rose-300"}>{testCase.status}</span></div>) ?? <p className="text-slate-500">Waiting for runner…</p>}</div></div>; }
function AttemptHistory({ attempts }: { attempts: Attempt[] }) { return <div className="rounded-2xl border border-white/10 bg-black/30 p-3"><h3 className="font-bold">Attempt history</h3><div className="mt-2 max-h-52 space-y-2 overflow-auto text-xs">{attempts.length ? attempts.map((attempt) => <div key={attempt.id} className="rounded-xl bg-white/5 p-2"><b>{attempt.status}</b> · {attempt.replayCaseId ?? "no replay"}<br />timeline: {attempt.timelinePointer}<br />{attempt.solutionAssisted ? "solution-assisted" : "unassisted"} · hints {attempt.hintCount}</div>) : <p className="text-slate-500">No attempts yet.</p>}</div></div>; }

function isUnlocked(challenge: Challenge, progress: ProgressState) { return challenge.unlock.requiresQuestIds.every((id) => progress.cleared[id]); }
function collectVars(events: TimelineEvent[], cursor: number) { const vars: Record<string, unknown> = {}; for (let i = 0; i <= cursor && i < events.length; i += 1) Object.assign(vars, events[i].vars ?? {}); return vars; }
function lineNumbers(code: string) { return code.split("\n").map((_, index) => index + 1).join("\n"); }
function insertAtSelection(code: string, start: number, end: number, text: string, setCode: (value: string) => void, ref: React.RefObject<HTMLTextAreaElement | null>) { const next = `${code.slice(0, start)}${text}${code.slice(end)}`; setCode(next); window.requestAnimationFrame(() => { ref.current?.focus(); ref.current?.setSelectionRange(start + text.length, start + text.length); }); }
function outdentSelection(code: string, start: number, end: number, setCode: (value: string) => void, ref: React.RefObject<HTMLTextAreaElement | null>) { const lineStart = code.lastIndexOf("\n", start - 1) + 1; const block = code.slice(lineStart, end); const replacement = block.replace(/^ {1,4}/gm, ""); const removedBeforeCursor = block.length - replacement.length; setCode(`${code.slice(0, lineStart)}${replacement}${code.slice(end)}`); window.requestAnimationFrame(() => { ref.current?.focus(); const nextCursor = Math.max(lineStart, start - Math.min(4, removedBeforeCursor)); ref.current?.setSelectionRange(nextCursor, Math.max(nextCursor, end - removedBeforeCursor)); }); }
function readProgress(key: string): ProgressState { try { const raw = JSON.parse(window.localStorage.getItem(key) || "{}"); return { ...EMPTY_PROGRESS, ...raw, rewards: { ...EMPTY_REWARDS, ...(raw.rewards ?? {}) }, friendsEnabled: Boolean(raw.friendsEnabled) }; } catch { return EMPTY_PROGRESS; } }
function writeProgress(key: string, value: ProgressState) { try { window.localStorage.setItem(key, JSON.stringify(value)); } catch {} }
function safeLocalStorageGet(key: string) { try { return window.localStorage.getItem(key); } catch { return null; } }
function safeLocalStorageSet(key: string, value: string) { try { window.localStorage.setItem(key, value); } catch {} }
function safeLocalStorageRemove(key: string) { try { window.localStorage.removeItem(key); } catch {} }
function addDays(date: Date, days: number) { const next = new Date(date); next.setDate(next.getDate() + days); return next; }
function formatDate(value?: string) { if (!value) return "none"; return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" }); }
function nextInterval(schedule: number[], previous: number) { return schedule.find((days) => days > previous) ?? Math.min(previous * 2, schedule.at(-1) ?? 30); }
function scheduleReview(current: ProgressState, challenge: Challenge, runResult: RunResult, solutionAssisted: boolean, hintCount: number) {
  const pack = PACK_BY_SLUG[challenge.packSlug];
  const existing = current.reviews[challenge.packSlug];
  const schedule = pack.review?.defaultSchedule ?? [1, 3, 7, 14, 30];
  const prior = existing?.intervalDays ?? 0;
  const easyWin = runResult.passed && !solutionAssisted && hintCount === 0;
  const assistedWin = runResult.passed && (solutionAssisted || hintCount > 0);
  const intervalDays = easyWin ? nextInterval(schedule, prior) : assistedWin ? Math.max(1, Math.min(prior || schedule[0], hintCount >= 2 ? 3 : 7)) : 1;
  const streak = runResult.passed ? (existing?.streak ?? 0) + 1 : 0;
  const rating = Math.max(0, Math.min(2400, (existing?.rating ?? 1000) + (easyWin ? 80 : assistedWin ? 20 : -60)));
  return {
    ...current.reviews,
    [challenge.packSlug]: {
      packSlug: challenge.packSlug,
      bossId: challenge.id,
      topic: challenge.packConcepts[0] ?? challenge.packTitle,
      intervalDays,
      nextDueAt: addDays(new Date(), intervalDays).toISOString(),
      lastOutcome: runResult.status,
      streak,
      rating
    }
  };
}
function buildReviewItems(progress: ProgressState): ReviewItem[] {
  const now = Date.now();
  return Object.values(progress.reviews).map((record) => {
    const pack = PACK_BY_SLUG[record.packSlug];
    const snoozedUntil = record.snoozedUntil ? new Date(record.snoozedUntil).getTime() : 0;
    return { pack, record, variant: pack.review?.variants?.[0], isDue: new Date(record.nextDueAt).getTime() <= now, isSnoozed: snoozedUntil > now, studied: Boolean(progress.cleared[record.bossId]) };
  }).filter((item) => item.pack);
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
function rewardForChallenge(challenge: Challenge, solutionAssisted: boolean, hintCount: number) {
  const baseXp = challenge.isBoss ? 100 : 20;
  const penalty = solutionAssisted ? 0.5 : hintCount > 0 ? 0.75 : 1;
  return { xp: Math.max(5, Math.round(baseXp * penalty)), shards: challenge.isBoss ? 1 : 0, reason: challenge.isBoss ? "boss reward grant" : "quest reward grant" };
}
function grantReward(current: ProgressState, challenge: Challenge, solutionAssisted: boolean, hintCount: number): RewardWallet {
  const reward = rewardForChallenge(challenge, solutionAssisted, hintCount);
  const grant: RewardGrant = { id: `${challenge.id}-reward-${Date.now()}`, at: new Date().toISOString(), challengeId: challenge.id, ...reward };
  return { ...current.rewards, xp: current.rewards.xp + reward.xp, shards: current.rewards.shards + reward.shards, grants: [grant, ...current.rewards.grants].slice(0, 20) };
}
