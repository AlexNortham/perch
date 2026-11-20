/**
 * The places around objectives and traversal (style guide §1.4, §6.4 the Hollow, brief "objective dressing"):
 * flowering Vines in rope-wrapped frames, Updraft masts with pulleys and pennants, Chimney hearths, Thicket camp dens
 * by family, nest beds under every Nest, rune bridges and rune stones, the Egg perches, the Roc's Hollow (root walls,
 * mossy shelves, old mill timbers, ember scorches, the bridge deck), Bell Feeder seed spills, Lookout masts, Bough
 * Spring rings and the Magpie stalls' hoards. Gameplay bodies and creature models belong to Objectives and the
 * Technical Artist; nothing here is solid. Authored art data.
 */
import { Vector3 } from 'three';
import type { Vec3 } from '../../../../sim/core/contracts';
import { oriented, placed } from '../mesher';
import type { Mesher } from '../mesher';
import { hash2 } from '../world';
import type { Pass, World } from '../world';
import type { Band } from '../constants';
import { barrel, lantern, lanternPost } from './buildings';
import { clump } from './nature';
import { nest } from './nest';
import { crateAt, flockTint, sack } from './props';
import { BARK, BRASS, FADED, IRON, MOSS, ROPE, TWIG } from './styles';

const m = (w: World, band: Band, p: Vec3, pass: Pass = 'opaque'): Mesher => w.m(pass, band, p.x, p.z, p.y);

export function dressObjectives(w: World): void {
  const map = w.map;
  map.climbs.forEach((c, i) => {
    if (c.kind === 'vine') vine(w, c.bottom, c.top, c.out, 3100 + i * 7);
    else if (c.kind === 'chimney') hearth(w, c.bottom, c.top, 3300 + i * 7);
  });
  map.updrafts.forEach((u, i) => u.stations.forEach((s, k) => updraftMast(w, s, 3500 + i * 31 + k)));
  map.thickets.forEach((t, i) => camp(w, t.pos, t.yaw, t.family ?? (t.tier === 1 ? 'beetles' : t.tier === 2 ? 'weasels' : 'badgers'), 3700 + i * 13));
  map.nests.forEach((n, i) => nestBed(w, n.pos, 3900 + i * 7));
  map.runeSpots.forEach((r, i) => runeStone(w, r.pos, r.yaw, 4100 + i));
  map.eggPerches.forEach((e, i) => eggPerch(w, e.pos, 4200 + i * 9));
  if (map.hollow) rocHollow(w, map.hollow.centre, map.hollow.radius, map.hollow.floorY);
  (map.interactables ?? []).forEach((a, i) => {
    if (a.kind === 'feeder') seedSpill(w, a.pos, 4400 + i);
    else if (a.kind === 'lookout') lookout(w, a.pos, a.yaw, 4500 + i);
  });
  (map.springs ?? []).forEach((s, i) => springRing(w, s.pad, s.radius, 4600 + i));
  map.shops.forEach((s, i) => {
    if (s.kind === 'stall') hoard(w, s.pos, s.yaw, 4700 + i * 11);
  });
}

// ── Traversal affordances (§1.4) ─────────────────────────────────────────────────────────────────────────────────

/** A Vine: thick flowering stems (8–12 cm, cream-white blossom) climbing a rope-wrapped frame 1 m wide. */
function vine(w: World, bottom: Vec3, top: Vec3, out: Vec3, seed: number): void {
  const g = m(w, 2, bottom, 'cast');
  const yaw = Math.atan2(out.x, out.z);
  const h = top.y - bottom.y;
  g.within(placed(bottom.x, bottom.y, bottom.z, yaw), () => {
    // Frame: two poles, rungs every 0.8 m, rope wraps every 0.5 m.
    g.paint({ mat: 'timberDark' }, seed);
    for (const s of [-1, 1]) g.span(s * 0.5 - 0.06, s * 0.5 + 0.06, -0.1, h + 0.3, 0.04, 0.16, 0.015);
    for (let y = 0.6; y < h; y += 0.8) g.span(-0.5, 0.5, y - 0.03, y + 0.03, 0.07, 0.13);
    g.paint(ROPE, seed);
    for (let y = 0.3; y < h; y += 1.4) for (const s of [-1, 1]) g.within(placed(s * 0.5, y, 0.1, 0), () => g.lathe([[0.085, -0.05], [0.085, 0.05]], 5));
    // Stems: two twisting tubes, 8–12 cm.
    g.paint({ mat: 'bark', tint: 0x9aa070 }, seed + 1);
    for (let k = 0; k < 2; k++) {
      const pts: Vector3[] = [];
      for (let y = -0.05; y <= h + 0.25; y += 0.6) pts.push(new Vector3(Math.sin(y * 1.3 + k * 3.1) * 0.32, y, 0.22 + Math.cos(y * 1.3 + k * 3.1) * 0.06));
      g.tube(pts, 0.05 + k * 0.01, 5);
    }
  });
  const gc = m(w, 2, bottom, 'cutout');
  gc.within(placed(bottom.x, bottom.y, bottom.z, yaw), () => {
    for (let y = 0.3; y < h + 0.2; y += 0.38) {
      for (const s of [-1, 1]) {
        gc.paint({ mat: 'leafCard', tint: 0x7da068 }, seed + Math.round(y * 9) + s);
        gc.card2(new Vector3(s * 0.35 + (hash2(seed, y) - 0.5) * 0.2, y, 0.3), new Vector3(0.32, 0, 0.05 * s), new Vector3(0, 0.3, 0.08));
      }
    }
  });
  // Cream-white blossom clusters (the unmistakable tell at 40 m).
  const gb = m(w, 2, bottom);
  gb.within(placed(bottom.x, bottom.y, bottom.z, yaw), () => {
    gb.paint({ mat: 'plaster', tint: 0xfff4e0, shade: 1.15 }, seed);
    for (let k = 0; k < Math.round(h * 3); k++) {
      const y = 0.3 + hash2(seed, k) * h;
      const x = (hash2(seed, k + 50) - 0.5) * 1.0;
      const z = 0.36 + hash2(seed, k + 90) * 0.1;
      // A five-petal star facing out, with a pale centre.
      const petals: Vector3[] = [];
      for (let p = 0; p < 10; p++) {
        const a = (p / 10) * Math.PI * 2 + k;
        const r = p % 2 ? 0.05 : 0.13;
        petals.push(new Vector3(x + Math.cos(a) * r, y + Math.sin(a) * r, z));
      }
      gb.poly(petals, new Vector3(0, 0, 1));
    }
  });
}

/** An Updraft station (§1.4): a tall timber mast with a pulley wheel at the cable and a feather pennant. */
function updraftMast(w: World, s: Vec3, seed: number): void {
  const g = m(w, 2, s, 'cast');
  const ground = Math.max(0, s.y - 12);
  g.paint({ mat: 'timberDark' }, seed).within(placed(s.x, ground, s.z, 0), () => g.lathe([[0.28, 0], [0.2, 0.4], [0.16, s.y - ground + 1.2], [0.2, s.y - ground + 1.3], [0.001, s.y - ground + 1.5]], 8));
  g.paint(IRON, seed).within(placed(s.x, s.y + 0.4, s.z, 0), () => {
    g.within(oriented(0, 0, 0, 0, Math.PI / 2), () => g.lathe([[0.42, -0.06], [0.48, 0], [0.42, 0.06], [0.1, 0.06], [0.1, -0.06]], 14));
  });
  g.paint(BRASS, seed).within(placed(s.x, s.y + 0.4, s.z, 0), () => g.lathe([[0.08, -0.12], [0.08, 0.12]], 6));
  // Stays down to the ground (ropes) and a ring of iron steps.
  g.paint(ROPE, seed);
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2 + hash2(seed, 1);
    g.tube([new Vector3(s.x, s.y - 1, s.z), new Vector3(s.x + Math.cos(a) * 3, ground, s.z + Math.sin(a) * 3)], 0.02, 3);
  }
  const tint = flockTint(s.z);
  g.paint({ mat: 'canvas', tint }, seed + 2);
  const pts = [new Vector3(s.x + 0.18, s.y + 1.1, s.z), new Vector3(s.x + 0.18, s.y + 0.5, s.z), new Vector3(s.x + 1.7, s.y + 0.75, s.z + 0.1), new Vector3(s.x + 1.3, s.y + 0.85, s.z + 0.08), new Vector3(s.x + 1.8, s.y + 1.0, s.z + 0.12)];
  g.poly(pts, new Vector3(0, 0, 1));
  g.poly(pts, new Vector3(0, 0, -1));
}

/** A Chimney (§1.4): a soot-stained brick hearth ring at the foot of the warm shaft and a sooty collar at its top. */
function hearth(w: World, bottom: Vec3, top: Vec3, seed: number): void {
  const g = m(w, 2, bottom);
  g.paint({ mat: 'brick' }, seed).within(placed(bottom.x, bottom.y, bottom.z, 0), () => g.lathe([[1.75, 0], [1.75, 0.45], [1.55, 0.5], [1.55, 0.05]], 16));
  g.paint({ mat: 'brickBurnt', shade: 0.4 }, seed).within(placed(bottom.x, bottom.y + 0.02, bottom.z, 0), () => g.lathe([[1.5, 0], [0.001, 0.0]], 16));
  // Embers glowing in the grate.
  g.paint({ mat: 'lantern', tint: 0xff9a50 }, seed);
  for (let k = 0; k < 9; k++) {
    const a = hash2(seed, k) * Math.PI * 2;
    const r = hash2(seed, k + 9) * 1.1;
    g.box(bottom.x + Math.cos(a) * r, bottom.y + 0.06, bottom.z + Math.sin(a) * r, 0.14, 0.07, 0.1);
  }
  const gt = m(w, 2, top);
  gt.paint({ mat: 'brickBurnt', shade: 0.5 }, seed + 1).within(placed(top.x, top.y - 0.2, top.z, 0), () => gt.lathe([[1.8, 0], [1.8, 0.5], [1.55, 0.55], [1.55, 0]], 16));
  // A feather or two drifting up the shaft.
  const gc = m(w, 1, bottom, 'cutout');
  for (let k = 0; k < 3; k++) {
    gc.paint({ mat: 'featherCard', tint: 0xf0e8d8 }, seed + k).card2(new Vector3(bottom.x + (hash2(seed, k + 30) - 0.5), bottom.y + 2 + k * 2.2, bottom.z + (hash2(seed, k + 40) - 0.5)), new Vector3(0.05, 0, 0.02), new Vector3(0.03, 0.14, -0.04));
  }
}

// ── Thicket camps ────────────────────────────────────────────────────────────────────────────────────────────────

/** A camp's den by family, set back from the anchor so the creatures stand clear: trampled earth and a lair. */
function camp(w: World, p: Vec3, yaw: number, family: string, seed: number): void {
  const g = m(w, 1, p);
  // Trampled earth in an irregular ring.
  g.paint({ mat: 'earth', tint: 0xb8a088 }, seed);
  const ring: Vector3[] = [];
  for (let k = 0; k < 14; k++) {
    const a = (k / 14) * Math.PI * 2;
    const r = 3.6 + hash2(seed, k) * 1.4;
    ring.push(new Vector3(p.x + Math.cos(a) * r, p.y + 0.025, p.z + Math.sin(a) * r));
  }
  g.poly(ring, new Vector3(0, 1, 0));
  const back = new Vector3(Math.sin(yaw + Math.PI), 0, Math.cos(yaw + Math.PI));
  const den = new Vector3(p.x, p.y, p.z).addScaledVector(back, 4.2);
  const gd = m(w, 2, den, 'cast');
  switch (family) {
    case 'beetles': {
      // A rotting log, split, with bracket fungus.
      gd.paint(BARK, seed).within(oriented(den.x, den.y + 0.55, den.z, yaw + Math.PI / 2, Math.PI / 2), () => gd.lathe([[0.55, -1.8], [0.6, 0], [0.5, 1.8]], 10));
      gd.paint({ mat: 'timber', tint: 0xc8a878 }, seed).within(oriented(den.x, den.y + 0.55, den.z, yaw + Math.PI / 2, Math.PI / 2), () => gd.disc(0, 1.8, 0, 0.48, 10, 1));
      gd.paint({ mat: 'plaster', tint: 0xc89868 }, seed);
      for (let k = 0; k < 4; k++) gd.within(placed(den.x + (k - 1.5) * 0.7, den.y + 0.7 + (k % 2) * 0.2, den.z + 0.55, 0), () => gd.lathe([[0.001, 0], [0.22, 0.02], [0.18, 0.06], [0.001, 0.07]], 7));
      break;
    }
    case 'weasels':
    case 'badgers': {
      // A sett mound of earth and stones with dark entrance holes.
      const r = family === 'badgers' ? 2.4 : 1.7;
      gd.paint({ mat: 'earth' }, seed).within(placed(den.x, den.y, den.z, 0), () => gd.lathe([[r, -0.05], [r * 0.8, r * 0.3], [r * 0.45, r * 0.5], [0.001, r * 0.55]], 12));
      gd.paint({ mat: 'timberDark', shade: 0.12 }, seed);
      for (let k = 0; k < 2; k++) {
        const a = yaw + (k - 0.5) * 0.9;
        const c = new Vector3(den.x + Math.sin(a) * r * 0.7, den.y + 0.32, den.z + Math.cos(a) * r * 0.7);
        gd.within(oriented(c.x, c.y, c.z, a, -0.4), () => gd.lathe([[0.001, 0], [0.38, 0.02], [0.001, 0.03]], 9));
      }
      gd.paint({ mat: 'granite' }, seed);
      for (let k = 0; k < 6; k++) {
        const a = hash2(seed, k) * Math.PI * 2;
        gd.within(placed(den.x + Math.cos(a) * r * 0.95, den.y, den.z + Math.sin(a) * r * 0.95, a), () => gd.lathe([[0.3, 0], [0.25, 0.2], [0.001, 0.3]], 6));
      }
      break;
    }
    case 'rats': {
      // A hoard of gnawed scraps: a split crate, spilled sacks, a gnawed hole.
      crateAt(gd, den.x, den.y, den.z, 1.2, 0.8, 1.0, seed);
      sack(gd, den.x + 1.1, den.y, den.z + 0.3, 0.32, seed + 1, 0xa89070);
      sack(gd, den.x - 1.0, den.y, den.z - 0.2, 0.28, seed + 2);
      break;
    }
    default: {
      // Toads: a damp mossy rock pool.
      gd.paint({ mat: 'granite' }, seed).within(placed(den.x, den.y, den.z, 0), () => gd.lathe([[1.9, 0], [1.7, 0.35], [1.35, 0.4], [1.3, 0.1]], 12));
      gd.paint({ mat: 'water' }, seed).disc(den.x, den.y + 0.25, den.z, 1.32, 12, 1);
      gd.paint(MOSS, seed).within(placed(den.x, den.y, den.z, 0), () => gd.lathe([[2.0, 0], [1.85, 0.2], [1.7, 0.3]], 12));
    }
  }
  // Bushes behind the den close the camp's back.
  const gc = m(w, 1, den, 'cutout');
  for (let k = 0; k < 3; k++) {
    const a = yaw + Math.PI + (k - 1) * 0.6;
    clump(gc, p.x + Math.sin(a) * 6, p.y + 0.8, p.z + Math.cos(a) * 6, 1.1, seed + k);
  }
}

/** A Nest's bed: a ring of straw and twigs, a feather or two, on the floor under the breakable nest. */
function nestBed(w: World, p: Vec3, seed: number): void {
  const g = m(w, 0, p);
  g.paint({ mat: 'thatch', tint: 0xe8d8b0 }, seed).within(placed(p.x, p.y, p.z, hash2(seed, 1) * 3), () => g.lathe([[0.95, 0], [0.82, 0.08], [0.55, 0.06], [0.001, 0.03]], 10));
  g.paint(TWIG, seed);
  for (let k = 0; k < 5; k++) {
    const a = hash2(seed, k) * Math.PI * 2;
    g.tube([new Vector3(p.x + Math.cos(a) * 0.7, p.y + 0.04, p.z + Math.sin(a) * 0.7), new Vector3(p.x + Math.cos(a + 0.4) * 1.15, p.y + 0.02, p.z + Math.sin(a + 0.4) * 1.15)], 0.015, 3);
  }
  const gc = m(w, 0, p, 'cutout');
  const a = hash2(seed, 9) * Math.PI * 2;
  gc.paint({ mat: 'featherCard', tint: 0xe8e0d0 }, seed).card2(new Vector3(p.x + Math.cos(a) * 0.9, p.y + 0.05, p.z + Math.sin(a) * 0.9), new Vector3(0.05, 0, 0.02), new Vector3(-0.03, 0.01, 0.15));
}

// ── Runes, the Egg, the Hollow ───────────────────────────────────────────────────────────────────────────────────

/** A rune stone set in the rune bridge's deck: a carved roundel with a radiating feather, lanterns either side. */
function runeStone(w: World, p: Vec3, yaw: number, seed: number): void {
  const g = m(w, 2, p);
  g.paint({ mat: 'ashlar', tint: 0xe8e0d0 }, seed).within(placed(p.x, p.y + 0.04, p.z, yaw), () => {
    g.lathe([[1.1, 0], [1.1, 0.03], [0.95, 0.05], [0.001, 0.05]], 20);
    // Seven feather vanes radiating from the centre, in shallow relief.
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * Math.PI * 2;
      g.within(oriented(Math.cos(a) * 0.45, 0.06, Math.sin(a) * 0.45, -a + Math.PI / 2, 0), () => g.box(0, 0, 0, 0.14, 0.03, 0.7, 0.01));
    }
  });
  g.paint({ mat: 'brass' }, seed).within(placed(p.x, p.y + 0.09, p.z, 0), () => g.lathe([[0.18, 0], [0.12, 0.03], [0.001, 0.04]], 10));
  const g1 = m(w, 1, p);
  for (const s of [-1, 1]) {
    const side = new Vector3(Math.cos(yaw), 0, -Math.sin(yaw)).multiplyScalar(s * 1.6);
    lanternPost(g1, p.x + side.x, p.y, p.z + side.z, 1.5, seed + s);
  }
  // The rune bridge: plank deck over the prim it stands on, posts and rope rails.
  const bi = w.map.prims.findIndex((q) => q.shape === 'box' && q.material === 'wood' && Math.abs(q.centre.x - p.x) < 0.5 && Math.abs(q.centre.z - p.z) < 0.5 && q.size.x > 10);
  const bridge = w.map.prims[bi];
  w.dressed.add(bi);
  if (bridge?.shape !== 'box') return;
  const top = bridge.centre.y + bridge.size.y / 2;
  const gb = m(w, 2, p, 'cast');
  const along = bridge.size.x >= bridge.size.z;
  const [len, wid] = along ? [bridge.size.x, bridge.size.z] : [bridge.size.z, bridge.size.x];
  gb.within(placed(bridge.centre.x, top, bridge.centre.z, along ? 0 : Math.PI / 2), () => {
    for (let x = -len / 2 + 0.2; x < len / 2; x += 0.4) {
      if (Math.abs(x) < 1.15) continue;
      gb.paint({ mat: 'boards', tint: 0xe0d0b8 }, seed + Math.round(x * 3)).span(x - 0.18, x + 0.18, -0.02, 0.03, -wid / 2 - 0.05, wid / 2 + 0.05);
    }
    gb.paint({ mat: 'timberDark' }, seed);
    for (const s of [-1, 1]) {
      for (let x = -len / 2 + 0.3; x <= len / 2; x += 2.75) gb.span(x - 0.07, x + 0.07, -0.5, 1.1, s * wid / 2 - 0.07, s * wid / 2 + 0.07);
      gb.paint(ROPE, seed).tube([new Vector3(-len / 2, 1.05, s * wid / 2), new Vector3(0, 0.95, s * wid / 2), new Vector3(len / 2, 1.05, s * wid / 2)], 0.035, 5);
      gb.paint({ mat: 'timberDark' }, seed);
    }
    // Faded bunting from rail to rail.
    gb.paint({ mat: 'canvas', tint: FADED.neutral }, seed);
    for (let x = -len / 2 + 1; x < len / 2; x += 0.6) {
      const tri = [new Vector3(x - 0.15, 1.0, wid / 2), new Vector3(x + 0.15, 1.0, wid / 2), new Vector3(x, 0.68, wid / 2 + 0.02)];
      gb.poly(tri, new Vector3(0, 0, 1));
      gb.poly(tri, new Vector3(0, 0, -1));
    }
  });
}

/** An Egg perch: a moulded basin ring of water round a stone pedestal carrying a woven nest where the Egg rests. */
function eggPerch(w: World, p: Vec3, seed: number): void {
  const g = m(w, 2, p, 'cast');
  g.paint({ mat: 'ashlar', tint: 0xf0e4d0 }, seed).within(placed(p.x, p.y, p.z, 0), () => {
    g.lathe([[2.9, 0], [2.9, 0.4], [2.75, 0.45], [2.6, 0.45], [2.55, 0.1], [1.75, 0.1], [1.7, 0.18], [1.6, 0.2]], 24);
  });
  g.paint({ mat: 'water' }, seed).within(placed(p.x, p.y + 0.32, p.z, 0), () => g.lathe([[2.58, 0], [1.72, 0]], 24));
  nest(g, p.x, p.y + 0.02, p.z, 1.15, 0.45, seed, 0, 16);
  // A circle of eight carved feathers standing round the basin, and the plinth's kerb.
  g.paint({ mat: 'ashlar' }, seed + 1);
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
    g.within(oriented(p.x + Math.cos(a) * 4.6, p.y, p.z + Math.sin(a) * 4.6, -a + Math.PI / 2, 0, 0), () => {
      g.lathe([[0.25, 0], [0.18, 0.3], [0.2, 0.9], [0.12, 1.4], [0.001, 1.6]], 6);
    });
  }
  const g1 = m(w, 1, p);
  g1.paint(MOSS, seed).within(placed(p.x, p.y, p.z, 0), () => g1.lathe([[3.0, 0], [2.92, 0.12]], 24));
}

/** The Roc's Hollow (§6.4): root walls, mossy rock shelves, old mill timbers, ember scorches, the bridge deck. */
function rocHollow(w: World, c: Vec3, r: number, floorY: number): void {
  const depth = -floorY;
  const seed = 4900;
  // Earth and rock over the four pit walls, with roots hanging down them and moss shelves (≤ 0.25 m deep).
  for (let side = 0; side < 4; side++) {
    const yaw = (side * Math.PI) / 2;
    const n = new Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    const at = new Vector3(c.x, 0, c.z).addScaledVector(n, -r);
    const g = m(w, 2, at);
    g.within(placed(at.x, floorY, at.z, yaw), () => {
      g.paint({ mat: 'earth', tint: 0x9a8270 }, seed + side).poly([new Vector3(-r, 0, 0.03), new Vector3(r, 0, 0.03), new Vector3(r, depth, 0.03), new Vector3(-r, depth, 0.03)], new Vector3(0, 0, 1));
      for (let k = 0; k < 7; k++) {
        const x = -r + 2 + (k * (2 * r - 4)) / 6 + (hash2(seed, side * 10 + k) - 0.5) * 2;
        const y = 1.2 + hash2(seed, side * 20 + k) * (depth - 3);
        g.paint({ mat: 'granite', tint: 0xa8b098 }, seed + k).span(x - 1.2, x + 1.2, y - 0.5, y, 0, 0.24, 0.06);
        g.paint(MOSS, seed + k).span(x - 1.15, x + 1.15, y, y + 0.06, 0.02, 0.24);
      }
      g.paint({ mat: 'granite', shade: 0.85 }, seed + side);
      for (let x = -r + 1; x < r; x += 2.6) g.span(x - 1.3, x + 1.3, 0, 0.9 + hash2(seed, x) * 0.8, 0, 0.22, 0.08);
    });
    const gr = m(w, 1, at);
    gr.paint(BARK, seed + side).within(placed(at.x, floorY, at.z, yaw), () => {
      for (let k = 0; k < 6; k++) {
        const x = -r + 3 + k * ((2 * r - 6) / 5);
        const pts = [new Vector3(x, depth + 0.2, 0.1), new Vector3(x + 0.6, depth * 0.6, 0.18), new Vector3(x - 0.3, depth * 0.25, 0.12), new Vector3(x + 0.2, 0.3, 0.2)];
        gr.tube(pts, [0.3, 0.2, 0.14, 0.08], 5);
      }
    });
  }
  // Old mill timbers leaning in a corner, a fallen millstone, scattered sacks.
  const corner = new Vector3(c.x - r + 4, floorY, c.z + r - 4);
  const gt = m(w, 2, corner, 'cast');
  gt.paint({ mat: 'timberDark' }, seed);
  for (let k = 0; k < 4; k++) gt.within(oriented(corner.x + k * 1.2, floorY + 2.2, corner.z - 0.6, 0.3 * k, -0.45 - k * 0.1), () => gt.box(0, 0, 0, 0.35, 0.35, 5.2, 0.03));
  gt.paint({ mat: 'granite' }, seed).within(oriented(corner.x + 5, floorY + 0.8, corner.z - 2.5, 0.4, 1.2), () => gt.lathe([[0.25, -0.25], [1.0, -0.25], [1.0, 0.25], [0.25, 0.25]], 14));
  barrel(gt, corner.x - 1, floorY, corner.z - 4, 0.4, 1.0, seed);
  // Ember-scorched patches near the Roc (emissive embers only, #FF7A2E).
  const ge = m(w, 1, c);
  for (let k = 0; k < 6; k++) {
    const a = hash2(seed, k + 50) * Math.PI * 2;
    const d = 5 + hash2(seed, k + 60) * 9;
    const x = c.x + Math.cos(a) * d;
    const z = c.z + Math.sin(a) * d;
    ge.paint({ mat: 'brickBurnt', shade: 0.3 }, seed + k);
    const pts: Vector3[] = [];
    for (let j = 0; j < 9; j++) {
      const b = (j / 9) * Math.PI * 2;
      const rr = 1.2 + hash2(seed, k * 9 + j) * 0.9;
      pts.push(new Vector3(x + Math.cos(b) * rr, floorY + 0.03, z + Math.sin(b) * rr));
    }
    ge.poly(pts, new Vector3(0, 1, 0));
    ge.paint({ mat: 'lantern', tint: 0xff7a2e }, seed + k);
    for (let j = 0; j < 5; j++) ge.box(x + (hash2(seed, k * 5 + j + 100) - 0.5) * 1.6, floorY + 0.06, z + (hash2(seed, k * 5 + j + 200) - 0.5) * 1.6, 0.12, 0.05, 0.09);
  }
  // The bridge over the pit: plank deck, its rails capped.
  const bi = w.map.prims.findIndex((q) => q.shape === 'box' && q.material === 'wood' && Math.abs(q.centre.x - c.x) < 0.5 && Math.abs(q.centre.z - c.z) < 0.5 && q.size.z > 2 * r - 1);
  const bridge = w.map.prims[bi];
  w.dressed.add(bi);
  if (bridge?.shape === 'box') {
    const top = bridge.centre.y + bridge.size.y / 2;
    const gb = m(w, 2, c);
    for (let z = -bridge.size.z / 2 + 0.25; z < bridge.size.z / 2; z += 0.5) {
      gb.paint({ mat: 'boards', tint: 0xd8c8b0 }, seed + Math.round(z * 2)).span(c.x - bridge.size.x / 2, c.x + bridge.size.x / 2, top - 0.03, top + 0.02, c.z + z - 0.23, c.z + z + 0.23);
    }
    gb.paint({ mat: 'timberDark' }, seed);
    for (const s of [-1, 1]) for (let z = -bridge.size.z / 2; z <= bridge.size.z / 2; z += 4) gb.span(c.x + s * (bridge.size.x / 2) - 0.2, c.x + s * (bridge.size.x / 2) + 0.2, top - 2.5, top, c.z + z - 0.2, c.z + z + 0.2, 0.03);
  }
}

// ── Interactables ────────────────────────────────────────────────────────────────────────────────────────────────

/** A Bell Feeder's spill: seed scattered on the floor around it and a seed sack. */
function seedSpill(w: World, p: Vec3, seed: number): void {
  const g = m(w, 0, p);
  g.paint({ mat: 'gravel', tint: 0xe0c890 }, seed);
  for (let k = 0; k < 7; k++) {
    const a = hash2(seed, k) * Math.PI * 2;
    const d = 1.0 + hash2(seed, k + 7) * 0.8;
    g.within(placed(p.x + Math.cos(a) * d, p.y, p.z + Math.sin(a) * d, 0), () => g.lathe([[0.22, 0], [0.001, 0.04]], 7));
  }
  sack(m(w, 1, p), p.x + 1.5, p.y, p.z - 0.6, 0.3, seed);
}

/** A Lookout (§1.4): a mast with a pennant and a perch bar beside the spot. */
function lookout(w: World, p: Vec3, yaw: number, seed: number): void {
  const g = m(w, 1, p);
  const side = new Vector3(Math.cos(yaw), 0, -Math.sin(yaw)).multiplyScalar(1.6);
  const x = p.x + side.x;
  const z = p.z + side.z;
  g.paint({ mat: 'timberDark' }, seed).within(placed(x, p.y, z, 0), () => g.lathe([[0.09, 0], [0.06, 3.4], [0.001, 3.55]], 6));
  g.paint({ mat: 'canvas', tint: flockTint(p.z) }, seed);
  const pts = [new Vector3(x, p.y + 3.3, z), new Vector3(x, p.y + 2.8, z), new Vector3(x + 1.1, p.y + 3.0, z + 0.1), new Vector3(x + 0.85, p.y + 3.1, z + 0.08), new Vector3(x + 1.2, p.y + 3.25, z + 0.1)];
  g.poly(pts, new Vector3(0, 0, 1));
  g.poly(pts, new Vector3(0, 0, -1));
  g.paint({ mat: 'timber' }, seed).tube([new Vector3(x - 0.45, p.y + 1.1, z), new Vector3(x + 0.45, p.y + 1.1, z)], 0.03, 5);
  lantern(g, x, p.y + 2.4, z + 0.12, seed);
}

/** A Bough Spring pad: a woven springy ring with a pale landing mat and a feather tuft (§1.4 affordance). */
function springRing(w: World, p: Vec3, r: number, seed: number): void {
  const g = m(w, 2, p);
  const ring: Vector3[] = [];
  for (let k = 0; k <= 18; k++) ring.push(new Vector3(p.x + Math.cos((k / 18) * Math.PI * 2) * r, p.y + 0.12, p.z + Math.sin((k / 18) * Math.PI * 2) * r));
  g.paint(TWIG, seed).tube(ring, 0.12, 6);
  g.paint({ mat: 'thatch', tint: 0xf4ead0 }, seed).within(placed(p.x, p.y, p.z, 0), () => g.lathe([[r * 0.95, 0.02], [r * 0.6, 0.1], [0.001, 0.12]], 14));
  // Two bent green saplings, low, as the spring's tell.
  g.paint({ mat: 'bark', tint: 0xa8b080 }, seed);
  for (const s of [-1, 1]) g.tube([new Vector3(p.x + s * r, p.y, p.z - 0.3), new Vector3(p.x + s * r * 0.6, p.y + 0.55, p.z), new Vector3(p.x + s * r * 0.2, p.y + 0.35, p.z + 0.2)], [0.06, 0.04, 0.02], 5);
  const gc = m(w, 1, p, 'cutout');
  for (let k = 0; k < 3; k++) gc.paint({ mat: 'featherCard', tint: flockTint(p.z) }, seed + k).card2(new Vector3(p.x + (k - 1) * 0.12, p.y + 0.35, p.z - r), new Vector3(0.05, 0, 0), new Vector3(0.02 * (k - 1), 0.2, 0));
}

/** A Magpie stall's hoard (§5.9 Magpie Den): shiny trinkets, keys, rings, buttons and mirrors heaped round it. */
function hoard(w: World, p: Vec3, yaw: number, seed: number): void {
  const g = m(w, 1, p);
  const back = new Vector3(Math.sin(yaw + Math.PI), 0, Math.cos(yaw + Math.PI)).multiplyScalar(2.2);
  const c = new Vector3(p.x + back.x, p.y, p.z + back.z);
  g.paint({ mat: 'canvas', tint: 0x8a6a8a }, seed).within(placed(c.x, c.y, c.z, yaw), () => g.lathe([[1.1, 0], [0.9, 0.12], [0.001, 0.14]], 12));
  for (let k = 0; k < 26; k++) {
    const a = hash2(seed, k) * Math.PI * 2;
    const d = hash2(seed, k + 30) * 0.9;
    const x = c.x + Math.cos(a) * d;
    const z = c.z + Math.sin(a) * d;
    const y = c.y + 0.12 + (0.9 - d) * 0.35 * hash2(seed, k + 60);
    const kind = k % 4;
    g.paint(kind === 0 ? BRASS : kind === 1 ? { mat: 'pewter' } : kind === 2 ? { mat: 'glass', tint: 0xc8d8e8, shade: 2.2 } : { mat: 'brass', tint: 0xe0c0a0 }, seed + k);
    if (kind === 3) {
      // A ring.
      const ringPts: Vector3[] = [];
      for (let j = 0; j <= 8; j++) ringPts.push(new Vector3(x + Math.cos((j / 8) * Math.PI * 2) * 0.07, y, z + Math.sin((j / 8) * Math.PI * 2) * 0.07));
      g.tube(ringPts, 0.015, 4);
    } else if (kind === 1) {
      // A key: bow and blade.
      g.within(placed(x, y, z, a), () => {
        g.lathe([[0.05, 0], [0.05, 0.02]], 8);
        g.box(0.15, 0.01, 0, 0.22, 0.02, 0.025);
      });
    } else g.within(oriented(x, y, z, a, 0.3), () => g.lathe([[0.001, 0], [0.06, 0.005], [0.06, 0.02], [0.001, 0.025]], 8));
  }
  crateAt(g, c.x + 1.3, c.y, c.z + 0.6, 0.7, 0.6, 0.6, seed);
  lantern(g, c.x - 1.0, c.y + 1.6, c.z, seed);
  g.paint(IRON, seed).span(c.x - 1.05, c.x - 0.95, c.y, c.y + 1.62, c.z - 0.05, c.z + 0.05);
}
