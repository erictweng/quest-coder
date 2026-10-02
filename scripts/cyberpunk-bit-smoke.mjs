#!/usr/bin/env node
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();
const page = readFileSync(`${root}/app/page.tsx`, "utf8");
const css = readFileSync(`${root}/app/globals.css`, "utf8");
const pkg = JSON.parse(readFileSync(`${root}/package.json`, "utf8"));

function assert(condition, message) { if (!condition) throw new Error(message); }
function milestone(name, fn) { fn(); console.log(`ok - ${name}`); }
function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) walk(path, files);
    else files.push(path);
  }
  return files;
}

milestone("Cyberpunk tokens exist", () => {
  for (const token of ["--qc-grid", "--qc-maze-blue", "--qc-neon-cyan", "--qc-pac-yellow", "--qc-ghost-pink", "--qc-power-blue", "--qc-terminal-green", "--qc-warning-orange"]) {
    assert(css.includes(token), `missing token ${token}`);
  }
});

milestone("Cyberpunk primitives exist", () => {
  for (const primitive of [".cyber-bit-world", ".maze-grid-field", ".neon-maze-panel", ".terminal-card", ".pellet-node", ".power-node", ".firewall-gate", ".cyber-asset"]) {
    assert(css.includes(primitive), `missing primitive ${primitive}`);
  }
});

milestone("Hub, Campaign, and Solve use cyberpunk primitives", () => {
  for (const token of ["Cyberpunk Bit Hub Arcade Terminal", "Neon districts", "Pellet route", "Firewall gate", "Cyberpunk solve encounter restrained editor-safe", "Encounter frame"]) {
    assert(page.includes(token), `page missing ${token}`);
  }
});

milestone("Split-pane solve and readable editor survive", () => {
  for (const token of ["Focused split-pane solve screen", "Question", "Code compiler pane", "font-mono", "solution.py", "ligatures off", "clean editor zone"]) {
    assert(page.includes(token), `solve/editor missing ${token}`);
  }
});

milestone("Dedicated cyberpunk smokes are wired", () => {
  for (const script of ["smoke:cyberpunk-token", "smoke:cyberpunk-hub", "smoke:cyberpunk-campaign", "smoke:cyberpunk-solve", "smoke:cyberpunk-assets", "smoke:cyberpunk-bit"]) {
    assert(pkg.scripts?.[script], `package script missing ${script}`);
  }
  for (const retired of ["smoke:sky-island", "smoke:sky-assets"]) {
    assert(!pkg.scripts?.[retired], `retired package script still wired ${retired}`);
  }
});

milestone("Old fantasy-cloud strings are gone from active source", () => {
  const forbidden = ["sky-island", "Sky-Island", "cloud-tile", "floating-island", "wood-sign", "sky-asset", "Original pixel cloud", "lantern", "island scene"];
  const sourceFiles = walk(`${root}/app`).filter((file) => /\.(tsx|ts|css)$/.test(file));
  for (const file of sourceFiles) {
    const text = readFileSync(file, "utf8");
    for (const needle of forbidden) {
      assert(!text.includes(needle), `${relative(root, file)} still contains ${needle}`);
    }
  }
});
