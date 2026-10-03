import { defineConfig, devices } from "@playwright/test";

const useDevServer = process.env.QUEST_CODER_E2E_DEV_SERVER === "1";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 120_000,
  retries: 0,
  workers: 1,
  use: { baseURL: "http://localhost:3170", trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: [
    { name: "chromium-full", testMatch: /trusted-slice\.spec\.ts/, use: { ...devices["Desktop Chrome"] } },
    { name: "chromium-smoke", testMatch: /cross-browser-smoke\.spec\.ts/, use: { ...devices["Desktop Chrome"] } },
    { name: "firefox-smoke", testMatch: /cross-browser-smoke\.spec\.ts/, use: { ...devices["Desktop Firefox"] } },
    { name: "webkit-smoke", testMatch: /cross-browser-smoke\.spec\.ts/, use: { ...devices["Desktop Safari"] } },
    { name: "mobile-chromium-smoke", testMatch: /cross-browser-smoke\.spec\.ts/, use: { ...devices["Pixel 7"] } },
    { name: "chromium-accessibility", testMatch: /accessibility\.spec\.ts/, use: { ...devices["Desktop Chrome"] } }
  ],
  webServer: [
    {
      command: "QUEST_CODER_RUNNER_TOKEN=e2e-token QUEST_CODER_RUNNER_PORT=8788 QUEST_CODER_PRIVATE_PACK_PATH=$PWD/runner/tests/fixtures/non-production-private-pack.json python3 runner/service/app.py",
      url: "http://127.0.0.1:8788/healthz",
      reuseExistingServer: false,
      timeout: 30_000
    },
    {
      // Full Chromium and axe use the production build. The focused browser matrix uses the
      // development server because WebKit correctly refuses production Secure cookies over HTTP.
      command: `node -e "require('fs').rmSync('.data/e2e',{recursive:true,force:true})" && QUEST_CODER_DATABASE_PATH=.data/e2e/quest-coder.sqlite QUEST_CODER_RUNNER_URL=http://127.0.0.1:8788 QUEST_CODER_RUNNER_TOKEN=e2e-token npm run ${useDevServer ? "dev" : "start"} -- --port 3170`,
      url: "http://127.0.0.1:3170/api/health",
      reuseExistingServer: false,
      timeout: 60_000
    }
  ]
});
