/**
 * UI: DOM/CSS overlay above the canvas (GDD §12). Menu, hero select, HUD, pause and Options (with key rebinding).
 * The minimap, shop, scoreboard, kill feed and damage numbers come in wave 4; the end screen in wave 7.
 */
import type { AppActions, Screen, ScreenContext, Settings, Ui } from '../app/contracts';
import { createHud } from './hud';
import { optionsScreen } from './options';
import { endScreen, heroSelectScreen, menuScreen, pauseScreen } from './screens';
import { OPTIONS_STYLES, STYLES } from './styles';

export function createUi(root: HTMLElement, actions: AppActions): Ui {
  const styleEl = document.createElement('style');
  styleEl.textContent = STYLES + OPTIONS_STYLES;
  const host = document.createElement('div');
  host.className = 'pu-root';
  const screens = document.createElement('div');
  const hud = createHud();
  host.append(hud.root, screens);
  root.append(styleEl, host);
  let inMatch = false;
  /** The settings as last saved from Options, so reopening it (or the HUD key caps) shows them. */
  let settings: Settings | null = null;
  const saving: AppActions = {
    ...actions,
    saveSettings: (next) => {
      settings = next;
      hud.setBindings(next.bindings);
      actions.saveSettings(next);
    },
  };

  function render(screen: Screen, c: ScreenContext): void {
    screens.replaceChildren();
    inMatch = screen === 'match' || screen === 'pause';
    hud.root.style.display = inMatch ? '' : 'none';
    const current = settings ?? c.settings;
    hud.setBindings(current.bindings);
    const openOptions = (): void => {
      screens.replaceChildren(optionsScreen(settings ?? c.settings, saving, () => render(screen, c)));
    };
    switch (screen) {
      case 'menu':
        screens.append(menuScreen(actions, openOptions));
        break;
      case 'heroSelect':
        screens.append(heroSelectScreen(actions, c.seed));
        break;
      case 'pause':
        screens.append(pauseScreen(actions, openOptions));
        break;
      case 'end': {
        const w = c.view.winner;
        screens.append(endScreen(actions, w === 'dawn' ? 'Dawn Flock' : w === 'dusk' ? 'Dusk Flock' : 'Nobody'));
        break;
      }
      case 'match':
        break;
    }
  }

  return {
    show: (screen, c) => {
      settings = c.settings;
      render(screen, c);
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
