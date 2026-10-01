# Quest Pack Schema Draft

Quest packs are content bundles that define one teachable problem as a sequence of quests plus a boss fight. This is the Sprint 0 draft; Sprint 3 will formalize it as JSON Schema and add a validator.

## Goals

A pack should let the app load a question without code changes:

- Library metadata.
- Original story and problem framing.
- 2-8 quests.
- Fixed and generated tests.
- Read/time budgets.
- Boss fight.
- Scene spec.
- Review variants.
- Reference solutions for validation and hidden solution scrolls.

## Top-level shape

```ts
type QuestPack = {
  schemaVersion: "quest-pack.v0";
  id: string;
  slug: string;
  title: string;
  status: "draft" | "validated" | "published";
  metadata: PackMetadata;
  story: StorySpec;
  concepts: ConceptTag[];
  runtime: RuntimeSpec;
  scene: SceneSpec;
  quests: QuestSpec[];
  boss: BossSpec;
  review: ReviewSpec;
  rewards: RewardSpec;
  validation: ValidationSpec;
};
```

## Metadata

```ts
type PackMetadata = {
  displayName: string;
  shortDescription: string;
  difficulty: "easy" | "medium" | "hard";
  sourceInspiredBy?: string;
  originalTextConfirmed: boolean;
  authors: string[];
  createdAt: string;
  updatedAt: string;
};
```

Rules:

- `sourceInspiredBy` may say things like `Search in Rotated Sorted Array`, but copied problem statements are not allowed.
- `originalTextConfirmed` must be true before publishing.

## Concepts

```ts
type ConceptTag =
  | "binary_search"
  | "two_pointers"
  | "linked_list"
  | "stack"
  | "queue"
  | "tree"
  | "graph"
  | "recursion"
  | "dynamic_programming"
  | "sliding_window"
  | string;
```

## Runtime spec

```ts
type RuntimeSpec = {
  language: "python";
  signature: string;
  entrypoint: string;
  importsAllowed: string[];
  timeLimitMs: number;
  memoryLimitMb?: number;
  timelineEventCap: number;
};
```

Initial MVP supports Python only.

## Story spec

```ts
type StorySpec = {
  worldName: string;
  premise: string;
  playerRole: string;
  dataMetaphor: string;
  targetMetaphor?: string;
  readMetaphor?: string;
  victoryText: string;
  failureText: string;
};
```

All worlds must be original. Do not use real-game characters, logos, maps, or UI.

## Scene spec

```ts
type SceneSpec = {
  type: "array" | "linked_list" | "tree" | "graph" | "custom";
  renderer: string;
  smallInputMode?: string;
  largeInputMode?: string;
  visualTokens: Record<string, string>;
  trackedVariables: string[];
  outcomeVisuals: Record<RunStatus, string>;
};
```

Required outcome visuals:

- `passed`
- `wrong_answer`
- `compile_error`
- `runtime_error`
- `over_budget`
- `loop_guard`
- `off_end_read`

## Quest spec

```ts
type QuestSpec = {
  id: string;
  order: number;
  title: string;
  brief: string;
  learningGoal: string;
  signature: string;
  starterCode: string;
  hints: HintSpec[];
  solution: SolutionSpec;
  tests: TestSuiteSpec;
  budget: BudgetSpec;
  unlock: UnlockSpec;
  rewards: RewardGrantSpec;
};
```

Rules:

- A pack must have 2-8 quests.
- Starter code should contain only the signature, a short docstring/comment, and `pass`.
- Hints should be questions, not answers.
- The final quest should bridge cleanly into the boss signature.

## Hints

```ts
type HintSpec = {
  id: string;
  text: string;
  cost?: "free" | "reduces_reward";
};
```

## Solution

```ts
type SolutionSpec = {
  code: string;
  explanation: string;
  complexity: {
    time: string;
    space: string;
  };
};
```

Opening a solution before clearing the boss marks the clear as `solution_assisted` and reduces rewards/stats credit.

## Tests

```ts
type TestSuiteSpec = {
  fixed: TestCaseSpec[];
  random?: RandomTestSpec;
  replayCaseIds: string[];
};

type TestCaseSpec = {
  id: string;
  name: string;
  input: Record<string, JsonValue>;
  expected: JsonValue;
  hidden?: boolean;
  tags?: string[];
};

type RandomTestSpec = {
  generator: string;
  count: number;
  seed?: string;
  sizeRange?: [number, number];
};
```

Fixed edge cases come first. Random large tests catch complexity shortcuts.

## Budgets

```ts
type BudgetSpec = {
  enabled: boolean;
  unit: "array_read" | "node_read" | "field_read";
  formula?: string;
  absoluteLimit?: number;
  referenceHeadroomMultiplier?: number;
  failureMode: "hard_fail" | "badge_only";
};
```

For budgeted binary-search style quests, a linear scan should fail large tests on reads even if it returns the correct answer.

## Unlocks

```ts
type UnlockSpec = {
  requiresQuestIds: string[];
  requiresPassed: boolean;
};
```

Quests unlock in order for MVP.

## Boss spec

```ts
type BossSpec = {
  id: string;
  title: string;
  brief: string;
  signature: string;
  starterCode: string;
  tests: TestSuiteSpec;
  budget: BudgetSpec;
  solution: SolutionSpec;
  unlock: UnlockSpec;
  retryPolicy: {
    failedAttempts: "free_retry_with_history";
  };
  rewards: RewardGrantSpec;
};
```

Boss failures are free retries. Failed attempts are saved for replay/debugging.

## Review spec

```ts
type ReviewSpec = {
  enabled: boolean;
  defaultSchedule: number[];
  variants: ReviewVariantSpec[];
  rules: {
    failedReviewIntervalDays: number;
    solutionAssistedIntervalDays: number;
    heavyHintMaxIntervalDays: number;
    snoozeAllowed: boolean;
  };
};

type ReviewVariantSpec = {
  id: string;
  title: string;
  mutation: string;
  tests: TestSuiteSpec;
};
```

Initial schedule: 1, 3, 7, 14, 30 days. Failures and solution-assisted clears return tomorrow.

## Rewards

```ts
type RewardSpec = {
  xp: {
    questClear: number;
    bossClear: number;
    solutionAssistedMultiplier: number;
  };
  currency: {
    name: string;
    bossClear: number;
    shopEnabled: false;
  };
};

type RewardGrantSpec = {
  xp: number;
  currency?: number;
};
```

MVP uses XP plus a cosmetic placeholder currency. No shop is required.

## Validation spec

```ts
type ValidationSpec = {
  referenceMustPass: boolean;
  linearScanShouldFailBudget?: boolean;
  requiredOutcomeFixtures: RunStatus[];
  maxTimelineEvents: number;
};
```

Validator requirements:

- Required fields are present.
- IDs are unique.
- Quest count is 2-8.
- Reference solutions pass fixed and random tests.
- Budgeted packs include at least one complexity trap where a slower correct approach exceeds budget.
- Required outcome fixtures exist for renderer smoke checks.
- Original-content checklist is complete.

## Minimal example skeleton

```json
{
  "schemaVersion": "quest-pack.v0",
  "id": "timequake-search-rotated-array",
  "slug": "timequake-search-rotated-array",
  "title": "Timequake: Search the Rotated Vault",
  "status": "draft",
  "metadata": {
    "displayName": "Timequake",
    "shortDescription": "Find a target in a shifted sorted array by reading as few rooms as possible.",
    "difficulty": "medium",
    "sourceInspiredBy": "Search in Rotated Sorted Array",
    "originalTextConfirmed": true,
    "authors": ["Eric Weng", "Hermes"],
    "createdAt": "2026-09-30T00:00:00.000Z",
    "updatedAt": "2026-09-30T00:00:00.000Z"
  },
  "story": {
    "worldName": "Timequake Vault",
    "premise": "A sorted vault hallway has been cracked and rotated by a timequake.",
    "playerRole": "Pathfinder",
    "dataMetaphor": "rooms",
    "targetMetaphor": "target relic level",
    "readMetaphor": "chrono peek",
    "victoryText": "The vault stabilizes around the found relic.",
    "failureText": "The hallway keeps shifting. Replay the path and fix the search."
  },
  "concepts": ["binary_search"],
  "runtime": {
    "language": "python",
    "signature": "class Solution:\n    def search(self, nums: List[int], target: int) -> int:",
    "entrypoint": "Solution().search",
    "importsAllowed": [],
    "timeLimitMs": 2000,
    "timelineEventCap": 3000
  },
  "scene": {
    "type": "array",
    "renderer": "array-doors-v0",
    "smallInputMode": "doors",
    "largeInputMode": "skyline",
    "visualTokens": { "read": "chrono-peek", "target": "relic" },
    "trackedVariables": ["l", "left", "r", "right", "mid"],
    "outcomeVisuals": {
      "passed": "gold_relic_glow",
      "wrong_answer": "red_wrong_room_green_expected",
      "compile_error": "broken_spell_scroll",
      "runtime_error": "spark_burst",
      "over_budget": "empty_chrono_meter",
      "loop_guard": "spinning_pathfinder",
      "off_end_read": "ghost_room_fall"
    }
  },
  "quests": [],
  "boss": {
    "id": "boss-search",
    "title": "Boss: Stabilize the Rotated Vault",
    "brief": "Return the index of the target relic, or -1 if it is absent.",
    "signature": "class Solution:\n    def search(self, nums: List[int], target: int) -> int:",
    "starterCode": "class Solution:\n    def search(self, nums: List[int], target: int) -> int:\n        # Find target in the rotated sorted hallway.\n        pass\n",
    "tests": { "fixed": [], "replayCaseIds": [] },
    "budget": { "enabled": true, "unit": "array_read", "formula": "4 * ceil(log2(n + 1)) + 8", "failureMode": "hard_fail" },
    "solution": { "code": "", "explanation": "", "complexity": { "time": "O(log n)", "space": "O(1)" } },
    "unlock": { "requiresQuestIds": [], "requiresPassed": true },
    "retryPolicy": { "failedAttempts": "free_retry_with_history" },
    "rewards": { "xp": 100, "currency": 1 }
  },
  "review": {
    "enabled": true,
    "defaultSchedule": [1, 3, 7, 14, 30],
    "variants": [],
    "rules": {
      "failedReviewIntervalDays": 1,
      "solutionAssistedIntervalDays": 1,
      "heavyHintMaxIntervalDays": 3,
      "snoozeAllowed": true
    }
  },
  "rewards": {
    "xp": { "questClear": 20, "bossClear": 100, "solutionAssistedMultiplier": 0.5 },
    "currency": { "name": "Shards", "bossClear": 1, "shopEnabled": false }
  },
  "validation": {
    "referenceMustPass": true,
    "linearScanShouldFailBudget": true,
    "requiredOutcomeFixtures": ["passed", "wrong_answer", "compile_error", "runtime_error", "over_budget", "loop_guard", "off_end_read"],
    "maxTimelineEvents": 3000
  }
}
```