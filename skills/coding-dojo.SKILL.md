---
name: coding-dojo
description: Build an interactive, game-themed coding practice page for a LeetCode-style problem, with a real in-browser Python runner, test suites, Big-O "budgets," and animated replays that step through the user's code line by line while a scene shows what the data structure is doing. Use this whenever the user wants to practice, code, or be quizzed on an algorithm problem inside an artifact, asks for a "compiler," "code runner," "playground," "dojo," or "somewhere I can write code and run tests," wants to see why their solution fails, or wants their past attempts replayed visually, even if they don't say "dojo."
---

# Coding Dojo

A coding dojo is one self-contained published HTML page where the user works through a problem as a series of small quests. Each quest has a code editor, a Run button that executes Python in the browser against hidden tests, and a replay theater that animates every test: the scene (rooms, portals, islands, whatever fits the data structure) shows each read of the input, while a code panel highlights the line being executed and shows the variables at that moment.

The goal is understanding, not answers. The user writes the code, the dojo shows them exactly what their code did, and the solution stays hidden behind a "Solution scroll" until they ask for it.

## Workflow

1. **Pick the problem and the world.** Confirm the LeetCode problem and the theme the user likes (a game, a sport, a place). Draw everything as original art in the spirit of that world: never use a real game's characters, monsters, logos, maps, or UI. Name the pieces in the world's terms (array → hallway of rooms, linked list → chain of portals, target → the monster level you're hunting, reading an element → spending a Teleport Rock).

2. **Split the problem into quests.** Three to five quests, each a small function that isolates one idea, ending with the real signature. For Search in Rotated Sorted Array that was: plain binary search → find the cliff → which half is smooth (3 reads) → could the target be in this sorted stretch (2 reads) → the full `class Solution`. Each quest gets:
   - a short brief in the world's language, with the exact function signature
   - starter code that is only the signature, a docstring-style comment, and `pass`
   - two to four hint scrolls written as **questions**, never as answers
   - a Solution scroll (collapsed) with the reference solution and a two-sentence explanation

3. **Design the tests.** Fixed edge cases first (empty or one element, two elements, no rotation, target missing, target at either end), then random large cases (600–1,000 elements) generated in JavaScript. Cache the generated tests per quest so "Your spell" and "Run the solution" use the same inputs, and offer a "New random tests" button.

4. **Enforce complexity with a read budget.** Wrap the input so every element read is counted, then fail large tests that go over a budget such as `c × bit_length(n) + k`. Pick `c` by running the reference solution and checking its worst case; leave headroom so any reasonable O(log n) solution passes and any linear scan fails. Quests that allow O(n) get a bonus badge instead of a hard budget.

5. **Build the page from the engine template** in `assets/dojo-engine.html` (see "Engine" below). Fill in `QUESTS`, `SOLUTIONS`, `SOL_NOTES`, and optionally `CHAT_ATTEMPTS` (code the user pasted in chat, so they can replay it). Swap the scene renderer if the data structure isn't an array.

6. **Verify in a headless browser before publishing** (see "Verification"). Never hand over a runner you haven't executed.

7. **Publish, then keep updating the same artifact.** The user's code, attempt history, and cleared quests live in the page's own browser storage, so later changes must republish to the same artifact URL or that work disappears.

## Engine

The template already solves everything below. When changing it, keep these behaviors.

### Python in the page (Brython)

- Load `https://cdn.jsdelivr.net/npm/brython@3.14.3/brython.min.js` **and** `brython_stdlib.js` with script tags (both are scripts, so the published page allows them). `import sys` fails without the stdlib file. Show a status pill while loading, and a clear message if the engine can't start.
- Call `brython({debug:0})` once, then run the harness with `__BRYTHON__.runPythonSource(src)`.
- Pass data in through `window.*` properties and wrap every one in `str(...)` on the Python side. They arrive as JS strings, and `exec` or `compile` on them crashes.
- Use `exec(src, ns)`, not `compile(...)`. Brython's `compile` crashes on type annotations like `nums: List[int]`.
- Send tests in as a Python literal (JSON of ints and lists works) and `eval` it. Send results back by calling a JS function such as `window.qReport(i, repr(got), peeks, err, timeline)` with plain strings and numbers.
- Provide `List` and `Optional` in the namespace as dummy subscriptable objects so LeetCode signatures work without imports.
- Frames from the user's code have `co_filename == '<string>'`. Use that to find the user's line number in tracebacks.

### Counting reads (Teleport Rocks)

Wrap the input list in a `Rooms` class that counts reads: `__getitem__` counts 1 (a slice counts its length), and `__iter__`, `__contains__`, `index`, and `count` count one per element. `len()` is free. Record out-of-range indexes as an "off the end" event before letting the real `IndexError` happen, so the replay can show the character falling.

### Line tracing and variable capture

Rewrite the user's code on the same line numbers before running it:

- a simple statement `x = ...` becomes `__ln(N); x = ...`
- `if` / `elif` / `while` conditions become `if __ln(N) and (cond):`, and `while` also gets `__tick() and` in front
- `for t in it:` becomes `for t in __iterln(N, it):`
- lines are skipped when they're continuations (open brackets, backslashes, or triple-quoted strings) or when they start with `else`, `try`, `except`, `finally`, `with`, `def`, `class`, or `@`

Find the header colon with a small scanner that tracks bracket depth and string quotes, so slices, dicts, and strings containing `:` or `#` don't break it. Build a list of candidate sources and run the first one that compiles: traced, then untraced, then the original. If tracing produces a syntax error, the tests still run, and the replay notes that only the scene is shown.

`__ln` and each read append one entry to a shared timeline, capped at 3,000 entries: `L:line:l:r:mid` or `P:index:l:r:mid:offEnd`. To capture variables, walk `sys._getframe()` up to the first frame with `co_filename == '<string>'`, then read `f_locals` with `k in loc` and `loc[k]`. It's a JSObject, so `.items()` doesn't work. Recognize common names: `l / left / lo / low`, `r / right / hi / high`, and `mid / m / middle`.

**Brython bug:** for functions defined inside a class, `f_locals` returns the class or instance instead of the locals. Work around it by replacing the `class Solution:` line with `if True:` (same line count), collecting the method names at that indent, and rebuilding the class after `exec` with `type('Solution', (), {...})`.

### Infinite loops

Brython runs on the main thread, so a runaway loop freezes the tab. `__tick()` raises a `LoopGuard` error after 200,000 iterations, and the error message tells the user to check that `l` or `r` always moves.

## Replay theater

Frames are `intro` → one frame per timeline entry → `more` (when the timeline was truncated or a loop was stopped) → `end`. Playback speed adapts to the frame count, so a 3,000-frame linear scan still finishes in a few seconds, and the user can change the speed.

Each frame shows:

- **the scene.** Draw each element as a door when there are 16 or fewer. Above that, switch to a skyline where each element is a bar whose height is its value, so rotations and cliffs are visible. Show dots for elements already read, a dashed line at the target value, and a shaded band between `l` and `r`.
- **a hero character** standing at the most recent read, with `l` / `mid` / `r` tags on the matching elements.
- **a rock meter** that turns red the moment the read budget is exceeded.
- **a code panel** with the current line highlighted gold, auto-scrolled into view. On the end frame the final line turns green for a pass or red for a failure.
- **narration** such as "Line 5: mid = (l + r) // 2 (l=0, r=5)" or "Peek 3: room 2 holds Lv 5."

Every outcome needs its own visual:

- **found:** the answer element glows gold and the hero cheers
- **correctly returned -1:** everything is revealed and no element glows
- **wrong answer:** the returned element is red and the expected one is outlined green
- **off the end:** a dashed ghost element appears past the edge and the hero falls
- **stuck in a loop:** the hero spins, and the narration explains the edges stopped moving
- **over budget:** "right answer, but it took X reads and the budget is Y"

After a run, open the first failing test's replay automatically. If every test passes, play a victory parade through all of them.

## Editor and page details

- **Turn off font ligatures** on every code surface: `font-variant-ligatures: none; font-feature-settings: "liga" 0, "calt" 0`. Fonts like JetBrains Mono otherwise draw `<=` as ≤ and squash `//`, which users read as the compiler changing their code.
- The editor is a textarea with a line-number gutter. Tab and Shift+Tab indent by 4 spaces, Enter auto-indents (adding 4 after a line ending in `:`), Backspace removes 4 spaces at a time, and Ctrl/Cmd+Enter runs.
- Save code per quest in `localStorage`, wrapped in try/catch. Save an attempt snapshot on every run, capped at about 15 per quest, and keep chat-provided attempts at the front.
- Include a Spellbook tab that shows every quest's current code next to the solution, with the last result for each.
- Follow the published-page rules: one self-contained file, a viewport tag with `viewport-fit=cover`, safe-area padding, light and dark color tokens, and responsive layout, with wide content scrolling inside its own container.

## Verification

Before publishing, run the page in headless Chromium: Playwright is installed, and a Chromium binary is at `/opt/pw-browsers/chromium-*/chrome-linux/chrome`. Serve a copy of the page with the Brython files vendored locally (`npm pack brython@3.14.3`), since the sandbox can't reach the CDN. Run the server from inside the Playwright script, because background servers die between shell calls. Then check:

- each quest's reference solution passes every test within budget
- a linear-scan version of each budgeted quest fails only on the budget
- an infinite loop, an off-by-one, a missing function name, a syntax error, and a runtime error each show the right message and line number
- a replay of a passing and a failing test steps through the right lines with the right `l` / `mid` / `r` values
- the page reports no errors, and screenshots of the scene and code panel look right at desktop width

Tell the user what was verified and what couldn't be, especially that the published page's security rules can't be tested here, and that the status pill will say so if they block the engine.

## Adapting to other problems

- **Linked lists:** nodes become islands or maps connected by portals. Count `.next` reads instead of indexes by wrapping each node in a counting proxy, and draw cycles as a curved portal back.
- **Two pointers or sliding window:** keep the rooms scene and shade the window between the two pointers.
- **Trees:** lay out a node diagram, and count reads of `.left` and `.right`.

Keep the harness, tracing, replay frames, and verification steps the same, and swap only the scene renderer and the read-counting wrapper.

## Bundled files (to add after this draft is approved)

- `assets/dojo-engine.html`: the working Timequake Dojo with its quest data replaced by a placeholder
- `references/brython-notes.md`: the Brython quirks above, with small reproducible snippets
- `scripts/verify_dojo.py`: the headless-browser checker, which takes a page path and a JSON file of code cases to run
