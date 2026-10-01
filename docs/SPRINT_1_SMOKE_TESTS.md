# Sprint 1 Smoke Tests

Sprint 1 requires smoke tests after each milestone. This file records the milestone checks that prove whether the work is done.

## Milestone checklist

- [x] Isolated local sandbox runner prototype.
  - Smoke: `test_milestone_local_runner_prototype_executes_reference`
- [x] Distinct result types: compile error, runtime crash, failed test, passed.
  - Smoke: `test_milestone_distinct_result_types`
- [x] Read-counting wrappers for arrays/lists.
  - Smoke: `test_milestone_read_counting_and_budget_failure`
- [x] `sys.settrace` timeline capture.
  - Smoke: `test_milestone_sys_settrace_timeline_contains_lines_vars_reads_outcome`
- [x] Two-pass execution: fast untraced pass/fail, traced replay pass.
  - Smoke: `test_milestone_two_pass_execution_records_fast_and_traced_replay`
- [x] Time/memory guard prototype.
  - Smoke: `test_milestone_time_and_memory_guard_prototype`
- [x] Reference Timequake/Search-in-Rotated-Array boss through the server runner.
  - Smoke: `test_milestone_timequake_reference_boss_passes_fixed_and_random_tests`
- [x] Off-end read returns a distinct structured result.
  - Smoke: `test_milestone_off_end_read_is_distinct`

## Command

```bash
python3 -m unittest runner.tests.test_smoke -v
```

## Latest result

```text
test_milestone_distinct_result_types ... ok
test_milestone_local_runner_prototype_executes_reference ... ok
test_milestone_off_end_read_is_distinct ... ok
test_milestone_read_counting_and_budget_failure ... ok
test_milestone_sys_settrace_timeline_contains_lines_vars_reads_outcome ... ok
test_milestone_time_and_memory_guard_prototype ... ok
test_milestone_timequake_reference_boss_passes_fixed_and_random_tests ... ok
test_milestone_two_pass_execution_records_fast_and_traced_replay ... ok

Ran 8 tests in 0.406s
OK
```

## Notes

This runner is a Sprint 1 local spike only. It proves the engine loop and contracts; it is not a public-safe sandbox. Sprint 7 still owns container/microVM isolation, no-network execution, read-only filesystem, rate limits, and abuse hardening.
