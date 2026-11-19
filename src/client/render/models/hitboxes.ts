/** Debug overlay for QA: a hero's head sphere and body capsule (GDD §5.4), drawn through the model. */
import { CapsuleGeometry, Group, Mesh, MeshBasicMaterial, SphereGeometry } from 'three';
import type { BodyPlan } from '../../../sim/core/contracts/heroes';
import { HITBOX_DEBUG } from './constants';

const material = (hex: number): MeshBasicMaterial => new MeshBasicMaterial({ color: hex, wireframe: true, depthTest: false, transparent: true });
const headMaterial = material(HITBOX_DEBUG.head);
const bodyMaterial = material(HITBOX_DEBUG.body);

/** Child of the rig's squash group, so crouching scales it as the sim scales the hitboxes. */
export function hitboxOverlay(plan: BodyPlan): Group {
  const g = new Group();
  g.name = 'hitboxes';
  const seg = HITBOX_DEBUG.segments;
  const c = plan.head.centre;
  const head = new Mesh(new SphereGeometry(plan.head.radius, seg, seg / 2), headMaterial);
  head.position.set(-c.right, c.up, c.forward);
  const top = c.up - plan.head.radius;
  const body = new Mesh(new CapsuleGeometry(plan.radius, Math.max(0, top - 2 * plan.radius), 4, seg), bodyMaterial);
  body.position.y = top / 2;
  for (const m of [head, body]) m.renderOrder = 10;
  g.add(body, head);
  return g;
}
