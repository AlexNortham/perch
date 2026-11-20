# Wave 5a integration round · acting for the named owners (D-EP-018) · tag INTEG

Read W5-common.md first. The candidate is `integrate/w5`, holding all of wave 5a: heroes A3 and B2, 64 items, Systems,
UI & controls, Objectives and the detailed map.

**You must not touch:** `src/sim/ai/**` (Bot AI is working), `src/client/render/**` or `src/client/audio/**` (art and
audio are working), or `src/sim/core/**` and `src/client/app/**` (the Architect is working). If a fix needs one of
those, write it under Interface requests instead.

**Fix at the root cause, one commit per item:**
1. **Five Objectives unit tests fail after the merges.** In `src/sim/world/interactables.test.ts`, the two Bell Feeder
   cases. In `src/sim/world/neutrals.test.ts`, the Roc, Thickets and Nests cases. They passed on the Objectives branch,
   so the real map anchors or the Systems changes are now involved. Find out which, and fix it in the owning system.
2. **`e2e/match.spec.ts` "a shot landed and showed a damage number"** fails on `integrate/w5` (the Level Designer
   confirmed it fails without their map too).
3. **QA helper and test errors** listed in the Objectives STATUS entry. The main one: `heavyMelee` never presses
   Melee, so no heavy hit swings. Also fix QA's Hooked Spur and Nestmother tests (Items A's STATUS entry).
4. **Switch on every pending suite whose system has landed:** objectives, items, heroes, no-Interact, and the UI's
   specs. List what stays gated and why.
5. **Remaining gameplay gaps from the wave 5a reports:**
   - Nests aren't solid.
   - Ivy curtains honour `blocks`, so they stop blocking heroes in doorways.
   - Bough Springs and the Cellar Run are built (Physics).
   - The Magpie Den shop is built (Items).
   - Melee pickup on runes and Embers works, plus damage range and revives (Combat).
   - Burr Coat `triggerPct`, Heartwood Bark melee resist, and Kestrel's Eye's per-hit distance bonus (Items and
     Combat).
6. **Adopt the Systems framework features in hero and item data**, then remove the stand-in hooks:
   - Drumroll's `COMBAT.fullSpinStatus`
   - `values.surface` for Branch Swing and Tree Cling, and Tree Cling `endOn: ['jump']`
   - Rampage `steerDeg`
   - Bristle's trigger
   - Crescendo and Echo Chamber's resisted-once hit
7. **G23:** a 600-Seed starting purse (`src/sim/data/economy.ts`), per the feel reference.
8. **Build:** cap the parallel workers in `scripts/check.sh` (unit tests and e2e) so the check stays reliable while
   agents load the machine. Keep it fast on a quiet machine, and record the choice.

**Done means:**
- `npm run check` passes all six steps, three runs in a row, each quoted.
- STATUS entry `### W5 · Integration · <date>`.
- Reply in at most 200 words.
