// TODO(Camera & Input): smoothing, collision pull-in against the map (visual only: the sim aims from the unclipped
// pose), shoulder-swap blend, FOV kick on dash, and more screenshot presets.
import { aimRay } from '../../sim/core/aim';
import { addScaled } from '../../sim/core/math';
import { ViewFlag } from '../../sim/core/contracts';
import { HEROES } from '../../sim/heroes/registry';
import { loadMap } from '../../sim/world/map';
import type { CameraPose, CameraRig, Settings } from '../app/contracts';
import { entityById, interpolate } from '../app/loop';

/** How far past the pivot the camera's look target sits (only the direction matters). */
const LOOK_AHEAD = 10;
/** Overview: height and pull-back as fractions of the map's depth. */
const OVERVIEW_HEIGHT = 0.45;
const OVERVIEW_BACK = 0.75;
/** Top-down: height as a fraction of the map's depth; tiny z offset keeps lookAt's up vector valid. */
const TOP_HEIGHT = 1.1;
const TOP_NUDGE = 0.01;

export function createCamera(settings: Settings): CameraRig {
  let fovDeg = settings.fovDeg;
  return {
    update(frame, heroId, look, preset): CameraPose {
      const view = frame.curr;
      const heroView = view.heroes.find((h) => h.id === view.localHero);
      const me = view.localHero === null ? undefined : entityById(view, view.localHero);
      if (preset === 'player' && me && heroId && heroView) {
        const p = interpolate(frame, me);
        const crouching = (me.flags & (ViewFlag.Crouching | ViewFlag.Sliding)) !== 0;
        const ray = aimRay(p.pos, look.yaw, look.pitch, heroView.shoulder, HEROES[heroId].def.body, crouching);
        return { position: ray.origin, target: addScaled(ray.origin, ray.dir, ray.start + LOOK_AHEAD), fovDeg };
      }
      const { min, max } = loadMap(view.map).bounds;
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
