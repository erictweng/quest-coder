import unittest

from runner.quest_runner import default_rotated_budget, run_submission


REFERENCE_SEARCH = """
class Solution:
    def search(self, nums: List[int], target: int) -> int:
        l = 0
        r = len(nums) - 1
        while l <= r:
            mid = (l + r) // 2
            if nums[mid] == target:
                return mid
            if nums[l] <= nums[mid]:
                if nums[l] <= target < nums[mid]:
                    r = mid - 1
                else:
                    l = mid + 1
            else:
                if nums[mid] < target <= nums[r]:
                    l = mid + 1
                else:
                    r = mid - 1
        return -1
"""

LINEAR_SEARCH = """
class Solution:
    def search(self, nums: List[int], target: int) -> int:
        for i, value in enumerate(nums):
            if value == target:
                return i
        return -1
"""

WRONG_SEARCH = """
class Solution:
    def search(self, nums: List[int], target: int) -> int:
        return -1
"""

RUNTIME_CRASH = """
class Solution:
    def search(self, nums: List[int], target: int) -> int:
        return 1 / 0
"""

OFF_END = """
class Solution:
    def search(self, nums: List[int], target: int) -> int:
        return nums[len(nums)]
"""

INFINITE_LOOP = """
class Solution:
    def search(self, nums: List[int], target: int) -> int:
        while True:
            pass
"""

SYNTAX_ERROR = """
class Solution:
    def search(self, nums: List[int], target: int) -> int
        return 0
"""

SMALL_TESTS = [
    {"id": "found", "input": {"nums": [4, 5, 6, 7, 0, 1, 2], "target": 0}, "expected": 4},
    {"id": "missing", "input": {"nums": [4, 5, 6, 7, 0, 1, 2], "target": 3}, "expected": -1},
]


def rotated(size: int, pivot: int) -> list[int]:
    values = list(range(size))
    return values[pivot:] + values[:pivot]


class Sprint1RunnerSmokeTests(unittest.TestCase):
    def test_milestone_local_runner_prototype_executes_reference(self):
        result = run_submission(REFERENCE_SEARCH, SMALL_TESTS, quest_id="timequake", budget_limit=80)
        self.assertTrue(result["passed"])
        self.assertEqual(result["status"], "passed")
        self.assertEqual(len(result["cases"]), 2)

    def test_milestone_distinct_result_types(self):
        self.assertEqual(run_submission(SYNTAX_ERROR, SMALL_TESTS[:1])["status"], "compile_error")
        self.assertEqual(run_submission(RUNTIME_CRASH, SMALL_TESTS[:1])["status"], "runtime_error")
        self.assertEqual(run_submission(WRONG_SEARCH, SMALL_TESTS[:1])["status"], "wrong_answer")
        self.assertEqual(run_submission(REFERENCE_SEARCH, SMALL_TESTS[:1])["status"], "passed")

    def test_milestone_read_counting_and_budget_failure(self):
        nums = rotated(256, 97)
        target = nums[-1]
        tests = [{"id": "large", "input": {"nums": nums, "target": target}, "expected": len(nums) - 1}]
        budget = default_rotated_budget(len(nums))
        result = run_submission(LINEAR_SEARCH, tests, quest_id="timequake", budget_limit=budget)
        self.assertEqual(result["status"], "over_budget")
        self.assertGreater(result["cases"][0]["budget"]["used"], budget)
        self.assertEqual(result["cases"][0]["actual"], len(nums) - 1)

    def test_milestone_sys_settrace_timeline_contains_lines_vars_reads_outcome(self):
        result = run_submission(REFERENCE_SEARCH, SMALL_TESTS[:1], quest_id="timequake", budget_limit=80)
        events = result["replay"]["events"]
        kinds = {event["kind"] for event in events}
        self.assertIn("line", kinds)
        self.assertIn("read", kinds)
        self.assertEqual(events[-1]["kind"], "outcome")
        self.assertEqual(events[-1]["status"], "passed")
        self.assertTrue(any("mid" in event.get("vars", {}) for event in events))

    def test_milestone_two_pass_execution_records_fast_and_traced_replay(self):
        result = run_submission(REFERENCE_SEARCH, SMALL_TESTS, quest_id="timequake", budget_limit=80)
        self.assertEqual(result["execution"]["passes"], ["fast", "traced_replay"])
        self.assertEqual(result["execution"]["replayCaseIndex"], 0)
        self.assertEqual(result["cases"][0]["summary"]["eventCount"], 0)
        self.assertGreater(result["replay"]["summary"]["eventCount"], 0)

    def test_milestone_time_and_memory_guard_prototype(self):
        result = run_submission(INFINITE_LOOP, SMALL_TESTS[:1], timeout_ms=50)
        self.assertEqual(result["status"], "loop_guard")
        self.assertIn("memoryKb", result["cases"][0]["summary"])

    def test_milestone_timequake_reference_boss_passes_fixed_and_random_tests(self):
        randomish = []
        for size, pivot, target in [(17, 5, 12), (64, 19, 0), (129, 40, 128), (200, 77, 55)]:
            nums = rotated(size, pivot)
            expected = nums.index(target)
            randomish.append({"id": f"rotated-{size}", "input": {"nums": nums, "target": target}, "expected": expected})
        tests = SMALL_TESTS + randomish
        result = run_submission(REFERENCE_SEARCH, tests, quest_id="timequake", budget_limit=80)
        self.assertTrue(result["passed"])
        self.assertTrue(all(case["budget"]["used"] <= 80 for case in result["cases"]))

    def test_milestone_off_end_read_is_distinct(self):
        result = run_submission(OFF_END, SMALL_TESTS[:1])
        self.assertEqual(result["status"], "off_end_read")


if __name__ == "__main__":
    unittest.main()
