/**
 * Scoreboard portraits (D-EP-041). The bar asks a provider for each bird's round face. Until Rendering supplies real
 * portraits rendered from the models (wave 5b, `setPortraitProvider`), a placeholder shows the team colour and the
 * bird's initial.
 */
import type { HeroId, PlayerTeam } from '../../sim/core/contracts';
import { HEROES } from '../../sim/heroes/registry';
import { TEAM_CSS } from './constants';
import { el } from './dom';

export interface PortraitProvider {
  /** A fresh element filling its parent: the circle's picture (a canvas, an image or any element). */
  face(hero: HeroId, team: PlayerTeam): HTMLElement;
}

export const placeholderPortraits: PortraitProvider = {
  face(hero, team) {
    const face = el('pu-face', 'div', undefined, HEROES[hero].def.name.slice(0, 1).toUpperCase());
    face.style.background = TEAM_CSS[team];
    return face;
  },
};

let current: PortraitProvider = placeholderPortraits;

/** Rendering calls this once its portraits exist; bars built afterwards use it (a match start rebuilds the bar). */
export const setPortraitProvider = (p: PortraitProvider): void => void (current = p);

export const portraitFace = (hero: HeroId, team: PlayerTeam): HTMLElement => current.face(hero, team);
