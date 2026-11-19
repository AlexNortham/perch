/**
 * The model kit (client contract `ModelKit`): procedural low-poly birds built from each hero's BodyPlan, instanced
 * fledglings, and the old team-coloured box for everything else (structures, Patrons, pickups, areas, projectiles
 * and the other units wait for their own models). Rigs and animation live in ../rigs. Owner: Technical Artist.
 */
import { BoxGeometry, Group, Mesh, MeshLambertMaterial } from 'three';
import type { Object3D } from 'three';
import { HERO_IDS, ViewFlag } from '../../../sim/core/contracts';
import type { EntityView, HeroId, PlayerTeam } from '../../../sim/core/contracts';
import { HEROES } from '../../../sim/heroes/registry';
import type { Frame, ModelKit } from '../../app/contracts';
import { entityById, interpolate } from '../../app/loop';
import { TEAM_COLOURS } from '../palette';
import { BirdRig } from '../rigs/bird-rig';
import { FledglingGroup, FledglingProxy } from '../rigs/fledgling-rig';
import type { BirdBuild } from './bird';
import { FLEDGLING } from './constants';
import { GDD_PLANS, readDebugOptions, STATES } from './debug';
import type { DebugOptions } from './debug';
import { fledglingGeometry } from './fledgling';
import type { FledglingType } from './fledgling';
import { genericBuild, HERO_BUILDS } from './heroes';
import { hitboxOverlay } from './hitboxes';

const PLACEHOLDER_COLOURS = { dawn: 0xe8a33c, dusk: 0x6d6be0, neutral: 0x9a9a9a } as const;
/** Placeholder box height as a multiple of the entity's radius. */
const HEIGHT_PER_RADIUS = 4;
const MIN_SIZE = 0.2;
const LINEUP_SPACING = 2.4;

type Mutable<T> = { -readonly [K in keyof T]: T[K] };

export interface ModelKitDebug extends ModelKit {
  /** Show or hide the head sphere and body capsule on every hero model (also on those already created). */
  setHitboxes(on: boolean): void;
}

declare global {
  interface Window {
    /** Dev builds only: QA's switch for the hitbox overlay. */
    __perchModels?: Pick<ModelKitDebug, 'setHitboxes'>;
  }
}

const isHero = (id: string): id is HeroId => (HERO_IDS as readonly string[]).includes(id);
const isFledgling = (id: string): id is FledglingType => id === 'scrapper' || id === 'slinger';

export function createModelKit(overrides: Partial<DebugOptions> = {}): ModelKitDebug {
  const dev = import.meta.env.DEV && typeof location !== 'undefined' ? readDebugOptions(location.search) : null;
  const opt: DebugOptions = { gddPlans: false, hitboxes: false, lineup: [], yaw: 0, states: [], team: 'dawn', ...dev, ...overrides };

  const material = new MeshLambertMaterial({ vertexColors: true, flatShading: true });
  const builds = new Map<string, BirdBuild>();
  const groups = new Map<string, FledglingGroup>();
  const rigs = new Set<BirdRig>();
  const boxGeometry = new BoxGeometry(1, 1, 1);
  const boxMaterials = {
    dawn: new MeshLambertMaterial({ color: PLACEHOLDER_COLOURS.dawn }),
    dusk: new MeshLambertMaterial({ color: PLACEHOLDER_COLOURS.dusk }),
    neutral: new MeshLambertMaterial({ color: PLACEHOLDER_COLOURS.neutral }),
  };
  let hitboxes = opt.hitboxes;

  const heroRig = (id: HeroId, team: PlayerTeam): BirdRig => {
    const plan = (opt.gddPlans ? GDD_PLANS[id] : undefined) ?? HEROES[id].def.body;
    const key = `${id}:${team}`;
    let build = builds.get(key);
    if (!build) {
      const make = HERO_BUILDS[id];
      build = make ? make(plan, TEAM_COLOURS[team]) : genericBuild(plan, TEAM_COLOURS[team], HERO_IDS.indexOf(id), HERO_IDS.length);
      builds.set(key, build);
    }
    const rig = new BirdRig(build, plan, material);
    rig.name = id;
    rigs.add(rig);
    return rig;
  };

  const fledglingGroup = (type: FledglingType, team: PlayerTeam): FledglingGroup => {
    const key = `${type}:${team}`;
    let g = groups.get(key);
    if (!g) {
      const scale = type === 'slinger' ? FLEDGLING.slingerScale : 1;
      g = new FledglingGroup(fledglingGeometry(type, TEAM_COLOURS[team]), material, FLEDGLING.nominalRadius * scale);
      groups.set(key, g);
    }
    return g;
  };

  const syncHitboxes = (rig: BirdRig): void => {
    const existing = rig.squash.getObjectByName('hitboxes');
    if (hitboxes && !existing) rig.squash.add(hitboxOverlay(rig.plan));
    else if (existing) existing.visible = hitboxes;
  };

  // Lineup (dev): display models standing in for the real heroes.
  let lineup: { root: Group; rigs: BirdRig[]; fake: Mutable<EntityView>[] } | null = null;
  const poseLineup = (parent: Object3D, at: Object3D, frame: Frame, t: number): void => {
    if (!lineup) {
      const root = new Group();
      const fake: Mutable<EntityView>[] = [];
      const made = opt.lineup.map((id, i) => {
        const rig = heroRig(id, opt.team);
        rig.position.x = (i - (opt.lineup.length - 1) / 2) * LINEUP_SPACING;
        rig.rotation.y = opt.yaw;
        root.add(rig);
        fake.push({
          id: 100 + i, kind: 'hero', team: opt.team, type: id, pos: { x: 0, y: 0, z: 0 }, vel: { x: 0, y: 0, z: 0 }, yaw: opt.yaw,
          pitch: 0, radius: 0.4, hp: 1, maxHp: 1, shield: 0, flags: 0, mode: null, seenBy: 3,
        });
        return rig;
      });
      parent.add(root);
      lineup = { root, rigs: made, fake };
    }
    lineup.root.position.copy(at.position);
    lineup.rigs.forEach((rig, i) => {
      const e = lineup?.fake[i];
      const state = STATES[opt.states.length > 0 ? (opt.states[i % opt.states.length] ?? 'idle') : 'idle'];
      if (!e || !state) return;
      e.flags = state.flags;
      e.mode = state.mode ?? null;
      e.vel.z = state.speed;
      e.vel.y = state.vy ?? 0;
      rig.animate(e, frame.dt, t, false);
      syncHitboxes(rig);
    });
  };

  const kit: ModelKitDebug = {
    create(entity) {
      if (entity.kind === 'hero' && isHero(entity.type) && entity.team !== 'neutral') {
        const rig = heroRig(entity.type, entity.team);
        syncHitboxes(rig);
        return rig;
      }
      if (entity.kind === 'unit' && isFledgling(entity.type) && entity.team !== 'neutral') {
        return new FledglingProxy(fledglingGroup(entity.type, entity.team));
      }
      const mesh = new Mesh(boxGeometry, boxMaterials[entity.team]);
      const size = Math.max(MIN_SIZE, entity.radius * 2);
      mesh.scale.set(size, Math.max(MIN_SIZE, entity.radius * HEIGHT_PER_RADIUS), size);
      return mesh;
    },
    pose(model, entity, frame) {
      const t = frame.prev.seconds + (frame.curr.seconds - frame.prev.seconds) * frame.alpha;
      if (model instanceof BirdRig) {
        const before = entityById(frame.prev, entity.id);
        model.animate(entity, frame.dt, t, before !== undefined && entity.hp < before.hp);
        syncHitboxes(model);
        const hidden = (entity.flags & ViewFlag.Invisible) !== 0 && (entity.flags & ViewFlag.Revealed) === 0;
        const viewer = frame.curr.localHero === null ? undefined : entityById(frame.curr, frame.curr.localHero);
        model.visible = !hidden || viewer?.team === entity.team;
        if (opt.lineup.length > 0 && model.parent && entity.id === (frame.curr.localHero ?? entity.id)) {
          model.visible = false;
          poseLineup(model.parent, model, frame, t);
        } else if (opt.lineup.length > 0) model.visible = false;
      } else if (model instanceof FledglingProxy) {
        model.animate(entity, t);
      } else {
        const p = interpolate(frame, entity);
        model.position.set(p.pos.x, p.pos.y + model.scale.y / 2, p.pos.z);
        model.rotation.y = p.yaw;
      }
    },
    setHitboxes(on) {
      hitboxes = on;
      for (const rig of rigs) syncHitboxes(rig);
    },
  };
  if (import.meta.env.DEV && typeof window !== 'undefined') window.__perchModels = { setHitboxes: kit.setHitboxes };
  return kit;
}
