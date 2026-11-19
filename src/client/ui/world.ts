/** World-anchored overlay: damage and heal numbers, ping markers and the Practice Hub dummy labels. */
import type { PingKind, SimEvent, SimView, Vec3 } from '../../sim/core/contracts';
import type { AppActions, Frame, Settings } from '../app/contracts';
import {
  DAMAGE_NUMBER_MERGE_S,
  DAMAGE_NUMBER_RISE_M,
  DAMAGE_NUMBER_S,
  HEALTH_CSS,
  HEAL_NUMBER_LIFT_M,
  MIN_HEAL_SHOWN,
  NUMBER_FONT_PX,
  NUMBER_CSS,
  PING_CSS,
  PING_LABEL,
  PING_S,
} from './constants';
import { el } from './dom';
import { damageNumberStyle, dummies } from './model';

export interface PingMark {
  readonly pos: Vec3;
  readonly kind: PingKind;
  /** view.seconds when placed. */
  readonly at: number;
}

interface FloatingNumber {
  readonly node: HTMLElement;
  readonly pos: Vec3;
  readonly target: number;
  amount: number;
  age: number;
}

export interface WorldLayer {
  readonly root: HTMLElement;
  readonly pings: PingMark[];
  onEvents(events: readonly SimEvent[], view: SimView): void;
  update(frame: Frame): void;
  setSettings(s: Settings): void;
  setPractice(on: boolean): void;
  reset(): void;
}

const LABEL_LIFT_M = 2.6;
const MARK_LIFT_M = 1.2;

export function createWorldLayer(actions: AppActions): WorldLayer {
  const root = el('pu-world');
  let showNumbers = true;
  let practice = false;
  let floats: FloatingNumber[] = [];
  const pings: PingMark[] = [];
  const pingNodes: HTMLElement[] = [];
  const labels = new Map<number, HTMLElement>();

  const spawn = (view: SimView, target: number, pos: Vec3, amount: number, colour: string, scale: number): void => {
    const merged = floats.find((f) => f.target === target && f.age < DAMAGE_NUMBER_MERGE_S && f.node.style.color === colour);
    if (merged) {
      merged.amount += amount;
      merged.node.textContent = String(Math.round(merged.amount));
      return;
    }
    void view;
    const node = el('pu-num', 'div', root, String(Math.round(amount)));
    node.style.color = colour;
    node.style.fontSize = `${Math.round(NUMBER_FONT_PX * scale)}px`;
    floats.push({ node, pos, target, amount, age: 0 });
  };

  return {
    root,
    pings,
    setSettings(s) {
      showNumbers = s.damageNumbers !== false;
    },
    setPractice(on) {
      practice = on;
      if (on) return;
      for (const n of labels.values()) n.remove();
      labels.clear();
    },
    reset() {
      for (const f of floats) f.node.remove();
      floats = [];
      pings.length = 0;
    },
    onEvents(events, view) {
      const me = view.localHero;
      for (const e of events) {
        if (e.type === 'damage.applied' && showNumbers && me !== null && e.source === me && e.target !== me) {
          const s = damageNumberStyle(e, NUMBER_CSS);
          spawn(view, e.target, e.pos, e.amount, s.colour, s.scale);
        } else if (e.type === 'heal.applied' && showNumbers && me !== null && (e.source === me || e.target === me) && e.amount >= MIN_HEAL_SHOWN) {
          const t = view.entities.find((x) => x.id === e.target);
          if (t) spawn(view, e.target, { x: t.pos.x, y: t.pos.y + HEAL_NUMBER_LIFT_M, z: t.pos.z }, e.amount, HEALTH_CSS, 1);
        } else if (e.type === 'ping' && e.team === view.heroes.find((h) => h.id === me)?.team) {
          pings.push({ pos: e.pos, kind: e.kind, at: view.seconds });
        }
      }
    },
    update({ curr, dt }) {
      for (const f of floats) f.age += dt;
      floats = floats.filter((f) => {
        if (f.age < DAMAGE_NUMBER_S) return true;
        f.node.remove();
        return false;
      });
      for (const f of floats) {
        const t = f.age / DAMAGE_NUMBER_S;
        const p = actions.project({ x: f.pos.x, y: f.pos.y + DAMAGE_NUMBER_RISE_M * t, z: f.pos.z });
        f.node.style.display = p ? '' : 'none';
        if (p) f.node.style.transform = `translate(${p.x}px,${p.y}px) translate(-50%,-50%)`;
        f.node.style.opacity = String(1 - t * t);
      }

      while (pings.length > 0 && curr.seconds - (pings[0]?.at ?? 0) > PING_S) pings.shift();
      const me = curr.entities.find((e) => e.id === curr.localHero);
      pings.forEach((p, i) => {
        const node = pingNodes[i] ?? (pingNodes[i] = el('pu-wping', 'div', root));
        const q = actions.project({ x: p.pos.x, y: p.pos.y + MARK_LIFT_M, z: p.pos.z });
        node.style.display = q ? '' : 'none';
        if (!q) return;
        const dist = me ? Math.round(Math.hypot(p.pos.x - me.pos.x, p.pos.z - me.pos.z)) : 0;
        node.textContent = `${PING_LABEL[p.kind]} ${dist} m`;
        node.style.color = PING_CSS[p.kind];
        node.style.transform = `translate(${q.x}px,${q.y}px) translate(-50%,-100%)`;
      });
      for (let i = pings.length; i < pingNodes.length; i++) pingNodes[i]?.remove();
      pingNodes.length = pings.length;

      const live = new Set<number>();
      if (practice) {
        for (const d of dummies(curr)) {
          live.add(d.id);
          const e = curr.entities.find((x) => x.id === d.id);
          if (!e) continue;
          let node = labels.get(d.id);
          if (!node) labels.set(d.id, (node = el('pu-dlabel', 'div', root)));
          node.setAttribute('aria-hidden', 'true');
          node.classList.toggle('enemy', d.label === 'Enemy dummy');
          const q = actions.project({ x: e.pos.x, y: e.pos.y + LABEL_LIFT_M, z: e.pos.z });
          node.style.display = q ? '' : 'none';
          node.textContent = `${d.label}  ${Math.ceil(d.hp)} / ${Math.ceil(d.maxHp)}`;
          if (q) node.style.transform = `translate(${q.x}px,${q.y}px) translate(-50%,-100%)`;
        }
      }
      for (const [id, n] of labels) {
        if (live.has(id)) continue;
        n.remove();
        labels.delete(id);
      }
    },
  };
}
