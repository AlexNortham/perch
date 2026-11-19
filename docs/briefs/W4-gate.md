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

From the real menu enter the Practice Hub as a support, shoot the opposing target, heal the wounded ally and
repeat. Show the HP changes. In the hub and a match, use the bound upgrade action, verify that the pointer is
free, hover or focus all four skills, click an affordable upgrade and confirm the single AP deduction and new
tier. Check that locked clicks do nothing and closing returns aiming to the player.

Check Albatross and a single-shot gun on a distant open sightline. Confirm both the hit pattern and tracers align
with the centre reticle, then repeat beside cover and with genuine muzzle obstruction. Get screenshot evidence.

## EP: this gate (Claude EP, 19/11/2026)

**The candidate is `integrate/w4c`**: main, ChatGPT's checkpoint, all nine W4 roles, both integration halves, the
wiki, the lint and test-hygiene pass, and the animation fix (held guns, muzzle positions). Review it in your own
worktree. Commit only your STATUS Log entry; the EP merges it.

On top of the checks above, these are gate items for this stage:

1. **Animation bar (D-EP-035).**
   - Run `npx tsx tests/anim/posesheets.ts` and look at the pose sheet of **every** playable bird (12).
   - Check: the gun is held in every state; feet are planted; nothing floats; no part of the gun shows through the
     body.
   - Note anything that reads badly, with hero and state.
   - The `tests/anim` attachment suite passes.
2. **Ctrl crouch through fullscreen keyboard lock (D-EP-030).**
   - Prove what automation can: entering play requests fullscreen and the keyboard lock in Edge; Ctrl while holding
     W slides; Options shows the note about reserved key combinations.
   - The real Ctrl+W browser shortcut can't be pressed by automation. Mark it "manual check for the user", and quote
     the manual steps from the Movement STATUS entry.
3. **The wiki (D-EP-031).**
   - The EP regenerated it on this candidate.
   - Open `wiki/index.html` over file:// and look at the home page, two hero pages, the items page, the map page and
     a mechanics page.
   - Check that the 12 playable birds and the 16 shop items appear as playable or in-shop, that the images show the
     current held-gun models, and that the coverage test passes.
4. **Perf on a quiet machine.** No other PERCH agents are running during this gate, apart from idle preview servers
   left by ChatGPT and another of the user's projects. Report what else was running.
5. **Firefox.** If Playwright's Firefox isn't installed, say so and treat the Movement agent's recorded Firefox
   evidence as provisional. Don't download a browser.

Reply in at most 250 words: APPROVE or BLOCK, one evidence line per M2 gate box (including the new ones), and the top
follow-ups by owner.
