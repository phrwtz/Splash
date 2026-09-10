# Auto Play checks

From the Splash folder:

```sh
node tests/search.cjs
node tests/browser.cjs
```

The browser checks require Playwright and its Chromium browser. They use a
separate headless browser with a controlled clock to verify the ten-minute
limit, ten/five-second result waits, board cycling, session reset, legal moves,
backtracking, actual forward/reverse animation, and cancellation. They do not
modify the game or save session counters. `PLAYWRIGHT_PATH` can point to an
existing Playwright installation if it is not on Node's module search path.

The pure search checks need only Node. They compare all balanced colorings on
three small graphs with an independent exhaustive oracle and verify the
full-board trapped-primary counterexample and forward/backtrack consistency.
They also check successor lookahead against an independent oracle on balanced
mixed-color boards and verify that trapped secondary colors are rejected.
Browser checks cover silent lookahead, including unchanged tiles/history and
responsive Stop/deadline handling while moves are being discarded.

See [TRAP_DETECTION.md](TRAP_DETECTION.md) for the mixed-board failure,
the generalized proof checks, validation, and further efficiency options.
