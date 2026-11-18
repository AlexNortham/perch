# Between waves 2 and 3 — Technical Architect (#3): contract round, tag ARCH

Contracts are frozen during a wave and change between waves (INTERFACES.md §10). Wave 2 produced a pile of interface
requests. Your job is to settle them so wave 3 starts from one agreed set of contracts.

## Where you work
- Your own git worktree on your own branch, created from `integrate/w2` (main + all of wave 2 + integration fixes).
- Windows 11, Node 22, Git Bash via the Bash tool. Today is 18/11/2026.
- **First:** `npm ci --prefer-offline --no-audit --no-fund` once, then confirm `npm run check` passes.
- **Commit after every working piece** with messages starting `W2.5 Architect:`; only committed work survives an
  interruption. Local only: never add a remote, push, publish or upload. Never run `npm start`.
- Read: docs/STATUS.md (rules, plan, and every wave 2 Log entry: the **Interface requests** sections are your input),
  docs/INTERFACES.md, docs/ARCHITECTURE.md, docs/DECISIONS.md, docs/GDD.md where a request cites it.

## You own
`docs/ARCHITECTURE.md`, `docs/INTERFACES.md`, `src/sim/core/**` (incl. `contracts/`), `src/sim/index.ts`,
`src/sim/heroes/registry.ts`, `src/sim/data/core.ts`, `src/client/main.ts`, `src/client/app/**`. Edit nothing else.

## Do
1. **Collect** every interface request from the wave 2 Log entries (Combat, Ability Systems, Character Controller, QA,
   Rendering, Level Designer, Integration) into one list.
2. **Decide** each: accept, accept modified, or reject, with a one-line reason. Prefer additive, optional fields so
   existing code keeps compiling. Keep the one-owner-per-mechanic rule.
3. **Land** the accepted contract changes (types, events, effect fields, view fields, service methods) with TSDoc, and
   update INTERFACES.md (and ARCHITECTURE.md where it changes, e.g. D-CTRL-001's "no per-tick Rapier step").
4. **Fix core findings** from QA's wave 1 review that are yours: validate incoming commands (NaN or out-of-range look
   angles and axes), seed handling (seeds cut to 32 bits), the command staleness check by object identity that drops
   bot button presses, per-tick array allocation in the spatial hash and the store, and the telemetry beak-shot
   percentage.
5. **Write the follow-up list** `docs/briefs/W3-contract-followups.md`: for each accepted change that an owner must
   implement, the owner, what to implement and why. Group by owner (Combat, Ability Systems, Character Controller,
   Economy, Objectives, Hero Engineer A, UI, Build …). Wave 3 briefs will point at it.

## Done means
`npm run check` passes; two `npm run sim -- --seed 1 --minutes 3 --bots 12` runs print the same hash; the decisions are
in INTERFACES.md (a "Wave 2 requests" section) and DECISIONS.md (`D-ARCH-NNN`). Append your Log entry to docs/STATUS.md
(`### W2.5 · Technical Architect · 18/11/2026`) and commit. Reply to the EP in at most 200 words: branch and last
commit, counts (accepted / modified / rejected), the core fixes, and the owners with follow-ups.
