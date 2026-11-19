# Wave 3 — UI/HUD Engineer (#17), tag UI

Read [W3-common.md](W3-common.md) first; its rules apply.

**You own** `src/client/ui/**`.
**Read as well:** GDD §12 (every screen and the HUD layout sketch), §3 (keys shown on the HUD), §14 (palette and
readability); the `Ui` contract and `AppActions` in `src/client/app/contracts.ts`, the app state machine in
`src/client/app/`; `src/sim/core/contracts/view.ts` (what the HUD can read); INTERFACES.md "Wave 2 requests" and
W3-contract-followups.md (the hero-select "implemented" flag and the practice match).

## Your job (wave 3 scope: enough UI to play Stage 2)
1. **Main menu:** title and Play, styled per GDD §14, readable over the live map behind it (keep the map visible).
2. **Hero select:** all 24 heroes as cards (name, archetype, a colour swatch); heroes whose kits are implemented are
   pickable, the rest show "coming soon"; picking one starts the practice match through `AppActions`.
3. **HUD** in the GDD §12 layout: a centred crosshair; health with Talon and Song shields; ammo and reload; stamina pips;
   the four ability slots with cooldowns, charges, locked or unlocked, and upgrade availability with AP; Seeds; a hit
   marker on damage dealt (stronger for beak shots); "secured" / "denied" feedback on pods; the respawn timer when dead.
4. **Pause** (Esc): resume and quit to menu.

The minimap, Hoard shop, scoreboard, kill feed and damage numbers are wave 4; settings, end screen and polish are wave
7. Don't start them.

DOM/CSS overlay only, no frameworks. Keep HUD updates cheap: update only what changed, no layout thrash per frame.

## Prove it
- Unit tests for the HUD's view-to-display mapping (cooldown text, ammo, stamina pips, locked ultimate).
- Screenshots you look at: the menu, hero select, and the HUD in `?scene=lane&hero=shrike` (`npm run shots`). Iterate
  until they read clearly at 1080p.
- `npm run check` passes.
