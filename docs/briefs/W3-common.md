# Wave 3 — rules for every engineer (Stage 2: "One bird in a lane")

You are one of eight engineers in wave 3 of a simulated 20-person game studio building **PERCH**: a browser-based,
third-person 6v6 hero shooter/MOBA (1 human + 11 bots; 24 bird heroes) whose gameplay loop follows Valve's Deadlock as
closely as possible, with every name, visual and sound reworked around birds. The Executive Producer (EP) briefed you;
you report back to the EP. Your role brief is the other file the EP pointed you to.

## Where you work
- Your own git worktree, on your own branch, created from `main`. Main holds wave 1 (GDD, sim core and contracts, app
  shell, toolchain), wave 2 (the real map "Old Mossmarket", the lit renderer, Rapier movement, combat and the damage
  pipeline, the ability framework, QA's sandbox and suites) and the wave 2.5 contract round.
- Don't touch the main checkout at C:\Users\AlexNortham\Documents\game. Windows 11, Node 22, 16 cores; the Bash tool
  runs Git Bash. Today is 18/11/2026 (it may be the early hours of 19/11 when you run).
- **First:** `npm ci --prefer-offline --no-audit --no-fund` once in your worktree, then confirm `npm run check` passes.
- **Always read:** docs/STATUS.md (rules, ownership map, plan; skim the wave 2 Log entries of the systems you touch),
  all of docs/INTERFACES.md (including its "Wave 2 requests" section), docs/ARCHITECTURE.md, docs/DECISIONS.md,
  **docs/briefs/W3-contract-followups.md** (what the Architect asks each owner to implement this wave), and
  tests/README.md (the sandbox helper). Your role brief names the GDD sections you need on top.

## The wave and the gate
Eight engineers in parallel, each on their own branch: Camera & Input, Technical Artist, Hero Engineer A, Rendering &
VFX, Objectives, Economy & Items, Systems follow-up (acting for Combat, Ability Systems and Character Controller), and
UI/HUD. You can't see each other's work until the EP merges; build against the contracts and use fakes in your own tests
where you need another system.

Stage 2's gate (docs/STATUS.md, M1): from the menu you pick a hero and drop into a lane; you can run, dash, slide,
mantle and ride Updrafts; shoot with working beak shots; use 4 abilities; fledglings march and fight; seed pods can be
secured and denied. `npm start` → Play → hero select → practice match. Screenshots and e2e reach the same match with
`?scene=lane&hero=<id>`. Everything you build must work there.

## Commit early and often
Commit after every working piece, at least every 20–30 minutes, with messages starting `W3 <Role>:`. Only committed work
survives an interruption (usage limits do stop agents mid-task; they get resumed later).

## Studio rules
- Edit only your owned paths (your role brief lists them). Never edit `src/sim/core/**`, `src/sim/index.ts`,
  `src/sim/heroes/registry.ts`, `src/sim/data/core.ts`, `src/client/app/**` or another role's files. Missing something
  in a contract? Interface requests in your report; work around it in your own area meanwhile (INTERFACES.md §10).
- Don't merge or rebase other branches; don't touch main. **Local only:** never add a git remote, push, publish or
  upload. Never run `npm start` (it opens a browser on the user's desktop).
- Originality (D-EP-002): no reference-game names in `src/` or player-facing text.
- Strict TypeScript, no `any`, noUncheckedIndexedAccess on. Gameplay numbers in your `src/sim/data` file; presentation
  constants in a named-constants module in your client folder (D-EP-009).
- `src/sim` stays pure and deterministic: no DOM, Node APIs, console, Math.random or wall clock; your own RNG stream.
- Performance: whole sim tick ≤ 1 ms in Node for a full 6v6 with ~150 fledglings; 60 FPS at 1080p on an iGPU. No
  per-tick or per-frame allocation in hot paths.
- Lean: the smallest design that meets your brief.
- **Done means proven:** `npm run check` passes on your branch and you quote it. Visual work: `npm run shots` (it takes
  `--param key=value` for extra URL parameters) and look at the PNG with the Read tool.

## Finish
Commit; on your branch append your Log entry to docs/STATUS.md (template there) and decisions to docs/DECISIONS.md
(`### D-<TAG>-NNN · <date> — title`, **Decision:**/**Why:**); commit those too. Reply to the EP in at most 200 words:
branch and last commit, what's done, what you verified (commands and results), what's not, interface requests, plus
anything your role brief asks for.
