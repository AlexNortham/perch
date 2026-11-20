import { BoxGeometry, BufferGeometry, Float32BufferAttribute, Matrix4, MeshLambertMaterial, MeshStandardMaterial, PlaneGeometry } from 'three';
import { describe, expect, it } from 'vitest';
import { renderLayer } from './generate';
import { bakeAO, generatePixels, getMaterialLibrary, layerOf, MATERIAL_IDS, paint, RECIPES } from './index';

const SIZE = 32;
const RGBA = 4;
/** HSV value of the mean albedo of a layer. */
const meanValue = (albedo: Uint8Array): number => {
  let sum = 0;
  for (let p = 0; p < albedo.length; p += RGBA) sum += Math.max(albedo[p] ?? 0, albedo[p + 1] ?? 0, albedo[p + 2] ?? 0);
  return sum / (albedo.length / RGBA) / 255;
};

describe('material library', () => {
  it('generates every layer deterministically', () => {
    for (const id of ['brick', 'leafCard', 'roofSlate'] as const) {
      const a = renderLayer(RECIPES[id], SIZE, 5, true);
      const b = renderLayer(RECIPES[id], SIZE, 5, true);
      expect(Buffer.from(a.albedo).equals(Buffer.from(b.albedo)), id).toBe(true);
      expect(Buffer.from(a.orm).equals(Buffer.from(b.orm)), id).toBe(true);
    }
  });

  it('keeps large-surface albedo under the §7.6 value limits and cards partly transparent', () => {
    const px = generatePixels(SIZE, SIZE, false);
    const per = SIZE * SIZE * RGBA;
    const layer = (id: (typeof MATERIAL_IDS)[number]): Uint8Array => px.albedo.subarray(per * layerOf(id), per * (layerOf(id) + 1));
    for (const id of ['brick', 'ashlar', 'granite', 'flagstone', 'cobble', 'plaster', 'timber', 'roofClay', 'roofSlate', 'roofShingle', 'grass', 'earth'] as const) {
      expect(meanValue(layer(id)), id).toBeLessThanOrEqual(0.65);
    }
    for (const id of ['flagstone', 'cobble', 'earth'] as const) expect(meanValue(layer(id)), `${id} as a lane floor`).toBeGreaterThanOrEqual(0.25);
    for (const id of ['leafCard', 'pineCard', 'featherCard'] as const) {
      const l = layer(id);
      let clear = 0;
      for (let p = 3; p < l.length; p += RGBA) if ((l[p] ?? 0) < 128) clear++;
      expect(clear / (l.length / RGBA), id).toBeGreaterThan(0.1);
      expect(clear / (l.length / RGBA), id).toBeLessThan(0.95);
    }
  });

  it('tiles: the first and last columns of a tiled layer meet without a seam', () => {
    const l = renderLayer(RECIPES.plaster, 64, 3, false);
    let diff = 0;
    for (let j = 0; j < 64; j++) diff += Math.abs((l.albedo[(j * 64) * RGBA] ?? 0) - (l.albedo[(j * 64 + 63) * RGBA] ?? 0));
    expect(diff / 64).toBeLessThan(12);
  });

  it('paints uv in tiles, the layer and colours; floors and walls get level courses', () => {
    const wall = paint(new PlaneGeometry(4, 2).applyMatrix4(new Matrix4().makeTranslation(0, 1, 0)), 'brick');
    expect(wall.index).toBeNull();
    expect(wall.getAttribute('matLayer').getX(0)).toBe(layerOf('brick'));
    const uv = wall.getAttribute('uv');
    const pos = wall.getAttribute('position');
    // v follows height: one tile per 2.07 m.
    for (let i = 0; i < pos.count; i++) expect(uv.getY(i)).toBeCloseTo(pos.getY(i) / RECIPES.brick.tile[1]);
    expect(wall.getAttribute('color').getX(0)).toBe(1);
    const tinted = paint(new BoxGeometry(1, 1, 1), 'plaster', { tint: 0x808080, seed: 4 });
    expect(tinted.getAttribute('color').getY(0)).toBeLessThan(0.3);
  });

  it('bakes darker AO into a concave corner than onto an open face', () => {
    // A floor with a wall standing on it: floor vertices at the wall's foot darken, far ones stay light.
    const floor = new PlaneGeometry(6, 6, 12, 12).rotateX(-Math.PI / 2);
    const wall = new BoxGeometry(6, 3, 0.4).translate(0, 1.5, 0);
    const g = paint(floor, 'flagstone');
    bakeAO(g, { occluders: [wall] });
    const pos = g.getAttribute('position');
    const col = g.getAttribute('color');
    let near = 1;
    let far = 0;
    for (let i = 0; i < pos.count; i++) {
      const d = Math.abs(pos.getZ(i));
      if (d > 0.3 && d < 0.7) near = Math.min(near, col.getX(i));
      if (d > 2.5) far = Math.max(far, col.getX(i));
    }
    expect(near).toBeLessThan(0.85);
    expect(far).toBeGreaterThan(0.95);
  });

  it('builds the tiers as §11.6 asks: Lambert at Low, PBR at Medium, normals at High', () => {
    const low = getMaterialLibrary('low');
    expect(low.opaque).toBeInstanceOf(MeshLambertMaterial);
    expect(low.cutout.alphaTest).toBe(0.5);
    const medium = getMaterialLibrary('medium');
    expect(medium.opaque).toBeInstanceOf(MeshStandardMaterial);
    expect(medium.opaque.defines?.['MAT_ORM']).toBe('');
    expect(medium.opaque.defines?.['MAT_NORMAL']).toBeUndefined();
    // §11.5: Low ≤ 32 MB and Medium ≤ 80 MB of GPU texture memory in total; the library takes well under that.
    expect(low.textureBytes).toBeLessThan(8 * 1024 * 1024);
    expect(medium.textureBytes).toBeLessThan(24 * 1024 * 1024);
    low.dispose();
    medium.dispose();
  }, 30_000);

  it('keeps a geometry with no colour attribute white before painting multiplies in', () => {
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3));
    paint(g, 'timber', { uv: 'cylinder' });
    expect(Array.from(g.getAttribute('color').array).every((c) => c === 1)).toBe(true);
  });
});
