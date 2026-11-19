/** Tab scoreboard (GDD §12.7): two flock tables from the roster plus event totals counted as the match runs. */
import type { ItemDef, PlayerTeam, SimEvent, SimView } from '../../sim/core/contracts';
import { HEROES } from '../../sim/heroes/registry';
import { SCOREBOARD_REFRESH_TICKS, TEAM_CSS } from './constants';
import { el } from './dom';
import { clock, scoreRows } from './model';

interface Totals {
  structures: number;
  eggs: number;
  embers: number;
}

export interface Scoreboard {
  readonly root: HTMLElement;
  setVisible(v: boolean): void;
  isVisible(): boolean;
  setContext(catalogue: readonly ItemDef[], seed: number): void;
  onEvents(events: readonly SimEvent[], view: SimView): void;
  update(view: SimView): void;
  reset(): void;
}

const TEAMS: readonly PlayerTeam[] = ['dawn', 'dusk'];
const fresh = (): Record<PlayerTeam, Totals> => ({ dawn: { structures: 0, eggs: 0, embers: 0 }, dusk: { structures: 0, eggs: 0, embers: 0 } });

export function createScoreboard(): Scoreboard {
  const root = el('pu-score');
  root.setAttribute('role', 'region');
  root.setAttribute('aria-label', 'Scoreboard');
  root.hidden = true;
  const header = el('pu-score-head', 'div', root);
  const tables = el('pu-score-tables', 'div', root);
  let catalogue: readonly ItemDef[] = [];
  let seed = 0;
  let totals = fresh();
  let sig = '';

  const itemName = (id: string): string => catalogue.find((c) => c.id === id)?.name ?? id;

  return {
    root,
    setVisible: (v) => void (root.hidden = !v),
    isVisible: () => !root.hidden,
    setContext(c, s) {
      catalogue = c;
      seed = s;
    },
    reset() {
      totals = fresh();
      sig = '';
    },
    onEvents(events) {
      for (const e of events) {
        // A team's structure falling counts for the other flock; `team` on the objective event is the scorer.
        if (e.type === 'entity.died' && e.victimKind === 'structure' && (e.victimTeam === 'dawn' || e.victimTeam === 'dusk'))
          totals[e.victimTeam === 'dawn' ? 'dusk' : 'dawn'].structures++;
        else if (e.type === 'objective' && (e.team === 'dawn' || e.team === 'dusk')) {
          if (e.action === 'eggDelivered') totals[e.team].eggs++;
          else if (e.action === 'emberClaimed') totals[e.team].embers++;
        }
      }
    },
    update(view) {
      if (root.hidden) return;
      const key = `${Math.floor(view.tick / SCOREBOARD_REFRESH_TICKS)}`;
      if (key === sig) return;
      sig = key;
      header.textContent = `${clock(view.seconds)}   seed ${seed}`;
      tables.replaceChildren();
      for (const team of TEAMS) {
        const box = el('pu-score-team', 'div', tables);
        box.style.setProperty('--team', TEAM_CSS[team]);
        const t = view.teams[team];
        el('', 'h3', box, `${team === 'dawn' ? 'Dawn' : 'Dusk'} Flock   ${t.netWorth.toLocaleString('en-GB')}`);
        const table = el('', 'table', box);
        const head = el('', 'tr', table);
        for (const c of ['Hero', 'Lv', 'K/D/A', 'Net worth', 'LH/Deny', 'Items']) el('', 'th', head, c);
        for (const r of scoreRows(view, team)) {
          const tr = el(r.local ? 'me' : '', 'tr', table);
          const h = r.hero;
          el('', 'td', tr, `${HEROES[h.heroId].def.name}${r.respawn !== null ? `  (respawn ${r.respawn}s)` : ''}`);
          el('', 'td', tr, String(h.level));
          el('', 'td', tr, `${h.kills}/${h.deaths}/${h.assists}`);
          el('', 'td', tr, h.netWorth.toLocaleString('en-GB'));
          el('', 'td', tr, `${h.lastHits}/${h.denies}`);
          el('items', 'td', tr, h.items.map((o) => itemName(o.item)).join(', '));
          if (r.respawn !== null) tr.classList.add('dead');
        }
        const g = totals[team];
        el('foot', 'p', box, `Kills ${t.kills}   Structures destroyed ${g.structures}   Eggs delivered ${g.eggs}   Ember claims ${g.embers}`);
      }
    },
  };
}
