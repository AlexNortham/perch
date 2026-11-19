# Wave 4 · Stage 3 (M2), The loop

Start from the EP's assigned local worktree and branch. Read the ownership map and W3 reports in STATUS.md,
BRIEF.md §2, GDD.md §16 M2, ARCHITECTURE.md, INTERFACES.md §§8–11 and the W3 request round, DECISIONS.md,
tests/README.md and your role brief. Wave implementers also read W4-contract-followups.md and QA's W4 rules suites.
The Stage 2 baseline is 6df745e. Contracts settle in W3.5, QA lands the gated rules on main, then implementation starts.

## Working agreement

- Run `git config --local user.email` before committing. It must print `alexanderjnortham@gmail.com`. Use the
  repository's Alex Northam identity. Only the EP works on main or pushes main to the existing private origin.
- Run `npm ci --prefer-offline --no-audit --no-fund` once in your own worktree. Use Git Bash for `npm run check`.
  On this machine Git Bash lives at `%LOCALAPPDATA%\Programs\Git\bin\bash.exe`. If the desktop sandbox cannot read
  Git, Node or the npm cache, request scoped shell access for that command. Never link dependencies between worktrees.
- Work only in your assigned paths. Commit each working piece locally, including before handing work back.
  Contracts in `src/sim/core/contracts/` are frozen throughout implementation. Route changes to other owners
  through the EP. Keep independent role work separate until integration.
- Preserve strict TypeScript, pure deterministic sim, named RNG streams and named data or presentation constants.
  Use original bird names, art and sounds. Keep the live player, sim, and menu on their normal command and view paths.
- Finish with all six steps of `npm run check` green on your branch. Inspect visual changes in actual PNGs from
  shots or Playwright. Use preview, shots and e2e for browser work. `npm start` opens a desktop browser and is
  reserved for the user. Keep tool output to pass/fail summaries. Run elapsed-time assertions in serial perf suites.
- Append your dated STATUS Log entry and D-<ROLE>-NNN decisions in the existing format. Include commands, counts,
  evidence paths, actual limitations and interface requests. Reply in at most 200 words with branch and commit.

## Acceptance

Play → hero select → Old Mossmarket as one Dawn hero. Twelve cards can be picked, including B1 and A2. Real earnings,
upgrades, shops, structures and a two-phase Dusk Patron lead to victory using ordinary player controls. Stage 2
movement, combat, pods and persisted Options still work. GDD §§7–10, 12–15 and the M2 feel checklist define the rules.
Hostile hero bots, neutral objectives and the rest of the roster and catalogue belong to later milestones.
