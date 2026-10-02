"use client";

export type ResultStatus = "passed" | "wrong_answer" | "compile_error" | "runtime_error" | "over_budget" | "loop_guard" | "off_end_read" | "internal_error";

type ResultLike = {
  status: ResultStatus;
  passed: boolean;
  execution: { mode?: "run" | "submit" };
  cases: Array<{ passed: boolean; status: ResultStatus; error?: { message: string; line?: number } | null }>;
};

const GUIDANCE: Record<ResultStatus, string> = {
  passed: "",
  compile_error: "Fix the highlighted Python syntax or function signature, then run again.",
  runtime_error: "Inspect the error and line number, then trace the failing input.",
  wrong_answer: "Compare the first failing result with the expected behavior and trace one small input.",
  over_budget: "The answer is correct on values but uses too many tracked operations. Reduce repeated work.",
  loop_guard: "The program did not terminate. Check loop updates and recursive base cases.",
  off_end_read: "A list index moved outside the valid range. Recheck your loop boundaries.",
  internal_error: "The runner could not grade this attempt. Retry shortly or check service health."
};

export function ResultSummary({ result, onHint }: { result: ResultLike; onHint: () => void }) {
  if (result.passed) return null;
  const failed = result.cases.find((item) => !item.passed);
  const status = failed?.status ?? result.status;
  return <div className="mb-3 rounded-xl border border-rose-300/35 bg-rose-400/10 p-3 text-sm text-rose-50" role="alert" data-testid="result-summary">
    <div className="flex flex-wrap items-center justify-between gap-2"><b>{result.execution.mode === "submit" ? "Submit did not clear the quest" : "Basic checks need another pass"}</b><span className="text-xs uppercase tracking-wider text-rose-200">{status}</span></div>
    <p className="mt-2">{GUIDANCE[status]}</p>
    {failed?.error?.message ? <p className="mt-2 font-mono text-xs">{failed.error.message}{failed.error.line ? ` · line ${failed.error.line}` : ""}</p> : null}
    <button className="control mt-3" onClick={onHint}>Open a hint</button>
  </div>;
}
