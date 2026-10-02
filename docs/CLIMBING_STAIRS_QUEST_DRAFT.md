# Climbing Stairs Quest Draft — 1-DP

## Source artifact

`Forest_of_Patience_Dojo_Climbing_Stairs.html` describes a Forest of Patience-style dojo for Climbing Stairs. The Quest Coder version keeps the story and quest structure, but implements it as an original quest pack in the current Cyberpunk Bit app shell.

## Category

- Category: `1-DP`
- Topic: Dynamic Programming
- Pattern: Fibonacci recurrence / one-dimensional DP
- Core recurrence: `ways(n) = ways(n - 1) + ways(n - 2)`

## Story

The player enters the **Forest of Patience Dojo**, a jump-quest forest where every tower is made of ledges. From any ledge, the climber can move up by:

- one normal hop
- one two-ledge Flash Jump

Ranger Wren teaches the player that every route to a ledge must have arrived from one of the two ledges below it. The boss, **Old Bramblehorn**, guards the summit flag and only opens the gate when the player can count all routes for any tower in one clean climb.

## Implemented quest pack

- File: `content/packs/forest-of-patience-climbing-stairs.json`
- Display name: `Climbing Stairs`
- Slug: `forest-of-patience-climbing-stairs`
- App wiring: imported as `climbingStairsPack` in `app/page.tsx`

## Quest path

### Quest 1 — The last jump

Goal: discover the recurrence directly.

Function:

```python
def count_routes(n):
    ...
```

Teaching point:

- Every route to ledge `n` ends from `n - 1` or `n - 2`.
- Recursive recurrence is easy to understand but repeats work.

Reference complexity:

- Time: `O(2^n)`
- Space: `O(n)` recursion stack

### Quest 2 — The route scroll

Goal: turn repeated recursion into bottom-up tabulation.

Function:

```python
def fill_scroll(n):
    ...
```

Expected return:

```python
[ways to ledge 0, ways to ledge 1, ..., ways to ledge n]
```

Teaching point:

- Write each ledge count once.
- `ways[i] = ways[i - 1] + ways[i - 2]`.

Reference complexity:

- Time: `O(n)`
- Space: `O(n)`

### Quest 3 — Two-slot pouch

Goal: compress the DP table to two variables.

Function:

```python
def next_pair(a, b):
    ...
```

Teaching point:

- If `a` is ways to ledge `i - 2` and `b` is ways to ledge `i - 1`, then the next pouch is `(b, a + b)`.
- This is the space-optimized transition.

Reference complexity:

- Time: `O(1)`
- Space: `O(1)`

### Boss — Old Bramblehorn

Goal: solve the real Climbing Stairs problem.

Signature:

```python
class Solution:
    def climbStairs(self, n: int) -> int:
        ...
```

Teaching point:

- Use the recurrence from Quest 1.
- Avoid repeated work with Quest 2 or Quest 3.
- Preferred final solution uses the two-slot pouch.

Reference complexity:

- Time: `O(n)`
- Space: `O(1)`

## Verification

Added smoke command:

```bash
npm run smoke:climbing-stairs
```

The smoke test checks:

- pack metadata and category
- Forest of Patience story tokens
- quest order and DP progression
- all reference solutions pass through the runner
- app imports and wires the new pack
