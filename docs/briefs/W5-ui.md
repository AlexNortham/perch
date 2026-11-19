# Wave 5a · UI & controls engineer (acting for #17 UI/HUD, #6 Camera & Input, and the app shell for named items) · tag UI

Read W5-common.md first.

**You own for this wave:** `src/client/ui/**` and `src/client/input/**`, plus the specific `src/client/app/**`
changes named below.

**Implement:**
1. **Hold to upgrade (D-EP-038).** There is no separate menu.
   - Holding the upgrade key frees the mouse over the existing HUD ability bar. Use the real cursor where an instant
     re-lock on release works. Otherwise draw a game cursor and keep pointer lock.
   - Clicking an icon or pressing 1–4 unlocks or upgrades that ability.
   - Hover shows the next tier, the cost and unspent AP, or why the upgrade isn't available.
   - Releasing the key locks the mouse back into aiming with no extra click.
   - Prove which route Edge, Chrome and Firefox each get.
2. **The always-on top scoreboard (D-EP-041).**
   - Centre: the timer and each flock's Seeds.
   - Six portraits per side, with health bars, Seeds, respawn countdowns and vision dimming.
   - Kill feed callouts ("First Blood", streaks).
   - Objective status in a strip below the portraits and on the minimap.
   - Remove the Tab scoreboard and its binding.
   - Portraits come from a provider interface. Until Rendering supplies real portraits in wave 5b, use a placeholder
     (team colour and initial).
3. **Practice Hub Swap bird (D-EP-040).**
   - An entry in the pause menu and an on-screen button.
   - Opens the picker without leaving the hub.
   - Respawns the player as the new bird, with 32 AP and the dummies reset.
   - Make the app-shell change this needs.
4. **No Interact (D-EP-039).** Remove the binding from the defaults and from Options, and migrate saved profiles
   cleanly.
5. **Hero select layout-shift bug** (the user's report in STATUS). Descriptions take no space in the grid, and no
   card moves on hover or focus.
6. **Your follow-ups.** Your sections of W5-contract-followups.md for UI and Input.

**Done means:**
- QA's pending browser specs for these items pass.
- You have looked at a 1080p screenshot of every changed screen.
- `npm run check` passes all six steps.
