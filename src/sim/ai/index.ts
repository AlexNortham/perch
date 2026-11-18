// TODO(Bot AI): utility-AI bots (GDD §11) that write each bot hero's PlayerCommand in the ai phase, aiming by setting
// look yaw/pitch through the shared aim model, seeing only what their flock sees (EntityBase.seenBy), drawing
// randomness from ctx.rng.stream('ai/' + heroId). Also the bot hero pick rule below.
import { HERO_IDS } from '../core/contracts';
import type { HeroId, Rng, SystemFactory } from '../core/contracts';

export const createAiSystem: SystemFactory = () => ({ name: 'ai', phases: {} });

/**
 * A bot's hero pick (GDD §11.6), used by the roster helpers in src/sim/index.ts. `flock` holds the heroes already on
 * the bot's flock. TODO(Bot AI): pick an archetype the flock lacks (support, tank/initiator, gun carry, area
 * control, then any), then a random free hero of it. W1: any free hero.
 */
export const pickBotHero: (rng: Rng, taken: ReadonlySet<HeroId>, flock: readonly HeroId[]) => HeroId = (rng, taken) =>
  rng.pick(HERO_IDS.filter((id) => !taken.has(id)));
