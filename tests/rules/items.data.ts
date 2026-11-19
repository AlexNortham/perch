// GDD §10 as data (QA, W4.5): the 64-item catalogue, generated from the §10.1–10.3 tables and checked by
// tests/rules/items.test.ts. `stage4` marks the 16 items (★) added in Stage 4; `cooldownS` is the active's cooldown.
import type { ItemCategory, ItemId, ItemTier } from '../../src/sim/core/contracts';

export interface CatalogueRow {
  readonly id: ItemId;
  readonly name: string;
  readonly category: ItemCategory;
  readonly tier: ItemTier;
  readonly cost: number;
  readonly component: ItemId | null;
  readonly stage4: boolean;
  readonly cooldownS: number | null;
}

export const CATALOGUE: readonly CatalogueRow[] = [
  { id: 'quill-clip', name: "Quill Clip", category: 'talon', tier: 1, cost: 800, component: null, stage4: false, cooldownS: null },
  { id: 'close-talons', name: "Close Talons", category: 'talon', tier: 1, cost: 800, component: null, stage4: false, cooldownS: null },
  { id: 'beak-whetstone', name: "Beak Whetstone", category: 'talon', tier: 1, cost: 800, component: null, stage4: false, cooldownS: null },
  { id: 'quick-preen', name: "Quick Preen", category: 'talon', tier: 1, cost: 800, component: null, stage4: false, cooldownS: null },
  { id: 'foragers-talon', name: "Forager's Talon", category: 'talon', tier: 2, cost: 1600, component: null, stage4: false, cooldownS: null },
  { id: 'long-fletching', name: "Long Fletching", category: 'talon', tier: 2, cost: 1600, component: null, stage4: false, cooldownS: null },
  { id: 'bloodbeak', name: "Bloodbeak", category: 'talon', tier: 2, cost: 1600, component: null, stage4: false, cooldownS: null },
  { id: 'flurry-feathers', name: "Flurry Feathers", category: 'talon', tier: 2, cost: 1600, component: 'quick-preen', stage4: false, cooldownS: 30 },
  { id: 'hawkeye-lens', name: "Hawkeye Lens", category: 'talon', tier: 3, cost: 3200, component: 'beak-whetstone', stage4: false, cooldownS: null },
  { id: 'pinion-shred', name: "Pinion Shred", category: 'talon', tier: 3, cost: 3200, component: null, stage4: false, cooldownS: null },
  { id: 'skipping-stone', name: "Skipping Stone", category: 'talon', tier: 3, cost: 3200, component: null, stage4: false, cooldownS: null },
  { id: 'tailwind-volley', name: "Tailwind Volley", category: 'talon', tier: 3, cost: 3200, component: 'quill-clip', stage4: false, cooldownS: 25 },
  { id: 'apex-talon', name: "Apex Talon", category: 'talon', tier: 4, cost: 6400, component: null, stage4: false, cooldownS: null },
  { id: 'carrion-feast', name: "Carrion Feast", category: 'talon', tier: 4, cost: 6400, component: 'bloodbeak', stage4: false, cooldownS: null },
  { id: 'thunderclap-quills', name: "Thunderclap Quills", category: 'talon', tier: 4, cost: 6400, component: null, stage4: false, cooldownS: null },
  { id: 'talon-tempest', name: "Talon Tempest", category: 'talon', tier: 4, cost: 6400, component: 'flurry-feathers', stage4: false, cooldownS: 45 },
  { id: 'hooked-spur', name: "Hooked Spur", category: 'talon', tier: 1, cost: 800, component: null, stage4: true, cooldownS: null },
  { id: 'sourberry-rounds', name: "Sourberry Rounds", category: 'talon', tier: 2, cost: 1600, component: null, stage4: true, cooldownS: null },
  { id: 'wasp-barbs', name: "Wasp Barbs", category: 'talon', tier: 2, cost: 1600, component: null, stage4: true, cooldownS: null },
  { id: 'stoop-dive', name: "Stoop Dive", category: 'talon', tier: 3, cost: 3200, component: 'hooked-spur', stage4: true, cooldownS: 30 },
  { id: 'kestrel-eye', name: "Kestrel's Eye", category: 'talon', tier: 4, cost: 6400, component: 'long-fletching', stage4: true, cooldownS: null },
  { id: 'down-padding', name: "Down Padding", category: 'plumage', tier: 1, cost: 800, component: null, stage4: false, cooldownS: null },
  { id: 'thick-quills', name: "Thick Quills", category: 'plumage', tier: 1, cost: 800, component: null, stage4: false, cooldownS: null },
  { id: 'dew-drinker', name: "Dew Drinker", category: 'plumage', tier: 1, cost: 800, component: null, stage4: false, cooldownS: null },
  { id: 'featherlight', name: "Featherlight", category: 'plumage', tier: 1, cost: 800, component: null, stage4: false, cooldownS: null },
  { id: 'shade-ward', name: "Shade Ward", category: 'plumage', tier: 2, cost: 1600, component: 'grit-gizzard', stage4: false, cooldownS: null },
  { id: 'healing-dew', name: "Healing Dew", category: 'plumage', tier: 2, cost: 1600, component: 'dew-drinker', stage4: false, cooldownS: 40 },
  { id: 'talon-bulwark', name: "Talon Bulwark", category: 'plumage', tier: 2, cost: 1600, component: 'thick-quills', stage4: false, cooldownS: null },
  { id: 'second-wind', name: "Second Wind", category: 'plumage', tier: 2, cost: 1600, component: 'featherlight', stage4: false, cooldownS: null },
  { id: 'stout-breast', name: "Stout Breast", category: 'plumage', tier: 3, cost: 3200, component: 'down-padding', stage4: false, cooldownS: null },
  { id: 'preening-rite', name: "Preening Rite", category: 'plumage', tier: 3, cost: 3200, component: null, stage4: false, cooldownS: 40 },
  { id: 'covey-ward', name: "Covey Ward", category: 'plumage', tier: 3, cost: 3200, component: null, stage4: false, cooldownS: 55 },
  { id: 'iron-crest', name: "Iron Crest", category: 'plumage', tier: 3, cost: 3200, component: 'shade-ward', stage4: false, cooldownS: null },
  { id: 'second-clutch', name: "Second Clutch", category: 'plumage', tier: 4, cost: 6400, component: null, stage4: false, cooldownS: null },
  { id: 'thunderbird-heart', name: "Thunderbird Heart", category: 'plumage', tier: 4, cost: 6400, component: 'stout-breast', stage4: false, cooldownS: null },
  { id: 'unbowed-crest', name: "Unbowed Crest", category: 'plumage', tier: 4, cost: 6400, component: 'iron-crest', stage4: false, cooldownS: 60 },
  { id: 'nestmother-mantle', name: "Nestmother's Mantle", category: 'plumage', tier: 4, cost: 6400, component: null, stage4: false, cooldownS: null },
  { id: 'grit-gizzard', name: "Grit Gizzard", category: 'plumage', tier: 1, cost: 800, component: null, stage4: true, cooldownS: null },
  { id: 'rescue-call', name: "Rescue Call", category: 'plumage', tier: 2, cost: 1600, component: null, stage4: true, cooldownS: 40 },
  { id: 'kite-lift', name: "Kite Lift", category: 'plumage', tier: 3, cost: 3200, component: 'second-wind', stage4: true, cooldownS: 35 },
  { id: 'burr-coat', name: "Burr Coat", category: 'plumage', tier: 3, cost: 3200, component: null, stage4: true, cooldownS: null },
  { id: 'heartwood-bark', name: "Heartwood Bark", category: 'plumage', tier: 4, cost: 6400, component: 'talon-bulwark', stage4: true, cooldownS: null },
  { id: 'lilt-seed', name: "Lilt Seed", category: 'song', tier: 1, cost: 800, component: null, stage4: false, cooldownS: null },
  { id: 'quick-refrain', name: "Quick Refrain", category: 'song', tier: 1, cost: 800, component: null, stage4: false, cooldownS: null },
  { id: 'carrying-voice', name: "Carrying Voice", category: 'song', tier: 1, cost: 800, component: null, stage4: false, cooldownS: null },
  { id: 'mocking-note', name: "Mocking Note", category: 'song', tier: 1, cost: 800, component: null, stage4: false, cooldownS: null },
  { id: 'second-verse', name: "Second Verse", category: 'song', tier: 2, cost: 1600, component: null, stage4: false, cooldownS: null },
  { id: 'crescendo', name: "Crescendo", category: 'song', tier: 2, cost: 1600, component: null, stage4: false, cooldownS: null },
  { id: 'muting-whistle', name: "Muting Whistle", category: 'song', tier: 2, cost: 1600, component: null, stage4: false, cooldownS: 45 },
  { id: 'long-chorus', name: "Long Chorus", category: 'song', tier: 2, cost: 1600, component: null, stage4: false, cooldownS: null },
  { id: 'rising-song', name: "Rising Song", category: 'song', tier: 3, cost: 3200, component: 'lilt-seed', stage4: false, cooldownS: null },
  { id: 'tempo-shift', name: "Tempo Shift", category: 'song', tier: 3, cost: 3200, component: 'quick-refrain', stage4: false, cooldownS: null },
  { id: 'song-siphon', name: "Song Siphon", category: 'song', tier: 3, cost: 3200, component: null, stage4: false, cooldownS: null },
  { id: 'whirlwind-knot', name: "Whirlwind Knot", category: 'song', tier: 3, cost: 3200, component: null, stage4: false, cooldownS: 35 },
  { id: 'encore', name: "Encore", category: 'song', tier: 4, cost: 6400, component: null, stage4: false, cooldownS: 150 },
  { id: 'gloom-curse', name: "Gloom Curse", category: 'song', tier: 4, cost: 6400, component: 'muting-whistle', stage4: false, cooldownS: 60 },
  { id: 'boundless-song', name: "Boundless Song", category: 'song', tier: 4, cost: 6400, component: 'carrying-voice', stage4: false, cooldownS: null },
  { id: 'echo-chamber', name: "Echo Chamber", category: 'song', tier: 4, cost: 6400, component: 'mocking-note', stage4: false, cooldownS: null },
  { id: 'nettle-sting', name: "Nettle Sting", category: 'song', tier: 1, cost: 800, component: null, stage4: true, cooldownS: null },
  { id: 'warblers-trill', name: "Warbler's Trill", category: 'song', tier: 1, cost: 800, component: null, stage4: true, cooldownS: null },
  { id: 'tangle-pod', name: "Tangle Pod", category: 'song', tier: 2, cost: 1600, component: null, stage4: true, cooldownS: 35 },
  { id: 'blight-spores', name: "Blight Spores", category: 'song', tier: 3, cost: 3200, component: 'nettle-sting', stage4: true, cooldownS: null },
  { id: 'skylark-cadence', name: "Skylark Cadence", category: 'song', tier: 4, cost: 6400, component: 'warblers-trill', stage4: true, cooldownS: null },
  { id: 'rookery-dirge', name: "Rookery Dirge", category: 'song', tier: 4, cost: 6400, component: null, stage4: true, cooldownS: null },
];
