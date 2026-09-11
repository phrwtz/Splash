# Early rejection in Auto Play

## Observed failure and regression

The old primary-trap detector returned immediately when *any* cell was purple,
orange, or green. It therefore stopped checking primary traps after the first
ordinary mixing move, even if that move was far from the trapped tile.

The regression starts with the full-board counterexample in `fixtures.json`,
then moves red index 19 onto yellow index 26 outside its blue barrier. The
corner remains trapped. The revised search rejects this mixed board before
yielding any animation event. The browser test verifies the result message,
counter, and unchanged board.

A second regression gives the enclosed region an extra yellow at index 3 and
changes an outside yellow to red to keep balance. This passes the necessary
conditions. Moving that extra yellow onto the boundary blue at index 4 creates
green and removes the corner's possible escape. Assessing the successor now
identifies the trapped corner before that move can be shown.

## Checks now implemented

1. Reject a physically occupied component whose primary-component totals do
   not balance. White cells cannot be reused, so such a component cannot be
   rescued from elsewhere.
2. Build three possible-secondary-region maps. For orange, for example, only
   current red, yellow, and orange cells can ever contain orange. Other colors
   and white cannot become orange. Count the region's available components and
   its neighboring blue blobs, and measure the shortest possible connection
   from each cell to blue through this region. Repeat for purple and green.
3. Reject an existing secondary if it cannot connect to its complement within
   the number of secondary tiles that its region can possibly produce. Also
   reject a region with too few complementary primary tiles to clear the
   secondaries that already exist.
4. Check shared supplies: maximum bipartite matching assigns distinct
   complementary primary tiles to existing secondary tiles. If two separate
   purple regions each need a yellow but both depend on the same single yellow,
   separate per-region counts miss the problem. Matching detects it. Its
   edges deliberately overestimate what can happen, so failure is a proof.
5. Check every primary tile, including members of larger blobs, in mixed
   boards. There are only two ways it could disappear:
   - clear against a complementary secondary touching its current primary
     blob, including a secondary that might be made in the future; or
   - mix with a primary in a linked blob, then clear the resulting secondary.
   Reject the tile only if *both* routes are impossible even under optimistic
   assumptions. The second route checks every possible destination in every
   linked primary blob, plus receiving the partner at the tile's own cell.

The secondary maps are computed once per assessed board and reused for all
tiles. They replace repeated per-primary region and distance computations.

## Why these are safe pruning rules

Primary blobs can only shrink or split; no move creates a primary. A secondary
cannot change position except by clearing. Thus the possible-secondary maps
can only shrink as play continues. An orange region's maximum possible number
of orange tiles is the smaller of its red-component and yellow-component
totals, including existing oranges. Reaching blue at graph distance d requires
at least d orange cells in the connecting orange blob.

All reachability and supply estimates err on the generous side: a passed
check means only that this proof of impossibility does not apply. In
particular, the possibility of a future complementary secondary is allowed
whenever the neighboring possible region has both necessary components. This
can miss a difficult trap; it cannot wrongly forbid a genuine escape.

`SplashSearch.assess` exposes the result and a reason for regression tests and
diagnostics. `solve` calls the same assessment before yielding a forward move.
Rejected candidates yield only a silent checkpoint, allowing Stop and the
ten-minute limit to remain responsive. Deeper failures still use backtracking.

## Validation

- 12,207 comparisons with an independent exhaustive oracle, including every
  balanced primary/secondary/white coloring of six-cell paths and cycles.
- The mixed-board corner regression and the trap-creating boundary move.
- A shared-yellow shortage that separate per-region counts cannot detect.
- All 4,100 states from 100 previously verified complete 60-cell solutions
  were accepted by the new checks. On this machine this assessment pass took
  about 0.27 seconds; it is a local measurement, not a runtime guarantee.
- Browser tests for immediate rejection without animation, successor checks,
  session counters, Stop, time limits, and existing reverse animations.

## Independent components and exact endgames

Empty cells never become occupied again. Therefore disconnected occupied
components must each clear independently. Search now finishes the smallest
component first rather than enumerating interleaved move orders in different
components. This preserves completeness: moves in different components commute.

Before displaying a successor, the solver also attempts an exact proof for
each component of at most 12 occupied cells, even if the whole board is large.
The proof recursively separates components when they split, memoizes failures,
and records winning moves for direct replay. An impossible island rejects the
whole board immediately, without playing through unrelated solvable islands.
`assess` remains the inexpensive necessary-condition check; this additional
proof runs cooperatively inside `solve`.

Each preparation allows 4,000 new proof states and yields a silent checkpoint
at the first state and every 32 states afterward. Budget exhaustion means
unknown, never unsolvable; ordinary complete search remains the fallback.
Stop and the existing deadline are handled by the player's checkpoint loop.
Large connected positions can still require substantial search.

The independent-island regression passes the local necessary conditions but
has no solution. Previously, a solvable six-cell island beside it caused
1,439 forward events and 23,287 total events before rejection. The revised
solver rejects it with three silent checkpoints and no forward events.
A local computation-only measurement was about 206 ms versus 4 ms; this is
one targeted regression, not a general speed guarantee. Validation adds
1,000 deterministic mixed-board oracle comparisons, independent-component
solution replay, and the existing browser checks.
