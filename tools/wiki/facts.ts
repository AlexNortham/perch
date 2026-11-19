// Everything the wiki knows comes from here: the game's own data modules, plus docs/GDD.md, docs/STATUS.md and
// PLAYABLE.md for what is still to come and for the patch notes. Nothing is copied by hand.
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HERO_IDS } from '../../src/sim/core/contracts';
import type { HeroId, ItemDef } from '../../src/sim/core/contracts';
import { HEROES } from '../../src/sim/heroes/registry';
import { ITEMS } from '../../src/sim/data/items';
import * as combat from '../../src/sim/data/combat';
import type { StatusDef } from '../../src/sim/core/contracts';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (p: string): string => readFileSync(resolve(ROOT, p), 'utf8');

/** Reference-game names stay out of the wiki (D-EP-002): drop any line that mentions them. */
const BANNED = /deadlock|valve|dota/i;
export const clean = (text: string): string => text.split('\n').filter((l) => !BANNED.test(l)).join('\n');

export const GDD = read('docs/GDD.md');
const STATUS = read('docs/STATUS.md');
const PLAYABLE = read('PLAYABLE.md');

/** Text of GDD section `### n title`, up to the next heading of the same or higher level. */
export function gddSection(heading: RegExp): string {
  const lines = GDD.split('\n');
  const start = lines.findIndex((l) => /^#{2,3} /.test(l) && heading.test(l));
  if (start < 0) return '';
  const level = /^#+/.exec(lines[start] ?? '')?.[0].length ?? 2;
  const body: string[] = [];
  for (const l of lines.slice(start + 1)) {
    const m = /^(#+) /.exec(l);
    if (m && (m[1]?.length ?? 9) <= level) break;
    if (l.trim() !== '---') body.push(l);
  }
  return clean(body.join('\n')).trim();
}

// ---- the plan: which stage each hero and feature arrives in (docs/STATUS.md milestones: Stage = M + 1) ----
export const STAGE_OF_HERO = {} as Record<HeroId, number>;
let currentStage = 3;
let itemsStage = 4;
{
  const parts = STATUS.split(/^### M(\d) — .*$/m);
  for (let i = 1; i < parts.length; i += 2) {
    const stage = Number(parts[i]) + 1;
    const body = parts[i + 1] ?? '';
    for (const m of body.matchAll(/\(([a-z]+(?:,\s+[a-z]+){3})\)/g)) {
      for (const id of (m[1] ?? '').split(/,\s+/)) if ((HERO_IDS as readonly string[]).includes(id)) STAGE_OF_HERO[id as HeroId] ??= stage;
    }
    if (/48\+ items/.test(body)) itemsStage = stage;
  }
  const now = /\*\*Milestone:\*\* M(\d)/.exec(STATUS);
  if (now) currentStage = Number(now[1]) + 1;
}
export const CURRENT_STAGE = currentStage;
export const ITEMS_STAGE = itemsStage;
/** Stage a built hero shipped in: the plan's stage, never later than the current one. */
export const heroStage = (id: HeroId): number => STAGE_OF_HERO[id] ?? CURRENT_STAGE;
export const isBuilt = (id: HeroId): boolean => HEROES[id].implemented === true;

// ---- GDD hero sections (used for heroes that are not built yet) ----
export interface PlannedAbility { slot: number; name: string; targeting: string; cooldown: string; charges: string; range: string; effect: string; tiers: [string, string, string] }
export interface PlannedHero { id: HeroId; silhouette: string; body: string; stats: string; gun: string; abilities: PlannedAbility[] }

const stripMd = (s: string): string => s.replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();
export function plannedHero(id: HeroId): PlannedHero {
  const sec = gddSection(new RegExp(`^### 9\\.\\d+ .*\`${id}\``));
  const field = (label: string): string => {
    const m = new RegExp(`\\*\\*${label}[^*]*\\*\\*\\s*([\\s\\S]*?)(?=\\n\\*\\*|\\n\\n|\\n\\|)`).exec(sec);
    return stripMd(m?.[1] ?? '');
  };
  const gun = /\*\*(Gun[^*]*)\*\*\s*([\s\S]*?)(?=\n\n|\n\|)/.exec(sec);
  const abilities: PlannedAbility[] = [];
  for (const line of sec.split('\n')) {
    const c = line.split('|').map((x) => x.trim());
    if (c.length >= 11 && /^\d$/.test(c[1] ?? '')) {
      abilities.push({
        slot: Number(c[1]), name: stripMd(c[2] ?? ''), targeting: stripMd(c[3] ?? ''), cooldown: stripMd(c[4] ?? ''), charges: stripMd(c[5] ?? ''),
        range: stripMd(c[6] ?? ''), effect: stripMd(c[7] ?? ''), tiers: [stripMd(c[8] ?? ''), stripMd(c[9] ?? ''), stripMd(c[10] ?? '')],
      });
    }
  }
  return {
    id, silhouette: field('Silhouette and colour:'), body: field('Body plan:'), stats: field('Base stats:'),
    gun: gun ? stripMd(`${gun[1]} ${gun[2]}`) : '', abilities,
  };
}

// ---- GDD item tables (items not yet in the shop) ----
export interface PlannedItem { id: string; name: string; tier: number; cost: string; effect: string; active: string; from: string; category: 'talon' | 'plumage' | 'song' }
export function plannedItems(): PlannedItem[] {
  const out: PlannedItem[] = [];
  for (const [category, h] of [['talon', /^### 10\.1 /], ['plumage', /^### 10\.2 /], ['song', /^### 10\.3 /]] as const) {
    for (const line of gddSection(h).split('\n')) {
      const c = line.split('|').map((x) => x.trim());
      const id = /^`([a-z-]+)`$/.exec(c[1] ?? '')?.[1];
      if (id) out.push({ id, name: c[2] ?? id, tier: Number(c[3]), cost: c[4] ?? '', effect: stripMd(c[5] ?? ''), active: stripMd(c[6] ?? '').replace(/^—$/, ''), from: (c[7] ?? '').replace(/[`—]/g, ''), category });
    }
  }
  return out;
}
export const catalogueIds: ReadonlySet<string> = new Set(ITEMS.map((i) => i.id));
export const itemsByCategory = (cat: ItemDef['category']): ItemDef[] => ITEMS.filter((i) => i.category === cat);

// ---- statuses: every StatusDef exported by the combat data ----
export const STATUSES: StatusDef[] = Object.values(combat).filter(
  (v): v is StatusDef => typeof v === 'object' && v !== null && 'id' in v && 'stacking' in v && 'negative' in v,
);

// ---- patch notes ----
export interface PatchNote { stage: number; title: string; body: string }
export function patchNotes(): PatchNote[] {
  const out: PatchNote[] = [];
  const parts = PLAYABLE.split(/^## Stage (\d+) \((.*?)\)(.*)$/m);
  for (let i = 1; i < parts.length; i += 4) {
    const body = (parts[i + 3] ?? '').replace(/^\s*---\s*$/gm, '').replace(/<(https?:\/\/[^>]+)>/g, '`$1`').trim();
    out.push({ stage: Number(parts[i]), title: `${parts[i + 1] ?? ''}${parts[i + 2] ?? ''}`.trim(), body: clean(body) });
  }
  return out;
}
