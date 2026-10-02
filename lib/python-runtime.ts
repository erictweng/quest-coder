import { spawnSync } from "node:child_process";
import path from "node:path";

/**
 * Resolves which Python executable the `/api/run` bridge should spawn.
 *
 * Why this exists: `spawn("python3")` only works when the Next.js server process
 * happens to have `python3` on its PATH. Editors, launchd-started dev servers, and
 * hosted runtimes frequently ship a minimal PATH, which surfaced in the UI as
 * `spawn python3 ENOENT`. This module makes the command configurable through
 * `QUEST_CODER_PYTHON`, widens the search PATH with the usual macOS/Linux install
 * directories, probes a list of fallback commands, and produces a human-readable
 * error when nothing works.
 */

export const PYTHON_ENV_VAR = "QUEST_CODER_PYTHON";

export const PYTHON_SEARCH_DIRS = ["/opt/homebrew/bin", "/usr/local/bin", "/usr/bin", "/bin"];

export const PYTHON_COMMAND_CANDIDATES = [
  "python3",
  "python",
  "/opt/homebrew/bin/python3",
  "/usr/local/bin/python3",
  "/usr/bin/python3",
  "py"
];

export type PythonResolution = { command: string; version: string; source: "env" | "candidate" };
export type PythonProbe = { ok: true; version: string } | { ok: false; error: string };
export type PythonProbeFn = (command: string, env: NodeJS.ProcessEnv) => PythonProbe;

const PROBE_SCRIPT = "import sys; print('%d.%d.%d' % sys.version_info[:3])";

/** Returns a copy of `env` whose PATH also covers the standard Python install directories. */
export function withPythonSearchPath(env: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const current = env.PATH ?? env.Path ?? "";
  const parts = current.split(path.delimiter).filter(Boolean);
  for (const dir of PYTHON_SEARCH_DIRS) if (!parts.includes(dir)) parts.push(dir);
  return { ...env, PATH: parts.join(path.delimiter) };
}

/** Ordered list of commands to try: the env override first, then the built-in fallbacks. */
export function candidatePythonCommands(env: NodeJS.ProcessEnv = process.env): Array<{ command: string; source: "env" | "candidate" }> {
  const override = env[PYTHON_ENV_VAR]?.trim();
  const list: Array<{ command: string; source: "env" | "candidate" }> = [];
  if (override) list.push({ command: override, source: "env" });
  for (const command of PYTHON_COMMAND_CANDIDATES) {
    if (command !== override) list.push({ command, source: "candidate" });
  }
  return list;
}

/** Extra leading arguments a launcher needs (the Windows `py` launcher must be told to pick Python 3). */
export function pythonArgsPrefix(command: string): string[] {
  return path.basename(command).replace(/\.exe$/i, "") === "py" ? ["-3"] : [];
}

/** Runs `<command> -c "<print version>"` and reports whether it is a usable Python 3. */
export function probePythonCommand(command: string, env: NodeJS.ProcessEnv): PythonProbe {
  const args = [...pythonArgsPrefix(command), "-c", PROBE_SCRIPT];
  const child = spawnSync(command, args, { env, encoding: "utf8", timeout: 5000, windowsHide: true });
  if (child.error) return { ok: false, error: (child.error as NodeJS.ErrnoException).code ?? child.error.message };
  if (child.status !== 0) return { ok: false, error: (child.stderr || `exit ${child.status}`).trim() };
  const version = child.stdout.trim();
  if (!version.startsWith("3.")) return { ok: false, error: `unsupported Python version ${version || "unknown"}` };
  return { ok: true, version };
}

/**
 * Picks the first working Python command. Throws an error that lists what was tried
 * and how to configure the override so the message is actionable in the UI.
 */
export function resolvePythonCommand(env: NodeJS.ProcessEnv = process.env, probe: PythonProbeFn = probePythonCommand): PythonResolution {
  const searchEnv = withPythonSearchPath(env);
  const failures: string[] = [];
  for (const candidate of candidatePythonCommands(env)) {
    const result = probe(candidate.command, searchEnv);
    if (result.ok && result.version.startsWith("3.")) return { command: candidate.command, version: result.version, source: candidate.source };
    failures.push(`${candidate.command} (${result.ok ? `unsupported Python version ${result.version}` : result.error})`);
  }
  throw new Error(pythonMissingMessage(failures));
}

export function pythonMissingMessage(failures: string[]): string {
  return `Python 3 runtime not found. Tried: ${failures.join(", ")}. Install Python 3 or set ${PYTHON_ENV_VAR} to the full path of a python3 executable (for example /usr/bin/python3).`;
}

let cached: PythonResolution | null = null;

/** Cached resolution for the server process; call `invalidatePythonCommand()` after a spawn failure. */
export function getPythonCommand(env: NodeJS.ProcessEnv = process.env): PythonResolution {
  if (cached) return cached;
  cached = resolvePythonCommand(env);
  return cached;
}

export function invalidatePythonCommand(): void {
  cached = null;
}

/** Non-throwing status for health checks. */
export function pythonRuntimeStatus(env: NodeJS.ProcessEnv = process.env): { available: true; command: string; version: string; source: "env" | "candidate" } | { available: false; error: string } {
  try {
    const resolved = getPythonCommand(env);
    return { available: true, ...resolved };
  } catch (error) {
    return { available: false, error: error instanceof Error ? error.message : String(error) };
  }
}
