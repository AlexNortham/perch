# Stage 4 (M3, "Full 6v6") · rules for every engineer

Read this first; your role brief is the other file the EP pointed you to.

## Where things stand
- **Stage 3 is the stable release on `main`** (4cea641): 12 playable birds, 16 items, the full structure match with a
  two-phase Patron, the HUD, minimap, shop, audio, Practice Hub, Options with key rebinding, and a generated wiki.
- **Stage 4 work branches from `integrate/w5`**, never from `main`. `main` only receives completed stages (D-EP-032).
  At the start of your task run `git reset --hard integrate/w5` in your own worktree, unless your brief says to
  continue a named branch.
- Read: docs/STATUS.md (rules, ownership map, the M3 plan and gate, the W4 Log entries), docs/DECISIONS.md (especially
  D-EP-002, -019, -030 to -037), docs/INTERFACES.md, docs/ARCHITECTURE.md, docs/GDD.md, PLAYABLE.md, tests/README.md,
  and the wiki (`wiki/index.html`) for a quick picture of what exists.

## Working agreement
- `git config --local user.email` must print `alexanderjnortham@gmail.com` before you commit. Never change the global
  git config.
- **Never push, never add a remote, never touch `main`.** Only the EP pushes, and only completed stages.
- `npm ci --prefer-offline --no-audit --no-fund` once in your worktree. Use Git Bash for `npm run check`.
- Edit only your assigned paths. Contracts in `src/sim/core/contracts/` are frozen during a wave; route requests through
  your STATUS entry.
- **Commit after every working piece.** Usage limits stop agents mid-task; only committed work survives.
- Never run `npm start` (it opens a browser on the user's desktop). Use `npm run shots`, Playwright, `npm run e2e`.
- Don't touch the worktrees under `C:\Users\AlexNortham\.codex\` (ChatGPT/Codex) or the main checkout.
- Quality bar: strict TypeScript, pure deterministic sim, named data and constants, zero lint warnings, tests with
  every behaviour. Animation bar (D-EP-035): every bird holds its weapon in every state; nothing floats. Originality
  (D-EP-002): mechanics may follow the reference game; names, art, wording and layout are PERCH's own.
- Keep tool output to pass/fail summaries. Look at real screenshots for anything visual.
- Finish: all six `npm run check` steps green on your branch; a dated STATUS Log entry; D-<ROLE>-NNN decisions; reply in
  at most 200 words with your branch and last commit.
