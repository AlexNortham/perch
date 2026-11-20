// Triangle counts of the world's models per level of detail (D-ART-014): `npx tsx tests/anim/world-tris.ts`.
import { buildStructure } from '../../src/client/render/models/structures';
import { TEAM_COLOURS } from '../../src/client/render/palette';

const tri = (g: { index: { count: number } | null; getAttribute(n: string): { count: number } }): number => (g.index ? g.index.count : g.getAttribute('position').count) / 3;
for (const type of ['hawk', 'heron', 'warden', 'shrine', 'patron'] as const) {
  for (const team of ['dawn', 'dusk'] as const) {
    const t0 = performance.now();
    const b = buildStructure(type, team, TEAM_COLOURS[team], { radius: type === 'patron' ? 8 : type === 'warden' ? 1.5 : 2, height: 10 });
    const row = ([0, 1, 2] as const).map((l) => {
      const a = tri(b.arch(l, 0));
      const s = tri(b.statue(l, 0));
      const r = b.rings ? tri(b.rings(l)) : 0;
      return `${a + s + r} (${a}+${s}${r ? `+${r}` : ''})`;
    });
    console.log(`${type} ${team}: ${row.join(' | ')}  ${(performance.now() - t0).toFixed(0)} ms, height ${b.height.toFixed(2)}`);
  }
}
