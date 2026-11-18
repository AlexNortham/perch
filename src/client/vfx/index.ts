// TODO(Rendering & VFX): tracers, impacts, beak-shot flash, hit flashes, ability VFX, pod "secured" pop, post-fx and
// juice (hitstop, shake), driven by the drained sim events.
import type { Renderer, Vfx } from '../app/contracts';

export const createVfx: (renderer: Renderer) => Vfx = () => ({
  onEvents: () => undefined,
  update: () => undefined,
  dispose: () => undefined,
});
