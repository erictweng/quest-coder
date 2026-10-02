#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";

const root = process.cwd();
const page = readFileSync(`${root}/app/page.tsx`, "utf8");
const plan = readFileSync(`${root}/docs/CYBERPUNK_BIT_MILESTONE_PLAN.md`, "utf8");

function assert(condition, message) { if (!condition) throw new Error(message); }
function milestone(name, fn) { fn(); console.log(`ok - ${name}`); }

const assets = [
  "operator.svg",
  "pellet-node.svg",
  "power-node.svg",
  "glitch-patrol.svg",
  "firewall-gate.svg",
  "reward-burst.svg",
  "rematch-ping.svg"
];

milestone("Cyberpunk milestone 6 plan exists", () => {
  for (const token of ["Milestone 6 — Cyberpunk Mini Asset Kit", "operator.svg", "glitch-patrol.svg", "Assets stay out of the editor pane"]) {
    assert(plan.includes(token), `plan missing ${token}`);
  }
});

milestone("Original cyberpunk bit SVG kit exists", () => {
  for (const asset of assets) {
    const path = `${root}/public/art/cyberpunk-bit/${asset}`;
    assert(existsSync(path), `missing ${asset}`);
    const svg = readFileSync(path, "utf8");
    assert(svg.includes("<svg"), `${asset} is not svg-like`);
    assert(svg.includes("Original"), `${asset} missing originality description`);
    assert(!svg.includes("pac-man") && !svg.includes("undertale"), `${asset} should not name copied source games`);
  }
});

milestone("Cyberpunk assets are wired into non-editor UI", () => {
  for (const src of ["/art/cyberpunk-bit/operator.svg", "/art/cyberpunk-bit/rematch-ping.svg", "/art/cyberpunk-bit/power-node.svg", "/art/cyberpunk-bit/glitch-patrol.svg", "/art/cyberpunk-bit/firewall-gate.svg", "/art/cyberpunk-bit/pellet-node.svg"]) {
    assert(page.includes(src), `page missing ${src}`);
  }
});

milestone("Cyberpunk assets stay out of the editor pane", () => {
  const editorStart = page.indexOf('aria-label="Code compiler pane');
  assert(editorStart > -1, "editor pane missing");
  const editorBranch = page.slice(editorStart);
  assert(!editorBranch.includes("/art/cyberpunk-bit/"), "editor pane should not contain decorative art assets");
  assert(editorBranch.includes("font-mono"), "editor should remain monospace/readable");
});

milestone("Old fantasy-cloud art references remain absent from active page", () => {
  for (const forbidden of ["/art/sky-island/", "cloud-tile", "sky-asset", "floating-island", "wood-sign-panel"]) {
    assert(!page.includes(forbidden), `page still contains ${forbidden}`);
  }
});
