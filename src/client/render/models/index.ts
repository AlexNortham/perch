// TODO(Technical Artist): procedural low-poly birds (one per hero, matching its BodyPlan), fledglings, structures,
// Patrons and pickups, with code-driven rigs and animation (run, dash, slide, shoot, cast, death) from the flags.
// Until then: a team-coloured box per entity.
import { BoxGeometry, Mesh, MeshLambertMaterial } from 'three';
import type { EntityView } from '../../../sim/core/contracts';
import type { ModelKit } from '../../app/contracts';
import { interpolate } from '../../app/loop';

const TEAM_COLOURS = { dawn: 0xe8a33c, dusk: 0x6d6be0, neutral: 0x9a9a9a } as const;
/** Placeholder box height as a multiple of the entity's radius. */
const HEIGHT_PER_RADIUS = 4;
const MIN_SIZE = 0.2;

export function createModelKit(): ModelKit {
  const geometry = new BoxGeometry(1, 1, 1);
  const materials = {
    dawn: new MeshLambertMaterial({ color: TEAM_COLOURS.dawn }),
    dusk: new MeshLambertMaterial({ color: TEAM_COLOURS.dusk }),
    neutral: new MeshLambertMaterial({ color: TEAM_COLOURS.neutral }),
  };
  return {
    create(entity: EntityView) {
      const mesh = new Mesh(geometry, materials[entity.team]);
      const size = Math.max(MIN_SIZE, entity.radius * 2);
      mesh.scale.set(size, Math.max(MIN_SIZE, entity.radius * HEIGHT_PER_RADIUS), size);
      return mesh;
    },
    pose(model, entity, frame) {
      const p = interpolate(frame, entity);
      model.position.set(p.pos.x, p.pos.y + model.scale.y / 2, p.pos.z);
      model.rotation.y = p.yaw;
    },
  };
}
