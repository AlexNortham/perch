# Wave 3 — integration fix round, tag INTEG

You fix the defects found when the EP merged wave 3, acting for several owners (D-EP-018). **Scope: only the items
below.** Anything else you notice goes in your report.

## Where you work
- The main checkout, `C:\Users\AlexNortham\Documents\game`, branch `integrate/w3` (main + all eight wave 3 branches).
  Work and commit there only. Never switch branches, merge, rebase, reset or touch `main`, `preview/w3` or
  `.claude/worktrees/`.
- Windows 11, Node 22, Git Bash via the Bash tool; dependencies installed. Today is 19/11/2026.
- **Local only:** never add a git remote, push, publish or upload. Never run `npm start` (it opens a browser on the
  user's desktop).
- **Read:** docs/STATUS.md (rules; the wave 3 Log entries explain what each engineer built, especially `W3 · Systems`,
  `W3 · Hero Engineer A`, `W3 · Camera & Input`, `W3 · UI/HUD`, `W3 · Economy`), docs/INTERFACES.md,
  docs/briefs/W3-common.md (the Stage 2 gate), docs/DECISIONS.md.

## Rules for this round
- Fix the **root cause in the owning system**. Don't weaken a test to make it pass; change a test only when the test is
  wrong (say why in the commit message).
- Contracts in `src/sim/core/contracts/**` stay frozen; a fix that needs one goes in your report instead.
- Commit after each item: `W3 integration (<owning area>): <what and why>`.
- Usual code rules: strict TypeScript, no `any`, no unexplained literals, `src/sim` pure and deterministic.

## Items
1. **Hero A onto the framework features** (src/sim/heroes/{shrike,albatross,kingfisher,lyrebird}, their data files).
   The Systems engineer landed `DisplaceEffect.onWall`, `SummonEffect.onEnd` / `count` / `size`, `AbilityDef.selfEffects`,
   target==caster dashes going to the point, aim dashes keeping pitch, and accurate displacement (data shapes in their
   STATUS entry). Replace each `TODO(framework)` hook with data (`WALL_SLAM_IN_FRAMEWORK`, `SUMMON_END_IN_FRAMEWORK`,
   `SELF_EFFECTS_IN_FRAMEWORK`, Albatross `tempestLeap`), and handle their caveats (Gale Shield's hook writes the wall's
   `pos`/`yaw`; Wing Slam needs `arcHeight: 0`). Then make these four failing tests pass for the right reasons:
   Shrike › Impaling Bolt (knockback; wall pin), Albatross › Gale Shield T3, Kingfisher › Spear Bill T3. The kit
   validator must pass (`npx vitest run src/sim/abilities/kit.test.ts`).
2. **QA's pods suite** (tests/): rule 4 ("a hero of the fledgling's own side denies it") fails because the `shootPod`
   helper reads the pod's position after it has despawned. Capture the position before the first shot. Then switch
   `tests/rules/pods.test.ts` and `tests/rules/fledglings.test.ts` to always-on (remove the `PERCH_PENDING` gate) per
   D-EP-006. Move the 20-minute fledglings test behind a separate `PERCH_SOAK=1` gate if it slows `npm run check` by
   more than ~10 s.
3. **Pod size.** Combat's aim ray now stops on pods, so Economy's 1 m pod hit radius (D-ECON-001) can return to the
   pod's real size. Change it in `src/sim/data/economy.ts` and confirm the secure/deny tests still pass.
4. **Settings reach the game live** (src/client/app, src/client/input, src/client/ui). The Options screen saves
   keybinds, sensitivity, FOV, quality and volumes through the settings store. Make sure: the real input module reads
   **every** binding from settings and picks up changes live (rebind Jump in Options during a match, and the new key
   jumps at once); sensitivity and FOV reach the camera and input; quality reaches the renderer. There are two copies
   of the swap-on-conflict logic (UI's `src/client/ui/bindings.ts` and input's rebinding); keep **one** and make the
   other use it. Check that the action names in the Options list match the input module's `DEFAULT_BINDINGS` exactly.
5. **App wiring from Camera & Input:** call `input.setLook` on `hero.respawned`, and wire pings through
   `input.setPingResolver` using the camera's `rayWorldPoint`.
6. **All four abilities usable in the practice match.** The Stage 2 gate says "uses 4 abilities", but levels (and the
   level-6 ultimate unlock) arrive in wave 4. Start the practice match with the sim's `unlockAbilities` option on, so
   all four abilities can be cast; leave real matches alone.
7. **Permanent e2e tests** (e2e/, acting for QA):
   - the playtest from Camera & Input's report: `?scene=lane&hero=shrike`, lock the pointer, hold W, dash, fire; assert
     the hero moved and a shot was fired. If the page exposes nothing to assert on, add a read-only test hook in
     src/client/app (for example `window.__perch.hero` with the local hero's position and a shots-fired count);
   - the Options script from UI's report (rebind, swap, cancel, reload persists, rebound Pause works), extended with
     "rebound Jump works in the lane" once item 4 lands.

## Done means
- `npm run check` passes all five steps on `integrate/w3` (quote the summary); the pods and fledglings suites run
  always-on and pass.
- `npm run sim -- --seed 1 --minutes 35 --bots 12` completes; report the hash and ms per tick.
- Screenshots you looked at: `?scene=lane&hero=<id>` for each of the four heroes, and one with fledglings fighting.

## Finish
Append your Log entry (`### W3 · Integration · 19/11/2026`) to docs/STATUS.md, each item with root cause and fix, and
commit it. Reply to the EP in at most 200 words: each item's result (one line each), the commit hashes, verification,
and anything found but not fixed.
