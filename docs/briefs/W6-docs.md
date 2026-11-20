# Stage 4 Release 1 · Docs & Wiki (#21) · tag DOCS

Read W5-common.md first, then D-EP-017 (PLAYABLE.md after every stage), D-EP-031 (a full HTML wiki with images, kept
current), D-EP-050 and D-EP-051 (Stage 4 ships functionality first, art later). You own `PLAYABLE.md`, `docs/wiki/**`,
`tools/wiki/**` and `tests/wiki/**`.

Stage 4 Release 1 is about to be pushed to `main`. The candidate is `integrate/w5`, and it has passed every release
check (STATUS, "Release 1 checks"). Do two things:

1. **PLAYABLE.md: a "Stage 4 (M3)" section,** in the same voice and layout as the Stage 1–3 sections.
   - How to launch it.
   - What a player can do now:
     - all 24 birds;
     - 64 items in three families and four tiers;
     - the rebuilt Old Mossmarket: buildings you can enter, with stairs, upper floors and roofs; the Cellar Run and the
       Magpie Den; the jungle and its Thicket camps; 100 breakable Nests; Feather runes; the Golden Egg (melee to pick it
       up); the Roc and its Embers; Bell Feeders and the other interactables;
     - bots that lane, shop, take objectives and siege, with matches that end (about 35–55 min);
     - hold-to-upgrade with the free cursor;
     - no Interact key (hold Jump for Updrafts);
     - the Practice Hub's Swap bird;
     - the always-on top scoreboard;
     - the 600-Seed starting purse.
   - What to try.
   - **Known limits, said plainly:**
     - the visual upgrade is still to come;
     - only 8 birds are on the new sculpted models, 12 are on older ones, and Frigatebird, Cockatoo, Swan and Kiwi use
       a default bird;
     - towers, Patrons, fledglings and creatures are still simple shapes;
     - the map art is on its second of three passes;
     - matches run long;
     - bot builds use the designer's starter scores until the Build Lab converges.

   Check every claim against the code or a test before writing it.
2. **The wiki.** Bring it up to date for everything in Stage 4: heroes (all 24, with their abilities and tiers), items
   (all 64), objectives, the map and its buildings, controls and settings, and bots. Use the existing generator, then
   run `npm run wiki` for the screenshots. `tests/wiki/coverage.test.ts` must pass. Look at a sample of the generated
   pages and images yourself, and make sure no page describes a feature that doesn't exist.

**Done means:**
- `npm run check -- --release` passes.
- STATUS entry.
- A reply in at most 120 words.
