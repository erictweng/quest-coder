import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 120_000,
  retries: 0,
  workers: 1,
  use: { baseURL: "http://localhost:3170", trace: "retain-on-failure", screenshot: "only-on-failure" },
  webServer: [
    {
      command: "QUEST_CODER_RUNNER_TOKEN=e2e-token QUEST_CODER_RUNNER_PORT=8788 python3 runner/service/app.py",
      url: "http://127.0.0.1:8788/healthz",
      reuseExistingServer: false,
      timeout: 30_000
    },
    {
      // Runs the production build (see the test:e2e script), with a fresh database per run.
      command: "node -e \"require('fs').rmSync('.data/e2e',{recursive:true,force:true})\" && QUEST_CODER_DATABASE_PATH=.data/e2e/quest-coder.sqlite QUEST_CODER_RUNNER_URL=http://127.0.0.1:8788 QUEST_CODER_RUNNER_TOKEN=e2e-token npm run start -- --port 3170",
      url: "http://127.0.0.1:3170/api/health",
      reuseExistingServer: false,
      timeout: 60_000
    }
  ]
});
