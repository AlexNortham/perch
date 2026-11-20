// The map page (generated from the Level Designer's map data and mapSvg) and the units and objectives pages.
import { loadMap, mapSvg } from '../../src/sim/world/map';
import { DEFENCE, FLEDGLING_AI, FLEDGLINGS, STRUCTURE_BODY, STRUCTURE_RADIUS, WAVES } from '../../src/sim/data/world';
import { ECONOMY } from '../../src/sim/data/economy';
import { TRAINING_TARGET } from '../../src/sim/data/core';
import { ITEMS } from '../../src/sim/data/items';
import { CURRENT_STAGE } from './facts';
import { esc, num, pct } from './lib';
import type { Ctx } from './generate';
import { table, withBlocks } from './mechanics';
import { rel } from './site';


const LANE_TITLE: Record<string, string> = { hedgerow: 'Hedgerow (west)', riverbank: 'Riverbank (middle)', pinewood: 'Pinewood (east)' };

function laneLength(path: readonly { x: number; z: number }[]): number {
  return path.slice(1).reduce((sum, p, i) => sum + Math.hypot(p.x - (path[i]?.x ?? 0), p.z - (path[i]?.z ?? 0)), 0);
}

export function registerWorld(ctx: Ctx, extra: Map<string, string>): void {
  const map = loadMap('main');
  // The generated map is saved as a file so it can be opened or enlarged on its own; the page inlines it.
  const svg = mapSvg(map, { scale: 3, nav: false, labels: true });
  extra.set('img/old-mossmarket-map.svg', svg);

  const count = (pred: (s: (typeof map.structures)[number]) => boolean): number => map.structures.filter(pred).length;
  const mapBlocks: Record<string, () => string> = {
    'map-svg': () => `<figure class="shot"><img src="${rel(ctx.here, 'img/old-mossmarket-map.svg')}" alt="Top-down map of Old Mossmarket drawn from the game's map data: three lanes between the Dawn base at the bottom and the Dusk base at the top, with Updrafts, Chimneys, Vines and tower positions" width="${Math.round((map.bounds.max.x - map.bounds.min.x) * 3)}" height="${Math.round((map.bounds.max.z - map.bounds.min.z) * 3)}"><figcaption>Generated from the map data by the game's own map renderer. North (the Dusk base) is up and east is on the left.</figcaption></figure>`,
    'lane-table': () => table(['Lane', 'Width', 'Length', 'Updraft stations'], map.lanes.map((l) => [esc(LANE_TITLE[l.id] ?? l.id), `${num(l.halfWidth * 2)} m`, `${num(laneLength(l.path), 0)} m`, num(map.updrafts.find((u) => u.lane === l.id)?.stations.length ?? 0)]), [1, 2, 3]),
    'map-counts': () => table(['Feature', 'Count'], [
      ['Hero spawns per flock', map.spawns.filter((s) => s.team === 'dawn').length], ['Structures (both flocks)', map.structures.length],
      ['Sentinel Hawks / Stilt Herons / Nest Wardens', `${count((s) => s.type === 'hawk')} / ${count((s) => s.type === 'heron')} / ${count((s) => s.type === 'warden')}`],
      ['Roost Shrines / Patrons', `${count((s) => s.type === 'shrine')} / ${count((s) => s.type === 'patron')}`], ['Updraft lines', map.updrafts.length],
      ['Chimneys', map.climbs.filter((c) => c.kind === 'chimney').length], ['Vines', map.climbs.filter((c) => c.kind === 'vine').length], ['Mantle ledges', map.ledges.length],
      ['Shops (Home Roosts and Magpie stalls)', map.shops.length], ['Thicket camps', map.thickets.length], ['Nests', map.nests.length], ['Feather rune bridges', map.runeSpots.length], ['Egg Perches', map.eggPerches.length],
      ['Bounds', `${num(map.bounds.max.x - map.bounds.min.x, 0)} m × ${num(map.bounds.max.z - map.bounds.min.z, 0)} m`],
    ], [1]),
    'lane-shots': () => `<div class="gallery">${['hedgerow', 'riverbank', 'pinewood'].map((l) => ctx.figure(`map:${l}`, `${LANE_TITLE[l]}: street level, ${l === 'hedgerow' ? 'walled gardens and hedges' : l === 'riverbank' ? 'a river, boardwalks and long sightlines' : 'tall pines and timber platforms'}.`)).join('')}</div>`,
    'map-shots': () => `<div class="gallery">${ctx.figure('map:overview')}${ctx.figure('map:top')}</div>`,
  };
  ctx.add({
    path: 'map/index.html', title: 'Old Mossmarket', section: 'The map', description: 'The PERCH map: three lanes, bases, Updrafts, Chimneys, Vines and shops.',
    keywords: 'map old mossmarket lanes hedgerow riverbank pinewood bases updraft chimney vine shop stall jungle',
    body: () => `<h1>Old Mossmarket</h1>${ctx.md(withBlocks(ctx.prose('map').body, mapBlocks))}`,
  });

  // ---- units and objectives ----
  const fr = (k: 'scrapper' | 'slinger') => FLEDGLINGS[k];
  const towerRows = (): (string | number)[][] => (['hawk', 'heron', 'warden', 'shrine', 'patron'] as const).map((t) => [
    ctx.link(t === 'patron' ? 'units/patrons' : `units/towers#${t}`, { hawk: 'Sentinel Hawk', heron: 'Stilt Heron', warden: 'Nest Warden', shrine: 'Roost Shrine', patron: 'Patron' }[t]),
    num(STRUCTURE_BODY[t].hp), `${num(STRUCTURE_BODY[t].height)} m`, `${num(STRUCTURE_RADIUS[t])} m`,
    t in ECONOMY.objective ? num(ECONOMY.objective[t as keyof typeof ECONOMY.objective]) : 'none (ends the match)',
  ]);
  const blocks: Record<string, () => string> = {
    'fledgling-table': () => table(['', 'Scrapper (melee)', 'Slinger (ranged)'], [
      ['Health', num(fr('scrapper').hp), num(fr('slinger').hp)], ['Damage per hit', num(fr('scrapper').damage), num(fr('slinger').damage)], ['Attack interval', `${num(fr('scrapper').intervalS)} s`, `${num(fr('slinger').intervalS)} s`],
      ['Range', `${num(fr('scrapper').range)} m`, `${num(fr('slinger').range)} m`], ['Projectile speed', '-', `${num(fr('slinger').projectileSpeed)} m/s`], ['Size', `${num(fr('scrapper').height)} m tall`, `${num(fr('slinger').height)} m tall`],
    ]),
    'wave-table': () => table(['From match time', 'Scrappers per lane', 'Slingers per lane'], WAVES.bands.map((b) => [`${Math.floor(b.fromS / 60)}:00`, b.scrapper, b.slinger]), [1, 2]),
    'fledgling-rules': () => table(['Rule', 'Value'], [
      ['First wave / every', `${num(WAVES.firstS)} s / ${num(WAVES.everyS)} s`], ['March speed', `${num(FLEDGLING_AI.marchSpeed)} m/s`], ['Column', `${WAVES.files} wide, ${num(WAVES.gap)} m apart`],
      ['Health and damage growth', `+${pct(WAVES.scalingPerMinute)} per minute, fixed at spawn`], ['Damage against structures', `×${num(WAVES.vsStructures)}`],
      ['Picks the nearest enemy fledgling within', `${num(FLEDGLING_AI.fledglingAggro)} m`], ['Retaliates against a hero who hurt an ally within', `${num(FLEDGLING_AI.hurtAggro)} m in the last ${num(FLEDGLING_AI.hurtWindowS)} s`], ['Attacks any hero within', `${num(FLEDGLING_AI.heroAggro)} m`],
      ['Drops a target after', `${num(FLEDGLING_AI.leash)} m`], ['Retargets every', `${num(FLEDGLING_AI.retargetS)} s`],
    ]),
    'tower-table': () => table(['Structure', 'Health', 'Height', 'Footprint radius', 'Seeds to each hero'], towerRows(), [1]),
    'hawk-table': () => table(['Hawk', 'Value'], [['Health', num(STRUCTURE_BODY.hawk.hp)], ['Attack range', `${num(DEFENCE.hawk.range)} m, one homing bolt every ${num(DEFENCE.hawk.interval)} s`], ['Damage', `${num(DEFENCE.hawk.heroHit)} to heroes, ${num(DEFENCE.hawk.unitHit)} to fledglings`], ['Ramp', `+${pct(DEFENCE.hawk.ramp, 0)} per consecutive shot on the same hero, up to +${pct(DEFENCE.hawk.cap, 0)}`], ['Bolt speed', `${num(DEFENCE.boltSpeed)} m/s, cannot be dodged`], ['Seeds', num(ECONOMY.objective.hawk)], ['Flex slots', ECONOMY.flexAwards.hawk]]),
    'heron-table': () => table(['Heron', 'Value'], [['Health', num(STRUCTURE_BODY.heron.hp)], ['Beam range', `${num(DEFENCE.heron.range)} m, ticking every ${num(DEFENCE.heron.interval)} s`], ['Damage per tick', `${num(DEFENCE.heron.heroHit)} to heroes, ${num(DEFENCE.heron.unitHit)} to fledglings`], ['Ramp', `+${pct(DEFENCE.heron.ramp, 1)} per tick on the same hero, up to +${pct(DEFENCE.heron.cap, 0)}`], ['Stomp', `every ${num(DEFENCE.stomp.interval)} s when an enemy is within ${num(DEFENCE.stomp.range)} m; ${num(DEFENCE.stomp.warning)} s warning, ${num(DEFENCE.stomp.damage)} Song damage, ${num(DEFENCE.stomp.push)} m knockback`], ['Seeds', num(ECONOMY.objective.heron)], ['Flex slots', ECONOMY.flexAwards.heron]]),
    'warden-table': () => table(['Warden', 'Value'], [['Health', num(STRUCTURE_BODY.warden.hp)], ['Attack range', `${num(DEFENCE.warden.range)} m, one homing bolt every ${num(DEFENCE.warden.interval)} s`], ['Damage', `${num(DEFENCE.warden.heroHit)} to heroes, ${num(DEFENCE.warden.unitHit)} to fledglings`], ['Seeds', num(ECONOMY.objective.warden)]]),
    'shrine-table': () => table(['Shrine', 'Value'], [['Health', num(STRUCTURE_BODY.shrine.hp)], ['Pulse', `every ${num(DEFENCE.pulse.interval)} s: ${num(DEFENCE.pulse.damage)} Song damage to enemy heroes within ${num(DEFENCE.pulse.range)} m`], ['Seeds', num(ECONOMY.objective.shrine)], ['Flex slots', ECONOMY.flexAwards.shrine]]),
    'patron-table': () => table(['', 'Phase 1', 'Transition', 'Phase 2'], [
      ['Health', num(STRUCTURE_BODY.patron.hp), `${num(DEFENCE.transition.duration)} s, invulnerable`, num(DEFENCE.transition.hp)],
      ['Feather Volley', `every ${num(DEFENCE.volley.phase1)} s: ${DEFENCE.volley.feathers} homing feathers over up to ${DEFENCE.volley.targets} heroes within ${num(DEFENCE.volley.range)} m, ${num(DEFENCE.volley.damage)} Song each`, `blast knocks enemies back ${num(DEFENCE.transition.push)} m within ${num(DEFENCE.transition.range)} m, no damage`, `every ${num(DEFENCE.volley.phase2)} s`],
      ['Screech', `every ${num(DEFENCE.screech.interval)} s if a hero is within ${num(DEFENCE.screech.range)} m: ${num(DEFENCE.screech.damage)} Song, ${num(DEFENCE.screech.push)} m knockback`, '', ''],
      ['Talon Rain', '', '', `every ${num(DEFENCE.rain.interval)} s: ${num(DEFENCE.rain.radius)} m circles under up to ${DEFENCE.rain.targets} heroes, ${num(DEFENCE.rain.warning)} s warning, ${num(DEFENCE.rain.damage)} Song each`],
      ['Wing Gale', '', '', `every ${num(DEFENCE.gale.interval)} s: ${num(DEFENCE.gale.range)} m cone, ${num(DEFENCE.gale.damage)} Song, ${num(DEFENCE.gale.push)} m push`],
      ['Weak point', '', '', 'glowing heart-feather on the chest: gun hits ×1.5'],
    ]),
    'ward-table': () => table(['Brood Ward', 'Value'], [['Range of the attacking fledgling check', `${num(DEFENCE.ward.range)} m`], ['Damage multiplier while no attacking fledgling is near', `×${num(1 - DEFENCE.ward.early)} (−${pct(DEFENCE.ward.early, 0)}) early, ×${num(1 - DEFENCE.ward.late)} (−${pct(DEFENCE.ward.late, 0)}) from ${num(DEFENCE.ward.lateAtS / 60, 0)}:00`], ['Fledglings spawned late are', `${pct(DEFENCE.ward.lateFledglingMult - 1, 0)} stronger`]]),
    'roost-table': () => table(['Home Roost', 'Value'], [['Heals your flock', `${pct(DEFENCE.roost.healFraction, 0)} of max HP every ${num(DEFENCE.roost.interval)} s`], ['Damages enemies', `${num(DEFENCE.roost.damage)} Song per second`], ['Also', 'respawn point and Magpie\'s Hoard']]),
    'dummy-table': () => table(['Practice Hub', 'Value'], [['Dummy placement', `${num(TRAINING_TARGET.ahead)} m ahead, ${num(TRAINING_TARGET.side)} m to each side`], ['Ally dummy starts wounded at', pct(TRAINING_TARGET.alliedHpFraction, 0)], ['Practice Ability Points', num(TRAINING_TARGET.practiceAp)], ['Items in the Hoard', ITEMS.length]]),
    'unit-shots': () => `<div class="gallery">${ctx.figure('unit:hawk', 'Sentinel Hawk')}${ctx.figure('unit:heron', 'Stilt Heron')}${ctx.figure('unit:warden', 'Nest Warden')}${ctx.figure('unit:shrine', 'Roost Shrine')}</div>`,
    'patron-shots': () => `<div class="gallery">${ctx.figure('unit:patron-dawn-1', 'The Elder Raven, phase 1 (Dawn)')}${ctx.figure('unit:patron-dawn-2', 'The Elder Raven, phase 2: the heart-feather glows')}${ctx.figure('unit:patron-dusk-1', 'The Great Owl, phase 1 (Dusk)')}${ctx.figure('unit:patron-dusk-2', 'The Great Owl, phase 2')}</div>`,
    'ward-shot': () => ctx.figure('unit:ward', 'A Patron under the pale Brood Ward dome.'),
    'fledgling-shot': () => ctx.figure('unit:fledglings'),
    'dummy-shot': () => `<div class="gallery">${ctx.figure('unit:dummies')}${ctx.figure('ui:practice', 'The Practice Hub HUD.')}</div>`,
    stage: () => `<p>Stage ${CURRENT_STAGE}</p>`,
  };
  const page = (path: string, parent: string | undefined, prose: string, description: string, keywords: string): void => {
    ctx.add({
      path, title: ctx.prose(prose).title, section: 'Units and objectives', ...(parent ? { parent } : {}), description, keywords,
      body: () => { const p = ctx.prose(prose); return `<h1>${esc(p.title)}</h1>${ctx.md(withBlocks(p.body, blocks))}`; },
    });
  };
  page('units/index.html', undefined, 'units', 'Fledglings, towers, Patrons and the objectives of a PERCH match.', 'units objectives structures towers');
  page('units/fledglings.html', 'units/index.html', 'fledglings', 'Scrappers and Slingers: waves, targeting and Seeds.', 'fledgling scrapper slinger wave lane minion');
  page('units/towers.html', 'units/index.html', 'towers', 'Sentinel Hawk, Stilt Heron, Nest Warden and Roost Shrine.', 'tower hawk heron warden shrine structure');
  page('units/patrons.html', 'units/index.html', 'patrons', 'The two-phase Patrons, the Brood Ward and the Home Roost.', 'patron elder raven great owl brood ward home roost victory');
  page('units/practice-dummies.html', 'units/index.html', 'dummies', 'The Practice Hub dummies.', 'dummy practice hub training');
}
