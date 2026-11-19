/**
 * The always-on top scoreboard (D-EP-041, G01, G02): the clock between the two flocks' Seeds and the lead, six round
 * portraits per side with a health bar, Seeds and respawn countdown, a compact objective strip, and the contextual
 * objective bars (a structure or the Roc only while the local bird is near it or has just hit it).
 */
import { LANE_IDS, ViewFlag } from '../../sim/core/contracts';
import type { EntityView, HeroView, PlayerTeam, SimEvent, SimView } from '../../sim/core/contracts';
import { TICK_RATE } from '../../sim/data/core';
import { HEROES } from '../../sim/heroes/registry';
import { TEAM_CSS } from './constants';
import { attr, cell, display, el, flag, pct, text } from './dom';
import { entityName, leadPercent, MAX_OBJECTIVE_BARS, nextObjective, objectiveBars } from './hud-model';
import { clock, teamBit } from './model';
import { portraitFace } from './portraits';
import type { Streaks } from './streaks';

const PER_SIDE = 6;
/** Rekindle turns red this long before it lapses. */
const REKINDLE_WARN_S = 30;
/** An ally under this share of max health gets the red critical tag. */
const CRITICAL_SHARE = 0.25;
const SIDES = ['own', 'enemy'] as const;
type Side = (typeof SIDES)[number];
const num = (n: number): string => Math.round(n).toLocaleString('en-GB');

export interface TopBar {
  readonly root: HTMLElement;
  onEvents(events: readonly SimEvent[], view: SimView): void;
  update(view: SimView): void;
  /** A new match: forget the portraits and what was hit. */
  reset(): void;
}

interface Portrait {
  readonly node: HTMLElement;
  hero: HeroView;
  readonly set: (h: HeroView, e: EntityView | undefined, view: SimView, side: Side, streak: number, seen: boolean, exposed: boolean) => void;
}

function buildPortrait(h: HeroView, side: Side, parent: HTMLElement): Portrait {
  const node = el('pu-portrait', 'div', parent);
  node.dataset['portrait'] = '';
  node.dataset['side'] = side;
  node.dataset['hero'] = h.heroId;
  node.style.setProperty('--team', TEAM_CSS[h.team]);
  node.title = HEROES[h.heroId].def.name;
  const frame = el('frame', 'div', node);
  frame.append(portraitFace(h.heroId, h.team));
  const respawn = el('', 'b', frame);
  respawn.dataset['field'] = 'respawn';
  const bar = el('hp', 'div', node);
  bar.setAttribute('role', 'progressbar');
  bar.setAttribute('aria-label', `${HEROES[h.heroId].def.name} health`);
  bar.setAttribute('aria-valuemin', '0');
  const fill = el('', 'i', bar);
  const seeds = el('seeds', 'span', node);
  seeds.dataset['field'] = 'seeds';
  const eye = el('eye', 'span', node);
  eye.title = 'Seen by the enemy flock';
  const tag = el('tag', 'em', node);
  const streakTag = el('streak', 'em', node);
  const setBarMax = attr(bar, 'aria-valuemax');
  const setBarNow = attr(bar, 'aria-valuenow');
  const setFill = cell((v: string) => void (fill.style.height = v));
  const setSeeds = text(seeds);
  const setDead = cell((v: boolean) => {
    node.dataset['dead'] = String(v);
    node.classList.toggle('dead', v);
    if (!v) respawn.remove();
    else frame.append(respawn);
  });
  const setRespawn = text(respawn);
  const setUnseen = flag(node, 'unseen');
  const setEye = display(eye);
  const setTag = text(tag);
  const setStreak = text(streakTag);
  const setCrit = flag(node, 'crit');
  const setLocal = flag(node, 'me');
  node.dataset['dead'] = 'false';
  respawn.remove();
  return {
    node,
    hero: h,
    set(hero, e, view, s, streak, seen, exposed) {
      const dead = hero.respawnAt !== null || (e !== undefined && (e.flags & ViewFlag.Dead) !== 0);
      const hp = e?.hp ?? 0;
      const max = e?.maxHp ?? 0;
      setBarMax(String(Math.ceil(max)));
      setBarNow(String(Math.ceil(dead ? 0 : hp)));
      setFill(pct(max > 0 && !dead ? hp / max : 0));
      setSeeds(num(hero.netWorth));
      setDead(dead);
      if (dead) setRespawn(String(hero.respawnAt === null ? 0 : Math.max(0, Math.ceil((hero.respawnAt - view.tick) / TICK_RATE))));
      setUnseen(s === 'enemy' && !seen && !dead);
      setEye(s === 'own' && exposed && !dead);
      const crit = s === 'own' && !dead && max > 0 && hp / max < CRITICAL_SHARE;
      setCrit(crit);
      setTag(crit ? 'CRITICAL' : '');
      setStreak(streak >= 2 ? `x${streak}` : '');
      setLocal(hero.id === view.localHero);
    },
  };
}

export function createTopBar(streaks: Streaks): TopBar {
  const root = el('pu-top');
  root.setAttribute('role', 'region');
  root.setAttribute('aria-label', 'Scoreboard');
  const row = el('pu-top-row', 'div', root);
  const flocks = {
    own: el('pu-flock', 'div', row),
    enemy: el('pu-flock', 'div'),
  };
  const mid = el('pu-mid', 'div', row);
  row.append(flocks.enemy);
  flocks.own.dataset['side'] = 'own';
  flocks.enemy.dataset['side'] = 'enemy';

  const clockEl = el('clock', 'div', mid);
  clockEl.dataset['field'] = 'clock';
  const pills = el('pills', 'div', mid);
  const makePill = (side: Side): HTMLElement => {
    const p = el('pill', 'div', pills);
    p.dataset['field'] = 'flock-seeds';
    p.dataset['side'] = side;
    return p;
  };
  const pill: Record<Side, HTMLElement> = { own: makePill('own'), enemy: makePill('enemy') };
  const lead = el('lead', 'div', mid);
  const windowEl = el('window', 'div', mid);
  const rekindleEl = el('rekindle', 'div', mid);
  const setClock = text(clockEl);
  const setPill = { own: text(pill.own), enemy: text(pill.enemy) };
  const setLead = text(lead);
  const setWindow = text(windowEl);
  const setRekindle = text(rekindleEl);
  const setWarn = flag(rekindleEl, 'warn');

  // The compact objective strip under the portraits: both Patrons with phase, and each lane's standing towers.
  const strip = el('pu-strip', 'div', root);
  const patronChips = SIDES.map((side) => {
    const chip = el('patron', 'div', strip);
    chip.dataset['side'] = side;
    const nm = el('nm', 'span', chip);
    const bar = el('bar', 'div', chip);
    const fill = el('', 'i', bar);
    const ph = el('ph', 'small', chip);
    return { side, chip, nm: text(nm), fill: cell((v: string) => void (fill.style.width = v)), ph: text(ph) };
  });
  const lanes = el('lanes', 'div', strip);
  strip.insertBefore(lanes, patronChips[1]?.chip ?? null);
  const laneChips = LANE_IDS.map((id) => {
    const chip = el('lane', 'div', lanes);
    el('nm', 'span', chip, id.slice(0, 1).toUpperCase());
    return { id, set: text(el('pips', 'span', chip)) };
  });
  const bars = el('pu-bars', 'div', root);
  const barNodes = Array.from({ length: MAX_OBJECTIVE_BARS }, () => {
    const b = el('obj', 'div', bars);
    const head = el('head', 'div', b);
    const nm = el('nm', 'span', head);
    const ward = el('ward', 'i', head);
    ward.title = 'Brood Ward raised';
    ward.textContent = 'WARD';
    const track = el('track', 'div', b);
    const fill = el('', 'i', track);
    track.setAttribute('role', 'progressbar');
    return {
      b,
      show: display(b),
      nm: text(nm),
      ward: display(ward),
      wide: flag(b, 'wide'),
      gated: flag(b, 'gated'),
      own: flag(b, 'own'),
      fill: cell((v: string) => void (fill.style.width = v)),
      track,
    };
  });
  barNodes.forEach((n) => n.show(false));

  let portraits: { own: Portrait[]; enemy: Portrait[] } = { own: [], enemy: [] };
  let roster = '';
  /** Structures and the Roc the local bird hit, and when (view seconds). */
  const hitAt = new Map<number, number>();
  const pipMax = new Map<string, number>();

  const rebuild = (view: SimView, mine: PlayerTeam): void => {
    flocks.own.replaceChildren();
    flocks.enemy.replaceChildren();
    portraits = { own: [], enemy: [] };
    for (const side of SIDES) {
      const list = view.heroes.filter((h) => (side === 'own') === (h.team === mine)).slice(0, PER_SIDE);
      portraits[side] = list.map((h) => buildPortrait(h, side, flocks[side]));
    }
  };

  const sidePills = (view: SimView, mine: PlayerTeam): void => {
    const enemy: PlayerTeam = mine === 'dawn' ? 'dusk' : 'dawn';
    for (const side of SIDES) {
      const team = side === 'own' ? mine : enemy;
      pill[side].style.setProperty('--team', TEAM_CSS[team]);
    }
    setPill.own(num(view.teams[mine].netWorth));
    setPill.enemy(num(view.teams[enemy].netWorth));
  };

  return {
    root,
    reset() {
      roster = '';
      hitAt.clear();
      pipMax.clear();
    },
    onEvents(events, view) {
      for (const e of events) {
        if (e.type !== 'damage.applied' || e.source !== view.localHero) continue;
        if (e.targetKind === 'structure' || view.entities.find((x) => x.id === e.target)?.type === 'roc') hitAt.set(e.target, view.seconds);
      }
    },
    update(view) {
      const me = view.heroes.find((h) => h.id === view.localHero);
      const mine: PlayerTeam = me?.team ?? 'dawn';
      const enemy: PlayerTeam = mine === 'dawn' ? 'dusk' : 'dawn';
      const key = view.heroes.map((h) => h.id).join(',') + mine;
      if (key !== roster) {
        roster = key;
        rebuild(view, mine);
      }
      setClock(clock(view.seconds));
      sidePills(view, mine);
      const l = leadPercent(view.teams[mine].netWorth, view.teams[enemy].netWorth);
      lead.dataset['side'] = l.side ?? '';
      setLead(l.side === null ? '' : `+${l.pct}%`);
      setWindow(nextObjective(view.objectives, view.tick) ?? '');
      const rk = view.teams[mine].rekindle;
      const rkLeft = rk && rk.charges > 0 ? Math.max(0, (rk.until - view.tick) / TICK_RATE) : 0;
      setRekindle(rkLeft > 0 && rk ? `Rekindle x${rk.charges}  ${clock(rkLeft)}` : '');
      setWarn(rkLeft > 0 && rkLeft <= REKINDLE_WARN_S);

      const byId = new Map<number, EntityView>();
      for (const e of view.entities) if (e.kind === 'hero') byId.set(e.id, e);
      for (const side of SIDES) {
        for (const p of portraits[side]) {
          const h = view.heroes.find((x) => x.id === p.hero.id) ?? p.hero;
          const e = byId.get(h.id);
          const seen = e !== undefined && (e.seenBy & teamBit(mine)) !== 0;
          const exposed = e !== undefined && (e.seenBy & teamBit(enemy)) !== 0;
          p.set(h, e, view, side, streaks.of(h.id), seen, exposed);
        }
      }

      // Objective strip: Patron health and phase, each lane's standing towers.
      const structures = view.entities.filter((e) => e.kind === 'structure' && e.structure !== undefined);
      for (const c of patronChips) {
        const team = c.side === 'own' ? mine : enemy;
        const e = structures.find((x) => x.team === team && x.structure?.type === 'patron');
        c.chip.style.display = e ? '' : 'none';
        if (!e) continue;
        c.nm(entityName(e));
        c.fill(pct(e.maxHp > 0 ? e.hp / e.maxHp : 0));
        c.ph(`${(e.flags & ViewFlag.Invulnerable) !== 0 ? 'gated' : `P${e.structure?.phase ?? 1}`}${e.structure?.broodWard ? ' ◈' : ''}`);
      }
      for (const c of laneChips) {
        const mark = (team: PlayerTeam): string => {
          const alive = structures.filter((e) => e.team === team && e.structure?.lane === c.id && e.structure.type !== 'patron').length;
          const k = `${team}:${c.id}`;
          const max = Math.max(pipMax.get(k) ?? 0, alive);
          pipMax.set(k, max);
          return '▮'.repeat(alive) + '▯'.repeat(max - alive);
        };
        c.set(`${mark(mine)} | ${mark(enemy)}`);
      }

      // Contextual objective bars.
      const shown = objectiveBars(view, hitAt);
      barNodes.forEach((n, i) => {
        const b = shown[i];
        n.show(b !== undefined);
        if (!b) return;
        n.nm(b.name.toUpperCase());
        n.fill(pct(b.maxHp > 0 ? b.hp / b.maxHp : 0));
        n.ward(b.ward);
        n.wide(b.wide);
        n.gated(b.gated);
        n.own(b.own);
        n.track.setAttribute('aria-label', `${b.name} health`);
        n.track.setAttribute('aria-valuemin', '0');
        n.track.setAttribute('aria-valuemax', String(Math.ceil(b.maxHp)));
        n.track.setAttribute('aria-valuenow', String(Math.ceil(b.hp)));
      });
    },
  };
}
