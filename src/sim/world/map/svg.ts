/**
 * Top-down SVG of a MapData: prims shaded by height, lanes, Updrafts, climbs, ledges, the nav graph and labelled
 * anchors. Pure string output, usable by tests, tools and (later) the minimap.
 *
 * True top-down view (D-ARCH-008): north (+z, Dusk) is up and east (+x) is on the LEFT.
 */
import type { BlockoutPrim, MapData, MaterialTag, NavLinkKind, Vec3 } from '../../core/contracts';
import { corners, primBottom, primTop } from './geometry';

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

/** Presentation constants. Sizes are in metres (multiplied by the scale). */
const STYLE = {
  scale: 4,
  /** Heights from shadeLow to shadeHigh blend from the material colour toward white, up to shadeMax %. */
  shadeLow: -10,
  shadeHigh: 20,
  shadeMax: 65,
  /** Prims whose bottom is above this are canopy: drawn as faint outlines. */
  canopyFrom: 20,
  font: 3.2,
  thin: 0.1,
  line: 0.25,
  medium: 0.33,
  thick: 0.5,
  dash: 2,
  rampArrow: 0.4,
  node: 0.33,
  station: 1,
  chimney: 1.5,
  vine: 0.8,
  anchor: 0.7,
  labelDx: 1.2,
  labelDy: 1,
  botSpot: 1,
  laneOpacity: 0.14,
  linkOpacity: 0.5,
  percent: 100,
} as const;

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

const STRUCTURE_LABEL: Record<string, string> = { hawk: 'Hawk', heron: 'Heron', warden: 'W', shrine: 'Shrine', patron: 'Patron' };

/** The colour lightened toward white with height. */
function shade(hex: string, y: number): string {
  const t = Math.min(1, Math.max(0, (y - STYLE.shadeLow) / (STYLE.shadeHigh - STYLE.shadeLow)));
  const white = Math.round(t * STYLE.shadeMax);
  return `color-mix(in srgb, ${hex} ${STYLE.percent - white}%, #fff)`;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

export function mapSvg(map: MapData, opts: MapSvgOptions = {}): string {
  const r = opts.region ?? { minX: map.bounds.min.x, maxX: map.bounds.max.x, minZ: map.bounds.min.z, maxZ: map.bounds.max.z };
  const s = opts.scale ?? STYLE.scale;
  const showLabels = opts.labels ?? true;
  /** Metres to pixels. */
  const m = (metres: number) => (metres * s).toFixed(1);
  // East on the left: screen x grows toward −x; north up: screen y grows toward −z.
  const X = (x: number) => m(r.maxX - x);
  const Y = (z: number) => m(r.maxZ - z);
  const pts = (ps: readonly Vec3[]) => ps.map((p) => `${X(p.x)},${Y(p.z)}`).join(' ');
  const line = (a: Vec3, b: Vec3, attrs: string) =>
    `<line x1="${X(a.x)}" y1="${Y(a.z)}" x2="${X(b.x)}" y2="${Y(b.z)}" ${attrs}/>`;
  const circle = (p: Vec3, radius: number, attrs: string) =>
    `<circle cx="${X(p.x)}" cy="${Y(p.z)}" r="${m(radius)}" ${attrs}/>`;
  const out: string[] = [];
  const w = m(r.maxX - r.minX);
  const h = m(r.maxZ - r.minZ);
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" font-family="sans-serif">`);
  out.push('<defs><marker id="up" viewBox="0 0 6 6" refX="3" refY="3" markerWidth="4" markerHeight="4" orient="auto"><path d="M0,0 L6,3 L0,6 z" fill="#fff"/></marker></defs>');
  out.push(`<rect width="${w}" height="${h}" fill="#1d2420"/>`);

  const prim = (p: BlockoutPrim, attrs: string) =>
    p.shape === 'cylinder' ? circle(p.centre, p.radius, attrs) : `<polygon points="${pts(corners(p))}" ${attrs}/>`;
  for (const p of [...map.prims].sort((a, b) => primTop(a) - primTop(b))) {
    if (primBottom(p) > STYLE.canopyFrom) {
      out.push(prim(p, `fill="none" stroke="#9fd18b" stroke-opacity="0.35" stroke-width="${m(STYLE.thick)}"`));
      continue;
    }
    const fill = shade(MATERIAL[p.material], primTop(p));
    out.push(prim(p, p.solid
      ? `fill="${fill}" stroke="#000" stroke-opacity="0.45" stroke-width="0.5"`
      : `fill="${fill}" fill-opacity="0.45"`));
    if (p.shape === 'ramp') {
      // Arrow from the low edge toward the high edge.
      const f = { x: Math.sin(p.yaw) * p.size.z * STYLE.rampArrow, y: 0, z: Math.cos(p.yaw) * p.size.z * STYLE.rampArrow };
      const a = { x: p.centre.x - f.x, y: 0, z: p.centre.z - f.z };
      const b = { x: p.centre.x + f.x, y: 0, z: p.centre.z + f.z };
      out.push(line(a, b, `stroke="#fff" stroke-width="${m(STYLE.line)}" marker-end="url(#up)"`));
    }
  }

  if (map.hollow) {
    out.push(circle(map.hollow.centre, map.hollow.radius, `fill="none" stroke="#ff6a00" stroke-dasharray="${m(STYLE.dash)}" stroke-width="${m(STYLE.medium)}"`));
  }
  for (const lane of map.lanes) {
    out.push(`<polyline points="${pts(lane.path)}" fill="none" stroke="#f2d46b" stroke-opacity="${STYLE.laneOpacity}" stroke-width="${m(lane.halfWidth * 2)}" stroke-linejoin="round"/>`);
    out.push(`<polyline points="${pts(lane.path)}" fill="none" stroke="#f2d46b" stroke-width="${m(STYLE.medium)}" stroke-dasharray="${m(STYLE.dash)}"/>`);
  }
  for (const l of map.ledges) out.push(line(l.a, l.b, `stroke="#ffe14d" stroke-width="${m(STYLE.medium)}" stroke-opacity="0.8"`));
  if (opts.nav ?? true) {
    for (const l of map.nav.links) {
      const a = map.nav.nodes[l.from];
      const b = map.nav.nodes[l.to];
      if (!a || !b) continue;
      const width = m(l.kind === 'walk' ? STYLE.thin : STYLE.line);
      out.push(line(a, b, `stroke="${LINK[l.kind]}" stroke-opacity="${STYLE.linkOpacity}" stroke-width="${width}"`));
    }
    for (const n of map.nav.nodes) out.push(circle(n, STYLE.node, `fill="${shade('#3060ff', n.y)}"`));
  }
  for (const u of map.updrafts) {
    out.push(`<polyline points="${pts(u.points)}" fill="none" stroke="#40e0ff" stroke-width="${m(STYLE.thick)}" stroke-opacity="0.8"/>`);
    for (const st of u.stations) out.push(circle(st, STYLE.station, `fill="none" stroke="#40e0ff" stroke-width="${m(STYLE.medium)}"`));
  }
  for (const c of map.climbs) {
    out.push(c.kind === 'chimney'
      ? circle(c.bottom, STYLE.chimney, `fill="#ff6a00" fill-opacity="0.7" stroke="#fff" stroke-width="${m(STYLE.thin)}"`)
      : circle(c.bottom, STYLE.vine, `fill="#2bff6a" stroke="#000" stroke-width="${m(STYLE.thin)}"`));
  }

  const label = (p: Vec3, text: string, color: string) => {
    out.push(circle(p, STYLE.anchor, `fill="${color}" stroke="#000" stroke-width="${m(STYLE.thin)}"`));
    if (showLabels && text) {
      out.push(`<text x="${X(p.x)}" y="${Y(p.z)}" dx="${m(STYLE.labelDx)}" dy="${m(STYLE.labelDy)}" font-size="${m(STYLE.font)}" fill="${color}" stroke="#000" stroke-width="${m(STYLE.thin)}" paint-order="stroke">${esc(text)}</text>`);
    }
  };
  for (const n of map.nests) label(n.pos, '', '#e7a1b0');
  for (const b of map.botSpots) {
    const color = b.kind === 'safe' ? TEAM[b.team] : '#ff4a4a';
    out.push(`<rect x="${X(b.pos.x)}" y="${Y(b.pos.z)}" width="${m(STYLE.botSpot)}" height="${m(STYLE.botSpot)}" fill="${color}" stroke="#000" stroke-width="${m(STYLE.thin)}"/>`);
  }
  for (const sp of map.spawns) label(sp.pos, '', TEAM[sp.team] ?? '#fff');
  for (const shop of map.shops) {
    out.push(circle(shop.pos, shop.radius, `fill="none" stroke="${TEAM[shop.team]}" stroke-width="${m(STYLE.line)}" stroke-dasharray="${m(STYLE.station)}"`));
    label(shop.pos, shop.kind === 'roost' ? 'Roost' : '$', TEAM[shop.team] ?? '#fff');
  }
  for (const st of map.structures) label(st.pos, STRUCTURE_LABEL[st.type] ?? st.type, TEAM[st.team] ?? '#fff');
  for (const t of map.thickets) label(t.pos, `T${t.tier}`, '#ff4a4a');
  for (const e of map.eggPerches) label(e.pos, 'Egg', '#ffd27a');
  for (const rs of map.runeSpots) label(rs.pos, 'Rune', '#b0b0ff');
  out.push('</svg>');
  return out.join('\n');
}
