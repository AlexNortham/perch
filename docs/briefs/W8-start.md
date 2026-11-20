# Stage 4 · lane assignment and the zipline start · Architect, acting for Systems, Bot AI and UI (D-EP-018) · tag ARCH

Read W5-common.md first, then GDD §3.7 (Updrafts) and §6 (the base, gates and Updraft stations).

**The user, after playing Release 1:** "you should be assigned a lane at the start of the game and put on the zipline".

**Build:**
1. **Lane assignment at match start.** Every hero in a flock gets a lane, two per lane for six birds.
   - Deterministic from the seed.
   - Sensible: spread the archetypes, for example not two supports in one lane, and bots take what's left after the
     human.
   - It's part of the sim state and the view (`HeroView.lane` or similar; contracts are yours).
2. **The zipline start.** At match start every hero, human and bot, appears at the base end of their assigned lane's
   Updraft, already latched and riding out, with no input needed.
   - The normal ride rules apply: dash boosts, and dismounting works as usual.
   - Respawns stay as they are. Only the start is changed.
   - The Practice Hub and the replay scene are unaffected.
3. **Bots use the assignment** to choose their lane (`src/sim/ai/**`, acting for Bot AI). Keep their later rotations,
   grouping and sieging.
4. **The player sees their lane:**
   - on hero select or the match-start moment ("You're on Riverbank", for example);
   - highlighted on the minimap at the start.

   The UI is under `src/client/ui/**`.
5. **GDD:** update §6 and §3.7 to describe the start. Record D-ARCH decisions.

**Tests:**
- Assignment is deterministic and balanced.
- At tick 1 every hero is latched to its own lane's Updraft.
- e2e: in Play, the local hero is riding an Updraft within the first second with no input, and the lane banner shows.
- `npm run release-matches`: all 20 still end with a winner.
- `npm run check -- --release`.

**In parallel:** the Level Designer is reworking the lanes (bridges, height, isolation) in `src/sim/world/map/**`. Read
the Updraft station anchors through the map API, not hard-coded positions, so their rework flows through. Coordinate
through the EP if an anchor moves.

**Reply** in at most 150 words.
