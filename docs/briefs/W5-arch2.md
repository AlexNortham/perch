# Wave 5.5 · Technical Architect (#3) · contract round · tag ARCH

Read W5-common.md first. You own `docs/ARCHITECTURE.md`, `docs/INTERFACES.md`, `src/sim/core/**` (including
contracts), `src/sim/index.ts`, `src/sim/heroes/registry.ts`, `src/sim/data/core.ts`, `src/client/main.ts` and
`src/client/app/**`.

Collect every interface request in the wave 5a STATUS entries (Level Designer, Systems, Objectives, UI & controls,
Items A and B, Heroes A and B) and decide each one in INTERFACES.md. Known ones:
- **`SimOptions.practiceStart`:** the Practice Hub's Swap bird respawns the player at their spot. It replaces the UI's
  placement hack through `sim.ctx`.
- **Fold the map dressing descriptor into `MapData`:** `loadDressing('main')` and the building descriptors become a
  typed part of the map contract for the Environment Artist.
- **Delete the deprecated Interact bit** (D-ARCH-022). Nothing should read it any more; prove it, and migrate saved
  bindings.
- **`HealEffect.triggerPct`** (Toucan's Gape heal) and **`endOn: 'stun'`** (Tree Cling).
- Anything the Bot AI engineer requests while you work (they started in parallel). Look for interface requests in
  their commits or STATUS entry on their branch name, `worktree-agent-*`, in `git branch`.

Keep it additive where you can, and keep the determinism module rule (D-ARCH-021). Update
W5-contract-followups.md with the owner follow-ups for wave 6. `npm run check` passes all six steps. STATUS entry and
D-ARCH decisions.
