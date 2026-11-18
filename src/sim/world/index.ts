// TODO(Objectives): fledgling waves, Hawk, Heron, Wardens, Shrines, 2-phase Patron, Brood Ward, Thickets, Nests, runes, Egg, Roc and Ember; unit and structure targeting (movement and world phases).
import type { SystemFactory } from '../core/contracts';

export const createWorldSystem: SystemFactory = () => ({ name: 'world', phases: {} });
