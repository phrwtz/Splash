# Strategic Auto Play

Auto Play plans complete clearing jobs and verifies a continuation before
changing the board. It no longer displays exploratory search branches.

## Planning stages

1. Existing sound structural checks reject known obstructions.
2. A cooperative bridge-allocation check considers possible secondary layouts.
   Selected bridge cells cannot also donate their original primaries. All
   construction donors, bridge-clearing suppliers, and other existing/future
   required secondary clearances share one distinct-resource matching. Original
   blob links and possible future regions deliberately overestimate access.
   Exhausting every layout proves a conflict; a feasible allocation does not
   prove that its moves can be executed. Budget exhaustion is unknown.
3. Candidate jobs grow connected secondary layouts, or convert primary batches.
   Groups lacking a current clearing connection are considered before supplied
   groups. Layout growth includes existing secondary branches it touches.
4. A bounded local planner builds the chosen layout before clearing it. It
   simulates actual legal blob transfers, assigns distinct donors and clearing
   resources, and checks each resulting state. The sequence preserves whatever
   contacts are required by its later transfers; a geometric path alone is not
   a plan. A job ends only when all its selected cells are cleared.
5. Strategic search composes completed jobs on their actual remaining boards.
   Competing objectives therefore cannot spend the same tile twice. Independent
   occupied components are planned separately. A failed bounded job/assignment
   is not recorded as proof that the board is impossible.
6. If bounded planning is insufficient, a complete cooperative solver checks the
   most advanced strategic continuations, then the original board if needed.
   This search is silent. Its dead-state cache contains only proved failures.
   Ordinary legal-move enumeration remains necessary for completeness, but is
   no longer the visible playing policy.
7. The entire successful sequence is revalidated, then replayed. Every forward
   event has a verified plan identifier, objective, resource assignments, step
   number, and total steps. There is no re-scoring between playback steps.

A single verified continuation is cached for Stop/Start. Reuse requires an exact
board and adjacency match; a color edit or different graph cannot reuse stale
plans. A stopped animation can retry its same step, and a completed step resumes
at the next one. Existing legal history may be undone only after the current
position is proved impossible. Edited/incomplete histories retain the app's
original-deal restart behavior.

## User-visible behavior

The status shows supply checking, planning a colored group's clearance, or
checking a complete continuation. Playback shows the objective and step count.
Stop, the thirty-minute deadline, session counters, original-board restoration,
and the ten-second solved-board pause remain in place.

A difficult board may spend longer planning before its first move. A timeout
remains **unknown**, not unsolvable. The planner is bounded and its current job
vocabulary does not cover every possible interleaving. The exact fallback may
still be expensive; this implementation does not promise that arbitrary Splash
positions can be solved quickly.

## Parameters

`bridgeStates` defaults to 16,384 relaxed layouts, with at most 16 variable
cells per region. `strategyStates` defaults to 120,000 planning steps,
`localStates` to 1,536 per job, `planVariants` to 24 completed assignments per job,
and `layoutLimit` to 192 layouts per seed. Layout growth uses at most six new
secondary cells. These bounds restrict planning effort, never the legal game.
Exhaustion falls back to complete verification. `lookaheadStates` and
`endgameTiles` are accepted for compatibility but no longer enable speculative
playback or control the new planner.

## Validation

- `node tests/search.cjs`: 12,207 exhaustive small-graph comparisons plus seeded
  mixed graphs, prior resource/bridge proofs, solvable bypasses, and strategic
  tests. The independent oracle knows only legal moves, not planner rules.
- `node tests/strategic.cjs`: persistent objectives, construction before
  clearance, protected contacts, distinct supplies, a four-tile batch, independent
  jobs, zero planning budgets, history recovery, Stop/Start cache validation,
  cancellation, and color permutations.
- `node tests/browser.cjs`: real plan playback and status, resume, silent
  planning, Stop/deadline handling, historical undos, animations, and sessions.
- `node tests/bridge-allocation.cjs`: 500 additional fresh-solver comparisons
  against an independent oracle for competing bridge/secondary resources.
- `node tests/strategy.cjs` and `node tests/planned-bridge.cjs`: additional
  independent resource checks and multi-undo recovery.
- `node tests/planning-benchmark.cjs`: optional bounded historical screenshots.
  Unfinished runs report `unknown` explicitly. They are not solution tests.

The latest gateway screenshot is `gateway-strategy.cjs`. Its 28 colored cells
pass the older structural checks, but its purple bridge and green-clearance
obligations cannot share the available donors. The new allocation check proves
failure before executable planning or complete board search, under every primary
color permutation. Browser tests assert that no move is animated.

Older tests requiring a quick speculative first move or a particular number of
failed visible branches have been replaced. The first-move screenshot fixtures
remain available as bounded benchmarks; correctness tests now require complete,
legal, verified continuations and coherent multi-step jobs.

The expanded planning defaults give strategic search twenty times its original
overall budget and four times the local effort, completed assignments, and
layouts per seed. Fallback remains available when the budget or the available
plan patterns are insufficient. More planning may delay the first move on boards
that still need fallback; it does not guarantee a faster solution.

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
