// TODO(UI/HUD): HUD, minimap and pings, the Magpie's Hoard shop, scoreboard, kill feed, damage numbers, and the real
// menus (GDD §12: main menu, match setup, hero select with a rotating 3D preview, settings, pause, end of match).
// Until then: plain placeholder screens so the app's state machine can be driven by hand.
import { HERO_IDS } from '../../sim/core/contracts';
import { HEROES } from '../../sim/heroes/registry';
import type { AppActions, Ui } from '../app/contracts';

const PANEL_STYLE =
  'position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;' +
  'gap:12px;pointer-events:auto;font-family:system-ui,sans-serif;color:#f4efe6;background:rgba(12,14,18,0.78)';
const BUTTON_STYLE =
  'font:inherit;font-size:18px;padding:8px 20px;border:1px solid #f4efe6;border-radius:6px;' +
  'background:rgba(255,255,255,0.08);color:inherit;cursor:pointer';
const GRID_STYLE = 'display:grid;grid-template-columns:repeat(8,auto);gap:8px';

export function createUi(root: HTMLElement, actions: AppActions): Ui {
  const panel = document.createElement('div');
  root.append(panel);

  const button = (label: string, onClick: () => void): HTMLButtonElement => {
    const b = document.createElement('button');
    b.textContent = label;
    b.style.cssText = BUTTON_STYLE;
    b.addEventListener('click', onClick);
    return b;
  };
  const heading = (text: string, tag: 'h1' | 'h2' = 'h2'): HTMLElement => {
    const h = document.createElement(tag);
    h.textContent = text;
    h.style.margin = '0';
    return h;
  };

  return {
    show(screen, { view, seed }) {
      panel.replaceChildren();
      panel.style.cssText = screen === 'match' ? 'display:none' : PANEL_STYLE;
      switch (screen) {
        case 'menu':
          panel.append(heading('PERCH', 'h1'), heading('Two flocks. One city in the forest.'), button('Play', actions.play));
          break;
        case 'heroSelect': {
          const grid = document.createElement('div');
          grid.style.cssText = GRID_STYLE;
          for (const hero of HERO_IDS) {
            const start = (): void => actions.startMatch({ hero, team: 'dawn', difficulty: 'normal', seed });
            grid.append(button(HEROES[hero].def.name, start));
          }
          panel.append(heading('Choose your bird'), grid, button('Back', actions.toMenu));
          break;
        }
        case 'pause':
          panel.append(
            heading('Paused'),
            button('Resume', actions.resume),
            button('Concede', actions.concede),
            button('Main menu', actions.toMenu),
          );
          break;
        case 'end': {
          const winner = view.winner === 'dawn' ? 'Dawn Flock' : view.winner === 'dusk' ? 'Dusk Flock' : 'Nobody';
          panel.append(heading(`${winner} wins`), button('Main menu', actions.toMenu));
          break;
        }
        case 'match':
          break;
      }
    },
    onEvents: () => undefined,
    update: () => undefined,
    onUiAction: () => undefined,
    dispose: () => panel.remove(),
  };
}
