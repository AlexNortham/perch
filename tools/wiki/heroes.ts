// Hero pages: the index grid, one page per hero (built from hero data, or from the GDD plan for birds still to come)
// and a list of every built ability.
import { HERO_IDS } from '../../src/sim/core/contracts';
import type { AbilityDef, Archetype, HeroId, StatModifier } from '../../src/sim/core/contracts';
import { HEROES } from '../../src/sim/heroes/registry';
import { HERO_BUILDS } from '../../src/client/render/models/heroes';
import { AP_COSTS, UNLOCK_LEVELS } from '../../src/sim/data/abilities';
import { COMBAT } from '../../src/sim/data/combat';
import { DEFAULT_AIM_ZOOM } from '../../src/sim/data/core';
import { STATUSES, heroStage, isBuilt, plannedHero } from './facts';
import type { PlannedHero } from './facts';
import { silhouette } from './icons';
import { esc, num, pct } from './lib';
import type { Ctx } from './generate';
import { imageFor } from './imageplan';
import { rel } from './site';

/** Heroes the client draws with the default bird until their own model exists. */
const DEFAULT_MODEL = HERO_IDS.filter((id) => !(id in HERO_BUILDS));
export const ARCHETYPE: Record<Archetype, string> = {
  gunCarry: 'Gun carry', songBurst: 'Song burst', tank: 'Tank / initiator', support: 'Support', assassin: 'Assassin',
  areaControl: 'Area control', poke: 'Long-range poke', skirmisher: 'Mobility skirmisher',
};
const TARGETING: Record<AbilityDef['targeting'], string> = {
  self: 'Self cast', direction: 'Aimed in a direction', unit: 'Locks the unit nearest your crosshair', point: 'Placed at the aim point',
};
const STAT_NAME: Record<string, string> = {
  maxHealth: 'max HP', weaponDamage: 'gun damage', songPower: 'Song power', meleeDamage: 'melee damage', healthRegen: 'HP/s', moveSpeed: 'move speed',
};
const mod = (m: StatModifier): string => {
  const name = STAT_NAME[m.stat] ?? m.stat;
  return m.op === 'pct' ? `+${num(m.value * 100, 1)}% ${name} of base per level` : `+${num(m.value)} ${name} per level`;
};
const humanise = (k: string): string => k.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());

/** Every status an ability applies, found by walking its effect data. */
function statusesOf(a: AbilityDef): { id: string; name: string }[] {
  const found = new Map<string, string>();
  const walk = (v: unknown): void => {
    if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') {
      const o = v as Record<string, unknown>;
      if (o['kind'] === 'applyStatus' && o['status'] && typeof o['status'] === 'object') {
        const s = o['status'] as { id?: string; name?: string };
        if (s.id && s.name) found.set(s.id, s.name);
      }
      Object.values(o).forEach(walk);
    }
  };
  walk([a.effects, a.selfEffects, a.channelEffects, ...a.upgrades.map((u) => [u.effects, u.selfEffects])]);
  return [...found].map(([id, name]) => ({ id, name }));
}

export const abilityAnchor = (a: AbilityDef): string => `ability-${a.id.replace(/\./g, '-')}`;

function abilityCard(ctx: Ctx, a: AbilityDef, slot: number): string {
  const stats = [
    `<span class="chip">${TARGETING[a.targeting]}</span>`,
    `<span class="chip">Cooldown ${num(a.cooldownS)} s</span>`,
    `<span class="chip">${a.charges > 1 ? `${a.charges} charges` : '1 charge'}</span>`,
    a.range > 0 ? `<span class="chip">Range ${num(a.range)} m</span>` : '',
    a.castS > 0 ? `<span class="chip">Wind-up ${num(a.castS)} s</span>` : '',
    a.channelS > 0 ? `<span class="chip">Channel ${num(a.channelS)} s</span>` : '',
    a.rooted ? '<span class="chip">Rooted while casting</span>' : '',
    `<span class="chip">${slot === 3 ? `Ultimate, unlocks at level ${UNLOCK_LEVELS[3]}` : `Unlocks at level ${UNLOCK_LEVELS[slot]}`}</span>`,
  ].join('');
  const values = Object.entries(a.values).filter(([, v]) => v !== 0).map(([k, v]) => `<span class="chip">${humanise(k)} ${num(v)}</span>`).join('');
  const statuses = statusesOf(a).map((s) => `<span class="chip">${STATUSES.some((g) => g.id === s.id) ? ctx.link(`mechanics/statuses#status-${s.id}`, s.name) : esc(s.name)}</span>`).join('');
  const tiers = a.upgrades.map((u, i) => {
    const deltas: string[] = [];
    if (u.cooldownS) deltas.push(`cooldown ${u.cooldownS > 0 ? '+' : ''}${num(u.cooldownS)} s`);
    if (u.charges) deltas.push(`+${u.charges} charge`);
    if (u.range) deltas.push(`range +${num(u.range)} m`);
    for (const [k, v] of Object.entries(u.values ?? {})) deltas.push(`${humanise(k).toLowerCase()} ${v > 0 ? '+' : ''}${num(v)}`);
    return `<li><b>Tier ${i + 1} · ${AP_COSTS[i]} AP</b><span>${esc(u.description)}${deltas.length ? ` <small class="chip">${esc(deltas.join(', '))}</small>` : ''}</span></li>`;
  }).join('');
  const key = `ability:${a.id}`;
  return `<section class="ability${slot === 3 ? ' ult' : ''}" id="${abilityAnchor(a)}"><div>${ctx.imgTag(key)}</div><div>
<h4>${slot + 1}. ${esc(a.name)}</h4><p>${esc(a.description)}</p><div class="stats">${stats}</div>${values ? `<div class="stats">${values}</div>` : ''}${statuses ? `<div class="stats">Applies: ${statuses}</div>` : ''}
<ul class="tiers">${tiers}</ul></div></section>`;
}

function plannedCard(a: PlannedHero['abilities'][number]): string {
  const slotName = a.slot === 4 ? 'Ultimate' : `Ability ${a.slot}`;
  const stats = [a.targeting, a.cooldown && a.cooldown !== '—' ? `Cooldown ${a.cooldown}` : '', a.charges && a.charges !== '—' ? `Charges ${a.charges}` : '', a.range && a.range !== '—' ? `Range ${a.range}` : '']
    .filter(Boolean).map((s) => `<span class="chip">${esc(s)}</span>`).join('');
  const tiers = a.tiers.map((t, i) => `<li><b>Tier ${i + 1} · ${AP_COSTS[i]} AP</b><span>${esc(t)}</span></li>`).join('');
  return `<section class="ability planned${a.slot === 4 ? ' ult' : ''}"><div></div><div><h4>${slotName}: ${esc(a.name)}</h4><p>${esc(a.effect)}</p><div class="stats">${stats}</div><ul class="tiers">${tiers}</ul></div></section>`;
}

/** Sections `## key` of a prose file → map of key → markdown. */
function sections(raw: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const part of raw.split(/^## /m).slice(1)) {
    const nl = part.indexOf('\n');
    out.set(part.slice(0, nl).trim(), part.slice(nl + 1).trim());
  }
  return out;
}

export function registerHeroes(ctx: Ctx, extra: Map<string, string>): void {
  const archetypes = sections(ctx.prose('archetypes').body);
  const tips = sections(ctx.prose('hero-tips').body);
  const built = HERO_IDS.filter(isBuilt);

  // Silhouette cards for birds that are not built yet.
  for (const id of HERO_IDS) if (!isBuilt(id)) extra.set(`img/silhouette-${id}.svg`, silhouette(id, heroStage(id), ARCHETYPE[HEROES[id].def.archetype]));

  const card = (id: HeroId): string => {
    const def = HEROES[id].def;
    const ok = isBuilt(id);
    const pic = ok ? ctx.imgTag(`hero:${id}:portrait`) : `<img src="${rel(ctx.here, `img/silhouette-${id}.svg`)}" alt="${esc(def.name)}: silhouette, coming in Stage ${heroStage(id)}" width="320" height="320" loading="lazy">`;
    return `<a class="card${ok ? '' : ' soon'}" href="${rel(ctx.here, `heroes/${id}.html`)}">${pic}<span class="meta"><strong>${esc(def.name)}</strong><small>${ARCHETYPE[def.archetype]}</small><br>${ok ? '<span class="badge live">Playable</span>' : `<span class="badge soon">Coming in Stage ${heroStage(id)}</span>`}</span></a>`;
  };

  ctx.add({
    path: 'heroes/index.html', title: 'Heroes', section: 'Heroes', description: 'All 24 PERCH birds: portraits, roles and which are playable now.',
    keywords: 'heroes birds roster characters archetype',
    body: () => {
      const nowCount = built.length;
      const byArch = (Object.keys(ARCHETYPE) as Archetype[]).map((a) => {
        const ids = HERO_IDS.filter((id) => HEROES[id].def.archetype === a);
        return `<tr><td>${esc(ARCHETYPE[a])}</td><td>${ids.map((id) => ctx.link(`heroes/${id}`, HEROES[id].def.name)).join(', ')}</td><td class="num">${ids.filter(isBuilt).length} / ${ids.length}</td></tr>`;
      }).join('');
      return `<h1>Heroes</h1><p class="lead">24 birds, three for each of eight roles. ${nowCount === HERO_IDS.length ? `All <strong>${nowCount}</strong> are playable.` : `<strong>${nowCount}</strong> are playable now; the rest arrive in later stages.`} A match uses twelve different birds: no bird appears twice.</p>
<div class="note">${DEFAULT_MODEL.length > 0 ? `${DEFAULT_MODEL.map((id) => HEROES[id].def.name).join(', ')} still use a default bird model in the game, so their pictures here show that stand-in. ` : ''}Bird models and animation are still being upgraded, so expect the pictures to change.</div>
<div class="grid">${HERO_IDS.map(card).join('')}</div>
<h2>Roles</h2><div class="table-wrap"><table><thead><tr><th>Role</th><th>Birds</th><th class="num">Playable</th></tr></thead><tbody>${byArch}</tbody></table></div>
${ctx.md(`Every ability is listed on the [[heroes/abilities|Abilities]] page. Numbers for guns, health and speed come straight from the game's data files, so they change when the game is rebalanced.`)}
${ctx.md([...archetypes.entries()].map(([k, v]) => (k in ARCHETYPE ? `### ${ARCHETYPE[k as Archetype]}\n${v}` : '')).join('\n\n'), 'role-')}`;
    },
  });

  for (const id of HERO_IDS) {
    const m = HEROES[id];
    const def = m.def;
    const ok = isBuilt(id);
    const plan = plannedHero(id);
    ctx.add({
      path: `heroes/${id}.html`, title: def.name, section: 'Heroes', parent: 'heroes/index.html', keywords: `${def.name} ${ARCHETYPE[def.archetype]} ${def.weapon.name} ${ok ? def.abilities.map((a) => a.name).join(' ') : plan.abilities.map((a) => a.name).join(' ')}`,
      description: `${def.name}, ${ARCHETYPE[def.archetype].toLowerCase()}: ${ok ? 'kit, stats and tips' : `coming in Stage ${heroStage(id)}`}.`,
      body: () => {
        const stage = heroStage(id);
        const badge = ok ? '<span class="badge live">Playable</span>' : `<span class="badge soon">Coming in Stage ${stage}</span>`;
        const flavour = plan.silhouette ? `<p><em>Appearance:</em> ${esc(plan.silhouette)}</p>` : '';
        let info: string;
        let kit: string;
        if (ok) {
          const w = def.weapon;
          const dmg = def.stats.weaponDamage ?? 0;
          const dps = dmg * w.pellets * w.fireRate;
          const rows: [string, string][] = [
            ['Archetype', ARCHETYPE[def.archetype]],
            ['Health', num(def.stats.maxHealth ?? 0)],
            ['Move speed', `${num(def.stats.moveSpeed ?? 0)} m/s`],
            ['Sprint bonus', `+${num(def.stats.sprintSpeed ?? 0)} m/s`],
            ['Stamina', `${num(def.stats.stamina ?? 0)} pips`],
            ['Height', `${num(def.body.height)} m`],
            ['Body radius', `${num(def.body.radius)} m`],
            ['Head radius', `${num(def.body.head.radius)} m`],
            ['Gun', w.name],
            ['Damage', `${num(dmg)}${w.pellets > 1 ? ` × ${w.pellets} pellets` : ''} Talon`],
            ['Fire rate', `${num(w.fireRate)} shots/s`],
            ['Magazine', `${num(def.stats.magazine ?? 0)} rounds`],
            ['Reload', `${num(w.reloadS)} s${w.reload === 'perRound' ? ' per round' : ''}`],
            ['Falloff', `${num(w.falloff.start)} to ${num(w.falloff.end)} m`],
            ['Range', `${num(w.range)} m`],
            ['Shot type', w.hitscan ? 'Hitscan' : `Projectile, ${num(w.projectileSpeed)} m/s`],
            ['Spread', `${num(w.spreadDeg)}°`],
            ['Beak shot', `×${num(w.beakShotMult ?? COMBAT.beakShotMult)}`],
            ['Aim zoom', `×${num(w.aimZoom ?? DEFAULT_AIM_ZOOM)} FOV`],
            ['Gun damage per second (level 1)', num(dps, 1)],
            ['Since', `Stage ${stage}`],
          ];
          info = `<aside class="infobox"><h3>${esc(def.name)}</h3><figure>${ctx.imgTag(`hero:${id}:portrait`)}</figure>
<div class="pair">${ctx.imgTag(`hero:${id}:front`)}${ctx.imgTag(`hero:${id}:side`)}</div>
<dl>${rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl></aside>`;
          const growth = def.growth.map(mod).join('; ');
          const quick = [...def.abilities].sort((a, b) => a.cooldownS - b.cooldownS)[0];
          const gunLine = w.hitscan ? 'hits instantly' : 'fires travelling projectiles you have to lead';
          kit = `<h2>How to play</h2>${ctx.md(archetypes.get(def.archetype) ?? '')}
<p>${esc(def.name)} fights with the ${esc(w.name)}, which ${gunLine}${w.pellets > 1 ? ` and spreads ${w.pellets} pellets per shot` : ''}. Damage drops off between ${num(w.falloff.start)} m and ${num(w.falloff.end)} m, and head hits are beak shots worth ×${num(w.beakShotMult ?? COMBAT.beakShotMult)}. Every level above 1 is a Molt: ${esc(growth)}.</p>
${ctx.md(tips.get(id) ?? '')}
<h2>Abilities</h2><p>Four abilities. Slots 1 to 3 unlock at level ${UNLOCK_LEVELS[0]}, the ultimate at level ${UNLOCK_LEVELS[3]}. Each can be upgraded three times, for ${AP_COSTS.join(', ')} AP, in order; see ${ctx.link('mechanics/economy#ability-points', 'Ability Points')}. The shortest cooldown in the kit is ${esc(quick?.name ?? '')} at ${num(quick?.cooldownS ?? 0)} s.</p>
${def.abilities.map((a, i) => abilityCard(ctx, a, i)).join('')}`;
        } else {
          const rows: [string, string][] = [['Archetype', ARCHETYPE[def.archetype]], ['Status', `Coming in Stage ${stage}`]];
          info = `<aside class="infobox"><h3>${esc(def.name)}</h3><figure><img src="${rel(ctx.here, `img/silhouette-${id}.svg`)}" alt="${esc(def.name)}: silhouette, coming in Stage ${stage}" width="320" height="320"></figure>
<dl>${rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl></aside>`;
          kit = `<div class="note"><strong>Coming in Stage ${stage}.</strong> Everything below is the design plan from the Game Director's design document, and can change before ${esc(def.name)} is built.</div>
<h2>Plan</h2>${plan.body ? `<p>${esc(plan.body)}</p>` : ''}${plan.stats ? `<p>${esc(plan.stats)}</p>` : ''}${plan.gun ? `<p>${esc(plan.gun)}</p>` : ''}
${ctx.md(archetypes.get(def.archetype) ?? '')}
<h2>Planned abilities</h2>${plan.abilities.map(plannedCard).join('')}`;
        }
        return `<h1>${esc(def.name)} ${badge}</h1>${info}<p class="lead">${esc(ARCHETYPE[def.archetype])} · ${ok ? `Playable since Stage ${stage}` : `Coming in Stage ${stage}`}</p>${flavour}${kit}
<p><small>Since Stage ${stage}. See all ${ctx.link('heroes/index', 'heroes')}.</small></p>`;
      },
    });
  }

  ctx.add({
    path: 'heroes/abilities.html', title: 'Abilities', section: 'Heroes', parent: 'heroes/index.html', description: 'Every playable ability with cooldown, charges and range.',
    keywords: 'abilities skills cooldown ultimate',
    body: () => {
      const rows = built.flatMap((id) => HEROES[id].def.abilities.map((a, i) =>
        `<tr><td>${ctx.link(`heroes/${id}`, HEROES[id].def.name)}</td><td>${i === 3 ? 'Ult' : i + 1}</td><td><a href="${rel(ctx.here, `heroes/${id}.html`)}#${abilityAnchor(a)}">${esc(a.name)}</a></td><td>${esc(TARGETING[a.targeting])}</td><td class="num">${num(a.cooldownS)} s</td><td class="num">${a.charges}</td><td class="num">${a.range > 0 ? `${num(a.range)} m` : '-'}</td></tr>`)).join('');
      return `<h1>Abilities</h1><p class="lead">All ${built.length * 4} abilities of the playable birds. Upgrade tiers cost ${AP_COSTS.join(', ')} AP and are bought in order. Percentages in descriptions are as the game shows them.</p>
<div class="table-wrap"><table><thead><tr><th>Bird</th><th>Slot</th><th>Ability</th><th>Targeting</th><th class="num">Cooldown</th><th class="num">Charges</th><th class="num">Range</th></tr></thead><tbody>${rows}</tbody></table></div>
<p>Statuses such as stun and silence are explained on the ${ctx.link('mechanics/statuses', 'Statuses')} page. Items that change abilities are in ${ctx.link('items/song', 'the Song column of the Hoard')}.</p>`;
    },
  });
  void pct;
  void imageFor;
}
