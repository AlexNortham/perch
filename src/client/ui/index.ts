/**
 * UI: DOM/CSS overlay above the canvas (GDD §12). Menu, hero select, HUD (top bar, minimap, feed, abilities, items),
 * the upgrade panel, the Magpie's Hoard, scoreboard, big map, pings, damage numbers, pause, Options and the end screen.
 * Every panel only submits intents through AppActions; nothing here writes the sim view.
 */
import type { PingKind } from '../../sim/core/contracts';
import type { AppActions, Frame, Screen, ScreenContext, Settings, Ui } from '../app/contracts';
import { BIG_MAP_FALLBACK_PX, BIG_MAP_SCREEN_SHARE, MAP_ASPECT, MINIMAP_SIZE, PING_CSS, PING_LABEL, WHEEL_PINGS } from './constants';
import { button, el } from './dom';
import { createFeed } from './feed';
import { createHud } from './hud';
import { createMapView, zoneName } from './minimap';
import { optionsScreen } from './options';
import { endScreen, heroSelectScreen, menuScreen, pauseScreen } from './screens';
import { createShop } from './shop';
import { HUD_STYLES } from './data/hud-styles';
import { MATCH_STYLES } from './match-styles';
import { OPTIONS_STYLES, STYLES } from './styles';
import { createTopBar } from './topbar';
import { createStreaks } from './streaks';
import { createWorldLayer } from './world';

export function createUi(root: HTMLElement, actions: AppActions): Ui {
  const styleEl = document.createElement('style');
  styleEl.textContent = STYLES + OPTIONS_STYLES + MATCH_STYLES + HUD_STYLES;
  const host = el('pu-root');
  const screens = el('');
  const hud = createHud(actions);
  const world = createWorldLayer(actions);
  const streaks = createStreaks();
  const topbar = createTopBar(streaks);
  const feed = createFeed();
  const shop = createShop(actions);
  const miniWrap = el('pu-minimap', 'div', hud.root);
  const mini = createMapView(miniWrap, 'pu-minimap-canvas', () => MINIMAP_SIZE, actions);
  const zoneLabel = el('pu-zone', 'div', hud.root);
  const bigSize = (): { width: number; height: number } => {
    const height = Math.round(host.clientHeight * BIG_MAP_SCREEN_SHARE) || BIG_MAP_FALLBACK_PX;
    return { width: Math.round((height * MAP_ASPECT.width) / MAP_ASPECT.height), height };
  };
  const big = createMapView(el('pu-bigmap-box', 'div', hud.root), 'pu-bigmap', bigSize, actions);
  const bigBox = big.canvas.parentElement ?? hud.root;
  bigBox.hidden = true;

  // Ping wheel: four wheel pings placed at what the crosshair was on when it opened.
  const wheel = el('pu-wheel', 'div', hud.root);
  wheel.setAttribute('role', 'dialog');
  wheel.setAttribute('aria-label', 'Ping wheel');
  wheel.hidden = true;
  let wheelAt: ReturnType<AppActions['crosshairPing']> = null;
  const closeWheel = (release: boolean): void => {
    if (wheel.hidden) return;
    wheel.hidden = true;
    if (release) actions.capturePointer(false);
  };
  for (const kind of WHEEL_PINGS) {
    const b = button(PING_LABEL[kind], () => {
      if (wheelAt) actions.submit({ ping: { kind: kind as PingKind, pos: wheelAt.pos, target: wheelAt.target } });
      closeWheel(true);
    }, 'pu-wheel-btn');
    b.style.borderColor = PING_CSS[kind];
    wheel.append(b);
  }

  hud.root.append(topbar.root, feed.root, world.root, shop.root);
  host.append(hud.root, screens);
  root.append(styleEl, host);

  let inMatch = false;
  /** The settings as last saved from Options, so reopening it (or the HUD key caps) shows them. */
  let settings: Settings | null = null;
  const saving: AppActions = {
    ...actions,
    saveSettings: (next) => {
      settings = next;
      applySettings(next);
      actions.saveSettings(next);
    },
  };
  const applySettings = (s: Settings): void => {
    hud.setBindings(s.bindings);
    world.setSettings(s);
  };
  const closePanels = (): void => {
    hud.setUpgrading(false);
    shop.close();
    closeWheel(false);
    bigBox.hidden = true;
  };

  function render(screen: Screen, c: ScreenContext): void {
    screens.replaceChildren();
    const wasInMatch = inMatch;
    inMatch = screen === 'match' || screen === 'pause';
    hud.root.style.display = inMatch ? '' : 'none';
    closePanels();
    if (inMatch && !wasInMatch) {
      feed.reset();
      world.reset();
      streaks.reset();
      topbar.reset();
      mini.reset();
      big.reset();
    }
    const current = settings ?? c.settings;
    applySettings(current);
    hud.setCatalogue(c.catalogue);
    hud.setPractice(c.mode === 'practice');
    hud.setPaused(screen === 'pause');
    world.setPractice(c.mode === 'practice');
    shop.setCatalogue(c.catalogue);
    const openOptions = (): void => {
      screens.replaceChildren(optionsScreen(settings ?? c.settings, saving, () => render(screen, c)));
    };
    switch (screen) {
      case 'menu':
        screens.append(menuScreen(actions, openOptions));
        break;
      case 'heroSelect':
        screens.append(heroSelectScreen(actions, c.seed, c.mode, c.swap === true));
        break;
      case 'pause':
        screens.append(pauseScreen(actions, openOptions, c.view.seconds, c.mode));
        break;
      case 'end':
        screens.append(endScreen(actions, c));
        break;
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
      if (!inMatch) return;
      const callouts = streaks.onEvents(events);
      hud.onEvents(events, view, callouts);
      feed.onEvents(events, view, callouts);
      world.onEvents(events, view);
      topbar.onEvents(events, view);
    },
    update: (frame: Frame) => {
      if (!inMatch) return;
      const view = frame.curr;
      hud.update(frame);
      topbar.update(view);
      feed.update(frame);
      world.update(frame);
      mini.draw(view, world.pings);
      if (!bigBox.hidden) big.draw(view, world.pings);
      zoneLabel.textContent = zoneName(view);
      shop.update(view);
    },
    onUiAction: (action, down) => {
      if (!inMatch) return;
      switch (action) {
        case 'upgrades':
          hud.setUpgrading(down);
          break;
        case 'shop':
          if (down) shop.open();
          else shop.close();
          break;
        case 'pingWheel':
          if (down) {
            wheelAt = actions.crosshairPing();
            wheel.hidden = false;
          } else closeWheel(false);
          break;
        case 'bigMap':
          if (down) bigBox.hidden = !bigBox.hidden;
          break;
      }
    },
    dispose: () => {
      styleEl.remove();
      host.remove();
    },
  };
}
