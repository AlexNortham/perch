import { describe, expect, it } from 'vitest';
import { ARENA } from '../../../sim/world/map';
import { generate } from './index';
import { Mesher } from './mesher';
import { layerOf } from '../materials';

describe('environment mesher', () => {
  it('writes the material library contract: tiles uv, matLayer, colour, indexed triangles', () => {
    const g = new Mesher();
    g.paint({ mat: 'brick' }).box(0, 1, 0, 2, 2, 0.5, 0.05);
    const geo = g.build();
    expect(geo).not.toBeNull();
    if (!geo) return;
    // A chamfered box: 6 faces, 12 edge strips and 8 corners.
    expect(g.triangles).toBe(6 * 2 + 12 * 2 + 8);
    expect(geo.getAttribute('matLayer').getX(0)).toBe(layerOf('brick'));
    for (const name of ['position', 'normal', 'uv', 'color']) expect(geo.getAttribute(name)).toBeDefined();
    expect(geo.index?.count).toBe(g.triangles * 3);
  });

  it('drops small chamfers when asked (LOD1 paints the edge, §4.3)', () => {
    const g = new Mesher();
    g.minBevel = 0.025;
    g.paint({ mat: 'timber' }).box(0, 0, 0, 1, 1, 1, 0.015);
    expect(g.triangles).toBe(12);
  });

  it('builds a map without a dressing descriptor', () => {
    const w = generate(ARENA);
    expect(w.buckets.size).toBeGreaterThan(0);
    expect(w.covered.size).toBeGreaterThan(0);
  });
});
