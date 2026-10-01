# Sprint 5 Smoke Tests

Sprint 5 expands Quest Coder beyond Timequake into the first usable practice set with linked-list visuals.

## Milestone checklist

- [x] Linked-list portal/island scene renderer.
  - Smoke: `npm run smoke:sprint5` checks `LinkedListScene` and portal/island/pointer movement UI copy.
- [x] Reverse Linked List quest pack.
  - Smoke: validates `reverse-linked-list.json` and runs its boss reference through the runner.
- [x] Merge Two Sorted Lists quest pack.
  - Smoke: validates `merge-two-sorted-lists.json` and runs its boss reference through the runner.
- [x] Linked List Cycle quest pack.
  - Smoke: validates `linked-list-cycle.json` and runs its boss reference through the runner.
- [x] Library contains at least 5 total questions when combined with Timequake and one additional pack.
  - Smoke: checks at least 5 packs/questions: Timequake, Plain Binary Search, Reverse Linked List, Merge Two Sorted Lists, Linked List Cycle.
- [x] Visual quality review checklist for each pack.
  - Smoke: checks `docs/VISUAL_QUALITY_CHECKLIST.md` covers all five packs.

## Acceptance checks

- [x] Eric can clear 5 question bosses end to end with reference solutions.
- [x] Every boss replay has line/read/outcome events and visual checklist coverage.
- [x] Pointer movement/relinking is visible for linked-list problems.

## Commands

```bash
npm run smoke:sprint5
```

Full Sprint 5 verification gate:

```bash
npm run test:runner
npm run typecheck
npm run build
npm run smoke:sprint2
npm run smoke:sprint3
npm run smoke:sprint4
npm run smoke:sprint5
```
