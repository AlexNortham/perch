# W4 · Docs & Wiki engineer (new role #21) · tag WIKI

Read W4-common.md first; its working agreement applies (Gmail identity, commit after every working piece, never push,
never `npm start`, `npm run check` green). The user asked for this: "a full HTML wiki for every feature explaining
everything, updated whenever new features are added. Make it like an actual game wiki."

## You own
- `tools/wiki/**`: the generator and the hand-written page sources.
- `wiki/**`: the generated site, committed so it can be opened without building.
- The `wiki` script line in package.json (act for Build for that one line only).
- `tests/wiki/**`: the coverage test (act for QA for that folder only).

## How it stays current: generate, don't copy
- Read facts from the game itself, never by hand:
  - hero data (`src/sim/data/heroes/*`, the registry's `implemented` flags), with each ability's player-facing
    description and its three upgrade tiers;
  - the item catalogue (`src/sim/data/items.ts`);
  - the economy, world, movement and combat numbers in `src/sim/data/*`;
  - the input defaults;
  - the map, via the Level Designer's `mapSvg` (src/sim/world/map).
  A balance change must change the wiki.
- Design that isn't built yet comes from `docs/GDD.md` (heroes, items, objectives and modes still to come), labelled
  **"Coming in Stage N"** using the plan in docs/STATUS.md. Patch notes come from `PLAYABLE.md`.
- Hand-written prose (overviews, guides, mechanics explanations, short original flavour) lives in `tools/wiki/pages/`.
  Keep numbers out of it: pull them from data.
- `npm run wiki` regenerates everything. `tests/wiki/coverage.test.ts` runs the generator and fails if any hero,
  implemented ability, catalogue item, status, structure type or unit type has no page or section, or if any internal
  link is broken.
- Prefer no new dependency. If a small Markdown renderer saves real work, one well-known devDependency is acceptable;
  record it as a D-WIKI decision.

## Content (at least)
- **Home:** what PERCH is, the current stage, what's playable now, what's new this stage, quick links.
- **Getting started:** install and launch, controls (from the input defaults; explain Ctrl crouch and fullscreen in
  Chrome/Edge, D-EP-030), the Options screen, game modes (practice match, Practice Hub, and planned bot matches).
- **Heroes:**
  - an index grid of all 24: portrait, name, archetype, and "Playable" or "Coming in Stage N";
  - a page per hero: infobox with portrait, archetype, health, speed, stamina, size and gun stats; how to play;
    every ability as a card (targeting, cooldown, charges, range, description, tier 1/2/3 with AP cost); tips; and a
    "since Stage N" line.
- **The Magpie's Hoard (items):** by category (Talon, Plumage, Song) and tier, with cost, effects, actives, upgrade
  chains, "In the shop" or "Coming in Stage N", and how buying, selling, refunds and flex slots work.
- **Mechanics:**
  - movement, every move with its numbers;
  - camera and aim;
  - combat: Talon vs Song, resists, beak shots, falloff, light/heavy melee, parry, and a statuses table;
  - economy: Seeds, seed pods (secure and deny), the last-hit share, the levels table, AP, Molts, bounties, the
    comeback bonus, flex slots, respawn;
  - vision.
- **The map:** Old Mossmarket with the generated map, the three lanes, bases, Updrafts, Chimneys, Vines and shops.
- **Units and objectives:**
  - built: fledglings, Sentinel Hawk, Stilt Heron, Nest Wardens, Roost Shrines, Brood Ward, the two-phase Patrons,
    Home Roost;
  - planned: Golden Egg, the Roc and Phoenix Ember, Thickets, Nests, Feather runes.
- **Glossary** (GDD §2) and **Patch notes** (one section per stage).

## Look and feel: like a real game wiki
- Site header and wordmark; a left sidebar with sections; breadcrumbs; a client-side search box over an index of
  every page.
- Infobox panels; tables you can scan; cross-links everywhere (hero ↔ ability ↔ item ↔ mechanic).
- A "last regenerated" footer with stage and date.
- The GDD §14 palette with Dawn and Dusk team colours; light and dark themes; readable on a phone.
- Self-contained: works from file:// offline, with no CDNs or external fonts.
- Images: hero portraits, structure and Patron renders, and the dummies, captured from the game's own procedural
  models with the screenshot harness (`npm run shots` and the Technical Artist's `modelLineup` / `modelState` /
  `modelYaw` parameters). Save them as compact JPEG or WebP in `wiki/img/` and keep the whole wiki under about 10 MB.
- Originality (D-EP-002): no reference-game names anywhere on wiki pages.

## Done means
- `npm run wiki` builds, and the coverage test passes.
- Open `wiki/index.html` over file:// in Playwright (installed Edge). Screenshot the home page, a hero page, the items
  page, the map page and a mechanics page, look at each with the Read tool, and iterate until it reads like a real
  wiki.
- `npm run check` passes all six steps. Commit the generated `wiki/`.
- STATUS Log entry `### W4 · Docs & Wiki · 19/11/2026` and D-WIKI decisions.
- Reply in at most 200 words with your branch, last commit, page count, image count and size.
