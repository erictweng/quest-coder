# Quest Coder Runner

Sprint 1 local CPython sandbox spike.

Implemented responsibilities:

- classify compile errors, runtime errors, wrong answers, passes, budget failures, loop guards, and off-end reads;
- wrap list inputs to count reads;
- run fast pass/fail first, then traced replay;
- emit `timeline.v0`-shaped payloads consumed by the future Next.js replay UI;
- collect line events, read events, tracked variables, budget usage, memory metadata, and final outcomes.

Run smoke tests:

```bash
python3 -m unittest runner.tests.test_smoke -v
```

Security note: this is intentionally not a public-safe sandbox. It is only for local Sprint 1 engine validation. Public execution still requires hardened isolation in Sprint 7.
