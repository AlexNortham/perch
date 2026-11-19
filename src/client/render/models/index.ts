/**
 * The model kit (client contract `ModelKit`): procedural low-poly birds built from each hero's BodyPlan, instanced
 * fledglings, and the old team-coloured box for everything else (structures, Patrons, pickups, areas, projectiles
 * and the other units wait for their own models). Rigs and animation live in ../rigs. Owner: Technical Artist.
 */
import type { Object3D } from 'three';
import { BoxGeometry, DoubleSide, Mesh, MeshBasicMaterial, MeshLambertMaterial } from 'three';
import { HERO_IDS, ViewFlag } from '../../../sim/core/contracts';
import type { EntityView, HeroId, PlayerTeam, StructureType } from '../../../sim/core/contracts';
import { STRUCTURE_RADIUS } from '../../../sim/data/world';
import { HEROES } from '../../../sim/heroes/registry';
import type { Frame, ModelKit } from '../../app/contracts';
import { entityById, interpolate } from '../../app/loop';
import { TEAM_COLOURS } from '../palette';
import { BirdRig } from '../rigs/bird-rig';
import { FledglingGroup, FledglingProxy } from '../rigs/fledgling-rig';
import { DomeGroup, StructureRig } from '../rigs/structure-rig';
import type { StructureMaterials } from '../rigs/structure-rig';
import type { BirdBuild } from './bird';
import { dummyMarker } from './dummy';
import type { DummyKind } from './dummy';
import { FLEDGLING, STRUCTURE } from './constants';
import { buildStructure } from './structures';
import type { StructureBuild } from './structures';
import { readDebugOptions } from './debug';
import type { DebugOptions } from './debug';
import { fledglingGeometry } from './fledgling';
import type { FledglingType } from './fledgling';
import { genericBuild, HERO_BUILDS } from './heroes';
import { hitboxOverlay } from './hitboxes';
import { createDebugScene } from './lineup';

const PLACEHOLDER_COLOURS = { dawn: 0xe8a33c, dusk: 0x6d6be0, neutral: 0x9a9a9a } as const;
/** Placeholder box height as a multiple of the entity's radius. */
const HEIGHT_PER_RADIUS = 4;
const MIN_SIZE = 0.2;
const DEBUG_STRUCTURE_SPACING = 12;
const DEBUG_PATRON_SPACING = 26;
const DEBUG_ROW_Z = 14;
const DEBUG_ID_BASE = 900;

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
const STRUCTURE_TYPES: readonly string[] = ['hawk', 'heron', 'warden', 'shrine', 'patron'];
const isStructure = (id: string): id is Exclude<StructureType, 'nest'> => STRUCTURE_TYPES.includes(id);
const isFledgling = (id: string): id is FledglingType => id === 'scrapper' || id === 'slinger';

export function createModelKit(overrides: Partial<DebugOptions> = {}): ModelKitDebug {
  const dev = import.meta.env.DEV && typeof location !== 'undefined' ? readDebugOptions(location.search) : null;
  const opt: DebugOptions = { hitboxes: false, lineup: [], wave: 0, yaw: 0, states: [], team: 'dawn', structures: [], ...dev, ...overrides };

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
  const structureMats: StructureMaterials = {
    lit: material,
    heart: new MeshBasicMaterial({ color: STRUCTURE.heartColour, side: DoubleSide }),
  };
  const domes = new DomeGroup(new MeshBasicMaterial({ color: STRUCTURE.domeColour, transparent: true, opacity: STRUCTURE.domeOpacity, depthWrite: false }));
  const structureBuilds = new Map<string, StructureBuild>();
  const markerMaterial = new MeshBasicMaterial({ vertexColors: true });
  const markers = new Map<string, Mesh>();
  let hitboxes = opt.hitboxes;

  const heroRig = (id: HeroId, team: PlayerTeam): BirdRig => {
    const { body: plan, weapon } = HEROES[id].def;
    const key = `${id}:${team}`;
    let build = builds.get(key);
    if (!build) {
      const make = HERO_BUILDS[id];
      build = make ? make(plan, TEAM_COLOURS[team]) : genericBuild(plan, TEAM_COLOURS[team], HERO_IDS.indexOf(id), HERO_IDS.length);
      builds.set(key, build);
    }
    const rig = new BirdRig(build, plan, material, weapon.fireRate);
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

  /** Practice Hub targets (controller 'dummy'): rings on the real hitboxes, red for the enemy, teal for the ally. */
  const syncDummy = (rig: BirdRig, kind: DummyKind | null): void => {
    const existing = rig.squash.getObjectByName('dummyMarker');
    if (existing && existing.userData['kind'] === kind) return;
    existing?.removeFromParent();
    if (!kind) return;
    const key = `${rig.name}:${kind}`;
    let m = markers.get(key);
    if (!m) {
      m = new Mesh(dummyMarker(rig.plan, kind), markerMaterial);
      m.name = 'dummyMarker';
      m.userData['kind'] = kind;
      m.frustumCulled = false;
      markers.set(key, m);
    }
    // One marker mesh per hero and kind, shared if two rigs want it: clone the mesh (the geometry stays shared).
    const own = m.parent ? m.clone() : m;
    rig.squash.add(own);
  };

  const syncHitboxes = (rig: BirdRig): void => {
    const existing = rig.squash.getObjectByName('hitboxes');
    if (hitboxes && !existing) rig.squash.add(hitboxOverlay(rig.plan));
    else if (existing) existing.visible = hitboxes;
  };

  const debugScene =
    opt.lineup.length > 0 || opt.wave > 0
      ? createDebugScene(opt, (id) => heroRig(id, opt.team), (type, team) => new FledglingProxy(fledglingGroup(type, team)), syncHitboxes)
      : null;

  /** Dev display row of structures (modelStructure=…), posed through the same rigs as the real ones. */
  let structRow: { rig: StructureRig; e: EntityView }[] | null = null;
  const poseStructureRow = (parent: Object3D, at: Object3D, frame: Frame, t: number): void => {
    if (!structRow) {
      let x = 0;
      structRow = opt.structures.map((token) => {
        const [type = '', states = ''] = token.split(':');
        const flags = states.split('+');
        if (!isStructure(type)) return null;
        const body = { radius: STRUCTURE_RADIUS[type], height: STRUCTURE.hawkColumn };
        const step = type === 'patron' ? DEBUG_PATRON_SPACING : DEBUG_STRUCTURE_SPACING;
        x += step / 2;
        const e = {
          id: DEBUG_ID_BASE + x, kind: 'structure', team: opt.team, type, pos: { x: at.position.x + x, y: at.position.y, z: at.position.z + DEBUG_ROW_Z },
          vel: { x: 0, y: 0, z: 0 }, yaw: Math.PI, pitch: 0, radius: body.radius, hp: 1, maxHp: 1, shield: 0, flags: 0, mode: null, seenBy: 3,
          structure: {
            type, lane: null, phase: flags.includes('p2') ? 2 : 1, body, target: flags.includes('target') ? 1 : null, broodWard: flags.includes('ward'),
            ...(flags.includes('tr') && { transitionUntil: Number.MAX_SAFE_INTEGER }),
            weakPoint: flags.includes('p2') ? { centre: { x: at.position.x + x, y: at.position.y + STRUCTURE.patronHeartUp, z: at.position.z + DEBUG_ROW_Z - STRUCTURE.patronHeartForward }, radius: 1 } : null,
          },
        } as EntityView;
        x += step / 2;
        const rig = kit.create(e) as StructureRig;
        parent.add(rig);
        return { rig, e };
      }).filter((s): s is { rig: StructureRig; e: EntityView } => s !== null);
    }
    for (const { rig, e } of structRow) {
      rig.position.set(e.pos.x, e.pos.y, e.pos.z);
      rig.rotation.y = e.yaw;
      rig.animate(e, frame.dt, t, frame.curr);
    }
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
      if (entity.kind === 'structure' && isStructure(entity.type) && entity.team !== 'neutral') {
        const body = entity.structure?.body ?? { radius: STRUCTURE_RADIUS[entity.type], height: STRUCTURE.hawkColumn };
        const key = `${entity.type}:${entity.team}:${body.radius}:${body.height}`;
        let build = structureBuilds.get(key);
        if (!build) {
          build = buildStructure(entity.type, entity.team, TEAM_COLOURS[entity.team], body);
          structureBuilds.set(key, build);
        }
        return new StructureRig(build, structureMats, domes);
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
        const heroView = frame.curr.heroes.find((h) => h.id === entity.id);
        const viewerTeam = frame.curr.heroes.find((h) => h.id === frame.curr.localHero)?.team;
        syncDummy(model, heroView?.controller === 'dummy' ? (heroView.team === viewerTeam ? 'ally' : 'enemy') : null);
        const hidden = (entity.flags & ViewFlag.Invisible) !== 0 && (entity.flags & ViewFlag.Revealed) === 0;
        const viewer = frame.curr.localHero === null ? undefined : entityById(frame.curr, frame.curr.localHero);
        model.visible = !hidden || viewer?.team === entity.team;
        if (opt.structures.length > 0 && model.parent && entity.id === (frame.curr.localHero ?? entity.id)) poseStructureRow(model.parent, model, frame, t);
        if (debugScene && model.parent) {
          if (opt.lineup.length > 0) model.visible = false;
          if (entity.id === (frame.curr.localHero ?? entity.id)) debugScene.update(model.parent, model, frame, t);
        }
      } else if (model instanceof StructureRig) {
        model.animate(entity, frame.dt, t, frame.curr);
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
