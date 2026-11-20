import type { Hasher, SimContext, SystemFactory } from '../core/contracts';
import { createEgg } from './egg';
import { createFledglings } from './fledglings';
import { createHides } from './hides';
import { createKeepsakes } from './keepsakes';
import { createGranary, createNests } from './nests';
import { createPickups } from './pickups';
import { createRoc } from './roc';
import { createRunes } from './runes';
import { createStructures } from './structures';
import { createThickets } from './thickets';
import { createVision } from './vision';

/** The Stage 4 neutral objectives (GDD §§7.8–7.15), on with `options.neutrals`. */
function createNeutrals(ctx: SimContext) {
  const keepsakes = createKeepsakes(ctx);
  const granary = createGranary(ctx);
  const thickets = createThickets(ctx, granary);
  const parts = [thickets, createNests(ctx, keepsakes, granary), createPickups(ctx, keepsakes), createRunes(ctx),
    createEgg(ctx, keepsakes), createRoc(ctx, keepsakes)];
  return {
    steer: thickets.steer,
    update() {
      for (const p of parts) p.update();
    },
    hash(h: Hasher) {
      keepsakes.hash(h);
      granary.hash(h);
      for (const p of parts) p.hash(h);
    },
  };
}

export const createWorldSystem: SystemFactory = (ctx) => {
  const hides = createHides(ctx);
  const vision = createVision(ctx, hides);
  const fledglings = createFledglings(ctx);
  const structures = ctx.config.options.structures ? createStructures(ctx, fledglings.hurtAt) : null;
  const neutrals = ctx.config.options.neutrals ? createNeutrals(ctx) : null;
  return {
    name: 'world',
    phases: {
      movement: () => {
        fledglings.steer();
        neutrals?.steer();
      },
      world: () => {
        hides.update();
        vision.update();
        fledglings.update();
        structures?.update();
        neutrals?.update();
      },
    },
    hash(h) {
      fledglings.hash(h);
      structures?.hash(h);
      hides.hash(h);
      neutrals?.hash(h);
    },
  };
};
