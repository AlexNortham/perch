/**
 * The starter item-score table (D-EP-036, GDD §11.4–11.5, §11.8): the designer's prior, built from each hero's build
 * list and its archetype's cores. Bots shop by `scores[hero]` until the Build Lab (Balance & Data) replaces it with
 * learned values (D-EP-044). The shape is `ItemScores` (contracts/items.ts):
 *   score = base[item] + Σ synergy[owned][item] + phase[item][phase]
 * Prior terms: base 1.0 for the first list item, falling 0.05 per position, 0.2 off the list; synergy +0.3 when the
 * hero owns the item's component; phase +0.3 in the archetype's core for that phase. Situational picks (+0.15 when
 * their condition holds) are bot-condition data in data/ai and are not part of this table.
 */
import type { GamePhase, ItemId, ItemScores } from '../core/contracts';
import { ITEMS } from './items';

export const SCORE_PRIOR = { first: 1, step: 0.05, off: 0.2, component: 0.3, core: 0.3 } as const;

type Core = Readonly<Record<GamePhase, readonly ItemId[]>>;
const split = (s: string): readonly ItemId[] => s.split(' ');
const core = (early: string, mid: string, late: string): Core => ({ early: split(early), mid: split(mid), late: split(late) });

/** §11.8 early, mid and late cores per archetype. */
export const ARCHETYPE_CORES: Readonly<Record<string, Core>> = {
  gunCarry: core('quick-preen quill-clip close-talons dew-drinker', 'flurry-feathers foragers-talon pinion-shred sourberry-rounds', 'apex-talon talon-tempest carrion-feast'),
  spiritBurst: core('lilt-seed mocking-note quick-refrain warblers-trill', 'crescendo rising-song tempo-shift', 'echo-chamber boundless-song skylark-cadence'),
  tank: core('thick-quills down-padding grit-gizzard featherlight', 'talon-bulwark shade-ward stout-breast whirlwind-knot', 'heartwood-bark unbowed-crest thunderbird-heart'),
  support: core('lilt-seed dew-drinker quick-refrain grit-gizzard', 'healing-dew rescue-call covey-ward long-chorus', 'nestmother-mantle encore unbowed-crest'),
  assassin: core('hooked-spur lilt-seed featherlight beak-whetstone', 'stoop-dive crescendo second-wind mocking-note', 'echo-chamber gloom-curse second-clutch'),
  areaControl: core('lilt-seed quick-refrain dew-drinker carrying-voice', 'long-chorus tangle-pod tempo-shift rising-song', 'rookery-dirge boundless-song nestmother-mantle'),
  poke: core('beak-whetstone quill-clip long-fletching lilt-seed', 'hawkeye-lens tailwind-volley second-wind wasp-barbs', 'kestrel-eye apex-talon second-clutch'),
  skirmisher: core('featherlight close-talons quick-preen hooked-spur', 'kite-lift flurry-feathers wasp-barbs bloodbeak', 'carrion-feast talon-tempest thunderclap-quills'),
};

/** §11.5: hero → archetype, build list (the Stage 3 items in order) and ★ items. */
const HEROES: Readonly<Record<string, readonly [string, string, string]>> = {
  shrike: ['areaControl', 'lilt-seed quick-refrain dew-drinker carrying-voice long-chorus shade-ward tempo-shift rising-song muting-whistle iron-crest boundless-song gloom-curse unbowed-crest encore', 'nettle-sting tangle-pod'],
  albatross: ['tank', 'thick-quills down-padding dew-drinker lilt-seed talon-bulwark shade-ward stout-breast covey-ward iron-crest healing-dew thunderbird-heart unbowed-crest nestmother-mantle', 'grit-gizzard heartwood-bark'],
  kingfisher: ['assassin', 'beak-whetstone lilt-seed featherlight mocking-note crescendo second-wind hawkeye-lens rising-song shade-ward song-siphon echo-chamber second-clutch', 'hooked-spur stoop-dive'],
  lyrebird: ['support', 'lilt-seed quick-refrain dew-drinker down-padding healing-dew second-verse covey-ward tempo-shift shade-ward rising-song nestmother-mantle iron-crest encore', 'rescue-call'],
  owl: ['poke', 'beak-whetstone quill-clip long-fletching lilt-seed hawkeye-lens featherlight crescendo tailwind-volley shade-ward apex-talon rising-song second-clutch', 'kestrel-eye'],
  pelican: ['gunCarry', 'quick-preen quill-clip close-talons dew-drinker flurry-feathers bloodbeak foragers-talon tailwind-volley pinion-shred shade-ward carrion-feast apex-talon talon-tempest', 'sourberry-rounds'],
  secretarybird: ['skirmisher', 'featherlight quick-preen lilt-seed close-talons second-wind flurry-feathers crescendo thick-quills talon-bulwark rising-song skipping-stone thunderclap-quills second-clutch', 'hooked-spur stoop-dive'],
  starling: ['spiritBurst', 'lilt-seed mocking-note carrying-voice quick-refrain crescendo second-verse rising-song tempo-shift shade-ward echo-chamber boundless-song encore', 'nettle-sting blight-spores'],
  hornbill: ['gunCarry', 'quick-preen close-talons quill-clip down-padding foragers-talon flurry-feathers long-fletching pinion-shred stout-breast tailwind-volley apex-talon thunderclap-quills talon-tempest', 'sourberry-rounds kestrel-eye'],
  flamingo: ['support', 'lilt-seed dew-drinker quick-refrain featherlight healing-dew long-chorus covey-ward tempo-shift second-wind preening-rite nestmother-mantle rising-song', 'grit-gizzard rescue-call'],
  penguin: ['tank', 'thick-quills down-padding featherlight lilt-seed talon-bulwark second-wind shade-ward stout-breast iron-crest whirlwind-knot thunderbird-heart unbowed-crest', 'grit-gizzard kite-lift heartwood-bark'],
  puffin: ['areaControl', 'lilt-seed quick-refrain dew-drinker long-chorus carrying-voice second-verse tempo-shift shade-ward rising-song iron-crest boundless-song nestmother-mantle', 'tangle-pod rookery-dirge'],
  peacock: ['spiritBurst', 'lilt-seed mocking-note quick-refrain crescendo featherlight rising-song tempo-shift song-siphon second-wind echo-chamber encore second-clutch', 'warblers-trill skylark-cadence'],
  vulture: ['areaControl', 'lilt-seed dew-drinker thick-quills quick-refrain long-chorus song-siphon talon-bulwark tempo-shift rising-song down-padding stout-breast thunderbird-heart nestmother-mantle', 'nettle-sting rookery-dirge'],
  swift: ['skirmisher', 'featherlight quick-preen close-talons quill-clip second-wind flurry-feathers skipping-stone bloodbeak tailwind-volley carrion-feast apex-talon talon-tempest', 'wasp-barbs kite-lift'],
  hummingbird: ['skirmisher', 'featherlight close-talons lilt-seed dew-drinker second-wind bloodbeak healing-dew song-siphon skipping-stone preening-rite carrion-feast second-clutch', 'hooked-spur kite-lift'],
  cassowary: ['tank', 'thick-quills down-padding lilt-seed featherlight talon-bulwark shade-ward second-wind stout-breast iron-crest whirlwind-knot unbowed-crest thunderbird-heart', 'burr-coat heartwood-bark'],
  toucan: ['poke', 'lilt-seed carrying-voice quill-clip quick-refrain long-fletching crescendo tempo-shift rising-song shade-ward boundless-song tailwind-volley encore', 'wasp-barbs kestrel-eye'],
  woodpecker: ['gunCarry', 'quick-preen quill-clip close-talons thick-quills flurry-feathers pinion-shred talon-bulwark foragers-talon tailwind-volley apex-talon thunderclap-quills talon-tempest', 'sourberry-rounds wasp-barbs'],
  nightjar: ['assassin', 'lilt-seed mocking-note beak-whetstone featherlight muting-whistle crescendo second-wind rising-song hawkeye-lens gloom-curse echo-chamber second-clutch', 'warblers-trill stoop-dive'],
  frigatebird: ['poke', 'quill-clip beak-whetstone long-fletching featherlight lilt-seed hawkeye-lens second-wind tailwind-volley pinion-shred shade-ward apex-talon iron-crest', 'kite-lift kestrel-eye'],
  cockatoo: ['spiritBurst', 'lilt-seed quick-refrain mocking-note crescendo dew-drinker second-verse rising-song tempo-shift whirlwind-knot healing-dew echo-chamber encore', 'warblers-trill blight-spores'],
  swan: ['support', 'lilt-seed dew-drinker down-padding quick-refrain healing-dew covey-ward long-chorus preening-rite stout-breast tempo-shift nestmother-mantle thunderbird-heart', 'grit-gizzard rescue-call'],
  kiwi: ['assassin', 'close-talons lilt-seed featherlight mocking-note crescendo second-wind song-siphon skipping-stone rising-song muting-whistle gloom-curse second-clutch', 'hooked-spur stoop-dive blight-spores'],
};

const tierOf = new Map(ITEMS.map((i) => [i.id, i.tier]));
const componentOf = new Map(ITEMS.map((i) => [i.id, i.component]));

/** "Each Stage 4 item enters a hero's list just before the first listed item of a higher tier." */
function withStage4(list: readonly ItemId[], extra: readonly ItemId[]): ItemId[] {
  const out = [...list];
  for (const id of extra) {
    const at = out.findIndex((o) => (tierOf.get(o) ?? 0) > (tierOf.get(id) ?? 0));
    out.splice(at < 0 ? out.length : at, 0, id);
  }
  return out;
}

/** One hero's prior scores. Unlisted items score SCORE_PRIOR.off. */
function scoresOf(archetype: string, list: readonly ItemId[]): ItemScores {
  const base: Record<ItemId, number> = {};
  const phase: Record<ItemId, [number, number, number]> = {};
  const synergy: Record<ItemId, Record<ItemId, number>> = {};
  for (const item of ITEMS) {
    const at = list.indexOf(item.id);
    base[item.id] = at < 0 ? SCORE_PRIOR.off : SCORE_PRIOR.first - SCORE_PRIOR.step * at;
    if (item.component) (synergy[item.component] ??= {})[item.id] = SCORE_PRIOR.component;
  }
  const cores = ARCHETYPE_CORES[archetype]!;
  for (const [i, p] of (['early', 'mid', 'late'] as const).entries()) {
    for (const id of cores[p]) (phase[id] ??= [0, 0, 0])[i] = SCORE_PRIOR.core;
  }
  return { base, synergy, phase };
}

export const STARTER_SCORES: Readonly<Record<string, ItemScores>> = Object.fromEntries(
  Object.entries(HEROES).map(([hero, [archetype, list, extra]]) => [hero, scoresOf(archetype, withStage4(split(list), split(extra)))]));

/** Hero → archetype, for the Recommended strip's prior and the wiki. */
export const HERO_ARCHETYPE: Readonly<Record<string, string>> = Object.fromEntries(Object.entries(HEROES).map(([h, [a]]) => [h, a]));
// ponytail: situational picks (+0.15 when their condition holds) stay in data/ai; the Build Lab replaces this table in W6.
