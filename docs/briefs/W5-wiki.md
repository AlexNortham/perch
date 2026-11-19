# Wave 5b · Docs & Wiki engineer (#21) · test fix · tag WIKI

Read W5-common.md first. You own `tools/wiki/**`, `wiki/**` and `tests/wiki/**`.

**The problem:** the wiki coverage test checks the committed `wiki/` output. Every time content lands (new heroes,
items, objectives), the committed wiki goes stale and `npm run check` fails until someone regenerates it. That blocks
other engineers' branches for reasons that have nothing to do with their work.

**Fix:**
- The test runs the generator into a temporary folder, without capturing screenshots (reuse existing images and mark
  missing ones), and checks that output: coverage of every hero, ability, item, status, structure, unit and new
  objective in the data; internal links and anchors; alt text; no external URLs; no reference-game names.
- A stale committed `wiki/` becomes a warning, not a failure.
- The committed wiki is still regenerated at every gate (D-EP-031), so keep `npm run wiki` exactly as it is for that.
- Keep the generator fast enough for the unit-test step (aim for a few seconds without screenshots).

**Done means:** the coverage test passes on this branch without regenerating the committed wiki, and fails if a hero is
removed from the generator's output (prove it with a temporary local change you revert). `npm run check` passes all six
steps. Reply in at most 150 words.
