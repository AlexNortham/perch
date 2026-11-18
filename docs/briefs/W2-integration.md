# Wave 2 — integration fix round, tag INTEG

You fix the defects found when the EP merged wave 2. You are a temporary integration engineer acting for several owners
(D-EP-018). Your scope is **only the defects listed below**. Anything else you notice goes in your report, not in a
fix.

## Where you work
- The main checkout, `C:\Users\AlexNortham\Documents\game`, which has branch `integrate/w2` checked out. It holds main
  plus all six wave 2 branches (Level Designer, Rendering, QA, Character Controller, Combat, Ability Systems).
- Work and commit on `integrate/w2` only. Never switch branches, merge, rebase, reset or touch `main`. Don't touch
  `.claude/worktrees/`.
- Windows 11, Node 22, Git Bash via the Bash tool. Dependencies are installed. Today is 18/11/2026.
- **Local only:** never add a git remote, push, publish or upload anything. Never run `npm start` (it opens a browser on
  the user's desktop).
- **Read:** docs/STATUS.md (rules; the wave 2 Log entries at the bottom explain what each engineer built),
  docs/INTERFACES.md, docs/ARCHITECTURE.md, docs/DECISIONS.md, and the code involved in each defect.

## Rules for this round
- Fix the **root cause in the system that owns it** (INTERFACES.md §9). Don't weaken a test to make it pass; change a
  test only when the test itself is wrong, and say why in the commit message.
- Contracts in `src/sim/core/contracts/**` stay frozen. If a fix needs a contract change, stop on that defect and
  report it.
- Keep each fix small. Commit after each defect with a message `W2 integration (<owning area>): <what and why>`.
- The usual code rules apply: strict TypeScript, no `any`, no unexplained literals, `src/sim` pure and deterministic.

## Defects
1. **Real-physics shooting.** `src/sim/combat/guns.test.ts` › "wired into createSim › a hero shoots another in the arena
   through the real composition root" passed on Combat's branch (stub physics) and fails now that Rapier is live: no
   `damage.applied` event. Likely suspects: the aim or bullet ray hits hero capsule colliders (Layer.Hero) or starts
   inside the shooter's own capsule before Combat's hitbox test; or heroes are positioned or settled differently under
   real physics. Find out which, and fix it in the owner (combat or physics).
2. **Sandbox aim test.** `tests/helpers/sandbox.test.ts` › "places, aims through a point and an entity, and latches
   commands": ray distance 6.3e-5 against a 1e-6 tolerance. Find out why (for example, physics moving the hero between
   aiming and checking) and fix the test or the helper so the check is exact about what it means.
3. **QA's damage suite against Combat.** `PERCH_PENDING=1 npx vitest run tests/contracts/damage.test.ts` passes 21 of
   23:
   - "§5.5: 100% up to falloff start …": body-aimed shots come back with `beakShot: true`. Decide whether Combat's aim or
     hit resolution is wrong (a body-aimed shot landing on the head) or the test aims badly (spread at range, aim
     point). Fix the side that is wrong.
   - "§6.4: a unit that dies is despawned and its killer credited": the test's `hit()` helper reads the target's health
     after the unit has been despawned and the sandbox throws. Fix the test helper.

   When all 23 pass, **switch the damage suite to always-on** (remove its `PERCH_PENDING` gate), per D-EP-006. The pods
   and fledglings suites stay gated.
4. **Menu shows the wrong map.** `npm start` must show the real map lit behind the menu (Stage 1 gate, D-EP-017). Today
   the menu scene runs the 'arena' map under a 78% dark overlay (`npm run shots -- --scene menu`). Make the menu scene
   use the 'main' map with a camera view that shows it off (the overview preset, or a slow orbit if the camera stub
   makes that easy), and lighten the menu overlay so the map is clearly visible while the title and Play button stay
   readable. Look at the screenshot with the Read tool and iterate until it looks good.
5. **Two small tooling requests.** In `tools/`: make `npm run sim` print the final `hash()` on its single-run summary
   line, and let `npm run shots` pass extra URL parameters through (e.g. `--param key=value`).

## Done means
- `npm run check` passes all five steps on `integrate/w2`; quote the summary.
- `npx vitest run tests/contracts/damage.test.ts` passes 23 of 23 with no `PERCH_PENDING` set.
- `npm run sim -- --seed 1 --minutes 3 --bots 12` run twice prints the same hash; report ticks per second.
- `npm run shots -- --scene menu` and `--scene blockout --cam overview`: you looked at both.

## Finish
Append your Log entry to docs/STATUS.md (`### W2 · Integration · 18/11/2026`), listing each defect with root cause and
fix, and commit it. Reply to the EP in at most 200 words: each defect's root cause and fix (one line each), the commit
hashes, verification results, and anything you found but didn't fix.
