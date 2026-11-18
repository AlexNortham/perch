// TODO(Economy & Items): shop (buy, sell, upgrade), inventory and flex slots, passives, item actives (abilities phase)
// and triggers (item procs and the trigger effect, which this system registers).
import type { SystemFactory } from '../core/contracts';

export const createItemSystem: SystemFactory = () => ({ name: 'items', phases: {} });
