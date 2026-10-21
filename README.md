# Splash

Splash is a browser-based color-mixing puzzle. The interface is in `index.html`,
`styles.css`, and `app.js`; the shared solving engine is in `search.js`.

## Auto Play

Auto Play searches for a complete legal continuation, verifies it, and then
plays the moves on the board. Its current algorithm combines several search
strategies because different deals need different approaches. It uses general
search rules and rankings, without recognizing archived boards or loading saved
solutions.

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
most of the initial computation budget. This established portfolio runs for the
first four minutes of solver computation, preserving fast solutions on earlier
regression boards.

### Adaptive search for harder deals

If no strategy has finished after four minutes, Auto Play closes the initial
searches and switches to two stronger approaches:

- **Five independent beam searches** retain separate frontiers with widths
  128, 128, 256, 1024, and 1024. Their rankings vary color priorities, clearance
  rewards, group preferences, and seeded variation; one uses equal color
  weights. Separate frontiers keep one ranking from crowding out the others.
- **Expanded bridge planning** explores more candidate bridge goals, helper
  combinations, and paths, retrying with different rankings.

The adaptive beams share roughly 300-millisecond computation slices with
200-millisecond slices for expanded bridge planning. Within the beam portfolio,
smaller slices keep each ranking moving forward.

For the best 16 candidates in each adaptive beam layer, positions with at most
24 occupied cells receive an exact endgame probe. Each probe is bounded to
50,000 search calls and can solve disconnected occupied components separately.
Only proven failures enter its failure cache: hitting a probe budget means
“unknown.” Viability checks also reject positions whose remaining ingredients
and shared donors cannot support the required clearances. Compact bitsets,
bounded caches, and duplicate-state checks reduce search cost and memory use.

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

### Validated performance

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
SPLASH_TEST_JOBS=1 node tests/timeout-beam.cjs
SPLASH_TEST_JOBS=1 node tests/hard-timeout.cjs
```

The hard-board suite uses original deals only, independently validates every
move, and enforces the fifteen-minute computation ceiling. The earlier-board
suite retains its five-minute ceiling.
