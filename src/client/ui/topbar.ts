/**
 * Top centre of the HUD (GDD §12.4): flock net worth, match clock, per-lane structure pips and the objective strip:
 * both Patrons with phase, Brood Ward and gate state, the next enemy structure on each lane, and timers.
 */
import { LANE_IDS, ViewFlag } from '../../sim/core/contracts';
import type { EntityView, LaneId, PlayerTeam, SimView } from '../../sim/core/contracts';
import { TICK_RATE } from '../../sim/data/core';
import { OBJECTIVE_BANNER_LEAD_S, PERCENT, TEAM_CSS, TENTH } from './constants';
import { el } from './dom';
import { clock } from './model';

const PATRON_NAME: Readonly<Record<PlayerTeam, string>> = { dawn: 'Elder Raven', dusk: 'Great Owl' };
const STRUCTURE_LABEL: Readonly<Record<string, string>> = { hawk: 'Hawk', heron: 'Heron', warden: 'Warden', shrine: 'Shrine', patron: 'Patron' };
const LANE_LABEL: Readonly<Record<LaneId, string>> = { hedgerow: 'Hedgerow', riverbank: 'Riverbank', pinewood: 'Pinewood' };
const TEAMS: readonly PlayerTeam[] = ['dawn', 'dusk'];

export interface TopBar {
  readonly root: HTMLElement;
  update(view: SimView): void;
  reset(): void;
}

const structures = (view: SimView, team: PlayerTeam): EntityView[] =>
  view.entities.filter((e) => e.kind === 'structure' && e.team === team && e.structure !== undefined);

/** Patron state line: phase, transition, ward, gate. */
function patronState(e: EntityView, tick: number): string {
  const s = e.structure;
  if (!s) return '';
  const parts = [`Phase ${s.phase}`];
  if (s.transitionUntil !== undefined && s.transitionUntil > tick) parts.push('transforming');
  else if ((e.flags & ViewFlag.Invulnerable) !== 0) parts.push('gated');
  if (s.broodWard) parts.push('Brood Ward');
  if (s.weakPoint) parts.push('heart exposed');
  return parts.join(' / ');
}

export function createTopBar(): TopBar {
  const root = el('pu-top');
  const main = el('pu-top-main', 'div', root);
  const sides = TEAMS.map((team) => {
    const box = el('pu-top-side', 'div');
    box.style.setProperty('--team', TEAM_CSS[team]);
    const worth = el('worth', 'b', box);
    const pips = el('pips', 'div', box);
    return { team, box, worth, pips };
  });
  const clockEl = el('pu-clock', 'div');
  main.append(sides[0]?.box ?? clockEl, clockEl, sides[1]?.box ?? clockEl);
  const strip = el('pu-obj', 'div', root);
  const patrons = TEAMS.map((team) => {
    const box = el('pu-patron', 'div', strip);
    box.style.setProperty('--team', TEAM_CSS[team]);
    box.setAttribute('role', 'progressbar');
    const name = el('nm', 'span', box);
    const bar = el('bar', 'div', box);
    const fill = el('', 'i', bar);
    const state = el('st', 'small', box);
    return { team, box, name, fill, state };
  });
  const lanes = el('pu-lanes', 'div', root);
  const laneChips = LANE_IDS.map((id) => {
    const chip = el('pu-lane', 'div', lanes);
    const nm = el('nm', 'span', chip);
    const bar = el('bar', 'div', chip);
    const fill = el('', 'i', bar);
    return { id, chip, nm, fill };
  });
  const banners = el('pu-banners', 'div', root);
  const pipMax = new Map<string, number>();

  return {
    root,
    reset: () => pipMax.clear(),
    update(view) {
      clockEl.textContent = clock(view.seconds);
      const me = view.heroes.find((h) => h.id === view.localHero);
      const mine: PlayerTeam = me?.team ?? 'dawn';
      const enemy: PlayerTeam = mine === 'dawn' ? 'dusk' : 'dawn';
      for (const s of sides) {
        s.worth.textContent = `${s.team === 'dawn' ? 'DAWN' : 'DUSK'} ${view.teams[s.team].netWorth.toLocaleString('en-GB')}`;
        const list = structures(view, s.team).filter((e) => e.structure?.lane !== null && e.structure?.lane !== undefined);
        const text = LANE_IDS.map((lane) => {
          const alive = list.filter((e) => e.structure?.lane === lane).length;
          const key = `${s.team}:${lane}`;
          const max = Math.max(pipMax.get(key) ?? 0, alive);
          pipMax.set(key, max);
          return '▮'.repeat(alive) + '▯'.repeat(max - alive);
        }).join('  ');
        if (s.pips.textContent !== text) s.pips.textContent = text;
      }
      for (const p of patrons) {
        const e = structures(view, p.team).find((x) => x.structure?.type === 'patron');
        p.box.style.display = e ? '' : 'none';
        if (!e) continue;
        const own = p.team === mine;
        p.name.textContent = `${PATRON_NAME[p.team]}${own ? ' (yours)' : ''}`;
        const frac = e.maxHp > 0 ? Math.max(0, e.hp / e.maxHp) : 0;
        p.fill.style.width = `${Math.round(frac * PERCENT * TENTH) / TENTH}%`;
        p.state.textContent = `${Math.ceil(e.hp).toLocaleString('en-GB')} / ${Math.ceil(e.maxHp).toLocaleString('en-GB')}  ${patronState(e, view.tick)}`;
        p.box.setAttribute('aria-label', `${PATRON_NAME[p.team]} health`);
        p.box.setAttribute('aria-valuemin', '0');
        p.box.setAttribute('aria-valuemax', String(Math.ceil(e.maxHp)));
        p.box.setAttribute('aria-valuenow', String(Math.ceil(e.hp)));
        p.box.classList.toggle('gated', (e.flags & ViewFlag.Invulnerable) !== 0);
      }
      // The enemy structure each lane's push meets first: the nearest to our own Patron, with its gate.
      const home = structures(view, mine).find((x) => x.structure?.type === 'patron')?.pos;
      const foes = structures(view, enemy);
      for (const c of laneChips) {
        const here = foes.filter((e) => e.structure?.lane === c.id);
        const front = home ? here.sort((a, b) => Math.hypot(a.pos.x - home.x, a.pos.z - home.z) - Math.hypot(b.pos.x - home.x, b.pos.z - home.z))[0] : here[0];
        c.chip.style.display = front ? '' : 'none';
        if (!front) continue;
        const gated = (front.flags & ViewFlag.Invulnerable) !== 0;
        c.chip.classList.toggle('gated', gated);
        c.nm.textContent = `${LANE_LABEL[c.id]} ${STRUCTURE_LABEL[front.structure?.type ?? ''] ?? ''}${gated ? ' (gated)' : ''}${front.structure?.broodWard ? ' (ward)' : ''}`;
        c.fill.style.width = `${Math.round((front.maxHp > 0 ? front.hp / front.maxHp : 0) * PERCENT * TENTH) / TENTH}%`;
      }
      const o = view.objectives;
      const timer = (label: string, at: number | null): string | null =>
        at !== null && at > view.tick && at - view.tick <= OBJECTIVE_BANNER_LEAD_S * TICK_RATE ? `${label} ${clock((at - view.tick) / TICK_RATE)}` : null;
      const text = [timer('Egg in', o.eggAt), timer('Runes in', o.runesAt), timer('Roc in', o.rocAt)].filter(Boolean).join('   ');
      if (banners.textContent !== text) banners.textContent = text;
    },
  };
}
