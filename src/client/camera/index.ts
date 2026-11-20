import { aimRay, lookDir, pivotHeight, rightDir } from '../../sim/core/aim';
import { ViewFlag } from '../../sim/core/contracts';
import type { MapData, MapId, Vec3 } from '../../sim/core/contracts';
import { lerpVec } from '../../sim/core/math';
import { CAMERA, DEFAULT_AIM_ZOOM } from '../../sim/data/core';
import { HEROES } from '../../sim/heroes/registry';
import { loadMap } from '../../sim/world/map';
import type { CameraPose, CameraRig, Settings } from '../app/contracts';
import { entityById, interpolate } from '../app/loop';
import { freeDistance } from './collide';
import {
  CROUCH_EASE_S,
  CUT_BLEND_S,
  DASH_KICK_DEG,
  DASH_KICK_DOWN_S,
  DASH_KICK_UP_S,
  DEATH_DISTANCE,
  DEATH_ORBIT,
  DEATH_PITCH,
  DEATH_RISE_S,
  LOOK_AHEAD,
  MAX_DT,
  OVERVIEW_BACK,
  OVERVIEW_HEIGHT,
  PULL_MIN_BOOM,
  PULL_RECOVER,
  SHOULDER_BLEND_S,
  TOP_HEIGHT,
  TOP_NUDGE,
} from './constants';

export { rayWorldPoint } from './collide';

/** Move `v` toward `goal` by at most `step`. */
/** Move v toward goal by at most |step|; never away from it (a negative step once widened the FOV, D-RENDER-018). */
function approach(v: number, goal: number, step: number): number {
  const s = Math.abs(step);
  return v < goal ? Math.min(goal, v + s) : Math.max(goal, v - s);
}

/** `mapOf` is injectable so tests can use a fixture map; the app uses the real one. */
export function createCamera(settings: Settings, mapOf: (id: MapId) => MapData = loadMap): CameraRig {
  let fovDeg = settings.fovDeg;
  // Eased state, all visual: shoulder side (-1..1, linear; eased on output), crouch (0..1), dash kick (degrees),
  // how far the camera is pulled in along the boom, the death-camera clock, and the last pose and cut blend.
  let side = 0;
  let sideInit = false;
  let crouch = 0;
  let kick = 0;
  let zoom = 1;
  let pull = 0;
  let deadFor = 0;
  let wasDead = false;
  let lastPos: Vec3 | null = null;
  let lastPose: CameraPose | null = null;
  let blend = CUT_BLEND_S;

  /** Cross-fades from the previous pose for CUT_BLEND_S after a cut (alive <-> dead). */
  function finish(pose: CameraPose, cut: boolean, dt: number): CameraPose {
    if (cut && lastPose) blend = 0;
    blend += dt;
    const out =
      lastPose && blend < CUT_BLEND_S
        ? {
            position: lerpVec(lastPose.position, pose.position, blend / CUT_BLEND_S),
            target: lerpVec(lastPose.target, pose.target, blend / CUT_BLEND_S),
            fovDeg: pose.fovDeg,
          }
        : pose;
    lastPose = out;
    return out;
  }

  return {
    update(frame, heroId, look, preset): CameraPose {
      const view = frame.curr;
      const dt = Math.min(Math.max(0, frame.dt), MAX_DT);
      const heroView = view.heroes.find((h) => h.id === view.localHero);
      const me = view.localHero === null ? undefined : entityById(view, view.localHero);
      const map = mapOf(view.map);
      if (preset === 'player' && heroId && heroView && (me || lastPos)) {
        const body = HEROES[heroId].def.body;
        const flags = me?.flags ?? 0;
        const dead = (flags & ViewFlag.Dead) !== 0;
        const pos = me ? interpolate(frame, me).pos : (lastPos as Vec3);
        lastPos = pos;
        const cut = dead !== wasDead;
        wasDead = dead;

        if (dead) {
          // Death camera: orbit the body and rise to an overhead view.
          deadFor += dt;
          const k = Math.min(1, deadFor / DEATH_RISE_S);
          const dir = lookDir(look.yaw + DEATH_ORBIT * deadFor, look.pitch + (DEATH_PITCH - look.pitch) * k);
          const pivot = { x: pos.x, y: pos.y + pivotHeight(body, false), z: pos.z };
          const want = CAMERA.boom + (DEATH_DISTANCE - CAMERA.boom) * k;
          const free = freeDistance(map, pivot, {
            x: pivot.x - dir.x * want,
            y: pivot.y - dir.y * want,
            z: pivot.z - dir.z * want,
          });
          const d = Math.max(free, PULL_MIN_BOOM);
          const position = { x: pivot.x - dir.x * d, y: pivot.y - dir.y * d, z: pivot.z - dir.z * d };
          return finish({ position, target: pivot, fovDeg }, cut, dt);
        }
        deadFor = 0;

        // Shoulder: blend toward the sim's side over SHOULDER_BLEND_S, eased in-out on output.
        if (!sideInit) {
          side = heroView.shoulder;
          sideInit = true;
        }
        side = approach(side, heroView.shoulder, (2 * dt) / SHOULDER_BLEND_S);
        const crouching = (flags & (ViewFlag.Crouching | ViewFlag.Sliding)) !== 0;
        crouch = approach(crouch, crouching ? 1 : 0, dt / CROUCH_EASE_S);
        const dashing = (flags & ViewFlag.Dashing) !== 0;
        kick = approach(kick, dashing ? DASH_KICK_DEG : 0, (DASH_KICK_DEG * dt) / (dashing ? DASH_KICK_UP_S : DASH_KICK_DOWN_S));

        // The sim's own ray for the standing pose, then shift the eased parts: shoulder side along the right
        // vector, crouch height. At rest (side = ±1, crouch 0 or 1) the result is exactly aimRay's origin.
        const ray = aimRay(pos, look.yaw, look.pitch, heroView.shoulder, body, false);
        const right = rightDir(look.yaw);
        const shift = CAMERA.shoulderRight * (Math.sin((side * Math.PI) / 2) - heroView.shoulder);
        const drop = (pivotHeight(body, false) - pivotHeight(body, true)) * crouch;
        const origin = { x: ray.origin.x + right.x * shift, y: ray.origin.y - drop, z: ray.origin.z + right.z * shift };

        // Pull-in (GDD §4.4): snap in at once, ease back out. Moving along the ray's own direction keeps the
        // crosshair on the sim's aim ray.
        const pivot = { x: pos.x, y: pos.y + pivotHeight(body, false) - drop, z: pos.z };
        const boom = Math.hypot(origin.x - pivot.x, origin.y - pivot.y, origin.z - pivot.z);
        const free = Math.max(freeDistance(map, pivot, origin), PULL_MIN_BOOM);
        pull = Math.max(boom - free, approach(pull, 0, PULL_RECOVER * dt));
        const position = { x: origin.x + ray.dir.x * pull, y: origin.y + ray.dir.y * pull, z: origin.z + ray.dir.z * pull };
        const target = {
          x: position.x + ray.dir.x * LOOK_AHEAD,
          y: position.y + ray.dir.y * LOOK_AHEAD,
          z: position.z + ray.dir.z * LOOK_AHEAD,
        };
        const aimZoom = heroView.aimZoom ?? DEFAULT_AIM_ZOOM;
        const aiming = (flags & ViewFlag.Aiming) !== 0;
        zoom = approach(zoom, aiming ? aimZoom : 1, (1 - aimZoom) * dt / CROUCH_EASE_S);
        return finish({ position, target, fovDeg: (fovDeg + kick) * zoom }, cut, dt);
      }

      const { min, max } = map.bounds;
      const depth = max.z - min.z;
      const centre = { x: (min.x + max.x) / 2, y: 0, z: (min.z + max.z) / 2 };
      if (preset === 'top') {
        return { position: { ...centre, y: depth * TOP_HEIGHT, z: centre.z - depth * TOP_NUDGE }, target: centre, fovDeg };
      }
      return {
        position: { x: centre.x, y: depth * OVERVIEW_HEIGHT, z: centre.z - depth * OVERVIEW_BACK },
        target: centre,
        fovDeg,
      };
    },
    setSettings(s) {
      fovDeg = s.fovDeg;
    },
  };
}
