# Sprint 3 Smoke Tests

Sprint 3 makes adding a question a content operation instead of an engineering operation.

## Milestone checklist

- [x] Quest-pack JSON/YAML schema.
  - Smoke: `npm run smoke:sprint3` checks `schemas/quest-pack.schema.json` and the converted Timequake pack shape.
- [x] Timequake quest pack converted from dojo format.
  - Smoke: Timequake pack now has 3 quests plus boss, fixed tests, reference solutions, budgets, scene spec, and review metadata.
- [x] Pack validator runs reference solutions in sandbox.
  - Smoke: `python3 scripts/validate_pack.py content/packs/timequake-search-rotated-array.json` runs every quest and boss reference solution through `runner.run_submission`.
- [x] Scene-render smoke check for every quest and boss.
  - Smoke: each challenge replay must include line, read, outcome events and array replay input matching the scene type.
- [x] Loader inserts/serves validated content.
  - Smoke: `lib/quests.ts`, `/api/packs`, `/api/packs/[slug]`, and `/api/run` load pack/challenge data instead of hard-coded runner tests.
- [x] Original-text checklist in validator/review process.
  - Smoke: validator requires `metadata.originalTextConfirmed` and `validation.originalTextChecklist` flags.

## Acceptance checks

- [x] Broken reference solution causes pack rejection.
- [x] Missing scene spec causes pack rejection.
- [x] Timequake pack loads without code changes.
- [x] The app can run every quest and boss from the pack.

## Commands

```bash
python3 scripts/validate_pack.py content/packs/timequake-search-rotated-array.json
npm run smoke:sprint3
```

Full Sprint 3 verification gate:

```bash
npm run test:runner
npm run typecheck
npm run build
npm run smoke:sprint2
npm run smoke:sprint3
```

## Latest result

```text
ok - Quest-pack JSON schema exists and Timequake pack is converted
ok - Pack validator accepts Timequake and runs references
ok - Broken reference solution causes pack rejection
ok - Missing scene spec causes pack rejection
ok - Scene-render smoke checks cover every quest and boss
ok - Loader serves validated content
ok - App can run every quest and boss from the pack
ok - Original-text checklist is enforced
ok - Sprint 3 smoke doc is wired
```

## Notes

The pack pipeline still uses checked-in JSON packs and the Sprint 1 local CPython runner. Database ingestion and public-safe sandboxing belong to later sprints.
