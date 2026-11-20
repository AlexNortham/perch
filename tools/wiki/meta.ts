// Home, getting started (install, controls, Options, game modes), glossary and patch notes.
import { HERO_IDS } from '../../src/sim/core/contracts';
import { HEROES } from '../../src/sim/heroes/registry';
import { ITEMS } from '../../src/sim/data/items';
import { DEFAULT_BINDINGS } from '../../src/client/app/bindings';
import { DEFAULT_SETTINGS } from '../../src/client/app/settings';
import { ACTIONS, ACTION_LABELS, keyName } from '../../src/client/ui/bindings';
import { LOCKED_CROUCH } from '../../src/client/input/constants';
import { FOV_RANGE, SENSITIVITY_RANGE } from '../../src/client/ui/constants';
import { TEAM_SIZE } from '../../src/sim/data/core';
import { CURRENT_STAGE, gddSection, heroStage, isBuilt, patchNotes } from './facts';
import { esc } from './lib';
import type { Ctx } from './generate';
import { table, withBlocks } from './mechanics';
import { ARCHETYPE } from './heroes';

/** Glossary terms that have a page of their own. */
const TERM_PAGE: Record<string, string> = {
  'Dawn Flock': 'map/index', 'Dusk Flock': 'map/index', 'Patron': 'units/patrons', 'Home Roost': 'units/patrons#home-roost', 'Lane': 'map/index', 'Fledglings': 'units/fledglings',
  'Seeds': 'mechanics/economy', 'Seed pod': 'mechanics/economy#seed-pods', 'Sentinel Hawk': 'units/towers#hawk', 'Stilt Heron': 'units/towers#heron', 'Nest Warden': 'units/towers#warden',
  'Roost Shrine': 'units/towers#shrine', 'Brood Ward': 'units/patrons#brood-ward', 'The Magpie\'s Hoard': 'items/index', 'Level': 'mechanics/economy#levels', 'AP': 'mechanics/economy#ability-points',
  'Molt': 'mechanics/economy#molts', 'Flex slot': 'mechanics/economy#flex-slots', 'Beak shot': 'mechanics/combat#beak-shots', 'Parry': 'mechanics/combat#parry', 'Updraft': 'mechanics/movement',
  'Slide': 'mechanics/movement', 'Mantle': 'mechanics/movement', 'Status': 'mechanics/statuses', 'Bounty': 'mechanics/economy#bounties', 'Comeback bonus': 'mechanics/economy#bounties',
  'Golden Egg': 'units/objectives#golden-egg', 'The Roc': 'units/objectives#roc', 'Thicket': 'units/objectives#thickets', 'Feather rune': 'units/objectives#runes', 'Cellar Run': 'map/buildings#cellar-run', 'Magpie Den': 'map/buildings#magpie-den', 'The Hollow': 'units/objectives#roc',
};

export function registerMeta(ctx: Ctx): void {
  const built = HERO_IDS.filter(isBuilt);
  const soon = HERO_IDS.filter((id) => !isBuilt(id));
  const crouch = DEFAULT_BINDINGS.crouch === LOCKED_CROUCH ? keyName(LOCKED_CROUCH) : `${keyName(DEFAULT_BINDINGS.crouch)} (or ${keyName(LOCKED_CROUCH)} in fullscreen in Chrome and Edge)`;

  const blocks: Record<string, () => string> = {
    'status-now': () => `<div class="note"><strong>Now: Stage ${CURRENT_STAGE} (M${CURRENT_STAGE - 1}, Full 6v6), Release 1.</strong> All ${built.length} birds are playable and the Magpie's Hoard stocks ${ITEMS.length} items. You play a six-versus-six match with eleven bots on the rebuilt Old Mossmarket. The visual upgrade comes in the next release: ${ctx.link('patch-notes', 'the patch notes')} list the known limits.</div>`,
    'playable-heroes': () => `<div class="grid">${built.map((id) => `<a class="card" href="${ctx.href(`heroes/${id}`)}">${ctx.imgTag(`hero:${id}:portrait`)}<span class="meta"><strong>${esc(HEROES[id].def.name)}</strong><small>${ARCHETYPE[HEROES[id].def.archetype]}</small></span></a>`).join('')}</div>`,
    'whats-new': () => `<ul><li><strong>${built.filter((id) => heroStage(id) === CURRENT_STAGE).length} new birds</strong> (${built.filter((id) => heroStage(id) === CURRENT_STAGE).map((id) => ctx.link(`heroes/${id}`, HEROES[id].def.name)).join(', ')}), so all ${HERO_IDS.length} are playable.</li>
<li>${ctx.link('items/index', "The Magpie's Hoard")} now has ${ITEMS.length} items.</li>
<li>A rebuilt map with ${ctx.link('map/buildings', 'enterable buildings, the Cellar Run and the Magpie Den')}, and a jungle of ${ctx.link('units/objectives', 'Thickets, Nests, runes, the Golden Egg and the Roc')}.</li>
<li>${ctx.link('units/bots', 'Bots')} fill the other eleven places, so every match is a full 6v6.</li>
<li>Controls: ${ctx.link('getting-started/controls', 'hold the upgrade key to upgrade, no Interact key, an always-on scoreboard')}, and Swap bird in the ${ctx.link('units/practice-dummies', 'Practice Hub')}.</li></ul>`,
    'home-links': () => `<div class="grid">${[['getting-started/index', 'Getting started', 'Install, launch and play'], ['heroes/index', 'Heroes', `${HERO_IDS.length} birds`], ['items/index', "The Magpie's Hoard", 'Items and shop rules'], ['mechanics/index', 'Mechanics', 'Movement, combat, economy'], ['map/index', 'The map', 'Old Mossmarket'], ['units/index', 'Units', 'Towers, Patrons, fledglings'], ['glossary', 'Glossary', 'Terms explained'], ['patch-notes', 'Patch notes', 'Stage by stage']]
      .map(([p, t, s]) => `<a class="card" href="${ctx.href(p ?? '')}"><span class="meta"><strong>${esc(t ?? '')}</strong><small>${esc(s ?? '')}</small></span></a>`).join('')}</div>`,
    banner: () => ctx.figure('home:banner', 'Old Mossmarket at dawn: the Dawn base in front, the Dusk base far away, three lanes between.'),
    'controls-table': () => table(['Action', 'Default key'], ACTIONS.map((a) => [esc(ACTION_LABELS[a]), `<kbd>${esc(a === 'crouch' ? crouch : keyName(DEFAULT_BINDINGS[a]))}</kbd>`])),
    'options-table': () => table(['Setting', 'Default / range'], [
      ['Mouse sensitivity', `${DEFAULT_SETTINGS.sensitivity} (${SENSITIVITY_RANGE[0]} to ${SENSITIVITY_RANGE[1]})`], ['Aim sensitivity multiplier', String(DEFAULT_SETTINGS.aimSensitivity)], ['Invert Y', DEFAULT_SETTINGS.invertY ? 'On' : 'Off'],
      ['Crouch', DEFAULT_SETTINGS.crouchToggle ? 'Toggle' : 'Hold'], ['Field of view', `${DEFAULT_SETTINGS.fovDeg}° (${FOV_RANGE[0]}° to ${FOV_RANGE[1]}°)`], ['Master / effects / music volume', `${DEFAULT_SETTINGS.volume.master * 100}% / ${DEFAULT_SETTINGS.volume.sfx * 100}% / ${DEFAULT_SETTINGS.volume.music * 100}%`],
      ['Graphics quality', DEFAULT_SETTINGS.quality], ['Damage numbers', DEFAULT_SETTINGS.damageNumbers ? 'On' : 'Off'],
    ]),
    'ui-shots': () => `<div class="gallery">${ctx.figure('ui:hud', 'The HUD: health and stamina bottom left, abilities and item slots, Seeds, the minimap top left and flock scores at the top.')}${ctx.figure('ui:upgrades', 'Hold the upgrade modifier to open Ability Upgrades.')}${ctx.figure('ui:scoreboard', 'The always-on scoreboard at the top of the screen.')}${ctx.figure('ui:bigmap', 'The big map, toggled with M.')}${ctx.figure('ui:minimap', 'The minimap.')}${ctx.figure('ui:shop', "The Magpie's Hoard.")}</div>`,
    'options-shot': () => ctx.figure('ui:options'),
    'menu-shots': () => `<div class="gallery">${ctx.figure('ui:menu', 'The main menu.')}${ctx.figure('ui:heroselect', 'Choose your bird. Hover a card to read its kit.')}</div>`,
    'soon-count': () => (soon.length === 0 ? '' : `<p>${soon.length} more birds are planned: ${soon.map((id) => ctx.link(`heroes/${id}`, HEROES[id].def.name)).join(', ')}.</p>`),
  };
  const prosePage = (path: string, section: string, parent: string | undefined, prose: string, description: string, keywords: string): void => {
    ctx.add({
      path, title: ctx.prose(prose).title, section, ...(parent ? { parent } : {}), description, keywords,
      body: () => { const p = ctx.prose(prose); return `<h1>${esc(p.title)}</h1>${ctx.md(withBlocks(p.body, blocks))}`; },
    });
  };
  ctx.add({
    path: 'index.html', title: 'PERCH Wiki', section: 'Home', description: 'The PERCH game wiki: a browser hero shooter about birds.', keywords: 'home perch wiki welcome',
    body: () => `<h1>PERCH Wiki</h1>${ctx.md(withBlocks(ctx.prose('home').body, blocks))}`,
  });
  prosePage('getting-started/index.html', 'Getting started', undefined, 'getting-started', 'Install, launch and play your first PERCH match.', 'install launch run npm start browser play');
  prosePage('getting-started/controls.html', 'Getting started', 'getting-started/index.html', 'controls', 'Every default key and mouse button, and the crouch and fullscreen note.', 'controls keys bindings wasd crouch ctrl fullscreen keyboard lock');
  prosePage('getting-started/options.html', 'Getting started', 'getting-started/index.html', 'options', 'The Options screen: rebinding, sensitivity, FOV, volume and quality.', 'options settings rebind sensitivity fov volume graphics quality');
  prosePage('getting-started/modes.html', 'Getting started', 'getting-started/index.html', 'modes', 'The 6v6 match with bots, and the Practice Hub.', 'modes play match bots practice hub swap');

  ctx.add({
    path: 'glossary.html', title: 'Glossary', section: 'Reference', description: 'Terms used in PERCH, from Seeds to Updrafts.', keywords: 'glossary terms definitions',
    body: () => {
      const rows = gddSection(/^## 2\. Glossary/).split('\n').map((l) => l.split('|').map((c) => c.trim())).filter((c) => c.length >= 4 && c[1]?.startsWith('**'));
      const out = rows.map((c) => {
        const term = (c[1] ?? '').replace(/\*\*/g, '');
        const page = TERM_PAGE[term];
        const def = (c[2] ?? '').replace(/\*\*/g, '');
        return `<tr id="term-${term.toLowerCase().replace(/[^a-z0-9]+/g, '-')}"><td><strong>${esc(term)}</strong></td><td>${esc(def)}${page ? ` See ${ctx.link(page)}.` : ''}</td></tr>`;
      }).join('');
      return `<h1>Glossary</h1><p class="lead">Words you will meet in PERCH. ${TEAM_SIZE}v${TEAM_SIZE} matches, two flocks, one Patron each.</p><div class="table-wrap"><table><thead><tr><th>Term</th><th>Meaning</th></tr></thead><tbody>${out}</tbody></table></div>`;
    },
  });

  ctx.add({
    path: 'patch-notes.html', title: 'Patch notes', section: 'Reference', description: 'What changed in each stage of PERCH.', keywords: 'patch notes changelog stage history new',
    body: () => {
      const notes = patchNotes();
      const current = notes.some((n) => n.stage === CURRENT_STAGE) ? '' : `<h2 id="stage-${CURRENT_STAGE}">Stage ${CURRENT_STAGE}: in progress</h2><div class="note">This stage has not passed its gate yet, so this section is built from the game's current data.</div>${blocks['whats-new']?.() ?? ''}`;
      const past = [...notes].sort((a, b) => b.stage - a.stage).map((n) => `<h2 id="stage-${n.stage}">Stage ${n.stage}: ${esc(n.title)}</h2>${ctx.md(n.body, `s${n.stage}-`)}`).join('');
      return `<h1>Patch notes</h1><p class="lead">One section per stage, newest first. Each section is the note written when that stage was reached.</p>${current}${past}`;
    },
  });
}
