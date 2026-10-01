#!/usr/bin/env node
import { readFileSync } from "node:fs";

const root = process.cwd();
const vercel = JSON.parse(readFileSync(`${root}/vercel.json`, "utf8"));
const health = readFileSync(`${root}/app/api/health/route.ts`, "utf8");
const robots = readFileSync(`${root}/app/robots.ts`, "utf8");
const sitemap = readFileSync(`${root}/app/sitemap.ts`, "utf8");
const layout = readFileSync(`${root}/app/layout.tsx`, "utf8");
const readme = readFileSync(`${root}/README.md`, "utf8");
const deployment = readFileSync(`${root}/docs/DEPLOYMENT.md`, "utf8");
const checklist = readFileSync(`${root}/docs/PUBLIC_LAUNCH_CHECKLIST.md`, "utf8");
const sprintDoc = readFileSync(`${root}/docs/SPRINT_9_SMOKE_TESTS.md`, "utf8");
const sprintPlan = readFileSync(`${root}/docs/SPRINTS_AND_MILESTONES.md`, "utf8");

function assert(condition, message) { if (!condition) throw new Error(message); }
function milestone(name, fn) { fn(); console.log(`ok - ${name}`); }

milestone("Deployment target configuration", () => {
  assert(vercel.framework === "nextjs", "Vercel framework should be nextjs");
  assert(vercel.buildCommand === "npm run build", "Vercel build command missing");
  assert(vercel.functions?.["app/api/run/route.ts"]?.maxDuration === 10, "run function maxDuration missing");
  assert(JSON.stringify(vercel.headers).includes("X-Content-Type-Options"), "security headers missing");
});

milestone("Public launch checklist", () => {
  for (const token of ["public beta", "Required before sharing", "Manual post-deploy checks", "Launch announcement draft", "Rollback"]) {
    assert(checklist.includes(token), `launch checklist missing ${token}`);
  }
});

milestone("Health/readiness endpoint", () => {
  for (const token of ["status", "launchStage", "public-beta", "listPackSlugs", "publicHardeningProfile", "NEXT_PUBLIC_APP_VERSION"]) {
    assert(health.includes(token), `health endpoint missing ${token}`);
  }
});

milestone("SEO/indexing controls", () => {
  for (const token of ["NEXT_PUBLIC_ALLOW_INDEXING", "disallow", "NEXT_PUBLIC_SITE_URL", "metadataBase", "openGraph"]) {
    assert(robots.includes(token) || sitemap.includes(token) || layout.includes(token), `SEO/indexing token missing ${token}`);
  }
});

milestone("Launch docs and rollback plan", () => {
  for (const token of ["Vercel", "Environment variables", "NEXT_PUBLIC_SITE_URL", "NEXT_PUBLIC_ALLOW_INDEXING", "Rollback", "microVM"]) {
    assert(deployment.includes(token) || checklist.includes(token), `launch doc token missing ${token}`);
  }
});

milestone("Final full-sprint verification gate", () => {
  assert(readme.includes("npm run smoke:sprint9"), "README missing Sprint 9 smoke gate");
  assert(sprintDoc.includes("npm run smoke:sprint9"), "Sprint 9 smoke doc missing command");
  assert(sprintPlan.includes("Sprint 9 — Public launch / beta release"), "Sprint 9 plan missing");
});
