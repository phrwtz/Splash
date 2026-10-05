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
thirty-minute limit to remain responsive. Deeper failures still use backtracking.

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


## Mandatory secondary-color conflicts

The assessment also rejects incompatible uses of a cell. For each occupied
tile, it overestimates every possible clearing route: direct clearing against
a complementary secondary beside its primary blob, or mixing with any linked
primary blob (including every possible destination in that blob). Existing
secondaries keep their own color and position. Routes that exceed the existing
region-capacity/distance bound are excluded.

When only one secondary color remains possible, remove each possible cell in
turn from that secondary's allowed region. If no candidate destination can
reach any complementary-primary boundary without that cell, the cell must
become that secondary color. Direct-clearing routes reserve a cell only when
there is a single possible neighboring destination. Two different color
reservations on one cell prove failure: secondaries cannot change color, and
cleared cells cannot be reused. Alternative color routes are conservatively
left unreserved. Paths, destinations, and boundaries overestimate future
possibilities, so this check can miss traps but must not reject a solution.

Secondary-region profiles are shared with the existing checks. Boundary
reachability after removal is cached per secondary color and removed cell
within an assessment. The new test runs after the cheaper existing proofs,
both on the initial board and during successor preparation before any forward
event is yielded. Component balance, trapped-primary/secondary checks,
complement matching, bounded exact island proofs, and complete fallback
search remain active. Passing structural checks is not a solvability proof;
autoplay can still backtrack on unresolved boards.

`bottleneck.cjs` reconstructs both pictured boards. The impossible board forces
cell 26 (row 4, column 4) to be both green and purple. It is rejected with zero
search events, versus 1,971 previously. The solvable picture still solves.
Moving its blue at (3,5) onto red at (4,6) is legal but creates the same conflict;
that successor is rejected before animation. Regressions cover all six primary
color permutations, 1,000 additional mixed random-graph comparisons against the
independent exhaustive oracle, and browser checks for immediate rejection and
safe forward animation. The complete pure-search suite now includes 14,207
oracle comparisons plus the targeted regressions.


## Two-move lookahead

Before emitting a forward move, prepare its successor and at least one legal
second-move successor. Both levels run every structural proof and the bounded
exact component checks. If no second move survives, cache the first successor
as dead and skip its animation. A move that clears the board needs no second
move. Retain the first surviving second-move preparation for the next visit,
and yield silent checkpoints while checking replies so Stop and deadlines
remain responsive. Passing two moves remains a necessary condition, not a
complete proof of solvability.

The regression uses a 14-occupied-cell board whose first successor passes
structural assessment, but whose second moves all fail the proof checks. The
old search animated doomed moves; two-move lookahead rejects the board without
any forward event. An independent exhaustive oracle confirms impossibility.


## Shared primary-component supplies

For every primary tile, gather the component suppliers allowed by ALL of its
optimistic clearing routes, including direct clearing against a future
secondary. For each primary color and each missing component, maximum
bipartite matching must assign a distinct supplier to every tile. If a match
is impossible, return `primary-component-shortage` before emitting any move.
This catches groups that individually have an escape but collectively need
more blue (or red/yellow) than they can ever reach. Matching includes whole
possible-secondary regions and their complementary primary blobs, deliberately
overestimating availability; passing the test remains inconclusive.

The third pictured board has four lower-left yellows and only two reachable
blue components. Both green formation and purple clearing spend those same
blue units. It now rejects with no search events, under all six color
permutations, and the browser confirms no animation or board mutation. The
stronger check also rejects a successor in the earlier two-move regression
before its second moves need examination.


## Bounded analysis before each animated move (current behavior)

Autoplay animates its search, including backtracking. Before displaying each
candidate successor it runs all structural checks above and attempts a deeper
proof on every occupied component, smallest first. This now includes large
components, which previously received exact lookahead only at 12 tiles or less.
Each preparation shares a budget of 4,000 new proof states. Search checkpoints
every 32 states keep Stop and the overall deadline responsive.

Only proved failures enter the dead-state cache. Exhausting the lookahead
budget means unknown, so the solver proceeds with animation and backtracking
instead of waiting for a full solution. Completed winning proofs are reused.
The pictured mixed board is still rejected before animation within this budget.
A full-board regression verifies that animation starts after bounded work;
zero-budget tests exercise genuine backtracking and safe unknown handling.

These checks cannot recognize every impossible board within a finite budget.
Hard positions may still animate a move that deeper search later disproves.

## First-mix supplies must be immediately linked

The blue-conflict screenshot has blues at (3,8) and (4,7), using one-based
row/column coordinates. Neither has a possible orange clearing route, and
both can initially mix only with the red at (4,6). The former matching check
counted distant reds from the entire potential purple region, hiding the
shortage. A primary blob can only shrink: no legal move creates a primary.
Its first mix must therefore consume a primary from an already linked partner
blob. The check now matches against those actual partners for mixing routes.
Direct clearing routes still use optimistic supplies from the complementary
secondary region; these have different reachability constraints.

The pictured board is rejected by assessment, without lookahead or animation,
under every primary-color permutation. Browser tests verify unchanged tiles
and empty history. Existing exhaustive and randomized oracle comparisons
protect valid direct-clear, mixing, and blob-transfer solutions.

## Impossible secondary bridges

The orange-conflict screenshot has two oranges at (3,3)/(3,4), but only one
reachable blue. The potential-orange region previously crossed red (4,2),
although its primary blob has no linked yellow. That cell can never turn
orange. Regions now include a primary cell only when its existing primary
blob has a linked blob of the other required primary color. Primary blobs
can only shrink, so a missing link cannot appear later. All cells in a linked
blob remain allowed, preserving legal transfers between nonadjacent cells.

The reconstructed board rejects structurally under all six color permutations.
A legal predecessor demonstrates how consuming its yellow supply destroys the
possible bridge. Browser tests require immediate rejection without changing
tiles or history; oracle comparisons continue protecting solvable positions.

## Required bridges cannot also supply their own construction

The disconnected-colors screenshot passes individual reachability and supply
checks. Connecting the upper colors to yellow requires purple at several
specific cells. Blue (2,6) can receive red only from the top red blob or red
(3,7); all those red cells are themselves required purple bridge cells.
Consuming any as a donor leaves permanent white and destroys the required
connection. Counting them as supplies was therefore too optimistic.

After collecting mandatory secondary cells and checking existing shortages,
match the missing primary components of required conversions to initially
linked primary donors. Exclude all mandatory cells as donors, because they
must become their reserved secondary and cannot also be consumed as primaries.
Matching is shared by donor color so multiple bridges cannot reuse one tile.
This is a necessary condition, not a complete solvability decision.

The pictured board now rejects without search under all six color permutations.
Browser checks preserve tiles/history without animation. Another 500 mixed
12-cell graph comparisons against an independent exhaustive oracle test safety.

## Forced-clear disconnection

A secondary region with exactly one existing secondary and one possible
complementary primary forces that pair to clear. If they are adjacent now,
hypothetically remove them and check occupied-component color balance. An
unbalanced component proves impossibility before any animated move.

Uniqueness is checked across the entire potential secondary region, including
future connections, not merely today's adjacent colors. The sole primary is
a singleton blob. Spending either tile on another move would prevent this
required clearing; no other complementary primary can use the secondary as
a bridge. Thus in a solution this clearing can safely be performed first.
The test does not generalize this argument to arbitrary forced future moves.

The screenshot rejects specifically for green (2,7) and red (3,7), under all
six color permutations. The earlier mixed endgame also now rejects structurally.
Positive regressions cover alternative complementary partners and a forced
clearing that splits into two balanced, solvable regions. Browser tests assert
the exact forced pair and unchanged display/history.

## Conversion ordering inside a sealed two-color region

The yellow-link screenshot passes static supply and mandatory-cell checks.
The six red/yellow cells at the upper left have to form orange, but supplying
orange (5,2) consumes a yellow that breaks the remaining connection. Counts
alone cannot express this ordering constraint.

For potential secondary regions of at most ten cells, use a bounded local
proof when all possible primary interactions with the outside are blocked by
singleton cells that must become the region's secondary. Primary blobs must
lie wholly inside the region. Existing secondaries cannot move, and mandatory
cells cannot be donated. These restrictions ensure successful play cannot
export other colors or import another kind of secondary into the region.

The local search preserves legal primary blob transfers and allows unlimited
external complements to clear any secondary blob touching an original
complement boundary. This is deliberately more generous than the real game.
Failure proves impossibility; success proves only local feasibility. After
2,000 local states, exhaustion is unknown and does not reject. This bounded
check runs before animation and does not explore unrelated board regions.

Tests cover all color permutations, an independent exact oracle on the small
obstruction, a solvable variant with a bypass edge, and immediate browser
rejection with no tile/history changes. Existing full-board animation and
oracle comparisons remain active.

## Reusing unaffected components

Within a solve session, cache structural assessments by the complete colored
state of each occupied component. Every changed component is assessed again;
if a move splits it, each new piece is checked separately. White cells never
refill, so disconnected components cannot exchange material or reconnect.

Preparation also carries the component states already given bounded lookahead
in its parent. Unchanged states do not repeat that lookahead after a move in
another component. An inconclusive result stays unknown; complete search and
pre-animation checks on future successors remain active. Caches belong to one
solve session and cannot leak across boards or adjacency graphs.

This does not restrict checks to immediate neighbors in a connected component:
shared supplies and required connections can have effects across that whole
component. A regression uses a large unresolved component beside a separate
three-tile component and verifies no repeated lookahead between its two moves.

## Single-exit pocket supplies

Possible-secondary regions can overcount supplies: reaching distant reds may
require a green bridge whose blue must also be donated to build that bridge.
The two September 27 screenshots expose this gap. Their former assessments
passed; default search animated one and sixteen forward moves respectively.

After the existing checks, remove each occupied cell in turn to find pockets
connected to the rest of their component only through that exit. For interiors
of two through seven cells, run a bounded local proof including the exit.
Interior moves obey the actual mixing and blob-link rules. The outside offers
unlimited supplies of its current neighboring colors and every secondary
those neighbors could become according to the existing optimistic profiles.
Allow export as well as import, and account for blobs extending outside:
they may receive any compatible color remotely and exchange their own color
with other interior blobs touching their inside members. Clearing only the
interior counts as success, even if the exit is still occupied.

Every real solution projects to a path in this more permissive local model.
The exit is the only outside connection; once white, it cannot reconnect.
Therefore failure even with this unlimited outside help proves the original
board impossible. A total budget of 2,000 local states per assessment bounds
the work; exhaustion is unknown and never a reason to prune. The check returns
`pocket-supply-conflict` only after exhausting a pocket's possible moves.

Both screenshots now reject in assessment with zero lookahead and no forward
events, for all six primary-color permutations. Browser regressions check
the result, unchanged tiles/history, and absence of animation. Independent
oracle comparisons cover a nine-cell extraction, a solvable bypass, a blob
crossing the exit, and 1,000 additional single-exit mixed-color graphs. Two
older impossible fixtures now fail this check earlier; their expectations
have been updated accordingly.

A solvable predecessor also verifies successor rejection: transferring red
at (6,6) onto yellow at (8,4) is a legal blob move producing the new screenshot.
With deeper lookahead disabled, Auto Play still solves that predecessor
without ever animating the trap-creating move. Both pure-search and browser
tests cover this behavior.

## Supplier-specific bridge distances

The next screenshot exposed another optimistic estimate: the upper two reds
could reach one yellow on the right, but the solver also counted the distant
lower yellow blob. Even from the closest possible mixing destination, that
blob requires a seven-cell purple bridge; the region can produce at most
four purple tiles. Membership in the same potential purple region did not
establish that those yellows were reachable.

For each complementary-primary supplier blob, breadth-first search measures
distance through the possible-secondary region from cells adjacent to that
blob. Boundary cells have distance one: each step requires a secondary tile.
Count a supplier for a mixing destination only when its distance is no greater
than the region's component capacity. Cache these distances within the
region profile. Matching still treats every tile in a reachable primary blob
as a distinct supply, allowing non-adjacent blob transfers. Apply the same
distance restriction when matching existing secondary anchors to supplies.

This is a necessary condition: any actual clearing needs a connected secondary
path to some surviving member of the complementary blob. Primary blobs only
shrink and cleared cells never refill. The original supplier blob, potential
secondary cells, and region-wide capacity all overestimate the actual options,
so failure is a proof; passing remains inconclusive. The check also retains
all first-mix destinations and direct-clearing alternatives.

The screenshot now fails assessment with `primary-component-shortage` for red
needing yellow, before lookahead or animation. Regressions cover all six color
permutations and budgets of zero, 64, and 4,000 states. Browser tests verify no
unrelated moves, unchanged board/history, and the unsolvable result. An
independent exhaustive oracle checks a smaller conflict and solvable bypass,
existing-secondary matching, and a bridge exactly at capacity. The search
script URL version is updated so reloading a served page fetches the new code.

## Forced primary-leaf mixing

The red at (2,5) in the next screenshot has one occupied neighbor: the singleton
blue at (3,5). Every other occupied neighbor of that blue is already purple.
Neither primary can gain a different partner: primaries never grow, and the
surrounding secondaries can only remain as they are or clear. Moving blue onto
the red would strand a purple on an isolated cell. Thus red must move onto
blue, joining the existing purple bridge.

The solver now recognizes this pattern under any primary-color permutation.
When it exists, the move list contains only the required directed mix. This
applies in both bounded proof search and the animated fallback. Every solution
must perform this move, and bringing it forward cannot disable a move elsewhere:
the two primary cells cannot take part in any other interaction, while their
mix only adds a secondary connection. Recompute the rule after each move so
newly exposed forced pairs also propagate. No alternate-partner or larger-blob
case is forced. The rule is not applied inside relaxed local proofs, where
unmodeled outside supplies could create additional options.

For this screenshot, default search drops from 3,190 to 1,198 silent checkpoints
and from seven forward/backtrack pairs to one, beginning with (2,5) -> (3,5).
Both searches prove the full board unsolvable. These event counts are a targeted
regression measurement, not a general speed guarantee. Tests include all six
color permutations, independent solvable oracle cases, the full existing oracle
suite, and browser verification of legal forced animation and correct undo.

### Targets with other same-color donors

The blue at (4,7) in the next screenshot has only the singleton yellow at
(3,7) as a neighbor. The original rule missed it because that yellow also
touches other blues. Those blues do not provide an alternative: any one of
them turning the yellow green would leave the blue leaf unable to clear.
Moving yellow onto the blue leaf also strands the resulting green.

The rule now permits the target's other neighbors to have the leaf's primary
color as well as their shared secondary color. No third primary is adjacent
to the singleton target, so it cannot become a different secondary that the
leaf could clear later. Other donors can change only in ways that remove
the target (stranding the leaf) or produce the same secondary; neither
avoids the required leaf-to-target mix. Performing that mix early is safe.

The pictured board first propagates another forced move, (1,3) -> (1,4), then
(4,7) -> (3,7), before optional moves. Tests cover all color permutations and
zero/default lookahead. An independent solvable example exercises this rule;
a counterexample with an adjacent third primary verifies why that restriction
must remain: its target must become orange rather than green to support a
different bridge. Browser tests verify the two actual moves and green target.

### Complete small-endgame proofs (September 28)

The 19-tile `endgame-trap.cjs` screenshot passes the structural necessary
conditions, yet cannot clear. A 4,000-state lookahead may exhaust its budget
and allow visible exploration of that dead end. Raising a finite budget would
only move this failure boundary.

Before animating a move, search now completes the proof of each occupied
component containing at most 20 tiles. Such a component cannot receive help
from another component because white cells never refill. The existing exact
search retains dead-state and winning-move caches; its cooperative checkpoint
counter is separate from its budget so an unlimited endgame proof still yields.
Stop and the thirty-minute deadline still apply, with deadline exhaustion
reported as unknown. Larger components retain bounded lookahead. This policy
prevents entering these endgame traps, but does not promise immediate trap
detection on arbitrary large boards. The `assess` function remains a set of
necessary structural checks, not a complete solvability test.

The regression includes a solvable predecessor obtained by replacing purple
(4,5) with blue and restoring red at (3,5). Red (3,5) onto blue (4,5) legally
recreates the screenshot; the winning path instead avoids that trap. This is
a constructed predecessor, not a claim about the user's original board.

### Escalation after a failed visible branch

The second September 28 screenshot (`backtrack-trap.cjs`) has 28 occupied
cells, above the small-endgame threshold. Structural checks pass and bounded
lookahead remains inconclusive. Previously, the first twelve visible events
included repeated failed sibling moves. Backtracking was correct depth-first
search, but returning to a parent did not establish that parent was solvable.

After a visible branch fails and is undone, search now runs its complete,
cooperative proof on the restored position before animating another sibling.
A proof of failure propagates to the caller, unwinding as many ancestors as
necessary. A successful proof supplies cached winning moves. No ancestor is
skipped merely because one child failed, and budget/deadline exhaustion is
never treated as proof of failure. Large fresh boards retain bounded initial
lookahead; this escalation is triggered by an actual failed visible branch.

On the screenshot, only one forward move and its matching backtrack are
emitted before the board is proved unsolvable. Small independent exhaustive
oracle examples cover both a winning sibling and two-level failure unwinding.
The browser test covers Stop and timeout during the recovery proof, final
original-board restoration, and automatic halt. Complete recovery can take
longer on larger positions; it yields search checkpoints throughout and remains
subject to the existing thirty-minute limit.


## Shared bridge supplies and propagated reservations

The orange screenshot in `stalled-backtracking.cjs` is rejected without move
search. Coordinates below count rows and columns from one.

* Orange (3,3) must connect through red (4,3), so that red must become orange.
  Reaching any blue also requires at least one additional red on this bridge.
  Those two conversions require two yellow donors from the left-hand group
  at (6,1), (7,2), and (7,3).
* Red (5,2) needs another yellow from that group.
* Red (8,1) also needs that group. Its apparent alternative uses a purple
  bridge to the right-hand yellows. Once (4,3) is reserved for orange, only
  six red components remain in the potential purple region; the shortest
  route from its blue mixing destination to those yellows needs seven purple
  cells. The alternative is therefore impossible.

Four required yellow units cannot come from three donors.

Implementation propagates mandatory secondary-cell reservations to a fixed
point. A reserved primary cannot donate or become a different secondary.
Remove it from incompatible secondary paths and capacities, but retain the
original region grouping: a primary blob can transfer across that cell before
it converts. Splitting groups at reserved cells could incorrectly exclude such
transfers. Each repeat adds a reservation; no game moves are enumerated.

For each anchored secondary and each of its two components, form the pool of
primary donors in its potential region. Count primary demands whose possible
suppliers all lie in this pool. Run a weighted shortest-path check from the
anchor to a complementary-primary boundary, charging one only when the path
uses an additional primary receiver not already counted. Existing secondary
cells and cells already holding the supplied component cost zero. This is an
optimistic lower bound; if it exceeds the pool, no legal clearing is possible.
Check anchors individually rather than summing potentially shared paths.

The screenshot fails with `secondary-bridge-supply-conflict`, required 4,
available 3. All six primary-color permutations return unsolvable on the
first generator call, including with lookahead disabled. An independent
exhaustive oracle validates a smaller obstruction, a solvable added-link
variant, and 1,500 mixed random graphs. Browser checks verify zero search
checkpoints, zero animations, restored controls, and unchanged board/history.
