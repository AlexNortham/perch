/**
 * Dev-only display scenes for screenshots and QA (options in debug.ts): a row of hero models posed by name, and a
 * wave of fledglings, both placed around the human's position. They stand in for sim entities, so they are posed
 * from fake EntityViews through the same rigs the real ones use.
 */
import { Group } from 'three';
import type { Object3D } from 'three';
import { ViewFlag } from '../../../sim/core/contracts';
import type { EntityView, HeroId } from '../../../sim/core/contracts';
import type { BirdRig } from '../rigs/bird-rig';
import type { FledglingProxy } from '../rigs/fledgling-rig';
import type { DebugOptions } from './debug';
import { applyState, STATES } from './debug';
import type { FledglingType } from './fledgling';

const LINEUP_SPACING = 2.4;
const HERO_ID_BASE = 100;
const CHICK_ID_BASE = 200;
const HERO_RADIUS = 0.4;
/** Fledgling wave layout (GDD §7.1): two wide, 1.5 m apart; the two waves face each other this far apart. */
const WAVE = { halfWidth: 0.75, rowGap: 1.5, gap: 3, speed: 5, radius: 0.45, slingerEvery: 4 } as const;

type Mutable<T> = { -readonly [K in keyof T]: T[K] };

export interface DebugScene {
  /** Pose the display models for this frame, creating them on first use. `at` is the human's model. */
  update(parent: Object3D, at: Object3D, frame: { dt: number }, t: number): void;
}

const fake = (id: number, team: 'dawn' | 'dusk', type: string, kind: EntityView['kind'], yaw: number, radius: number): Mutable<EntityView> => ({
  id, kind, team, type, pos: { x: 0, y: 0, z: 0 }, vel: { x: 0, y: 0, z: 0 }, yaw, pitch: 0, radius, hp: 1, maxHp: 1,
  shield: 0, flags: 0, mode: null, seenBy: 3,
});

export function createDebugScene(
  opt: DebugOptions,
  heroRig: (id: HeroId) => BirdRig,
  fledgling: (type: FledglingType, team: 'dawn' | 'dusk') => FledglingProxy,
  syncHitboxes: (rig: BirdRig) => void,
): DebugScene {
  let root: Group | null = null;
  const heroes: { rig: BirdRig; e: Mutable<EntityView> }[] = [];
  const chicks: { proxy: FledglingProxy; e: Mutable<EntityView>; x: number; z: number }[] = [];

  const build = (parent: Object3D): Group => {
    const g = new Group();
    opt.lineup.forEach((id, i) => {
      const rig = heroRig(id);
      rig.position.x = (i - (opt.lineup.length - 1) / 2) * LINEUP_SPACING;
      rig.rotation.y = opt.yaw;
      g.add(rig);
      heroes.push({ rig, e: fake(HERO_ID_BASE + i, opt.team, id, 'hero', opt.yaw, HERO_RADIUS) });
    });
    for (const [side, team] of ([[1, 'dawn'], [-1, 'dusk']] as const)) {
      for (let j = 0; j < opt.wave; j++) {
        const type: FledglingType = j % WAVE.slingerEvery === WAVE.slingerEvery - 1 ? 'slinger' : 'scrapper';
        const proxy = fledgling(type, team);
        const row = Math.floor(j / 2);
        proxy.rotation.y = side > 0 ? Math.PI : 0;
        parent.add(proxy);
        const e = fake(CHICK_ID_BASE + chicks.length, team, type, 'unit', proxy.rotation.y, WAVE.radius);
        e.vel.z = row === 0 ? 0 : -side * WAVE.speed;
        e.flags = row === 0 ? ViewFlag.Attacking : 0;
        chicks.push({ proxy, e, x: ((j % 2) * 2 - 1) * WAVE.halfWidth, z: side * (WAVE.gap / 2 + row * WAVE.rowGap) });
      }
    }
    parent.add(g);
    return g;
  };

  return {
    update(parent, at, frame, t) {
      root ??= build(parent);
      root.position.copy(at.position);
      heroes.forEach(({ rig, e }, i) => {
        const state = STATES[opt.states.length > 0 ? (opt.states[i % opt.states.length] ?? 'idle') : 'idle'];
        if (!state) return;
        const { hit, castSlot } = applyState(e, state, t, frame.dt);
        rig.animate(e, frame.dt, t, hit, castSlot);
        syncHitboxes(rig);
      });
      // Proxies sit in the scene itself and read their world position and yaw, as the entity layer would set them.
      for (const { proxy, e, x, z } of chicks) {
        proxy.position.set(at.position.x + x, at.position.y, at.position.z + z);
        proxy.animate(e, t);
      }
    },
  };
}
