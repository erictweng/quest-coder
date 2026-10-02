#!/usr/bin/env node
// Regression smoke for the run/submit bug fixes:
//   1. /api/run could not find Python (`spawn python3 ENOENT`) -> command resolution + fallback.
//   2. Console / result drawer showed no test cases            -> case rows carry renderable data.
//   3. Submission history stayed empty                        -> attempts are built for results and failures.
//   4. Poor Python auto-indent in the editor                  -> pure editing helpers.
// Requires Node >= 22.18 (built-in TypeScript type stripping) so the lib/*.ts helpers can be imported directly.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const page = readFileSync(`${root}/app/page.tsx`, "utf8");
const route = readFileSync(`${root}/app/api/run/route.ts`, "utf8");
const pack = JSON.parse(readFileSync(`${root}/content/packs/forest-of-patience-climbing-stairs.json`, "utf8"));

function assert(condition, message) { if (!condition) throw new Error(message); }
async function milestone(name, fn) { await fn(); console.log(`ok - ${name}`); }
async function loadTs(relativePath) {
  try {
    return await import(pathToFileURL(`${root}/${relativePath}`).href);
  } catch (error) {
    throw new Error(`Could not import ${relativePath} (Node ${process.version}). Node >= 22.18 with type stripping is required: ${error.message}`);
  }
}

const runtime = await loadTs("lib/python-runtime.ts");
const editing = await loadTs("lib/python-editing.ts");
const attempts = await loadTs("lib/attempts.ts");

const WRONG_SOLUTION = "class Solution:\n    def climbStairs(self, n: int) -> int:\n        return n\n";

function runCli(python, source, mode) {
  const child = spawnSync(python.command, [...runtime.pythonArgsPrefix(python.command), "runner/quest_runner_cli.py"], {
    cwd: root,
    encoding: "utf8",
    env: runtime.withPythonSearchPath(process.env),
    input: JSON.stringify({ source, packPath: `content/packs/${pack.slug}.json`, challengeId: pack.boss.id, mode }),
    maxBuffer: 20 * 1024 * 1024
  });
  assert(child.status === 0, `${mode} runner failed\nSTDOUT:\n${child.stdout}\nSTDERR:\n${child.stderr}`);
  return JSON.parse(child.stdout);
}

let python;

await milestone("Python runner command resolution prefers the env override and falls back through candidates", async () => {
  const okOnly = (command) => (candidate) => (candidate === command ? { ok: true, version: "3.12.0" } : { ok: false, error: "ENOENT" });
  const fallback = runtime.resolvePythonCommand({ PATH: "/nowhere" }, okOnly("/usr/local/bin/python3"));
  assert(fallback.command === "/usr/local/bin/python3" && fallback.source === "candidate", `fallback resolution wrong: ${JSON.stringify(fallback)}`);

  const override = runtime.resolvePythonCommand({ PATH: "/nowhere", QUEST_CODER_PYTHON: "/custom/python3" }, okOnly("/custom/python3"));
  assert(override.command === "/custom/python3" && override.source === "env", `env override not preferred: ${JSON.stringify(override)}`);

  const order = runtime.candidatePythonCommands({ QUEST_CODER_PYTHON: "/custom/python3" }).map((item) => item.command);
  assert(order[0] === "/custom/python3" && order.includes("python3") && order.includes("/usr/bin/python3"), `candidate order wrong: ${order.join(",")}`);

  let thrown = null;
  try { runtime.resolvePythonCommand({ PATH: "/nowhere" }, () => ({ ok: false, error: "ENOENT" })); } catch (error) { thrown = error; }
  assert(thrown && thrown.message.includes("QUEST_CODER_PYTHON") && thrown.message.includes("python3 (ENOENT)"), `missing-python error not actionable: ${thrown?.message}`);

  const rejectsPython2 = runtime.resolvePythonCommand({ PATH: "/nowhere" }, (candidate) => (candidate === "python" ? { ok: true, version: "2.7.18" } : candidate === "/usr/bin/python3" ? { ok: true, version: "3.9.6" } : { ok: false, error: "ENOENT" }));
  assert(rejectsPython2.command === "/usr/bin/python3" && rejectsPython2.version === "3.9.6", `resolver must skip Python 2: ${JSON.stringify(rejectsPython2)}`);

  const searchPath = runtime.withPythonSearchPath({ PATH: "/nowhere" }).PATH.split(":");
  for (const dir of ["/nowhere", "/usr/bin", "/usr/local/bin", "/opt/homebrew/bin"]) assert(searchPath.includes(dir), `search PATH missing ${dir}`);
  assert(runtime.pythonArgsPrefix("py").join(" ") === "-3" && runtime.pythonArgsPrefix("python3").length === 0, "py launcher prefix wrong");
});

await milestone("Real Python resolves even when the server PATH is empty (the ENOENT scenario)", async () => {
  python = runtime.resolvePythonCommand({ PATH: "/nonexistent-dir" });
  assert(python.version.startsWith("3."), `expected Python 3, got ${python.version}`);
  const probe = runtime.probePythonCommand("definitely-not-a-python-binary", process.env);
  assert(probe.ok === false && probe.error === "ENOENT", `probe should report ENOENT for a missing binary: ${JSON.stringify(probe)}`);
  console.log(`   using ${python.command} ${python.version} (${python.source})`);
});

await milestone("/api/run spawns through the resolver instead of a hard-coded python3", async () => {
  assert(!route.includes('spawn("python3"'), "route still hard-codes spawn(\"python3\")");
  for (const token of ["getPythonCommand(", "invalidatePythonCommand()", "pythonArgsPrefix(", "withPythonSearchPath(", "isSpawnNotFound(error)", "PYTHON_ENV_VAR", 'export const runtime = "nodejs"']) {
    assert(route.includes(token), `route missing ${token}`);
  }
});

let runResult;
let submitResult;
await milestone("Run basic and Submit all return case rows the drawer can render", async () => {
  runResult = runCli(python, pack.boss.solution.code, "run");
  submitResult = runCli(python, pack.boss.solution.code, "submit");
  const wrong = runCli(python, WRONG_SOLUTION, "submit");
  assert(runResult.cases.length === pack.boss.tests.run.length, "run suite size mismatch");
  assert(submitResult.cases.length === pack.boss.tests.submit.length, "submit suite size mismatch");
  for (const result of [runResult, submitResult, wrong]) {
    assert(Array.isArray(result.cases) && result.cases.length > 0, "cases missing");
    for (const testCase of result.cases) {
      for (const field of ["caseId", "status", "passed", "expected", "actual", "arguments", "input"]) assert(field in testCase, `case ${testCase.caseId} missing ${field}`);
      assert(typeof testCase.arguments === "object" && "n" in testCase.arguments, `case ${testCase.caseId} should expose n in arguments`);
    }
  }
  assert(runResult.passed && submitResult.passed, "reference solution should pass both suites");
  assert(!wrong.passed && wrong.cases.some((testCase) => testCase.status === "wrong_answer" && testCase.actual !== testCase.expected), "wrong solution should surface wrong_answer rows with actual values");
});

await milestone("Console / result drawer renders case rows for every result", async () => {
  const solveBranch = page.slice(page.indexOf("one-question-workspace"), page.indexOf("function StatusPill"));
  assert(solveBranch.includes("{result ? <CasesPanel result={result} />"), "drawer should render CasesPanel whenever a result exists");
  const casesPanel = page.slice(page.indexOf("function CasesPanel"), page.indexOf("function AttemptHistory"));
  for (const token of ['data-testid="case-row"', "formatCaseArguments(testCase)", "formatValue(testCase.expected)", "formatValue(testCase.actual)", "testCase.error.message", "passed ·", "returned no cases"]) {
    assert(casesPanel.includes(token), `CasesPanel missing ${token}`);
  }
  assert(!casesPanel.includes("Waiting for runner…</p>}</div></div>; }"), "old single-line CasesPanel still present");
});

await milestone("Attempt history records run, submit, and runner-bridge failures", async () => {
  const now = new Date("2026-10-01T12:00:00.000Z");
  const context = { challengeId: pack.boss.id, packSlug: pack.slug, mode: "run", solutionAssisted: false, hintCount: 1, now };
  const runAttempt = attempts.attemptFromResult(runResult, context);
  assert(runAttempt.mode === "run" && runAttempt.status === "passed" && runAttempt.passed, "run attempt status wrong");
  assert(runAttempt.totalCases === pack.boss.tests.run.length && runAttempt.passedCases === runAttempt.totalCases, "run attempt case counts wrong");
  assert(runAttempt.replayCaseId === pack.boss.tests.replayCaseId, "run attempt should point at the configured replay case");
  assert(runAttempt.timelinePointer.startsWith(`${pack.boss.id}:${pack.boss.tests.replayCaseId}:`), "timeline pointer malformed");

  const submitAttempt = attempts.attemptFromResult(submitResult, { ...context, mode: "submit" });
  assert(submitAttempt.mode === "submit" && submitAttempt.totalCases === pack.boss.tests.submit.length, "submit attempt should record the full suite");
  assert(attempts.describeAttempt(submitAttempt) === `Submit all · passed · ${submitAttempt.totalCases}/${submitAttempt.totalCases} cases`, `describeAttempt wrong: ${attempts.describeAttempt(submitAttempt)}`);

  const failure = attempts.attemptFromFailure("spawn python3 ENOENT", { ...context, mode: "submit" });
  assert(failure.status === "internal_error" && failure.passed === false && failure.message === "spawn python3 ENOENT" && failure.totalCases === 0, "bridge failure attempt wrong");
  assert(attempts.describeAttempt(failure).includes("runner unavailable"), "failure attempt should explain the runner was unavailable");

  let history = {};
  history = attempts.appendAttempt(history, runAttempt);
  history = attempts.appendAttempt(history, failure);
  assert(history[pack.boss.id].length === 2 && history[pack.boss.id][0] === failure, "history should be newest first");
  for (let i = 0; i < 20; i += 1) history = attempts.appendAttempt(history, { ...runAttempt, id: `${runAttempt.id}-${i}` });
  assert(history[pack.boss.id].length === attempts.MAX_ATTEMPTS_PER_CHALLENGE, "history should be capped");

  for (const token of ["recordAttempt(runResult, attemptFromResult(runResult, context))", "recordAttempt(null, attemptFromFailure(message, context))", "attempts: appendAttempt(current.attempts, attempt)", 'data-testid="attempt-row"', "describeAttempt(attempt)", "Submissions ({activeAttempts.length})"]) {
    assert(page.includes(token), `page missing attempt wiring ${token}`);
  }
});

await milestone("Editor Enter auto-indents after ':' and keeps existing indentation", async () => {
  const { enterEdit, INDENT } = editing;
  const simple = enterEdit("def f(n):", 9, 9);
  assert(simple.value === `def f(n):\n${INDENT}` && simple.selectionStart === simple.value.length, `simple colon indent wrong: ${JSON.stringify(simple)}`);

  const nested = enterEdit("    if n < 2:", 13, 13);
  assert(nested.value === `    if n < 2:\n${INDENT}${INDENT}`, `nested colon indent wrong: ${JSON.stringify(nested.value)}`);

  const plain = enterEdit("    x = 1", 9, 9);
  assert(plain.value === "    x = 1\n    ", "plain line should preserve indentation");

  const comment = enterEdit("x = 1  # note:", 14, 14);
  assert(comment.value === "x = 1  # note:\n", "colon inside a comment must not indent");

  const string = enterEdit('print("a:")', 11, 11);
  assert(string.value === 'print("a:")\n', "colon inside a string must not indent");

  const code = "def f(n):\n    if n:\n        return 1";
  const afterReturn = enterEdit(code, code.length, code.length);
  assert(afterReturn.value === `${code}\n    `, `return should dedent one level: ${JSON.stringify(afterReturn.value)}`);

  const brackets = enterEdit("x = []", 5, 5);
  assert(brackets.value === "x = [\n    \n]" && brackets.selectionStart === 10, `bracket pair should expand: ${JSON.stringify(brackets)}`);

  const midLine = enterEdit("    foo bar", 7, 7);
  assert(midLine.value === "    foo\n     bar" || midLine.value === "    foo\n    bar", `mid-line enter should carry indentation: ${JSON.stringify(midLine.value)}`);

  const replaced = enterEdit("if a:XYZ", 5, 8);
  assert(replaced.value === "if a:\n    ", "enter with a selection should replace it");
});

await milestone("Editor Tab, Shift+Tab, Backspace, and ':' keep Python ergonomics", async () => {
  const { tabEdit, shiftTabEdit, backspaceEdit, colonEdit, INDENT } = editing;
  const single = tabEdit("ab", 1, 1);
  assert(single.value === `a${INDENT}b` && single.selectionStart === 5, "tab should insert four spaces");

  const block = "a\nb\nc";
  const indented = tabEdit(block, 0, block.length);
  assert(indented.value === "    a\n    b\n    c" && indented.selectionStart === 4 && indented.selectionEnd === indented.value.length, `block indent wrong: ${JSON.stringify(indented)}`);
  const outdented = shiftTabEdit(indented.value, indented.selectionStart, indented.selectionEnd);
  assert(outdented.value === block && outdented.selectionStart === 0 && outdented.selectionEnd === block.length, `block outdent should round-trip: ${JSON.stringify(outdented)}`);
  const partial = shiftTabEdit("  x\n      y", 0, 11);
  assert(partial.value === "x\n  y", "shift+tab removes at most four spaces per line");

  const full = backspaceEdit("    ", 4, 4);
  assert(full && full.value === "" && full.selectionStart === 0, "backspace in leading whitespace removes an indent unit");
  const odd = backspaceEdit("     ", 5, 5);
  assert(odd && odd.value === "    ", "backspace removes back to the previous tab stop");
  assert(backspaceEdit("  x", 3, 3) === null, "backspace after text uses the default behaviour");
  assert(backspaceEdit("ab", 1, 2) === null, "backspace with a selection uses the default behaviour");

  const flat = "if a:\n    x = 1\n    else";
  const dedented = colonEdit(flat, flat.length, flat.length);
  assert(dedented && dedented.value === "if a:\n    x = 1\nelse:" && dedented.selectionStart === dedented.value.length, `else should snap to its if: ${JSON.stringify(dedented)}`);
  const nested = "if a:\n    if b:\n        y\n    else";
  assert(colonEdit(nested, nested.length, nested.length) === null, "else already aligned with the inner if should not move");
  const tryBlock = "try:\n    x\n    except ValueError";
  const exceptEdit = colonEdit(tryBlock, tryBlock.length, tryBlock.length);
  assert(exceptEdit && exceptEdit.value === "try:\n    x\nexcept ValueError:", `except should snap to try: ${JSON.stringify(exceptEdit)}`);
  assert(colonEdit("x = d[1", 7, 7) === null, "colon in ordinary code is untouched");
});

await milestone("Editor key handler is wired to the helpers without breaking Ctrl/Cmd+Enter", async () => {
  const handler = page.slice(page.indexOf("function handleEditorKeyDown"), page.indexOf("return (", page.indexOf("function handleEditorKeyDown")));
  for (const token of ["enterEdit(value, selectionStart, selectionEnd)", "shiftTabEdit(value, selectionStart, selectionEnd)", "tabEdit(value, selectionStart, selectionEnd)", "backspaceEdit(value, selectionStart, selectionEnd)", "colonEdit(value, selectionStart, selectionEnd)", 'void submit("run")']) {
    assert(handler.includes(token), `key handler missing ${token}`);
  }
  assert(!page.includes("const TABS ="), "legacy TABS constant should be gone");
  assert(page.includes("function applyEditorEdit(edit: EditorEdit)"), "applyEditorEdit missing");
});

await milestone("One-question Climbing Stairs workflow is preserved", async () => {
  for (const token of ["const PACKS = [climbingStairsPack]", "Full-screen compiler workspace", "quest-notebook-toggle fixed bottom-5 right-5", "Reveal solution?", "I want to view the solution", "Run basic", "Submit all", "Console / result drawer", "Attempt history lives here, not on the workspace front"]) {
    assert(page.includes(token), `workflow token missing ${token}`);
  }
});
