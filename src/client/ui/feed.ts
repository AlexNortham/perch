/**
 * Kill feed (GDD §12.8, D-EP-041, G08, G30): on the left under the scoreboard. Hero kills (killer → victim with small
 * portraits), structure and neutral kills with the killer named ("Dusk Heron"), objective lines and callouts such as
 * "First Blood". Brood Ward changes never appear here (they are an icon on the structure bar).
 */
import type { EntityId, SimEvent, SimView } from '../../sim/core/contracts';
import { HEROES } from '../../sim/heroes/registry';
import type { Frame } from '../app/contracts';
import { FEED_LINES, FEED_OBJECTIVE_S, FEED_S, PING_LABEL, TEAM_CSS } from './constants';
import { el } from './dom';
import { entityName } from './hud-model';
import { portraitFace } from './portraits';
import type { Callout } from './streaks';

interface Line {
  readonly node: HTMLElement;
  until: number;
}

const OBJECTIVE_TEXT: Readonly<Record<string, string>> = {
  eggTaken: 'took the Golden Egg',
  eggDelivered: 'delivered the Golden Egg',
  eggDropped: 'dropped the Golden Egg',
  emberClaimed: 'claimed the Phoenix Ember',
  runeTaken: 'took a Feather rune',
};

export interface Feed {
  readonly root: HTMLElement;
  onEvents(events: readonly SimEvent[], view: SimView, callouts: readonly Callout[]): void;
  update(frame: Frame): void;
  reset(): void;
}

export function createFeed(): Feed {
  const root = el('pu-feed');
  const list = el('pu-feed-list', 'div', root);
  let lines: Line[] = [];
  let clock = 0;

  const add = (parts: (string | HTMLElement)[], cls: string, seconds: number): HTMLElement => {
    const node = el(`pu-line ${cls}`, 'div');
    for (const p of parts) node.append(typeof p === 'string' ? document.createTextNode(p) : p);
    list.prepend(node);
    lines.unshift({ node, until: clock + seconds });
    for (const l of lines.splice(FEED_LINES)) l.node.remove();
    return node;
  };
  const heroOf = (view: SimView, id: EntityId | null) => view.heroes.find((h) => h.id === id);
  const face = (h: { heroId: Parameters<typeof portraitFace>[0]; team: Parameters<typeof portraitFace>[1] }): HTMLElement => {
    const f = el('pu-mini', 'span');
    f.append(portraitFace(h.heroId, h.team));
    return f;
  };
  const dot = (team: string): HTMLElement => {
    const d = el('pu-mini dot', 'span');
    d.style.background = team === 'dawn' || team === 'dusk' ? TEAM_CSS[team] : '#9aa3ad';
    return d;
  };
  const name = (view: SimView, id: EntityId | null): string => {
    const h = heroOf(view, id);
    if (h) return HEROES[h.heroId].def.name;
    const e = id === null ? undefined : view.entities.find((x) => x.id === id);
    return e ? entityName(e) : 'The world';
  };

  return {
    root,
    reset() {
      lines = [];
      list.replaceChildren();
    },
    onEvents(events, view, callouts) {
      for (const e of events) {
        switch (e.type) {
          case 'entity.died': {
            const credit = heroOf(view, e.creditHero);
            const killer = e.killer === null ? undefined : view.entities.find((x) => x.id === e.killer);
            const killerName = credit ? HEROES[credit.heroId].def.name : killer ? entityName(killer) : 'The world';
            const killerMark = credit ? face(credit) : dot(killer?.team ?? 'neutral');
            if (e.victimKind === 'hero') {
              const victim = heroOf(view, e.victim);
              const assists = e.assisters.map((a) => name(view, a));
              add(
                [killerMark, `${killerName}${e.beakShot ? ' ◆' : ''} → `, victim ? face(victim) : '', `${HEROES[e.victimType as keyof typeof HEROES]?.def.name ?? 'A bird'}${assists.length ? `  (+${assists.join(', ')})` : ''}`],
                'kill',
                FEED_S,
              );
            } else if (e.victimKind === 'structure' || e.victimType === 'roc') {
              add([killerMark, `${killerName} → ${entityName({ kind: e.victimKind, team: e.victimTeam, type: e.victimType })}`], 'obj', FEED_OBJECTIVE_S);
            }
            break;
          }
          case 'patron.depleted':
            add(['A Patron has fallen to its last form'], 'obj', FEED_OBJECTIVE_S);
            break;
          case 'structure.state':
            if (e.state === 'phase2') add(['Patron phase two: strike the heart feather'], 'obj', FEED_OBJECTIVE_S);
            break;
          case 'objective': {
            const t = OBJECTIVE_TEXT[e.action];
            if (t) add([`${name(view, e.hero)} ${t}`], 'obj', FEED_OBJECTIVE_S);
            break;
          }
          case 'ping':
            add([`${name(view, e.by)}: ${PING_LABEL[e.kind]}`], 'ping', FEED_S);
            break;
          default:
            break;
        }
      }
      for (const c of callouts) add([`${c.text.toUpperCase()}  ${name(view, c.hero)}`], 'callout', FEED_OBJECTIVE_S);
    },
    update({ dt }) {
      clock += dt;
      lines = lines.filter((l) => {
        if (l.until > clock) return true;
        l.node.remove();
        return false;
      });
    },
  };
}
