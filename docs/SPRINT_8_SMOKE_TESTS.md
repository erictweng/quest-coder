# Sprint 8 Smoke Tests

Sprint 8 adds motivation polish after the core learning loop: rewards, a shop placeholder, a stat bar, and optional social shell.

## Milestone checklist

- [x] Reward currency model.
  - Smoke: `npm run smoke:sprint8` checks XP/Shards wallet state, grant history, and empty defaults.
- [x] Quest/boss reward grant events.
  - Smoke: checks first-time clear grants, boss-vs-quest rewards, and hint/solution-assisted reductions.
- [x] Spend target placeholder or shop/progression concept.
  - Smoke: checks Spend 1 Shard action and pixel aura shop preview state.
- [x] Stat bar.
  - Smoke: checks boss-defeat progress, XP, Shards, and attempts summary.
- [x] Friend list/social shell if still wanted.
  - Smoke: checks optional friend shell, disabled solo mode, and enable/hide control.

## Acceptance checks

- [x] Rewards reinforce practice without undermining learning: hints/solutions reduce XP, and Shards come from boss clears only.
- [x] Reward outcomes are visible after quests/bosses through the reward grant list.
- [x] Social features are optional and do not block solo use.

## Commands

```bash
npm run smoke:sprint8
```

Full Sprint 8 verification gate:

```bash
npm run test:runner
npm run typecheck
npm run build
npm run smoke:sprint2
npm run smoke:sprint3
npm run smoke:sprint4
npm run smoke:sprint5
npm run smoke:sprint6
npm run smoke:sprint7
npm run smoke:sprint8
```
