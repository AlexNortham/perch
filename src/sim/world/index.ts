import type { SystemFactory } from '../core/contracts';
import { createFledglings } from './fledglings';
import { createStructures } from './structures';
import { createVision } from './vision';

export const createWorldSystem: SystemFactory = (ctx) => {
  const vision = createVision(ctx);
  const fledglings = createFledglings(ctx);
  const structures = ctx.config.options.structures ? createStructures(ctx, fledglings.hurtAt) : null;
  return {
    name: 'world',
    phases: {
      movement: fledglings.steer,
      world: () => {
        vision.update();
        fledglings.update();
        structures?.update();
      },
    },
    hash(h) {
      fledglings.hash(h);
      structures?.hash(h);
    },
  };
};
