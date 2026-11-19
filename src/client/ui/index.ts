/**
 * UI: DOM/CSS overlay above the canvas (GDD §12). Wave 3 scope: main menu, hero select, HUD and pause. The minimap,
 * shop, scoreboard, kill feed and damage numbers come in wave 4; settings and the end screen in wave 7.
 */
import type { AppActions, Ui } from '../app/contracts';
import { createHud } from './hud';
import { endScreen, heroSelectScreen, menuScreen, pauseScreen } from './screens';
import { STYLES } from './styles';

export function createUi(root: HTMLElement, actions: AppActions): Ui {
  const styleEl = document.createElement('style');
  styleEl.textContent = STYLES;
  const host = document.createElement('div');
  host.className = 'pu-root';
  const screens = document.createElement('div');
  const hud = createHud();
  host.append(hud.root, screens);
  root.append(styleEl, host);
  let inMatch = false;

  return {
    show(screen, { view, settings, seed }) {
      screens.replaceChildren();
      inMatch = screen === 'match' || screen === 'pause';
      hud.root.style.display = inMatch ? '' : 'none';
      hud.setBindings(settings.bindings);
      switch (screen) {
        case 'menu':
          screens.append(menuScreen(actions));
          break;
        case 'heroSelect':
          screens.append(heroSelectScreen(actions, seed));
          break;
        case 'pause':
          screens.append(pauseScreen(actions));
          break;
        case 'end':
          screens.append(endScreen(actions, view.winner === 'dawn' ? 'Dawn Flock' : view.winner === 'dusk' ? 'Dusk Flock' : 'Nobody'));
          break;
        case 'match':
          break;
      }
    },
    onEvents: (events, view) => {
      if (inMatch) hud.onEvents(events, view);
    },
    update: (frame) => {
      if (inMatch) hud.update(frame);
    },
    onUiAction: () => undefined,
    dispose: () => {
      styleEl.remove();
      host.remove();
    },
  };
}
