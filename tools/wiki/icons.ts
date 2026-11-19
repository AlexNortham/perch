// Procedural SVG art: item icons (shape by category, frame colour by tier, glyph by item) and the "coming soon" bird
// silhouette. Pure strings, no external assets.
import { hash } from './lib';

type Category = 'talon' | 'plumage' | 'song';
const TIER_COLOUR: Record<number, { frame: string; fill: string }> = {
  1: { frame: '#9aa3ad', fill: '#3b4249' },
  2: { frame: '#4fb36b', fill: '#1f3d2a' },
  3: { frame: '#4a8dff', fill: '#1a2f57' },
  4: { frame: '#f5a623', fill: '#4a3312' },
};
const ACCENT: Record<Category, string> = { talon: '#ff8a5c', plumage: '#8fd18a', song: '#b69cff' };

/** Outline path per category, in a 64 x 64 box: Talon is a claw-edged diamond, Plumage a shield, Song a rounded disc. */
const SHAPE: Record<Category, string> = {
  talon: 'M32 3 L61 32 L32 61 L3 32 Z',
  plumage: 'M10 6 H54 V32 C54 46 44 56 32 61 C20 56 10 46 10 32 Z',
  song: 'M32 3 A29 29 0 1 1 31.99 3 Z',
};

/** A simple glyph drawn from the item's id, so every icon differs without hand art: a ring of dots and strokes. */
function glyph(id: string, colour: string): string {
  const h = hash(id);
  const n = parseInt(h.slice(0, 4), 16);
  const m = parseInt(h.slice(4, 8), 16);
  const parts: string[] = [];
  const strokes = 3 + (n % 3);
  for (let i = 0; i < strokes; i++) {
    const a = ((n >> i) % 7) * 0.9 + i * (Math.PI * 2 / strokes);
    const r1 = 5 + ((m >> i) % 4);
    const r2 = 13 + ((m >> (i + 3)) % 8);
    const x1 = 32 + Math.cos(a) * r1, y1 = 32 + Math.sin(a) * r1;
    const x2 = 32 + Math.cos(a) * r2, y2 = 32 + Math.sin(a) * r2;
    parts.push(`<path d="M${x1.toFixed(1)} ${y1.toFixed(1)} Q${((x1 + x2) / 2 + 3).toFixed(1)} ${((y1 + y2) / 2 - 3).toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}" stroke="${colour}" stroke-width="3.2" fill="none" stroke-linecap="round"/>`);
  }
  parts.push(`<circle cx="32" cy="32" r="${3 + (n % 3)}" fill="${colour}"/>`);
  return parts.join('');
}

export function itemIcon(id: string, category: Category, tier: number): string {
  const t = TIER_COLOUR[tier] ?? TIER_COLOUR[1]!;
  const accent = ACCENT[category];
  const pips = Array.from({ length: tier }, (_, i) => `<circle cx="${32 + (i - (tier - 1) / 2) * 7}" cy="56" r="2" fill="${t.frame}"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64" role="img"><path d="${SHAPE[category]}" fill="${t.fill}" stroke="${t.frame}" stroke-width="3"/>${glyph(id, accent)}${category === 'plumage' ? '' : pips}</svg>\n`;
}

/** A styled bird silhouette card for heroes that are not built yet. */
export function silhouette(id: string, stage: number, archetype: string): string {
  const h = parseInt(hash(id).slice(0, 4), 16);
  const hue = h % 360;
  const body = 62 + (h % 18), crest = h % 3;
  const crestPath = crest === 0 ? 'M118 62 q8-22 18-14 q-4 8-6 16' : crest === 1 ? 'M116 60 l6-24 l6 22 l8-18 l2 24' : 'M118 64 q14-30 30-18 q-14 2-22 20';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 320" width="320" height="320" role="img">
<defs><linearGradient id="g${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="hsl(${hue} 22% 28%)"/><stop offset="1" stop-color="hsl(${hue} 18% 14%)"/></linearGradient></defs>
<rect width="320" height="320" fill="url(#g${id})"/>
<g fill="#0c0e12" opacity="0.88"><ellipse cx="160" cy="${190 - (body - 62)}" rx="${body}" ry="${body + 24}"/><circle cx="128" cy="96" r="30"/><path d="M96 100 L58 112 L96 122 Z"/><path d="${crestPath}"/><path d="M142 250 v38 m36-38 v38 M130 290 h28 M172 290 h28" stroke="#0c0e12" stroke-width="7" stroke-linecap="round" fill="none"/></g>
<circle cx="120" cy="92" r="4" fill="hsl(${hue} 60% 70%)"/>
<text x="160" y="40" text-anchor="middle" font-family="sans-serif" font-size="20" font-weight="700" fill="hsl(${hue} 40% 82%)">${archetype}</text>
<rect x="60" y="272" width="200" height="30" rx="15" fill="#f5a623"/><text x="160" y="293" text-anchor="middle" font-family="sans-serif" font-size="16" font-weight="700" fill="#1b1303">Coming in Stage ${stage}</text>
</svg>\n`;
}
