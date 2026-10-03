# Private runner pack

Authoritative grading data uses `quest-private-pack.v1` and must live outside git and the container image. Recommended local location: `.private/runner-packs/forest-of-patience-climbing-stairs.json` (ignored by git and Docker build context).

The previous authoritative pack was committed historically. Treat every old hidden case and expected value as disclosed; production must use newly rotated/replaced cases.

## Generate a production pack (recommended)

```bash
python3 scripts/private_pack.py generate-cases /path/outside/git/pack.json
```

Keeps the public Run cases (also used for the replay animation) and adds 8 freshly drawn private Submit cases per challenge, within each quest's stated constraints and always including the edges. Expected values come from an independent oracle, not from the reference solutions. The file is written owner-only (0600), validated, and never printed. `scripts/deploy_runner_cloud_run.sh` runs this in Cloud Shell and stores the result directly in Secret Manager.

## Case-free template workflow

```bash
npm run private-pack:generate -- .private/runner-packs/forest-of-patience-climbing-stairs.json
# Add new private cases out of band. Do not print or stage the completed file.
npm run private-pack:validate -- .private/runner-packs/forest-of-patience-climbing-stairs.json
```

The generator reads tracked `content/server` only for pack/challenge IDs, entrypoints, budgets, and runtime limits. It writes empty `run`/`submit` arrays and no inputs, outputs, or solutions.

## Schema

```json
{
  "schemaVersion": "quest-private-pack.v1",
  "slug": "forest-of-patience-climbing-stairs",
  "runtime": {
    "timeLimitMs": 2000,
    "timelineEventCap": 3000
  },
  "challenges": [
    {
      "id": "<allowed challenge id>",
      "entrypoint": "<server-owned Python entrypoint>",
      "budget": { "enabled": false },
      "tests": {
        "run": [
          { "id": "<public replay id>", "input": {}, "expected": "<public expected value>" }
        ],
        "submit": [
          { "id": "<same public replay id>", "input": {}, "expected": "<same public expected value>" }
        ],
        "replayCaseId": "<same public replay id>"
      }
    }
  ]
}
```

The validator requires all four allowed challenges exactly once, non-empty Run and Submit suites, unique case IDs, object inputs, and tests containing only `id`, `input`, and `expected`. `replayCaseId` must identify an identical case in both suites because replay details are returned for animation. Submit may contain additional private cases.

## Runtime configuration

- Direct service: set absolute `QUEST_CODER_PRIVATE_PACK_PATH`.
- Compose: set host-side `QUEST_CODER_PRIVATE_PACK_FILE`; Compose mounts it read-only and sets the in-container path.
- CI/E2E only: `runner/tests/fixtures/non-production-private-pack.json` contains only already-public Run examples and is excluded from the production image.

The service validates the pack before listening, and each CLI invocation validates it again. Missing, relative, unreadable, oversized, malformed, incomplete, or wrong-slug packs fail closed.
