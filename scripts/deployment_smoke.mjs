#!/usr/bin/env node

const target = process.argv[2];
if (!target) {
  console.error("usage: npm run smoke:deployment -- https://your-app.example");
  process.exit(2);
}

let base;
try {
  base = new URL(target);
} catch {
  console.error("target must be an absolute URL");
  process.exit(2);
}
if (base.username || base.password) {
  console.error("target URL must not contain credentials");
  process.exit(2);
}
base.pathname = "/";
base.search = "";
base.hash = "";
const localHosts = new Set(["localhost", "127.0.0.1", "::1"]);
if (base.protocol !== "https:" && !(base.protocol === "http:" && localHosts.has(base.hostname))) {
  console.error("target must use HTTPS (HTTP is allowed only for localhost/loopback)");
  process.exit(2);
}

const checks = [];
const errors = [];
const record = (name, ok, detail) => {
  checks.push({ name, ok, detail });
  if (!ok) errors.push(`${name}: ${detail}`);
};
const request = async (path, init = {}) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    return await fetch(new URL(path, base), { redirect: "manual", ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
};

try {
  const root = await request("/");
  record("root reachable", root.status >= 200 && root.status < 400, `HTTP ${root.status}`);
  const requiredHeaders = {
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
    "referrer-policy": "strict-origin-when-cross-origin",
    "permissions-policy": "camera=(), microphone=(), geolocation=()"
  };
  for (const [name, expected] of Object.entries(requiredHeaders)) {
    record(`security header ${name}`, root.headers.get(name) === expected, `expected ${expected}, got ${root.headers.get(name) ?? "missing"}`);
  }
  if (base.protocol === "https:") {
    record("security header strict-transport-security", Boolean(root.headers.get("strict-transport-security")?.includes("max-age=")), root.headers.get("strict-transport-security") ?? "missing");
  }

  const health = await request("/api/health", { headers: { accept: "application/json" } });
  let healthPayload = null;
  try { healthPayload = await health.json(); } catch {}
  record("health endpoint", health.status === 200 && healthPayload?.status === "ok" && healthPayload?.runner?.available === true, `HTTP ${health.status}, status=${healthPayload?.status ?? "invalid"}, runner=${String(healthPayload?.runner?.available)}`);

  const anonymousRun = await request("/api/run", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ source: "pass", packSlug: "forest-of-patience-climbing-stairs", challengeId: "patience-last-jump", mode: "run" })
  });
  record("anonymous run rejected", anonymousRun.status === 401, `HTTP ${anonymousRun.status}`);

  const malformedSession = await request("/api/session", { method: "POST", headers: { "content-type": "application/json" }, body: "{" });
  record("malformed JSON rejected", malformedSession.status === 400, `HTTP ${malformedSession.status}`);

  const traversal = await request("/api/packs/%2e%2e%2f%2e%2e%2fetc%2fpasswd");
  record("encoded traversal rejected", [400, 404].includes(traversal.status), `HTTP ${traversal.status}`);

  const privatePaths = [
    "/runner/tests/fixtures/non-production-private-pack.json",
    "/.private/runner-packs/forest-of-patience-climbing-stairs.json",
    "/api/private-pack",
    "/private-pack.json"
  ];
  for (const path of privatePaths) {
    const response = await request(path);
    record(`private path unreachable ${path}`, [400, 404].includes(response.status), `HTTP ${response.status}`);
  }
} catch (error) {
  errors.push(error instanceof Error ? error.message : String(error));
}

for (const check of checks) console.log(`${check.ok ? "PASS" : "FAIL"} ${check.name} — ${check.detail}`);
if (errors.length) {
  console.error(`deployment smoke failed (${errors.length} check${errors.length === 1 ? "" : "s"})`);
  process.exit(1);
}
console.log(`deployment smoke passed for ${base.origin}`);
