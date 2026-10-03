#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("../", import.meta.url);
const rootPath = root.pathname;
const args = process.argv.slice(2);
const outputFlag = args.indexOf("--output");
const verifiedFlag = args.indexOf("--verified");
const output = outputFlag >= 0 ? args[outputFlag + 1] : "artifacts/test-provenance.json";
const verified = verifiedFlag >= 0 ? args[verifiedFlag + 1].split(",").filter(Boolean) : [];
if (!verified.length) {
  console.error("--verified requires a comma-separated list of completed suites");
  process.exit(2);
}

const countMatches = (path, pattern) => (readFileSync(join(rootPath, path), "utf8").match(pattern) ?? []).length;
const unitTests = readdirSync(join(rootPath, "tests/unit"), { withFileTypes: true })
  .filter((entry) => entry.isFile() && entry.name.endsWith(".test.ts"))
  .reduce((count, entry) => count + countMatches(`tests/unit/${entry.name}`, /\btest\s*\(/g), 0);
const runnerTests = readdirSync(join(rootPath, "runner/tests"), { withFileTypes: true })
  .filter((entry) => entry.isFile() && entry.name.startsWith("test_") && entry.name.endsWith(".py"))
  .reduce((count, entry) => count + countMatches(`runner/tests/${entry.name}`, /^\s*def test_/gm), 0);
const trustedSliceTests = countMatches("tests/e2e/trusted-slice.spec.ts", /\btest\s*\(/g);
const smokeTests = countMatches("tests/e2e/cross-browser-smoke.spec.ts", /\btest\s*\(/g);
const accessibilityTests = countMatches("tests/e2e/accessibility.spec.ts", /\btest\s*\(/g);
const run = (command, commandArgs) => execFileSync(command, commandArgs, { cwd: rootPath, encoding: "utf8" }).trim();

const document = {
  schemaVersion: "quest-coder.test-provenance.v1",
  generatedAt: new Date().toISOString(),
  gitSha: run("git", ["rev-parse", "HEAD"]),
  runtimes: {
    node: process.version,
    npm: run("npm", ["--version"]),
    python: run("python3", ["--version"]).replace(/^Python\s+/, "")
  },
  suiteCounts: {
    unitTests,
    runnerTests,
    trustedSliceChromiumTests: trustedSliceTests,
    focusedSmokeTestsPerProject: smokeTests,
    focusedSmokeProjects: 4,
    focusedSmokeProjectExecutions: smokeTests * 4,
    accessibilityTests
  },
  verifiedSuites: verified
};
mkdirSync(join(rootPath, output.substring(0, output.lastIndexOf("/"))), { recursive: true });
writeFileSync(join(rootPath, output), `${JSON.stringify(document, null, 2)}\n`);
console.log(output);
