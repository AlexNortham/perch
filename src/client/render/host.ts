/**
 * How the VFX module reaches the renderer's scene without widening the `Renderer` contract: createRenderer registers
 * a host for the renderer object it returns, and `createVfx(renderer)` looks it up. `beforeRender` runs inside
 * `render()` just before the frame is drawn, so effects are placed with the frame's own interpolation.
 */
import type { Scene } from 'three';
import type { Frame, Renderer } from '../app/contracts';

export interface RenderHost {
  readonly scene: Scene;
  beforeRender: ((frame: Frame) => void) | null;
}

const hosts = new WeakMap<Renderer, RenderHost>();

export function registerHost(renderer: Renderer, host: RenderHost): void {
  hosts.set(renderer, host);
}

export function hostOf(renderer: Renderer): RenderHost | undefined {
  return hosts.get(renderer);
}
