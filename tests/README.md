# Auto Play checks

Auto Play now requests progressive search: a planning pass of at most 2,048
steps finds easy complete plans, then promising legal moves animate immediately.
Established structural failures are rejected silently; failed speculative branches
are undone exactly, with proved failures cached during the run. Timeout restores
the original deal and remains unknown. Passing supply checks is never treated as
a proof of solvability. The default solver API retains silent verification for
callers requiring complete plans. Run `node tests/progressive.cjs` for the new
mode, including an independent oracle and real speculative reversal.

The verified mode uses persistent clearing plans and silent verification.
See [STRATEGIC_PLANNER.md](STRATEGIC_PLANNER.md) for the algorithm, resource
commitments, budget semantics, tests, and known limitations.

```sh
node tests/search.cjs
node tests/browser.cjs
node tests/strategy.cjs
node tests/planned-bridge.cjs
```

Optional historical-board timing runs: `node tests/planning-benchmark.cjs`.
A bounded run reporting `unknown` is inconclusive, not a successful solution test.
The browser suite requires Playwright; `PLAYWRIGHT_PATH` and
`PLAYWRIGHT_EXECUTABLE_PATH` can select existing installations.

The following notes describe earlier iterations. Their speculative first-move,
lookahead, and visible-backtracking behavior has been superseded by the strategic
planner. The structural obstruction explanations remain relevant.

## Historical notes


From the Splash folder:

```sh
node tests/search.cjs
node tests/browser.cjs
```

The browser checks require Playwright and its Chromium browser. They use a
separate headless browser with a controlled clock to verify the thirty-minute
limit, two-second solved-result waits, original-board restoration, session continuity, legal moves,
backtracking, actual forward/reverse animation, and cancellation. They do not
modify the game or save session counters. `PLAYWRIGHT_PATH` can point to an
existing Playwright installation if it is not on Node's module search path.
`PLAYWRIGHT_EXECUTABLE_PATH` can select an existing Chrome/Chromium executable.

Auto Play keeps one session across solved, proved-unsolvable, and timed-out runs.
Solved boards advance after two seconds. Proved-unsolvable and timed-out runs
restore the original deal (including undoing moves made before Auto Play), clear
move history, and stop immediately for manual play. The outcome remains visible.
Both timers include solved-result waits; result counts accumulate.
Stop freezes session time, and starting Auto Play again resumes its elapsed
time and counts, including after manually selecting New Board. Each board
still receives a fresh thirty-minute search deadline. Switching between Analysis
and Game preserves the session and its accumulated counts.
Session state lives in memory, so terminating or reloading Splash also clears
it. Clock-controlled tests cover these transitions.

The pure search checks need only Node. They compare all balanced colorings on
three small graphs with an independent exhaustive oracle and verify the
full-board trapped-primary counterexample and forward/backtrack consistency.
They also check successor lookahead against an independent oracle on balanced
mixed-color boards and verify that trapped secondary colors are rejected.
Browser checks cover silent lookahead, including unchanged tiles/history and
responsive Stop/deadline handling while moves are being discarded.

See [TRAP_DETECTION.md](TRAP_DETECTION.md) for the mixed-board failure,
the generalized proof checks, validation, and further efficiency options.

The bottleneck regressions reconstruct the two user-provided boards, check all
six primary-color permutations, and verify that a legal move creating a
mandatory-color conflict is never emitted as a forward move. Browser checks
verify immediate rejection without animation and successful clearing of the
solvable board. Additional mixed random graphs exercise alternative routes and
blob transfers against the independent oracle.

Two-move lookahead has a regression where one-step assessment passes but every
second move fails. Local file-mode browser checks also exercise the Auto Play
button in Analysis mode, successful clearing, Stop, and control restoration.

Autoplay performs bounded deeper analysis on every candidate, including large
components, then animates unresolved moves and backtracks as needed. Tests
cover bounded first-animation latency and correct fallback after budget exhaustion.

The blue-conflict screenshot checks first-mix supplier matching under all six
color permutations, plus immediate browser rejection without animation.

The orange-conflict fixture verifies that unmixable primary cells cannot act
as future secondary bridges, including a legal move that removes a supply.

The disconnected-colors fixture checks that required secondary bridges cannot
also donate their own primary tiles. Includes 500 larger mixed-graph oracle checks.

Forced-clear checks verify the screenshot pair, alternative clearing partners,
and safe balanced splits; the browser verifies the exact rejection reason.

The yellow-link fixture checks local conversion ordering; a small independent
oracle and a solvable bypass variant guard against over-pruning.

Component reuse tests verify that moves in a separate small region do not
restart lookahead on an unchanged large region.

Pocket supply checks reject both September 27 screenshots without lookahead
or animation under every primary-color permutation. An independent oracle
verifies a smaller obstruction and its solvable bypass; 1,000 single-exit
graphs and an explicit crossing-blob case guard against false rejection.

Purple-bridge distance checks reject the latest screenshot before any move,
under all color permutations and with zero, small, or default lookahead.
Independent oracle checks cover a smaller conflict, its solvable bypass,
shared supplies for existing secondaries, and an exact-capacity bridge.

Forced-mix regressions check that a primary leaf moves into its sole partner
to join a secondary bridge before unrelated moves, under all color names.
Independent oracle cases preserve alternate partners and larger blobs; the
browser checks the pictured forced move and subsequent correct backtracking.

The next forced-leaf fixture allows other donors of the leaf's color beside
its target. It verifies (4,7) -> (3,7) before optional moves, under all color
permutations, and guards against forcing when a third primary offers another
bridge. A small independent oracle verifies both cases.

September 28 endgame checks reconstruct the 19-tile screenshot that passes
structural assessment but is unsolvable. Components with at most 20 colored
tiles now receive a complete, cooperative proof before any move is animated,
even when the ordinary lookahead budget is zero. A reconstructed solvable
predecessor is cleared without entering the trap or backtracking. Browser
checks use the real proof to verify unchanged tiles/history, Stop, deadline
classification as Timed out, and eventual rejection without animation.
Larger components retain bounded lookahead and backtracking; exhausting that
budget does not prove a move safe. `endgameTiles: 0` disables the endgame policy
in tests that specifically exercise the larger-board fallback.

Failed-branch recovery checks cover the 28-tile September 28 screenshot.
After undoing a failed visible branch, Auto Play now proves the restored
position completely before trying another sibling, regardless of component
size. Independent oracle cases verify a winning alternative is preserved and
an impossible position unwinds through multiple ancestors. The real browser
search verifies that recovery is silent and interruptible, that a deadline
still counts as Timed out, and that failure restores the original board and
halts without creating another board.

The later September 28 orange-tile screenshot is now rejected structurally,
before any lookahead or animation: its orange bridge and other red tiles
require four yellow donors from a group containing three. Necessary secondary
colors propagate into other bridge capacities; a shortest-path lower bound
counts only demands not already charged to the shared pool. Tests cover all
six color permutations, zero/default lookahead, an independent smaller proof,
a solvable bypass, 1,500 mixed graphs, and immediate browser rejection.

Harder boards still report a count of positions examined since the latest forward move or undo and switch
from Backtracking to Checking alternatives during recovery. Progress and
cancellation checks use the earlier backtrack-trap fixture now that the orange
board no longer reaches recovery. The thirty-minute limit remains unchanged.

September 29 green-bridge regression (`node tests/green-bridge.cjs`) reconstructs
the 25-tile screenshot. Exact endgame proof now covers up to 25 occupied tiles
and rejects this board without animation. Search reuses mandatory-color
reservations to prioritize bridge construction and omit moves that sacrifice
a primary cell required by a bridge. All other alternatives remain available.
The test also checks bridge-first ordering under all six primary-color permutations.

Strategic resource checks (`node tests/strategy.cjs`) count required future
bridge tiles as clearing obligations, not only secondaries already present.
Distinct complementary supplies must cover all those obligations together.
Reserved primary tiles cannot also be spent as complements elsewhere, while
whole-blob transfer reachability is retained. Independent exhaustive tests
cover an impossible shared-supply position, a solvable bypass under all six
color permutations, and transfer through a reserved blob member.

Current strategic recovery (September 29): the solver checks small secondary
bridge layouts as a subproblem, including donor assignments and competition
with colors elsewhere. Its optimistic layout relaxation may prove failure;
its bounded planner never treats budget exhaustion as failure.
`node tests/planned-bridge.cjs` covers the 30-tile screenshot under every color
permutation and a solvable deal recovered from two historical bad moves.

Auto Play retains legal move history across starts. A failed current position
can unwind several earlier moves and resume from an ancestor, retaining its
failed-position cache. Recovery analysis is bounded; untried alternatives
remain available. An incomplete or edited history triggers a fresh search of
the original deal before any unsolvable count is recorded. This restart uses
the same board deadline. Only exhaustion/proof at the original deal counts
as Proved unsolvable; dead branches do not increment that count.

Pocket-first move ordering (`node tests/pocket-priority.cjs`) detects small
imbalanced occupied pockets with a single connecting cell. It prioritizes
local transfers while preserving the connector; this does not prune any
alternative. The screenshot regression clears the upper-left pocket before
unrelated moves, under all six primary-color permutations.

Batch preparation (`node tests/batch-clear.cjs`) prioritizes converting a
connected group when it has sufficient adjacent donors and clearing supply
but only one cell connects it to that clearing supply. It finishes the
conversions before clearing, and preserves the connecting cell until last.
This is move ordering only; alternative plans remain available. The screenshot
regression checks all four upper blues become purple before any is cleared,
under all six primary-color permutations.

Single-use gate proof (`node tests/single-gate.cjs`): two or more same-color
primaries with one singleton primary gate cannot all clear if that gate has
at most one third-color donor and no secondary extension. The donor cannot
both convert the gate and remain as its bridge. Checks cover the screenshot
under all color permutations, zero browser animations, an independent small
obstruction, and a solvable added-donor bypass. History recovery still applies
when this proof detects a failed branch rather than the original deal.

October 1 single-anchor regression (`node tests/single-anchor.cjs`) reconstructs
the 26-tile screenshot. Bridge-layout proofs now include regions with just one
existing secondary tile. The upper orange cannot fund a route to enough blue
tiles; the solver rejects it immediately under all six primary-color permutations,
with zero or default lookahead. Browser checks verify no animation and an
unchanged board. Existing history recovery remains available. Stronger successor
proofs also avoid previously animated moves in two older unsolvable fixtures.

Yellow-blob supply preservation (`node tests/yellow-bridge.cjs`) reconstructs
the later October 1 screenshot. Clearing moves are penalized when they remove
access to surviving complementary primary supplies in possible secondary regions.
Consumed suppliers are excluded from this penalty. This is ordering only, not
a proof of impossibility; all candidate moves remain available to search.
The regression checks preparation of the upper-left yellow blob while retaining
the red/green bridge under all six color permutations and zero/default lookahead.
The browser suite verifies the first visible move preserves both bridge tiles.

October 4 eight-tile pocket regression: `node tests/eight-pocket.cjs` reconstructs
the screenshot with blues at (1,6) and (1,7). Pocket proof now includes eight
interior cells, retaining its 2,000-state budget and unknown-on-exhaustion rule.
Tests cover all color permutations, an independent exhaustive miniature, a
solvable added-link bypass, and zero browser search events or animations.

Rapid-retraction correction: after the short strategic pass, progressive mode
now silently checks up to 2,048 exact states at the current position. Before
each speculative move it checks up to 512 exact successor states. Exhaustion
remains unknown and never populates the proved-dead cache. This prevents
short failed branches from consuming animation time while preserving bounded
first-animation work on harder boards. `node tests/retracted-moves.cjs` covers
the screenshot under all six color permutations; browser checks require no
forward or reverse animations before its proof.

Green-exit regression: `node tests/green-exit.cjs` reconstructs the screenshot
with green at (5,3). A primary blob whose only boundary is a complementary
secondary must have enough buildable connected secondary cells to clear all
its primaries. Connected layout enumeration matches distinct original donors,
excluding all receiver cells from donation, with optimistic original-blob
access and a 256-layout limit. Exhaustion is unknown, never a proof. This
board has capacity two for three reds and is rejected structurally before
planning, in every color permutation. An independent exhaustive miniature
and solvable extra-donor bypass guard against false pruning.

Diagnostic stop: Auto Play sets `stopBeforeExhaustive: true`. If structural
and bridge checks provide no proof and bounded strategic planning finds no
complete solution, it emits an `exhaustive-required` diagnostic and returns
`paused` before any exact screening or speculative exploration. The app stops
without restoring/resetting the current position or counting an outcome. Its
status explains planner budget/vocabulary failure, supply-check completeness,
plans/positions examined, and best partial progress. Structural proofs and
verified strategic playback remain enabled. `node tests/stop-exhaustive.cjs`
and browser regressions cover the default halt; legacy fallback tests explicitly
disable this diagnostic option.

Current Auto Play policy: `strategyOnly: true`. The diagnostic halt is no longer
enabled. Planning starts with the full 120,000-step strategic budget; unfinished
passes double the group-plan budget, local effort, layouts, and donor assignment
variants, yielding between passes and during search. No exact move fallback or
speculative playback is entered. Structural proofs still reject impossible
positions; exhausting the strategic vocabulary never proves impossibility.
Stop and the existing board deadline remain effective. Cached exact-fallback
continuations are excluded from strategic-only runs. Run
`node tests/strategy-only.cjs` for widening, strategic playback, cancellation,
and cache-policy regressions.

Current playback compromise: Auto Play uses `strategyOnly: true, batchGroups: 6`.
It plans six complete group clearances (or all remaining tiles), checks the
residual board structurally and with bounded bridge allocation, and animates
that batch before planning again. Passing checks is not a full solvability
proof; batch events carry `continuationVerified: false` for unfinished boards.
Known rejected remainders never play. Stop resumes from actual tiles/history;
proved failed positions can still recover through legal history. Planning
status updates are throttled to 1.5 seconds without delaying computation.
`node tests/strategic-batches.cjs` and browser checks cover partial playback,
return to planning, cancellation/resume, and readable status.

Narrow-connection regression: `node tests/narrow-connection.cjs` reconstructs
the screenshot with the sole edge (3,5)-(4,5). The upper region has 8 red,
5 blue, and 3 yellow components. Importing missing yellow requires both
endpoints to become a connected purple bridge. Before that happens, balancing
the red-minus-blue difference requires three cross-edge mixes, each using
a distinct tile of the original lower blue blob, which contains only two.
The new structural cut-capacity proof runs on every assessment, including
intermediate strategic boards and pre-animation batch validation. Tests cover
color permutations, an independent small obstruction, a solvable alternate
route, random balanced cut graphs, and zero browser planning/animation events.

Top-yellow ordering regression: `node tests/top-yellows.cjs` reconstructs the
three-yellow group behind a two-red gate. Static donor matching admits a
three-cell purple layout, but converting the connecting blue severs the
remaining red/blue supply. A bounded local ordering proof includes whole
primary blobs and grants unlimited external donors, clearers, and possible
secondary connections. Even this optimistic model cannot clear the three
yellows. The proof checks at most nine local cells and 8,192 states; budget
exhaustion is unknown. It runs during all structural assessments and batch
validation. Color permutations, an independent small obstruction, a solvable
added donor contact, random balanced graphs, and browser checks guard both
soundness and immediate rejection. The historical two-move trap is now proved
by this local check before successor search.

Pipelined batches: each partial batch reports its predicted ending board and
legal history. Auto Play immediately starts a Web Worker to plan one next
strategic batch from that snapshot while the current batch animates. Playback
is checked against actual tiles before every event. The worker buffers at most
one future batch and coalesces progress messages. Stop, timeout, and errors
terminate pending workers; an interrupted batch resumes from actual history.
Unsupported workers fall back to cooperative strategic planning. The pure
solver factory is serialized into a Blob worker, allowing local file-mode
play without network requests. Browser checks verify that a future batch is
ready during current playback, live tiles remain untouched by planning, and
pending work is cancelled.

Small remaining-board validation: strategic-only runs now perform a bounded,
cooperative proof for at most 20 occupied tiles, with at most 16,384 proof
states (`proofTiles`/`proofStates`). It runs at planning entry and before a
partial batch is accepted. Proved failure rejects the candidate; unknown
continues strategic planning and never counts as unsolvable. Proven winning
paths are validation evidence; visible moves still come from strategic jobs.
There is no unrestricted move-search fallback. `node tests/small-board-proof.cjs`
reconstructs the 18-tile screenshot, rejects a preceding clearance before
playback, and checks unknown-budget behavior and all color permutations.

The second 18-tile screenshot exceeds the original 2,048-state validation
allowance but is proved impossible in roughly 3,100 checks. The allowance is
now 16,384; it remains bounded. The UI counter says search checks, including
repeats, because widening retries layouts and donor assignments.

October 5 section planning: before the existing layout planner, connected boards
with more than 20 occupied tiles receive a bounded pass over complete small
clearances. Each job either clears an existing secondary or legally mixes two
primaries and clears the resulting secondary using an actual linked complementary
blob. The pass first follows its best residual section, then retries with a
frontier of up to eight different boards. Ranking favors connected remainders,
primary blob cohesion, and surviving donor contacts; scoring never proves safety.
Equivalent residual boards are deduplicated and established structural failures
are discarded. Only a complete solution is accepted and revalidated for playback;
no partial section plan is committed. Exhaustion remains unknown and returns to
the existing layout planner. The pass yields during expansion for Stop/deadlines
and remains inside the serializable worker factory.

`sectionStates` defaults to 120,000 checks per pass, capped by `strategyStates`;
`sectionWidth` defaults to eight. Zero disables the pass. The first width-one
pass avoids paying for a wide frontier on straightforward boards. The October 5
60-tile screenshot is reconstructed in `tests/section-planning.cjs`: all six
primary permutations clear in 40 independently verified legal moves, with a
complete continuation before animation. Local runs took about 1.6–1.7 seconds
per permutation; the prior planner produced no first batch in a 15-second run.
These timings measure planning and exclude animation. They are a regression
result, not a guarantee for arbitrary boards. Run:

```sh
node tests/section-planning.cjs
node tests/section-browser.cjs
```

The browser regression exercises the real Auto Play button, cancellation during
section planning, legal playback, and the solved counter. It uses the same
Playwright environment variables as `tests/browser.cjs`.
