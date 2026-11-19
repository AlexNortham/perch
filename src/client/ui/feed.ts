/** Kill feed (GDD §12.8): hero kills, objective lines and ping text, newest on top, plus allies' respawn timers. */
import type { SimEvent, SimView } from '../../sim/core/contracts';
import { HEROES } from '../../sim/heroes/registry';
import type { Frame } from '../app/contracts';
import { FEED_LINES, FEED_OBJECTIVE_S, FEED_S, PING_LABEL } from './constants';
import { el } from './dom';
import { respawnSeconds } from './display';

interface Line {
  readonly node: HTMLElement;
  until: number;
}

const heroName = (view: SimView, id: number | null): string => {
  const h = view.heroes.find((x) => x.id === id);
  return h ? HEROES[h.heroId].def.name : 'The world';
};
const STRUCTURE_NAME: Readonly<Record<string, string>> = {
  hawk: 'Sentinel Hawk',
  heron: 'Stilt Heron',
  warden: 'Nest Warden',
  shrine: 'Roost Shrine',
  patron: 'Patron',
  roc: 'The Roc',
};
const OBJECTIVE_TEXT: Readonly<Record<string, string>> = {
  eggTaken: 'took the Golden Egg',
  eggDelivered: 'delivered the Golden Egg',
  eggDropped: 'dropped the Golden Egg',
  emberClaimed: 'claimed the Phoenix Ember',
  runeTaken: 'took a Feather rune',
};

export interface Feed {
  readonly root: HTMLElement;
  onEvents(events: readonly SimEvent[], view: SimView): void;
  update(frame: Frame): void;
  reset(): void;
}

export function createFeed(): Feed {
  const root = el('pu-feed');
  const list = el('pu-feed-list', 'div', root);
  const dead = el('pu-feed-dead', 'div', root);
  let lines: Line[] = [];
  let clock = 0;

  const add = (content: string, cls: string, seconds: number): void => {
    const node = el(`pu-line ${cls}`, 'div', undefined, content);
    list.prepend(node);
    lines.unshift({ node, until: clock + seconds });
    for (const l of lines.splice(FEED_LINES)) l.node.remove();
  };

  return {
    root,
    reset() {
      lines = [];
      list.replaceChildren();
    },
    onEvents(events, view) {
      for (const e of events) {
        switch (e.type) {
          case 'entity.died':
            if (e.victimKind === 'hero') {
              const killer = heroName(view, e.creditHero);
              const assists = e.assisters.map((a) => heroName(view, a));
              add(`${killer}${e.beakShot ? ' ◆' : ''} → ${HEROES[e.victimType as keyof typeof HEROES]?.def.name ?? 'A bird'}${assists.length ? `  (+${assists.join(', ')})` : ''}`, 'kill', FEED_S);
            } else if (e.victimKind === 'structure' || e.victimType === 'roc') add(`${STRUCTURE_NAME[e.victimType] ?? 'Structure'} destroyed`, 'obj', FEED_OBJECTIVE_S);
            break;
          case 'patron.depleted':
            add('A Patron has fallen to its last form', 'obj', FEED_OBJECTIVE_S);
            break;
          case 'structure.state':
            if (e.state === 'phase2') add('Patron phase two: strike the heart feather', 'obj', FEED_OBJECTIVE_S);
            else if (e.state === 'wardUp') add('Brood Ward raised', 'obj', FEED_OBJECTIVE_S);
            else if (e.state === 'wardDown') add('Brood Ward down', 'obj', FEED_OBJECTIVE_S);
            break;
          case 'objective': {
            const t = OBJECTIVE_TEXT[e.action];
            if (t) add(`${heroName(view, e.hero)} ${t}`, 'obj', FEED_OBJECTIVE_S);
            break;
          }
          case 'ping':
            add(`${heroName(view, e.by)}: ${PING_LABEL[e.kind]}`, 'ping', FEED_S);
            break;
          default:
            break;
        }
      }
    },
    update({ curr, dt }) {
      clock += dt;
      lines = lines.filter((l) => {
        if (l.until > clock) return true;
        l.node.remove();
        return false;
      });
      const me = curr.heroes.find((h) => h.id === curr.localHero);
      const timers = curr.heroes
        .filter((h) => me && h.team === me.team && h.id !== me.id && h.respawnAt !== null)
        .map((h) => `${HEROES[h.heroId].def.name} ${respawnSeconds(h.respawnAt, curr.tick) ?? 0}s`);
      const s = timers.join('   ');
      if (dead.textContent !== s) dead.textContent = s;
    },
  };
}
