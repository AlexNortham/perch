// Stage 4 pages: the neutral objectives (Thickets, Nests, runes, the Golden Egg, the Roc, Bell Feeders and the small
// interactables), the buildings and the Cellar Run, and the bots. Every number comes from the game's own data.
import { loadMap } from '../../src/sim/world/map';
import type { StatId, StatOp } from '../../src/sim/core/contracts';
import { DIFFICULTIES, OBJECTIVE } from '../../src/sim/data/ai';
import { ECONOMY } from '../../src/sim/data/economy';
import {
  CREATURES, CREATURE_SPECIALS, CRUMBS, EGG, EMBERS, FEEDERS, INTERACTABLES, KEEPSAKES, NESTS, NEST_RULES, ROC, RUNES, THICKETS, THICKET_FAMILIES,
} from '../../src/sim/data/world';
import { esc, num, pct } from './lib';
import type { Ctx } from './generate';
import { table, withBlocks } from './mechanics';

const clock = (s: number): string => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
const FAMILY_NAME = { beetles: 'Beetles', weasels: 'Weasels', rats: 'Rats', toads: 'Toads', badgers: 'Badger and cubs' } as const;
const CREATURE_NAME = { beetle: 'Beetle', weasel: 'Weasel', rat: 'Rat', toad: 'Toad', badger: 'Badger', cub: 'Badger cub' } as const;
const STAT_NAME: Partial<Record<StatId, string>> = {
  gunDamage: 'gun damage', fireRate: 'shots a second', magazine: 'magazine size', maxHealth: 'maximum health', songPower: 'Song power', talonResist: 'Talon resist',
  songResist: 'Song resist', cooldownReduction: 'ability cooldown reduction', moveSpeed: 'move speed (m/s)', staminaRecharge: 'stamina recharge speed', sprintSpeed: 'sprint speed (m/s)',
  stamina: 'stamina pips', healthRegen: 'health regeneration (HP/s)',
};
/** "+1.5", "+30%": adds are plain numbers; the other operations hold fractions. */
const amount = (op: StatOp, v: number): string => (op === 'add' ? `+${num(v)}` : `+${num(v * 100)}%`);
const statName = (s: StatId): string => STAT_NAME[s] ?? s;

export function registerStage4(ctx: Ctx): void {
  const map = loadMap('main');
  const { buildings = [], rooms = [], interactables = [], springs = [], openings = [] } = map;
  const enterable = new Set(rooms.map((r) => r.building).filter((b) => b >= 0));
  const camps = (family: string): number => map.thickets.filter((t) => t.family === family).length;
  const tierOf = (family: string): number => map.thickets.find((t) => t.family === family)?.tier ?? 0;
  const count = (variant: string): number => map.nests.filter((n) => n.variant === variant).length;
  const feeders = interactables.filter((i) => i.kind === 'feeder').length;
  const berries = interactables.filter((i) => i.kind === 'berry').length;
  const lookouts = interactables.filter((i) => i.kind === 'lookout').length;
  const hides = buildings.filter((b) => b.archetype === 'hide').length;

  const special = (c: keyof typeof CREATURES): string => {
    const s = CREATURES[c].special;
    if (s === 'dashBite') return `every ${num(CREATURE_SPECIALS.dashBite.everyS)} s a ${num(CREATURE_SPECIALS.dashBite.lungeM)} m lunge for ${num(CREATURE_SPECIALS.dashBite.damage)} Talon`;
    if (s === 'spit') return `every ${num(CREATURE_SPECIALS.spit.everyS)} s spits a ${num(CREATURE_SPECIALS.spit.radius)} m puddle for ${num(CREATURE_SPECIALS.spit.durationS)} s: ${num(CREATURE_SPECIALS.spit.dps)} damage a second and ${pct(CREATURE_SPECIALS.spit.slow, 0)} slow`;
    if (s === 'slam') return `every ${num(CREATURE_SPECIALS.slam.everyS)} s a slam (${num(CREATURE_SPECIALS.slam.telegraphS)} s warning, ${num(CREATURE_SPECIALS.slam.radius)} m, ${num(CREATURE_SPECIALS.slam.damage)} damage)`;
    const h = CREATURES[c].healReduction;
    return h ? `each bite cuts the victim's healing by ${pct(h.value, 0)} for ${num(h.durationS)} s` : '';
  };

  const blocks: Record<string, () => string> = {
    'thicket-shot': () => ctx.figure('map:thicket', 'A Beetle Thicket in the jungle, shortly after the camp first appears at 2:00.'),
    'rune-shot': () => ctx.figure('map:rune', 'A Feather rune waiting on a rune bridge at 5:00.'),
    'hollow-shot': () => ctx.figure('map:hollow', 'The Hollow from its west rim, shortly after the Roc wakes at 20:00.'),
    'tavern-shots': () => `<div class="gallery">${ctx.figure('map:tavern', 'The Tavern from the street.')}${ctx.figure('map:interior', 'Inside the Tavern.')}</div>`,
    'belltower-shot': () => ctx.figure('map:belltower', 'A Bell Tower, with its Bell Feeder near the top.'),
    'cellar-shots': () => `<div class="gallery">${ctx.figure('map:cellar', 'Along the Cellar Run.')}${ctx.figure('map:den', 'The Magpie Den.')}</div>`,
    'object-counts': () => table(['Feature', 'Count'], [
      ['Thicket camps', map.thickets.length], ['Nests', map.nests.length], ['Bell Feeders', feeders], ['Berry bushes', berries], ['Lookouts', lookouts], ['Hides', hides],
      ['Bough Springs', springs.length], ['Feather rune bridges', map.runeSpots.length], ['Egg Perches', map.eggPerches.length],
    ], [1]),
    'thicket-table': () => table(['Camp', 'Tier', 'Camps', 'Creatures', 'First appears', 'Returns after a clear', 'Resists (Talon / Song)'],
      (Object.keys(THICKET_FAMILIES) as (keyof typeof THICKET_FAMILIES)[]).map((f) => [
        FAMILY_NAME[f], tierOf(f), camps(f), THICKET_FAMILIES[f].units.map((u) => `${u.n} × ${CREATURE_NAME[u.type]}`).join(', '), clock(THICKET_FAMILIES[f].firstS),
        clock(THICKET_FAMILIES[f].respawnS), `${pct(THICKET_FAMILIES[f].resists.talon, 0)} / ${pct(THICKET_FAMILIES[f].resists.song, 0)}`,
      ]), [1, 2]),
    'creature-table': () => table(['Creature', 'Health', 'Damage per hit', 'Seeds at the start', 'Special'],
      (Object.keys(CREATURES) as (keyof typeof CREATURES)[]).map((c) => [
        CREATURE_NAME[c], num(CREATURES[c].hp), `${num(CREATURES[c].damage)} ${CREATURES[c].damageType === 'song' ? 'Song' : 'Talon'}`, num(ECONOMY.thicket.perCreature[c] ?? 0), special(c),
      ]), [1, 3]),
    'thicket-rules': () => table(['Rule', 'Value'], [
      ['A camp wakes when a hero comes within', `${num(THICKETS.wakeM)} m`], ['While asleep, damage from further than', `${num(THICKETS.snipeM)} m does nothing`],
      ['Creatures chase no further than', `${num(THICKETS.leashM)} m from home (plus ${num(THICKETS.chaseM)} m while they can see you)`],
      ['A camp walks home and heals after', `${num(THICKETS.calmS)} s without damage, or when dragged past the leash`],
      ['Each creature attacks', `whoever did the camp the most damage in the last ${num(THICKETS.aggroWindowS)} s`],
      ['Growth per minute of match time', `health +${pct(THICKETS.hpPerMinute, 0)}, damage +${pct(THICKETS.damagePerMinute)}, Seeds +${pct(ECONOMY.thicket.perMinute)} (fixed when the camp spawns)`],
      ['Seeds are shared with allies who hit it in the last', `${num(ECONOMY.thicket.windowS)} s`],
    ]),
    'nest-table': () => table(['Nest', 'On the map', 'Breaks to', 'Drops'], [
      ['Twig Nest', count('twig'), 'any hit, or a hero running through at 8.5 m/s or more', `a Seed sprig ${pct(NESTS.twig.sprig.chance, 0)} of the time (${num(NESTS.twig.sprig.base)} Seeds plus ${num(NESTS.twig.sprig.perMinute)} a minute); a crumb ${pct(NESTS.twig.crumb, 0)} of the time`],
      ['Woven Nest', count('woven'), 'one heavy melee hit (it is solid)', `always a Seed sprig (${num(NESTS.woven.sprig.base)} Seeds plus ${num(NESTS.woven.sprig.perMinute)} a minute); a crumb ${pct(NESTS.woven.crumb, 0)} of the time`],
      ['Keepsake Nest', count('keepsake'), 'any hit, or a hero running through', `a keepsake ${pct(NESTS.keepsake.keepsake, 0)} of the time`],
    ], [1]),
    'nest-rules': () => table(['Rule', 'Value'], [
      ['First appear', `on the surface ${clock(NEST_RULES.spawnS.surface)}, below ground ${clock(NEST_RULES.spawnS.below)}, in the Hollow ${clock(NEST_RULES.spawnS.hollow)}`],
      ['Return after being broken', `${clock(NEST_RULES.respawnS.surface)} on the surface, ${clock(NEST_RULES.respawnS.below)} below ground`], ['Seed sprig lasts', `${num(ECONOMY.nest.sprigLifeS)} s`],
    ]),
    'crumb-table': () => table(['Crumb', 'Effect for 60 s'], Object.values(CRUMBS.types).map((c) => [c.name, `${amount(c.op, c.value)} ${statName(c.stat)}`])),
    'rune-table': () => table(['Feather', `Strength at ${clock(RUNES.fromS)}`, `Strength at ${clock(RUNES.toS)}`], Object.values(RUNES.types).map((r) => [
      r.name, r.stats.map((s) => `${amount(s[1], s[2])} ${statName(s[0])}`).join('; '), r.stats.map((s) => `${amount(s[1], s[3])} ${statName(s[0])}`).join('; '),
    ])),
    'rune-rules': () => table(['Rule', 'Value'], [
      ['First appear / every', `${clock(RUNES.firstS)} / ${clock(RUNES.everyS)}`], ['Lasts', `${num(RUNES.durationS)} s after you claim it, or until you die`],
      ['Strength', `set when you claim it, rising steadily from ${clock(RUNES.fromS)} to ${clock(RUNES.toS)}`], ['Claim with', 'a heavy melee hit'],
    ]),
    'keepsake-table': () => table(['Keepsake', 'Before 10:00', '10:00 to 29:59', 'From 30:00'], KEEPSAKES.types.map((k) => [
      statName(k[0]), amount(k[1], k[3][0]), amount(k[1], k[3][1]), amount(k[1], k[3][2]),
    ])),
    'egg-table': () => table(['Rule', 'Value'], [
      ['First Egg / every', `${clock(EGG.firstS)} / ${clock(EGG.everyS)}, on the perch that did not hold the last one`], ['Lowered over', `${num(EGG.lowerS)} s before it can be taken`],
      ['Pick it up', 'with a light or heavy melee hit once it has landed'], ['Carrier', `cannot fire, cast, use items, parry, mantle or ride; revealed to the enemy; +${num(EGG.carrier.moveSpeed)} m/s and +${num(EGG.carrier.stamina)} stamina pip`],
      ['Dropped when', "the carrier dies, is stunned or displaced, or is hit by an enemy's melee; the carrier's own melee sets it down"], ['Nobody can take it for', `${num(EGG.dropLockoutS)} s after a drop`],
      ['Left alone for', `${num(EGG.unattendedS)} s it rolls towards its Hatching Stone at ${num(EGG.rollSpeed)} m/s`],
      ['After the first pickup', `${num(EGG.coolAfterS)} s later it starts to cool, and ${num(EGG.coolForS)} s after that it cracks and is lost`],
      ['Delivery', `carry it into the ${num(EGG.stoneM)} m circle at the other perch: automatic`], ['Value', `${num(EGG.value.base)} Seeds plus ${num(EGG.value.perMinute)} a minute, ×${num(EGG.value.trailingMult)} for a flock behind in net worth; it hatches into ${ECONOMY.egg.pods} golden pods`],
      ['The courier gets', `${EGG.keepsakes.courier} keepsakes; each other hero within ${num(EGG.keepsakes.escortM)} m of the Stone gets ${EGG.keepsakes.escort}`],
      ['A flock behind in net worth', `carries with +${pct(EGG.trailing.resistPerPct, 0)} resists and +${num(EGG.trailing.sprintPerPct)} m/s sprint per 1% behind, up to ${EGG.trailing.capPct}%`],
    ]),
    'roc-table': () => table(['Roc', 'Value'], [
      ['Wakes at', clock(ROC.wakeS)], ['Health', `${num(ROC.hp, 0)}, plus ${num(ROC.hpPerMinute, 0)} for every minute it has lived; regenerates ${num(ROC.regen)} a second`],
      ['Resists', `${pct(ROC.resists.talon, 0)} Talon`], ['Who can hurt it', 'only a bird down in the Hollow'],
      ['Rake', `every ${num(ROC.rake.everyS)} s at its target: ${num(ROC.rake.lengthM)} m cone, ${num(ROC.rake.damage)} Talon`], ['Gale Flap', `every ${num(ROC.flap.everyS)} s: ${num(ROC.flap.radius)} m, ${num(ROC.flap.damage)} Song, ${num(ROC.flap.push)} m knockback`],
      ['Enrage', `below ${pct(ROC.enrage.atFraction, 0)} health: a roar across the map, +${pct(ROC.enrage.attackSpeed, 0)} attack speed, and every ${num(ROC.shriek.everyS)} s a ${num(ROC.shriek.radius)} m shriek that silences for ${num(ROC.shriek.silenceS)} s`],
      ['Resets', `heals to full if nobody is in the Hollow for ${num(ROC.resetS)} s`], ['Returns after a kill', ROC.respawnS.map(clock).join(', then ') + ' (then 5:00 each time)'],
      ['Reward', `every hero of the killing flock gets ${num(ROC.reward.base)} Seeds plus ${num(ROC.reward.perMinute)} a minute, and ${ROC.reward.keepsakes} keepsakes`],
    ]),
    'ember-table': () => table(['Phoenix Embers', 'Value'], [
      ['When the Roc dies', `${EMBERS.spots.length} Embers fall over ${num(EMBERS.fallS)} s and burn for ${num(EMBERS.burnS)} s`], ['Claim with', 'a heavy melee hit, by either flock'],
      ['Claimer gets', `a full heal and ${num(ECONOMY.ember.base)} Seeds plus ${num(ECONOMY.ember.perMinute)} a minute`],
      ['Rekindle', `the claimer's flock gains a charge (at most ${EMBERS.maxCharges} per kill) lasting ${num(EMBERS.rekindleS)} s from the first claim; a charge revives a fallen hero where it fell, once per hero`],
      ['Siege flight', `while a flock holds Rekindle its new fledglings have +${pct(EMBERS.siegeFlight.hp, 0)} health and deal +${pct(EMBERS.siegeFlight.vsStructures, 0)} to structures`],
    ]),
    'feeder-table': () => table(['Bell Feeder', 'Value'], [
      ['On the map', `${feeders}, at the top of each Bell Tower and inside each Granary`], ['Appears', `${clock(FEEDERS.firstS)}, and ${clock(FEEDERS.respawnS)} after a break`], ['Health', num(FEEDERS.hp)],
      ['Hits', `light ${num(FEEDERS.light)}, heavy ${num(FEEDERS.heavy)}; each melee hit swings back for ${num(FEEDERS.swingBack)} Song unless the bell is chiming`],
      ['The chime', `from ${num(FEEDERS.chimeHp)} health its lamp blinks on a rhythm; a hit while it is lit gives keepsakes (${FEEDERS.keepsakes.light} light, ${FEEDERS.keepsakes.heavy} heavy)`],
      ['Seeds', `${num(FEEDERS.seeds.base)} plus ${num(FEEDERS.seeds.perMinute)} a minute at the first hit; a light hit pays 1/16 of it, a heavy hit 1/8 and the break 1/2, shared with allies who hit it within ${num(FEEDERS.seeds.shareWindowS)} s`],
    ]),
    'interact-table': () => table(['Feature', 'On the map', 'What it does'], [
      ['Berry bush', berries, `walk into it: heals ${pct(INTERACTABLES.berry.healFraction, 0)} of your health over ${num(INTERACTABLES.berry.healS)} s. First ripe at ${clock(INTERACTABLES.berry.firstS)}, back after ${clock(INTERACTABLES.berry.respawnS)}`],
      ['Hide', hides, `a small bird hide: inside it enemies outside cannot see or target you, you regenerate ${num(INTERACTABLES.hide.regen)} HP a second plus ${pct(INTERACTABLES.hide.regenMaxHp)} of your health, and your stamina recovers faster. It shows you ${num(INTERACTABLES.hide.showS)} s after you act against anyone`],
      ['Lookout', lookouts, `stand within ${num(INTERACTABLES.lookout.radiusM)} m and your flock sees out to ${num(INTERACTABLES.lookout.sight)} m from you`],
      ['Bough Spring', springs.length, 'walk onto the pad to be flung up and across to its landing'],
    ], [1]),
    'building-table': () => table(['Building', 'On the map', 'Enterable'], Object.entries(buildings.reduce<Record<string, number>>((m, b) => ({ ...m, [b.archetype]: (m[b.archetype] ?? 0) + 1 }), {})).map(([a, n]) => [
      a.replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase()), n, buildings.filter((b, i) => b.archetype === a && enterable.has(i)).length,
    ]), [1, 2]),
    'building-counts': () => table(['Feature', 'Count'], [
      ['Buildings', buildings.length], ['Enterable buildings', enterable.size], ['Rooms (one per storey, plus cellars and the Cellar Run)', rooms.length], ['Doors', openings.filter((o) => o.kind === 'door').length],
      ['Arches', openings.filter((o) => o.kind === 'arch').length], ['Windows', openings.filter((o) => o.kind === 'window').length], ['Leap windows (to jump through)', openings.filter((o) => o.kind === 'leap').length],
      ['Roof hatches and ladder holes', openings.filter((o) => o.kind === 'hatch').length], ['Balconies', openings.filter((o) => o.kind === 'balcony').length], ['Street grates into cellars', openings.filter((o) => o.kind === 'grate').length],
    ], [1]),
    'bot-table': () => table(['Skill', 'Value'], [
      ['Decides what to do every', `${num(DIFFICULTIES.normal.decisionS)} s`], ['Reaction time', `${num(DIFFICULTIES.normal.reactionS)} s`], ['Aim error', `${num(DIFFICULTIES.normal.aimErrorDeg)}° (plus a little for every m/s it moves)`],
      ['Retreats to heal below', `${pct(DIFFICULTIES.normal.retreatHp, 0)} health`], ['Parries', `${pct(DIFFICULTIES.normal.parryRate, 0)} of the time it could`],
      ['Sends a farming bot into Thickets', `tier 1 at once, tier 2 from level ${OBJECTIVE.tier2Level}, tier 3 from level ${OBJECTIVE.tier3Level} (${OBJECTIVE.tier3WithAllyLevel} with an ally near)`],
      ['Goes for the Egg from', `${num(OBJECTIVE.eggM)} m, with up to ${OBJECTIVE.eggBots} bots`], ['Roc attempt needs', `at least ${OBJECTIVE.rocAllies} allies alive and the enemy thinned or out of sight`],
    ]),
  };
  const make = (path: string, parent: string | undefined, section: string, prose: string, description: string, keywords: string): void => {
    ctx.add({
      path, title: ctx.prose(prose).title, section, ...(parent ? { parent } : {}), description, keywords,
      body: () => { const p = ctx.prose(prose); return `<h1>${esc(p.title)}</h1>${ctx.md(withBlocks(p.body, blocks))}`; },
    });
  };
  make('units/objectives.html', 'units/index.html', 'Units and objectives', 'objectives', 'Thickets, Nests, Feather runes, the Golden Egg, the Roc, Bell Feeders and the small interactables.',
    'golden egg roc phoenix ember rekindle thicket nest feather rune keepsake crumb bell feeder berry hide lookout spring hollow hatching stone');
  make('units/bots.html', 'units/index.html', 'Units and objectives', 'bots', 'The eleven bots in a 6v6 match: what they do and what they cannot.', 'bots ai lane shop siege farm egg roc');
  make('map/buildings.html', 'map/index.html', 'The map', 'buildings', 'Enterable buildings, stairs, roofs, the Cellar Run and the Magpie Den.', 'building interior stairs roof tavern bell tower granary cellar run magpie den tunnel hide');
}
