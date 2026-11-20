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
import { Mesh } from 'three';
import type { Material, Object3D } from 'three';
import type { EntityId, EntityView, PlayerTeam, Vec3 } from '../../sim/core/contracts';
import { ViewFlag } from '../../sim/core/contracts';
import { canSee } from '../../sim/core/vision';
import type { Frame, ModelKit } from '../app/contracts';
import { GHOST_OPACITY, LOCAL_FADE_M, LOCAL_HEAD_M } from './constants';
import { interpolate } from '../app/loop';
import { drawnByVfx } from '../app/drawn';
import { attachIdentity, updateIdentity } from './identity';
import type { Identity } from './identity';

export interface EntityLayer {
  /**
   * Create, pose and retire models for this frame. Returns whether any structure entity exists. `eye` (the camera
   * position) drives the local hero's fade when the camera is within LOCAL_FADE_M of it.
   */
  sync(frame: Frame, eye?: Vec3): boolean;
}

const ORIGINAL = 'perchOriginalMaterials';

/** Fade a model by swapping in per-mesh clones of its materials (the kit shares originals), restoring at opacity 1. */
export function setOpacity(model: Object3D, opacity: number): void {
  model.traverse((o) => {
    if (!(o instanceof Mesh) || o.userData['identity']) return;
    const original = o.userData[ORIGINAL] as Material | Material[] | undefined;
    if (opacity >= 1) {
      if (original) {
        o.material = original;
        delete o.userData[ORIGINAL];
      }
      return;
    }
    if (!original) {
      o.userData[ORIGINAL] = o.material;
      o.material = Array.isArray(o.material) ? o.material.map((m: Material) => m.clone()) : o.material.clone();
    }
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      m.transparent = true;
      m.opacity = opacity;
    }
  });
}

/** Enemies render only when the local flock can see them; the local hero's own flock always renders, allied ghosts faded. */
function visible(e: EntityView, local: PlayerTeam): boolean {
  return e.team === local || canSee(local, e);
}

export function createEntityLayer(parent: Object3D, kit: ModelKit): EntityLayer {
  const live = new Map<EntityId, { model: Object3D; key: string }>();
  const spare = new Map<string, Object3D[]>();
  const seen = new Set<EntityId>();
  const identities = new WeakMap<Object3D, Identity | null>();
  return {
    sync(frame, eye) {
      seen.clear();
      const localId = frame.curr.localHero;
      const local = frame.curr.heroes.find((h) => h.id === localId)?.team ?? 'dawn';
      let structures = false;
      for (const e of frame.curr.entities) {
        if (drawnByVfx(e) || !visible(e, local)) continue;
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
        if (e.kind === 'hero') {
          let id = identities.get(slot.model);
          if (id === undefined) {
            id = attachIdentity(slot.model);
            identities.set(slot.model, id);
          }
          if (id) updateIdentity(id, e.id === localId ? 'self' : e.team === local ? 'ally' : 'enemy', (e.flags & ViewFlag.Revealed) !== 0, slot.model.visible);
        }
        let opacity = e.team === local && (e.flags & ViewFlag.Invisible) !== 0 ? GHOST_OPACITY : 1;
        if (eye && e.id === localId) {
          const d = Math.hypot(eye.x - p.pos.x, eye.y - (p.pos.y + LOCAL_HEAD_M), eye.z - p.pos.z);
          opacity = Math.min(opacity, d / LOCAL_FADE_M);
        }
        setOpacity(slot.model, opacity);
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
