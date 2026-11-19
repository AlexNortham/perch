// sim/world (Objectives). W3: fledgling waves, marching and fighting (fledglings.ts) and the shared visibility
// service (vision.ts). TODO(Objectives, W4–W5): Hawk, Heron, Wardens, Shrines, 2-phase Patron, Brood Ward,
// Thickets, Nests, runes, Egg, Roc and Ember; structure targeting.
import type { SystemFactory } from '../core/contracts';
import { createFledglings } from './fledglings';
import { createVision } from './vision';

export const createWorldSystem: SystemFactory = (ctx) => {
  const vision = createVision(ctx);
  const fledglings = createFledglings(ctx);
  return {
    name: 'world',
    phases: {
      movement: fledglings.steer,
      world: () => {
        vision.update();
        fledglings.update();
      },
    },
    hash: fledglings.hash,
  };
};
