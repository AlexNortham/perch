/**
 * Minimap and big map (GDD §12.5): one canvas painter, north-up with east at the left so Dawn's base is at the
 * bottom. Enemies follow the map-visibility bits (mapSeenBy), last-seen enemy heroes fade as ghosts, pings pulse.
 */
import type { MapData, PlayerTeam, SimView } from '../../sim/core/contracts';
import { loadMap } from '../../sim/world/map';
import type { AppActions } from '../app/contracts';
import { ALLY_TEAL, ENEMY_RED, LANE_COLOURS, NEUTRAL_COLOUR, TEAM_COLOURS } from '../app/palette';
import { hex, PING_CSS, PING_S } from './constants';
import { el } from './dom';
import { createGhosts, mapPoint, mapVisible, mapWorld } from './model';
import type { PingMark } from './world';

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
      const k = width / 260;
      const P = (p: { x: number; y: number; z: number }) => mapPoint(p, b, width, height);
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = 'rgba(12,14,18,0.82)';
      ctx.fillRect(0, 0, width, height);
      ctx.lineCap = 'round';
      for (const lane of map.lanes) {
        ctx.strokeStyle = hex(LANE_COLOURS[lane.id]);
        ctx.globalAlpha = 0.55;
        ctx.lineWidth = Math.max(2, lane.halfWidth * 2 * (width / (b.max.x - b.min.x)));
        ctx.beginPath();
        lane.path.forEach((p, i) => {
          const q = P(p);
          if (i === 0) ctx.moveTo(q.x, q.y);
          else ctx.lineTo(q.x, q.y);
        });
        ctx.stroke();
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
          ctx.lineWidth = 1.5 * k;
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
            const s = (e.type === 'patron' ? 7 : 4.5) * k;
            ctx.fillStyle = teamCss(e.team);
            ctx.fillRect(q.x - s / 2, q.y - s / 2, s, s);
            if (e.maxHp > 0) {
              ctx.strokeStyle = ring ?? '#fff';
              ctx.lineWidth = 1.5 * k;
              ctx.beginPath();
              ctx.arc(q.x, q.y, s * 0.85, -Math.PI / 2, -Math.PI / 2 + (e.hp / e.maxHp) * Math.PI * 2);
              ctx.stroke();
            }
            break;
          }
          case 'hero':
            if ((e.flags & 0x1000) === 0) dot(e.pos, e.id === view.localHero ? 4.5 : 3.5, teamCss(e.team), ring);
            break;
          case 'unit':
            dot(e.pos, e.type === 'roc' ? 5 : 1.6, teamCss(e.team));
            break;
          case 'pickup':
            if (e.type !== 'pod') dot(e.pos, 3, e.type === 'egg' ? '#ffe9a0' : e.type === 'ember' ? '#ff8a3d' : '#7fd6ff', '#000');
            break;
          default:
            break;
        }
      }
      for (const g of ghosts.update(view, team)) dot(g.pos, 3.5, hex(ENEMY_RED), '#000', g.alpha * 0.6);
      // Camera cone: the local hero's facing (yaw 0 faces +z, north).
      const meEnt = view.entities.find((e) => e.id === view.localHero);
      if (meEnt) {
        const q = P(meEnt.pos);
        const reach = 22 * k;
        const half = Math.PI / 5;
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
        ctx.arc(q.x, q.y, (4 + ((age * 12) % 8) * 1.5) * k, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    },
  };
}
