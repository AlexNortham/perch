# W4 · Independent QA gate · QA

Review the integrated candidate after integration fixes. Read W4-common.md, the W3 gate precedent, W4 test-first
brief, GDD §16 M2 and STATUS M2. Gate review is read-only for code. Commit only the evidence/verdict Log append
on the assigned gate worktree. For each M2 box cite a test, screenshot or reproducible observed interaction.

Run npm run check, check the M2 rule suites are always on, replay two 35-minute seed-1 simulations and record
the hashes, timings and actual draw-call scenario. Check ownership, sim purity, warnings and runtime errors.
Start via the real menu, pick from the 12 available birds and finish a match against Dusk structures. Show
normal commands damage the two-phase Patron and produce the result screen. Sandbox state mutation, concessions
or calling a win helper cannot prove a hand-playable siege. Check Seeds, AP, levels, shop/refunds/actives, HUD,
map visibility, pings, scoreboard, damage numbers, audible cues/settings, Options persistence, and Stage 2
features. Inspect real screenshots; give one evidence line per gate item, exact blocker repros and owners.
Return APPROVE or BLOCK. The EP writes PLAYABLE.md after launching and inspecting the candidate, then checks it
against this verdict. A blocker goes back to its owner or the integration engineer and returns to independent review.

Include the player's M1 preview reports in gate evidence: sustained traversal on a production preview, a running
slide with browser-safe defaults, two real side-button rebinds carried through a restart, visible light/heavy
and parry states, and a route linking the new reference-based movement mechanics. Distinguish a renderer crash,
navigation and a native close shortcut when reporting tab liveness. Exercise the reported W/Shift/Space sequence
in Firefox on the production build as well as the repo's Edge suite. Record the browser versions and soak length.
