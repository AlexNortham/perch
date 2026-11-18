# Wave 2 — rules for every engineer

You are one of six engineers in wave 2 of a simulated 20-person game studio building **PERCH**: a browser-based,
third-person 6v6 hero shooter/MOBA (1 human + 11 bots; 24 bird heroes) whose gameplay loop follows Valve's Deadlock as
closely as possible, with every name, visual and sound reworked around birds. The Executive Producer (EP) runs the
studio and briefed you; you report back to the EP. Your role brief is the other file the EP pointed you to.

## Where you work
- You are in your own git worktree, on your own branch, created from `main`. Wave 1 is on main: the GDD, the sim core
  and contracts, the client app shell, a stub in every area, and the toolchain.
- Don't touch the main checkout at C:\Users\AlexNortham\Documents\game.
- Machine: Windows 11, Node 22, 16 cores. The Bash tool runs Git Bash. Today is 18/11/2026.
- **First:** run `npm ci --prefer-offline --no-audit --no-fund` once in your worktree, then confirm `npm run check`
  passes before you change anything.
- **Always read:** docs/STATUS.md (rules, ownership map, plan), all of docs/INTERFACES.md, docs/ARCHITECTURE.md,
  docs/DECISIONS.md. Your role brief names the GDD sections and contract files you need on top.

## The wave
Six engineers work in parallel, each on their own branch: Level Designer (the real map), Rendering & VFX (scene and
blockout renderer), QA (cross-system tests), Character Controller (Rapier physics), Combat, Ability Systems. You can't
see their work until the EP merges. Build against the frozen contracts in `src/sim/core/contracts`, not against your
peers' code. Where your tests need another system's behaviour, use a small fake of the contract interface inside your
own test files.

## Commit early and often
A previous attempt at this wave lost all its work when the sessions were cut off before anyone had committed. **Commit
after every working piece, at least every 20–30 minutes of work**, with messages starting `W2 <Role>:`. Only
committed work survives an interruption. Commit work in progress too if it compiles; never leave an hour of changes
uncommitted.

## Studio rules
- Edit only your owned paths. Never edit `src/sim/core/**`, `src/sim/index.ts`, `src/sim/heroes/registry.ts`,
  `src/sim/data/core.ts`, `src/client/app/**` or another role's files; QA blocks merges that do.
- If a contract is missing something, list it under Interface requests in your report and work around it inside your
  own area in the meantime (INTERFACES.md §10).
- Don't merge or rebase other branches, and don't touch main.
- **Local only:** never add a git remote, push, publish or upload anything.
- Never run `npm start`; it opens a browser on the user's desktop. `npm run shots` and `npm run e2e` manage their own
  servers.
- Originality (D-EP-002): no reference-game names in `src/` or player-facing text.
- TypeScript is strict with no `any`, and noUncheckedIndexedAccess is on. Gameplay numbers live in your
  `src/sim/data` file; presentation constants in a named-constants module in your client folder (D-EP-009); no
  unexplained literals in logic.
- `src/sim` stays pure and deterministic: no DOM, no Node APIs, no console, no Math.random, no wall clock. If you need
  randomness, use your own stream, `ctx.rng.stream('<system>')`.
- Performance matters: the whole sim tick budget is ≤ 1 ms in Node for a full 6v6 with ~150 fledglings. Avoid
  per-tick allocation in hot paths.
- Lean: build the smallest design that meets your brief.
- **Done means proven:** `npm run check` passes on your branch, and you quote what you ran. Visual work: capture with
  `npm run shots` and look at the PNG with the Read tool.

## Finish
1. Commit your work.
2. On your branch, append your Log entry to the end of docs/STATUS.md (template there) and any non-obvious decisions to
   docs/DECISIONS.md as `### D-<TAG>-NNN · 18/11/2026 — title` with **Decision:** and **Why:** lines (your tag is in
   your role brief). Commit those too.
3. Reply to the EP in at most 200 words (QA: 250): branch name and last commit hash, what's done, what you verified
   (commands and results), what's not done, and interface requests, plus anything your role brief asks for.
