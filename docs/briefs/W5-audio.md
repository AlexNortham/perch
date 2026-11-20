# Wave 5b · Audio Engineer (#18) · tag AUDIO

Read W5-common.md first. You own `src/client/audio/**` (sound recipes in `src/client/audio/data/**`). Read GDD §13 and
§7.8–7.15, INTERFACES (the Stage 4 events and view fields) and your section of W5-contract-followups.md.

Add original synthesised sound for everything new in Stage 4:
- **The Golden Egg:** spawn, melee pickup, carrier loop, drop, delivery jingle.
- **The Roc:** wake, attacks, enrage, death, the three Embers and Rekindle.
- **Thickets:** creatures waking, attacking and dying; camp cleared.
- **Nests** breaking, and **Feather runes** spawning and being taken.
- **Every interactable:** Bell Feeder chimes and the beat it blinks on, Keepsakes, Berries, Hides, Bough Springs,
  Lookouts, ivy curtains, the Cellar Run, the Magpie Den.
- **Hold-Jump Updraft latch** and dismount.
- **Interiors:** a light room tone or reverb indoors.
- The UI's Mute toggle and the hero-select call hook, if the contracts or UI now provide them.

Keep the 48-voice cap and its priority stealing working with all of this live, and keep the music states reacting to
objectives (the Roc fight, the Egg carry, a siege). Prove the new sounds with the offline-render tests in `e2e/audio`,
which run serially (act for QA there for your new cases only), with distinct, non-silent signals per new event.
`npm run check` passes all six steps.
