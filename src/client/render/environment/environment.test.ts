import { BatchedMesh, PerspectiveCamera, Sphere } from 'three';
import type { BufferAttribute } from 'three';
import { describe, expect, it } from 'vitest';
import { ARENA } from '../../../sim/world/map';
import { buildEnvironment, generate } from './index';
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

  it('releases the batch data once uploaded, keeps culling bounds, and rebuilds on a restored context', () => {
    const env = buildEnvironment(ARENA, 'low');
    const batches = (): BatchedMesh[] => env.root.children.filter((o): o is BatchedMesh => o instanceof BatchedMesh);
    const canvas = new EventTarget();
    for (const m of batches()) {
      const g = m.geometry;
      // What WebGL does on upload, and the first frame (which also starts watching the canvas).
      for (const a of [...Object.values(g.attributes), g.index]) (a as BufferAttribute).onUploadCallback();
      m.onBeforeRender({ domElement: canvas } as never, null as never, new PerspectiveCamera(), g, m.material as never, null as never);
      expect(g.getAttribute('position').array.length).toBe(0);
      expect(g.index?.array.BYTES_PER_ELEMENT).toBeGreaterThan(0);
      for (let i = 0; i < m.instanceCount; i++) expect(m.getBoundingSphereAt(i, new Sphere())?.radius).toBeGreaterThan(0);
    }
    canvas.dispatchEvent(new Event('webglcontextrestored'));
    expect(batches().every((m) => m.geometry.getAttribute('position').array.length > 0)).toBe(true);
    env.dispose();
  });
});
