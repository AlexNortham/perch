/**
 * Minimap and big map (GDD §12.5): one canvas painter, north-up with east at the left so Dawn's base is at the
 * bottom. Enemies follow the map-visibility bits (mapSeenBy), last-seen enemy heroes fade as ghosts, pings pulse.
 */
import { ViewFlag } from '../../sim/core/contracts';
import type { LaneId, MapData, PlayerTeam, SimView } from '../../sim/core/contracts';
import { TICK_RATE } from '../../sim/data/core';
import { loadMap } from '../../sim/world/map';
import type { AppActions } from '../app/contracts';
import { ALLY_TEAL, ENEMY_RED, LANE_COLOURS, NEUTRAL_COLOUR, TEAM_COLOURS } from '../app/palette';
import { hex, MAP_ASPECT, MAP_STYLE, PING_CSS, PING_S } from './constants';
import { el } from './dom';
import { createGhosts, laneName, mapPoint, mapVisible, mapWorld, startLane } from './model';
import type { PingMark } from './world';

/** The zone under the minimap: the lane the local bird is on, else the map's own name. */
export function zoneName(view: SimView): string {
  const me = view.entities.find((e) => e.id === view.localHero);
  const map = mapOf(view.map);
  if (!me) return map.name;
  let best: { id: LaneId; d: number } | null = null;
  for (const lane of map.lanes) {
    for (let i = 1; i < lane.path.length; i++) {
      const a = lane.path[i - 1];
      const b = lane.path[i];
      if (!a || !b) continue;
      const abx = b.x - a.x;
      const abz = b.z - a.z;
      const t = Math.max(0, Math.min(1, ((me.pos.x - a.x) * abx + (me.pos.z - a.z) * abz) / Math.max(NEAR_ZERO, abx * abx + abz * abz)));
      const d = Math.hypot(me.pos.x - (a.x + abx * t), me.pos.z - (a.z + abz * t)) - lane.halfWidth;
      if (!best || d < best.d) best = { id: lane.id, d };
    }
  }
  return best && best.d <= ZONE_LANE_MARGIN_M ? laneName(best.id) : map.name;
}
const ZONE_LANE_MARGIN_M = 12;
const NEAR_ZERO = 1e-6;

export interface MapView {
  readonly canvas: HTMLCanvasElement;
  draw(view: SimView, pings: readonly PingMark[]): void;
  reset(): void;
}

const maps = new Map<string, MapData>();
const mapOf = (id: SimView['map']): MapData => {
  let m = maps.get(id);
  if (!m) maps.set(id, (m = loadMap(id)));
  return m;
};

/** `size` returns the current pixel size, so the big map can follow the window. */
export function createMapView(parent: HTMLElement, cls: string, size: () => { width: number; height: number }, actions: AppActions): MapView {
  const canvas = el(cls, 'canvas', parent);
  const ghosts = createGhosts();
  const ctx = canvas.getContext('2d');
  let lastView: SimView | null = null;

  canvas.addEventListener('mousedown', (e) => {
    if (e.button !== 0 && e.button !== 1) return;
    if (!lastView) return;
    const r = canvas.getBoundingClientRect();
    const b = mapOf(lastView.map).bounds;
    const pos = mapWorld(((e.clientX - r.left) / r.width) * canvas.width, ((e.clientY - r.top) / r.height) * canvas.height, b, canvas.width, canvas.height);
    actions.submit({ ping: { kind: 'goHere', pos, target: null } });
  });

  return {
    canvas,
    reset: () => ghosts.reset(),
    draw(view, pings) {
      lastView = view;
      if (!ctx) return;
      const { width, height } = size();
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      const me = view.heroes.find((h) => h.id === view.localHero);
      const team: PlayerTeam = me?.team ?? 'dawn';
      const map = mapOf(view.map);
      const b = map.bounds;
      const k = width / MAP_ASPECT.width;
      const P = (p: { x: number; y: number; z: number }) => mapPoint(p, b, width, height);
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = 'rgba(12,14,18,0.82)';
      ctx.fillRect(0, 0, width, height);
      ctx.lineCap = 'round';
      // The local bird's assigned lane glows white under its colour for the match's first seconds (D-ARCH-035).
      const glow = startLane(view);
      for (const lane of map.lanes) {
        const width0 = Math.max(2, lane.halfWidth * 2 * (width / (b.max.x - b.min.x)));
        const stroke = (style: string, alpha: number, w: number): void => {
          ctx.strokeStyle = style;
          ctx.globalAlpha = alpha;
          ctx.lineWidth = w;
          ctx.beginPath();
          lane.path.forEach((p, i) => {
            const q = P(p);
            if (i === 0) ctx.moveTo(q.x, q.y);
            else ctx.lineTo(q.x, q.y);
          });
          ctx.stroke();
        };
        if (lane.id === glow) stroke('#ffffff', MAP_STYLE.laneGlowAlpha, width0 + MAP_STYLE.laneGlow * k);
        stroke(hex(LANE_COLOURS[lane.id]), lane.id === glow ? 1 : MAP_STYLE.laneAlpha, width0);
      }
      ctx.globalAlpha = 1;
      const dot = (p: { x: number; y: number; z: number }, r: number, fill: string, ring?: string, alpha = 1): void => {
        const q = P(p);
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(q.x, q.y, r * k, 0, Math.PI * 2);
        ctx.fillStyle = fill;
        ctx.fill();
        if (ring) {
          ctx.lineWidth = MAP_STYLE.ring * k;
          ctx.strokeStyle = ring;
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      };
      const teamCss = (t: string): string => (t === 'dawn' || t === 'dusk' ? hex(TEAM_COLOURS[t].primary) : hex(NEUTRAL_COLOUR));
      for (const e of view.entities) {
        if (!mapVisible(e, team) && e.kind !== 'structure') continue;
        const ring = e.team === team ? hex(ALLY_TEAL) : e.team === 'neutral' ? undefined : hex(ENEMY_RED);
        switch (e.kind) {
          case 'structure': {
            const q = P(e.pos);
            const s = (e.type === 'patron' ? MAP_STYLE.patron : MAP_STYLE.structure) * k;
            ctx.fillStyle = teamCss(e.team);
            ctx.fillRect(q.x - s / 2, q.y - s / 2, s, s);
            if (e.maxHp > 0) {
              ctx.strokeStyle = ring ?? '#fff';
              ctx.lineWidth = MAP_STYLE.ring * k;
              ctx.beginPath();
              ctx.arc(q.x, q.y, s * MAP_STYLE.structureRing, -Math.PI / 2, -Math.PI / 2 + (e.hp / e.maxHp) * Math.PI * 2);
              ctx.stroke();
            }
            break;
          }
          case 'hero':
            if ((e.flags & ViewFlag.Dead) === 0) dot(e.pos, e.id === view.localHero ? MAP_STYLE.me : MAP_STYLE.hero, teamCss(e.team), ring);
            break;
          case 'unit':
            dot(e.pos, e.type === 'roc' ? MAP_STYLE.roc : MAP_STYLE.unit, teamCss(e.team));
            break;
          case 'pickup':
            if (e.type !== 'pod') dot(e.pos, MAP_STYLE.pickup, e.type === 'egg' ? '#ffe9a0' : e.type === 'ember' ? '#ff8a3d' : '#7fd6ff', '#000');
            break;
          default:
            break;
        }
      }
      // Rune and Thicket camp timers sit on their spots while the spot waits to respawn.
      const timer = (pos: { x: number; y: number; z: number }, at: number | null | undefined): void => {
        if (at === null || at === undefined || at <= view.tick) return;
        const q = P(pos);
        ctx.font = `bold ${MAP_STYLE.timerFont * k}px system-ui`;
        ctx.textAlign = 'center';
        ctx.lineWidth = MAP_STYLE.timerStroke * k;
        ctx.strokeStyle = '#000';
        ctx.fillStyle = '#fff';
        const text = String(Math.ceil((at - view.tick) / TICK_RATE));
        ctx.strokeText(text, q.x, q.y);
        ctx.fillText(text, q.x, q.y);
      };
      map.runeSpots.forEach((spot, i) => timer(spot.pos, view.objectives.runeAt?.[i]));
      map.thickets.forEach((camp, i) => timer(camp.pos, view.objectives.campAt?.[i]));
      for (const g of ghosts.update(view, team)) dot(g.pos, MAP_STYLE.ghost, hex(ENEMY_RED), '#000', g.alpha * MAP_STYLE.ghostAlpha);
      // Camera cone: the local hero's facing (yaw 0 faces +z, north).
      const meEnt = view.entities.find((e) => e.id === view.localHero);
      if (meEnt) {
        const q = P(meEnt.pos);
        const reach = MAP_STYLE.coneReach * k;
        const half = Math.PI / MAP_STYLE.coneHalfDivisor;
        // Forward is (sin yaw, cos yaw) in (x, z); on the map x is mirrored and z is up.
        const a = Math.atan2(-Math.cos(meEnt.yaw), -Math.sin(meEnt.yaw));
        ctx.fillStyle = 'rgba(255,255,255,0.18)';
        ctx.beginPath();
        ctx.moveTo(q.x, q.y);
        ctx.arc(q.x, q.y, reach, a - half, a + half);
        ctx.closePath();
        ctx.fill();
      }
      for (const p of pings) {
        const age = (view.seconds - p.at) / PING_S;
        if (age < 0 || age > 1) continue;
        const q = P(p.pos);
        ctx.strokeStyle = PING_CSS[p.kind];
        ctx.lineWidth = 2 * k;
        ctx.globalAlpha = 1 - age;
        ctx.beginPath();
        ctx.arc(q.x, q.y, (MAP_STYLE.pingBase + ((age * MAP_STYLE.pingWave) % MAP_STYLE.pingWrap) * MAP_STYLE.pingGrow) * k, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    },
  };
}
