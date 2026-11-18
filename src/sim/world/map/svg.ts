/**
 * Top-down SVG of a MapData: prims shaded by height, lanes, Updrafts, climbs, ledges, the nav graph and labelled
 * anchors. Pure string output, usable by tests, tools and (later) the minimap.
 *
 * True top-down view (D-ARCH-008): north (+z, Dusk) is up and east (+x) is on the LEFT.
 */
import type { BlockoutPrim, MapData, MaterialTag, NavLinkKind, Vec3 } from '../../core/contracts';
import { corners, primTop } from './geometry';

export interface MapSvgOptions {
  /** World rectangle to draw (default: the map bounds). */
  readonly region?: { readonly minX: number; readonly maxX: number; readonly minZ: number; readonly maxZ: number };
  /** Pixels per metre (default 4). */
  readonly scale?: number;
  /** Draw the nav graph (default true). */
  readonly nav?: boolean;
  /** Draw text labels (default true). */
  readonly labels?: boolean;
}

const DEFAULT_SCALE = 4;
/** Heights from LOW to HIGH blend from the material colour toward white. */
const SHADE_LOW = -10;
const SHADE_HIGH = 20;
const SHADE_MAX = 0.65;
/** Prims whose bottom is above this are canopy: drawn as faint outlines. */
const CANOPY_FROM = 20;
const MARGIN = 6;
const FONT = 3.2;

const MATERIAL: Record<MaterialTag, string> = {
  ground: '#8a7a5c', grass: '#6f8f55', road: '#9c8b6e', stone: '#a89a80', brick: '#a4573f', wood: '#7a5236',
  roof: '#5f6b74', metal: '#77808a', water: '#3f8c8a', foliage: '#4f7d3b', trunk: '#4e3424', dawn: '#f5a623',
  dusk: '#6b6bff',
};

const LINK: Record<NavLinkKind, string> = {
  walk: '#ffffff', drop: '#ff9f40', mantle: '#ffe14d', jump: '#ff4dd2', dashJump: '#ff2b2b', chimney: '#ff6a00',
  vine: '#2bff6a', updraft: '#40e0ff',
};

const TEAM: Record<string, string> = { dawn: '#f5a623', dusk: '#6b6bff', neutral: '#dddddd' };

function shade(hex: string, y: number): string {
  const t = Math.min(1, Math.max(0, (y - SHADE_LOW) / (SHADE_HIGH - SHADE_LOW))) * SHADE_MAX;
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return `rgb(${c.map((x) => Math.round(x + (255 - x) * t)).join(',')})`;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

export function mapSvg(map: MapData, opts: MapSvgOptions = {}): string {
  const r = opts.region ?? { minX: map.bounds.min.x, maxX: map.bounds.max.x, minZ: map.bounds.min.z, maxZ: map.bounds.max.z };
  const s = opts.scale ?? DEFAULT_SCALE;
  const showLabels = opts.labels ?? true;
  // East on the left: screen x grows toward −x; north up: screen y grows toward −z.
  const X = (x: number) => ((r.maxX - x) * s).toFixed(1);
  const Y = (z: number) => ((r.maxZ - z) * s).toFixed(1);
  const pts = (ps: readonly Vec3[]) => ps.map((p) => `${X(p.x)},${Y(p.z)}`).join(' ');
  const out: string[] = [];
  const w = (r.maxX - r.minX) * s;
  const h = (r.maxZ - r.minZ) * s;
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" font-family="sans-serif">`);
  out.push(`<rect width="${w}" height="${h}" fill="#1d2420"/>`);

  const prim = (p: BlockoutPrim, extra: string) => {
    if (p.shape === 'cylinder') {
      return `<circle cx="${X(p.centre.x)}" cy="${Y(p.centre.z)}" r="${(p.radius * s).toFixed(1)}" ${extra}/>`;
    }
    return `<polygon points="${pts(corners(p))}" ${extra}/>`;
  };
  const order = [...map.prims].sort((a, b) => primTop(a) - primTop(b));
  for (const p of order) {
    const bottom = p.centre.y - (p.shape === 'cylinder' ? p.height : p.size.y) / 2;
    if (bottom > CANOPY_FROM) {
      out.push(prim(p, `fill="none" stroke="#9fd18b" stroke-opacity="0.35" stroke-width="${s / 2}"`));
      continue;
    }
    const fill = shade(MATERIAL[p.material], primTop(p));
    const style = p.solid ? `fill="${fill}" stroke="#000" stroke-opacity="0.45" stroke-width="0.5"` : `fill="${fill}" fill-opacity="0.45"`;
    out.push(prim(p, style));
    if (p.shape === 'ramp') {
      // Arrow from the low edge to the high edge.
      const fx = Math.sin(p.yaw) * p.size.z * 0.4;
      const fz = Math.cos(p.yaw) * p.size.z * 0.4;
      out.push(`<line x1="${X(p.centre.x - fx)}" y1="${Y(p.centre.z - fz)}" x2="${X(p.centre.x + fx)}" y2="${Y(p.centre.z + fz)}" stroke="#fff" stroke-width="${s / 4}" marker-end="url(#up)"/>`);
    }
  }
  out.push(`<defs><marker id="up" viewBox="0 0 6 6" refX="3" refY="3" markerWidth="4" markerHeight="4" orient="auto"><path d="M0,0 L6,3 L0,6 z" fill="#fff"/></marker></defs>`);

  if (map.hollow) {
    const c = map.hollow.centre;
    out.push(`<circle cx="${X(c.x)}" cy="${Y(c.z)}" r="${map.hollow.radius * s}" fill="none" stroke="#ff6a00" stroke-dasharray="${s * 2}" stroke-width="${s / 3}"/>`);
  }
  for (const lane of map.lanes) {
    out.push(`<polyline points="${pts(lane.path)}" fill="none" stroke="#f2d46b" stroke-opacity="0.14" stroke-width="${lane.halfWidth * 2 * s}" stroke-linejoin="round"/>`);
    out.push(`<polyline points="${pts(lane.path)}" fill="none" stroke="#f2d46b" stroke-width="${s / 3}" stroke-dasharray="${s * 2}"/>`);
  }
  for (const l of map.ledges) {
    out.push(`<line x1="${X(l.a.x)}" y1="${Y(l.a.z)}" x2="${X(l.b.x)}" y2="${Y(l.b.z)}" stroke="#ffe14d" stroke-width="${s / 3}" stroke-opacity="0.8"/>`);
  }
  if (opts.nav ?? true) {
    for (const l of map.nav.links) {
      const a = map.nav.nodes[l.from];
      const b = map.nav.nodes[l.to];
      if (!a || !b) continue;
      const width = l.kind === 'walk' ? s / 10 : s / 5;
      out.push(`<line x1="${X(a.x)}" y1="${Y(a.z)}" x2="${X(b.x)}" y2="${Y(b.z)}" stroke="${LINK[l.kind]}" stroke-opacity="0.5" stroke-width="${width}"/>`);
    }
    for (const n of map.nav.nodes) {
      out.push(`<circle cx="${X(n.x)}" cy="${Y(n.z)}" r="${s / 3}" fill="${shade('#3060ff', n.y)}"/>`);
    }
  }
  for (const u of map.updrafts) {
    out.push(`<polyline points="${pts(u.points)}" fill="none" stroke="#40e0ff" stroke-width="${s / 2}" stroke-opacity="0.8"/>`);
    for (const st of u.stations) {
      out.push(`<circle cx="${X(st.x)}" cy="${Y(st.z)}" r="${s}" fill="none" stroke="#40e0ff" stroke-width="${s / 3}"/>`);
    }
  }
  for (const c of map.climbs) {
    if (c.kind === 'chimney') {
      out.push(`<circle cx="${X(c.bottom.x)}" cy="${Y(c.bottom.z)}" r="${s * 1.5}" fill="#ff6a00" fill-opacity="0.7" stroke="#fff" stroke-width="${s / 5}"/>`);
    } else {
      out.push(`<circle cx="${X(c.bottom.x)}" cy="${Y(c.bottom.z)}" r="${s * 0.8}" fill="#2bff6a" stroke="#000" stroke-width="${s / 6}"/>`);
    }
  }

  const label = (p: Vec3, text: string, color: string, size = FONT) => {
    out.push(`<circle cx="${X(p.x)}" cy="${Y(p.z)}" r="${s * 0.7}" fill="${color}" stroke="#000" stroke-width="${s / 6}"/>`);
    if (showLabels) {
      out.push(`<text x="${X(p.x)}" y="${Y(p.z)}" dx="${s * 1.2}" dy="${s}" font-size="${size * s}" fill="${color}" stroke="#000" stroke-width="${s / 5}" paint-order="stroke">${esc(text)}</text>`);
    }
  };
  for (const n of map.nests) label(n.pos, '', '#e7a1b0');
  for (const b of map.botSpots) {
    out.push(`<rect x="${X(b.pos.x)}" y="${Y(b.pos.z)}" width="${s}" height="${s}" fill="${b.kind === 'safe' ? TEAM[b.team] : '#ff4a4a'}" stroke="#000" stroke-width="${s / 8}"/>`);
  }
  for (const sp of map.spawns) label(sp.pos, '', TEAM[sp.team] ?? '#fff');
  for (const shop of map.shops) {
    out.push(`<circle cx="${X(shop.pos.x)}" cy="${Y(shop.pos.z)}" r="${shop.radius * s}" fill="none" stroke="${TEAM[shop.team]}" stroke-width="${s / 4}" stroke-dasharray="${s}"/>`);
    label(shop.pos, shop.kind === 'roost' ? 'Roost' : '$', TEAM[shop.team] ?? '#fff');
  }
  const short: Record<string, string> = { hawk: 'Hawk', heron: 'Heron', warden: 'W', shrine: 'Shrine', patron: 'Patron' };
  for (const st of map.structures) label(st.pos, short[st.type] ?? st.type, TEAM[st.team] ?? '#fff');
  for (const t of map.thickets) label(t.pos, `T${t.tier}`, '#ff4a4a');
  for (const e of map.eggPerches) label(e.pos, 'Egg', '#ffd27a');
  for (const rs of map.runeSpots) label(rs.pos, 'Rune', '#b0b0ff');
  out.push('</svg>');
  return out.join('\n');
}
