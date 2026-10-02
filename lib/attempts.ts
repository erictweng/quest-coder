/**
 * Pure helpers for recording submission attempts.
 *
 * The page component used to build attempt records inline inside a React state
 * updater, which made the behaviour impossible to test without a browser and
 * meant runner-bridge failures left no trace in the history at all. These
 * helpers describe exactly what gets stored for every Run basic / Submit all.
 */

export type AttemptStatus =
  | "passed"
  | "wrong_answer"
  | "compile_error"
  | "runtime_error"
  | "over_budget"
  | "loop_guard"
  | "off_end_read"
  | "internal_error";

export type AttemptMode = "run" | "submit";

export type AttemptRecord = {
  id: string;
  at: string;
  challengeId: string;
  packSlug: string;
  mode: AttemptMode;
  status: AttemptStatus;
  passed: boolean;
  passedCases: number;
  totalCases: number;
  replayCaseId?: string;
  eventCount: number;
  timelinePointer: string;
  solutionAssisted: boolean;
  hintCount: number;
  message?: string;
};

export type AttemptSource = {
  status: AttemptStatus;
  passed: boolean;
  startedAt?: string;
  cases?: Array<{ passed: boolean }>;
  replay?: { caseId: string; summary: { eventCount: number } } | null;
};

export type AttemptContext = {
  challengeId: string;
  packSlug: string;
  mode: AttemptMode;
  solutionAssisted: boolean;
  hintCount: number;
  now?: Date;
};

export const MAX_ATTEMPTS_PER_CHALLENGE = 15;

/** Builds the attempt stored after the runner returned a result. */
export function attemptFromResult(result: AttemptSource, context: AttemptContext): AttemptRecord {
  const now = context.now ?? new Date();
  const cases = result.cases ?? [];
  return {
    id: `${context.challengeId}-${now.getTime()}`,
    at: now.toISOString(),
    challengeId: context.challengeId,
    packSlug: context.packSlug,
    mode: context.mode,
    status: result.status,
    passed: result.passed,
    passedCases: cases.filter((testCase) => testCase.passed).length,
    totalCases: cases.length,
    replayCaseId: result.replay?.caseId,
    eventCount: result.replay?.summary.eventCount ?? 0,
    timelinePointer: `${context.challengeId}:${result.replay?.caseId ?? "none"}:${result.startedAt ?? now.toISOString()}`,
    solutionAssisted: context.solutionAssisted,
    hintCount: context.hintCount
  };
}

/** Builds the attempt stored when the runner bridge itself failed (no cases executed). */
export function attemptFromFailure(message: string, context: AttemptContext): AttemptRecord {
  const now = context.now ?? new Date();
  return {
    id: `${context.challengeId}-${now.getTime()}`,
    at: now.toISOString(),
    challengeId: context.challengeId,
    packSlug: context.packSlug,
    mode: context.mode,
    status: "internal_error",
    passed: false,
    passedCases: 0,
    totalCases: 0,
    eventCount: 0,
    timelinePointer: `${context.challengeId}:none:${now.toISOString()}`,
    solutionAssisted: context.solutionAssisted,
    hintCount: context.hintCount,
    message
  };
}

/** Prepends the attempt to the per-challenge history, newest first, capped. */
export function appendAttempt(history: Record<string, AttemptRecord[]>, attempt: AttemptRecord): Record<string, AttemptRecord[]> {
  const existing = history[attempt.challengeId] ?? [];
  return { ...history, [attempt.challengeId]: [attempt, ...existing].slice(0, MAX_ATTEMPTS_PER_CHALLENGE) };
}

/** Short, human-readable label for an attempt row. */
export function describeAttempt(attempt: AttemptRecord): string {
  const suite = attempt.mode === "submit" ? "Submit all" : "Run basic";
  const cases = attempt.totalCases > 0 ? `${attempt.passedCases}/${attempt.totalCases} cases` : attempt.message ? "runner unavailable" : "no case data";
  return `${suite} · ${attempt.status} · ${cases}`;
}
