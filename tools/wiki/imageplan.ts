// The wiki's screenshot plan. Each image has a key the pages use, a file name that carries a hash of what the image
// depicts (so `npm run wiki` only re-captures images whose inputs changed) and a job the capture step runs.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { HERO_IDS } from '../../src/sim/core/contracts';
import type { HeroId } from '../../src/sim/core/contracts';
import { HEROES } from '../../src/sim/heroes/registry';
import { FLEDGLINGS, STRUCTURE_BODY, STRUCTURE_RADIUS, DEFENCE } from '../../src/sim/data/world';
import { hash } from './lib';
import { ROOT, isBuilt } from './facts';

/** Source folders whose code decides what an image looks like. Test files are ignored. */
function sourceHash(...dirs: string[]): string {
  const files: string[] = [];
  const walk = (d: string): void => {
    for (const name of readdirSync(join(ROOT, d)).sort()) {
      const p = `${d}/${name}`;
      if (statSync(join(ROOT, p)).isDirectory()) walk(p);
      else if (/\.ts$/.test(name) && !/\.test\.ts$/.test(name)) files.push(p);
    }
  };
  dirs.forEach(walk);
  return hash(...files.map((f) => readFileSync(join(ROOT, f), 'utf8')));
}
const HASH = {
  models: sourceHash('src/client/render/models', 'src/client/render/rigs'),
  render: sourceHash('src/client/render'),
  vfx: sourceHash('src/client/vfx'),
  ui: sourceHash('src/client/ui', 'src/client/app'),
  map: sourceHash('src/sim/world/map'),
};

/** Camera relative to the human's spawn: position and look-at, in metres. */
export type Cam = readonly [number, number, number, number, number, number];
export type Job =
  | { t: 'model'; lineup: readonly string[]; yaw: number; states: readonly string[]; team: 'dawn' | 'dusk'; cam: Cam; spacing?: number }
  | { t: 'structure'; token: string; team: 'dawn' | 'dusk'; cam: Cam }
  | { t: 'wave'; n: number; cam: Cam }
  | { t: 'ability'; hero: HeroId; slot: number }
  | { t: 'scene'; params: Readonly<Record<string, string>> }
  | { t: 'ui'; name: string };

export interface ImageSpec { key: string; file: string; alt: string; w: number; h: number; job: Job; fallback?: string }

export const plan: Map<string, ImageSpec> = new Map();
function add(key: string, kind: string, name: string, alt: string, w: number, h: number, job: Job, inputs: unknown[], fallback?: string): void {
  const file = `img/${kind}-${name}-${hash(job, w, h, ...inputs)}.jpg`;
  plan.set(key, { key, file, alt, w, h, job, ...(fallback ? { fallback } : {}) });
}
export const imageFor = (key: string): ImageSpec | undefined => plan.get(key);

/**
 * Framing, relative to the human's spawn. Display models face -z (yaw 180) and the camera stands on the -z side,
 * clear of the arena's boxes. The camera's horizontal FOV is 90 degrees, so a 4:3 frame spans 1.5 x distance.
 */
const FRONT_YAW = 180;
const frontCam = (h: number): Cam => [0, h * 0.55, -(h * 0.95 + 0.4), 0, h * 0.5, 0];
const portraitCam = (h: number): Cam => [0, h * 0.7, -(h * 0.4 + 0.4), 0, h * 0.62, 0];

for (const id of HERO_IDS) {
  if (!isBuilt(id)) continue;
  const def = HEROES[id].def;
  const base = [def.body, def.swatch, HASH.models];
  const name = def.name;
  const model = (yaw: number, cam: Cam): Job => ({ t: 'model', lineup: [id], yaw, states: ['idle'], team: 'dawn', cam });
  add(`hero:${id}:portrait`, 'hero', `${id}-portrait`, `${name}, three-quarter portrait`, 320, 320, model(FRONT_YAW - 35, portraitCam(def.body.height)), base);
  add(`hero:${id}:front`, 'hero', `${id}-front`, `${name}, full body from the front`, 640, 480, model(FRONT_YAW, frontCam(def.body.height)), base);
  add(`hero:${id}:side`, 'hero', `${id}-side`, `${name}, full body from the side`, 640, 480, model(90, frontCam(def.body.height)), base);
  def.abilities.forEach((a, i) => {
    add(`ability:${a.id}`, 'ability', a.id.replace(/\./g, '-'), `${name}'s ${a.name}, cast in the practice arena`, 640, 360,
      { t: 'ability', hero: id, slot: i }, [a, def.body, HASH.vfx, HASH.models], `hero:${id}:portrait`);
  });
}

const U = [HASH.models, HASH.render];
/** One structure stands at x = half its row step and z = 14 m ahead of the human, facing the human (models/index.ts). */
const structCam = (h: number, radius: number, step = 12): Cam => {
  const d = Math.max(h * 0.8, radius * 1.4);
  return [step / 2, h * 0.45, 14 - d, step / 2, h * 0.42, 14];
};
for (const [type, label] of [['hawk', 'Sentinel Hawk'], ['heron', 'Stilt Heron'], ['warden', 'Nest Warden'], ['shrine', 'Roost Shrine']] as const) {
  const hgt = STRUCTURE_BODY[type].height;
  add(`unit:${type}`, 'unit', type, `The ${label}, a Dawn tower`, 640, 480, { t: 'structure', token: type, team: 'dawn', cam: structCam(hgt, STRUCTURE_RADIUS[type]) }, [...U, STRUCTURE_BODY[type], DEFENCE[type]]);
}
for (const [team, name] of [['dawn', 'Elder Raven'], ['dusk', 'Great Owl']] as const) {
  const hgt = STRUCTURE_BODY.patron.height;
  add(`unit:patron-${team}-1`, 'unit', `patron-${team}-1`, `The ${name}, phase 1`, 640, 480, { t: 'structure', token: 'patron', team, cam: structCam(hgt, STRUCTURE_RADIUS.patron, 26) }, [...U, STRUCTURE_BODY.patron]);
  add(`unit:patron-${team}-2`, 'unit', `patron-${team}-2`, `The ${name}, phase 2 with the glowing heart-feather`, 640, 480, { t: 'structure', token: 'patron:p2', team, cam: structCam(hgt, STRUCTURE_RADIUS.patron, 26) }, [...U, STRUCTURE_BODY.patron]);
}
add('unit:ward', 'unit', 'ward', 'A Patron under the pale Brood Ward dome', 640, 480, { t: 'structure', token: 'patron:ward', team: 'dawn', cam: structCam(STRUCTURE_BODY.patron.height, STRUCTURE_RADIUS.patron, 26) }, [...U, DEFENCE.ward]);
add('unit:fledglings', 'unit', 'fledglings', 'Dawn and Dusk fledglings facing off: melee Scrappers in front, ranged Slingers behind', 640, 480, { t: 'wave', n: 8, cam: [5, 3.2, 2, 0, 0.6, 0] }, [...U, FLEDGLINGS]);
add('unit:dummies', 'unit', 'dummies', 'The Practice Hub: an enemy dummy and an ally dummy with hitbox rings', 640, 360, { t: 'scene', params: { scene: 'practice', hero: 'shrike' } }, [...U, HASH.ui]);

const poseSheet = (key: string, name: string, states: string[], alt: string): void => {
  const w = 1280;
  add(key, 'pose', name, alt, w, 420, { t: 'model', lineup: states.map(() => 'shrike'), yaw: FRONT_YAW, states, team: 'dawn', cam: [0, 1.6, -(2.4 * states.length * 0.5 + 2.5), 0, 0.9, 0] }, [HASH.models, HEROES.shrike.def.body]);
};
poseSheet('pose:movement', 'movement', ['idle', 'run', 'sprint', 'air', 'dash', 'slide', 'crouch', 'mantle', 'climb', 'updraft', 'glide'], 'Movement poses: idle, run, sprint, jump, dash, slide, crouch, mantle, climb, Updraft ride and glide');
poseSheet('pose:melee', 'melee', ['charge', 'light', 'heavy', 'parry'], 'Melee poses: charging a heavy swing, light swing, heavy swing and parry');
poseSheet('pose:status', 'status', ['shoot', 'reload', 'cast', 'channel', 'stun', 'dead'], 'Combat poses: firing, reloading, casting, channelling, stunned and downed');

add('home:banner', 'home', 'banner', 'Old Mossmarket at dawn, seen from above the Dawn base', 1280, 420, { t: 'scene', params: { scene: 'blockout', cam: 'overview' } }, [HASH.render, HASH.map]);
add('map:overview', 'map', 'overview', 'In-game overview of Old Mossmarket from behind the Dawn base', 1280, 720, { t: 'scene', params: { scene: 'blockout', cam: 'overview' } }, [HASH.render, HASH.map]);
add('map:top', 'map', 'top', 'In-game top-down view of Old Mossmarket', 960, 720, { t: 'scene', params: { scene: 'blockout', cam: 'top' } }, [HASH.render, HASH.map]);
for (const lane of ['hedgerow', 'riverbank', 'pinewood'] as const) {
  add(`map:${lane}`, 'map', lane, `Street-level view down the ${lane[0]?.toUpperCase()}${lane.slice(1)} lane`, 960, 540, { t: 'ui', name: `lane-${lane}` }, [HASH.render, HASH.map]);
}
const ui = (name: string, alt: string, w = 1280, h = 720): void => add(`ui:${name}`, 'ui', name, alt, w, h, { t: 'ui', name }, [HASH.ui, HASH.render]);
ui('hud', 'The in-match HUD: health, stamina, abilities, items, Seeds, minimap and flock scores');
ui('shop', "The Magpie's Hoard shop open at a Magpie stall");
ui('upgrades', 'The Ability Upgrades panel with AP and tier pips');
ui('scoreboard', 'The scoreboard held open with Tab');
ui('bigmap', 'The big map opened with M');
ui('minimap', 'The minimap in the corner of the HUD', 320, 320);
ui('options', 'The Options screen with key bindings and sliders');
ui('practice', 'The Practice Hub with its damaging and healing dummies');
ui('menu', 'The main menu floating over the lit map');
ui('heroselect', 'Hero select: playable birds can be picked, the rest are marked coming soon');

export const heroIds = HERO_IDS;
