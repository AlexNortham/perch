/**
 * The sculpted birds (style guide §8, D-ART-004) as model-kit builds: each is built at every level of detail from its
 * BodyPlan and flock colours.
 */
import type { BodyPlan } from '../../../sim/core/contracts/heroes';
import type { TeamColours } from '../palette';
import type { BirdBuild } from './bird';
import { A3_BUILDS } from './birds-a3';
import { B2_BUILDS } from './birds-b2';
import { B3_BUILDS } from './birds-b3';
import { C_BUILDS } from './birds-c';
import { sculptedBuild } from './sculpted';
import type { SculptedBird } from './sculpted';

const BIRDS: Readonly<Record<string, SculptedBird>> = {
  ...A3_BUILDS,
  ...B2_BUILDS,
  ...C_BUILDS,
  ...B3_BUILDS,
};

export const SCULPTED_BUILDS: Readonly<Record<string, (plan: BodyPlan, team: TeamColours) => BirdBuild>> = Object.fromEntries(
  Object.entries(BIRDS).map(([id, bird]) => [id, (plan: BodyPlan, team: TeamColours) => sculptedBuild(plan, team, bird)]),
);
