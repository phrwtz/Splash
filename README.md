# Splash

Splash is a browser-based color-mixing puzzle. The interface is in `index.html`,
`styles.css`, and `app.js`; the shared solving engine is in `search.js`.

## Auto Play

Auto Play searches for a complete legal continuation, verifies it, and then
plays the moves on the board. Its current algorithm combines several search
strategies because different deals need different approaches. It uses general
search rules and rankings, without recognizing archived boards or loading saved
solutions.

### Display modes

Choose **Animate moves** to watch the verified solution, or **No display** to
keep the original deal visible throughout search and playback. No display
updates the board when the next deal starts. Both modes search in a background
worker when available and support Stop. The former Display search process
option has been removed.

### Initial search

A group-planning strategy gets a short initial attempt (about one second of
computation). Auto Play then shares computation between:

- **Beam search:** explores legal transfers across the board, retaining a
  bounded set of promising positions at each depth. Standard, wide, and varied
  searches use widths of 256, 512, and 64. Alternative rankings and seeded
  variation let retries explore different continuations.
- **Diagnostic search:** combines strategic planning with move-tree search and
  bounded continuation checks. Its exhaustive search can establish proofs when
  it finishes.
- **Bridge planning:** looks ahead for interacting color groups and helper
  transfers that connect ingredients needed for later clearances.
- **Group planning:** tries alternative group priorities and restarts its
  ranking periodically while the other searches retain their progress.

These searches run cooperatively in short execution slices. Beam search gets
most of the initial computation budget. After the first minute, a separate
shared-ingredient beam gets up to 90 seconds of uninterrupted computation.
It retains its frontier if unfinished. The established searches then resume
until they have received their original three-and-a-half-minute computation
budget. The donor turn is charged separately. Deals solved within the first
minute follow the existing path.

### Adaptive search for harder deals

If the established searches use three and a half minutes without finishing,
Auto Play closes those initial
searches and combines four complementary approaches:

- **Seven independent beam searches** retain separate frontiers with widths
  128, 128, 256, 1024, 1024, 512, and 64. Their rankings vary color priorities, clearance
  rewards, group preferences, and seeded variation; one uses equal color
  weights. Separate frontiers keep one ranking from crowding out the others.
- **Shared-ingredient beam search:** a separate width-512 frontier checks
  optimistic routes from each primary tile to its missing ingredients. Maximum
  matching prevents several tiles from relying on the same donor. Distance and
  capacity checks reject secondary regions that cannot reach a complementary
  primary. This lane varies all six color weights, clearance rewards, group
  rewards, and noise between attempts. Its scoring reproduces the native
  search used to investigate the October 24 timeout, using integer pairs in
  the expansion loop. Only policy generation uses BigInt.

- **Expanded bridge planning** explores more candidate bridge goals, helper
  combinations, and paths, retrying with different rankings.

- **Retained group planning** continues alongside the other strategies. It
  restarts with a new ranking after each 15 seconds of its own computation.

The adaptive portfolio shares roughly 400-millisecond beam slices,
120-millisecond shared-ingredient slices, 200-millisecond bridge slices, and
150-millisecond group-planning slices. Within the established beam portfolio,
each ranking has its own allocation; the wider
512-position clearance ranking receives more time because it can uncover
continuations missed by the other rankings.

For the best 16 candidates in each adaptive beam layer, positions with at most
24 occupied cells receive an exact endgame probe. Each probe is bounded to
50,000 search calls and can solve disconnected occupied components separately.
The shared-ingredient lane instead checks the best eight candidates after
move 24, with at most 20 occupied cells and 15,000 calls per probe.
Only proven failures enter the failure caches: hitting a probe budget means
“unknown.” Viability checks also reject positions whose remaining ingredients
and shared donors cannot support the required clearances. Compact bitsets,
bounded caches, and duplicate-state checks reduce search cost and memory use.
Incremental scoring updates only removed cells and their neighbors. Bounded
caches reuse occupancy contributions and unchanged color groups while preserving
exact scores and candidate order. Once a beam is full, candidates below its
score cutoff skip expensive feasibility checks.

### Verification, responsiveness, and time limits

Before playback, the solver replays the entire proposed continuation and checks
that every transfer is legal and the board ends empty. The interface also
checks moves against the displayed board. A promising partial clearance alone
is insufficient to start playback.

Planning normally runs in a Web Worker to keep the interface responsive. If
workers are unavailable or fail, Auto Play can fall back to the same shared
solver on the page. Search checkpoints allow progress reporting, cancellation,
and deadline checks, including while scanning rejected helper combinations.
Stop cancels the active planning work.

The selected time limit counts computation inside solver calls. Animation,
display pauses, and browser scheduling waits are excluded, so elapsed wall time
can be longer. The default is **five minutes per board**. On timeout, Auto Play
records the original deal and advances according to the selected mode. A time
limit, failed beam attempt, or bounded endgame probe is never an impossibility
proof; an “unsolvable” result requires a conclusive proof.

### October 24 timeout investigation

An additional deal that had timed out after one hour was solved by a native
search combining shared-ingredient matching with broader color priorities.
The JavaScript port of that lane solved the original deal in 24.3 seconds
when tested alone. With the bounded turn in the complete Auto Play search,
it solved in 96.0 seconds, within the default five-minute limit; all 40 moves
were independently replayed. A real browser worker completed the same deal
in 137.0 seconds, with all 40 moves checked through the UI; Stop, worker-free
fallback, custom timeouts, and original-board archiving passed as well.
All 24 earlier regression deals passed their unchanged five-minute limits.
Auto Play gives
this lane a bounded turn after one minute, then retains it in the adaptive
portfolio if needed.
These timings describe different execution contexts; the standalone lane
measurement is not a full Auto Play timing.

`node tests/resource-beam.cjs` checks the rejection rule against an independent
exhaustive oracle on 17,643 balanced mixed boards and validates the ranking hash
against independent 64-bit arithmetic. `node tests/oct24-timeout.cjs` tests the
original deal through the complete Auto Play search, independently validates
all moves, and enforces the default five-minute computation limit. The fixture
contains only the starting colors.

### October 22 validated performance

The revised engine solved all five new fifteen-minute timeout deals in
4m41s, 8m53s, 8m51s, 8m49s, and 5m15s of computation, with all 200 moves
independently replayed. All 24 original boards passed their unchanged five-minute
limit. Browser testing of new board 3 passed in about 8m41s, including all
40 UI-validated moves, Stop, worker-free fallback, and timeout archiving.
All twelve earlier hard boards also passed the unchanged fifteen-minute cap,
taking 3m00s–14m09s, with all 480 moves independently replayed. The original
24-board suite took approximately 11–166 seconds per board. These are measured
results for these deals; timings vary with hardware and browser.

### Previous validated performance

The October 21, 2026 version solved all twelve archived boards that had
previously timed out after one hour. Each passed a **fifteen-minute computation
limit**, with measured times from **3 minutes 23 seconds to 14 minutes 20
seconds**. All 480 moves were independently replayed. All 24 earlier regression
boards also passed the unchanged five-minute limit, taking approximately
13–191 seconds each.

A real-browser run of hard board 14 finished in about 6 minutes 33 seconds and
validated all 40 moves through the UI. Stop, worker-free fallback, and custom
timeout/archive checks passed as well. These are measured results for the tested
deals; performance varies with hardware, browser, and board.

Reload Splash after updating the files. Select **15 minutes** when retrying
these hard archived boards; the default remains five minutes.

## Tests

See [tests/README.md](tests/README.md) for detailed coverage and browser setup.
Useful commands from the project directory include:

```sh
node tests/search.cjs
node tests/beam-search.cjs
node tests/beam-endgame.cjs
node tests/resource-beam.cjs
node tests/beam-frontier-parity.cjs
SPLASH_TEST_JOBS=1 node tests/timeout-beam.cjs
SPLASH_TEST_JOBS=1 node tests/hard-timeout.cjs
SPLASH_TEST_JOBS=1 node tests/oct22-timeout.cjs
SPLASH_TEST_JOBS=1 node tests/oct24-timeout.cjs
```

The hard-board suite uses original deals only, independently validates every
move, and enforces the fifteen-minute computation ceiling. The earlier-board
suite retains its five-minute ceiling.

## Display page

Open `https://phrwtz.github.io/Splash/Display/` for an unattended animated Auto Play display. It starts automatically with a one-minute computation limit per board, hides instructions and controls, and shows “Solving Splash Boards” with only the Solved, Proved unsolvable, and Timed out counts. Proven-unsolvable boards advance to the next deal in this page. The main game remains at `/Splash/`.

Display mode does not load or save board archives, retain failed boards, or download them. Timed-out and proved-unsolvable boards are counted and discarded before continuing to the next deal. The main game still supports saving boards.
