/** Main menu, hero select, pause and end of match (GDD §12.2, §12.3, §12.10, §12.11). Each returns a fresh element. */
import { HERO_IDS } from '../../sim/core/contracts';
import type { HeroId, ItemDef, MatchTelemetry, PlayerTeam } from '../../sim/core/contracts';
import { HEROES, heroSwatch } from '../../sim/heroes/registry';
import type { AppActions, ScreenContext } from '../app/contracts';
import { ARCHETYPE_LABEL, GRAPH, hex, PERCENT, TEAM_CSS, ULTIMATE_SLOT } from './constants';
import { AP_COSTS } from '../../sim/data/abilities';
import { CONCEDE_AFTER_SECONDS } from '../../sim/data/core';
import { button, el } from './dom';
import { clock } from './model';

const screen = (cls: string, ...children: Element[]): HTMLElement => {
  const s = el(`pu-screen ${cls}`);
  s.append(...children);
  return s;
};

export const menuScreen = (actions: AppActions, openOptions: () => void): HTMLElement => {
  const row = el('pu-btnrow');
  row.append(
    button('Play', () => actions.play('siege')),
    button('Practice Hub', () => actions.play('practice')),
    button('Options', openOptions),
  );
  return screen('pu-menu', el('pu-title', 'h1', undefined, 'PERCH'), el('pu-sub', 'p', undefined, 'Two flocks. One city in the forest.'), row);
};

/** Fill the hover/focus panel with a hero's gun and every ability tier, from the registry (no per-hero branches). */
function describeHero(box: HTMLElement, id: HeroId): void {
  const { def } = HEROES[id];
  box.replaceChildren();
  el('', 'h3', box, `${def.name}, ${ARCHETYPE_LABEL[def.archetype]}`);
  const w = def.weapon;
  const mag = def.stats.magazine;
  el('gun', 'p', box, `${w.name}: ${w.pellets > 1 ? `${w.pellets} pellets, ` : ''}${w.fireRate} shots/s${mag ? `, ${mag} rounds` : ''}, ${w.hitscan ? 'hitscan' : 'projectile'}, range ${w.range} m`);
  def.abilities.forEach((a, i) => {
    const row = el('ab', 'div', box);
    el('', 'b', row, `${i === ULTIMATE_SLOT ? 'Ultimate' : `Ability ${i + 1}`}: ${a.name}`);
    el('', 'p', row, a.description);
    const tiers = el('', 'ul', row);
    a.upgrades.forEach((u, t) => el('', 'li', tiers, `Tier ${t + 1} (${AP_COSTS[t] ?? '?'} AP): ${u.description}`));
  });
}

/** All 24 heroes; only `implemented` ones can be picked (D-ARCH-013). Hover or focus shows the kit. */
export function heroSelectScreen(actions: AppActions, seed: number, mode: 'siege' | 'practice', swap = false): HTMLElement {
  const grid = el('pu-grid');
  const detail = el('pu-hero-detail');
  detail.setAttribute('aria-live', 'polite');
  el('', 'p', detail, 'Hover or focus a bird to read its kit.');
  HERO_IDS.forEach((id) => {
    const { def, implemented } = HEROES[id];
    const card = el('pu-card', 'button', grid);
    card.type = 'button';
    card.style.setProperty('--sw', hex(heroSwatch(id)));
    card.dataset['hero'] = id;
    card.append(el('', 'b', undefined, def.name), el('', 'span', undefined, ARCHETYPE_LABEL[def.archetype]));
    const show = (): void => {
      describeHero(detail, id);
      actions.previewHero?.(id);
    };
    card.addEventListener('mouseenter', show);
    card.addEventListener('focus', show);
    if (implemented === true) {
      card.append(el('', 'em', undefined, 'Pick'));
      card.addEventListener('click', () => actions.startMatch({ hero: id, team: 'dawn', difficulty: 'normal', seed }));
    } else {
      card.append(el('', 'em', undefined, 'Coming soon'));
      card.setAttribute('aria-disabled', 'true');
      card.disabled = true;
    }
  });
  const title = el('pu-h2', 'h2', undefined, 'Choose your bird');
  const sub = el('pu-sub', 'p', undefined, swap ? 'Swap bird: you respawn where you stand with 32 AP and the dummies reset' : mode === 'practice' ? 'Practice Hub: all abilities unlocked, 32 AP, two target dummies' : 'Play: Old Mossmarket, Dawn Flock');
  const body = el('pu-select-body');
  body.append(grid, detail);
  return screen('pu-select', title, sub, body, swap ? button('Back to the hub', actions.resume, 'pu-btn pu-quiet') : button('Back', actions.toMenu, 'pu-btn pu-quiet'));
}

/** GDD §12.10: Concede is open from 15:00 and asks for a second click; before then it is disabled with the reason. */
export function pauseScreen(actions: AppActions, openOptions: () => void, seconds: number, mode: 'siege' | 'practice' = 'siege'): HTMLElement {
  const open = seconds >= CONCEDE_AFTER_SECONDS;
  const concede = button('Concede', () => {
    if (concede.dataset['armed']) actions.concede();
    else {
      concede.dataset['armed'] = 'true';
      concede.textContent = 'Confirm concede';
    }
  });
  concede.disabled = !open;
  const note = el('pu-sub', 'p', undefined, open ? 'Conceding ends the match as a defeat.' :
    `Concede is available from ${clock(CONCEDE_AFTER_SECONDS)} (now ${clock(seconds)}).`);
  note.id = 'pu-concede-note';
  concede.setAttribute('aria-describedby', note.id);
  return screen(
    'pu-pause',
    el('pu-h2', 'h2', undefined, 'Paused'),
    button('Resume', actions.resume),
    ...(mode === 'practice' ? [button('Swap bird', actions.swapBird)] : []),
    button('Options', openOptions),
    concede,
    note,
    button('Quit to menu', actions.toMenu, 'pu-btn pu-quiet'),
  );
}

const FLOCK: Readonly<Record<PlayerTeam, string>> = { dawn: 'Dawn Flock', dusk: 'Dusk Flock' };

function netWorthGraph(t: MatchTelemetry): SVGElement {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', `0 0 ${GRAPH.width} ${GRAPH.height}`);
  svg.setAttribute('class', 'pu-graph');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'Flock net worth over time');
  const max = Math.max(1, ...t.teams.dawn.netWorthCurve, ...t.teams.dusk.netWorthCurve);
  for (const team of ['dawn', 'dusk'] as const) {
    const c = t.teams[team].netWorthCurve;
    const line = document.createElementNS(ns, 'polyline');
    line.setAttribute('fill', 'none');
    line.setAttribute('stroke', TEAM_CSS[team]);
    line.setAttribute('stroke-width', '2');
    line.setAttribute('points', c.map((v, i) => `${(i / Math.max(1, c.length - 1)) * GRAPH.width},${GRAPH.height - (v / max) * GRAPH.inner}`).join(' '));
    svg.append(line);
  }
  return svg;
}

/** Victory or Defeat for the local flock, the winning flock's name, the summary, scoreboard and net worth graph. */
export function endScreen(actions: AppActions, c: ScreenContext): HTMLElement {
  const winner = c.view.winner;
  const me = c.view.heroes.find((h) => h.id === c.view.localHero);
  const verdict = winner === null || !me ? 'Match over' : winner === me.team ? 'Victory' : 'Defeat';
  const head = el(`pu-verdict ${verdict.toLowerCase().replace(' ', '-')}`, 'h2', undefined, verdict);
  if (winner) head.style.color = TEAM_CSS[winner];
  const sub = el('pu-sub', 'p', undefined, `${winner ? FLOCK[winner] : 'Nobody'} wins`);
  const kids: Element[] = [head, sub];
  const t = c.telemetry;
  if (t) {
    kids.push(el('pu-sub', 'p', undefined, `Match length ${clock(t.seconds)}   seed ${t.seed}`));
    const table = el('pu-endtable', 'table');
    const hr = el('', 'tr', table);
    for (const h of ['Hero', 'K/D/A', 'Hero dmg', 'Structure dmg', 'Healing', 'LH/Deny', 'Pods', 'Beak %', 'Items bought']) el('', 'th', hr, h);
    for (const h of t.heroes) {
      const tr = el(h.slot === me?.slot ? 'me' : '', 'tr', table);
      tr.style.setProperty('--team', TEAM_CSS[h.team]);
      const items = h.itemsBought.map((b) => `${catalogueName(c.catalogue, b.item)} ${clock(b.s)}`).join(', ');
      for (const v of [
        `${HEROES[h.heroId].def.name} (${h.team === 'dawn' ? 'Dawn' : 'Dusk'})`,
        `${h.kills}/${h.deaths}/${h.assists}`,
        Math.round(h.damageToHeroes).toLocaleString('en-GB'),
        Math.round(h.damageToStructures).toLocaleString('en-GB'),
        Math.round(h.healing).toLocaleString('en-GB'),
        `${h.lastHits}/${h.denies}`,
        String(h.podsSecured),
        h.gunHits > 0 ? `${Math.round((h.beakShots / h.gunHits) * PERCENT)}%` : '0%',
        items,
      ])
        el('', 'td', tr, v);
    }
    kids.push(table, netWorthGraph(t));
  }
  const row = el('pu-btnrow');
  row.append(button('Play again', () => actions.play(c.mode)), button('Main menu', actions.toMenu, 'pu-btn pu-quiet'));
  kids.push(row);
  return screen('pu-select pu-end', ...kids);
}

const catalogueName = (items: readonly ItemDef[], id: string): string => items.find((i) => i.id === id)?.name ?? id;
