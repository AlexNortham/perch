/**
 * One model per live entity, from the ModelKit (client/render/models).
 *
 * Lifecycle, which the ModelKit can rely on:
 * - A new entity takes a spare model of the same kind, type and team if there is one, otherwise
 *   `kit.create(entity)`. The model is then added to `parent` (Three fires 'added' on it).
 * - Every frame, before `kit.pose(model, entity, frame)`, the model's position and yaw (rotation.y) are set from
 *   `interpolate(frame, entity)`. Models face +z at yaw 0. pose() animates the parts and may adjust the root.
 * - When the entity despawns the model is removed from `parent` ('removed' fires) and kept as a spare for reuse.
 * An instanced kit (fledglings) can return a bare Object3D proxy from create(), take an instance slot on 'added',
 * write the proxy's transform into it in pose(), and free the slot on 'removed'.
 */
import type { Object3D } from 'three';
import type { EntityId } from '../../sim/core/contracts';
import type { Frame, ModelKit } from '../app/contracts';
import { interpolate } from '../app/loop';
import { drawnByVfx } from '../vfx/drawn';

export interface EntityLayer {
  /** Create, pose and retire models for this frame. Returns whether any structure entity exists. */
  sync(frame: Frame): boolean;
}

export function createEntityLayer(parent: Object3D, kit: ModelKit): EntityLayer {
  const live = new Map<EntityId, { model: Object3D; key: string }>();
  const spare = new Map<string, Object3D[]>();
  const seen = new Set<EntityId>();
  return {
    sync(frame) {
      seen.clear();
      let structures = false;
      for (const e of frame.curr.entities) {
        if (drawnByVfx(e)) continue;
        seen.add(e.id);
        if (e.kind === 'structure') structures = true;
        let slot = live.get(e.id);
        if (!slot) {
          const key = `${e.kind}:${e.type}:${e.team}`;
          slot = { model: spare.get(key)?.pop() ?? kit.create(e), key };
          live.set(e.id, slot);
          parent.add(slot.model);
        }
        const p = interpolate(frame, e);
        slot.model.position.set(p.pos.x, p.pos.y, p.pos.z);
        slot.model.rotation.y = p.yaw;
        kit.pose(slot.model, e, frame);
      }
      for (const [id, slot] of live) {
        if (seen.has(id)) continue;
        parent.remove(slot.model);
        live.delete(id);
        const list = spare.get(slot.key);
        if (list) list.push(slot.model);
        else spare.set(slot.key, [slot.model]);
      }
      return structures;
    },
  };
}
