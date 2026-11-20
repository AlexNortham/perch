/**
 * Combat feedback (client contract `Vfx`): tracers, impacts, beak-shot flashes, hit flashes, pods, areas, summon
 * placeholders, status markers, tethers and movement effects, driven by the drained events and the view. Everything
 * is drawn with five instanced meshes (fx.ts) added to the renderer's scene; mapping.ts decides what an event
 * means, bound.ts redraws what follows entities. Owner: Rendering & VFX.
 */
import { Group } from 'three';
import type { EntityId, EntityView, PlayerTeam, SimView } from '../../sim/core/contracts';
import { HEROES } from '../../sim/heroes/registry';
import type { Renderer, Vfx } from '../app/contracts';
import { entityById } from '../app/loop';
import { hostOf } from '../app/render-host';
import { Bound } from './bound';
import type { Source } from './bound';
import { MARKER_BITS, STATUS_MARKERS, TRACER } from './constants';
import { createDraw, Transients } from './fx';
import { mapEvents } from './mapping';
import type { FxSink, Lookup } from './mapping';
import { createSelfTest } from './selftest';
import type { SelfFrame } from './selftest';

const NO_ENTITIES: readonly EntityView[] = [];

/** What the effects read: the current view plus, in the self-test, its synthetic entities. */
class World implements Lookup, Source {
  view: SimView | null = null;
  entities: readonly EntityView[] = NO_ENTITIES;
  readonly statusBits = new Map<EntityId, number>();
  localTeam: PlayerTeam = 'dawn';
  get localHero(): EntityId | null {
    return this.view?.localHero ?? null;
  }
  now: number | null = null;
  podBorn: ReadonlyMap<EntityId, number> | null = null;
  timeScale = 1;
  private self: SelfFrame | null = null;
  private readonly merged: EntityView[] = [];
  private readonly byId = new Map<EntityId, EntityView>();

  entity(id: EntityId): EntityView | undefined {
    return this.byId.get(id) ?? (this.view ? entityById(this.view, id) : undefined);
  }

  hitscan(shooter: EntityId): boolean {
    if (this.self?.hitscan.has(shooter)) return true;
    const hero = this.view?.heroes.find((h) => h.id === shooter);
    return hero ? HEROES[hero.heroId].def.weapon.hitscan : false;
  }

  /** Take this frame's view (and the self-test's extras) and refresh the derived tables. */
  sync(view: SimView, self: SelfFrame | null): void {
    this.view = view;
    this.self = self;
    this.byId.clear();
    this.statusBits.clear();
    const me = view.heroes.find((h) => h.id === view.localHero);
    this.localTeam = me?.team ?? 'dawn';
    for (const h of view.heroes) {
      let bits = 0;
      for (const s of h.statuses) {
        const m = STATUS_MARKERS[s.id];
        if (m) bits |= MARKER_BITS[m];
      }
      if (bits !== 0) this.statusBits.set(h.id, bits);
    }
    if (!self) {
      this.entities = view.entities;
      this.now = null;
      this.podBorn = null;
      return;
    }
    this.merged.length = 0;
    for (const e of view.entities) this.merged.push(e);
    for (const e of self.entities) {
      this.merged.push(e);
      this.byId.set(e.id, e);
    }
    for (const [id, bits] of self.statusBits) this.statusBits.set(id, bits);
    this.entities = this.merged;
    this.now = self.now;
    this.podBorn = self.pods;
  }
}

const noop: Vfx = { onEvents: () => undefined, update: () => undefined, dispose: () => undefined };

export const createVfx = (renderer: Renderer): Vfx => {
  const host = hostOf(renderer);
  if (!host) return noop;
  const root = new Group();
  root.name = 'vfx';
  host.scene.add(root);
  const draw = createDraw(root);
  const fx = new Transients();
  const bound = new Bound(draw, fx);
  const world = new World();
  const self = import.meta.env.DEV && new URLSearchParams(location.search).has('vfxdemo') ? createSelfTest() : null;
  const sink: FxSink = {
    burst: (kind, pos, axis, tint) => fx.burst(kind, pos, axis, tint),
    tracer: (from, to, colour, width) => fx.tracer(from, to, colour, width, TRACER.life),
    hitFlash: (id) => bound.hitFlash(id),
    tether: (source, target, on) => bound.tether(source, target, on),
  };
  const layers = Object.values(draw.layers);

  // Runs inside render(), so effects use the frame's own interpolation (update() would be a frame late).
  host.beforeRender = (frame) => {
    const demo = self ? self.frame(frame) : null;
    world.sync(frame.curr, demo);
    world.timeScale = self?.timeScale ?? 1;
    if (demo?.events) mapEvents(demo.events, world, sink);
    for (const l of layers) l.reset();
    bound.frame(frame, world);
    fx.update(frame.dt * world.timeScale, draw);
    for (const l of layers) l.commit();
  };

  return {
    reset() {
      fx.clear();
      bound.reset();
    },
    onEvents(events, view) {
      if (events.length === 0) return;
      world.view = view;
      mapEvents(events, world, sink);
    },
    update: () => undefined,
    dispose() {
      host.beforeRender = null;
      host.scene.remove(root);
      for (const l of layers) {
        l.mesh.geometry.dispose();
        l.mesh.dispose();
      }
      draw.material.dispose();
    },
  };
};
