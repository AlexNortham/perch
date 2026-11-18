/**
 * Everything that touches Rapier: colliders, the scene queries behind PhysicsService and the hero character move.
 *
 * Two worlds, because Rapier queries only see a moved or new collider after `world.step()`, and a step costs about
 * 0.15 µs per collider even when nothing moved (0.15–0.5 ms on a city map):
 *  - `statics`: map prims (Layer.World) and structures (Layer.Structure). Stepped only when a collider is added or
 *    removed. It also holds one controller proxy per hero with no layer bits, so no query ever sees a proxy.
 *  - `bodies`: hero capsules (Layer.Hero), synced from the hero entities and stepped only when a query asks for
 *    Layer.Hero after heroes moved.
 * Units have no colliders: `moveCharacter` moves them over cached ground heights (cheap path, no walls).
 * Nothing here is dynamic, so there is no per-tick integration step (D-CTRL-001).
 */
import RAPIER from '@dimforge/rapier3d-compat';
import type { CharacterCollision, Collider, KinematicCharacterController, Shape as RShape, World } from '@dimforge/rapier3d-compat';
import { LAYERS_SOLID, Layer } from '../core/contracts';
import type {
  BlockoutPrim,
  CharacterMove,
  CoreContext,
  EntityId,
  PhysicsService,
  RayHit,
  Shape,
  Vec3,
} from '../core/contracts';
import { CROUCH_SCALE } from '../data/core';
import { CONTROLLER, GROUND } from '../data/movement';

const BITS = 16;
const ALL_LAYERS = 0xffff;
/** Rapier interaction groups: memberships in the high 16 bits, filter in the low 16. */
const groups = (memberships: number, filter: number): number => ((memberships << BITS) | filter) >>> 0;
/** A query hits colliders whose layer is in `mask`. */
const queryGroups = (mask: number): number => groups(ALL_LAYERS, mask);
const STATIC_GROUPS = queryGroups(LAYERS_SOLID);
const IDENTITY = { x: 0, y: 0, z: 0, w: 1 };
const HALF = 0.5;
/** Tolerance on the walkable-normal test. */
const NORMAL_EPS = 1e-3;
const WALKABLE_NY = Math.cos(GROUND.maxSlope) - NORMAL_EPS;
/** Room checks lift the capsule this far so resting on the floor isn't an overlap. */
const FIT_LIFT = CONTROLLER.skin * 2;
const COLUMN_PAD = 1;

const yawRot = (yaw: number) => ({ x: 0, y: Math.sin(yaw * HALF), z: 0, w: Math.cos(yaw * HALF) });

/** Result of a hero move. One object, reused: read it before the next move. */
export interface MoveResult {
  /** Movement actually applied. */
  readonly moved: Vec3;
  grounded: boolean;
  /** Steepest non-walkable surface hit (outward normal), if `hasWall`. */
  hasWall: boolean;
  readonly wall: Vec3;
  /** Walkable surface hit (outward normal), if `hasGround`. */
  hasGround: boolean;
  readonly ground: Vec3;
}

interface HeroColliders {
  readonly radius: number;
  readonly stand: number;
  readonly crouch: number;
  readonly proxy: Collider;
  readonly body: Collider;
  readonly standShape: RShape;
  readonly crouchShape: RShape;
  /** Height the proxy currently has. */
  proxyHeight: number;
  bodyHeight: number;
}

export interface Space {
  readonly service: PhysicsService;
  /** A hero's controller proxy and query body, from its body plan. */
  addHero(id: EntityId, radius: number, height: number): void;
  addStructure(id: EntityId, pos: Vec3, radius: number, height: number): void;
  remove(id: EntityId): void;
  /** Collide-and-slide for a hero from `feet` by `delta` (Rapier character controller). */
  moveHero(id: EntityId, feet: Vec3, crouching: boolean, delta: Vec3): MoveResult;
  /** True if the hero's capsule (standing or crouched) fits at `feet` without touching solid geometry. */
  fits(id: EntityId, feet: Vec3, crouching: boolean): boolean;
  /** Hero positions changed: re-sync the query bodies before the next Layer.Hero query. */
  heroesMoved(): void;
}

const capsuleHalf = (height: number, radius: number): number => Math.max(0, height * HALF - radius);

function primDesc(p: BlockoutPrim): RAPIER.ColliderDesc | null {
  let desc: RAPIER.ColliderDesc | null;
  switch (p.shape) {
    case 'box':
      desc = RAPIER.ColliderDesc.cuboid(p.size.x * HALF, p.size.y * HALF, p.size.z * HALF);
      break;
    case 'ramp': {
      // Wedge: floor = box bottom, slope from the bottom edge at local −z to the top edge at local +z.
      const x = p.size.x * HALF;
      const y = p.size.y * HALF;
      const z = p.size.z * HALF;
      desc = RAPIER.ColliderDesc.convexHull(
        new Float32Array([-x, -y, -z, x, -y, -z, -x, -y, z, x, -y, z, -x, y, z, x, y, z]),
      );
      break;
    }
    case 'cylinder':
      return RAPIER.ColliderDesc.cylinder(p.height * HALF, p.radius).setTranslation(p.centre.x, p.centre.y, p.centre.z);
  }
  return desc?.setTranslation(p.centre.x, p.centre.y, p.centre.z).setRotation(yawRot(p.yaw)) ?? null;
}

function toRapierShape(s: Shape): RShape {
  switch (s.kind) {
    case 'sphere':
      return new RAPIER.Ball(s.radius);
    case 'capsule':
      return new RAPIER.Capsule(s.halfHeight, s.radius);
    case 'box':
      return new RAPIER.Cuboid(s.halfExtents.x, s.halfExtents.y, s.halfExtents.z);
  }
}

export async function createSpace(ctx: CoreContext): Promise<Space> {
  await RAPIER.init();
  const { map, store } = ctx;
  const gravityFree = { x: 0, y: 0, z: 0 };
  const statics: World = new RAPIER.World(gravityFree);
  const bodies: World = new RAPIER.World(gravityFree);
  /** Collider handle → owning entity, per world. Map prims have no entry (entity null). */
  const staticOwner = new Map<number, EntityId>();
  const bodyOwner = new Map<number, EntityId>();
  const structures = new Map<EntityId, Collider>();
  const heroes = new Map<EntityId, HeroColliders>();
  let staticDirty = true;
  let heroesDirty = true;

  for (const p of map.prims) {
    if (!p.solid) continue;
    const desc = primDesc(p);
    if (!desc) throw new Error(`physics: prim ${JSON.stringify(p)} has no collider shape`);
    statics.createCollider(desc.setCollisionGroups(groups(Layer.World, ALL_LAYERS)));
  }

  const kcc: KinematicCharacterController = statics.createCharacterController(CONTROLLER.skin);
  kcc.enableAutostep(GROUND.stepUp, CONTROLLER.stepMinWidth, false);
  kcc.setMaxSlopeClimbAngle(GROUND.maxSlope);
  kcc.setMinSlopeSlideAngle(GROUND.maxSlope);
  kcc.enableSnapToGround(GROUND.snapDown);

  const syncStatic = (): void => {
    if (!staticDirty) return;
    statics.step();
    staticDirty = false;
    groundCache.clear();
  };

  const syncBodies = (): void => {
    if (!heroesDirty) return;
    for (const [id, c] of heroes) {
      const h = store.getKind(id, 'hero');
      if (!h) continue;
      c.body.setEnabled(!h.health.dead);
      const height = h.motor.crouching ? c.crouch : c.stand;
      if (height !== c.bodyHeight) {
        c.body.setHalfHeight(capsuleHalf(height, c.radius));
        c.bodyHeight = height;
      }
      c.body.setTranslation({ x: h.pos.x, y: h.pos.y + height * HALF, z: h.pos.z });
    }
    bodies.step();
    heroesDirty = false;
  };

  // ---- Cheap ground for units: every surface top in a cell's column, cached until the statics change. ----
  const cell = CONTROLLER.unitGroundCell;
  const cellsX = Math.ceil((map.bounds.max.x - map.bounds.min.x) / cell) + 1;
  const cellsZ = Math.ceil((map.bounds.max.z - map.bounds.min.z) / cell) + 1;
  const groundCache = new Map<number, Float64Array>();
  const columnRay = new RAPIER.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: -1, z: 0 });
  const columnTop = map.bounds.max.y + COLUMN_PAD;
  const columnLength = columnTop - map.killY + COLUMN_PAD;
  const tops: number[] = [];

  const column = (x: number, z: number): Float64Array => {
    const ix = Math.min(cellsX - 1, Math.max(0, Math.floor((x - map.bounds.min.x) / cell)));
    const iz = Math.min(cellsZ - 1, Math.max(0, Math.floor((z - map.bounds.min.z) / cell)));
    const key = ix * cellsZ + iz;
    let col = groundCache.get(key);
    if (col) return col;
    columnRay.origin.x = map.bounds.min.x + (ix + HALF) * cell;
    columnRay.origin.y = columnTop;
    columnRay.origin.z = map.bounds.min.z + (iz + HALF) * cell;
    tops.length = 0;
    statics.intersectionsWithRay(
      columnRay,
      columnLength,
      true,
      (hit) => {
        tops.push(columnTop - hit.timeOfImpact);
        return true;
      },
      undefined,
      STATIC_GROUPS,
    );
    col = Float64Array.from(tops).sort().reverse();
    groundCache.set(key, col);
    return col;
  };

  /** Highest cached surface at or below `fromY`, or null. */
  const unitGround = (x: number, z: number, fromY: number): number | null => {
    for (const y of column(x, z)) if (y <= fromY) return y;
    return null;
  };

  // ---- Queries. ----
  const ray = new RAPIER.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 1, z: 0 });
  const heroBody = (id: EntityId | undefined): Collider | undefined => (id === undefined ? undefined : heroes.get(id)?.body);
  const structureCollider = (id: EntityId | undefined): Collider | undefined =>
    id === undefined ? undefined : structures.get(id);

  const raycast: PhysicsService['raycast'] = (origin, dir, maxDistance, mask, ignore) => {
    ray.origin.x = origin.x;
    ray.origin.y = origin.y;
    ray.origin.z = origin.z;
    ray.dir.x = dir.x;
    ray.dir.y = dir.y;
    ray.dir.z = dir.z;
    let best: RayHit | null = null;
    if ((mask & LAYERS_SOLID) !== 0) {
      syncStatic();
      const hit = statics.castRayAndGetNormal(
        ray, maxDistance, true, undefined, queryGroups(mask & LAYERS_SOLID), structureCollider(ignore),
      );
      if (hit) best = rayHit(origin, dir, hit.timeOfImpact, hit.normal, staticOwner.get(hit.collider.handle) ?? null);
    }
    if ((mask & Layer.Hero) !== 0) {
      syncBodies();
      const hit = bodies.castRayAndGetNormal(
        ray, best?.distance ?? maxDistance, true, undefined, queryGroups(Layer.Hero), heroBody(ignore),
      );
      if (hit) best = rayHit(origin, dir, hit.timeOfImpact, hit.normal, bodyOwner.get(hit.collider.handle) ?? null);
    }
    return best;
  };

  const shapeCast: PhysicsService['shapeCast'] = (shape, origin, dir, maxDistance, mask, ignore) => {
    const s = toRapierShape(shape);
    const rot = shape.kind === 'box' ? yawRot(shape.yaw) : IDENTITY;
    let best: RayHit | null = null;
    const consider = (world: World, groupsFor: number, exclude: Collider | undefined, owner: Map<number, EntityId>) => {
      const hit = world.castShape(origin, rot, dir, s, 0, best?.distance ?? maxDistance, true, undefined, groupsFor, exclude);
      if (hit) {
        best = {
          distance: hit.time_of_impact,
          point: { x: hit.witness1.x, y: hit.witness1.y, z: hit.witness1.z },
          normal: { x: hit.normal1.x, y: hit.normal1.y, z: hit.normal1.z },
          entity: owner.get(hit.collider.handle) ?? null,
        };
      }
    };
    if ((mask & LAYERS_SOLID) !== 0) {
      syncStatic();
      consider(statics, queryGroups(mask & LAYERS_SOLID), structureCollider(ignore), staticOwner);
    }
    if ((mask & Layer.Hero) !== 0) {
      syncBodies();
      consider(bodies, queryGroups(Layer.Hero), heroBody(ignore), bodyOwner);
    }
    return best;
  };

  const overlap: PhysicsService['overlap'] = (shape, centre, mask, out) => {
    out.length = 0;
    const s = toRapierShape(shape);
    const rot = shape.kind === 'box' ? yawRot(shape.yaw) : IDENTITY;
    if ((mask & Layer.Structure) !== 0) {
      syncStatic();
      statics.intersectionsWithShape(centre, rot, s, (c) => {
        const id = staticOwner.get(c.handle);
        if (id !== undefined) out.push(id);
        return true;
      }, undefined, queryGroups(Layer.Structure));
    }
    if ((mask & Layer.Hero) !== 0) {
      syncBodies();
      bodies.intersectionsWithShape(centre, rot, s, (c) => {
        const id = bodyOwner.get(c.handle);
        if (id !== undefined) out.push(id);
        return true;
      }, undefined, queryGroups(Layer.Hero));
    }
    return out.sort((a, b) => a - b);
  };

  const groundHeight: PhysicsService['groundHeight'] = (x, z, fromY) => {
    const hit = raycast({ x, y: fromY, z }, { x: 0, y: -1, z: 0 }, Math.max(0, fromY - map.killY), LAYERS_SOLID);
    return hit ? fromY - hit.distance : null;
  };

  // ---- Hero character move. ----
  const result: MoveResult = {
    moved: { x: 0, y: 0, z: 0 },
    grounded: false,
    hasWall: false,
    wall: { x: 0, y: 0, z: 0 },
    hasGround: false,
    ground: { x: 0, y: 0, z: 0 },
  };
  let collision: CharacterCollision | undefined;

  const heroColliders = (id: EntityId): HeroColliders => {
    const c = heroes.get(id);
    if (!c) throw new Error(`physics: entity ${id} has no character controller`);
    return c;
  };

  const placeProxy = (c: HeroColliders, feet: Vec3, crouching: boolean): number => {
    const height = crouching ? c.crouch : c.stand;
    if (height !== c.proxyHeight) {
      c.proxy.setHalfHeight(capsuleHalf(height, c.radius));
      c.proxyHeight = height;
    }
    c.proxy.setTranslation({ x: feet.x, y: feet.y + height * HALF, z: feet.z });
    return height;
  };

  const moveHero: Space['moveHero'] = (id, feet, crouching, delta) => {
    syncStatic();
    const c = heroColliders(id);
    placeProxy(c, feet, crouching);
    kcc.computeColliderMovement(c.proxy, delta, undefined, STATIC_GROUPS);
    kcc.computedMovement(result.moved);
    result.grounded = kcc.computedGrounded();
    result.hasWall = false;
    result.hasGround = false;
    const n = kcc.numComputedCollisions();
    for (let i = 0; i < n; i++) {
      collision = kcc.computedCollision(i, collision) ?? collision;
      if (!collision) continue;
      const nrm = collision.normal1;
      if (nrm.y >= WALKABLE_NY) {
        if (!result.hasGround || nrm.y > result.ground.y) setVec(result.ground, nrm);
        result.hasGround = true;
      } else if (!result.hasWall || nrm.y < result.wall.y) {
        setVec(result.wall, nrm);
        result.hasWall = true;
      }
    }
    heroesDirty = true;
    return result;
  };

  const moveCharacter: PhysicsService['moveCharacter'] = (id, delta) => {
    const e = store.get(id);
    if (!e) throw new Error(`physics: moveCharacter on unknown entity ${id}`);
    if (e.kind === 'hero' && heroes.has(id)) {
      const r = moveHero(id, e.pos, e.motor.crouching, delta);
      const pos = { x: e.pos.x + r.moved.x, y: e.pos.y + r.moved.y, z: e.pos.z + r.moved.z };
      return { pos, grounded: r.grounded, wall: r.hasWall ? { ...r.wall } : null };
    }
    // Cheap path (units): follow the cached ground; steps up to stepUp, snaps down by snapDown; no walls.
    syncStatic();
    const x = e.pos.x + delta.x;
    const z = e.pos.z + delta.z;
    const y = e.pos.y + delta.y;
    const g = unitGround(x, z, Math.max(y, e.pos.y) + GROUND.stepUp);
    const grounded = g !== null && y <= g + GROUND.snapDown;
    return { pos: { x, y: grounded ? g : y, z }, grounded, wall: null } satisfies CharacterMove;
  };

  return {
    service: { raycast, shapeCast, overlap, moveCharacter, groundHeight },
    addHero(id, radius, height) {
      const stand = height;
      const crouch = height * CROUCH_SCALE;
      const proxy = statics.createCollider(
        RAPIER.ColliderDesc.capsule(capsuleHalf(stand, radius), radius).setCollisionGroups(groups(0, ALL_LAYERS)),
      );
      const body = bodies.createCollider(
        RAPIER.ColliderDesc.capsule(capsuleHalf(stand, radius), radius).setCollisionGroups(groups(Layer.Hero, ALL_LAYERS)),
      );
      bodyOwner.set(body.handle, id);
      heroes.set(id, {
        radius,
        stand,
        crouch,
        proxy,
        body,
        standShape: new RAPIER.Capsule(capsuleHalf(stand, radius), radius),
        crouchShape: new RAPIER.Capsule(capsuleHalf(crouch, radius), radius),
        proxyHeight: stand,
        bodyHeight: stand,
      });
      heroesDirty = true;
    },
    addStructure(id, pos, radius, height) {
      const c = statics.createCollider(
        RAPIER.ColliderDesc.cylinder(height * HALF, radius)
          .setTranslation(pos.x, pos.y + height * HALF, pos.z)
          .setCollisionGroups(groups(Layer.Structure, ALL_LAYERS)),
      );
      staticOwner.set(c.handle, id);
      structures.set(id, c);
      staticDirty = true;
    },
    remove(id) {
      const s = structures.get(id);
      if (s) {
        staticOwner.delete(s.handle);
        statics.removeCollider(s, false);
        structures.delete(id);
        staticDirty = true;
      }
      const h = heroes.get(id);
      if (h) {
        bodyOwner.delete(h.body.handle);
        statics.removeCollider(h.proxy, false);
        bodies.removeCollider(h.body, false);
        heroes.delete(id);
        heroesDirty = true;
      }
    },
    moveHero,
    fits(id, feet, crouching) {
      syncStatic();
      const c = heroColliders(id);
      const height = crouching ? c.crouch : c.stand;
      const centre = { x: feet.x, y: feet.y + height * HALF + FIT_LIFT, z: feet.z };
      const shape = crouching ? c.crouchShape : c.standShape;
      return statics.intersectionWithShape(centre, IDENTITY, shape, undefined, STATIC_GROUPS, c.proxy) === null;
    },
    heroesMoved() {
      heroesDirty = true;
    },
  };
}

function setVec(out: Vec3, v: Vec3): void {
  out.x = v.x;
  out.y = v.y;
  out.z = v.z;
}

function rayHit(origin: Vec3, dir: Vec3, toi: number, normal: Vec3, entity: EntityId | null): RayHit {
  return {
    distance: toi,
    point: { x: origin.x + dir.x * toi, y: origin.y + dir.y * toi, z: origin.z + dir.z * toi },
    normal: { x: normal.x, y: normal.y, z: normal.z },
    entity,
  };
}
