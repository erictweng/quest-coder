#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";

const root = process.cwd();
const page = readFileSync(`${root}/app/page.tsx`, "utf8");
const css = readFileSync(`${root}/app/globals.css`, "utf8");
const doc = readFileSync(`${root}/docs/SKY_ISLAND_ASSET_KIT.md`, "utf8");

function assert(condition, message) { if (!condition) throw new Error(message); }
function milestone(name, fn) { fn(); console.log(`ok - ${name}`); }

const assets = [
  "companion.svg",
  "cloud-tile.svg",
  "floating-island.svg",
  "quest-lantern.svg",
  "boss-gate.svg",
  "reward-sparkle.svg",
  "review-rematch.svg",
];

milestone("Original mini asset kit files exist", () => {
  for (const asset of assets) {
    const path = `${root}/public/art/sky-island/${asset}`;
    assert(existsSync(path), `asset missing ${asset}`);
    const source = readFileSync(path, "utf8");
    assert(source.includes("<svg"), `${asset} is not SVG`);
    assert(source.includes("shape-rendering=\"crispEdges\""), `${asset} missing crisp pixel rendering`);
  }
});

milestone("Asset kit documentation is wired", () => {
  for (const token of ["Sky-Island Academy Mini Asset Kit", "Originality Rule", "Usage Rules", "do not copy", "public/art/sky-island/companion.svg"]) {
    assert(doc.includes(token), `asset kit doc missing ${token}`);
  }
});

milestone("Shared asset CSS preserves pixel readability", () => {
  for (const token of [".sky-asset", "image-rendering: pixelated", "image-rendering: crisp-edges", ".sky-asset-soft"]) {
    assert(css.includes(token), `asset CSS missing ${token}`);
  }
});

milestone("Assets are used on product surfaces", () => {
  for (const token of [
    "/art/sky-island/companion.svg",
    "/art/sky-island/floating-island.svg",
    "/art/sky-island/quest-lantern.svg",
    "/art/sky-island/boss-gate.svg",
    "/art/sky-island/cloud-tile.svg",
    "/art/sky-island/reward-sparkle.svg",
  ]) {
    assert(page.includes(token), `page does not use ${token}`);
  }
});

milestone("Assets stay out of the code editor", () => {
  const editorIndex = page.indexOf("solution.py");
  const editorEnd = page.indexOf("Console / result drawer", editorIndex);
  const editorSource = page.slice(editorIndex, editorEnd);
  assert(!editorSource.includes("/art/sky-island/"), "editor pane should not contain decorative assets");
  assert(page.includes("Dark terminal preserved for readability"), "editor readability boundary missing");
});
