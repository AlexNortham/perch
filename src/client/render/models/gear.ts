/* eslint-disable @typescript-eslint/no-magic-numbers -- authored gear and gun parts: the numbers are the shapes */
/**
 * Gear and gun parts for sculpted birds (style guide §8.4, §8.5): straps that follow the body with stitched edges,
 * buckles, pouches with flaps and studs, scarves; and the gun kit in bird-world materials (carved wood, brass, horn,
 * bone, glass beads): lathed barrels and bells, bands, beads, rounded blocks and extruded carved profiles.
 */
import { BoxGeometry, ExtrudeGeometry, Shape, SphereGeometry, TorusGeometry } from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { add, GLOSSY, mul, norm } from './anatomy';
import { TILE } from './feathers';
import type { Detail } from './sculpted';
import { frameAt, mix, shade } from './sculpt';
import type { Finish, Morphs, Ring, Sculpt, Surface, SurfacePoint, V3 } from './sculpt';

export const LEATHER: Finish = { tile: TILE.leather, size: 0.12, gloss: 0.15 };
export const WOOD: Finish = { tile: TILE.wood, size: 0.22, gloss: 0.3 };
export const BRASS: Finish = { gloss: 0.9 };
export const WEAVE: Finish = { tile: TILE.weave, size: 0.06 };

/** Common gear colours (bird-world materials). */
export const GEAR = {
  leather: 0x6b4428,
  leatherDark: 0x3f2818,
  stitch: 0xd9c49a,
  brass: 0xc9973f,
  brassDark: 0x8a6424,
  iron: 0x3a3836,
  bone: 0xe6dcc4,
  horn: 0x4a3626,
  wood: 0x7a5236,
  woodDark: 0x4e3424,
  woodRed: 0x8a4b32,
  glass: 0x2e3a46,
  rope: 0xc9ae7c,
} as const;

const sp3 = (p: SurfacePoint): V3 => [p.p.x, p.p.y, p.p.z];
const n3 = (p: SurfacePoint): V3 => [p.n.x, p.n.y, p.n.z];

export interface StrapStyle {
  readonly width: number;
  readonly thick: number;
  readonly hex: number;
  /** Lifted off the surface (m), stitch colour and the finish. */
  readonly off?: number;
  readonly stitch?: number;
  readonly finish?: Finish;
  readonly morph?: Morphs;
}

/** A strap over a surface from (t, a) to (t, a), flat side on the surface, with light stitched edges. */
export function strap(k: Sculpt, surf: Surface, from: readonly [number, number], to: readonly [number, number], s: StrapStyle, d: Detail): void {
  strapAlong(k, surf, (u) => [from[0] + (to[0] - from[0]) * u, from[1] + (to[1] - from[1]) * u], s, d, d.n(14, 3));
}

/**
 * A sash worn diagonally all the way round a loft (over one shoulder, across the back and round under the other
 * arm): t swings by `tilt` about `t0` as it goes round, highest at angle `a0`. Reads from the front and from behind.
 */
export function sash(k: Sculpt, surf: Surface, t0: number, tilt: number, a0: number, s: StrapStyle, d: Detail): void {
  strapAlong(k, surf, (u) => [t0 + tilt * Math.cos(u * Math.PI * 2), a0 + u * Math.PI * 2], s, d, d.n(26, 6));
}

function strapAlong(k: Sculpt, surf: Surface, path: (u: number) => readonly [number, number], s: StrapStyle, d: Detail, n: number): void {
  const rings: Ring[] = [];
  for (let i = 0; i <= n; i++) {
    const [t, a] = path(i / n);
    const p = surf.at(t, a, (s.off ?? 0.006) + s.thick / 2);
    rings.push({ c: sp3(p), w: s.width / 2, up: s.thick / 2, n: n3(p) });
  }
  const stitch = s.stitch ?? GEAR.stitch;
  k.loft(rings, {
    seg: d.level === 0 ? 6 : d.level === 1 ? 4 : 3,
    sq: 6,
    paint: (_t, a) => {
      const c = Math.cos(a);
      return Math.sin(a) > 0.3 && Math.abs(Math.abs(c) - 0.72) < 0.2 && d.level === 0 ? stitch : Math.sin(a) > 0 ? s.hex : shade(s.hex, 0.7);
    },
    finish: s.finish ?? LEATHER,
    ...(s.morph && { morph: s.morph }),
  });
}

/** A strap loop all the way round a loft at t (a collar, a belt). */
export function band(k: Sculpt, surf: Surface, t: number, s: StrapStyle, d: Detail): void {
  if (d.level >= 3) return;
  strap(k, surf, [t, 0], [t, Math.PI * 2], s, d);
}

/** A square buckle with a prong, lying on the surface point. */
export function buckle(k: Sculpt, p: SurfacePoint, size: number, d: Detail, hex: number = GEAR.brass): void {
  if (d.level > 1) return;
  const F = frameAt(add(sp3(p), mul(n3(p), size * 0.15)), n3(p), [p.t.x, p.t.y, p.t.z]);
  k.mesh(new TorusGeometry(size * 0.5, size * 0.11, 4, 4), { frame: F, rot: [0, 0, Math.PI / 4], scale: [1, 1.25, 1], paint: hex, finish: BRASS });
  k.mesh(new RoundedBoxGeometry(size * 0.08, size * 0.95, size * 0.08, 1, size * 0.03), { frame: F, at: [0, 0, size * 0.05], paint: shade(hex, 0.8), finish: BRASS });
}

/** A rounded pouch with a flap and a stud, on a surface point; `size` is width, height, depth. */
export function pouch(k: Sculpt, p: SurfacePoint, size: V3, hex: number, d: Detail, flap: number = shade(hex, 0.8), morph?: Morphs): void {
  const F = frameAt(add(sp3(p), mul(n3(p), size[2] / 2)), n3(p), [0, 1, 0]);
  const [w, h, dd] = size;
  const rad = Math.min(w, h, dd) * 0.3;
  if (d.level >= 3) return;
  const seg = 1;
  k.mesh(new RoundedBoxGeometry(w, h, dd, seg, rad), { frame: F, paint: hex, finish: LEATHER, ...(morph && { morph }) });
  if (d.level < 1) {
    k.mesh(new RoundedBoxGeometry(w * 1.04, h * 0.45, dd * 0.25, seg, rad * 0.5), { frame: F, at: [0, h * 0.3, dd * 0.42], rot: [-0.12, 0, 0], paint: flap, finish: LEATHER, ...(morph && { morph }) });
    k.mesh(new SphereGeometry(Math.min(w, h) * 0.07, 6, 4), { frame: F, at: [0, h * 0.12, dd * 0.58], paint: GEAR.brass, finish: BRASS, ...(morph && { morph }) });
  }
}

/** A stud or rivet. */
export function stud(k: Sculpt, at: V3, r: number, hex: number = GEAR.brass, morph?: Morphs): void {
  k.mesh(new SphereGeometry(r, 6, 4), { at, paint: hex, finish: BRASS, ...(morph && { morph }) });
}

// ---------------------------------------------------------------------------------------------------------------
// Gun kit. Gun frame: muzzle tip at the origin, barrel back along -z, +y up.

/** A lathed solid along z: profile of [radius, z] from front to back, with a finish and paint along it. */
export function lathe(k: Sculpt, profile: readonly (readonly [number, number])[], o: { at?: V3; rot?: V3; seg?: number; paint?: number | ((t: number, a: number) => number); finish?: Finish; caps?: boolean; morph?: Morphs; sq?: number; flat?: number } = {}): Surface {
  const rings: Ring[] = profile.map(([r, z]) => ({ c: [0, 0, z], w: r, up: r * (o.flat ?? 1) }));
  // Lofts run start → end; a profile listed front (high z) to back would face its normals inward.
  const forward = (profile[profile.length - 1]?.[1] ?? 0) >= (profile[0]?.[1] ?? 0);
  return k.loft(forward ? rings : [...rings].reverse(), {
    seg: o.seg ?? 16,
    ...(o.at && { at: o.at }),
    ...(o.rot && { rot: o.rot }),
    ...(o.paint !== undefined && { paint: forward || typeof o.paint === 'number' ? o.paint : (t: number, a: number) => (o.paint as (t: number, a: number) => number)(1 - t, a) }),
    ...(o.finish && { finish: o.finish }),
    ...(o.caps !== undefined && { caps: o.caps }),
    ...(o.morph && { morph: o.morph }),
    ...(o.sq !== undefined && { sq: o.sq }),
  });
}

/** A ring band round the barrel axis at z. */
export function ring(k: Sculpt, at: V3, r: number, tube: number, d: Detail, hex: number = GEAR.brass, morph?: Morphs, rot?: V3): void {
  if (d.level >= 1) return;
  k.mesh(new TorusGeometry(r, tube, 4, d.n(14, 8)), { at, paint: hex, finish: BRASS, ...(morph && { morph }), ...(rot && { rot }) });
}

/** A glowing glass bead (muzzle light, chamber). */
export function bead(k: Sculpt, at: V3, r: number, hex: number, glow: number, d: Detail, scale: V3 = [1, 1, 1]): void {
  if (d.level >= 3) return;
  k.mesh(new SphereGeometry(r, d.n(10, 4), d.n(7, 3)), { at, scale, paint: hex, finish: { glow, gloss: 1 } });
}

/** A rounded block. */
export function block(k: Sculpt, size: V3, at: V3, hex: number, finish: Finish, d: Detail, rot: V3 = [0, 0, 0], radius = 0.25): void {
  const r = Math.min(size[0], size[1], size[2]) * radius;
  k.mesh(d.level < 1 ? new RoundedBoxGeometry(size[0], size[1], size[2], 1, r) : new BoxGeometry(size[0], size[1], size[2]), { at, rot, paint: hex, finish, uv: [size[2] / 0.25, size[1] / 0.25] });
}

/**
 * A carved profile in the gun's side plane: points are [z, y] (forward, up), extruded `thick` across x with a
 * rounded bevel, centred on x = 0 (stocks, grips, guards, blades).
 */
export function carve(k: Sculpt, pts: readonly (readonly [number, number])[], thick: number, hex: number, finish: Finish, d: Detail, at: V3 = [0, 0, 0], paint?: (z: number, y: number) => number): void {
  const shape = new Shape();
  pts.forEach(([z, y], i) => (i === 0 ? shape.moveTo(z, y) : shape.lineTo(z, y)));
  shape.closePath();
  const bevel = Math.min(thick * 0.35, 0.012);
  const g = new ExtrudeGeometry(shape, { depth: Math.max(0.001, thick - 2 * bevel), bevelThickness: bevel, bevelSize: bevel * 0.8, bevelSegments: d.level === 0 ? 2 : 1, curveSegments: 4, bevelEnabled: d.level < 2 });
  g.translate(0, 0, -(thick - 2 * bevel) / 2);
  g.rotateY(-Math.PI / 2);
  g.computeVertexNormals();
  k.mesh(g, { at, paint: paint ? (p) => paint(p.z, p.y) : hex, finish, uv: [1 / 0.22, 1 / 0.22] });
}

/** A scope or sight tube with brass rings and a glass lens front and back. */
export function scope(k: Sculpt, at: V3, len: number, r: number, d: Detail, body: number = GEAR.brassDark): void {
  lathe(k, [[r * 0.7, len / 2 + r * 0.2], [r * 1.25, len / 2], [r * 1.2, len * 0.32], [r, len * 0.2], [r, -len * 0.25], [r * 1.15, -len * 0.38], [r * 1.1, -len / 2], [r * 0.6, -len / 2 - r * 0.2]], { at, seg: d.n(12, 5), paint: body, finish: BRASS });
  bead(k, add(at, [0, 0, len / 2 + r * 0.05]), r * 0.85, 0x6fa8c8, 0.35, d, [1, 1, 0.3]);
  ring(k, add(at, [0, 0, len * 0.2]), r * 1.05, r * 0.18, d);
  ring(k, add(at, [0, 0, -len * 0.25]), r * 1.05, r * 0.18, d);
}

/** Cards rarely belong on guns; a fletched dart or plume is the exception. */
export function plume(k: Sculpt, at: V3, dir: V3, len: number, wid: number, hex: number, cell: number, face: V3 = [1, 0, 0], tip?: number): void {
  k.card({ at, dir: norm(dir), face, len, wid, cell, root: shade(hex, 0.8), tip: tip ?? hex, segs: 1 });
}

export { GLOSSY, mix };
