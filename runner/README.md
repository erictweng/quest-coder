# Quest Coder Runner

CPython execution and grading for Quest Coder.

- `service/app.py`: token-protected HTTP gateway. Validates the request, runs the CLI, and redacts hidden cases (inputs, expected values, and error text) from submit responses.
- `quest_runner_cli.py`: the grader. Requires the absolute private JSON path in `QUEST_CODER_PRIVATE_PACK_PATH`, runs each case, compares results with expected values, and enforces a 5.5 s whole-submission deadline.
- `case_worker.py`: one throwaway process per case. It receives the source and the case inputs only, so expected values and the verdict never share an interpreter with submitted code.
- `quest_runner.py`: the engine shared by the grader and the worker (source checks, read counting, tracing, time and resource guards).
- `private_pack.py`: validates the mounted `quest-private-pack.v1` schema. Missing, unreadable, invalid, incomplete, or wrong-slug packs fail closed.
- `tests/fixtures/non-production-private-pack.json`: explicitly non-production CI/E2E fixture built only from already-public Run examples. The Dockerfile uses explicit `COPY` paths and does not include it.

```bash
npm run test:runner
```

Generate a case-free private skeleton under ignored storage, fill it with newly rotated cases out of band, and validate it:

```bash
npm run private-pack:generate -- .private/runner-packs/forest-of-patience-climbing-stairs.json
npm run private-pack:validate -- .private/runner-packs/forest-of-patience-climbing-stairs.json
```

The old production fixtures were committed historically. They must be replaced, not copied into the new private pack.
Each `replayCaseId` must name an identical case in both `tests.run` and `tests.submit`; Submit may add other private cases, but its replay remains intentionally public and safe to return for animation.

## Security note

The source checks and resource limits are defense in depth, not an isolation boundary. Workers still share a filesystem and user with the grader, so a deployment that accepts untrusted code must run this service inside a locked-down container or microVM with no outbound network. See `docs/SECURITY_REVIEW.md`.
