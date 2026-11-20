/**
 * Learned builds (D-EP-036, INTERFACES §14.1): item scores per hero and each hero's recommended build. Round 0 is the
 * GDD §11.4 designer prior: scores from data/item-scores.ts (the §11.5 list order, component synergy, the §11.8
 * archetype cores) and builds from the §11.8 archetype rows. The Build Lab (Balance & Data, D-EP-044) replaces both
 * with learned values; sim/ai, the Magpie's Hoard and the wiki read them from here. Owner: Bot AI until W6.
 */
import type { BuildData, HeroId, ItemId, ItemScores, RecommendedBuild } from '../core/contracts';
import { ARCHETYPE_CORES, HERO_ARCHETYPE, STARTER_SCORES } from './item-scores';
import { SHOP } from './ai';

type Situational = RecommendedBuild['situational'][number];
const pick = (item: ItemId, when: string, condition?: string): Situational => (condition ? { item, when, condition } : { item, when });

/** GDD §11.8 situational picks per archetype; `condition` ids are evaluated by sim/ai (data/ai CONDITIONS). */
const SITUATIONAL: Readonly<Record<string, readonly Situational[]>> = {
  gunCarry: [
    pick('grit-gizzard', 'vs Song burst, then Shade Ward', 'enemySongBurst'), pick('bloodbeak', 'vs poke', 'enemyPoke'),
    pick('preening-rite', 'vs disables', 'enemyDisables'), pick('thunderclap-quills', 'vs divers', 'enemyDivers'),
    pick('kestrel-eye', 'for long lanes'),
  ],
  spiritBurst: [
    pick('nettle-sting', 'vs healers, then Blight Spores', 'enemyHealers'), pick('grit-gizzard', 'vs burst', 'enemySongBurst'),
    pick('second-clutch', 'when dived', 'enemyDivers'), pick('muting-whistle', 'vs channelled ultimates'),
    pick('encore', 'for ultimate-heavy kits'),
  ],
  tank: [
    pick('burr-coat', 'vs gun carries', 'enemyGunCarries'), pick('iron-crest', 'vs disables', 'enemyDisables'),
    pick('kite-lift', 'to initiate from height'), pick('nestmother-mantle', 'in grouped fights', 'enemyGrouped'),
    pick('rookery-dirge', 'for Cassowary'),
  ],
  support: [
    pick('preening-rite', 'vs disables', 'enemyDisables'), pick('second-verse', 'for charge kits'),
    pick('tangle-pod', 'to peel', 'enemyDivers'), pick('iron-crest', 'vs disables', 'enemyDisables'), pick('tempo-shift', 'for cooldowns'),
  ],
  assassin: [
    pick('hawkeye-lens', 'for gun-leaning kits'), pick('blight-spores', 'vs healers', 'enemyHealers'),
    pick('kite-lift', 'to escape'), pick('song-siphon', 'for sustain'), pick('muting-whistle', 'early'),
  ],
  areaControl: [
    pick('nettle-sting', 'vs healers', 'enemyHealers'), pick('iron-crest', 'vs disables', 'enemyDisables'),
    pick('covey-ward', 'in grouped fights', 'enemyGrouped'), pick('second-verse', 'for charge kits'),
  ],
  poke: [
    pick('kite-lift', 'vs divers', 'enemyDivers'), pick('grit-gizzard', 'vs burst, then Shade Ward', 'enemySongBurst'),
    pick('pinion-shred', 'vs tanks', 'enemyTanks'), pick('boundless-song', 'for Toucan'),
  ],
  skirmisher: [
    pick('stoop-dive', 'for Secretarybird'), pick('preening-rite', 'vs disables', 'enemyDisables'),
    pick('sourberry-rounds', 'vs healers', 'enemyHealers'), pick('skipping-stone', 'vs grouped enemies', 'enemyGrouped'),
    pick('second-clutch', 'when dived', 'enemyDivers'),
  ],
};

function buildOf(archetype: string): RecommendedBuild {
  const cores = ARCHETYPE_CORES[archetype];
  return { early: cores?.early ?? [], mid: cores?.mid ?? [], late: cores?.late ?? [], situational: SITUATIONAL[archetype] ?? [] };
}

export const BUILDS: BuildData = {
  round: 0,
  matches: 0,
  phases: { midFromS: SHOP.midFromS, lateFromS: SHOP.lateFromS },
  scores: STARTER_SCORES as Readonly<Partial<Record<HeroId, ItemScores>>>,
  builds: Object.fromEntries(Object.entries(HERO_ARCHETYPE).map(([hero, archetype]) => [hero, buildOf(archetype)])) as
    Readonly<Partial<Record<HeroId, RecommendedBuild>>>,
};
