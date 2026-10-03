import assert from "node:assert/strict";
import { test } from "node:test";
import { contrastRatio, wcagLevel } from "../../lib/contrast.ts";
import { styleguideEnabled } from "../../lib/styleguide.ts";
import { MEDIEVAL_TEXT_PAIRS } from "../../components/medieval/tokens.ts";

test("contrast ratio matches WCAG reference values", () => {
  assert.equal(contrastRatio("#000000", "#FFFFFF"), 21);
  assert.equal(contrastRatio("#FFFFFF", "#FFFFFF"), 1);
  assert.equal(contrastRatio("#777777", "#FFFFFF").toFixed(2), "4.48");
  assert.equal(contrastRatio("#FFFFFF", "#777777"), contrastRatio("#777777", "#FFFFFF"));
  assert.throws(() => contrastRatio("red", "#FFFFFF"));
  assert.equal(wcagLevel(4.48), "AA large");
  assert.equal(wcagLevel(4.5), "AA");
});

test("every medieval text/background pair meets its required contrast", () => {
  for (const pair of MEDIEVAL_TEXT_PAIRS) {
    const ratio = contrastRatio(pair.fg, pair.bg);
    assert.ok(ratio >= pair.min, `${pair.label}: ${ratio.toFixed(2)} < ${pair.min}`);
  }
});

test("style tile is never served on production", () => {
  assert.equal(styleguideEnabled({ NODE_ENV: "development" }), true);
  assert.equal(styleguideEnabled({ NODE_ENV: "production", VERCEL_ENV: "preview" }), true);
  assert.equal(styleguideEnabled({ NODE_ENV: "production", VERCEL_ENV: "production" }), false);
  assert.equal(styleguideEnabled({ NODE_ENV: "production" }), false);
});
