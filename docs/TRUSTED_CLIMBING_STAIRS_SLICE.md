# Trusted Climbing Stairs Vertical Slice

## Product contract

- The active campaign contains three learning quests and one boss.
- `Run basic` provides feedback only. It never clears a stage, grants rewards, schedules review, or unlocks progression.
- A passing `Submit all` is authoritative. It clears exactly the active stage, grants its configured first-clear reward once, and unlocks the next stage.
- A solution-assisted clear is recorded and receives the existing reward penalty.
- Final boss completion shows the campaign-complete celebration and an enabled return-to-campaign action.
- Locked path buttons are disabled and explain the prerequisite.

## Feedback contract

- Basic pass: “Basic checks passed — Submit all to clear.”
- Submit pass: check mark, gentle fireworks, reward, and next-stage CTA.
- Final pass: boss/campaign completion and return CTA.
- Wrong answer, compile error, runtime error, over-budget, loop guard, off-end read, and internal error each receive a concise diagnosis and next action.
- Starting a new request clears stale results; moving to another stage clears stale runner errors.
- Submit rows identify private cases without exposing inputs or answers.

## Runtime contract

```text
Browser
  -> Next.js /api/run (validation + authenticated proxy)
    -> Runner service /v1/runs
      -> strict CLI pack lookup
        -> CPython grading engine
```

There is no grading fallback. The browser imports `content/public/`; the runner owns `runner/packs/`.

## Persistence contract

- Anonymous sign-in creates an opaque HttpOnly session cookie.
- SQLite stores session hashes and progress JSON for the credential-free local/private mode.
- The server copy is the only copy. localStorage holds just the last-used name and a signed-out flag; logging out keeps the save.
- Hosted multi-instance production requires a durable managed repository implementation.

## Automated acceptance evidence

`tests/e2e/trusted-slice.spec.ts` drives:

1. anonymous session creation;
2. incorrect Submit and visible retry guidance;
3. passing Run without unlock;
4. disabled next stage before Submit;
5. authoritative Submit through all four stages;
6. final campaign completion;
7. exact configured reward total (210 XP, 1 Shard);
8. server progress after reload;
9. invalid challenge rejection;
10. hidden submit fixture redaction.

`runner/tests/test_trusted_boundary.py` proves incorrect code is executed rather than inferred and validates strict CLI input.
