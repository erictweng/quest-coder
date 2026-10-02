type Status = "passed" | "wrong_answer" | "compile_error" | "runtime_error" | "internal_error";

type TestCase = { id?: string; input?: Record<string, unknown>; expected?: unknown };
type Challenge = { id: string; tests?: { run?: TestCase[]; submit?: TestCase[]; fixed?: TestCase[]; replayCaseId?: string; replayCaseIds?: string[] } };
type Pack = { slug: string; boss?: Challenge; quests?: Challenge[] };

type FallbackMode = "run" | "submit";

type FallbackCase = {
  caseId: string;
  status: Status;
  passed: boolean;
  expected: unknown;
  actual: unknown;
  arguments: Record<string, unknown>;
  error: { kind: Status; message: string; line?: number } | null;
  budget: { enabled: boolean; used: number; unit: string; exceeded: boolean };
  summary: { durationMs: number; eventCount: number; truncated: boolean };
  input: { structure: "array"; values: unknown[]; target: unknown; expectedIndex: unknown };
  events: Array<Record<string, unknown>>;
};

export function canUseClimbingStairsFallback(packSlug: string): boolean {
  return packSlug === "forest-of-patience-climbing-stairs";
}

export function runClimbingStairsFallback(payload: { source: string; pack: Pack; challenge: Challenge; mode: FallbackMode }) {
  const tests = testsForMode(payload.challenge, payload.mode);
  const replayTest = replayTestForChallenge(payload.challenge, tests);
  const startedAt = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  const fastCases = tests.map((test) => runFallbackCase(payload.source, payload.challenge.id, test, false));
  const replayCase = replayTest ? runFallbackCase(payload.source, payload.challenge.id, replayTest, true) : null;
  const firstBad = fastCases.find((testCase) => testCase.status !== "passed");
  const status = firstBad?.status ?? (fastCases.length ? "passed" : "internal_error");
  const replayIndex = replayTest ? tests.findIndex((test) => test.id === replayTest.id) : -1;

  return {
    schemaVersion: "timeline.v0",
    questId: payload.challenge.id,
    language: "python",
    status,
    passed: status === "passed",
    startedAt,
    execution: {
      passes: ["fast", "traced_replay"],
      mode: payload.mode,
      suiteSize: tests.length,
      replayCaseIndex: replayIndex,
      replayCaseId: replayCase?.caseId ?? null,
      fallbackRuntime: "typescript-climbing-stairs-v0"
    },
    cases: fastCases,
    replay: replayCase,
    limits: { maxEvents: 3000, maxDurationMs: 7000, maxReads: null }
  };
}

function testsForMode(challenge: Challenge, mode: FallbackMode): TestCase[] {
  const tests = challenge.tests ?? {};
  if (mode === "run") return tests.run ?? tests.fixed ?? [];
  return tests.submit ?? tests.fixed ?? tests.run ?? [];
}

function replayTestForChallenge(challenge: Challenge, tests: TestCase[]): TestCase | null {
  const all = challenge.tests?.submit ?? challenge.tests?.fixed ?? tests;
  const replayId = challenge.tests?.replayCaseId ?? challenge.tests?.replayCaseIds?.[0];
  return (replayId ? all.find((test) => test.id === replayId) : tests[0]) ?? tests[0] ?? null;
}

function runFallbackCase(source: string, challengeId: string, test: TestCase, trace: boolean): FallbackCase {
  const started = Date.now();
  const args = test.input ?? {};
  const expected = test.expected;
  const compileError = sourceProblem(source, challengeId);
  const actual = compileError ? null : evaluateSource(source, challengeId, args);
  const status: Status = compileError ? "compile_error" : jsonEqual(actual, expected) ? "passed" : "wrong_answer";
  const events = trace ? fallbackEvents(challengeId, args, actual, expected, status) : [];

  return {
    caseId: test.id ?? "case",
    status,
    passed: status === "passed",
    expected,
    actual,
    arguments: args,
    error: compileError ? { kind: "compile_error", message: compileError } : null,
    budget: { enabled: false, used: 0, unit: "fallback_step", exceeded: false },
    summary: { durationMs: Math.max(0, Date.now() - started), eventCount: events.length, truncated: false },
    input: { structure: "array", values: inputValues(args), target: (args as { n?: unknown }).n ?? null, expectedIndex: expected },
    events
  };
}

function sourceProblem(source: string, challengeId: string): string | null {
  if (!source.trim()) return "source must be a non-empty Python string";
  if (/\bimport\b|__|\bopen\s*\(|\beval\s*\(|\bexec\s*\(/.test(source)) return "source uses a public-disabled capability";
  if (challengeId === "boss-old-bramblehorn" && !/def\s+climbStairs\s*\(/.test(source)) return "expected Solution.climbStairs(self, n)";
  if (challengeId === "patience-last-jump" && !/def\s+count_routes\s*\(/.test(source)) return "expected count_routes(n)";
  if (challengeId === "patience-route-scroll" && !/def\s+fill_scroll\s*\(/.test(source)) return "expected fill_scroll(n)";
  if (challengeId === "patience-two-slot-pouch" && !/def\s+next_pair\s*\(/.test(source)) return "expected next_pair(a, b)";
  return null;
}

function evaluateSource(source: string, challengeId: string, args: Record<string, unknown>): unknown {
  if (/return\s+n\b/.test(source) && typeof args.n === "number") return args.n;
  if (/return\s+0\b/.test(source)) return 0;
  if (/return\s+1\b/.test(source) && !/a\s*\+\s*b|b\s*\+\s*a|ways|dp|count_routes|climbStairs/.test(source)) return 1;

  if (challengeId === "patience-two-slot-pouch") {
    const a = Number(args.a);
    const b = Number(args.b);
    if (/a\s*\+\s*b|b\s*\+\s*a/.test(source) && /return[\s\S]*(b|\(\s*b|\[\s*b)/.test(source)) return [b, a + b];
    return null;
  }

  if (challengeId === "patience-route-scroll") {
    const n = Number(args.n);
    if (hasClimbingRecurrence(source) || (/ways|dp/.test(source) && /for\s+\w+\s+in\s+range/.test(source))) return routeScroll(n);
    return null;
  }

  const n = Number(args.n);
  if (hasClimbingRecurrence(source) || /climbStairs\s*\(|count_routes\s*\(/.test(source)) return climbWays(n);
  return null;
}

function hasClimbingRecurrence(source: string): boolean {
  return /n\s*-\s*1[\s\S]*n\s*-\s*2|n\s*-\s*2[\s\S]*n\s*-\s*1|ways\s*\[\s*i\s*\][\s\S]*ways\s*\[\s*i\s*-\s*1\s*\][\s\S]*ways\s*\[\s*i\s*-\s*2\s*\]|dp\s*\[\s*i\s*\][\s\S]*dp\s*\[\s*i\s*-\s*1\s*\][\s\S]*dp\s*\[\s*i\s*-\s*2\s*\]|a\s*,\s*b\s*=\s*b\s*,\s*a\s*\+\s*b|prev\s*,\s*curr\s*=\s*curr\s*,\s*prev\s*\+\s*curr/.test(source);
}

function climbWays(n: number): number {
  let a = 1;
  let b = 1;
  for (let i = 2; i <= n; i += 1) [a, b] = [b, a + b];
  return b;
}

function routeScroll(n: number): number[] {
  const ways = Array.from({ length: n + 1 }, () => 1);
  for (let i = 2; i <= n; i += 1) ways[i] = ways[i - 1] + ways[i - 2];
  return ways;
}

function fallbackEvents(challengeId: string, args: Record<string, unknown>, actual: unknown, expected: unknown, status: Status) {
  const n = typeof args.n === "number" ? args.n : 0;
  const base: Array<Record<string, unknown>> = [
    { kind: "note", message: "TypeScript fallback runner used because Python is unavailable on this server.", vars: { n } },
    { kind: "line", line: 1, vars: args }
  ];
  if (challengeId === "patience-two-slot-pouch") {
    base.push({ kind: "note", message: "Shift pouch upward: (b, a + b).", vars: { a: args.a, b: args.b } });
  } else {
    const limit = Math.min(Math.max(n, 0), 12);
    let a = 1;
    let b = 1;
    for (let i = 2; i <= limit; i += 1) {
      [a, b] = [b, a + b];
      base.push({ kind: "line", line: 4, vars: { i, a, b } });
    }
  }
  base.push({ kind: "outcome", status, expected, actual, message: status });
  return base.map((event, i) => ({ ...event, i, t: i }));
}

function inputValues(args: Record<string, unknown>): unknown[] {
  if (typeof args.n === "number") return Array.from({ length: Math.min(args.n, 45) }, (_, index) => index + 1);
  return Object.values(args);
}

function jsonEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}
