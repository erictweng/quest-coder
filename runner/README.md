# Quest Coder Runner

CPython execution and grading for Quest Coder.

- `service/app.py`: token-protected HTTP gateway. Validates the request, runs the CLI, and redacts hidden cases (inputs, expected values, and error text) from submit responses.
- `quest_runner_cli.py`: the grader. Loads the pack from `packs/`, runs each case, compares results with expected values, and enforces a 5.5 s whole-submission deadline so a non-terminating submission is returned as `loop_guard` rather than a gateway timeout.
- `case_worker.py`: one throwaway process per case. It receives the source and the case inputs only, so expected values and the verdict never share an interpreter with submitted code.
- `quest_runner.py`: the engine shared by the grader and the worker (source checks, read counting, tracing, time and resource guards).
- `packs/`: the single source of truth for packs and the only place hidden submit tests live. After editing a pack, run `npm run build:packs` to regenerate the Next.js projections in `content/`.

```bash
npm run test:runner
```

## Security note

The source checks and resource limits are defense in depth, not an isolation boundary. Workers still share a filesystem and user with the grader, so a deployment that accepts untrusted code must run this service inside a locked-down container or microVM with no outbound network. See `docs/SECURITY_REVIEW.md`.
