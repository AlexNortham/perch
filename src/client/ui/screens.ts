/** Main menu, hero select and pause (GDD §12.2, §12.3, §12.10). Each returns a fresh element for the screen host. */
import { HERO_IDS } from '../../sim/core/contracts';
import { HEROES } from '../../sim/heroes/registry';
import type { AppActions } from '../app/contracts';
import { ARCHETYPE_LABEL, HERO_SWATCH_SATURATION_LIGHTNESS, HERO_SWATCH_STEP_DEG } from './constants';

const make = <K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, content?: string): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  e.className = cls;
  if (content !== undefined) e.textContent = content;
  return e;
};
const button = (label: string, onClick: () => void, cls = 'pu-btn'): HTMLButtonElement => {
  const b = make('button', cls, label);
  b.type = 'button';
  b.addEventListener('click', onClick);
  return b;
};
const screen = (cls: string, ...children: HTMLElement[]): HTMLElement => {
  const s = make('div', `pu-screen ${cls}`);
  s.append(...children);
  return s;
};

export const menuScreen = (actions: AppActions): HTMLElement =>
  screen(
    'pu-menu',
    make('h1', 'pu-title', 'PERCH'),
    make('p', 'pu-sub', 'Two flocks. One city in the forest.'),
    button('Play', actions.play),
  );

/** All 24 heroes; only `implemented` ones can be picked (D-ARCH-013). */
export function heroSelectScreen(actions: AppActions, seed: number): HTMLElement {
  const grid = make('div', 'pu-grid');
  HERO_IDS.forEach((id, i) => {
    const { def, implemented } = HEROES[id];
    const card = make('button', 'pu-card');
    card.type = 'button';
    card.style.setProperty('--sw', `hsl(${i * HERO_SWATCH_STEP_DEG} ${HERO_SWATCH_SATURATION_LIGHTNESS})`);
    card.dataset['hero'] = id;
    card.append(make('b', '', def.name), make('span', '', ARCHETYPE_LABEL[def.archetype]));
    if (implemented === true) {
      card.append(make('em', '', 'Pick'));
      card.addEventListener('click', () => actions.startMatch({ hero: id, team: 'dawn', difficulty: 'normal', seed }));
    } else {
      card.append(make('em', '', 'Coming soon'));
      card.disabled = true;
    }
    grid.append(card);
  });
  return screen('pu-select', make('h2', 'pu-h2', 'Choose your bird'), grid, button('Back', actions.toMenu, 'pu-btn pu-quiet'));
}

export const pauseScreen = (actions: AppActions): HTMLElement =>
  screen(
    'pu-pause',
    make('h2', 'pu-h2', 'Paused'),
    button('Resume', actions.resume),
    button('Quit to menu', actions.toMenu, 'pu-btn pu-quiet'),
  );

/** Placeholder until the wave 7 end screen. */
export const endScreen = (actions: AppActions, winner: string): HTMLElement =>
  screen('pu-select', make('h2', 'pu-h2', `${winner} wins`), button('Main menu', actions.toMenu));
