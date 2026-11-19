/** Fledgling geometry (GDD §7.1, §14.6): round chicks, one merged mesh each, at most ~150 triangles. */
import type { BufferGeometry } from 'three';
import type { TeamColours } from '../palette';
import { FLEDGLING } from './constants';
import { Parts } from './parts';

export type FledglingType = 'scrapper' | 'slinger';

const R = FLEDGLING.nominalRadius;
const BODY_SEG = [7, 5] as const;
const HEAD_SEG = [6, 4] as const;
const WING_SEG = [4, 3] as const;

/** Scrapper: 0.9 m chick, team-coloured head down and forward, stubby wings. Slinger: smaller, a team cap and a sling. */
export function fledglingGeometry(type: FledglingType, team: TeamColours): BufferGeometry {
  const p = new Parts();
  p.ell(FLEDGLING.body, [R, R * 0.95, R * 0.95], [0, R, 0], [0, 0, 0], BODY_SEG);
  p.ell(team.primary, [R * 0.58, R * 0.55, R * 0.58], [0, R * (type === 'scrapper' ? 1.05 : 1.35), R * 0.62], [0, 0, 0], HEAD_SEG);
  p.cone(FLEDGLING.bill, R * 0.17, R * 0.45, [0, R * (type === 'scrapper' ? 1.0 : 1.3), R * 1.1], [0, 0, 0], 4);
  for (const s of [1, -1]) {
    p.cone(FLEDGLING.foot, R * 0.2, R * 0.35, [s * R * 0.4, R * 0.1, R * 0.35], [0, 0, 0], 4);
    if (type === 'scrapper') p.ell(FLEDGLING.wing, [R * 0.12, R * 0.4, R * 0.35], [s * R * 0.95, R * 0.95, -R * 0.1], [0.2, 0, s * 0.3], WING_SEG);
  }
  if (type === 'slinger') {
    p.cone(team.dark, R * 0.45, R * 0.5, [0, R * 1.65, R * 0.5], [-Math.PI / 2, 0, 0]);
    p.rod(FLEDGLING.sling, [R * 0.95, R * 0.7, R * 0.2], [R * 1.1, R * 0.2, R * 0.9], R * 0.06);
  }
  const g = p.build();
  if (type === 'slinger') g.scale(FLEDGLING.slingerScale, FLEDGLING.slingerScale, FLEDGLING.slingerScale);
  return g;
}
