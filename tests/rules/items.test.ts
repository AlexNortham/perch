// The 64-item catalogue (GDD §10, D-EP-034). Written test-first (D-EP-006, W4.5 QA); always on since the W5a
// integration round, when Items landed all 64.
// Part 1: the catalogue's shape. Part 2: one effect test per item (64), each citing its §10 row. Part 3: behaviour
// tests for the 16 Stage 4 items and the active-item rules.
import { describe, expect, it } from 'vitest';
import { ITEM_BUTTONS, type EntityId, type HeroId, type ItemId, type StatId } from '../../src/sim/core/contracts';
import { ITEMS } from '../../src/sim/data/items';
import { TICK_RATE } from '../../src/sim/data/core';
import { createSandbox, type Sandbox } from '../helpers/sandbox';
import { heavyMelee } from '../helpers/world';
import { CATALOGUE } from './items.data';

const TIMEOUT_MS = 120_000;
const t = (s: number) => Math.ceil(s * TICK_RATE);
const byId = (id: string) => ITEMS.find((i) => i.id === id);

// ---- Part 1: the catalogue ------------------------------------------------------------------------------------------

describe('W5 the catalogue (§10)', () => {
  it('§10 holds 64 items: 21 Talon, 21 Plumage, 22 Song; 16 per tier', () => {
    expect(ITEMS).toHaveLength(64);
    expect(ITEMS.filter((i) => i.category === 'talon')).toHaveLength(21);
    expect(ITEMS.filter((i) => i.category === 'plumage')).toHaveLength(21);
    expect(ITEMS.filter((i) => i.category === 'song')).toHaveLength(22);
    for (const tier of [1, 2, 3, 4] as const) expect(ITEMS.filter((i) => i.tier === tier), `tier ${tier}`).toHaveLength(16);
    expect(new Set(ITEMS.map((i) => i.id)).size, 'ids are unique').toBe(64);
  });

  it('§10 tier costs are 800 / 1,600 / 3,200 / 6,400', () => {
    for (const i of ITEMS) expect(i.cost, i.id).toBe({ 1: 800, 2: 1600, 3: 3200, 4: 6400 }[i.tier]);
  });

  it('§10 15 actives, with the cooldowns the tables give; every other item has none', () => {
    expect(ITEMS.filter((i) => i.active)).toHaveLength(15);
    for (const row of CATALOGUE) expect(byId(row.id)?.active?.cooldownS ?? null, `${row.id} cooldown`).toBe(row.cooldownS);
  });

  it('§10 every row of the §10.1–10.3 tables exists with its category, tier, cost and component; 16 are Stage 4 (★)', () => {
    expect(CATALOGUE).toHaveLength(64);
    expect(CATALOGUE.filter((r) => r.stage4)).toHaveLength(16);
    for (const row of CATALOGUE) {
      const item = byId(row.id);
      expect(item, `${row.id} exists`).toBeDefined();
      expect(item).toMatchObject({ category: row.category, tier: row.tier, cost: row.cost, component: row.component });
    }
  });

  it('§10 component chains: every upgrade names a lower-tier item in the same catalogue', () => {
    for (const i of ITEMS.filter((x) => x.component)) {
      const c = byId(i.component!);
      expect(c, `${i.id} upgrades from ${i.component}`).toBeDefined();
      expect(c!.tier, `${i.id} tier above its component`).toBeLessThan(i.tier);
    }
  });

  it('§8.7 a hero can own at most 4 actives: a fifth active is refused, the Seeds are kept', async () => {
    const { sb, buyer, buy } = await shop();
    const pool = ITEMS.filter((i) => i.active && !i.component).map((i) => i.id);
    expect(pool.length, 'at least five actives are not upgrades').toBeGreaterThanOrEqual(5);
    for (const id of pool.slice(0, 4)) buy(id);
    expect(sb.hero(buyer).inventory.actives.filter(Boolean)).toHaveLength(4);
    const seeds = sb.hero(buyer).progress.seeds;
    buy(pool[4]!, false);
    expect(sb.hero(buyer).inventory.actives.filter(Boolean), 'still four').toHaveLength(4);
    expect(sb.hero(buyer).progress.seeds).toBe(seeds);
  });
});

// ---- Shared setup ---------------------------------------------------------------------------------------------------

interface Shop {
  readonly sb: Sandbox;
  readonly buyer: EntityId;
  readonly foe: EntityId;
  readonly ally: EntityId;
  buy(id: ItemId, expectOwned?: boolean): void;
  lane(distance?: number): void;
}

async function shop(hero: HeroId = 'shrike', regen = false): Promise<Shop> {
  const sb = await createSandbox({
    map: 'main', heroes: [hero, { hero: 'lyrebird', team: 'dusk' }, { hero: 'kingfisher', team: 'dawn' }],
    options: { structures: false, startSeeds: 200_000, unlockAbilities: true }, regen,
  });
  const [buyer, foe, ally] = sb.heroes as [EntityId, EntityId, EntityId];
  const roost = sb.ctx.map.shops.find((s) => s.kind === 'roost' && s.team === 'dawn')!;
  return {
    sb, buyer, foe, ally,
    buy(id, expectOwned = true) {
      sb.place(buyer, roost.pos);
      sb.trade(buyer, { buy: id });
      sb.step(2);
      if (expectOwned) expect(sb.hero(buyer).inventory.items.some((i) => i.item === id), `${id} bought`).toBe(true);
    },
    lane(distance = 10) {
      sb.place(buyer, { x: 0, y: 0, z: -65 }, 0);
      sb.place(foe, { x: 0, y: 0, z: -65 + distance }, Math.PI);
      sb.place(ally, { x: 4, y: 0, z: -65 + 6 }, Math.PI);
      sb.step(3);
    },
  };
}

/** A fresh hero's final stats, then the same hero owning `id`. */
async function owning(id: ItemId, hero: HeroId = 'shrike') {
  const s = await shop(hero, true);
  const before = { ...s.sb.hero(s.buyer).stats.final };
  s.buy(id);
  return { ...s, before, after: s.sb.hero(s.buyer).stats.final };
}

/** Additive (after − before ≈ v) or proportional (after / before ≈ 1 + v) change: both are honest ways to give "+v". */
function expectGain(label: string, before: number, after: number, v: number): void {
  const additive = Math.abs(after - before - v) <= Math.max(0.011, Math.abs(v) * 0.02);
  const scaled = before !== 0 && Math.abs(after / before - (1 + v)) <= 0.011;
  expect(additive || scaled, `${label}: ${before} → ${after}, wanted +${v}`).toBe(true);
}

// ---- Part 2: one effect test per item ------------------------------------------------------------------------------

/** GDD §10.1–10.3, stats column: [stat, change]. Conditional and active effects are tested in Part 3. */
const STATS: Readonly<Record<string, readonly (readonly [StatId, number])[]>> = {
  'quill-clip': [['magazine', 0.25], ['gunDamage', 0.06]], 'close-talons': [['closeGunDamage', 0.2]],
  'beak-whetstone': [['beakShotFlat', 35]], 'quick-preen': [['fireRate', 0.1], ['reloadSpeed', 0.15]],
  'foragers-talon': [['maxHealth', 100]], 'long-fletching': [['falloffRange', 0.45], ['bulletSpeed', 0.15], ['gunDamage', 0.08]],
  bloodbeak: [['talonLifesteal', 0.15], ['maxHealth', 75]], 'flurry-feathers': [['fireRate', 0.12], ['reloadSpeed', 0.15]],
  'hawkeye-lens': [['gunDamage', 0.15], ['beakShotFlat', 80]], 'pinion-shred': [['gunDamage', 0.1]],
  'skipping-stone': [['gunDamage', 0.08]], 'tailwind-volley': [['magazine', 0.35], ['gunDamage', 0.12]],
  'apex-talon': [['gunDamage', 0.4], ['fireRate', 0.1], ['magazine', 0.15]], 'carrion-feast': [['talonLifesteal', 0.28], ['maxHealth', 200]],
  'thunderclap-quills': [['gunDamage', 0.1]], 'talon-tempest': [['fireRate', 0.2], ['reloadSpeed', 0.2]],
  'hooked-spur': [['meleeDamage', 0.2], ['maxHealth', 60]], 'sourberry-rounds': [['gunDamage', 0.08], ['fireRate', 0.04]],
  'wasp-barbs': [['gunDamage', 0.06], ['songPower', 6]], 'stoop-dive': [['meleeDamage', 0.3], ['gunDamage', 0.1], ['maxHealth', 100]],
  'kestrel-eye': [['gunDamage', 0.25], ['falloffRange', 0.6], ['bulletSpeed', 0.15]],
  'down-padding': [['maxHealth', 160]], 'thick-quills': [['talonResist', 0.12], ['maxHealth', 50]], 'dew-drinker': [['healthRegen', 2.5]],
  featherlight: [['sprintSpeed', 1]], 'shade-ward': [['songResist', 0.15], ['maxHealth', 100]], 'healing-dew': [['healthRegen', 3]],
  'talon-bulwark': [['talonResist', 0.08]], 'second-wind': [['stamina', 1], ['moveSpeed', 0.5], ['sprintSpeed', 1]],
  'stout-breast': [['maxHealth', 450], ['talonResist', 0.06], ['songResist', 0.06]], 'preening-rite': [['statusResist', 0.12], ['maxHealth', 150]],
  'covey-ward': [['maxHealth', 150], ['songResist', 0.06]], 'iron-crest': [['statusResist', 0.25], ['maxHealth', 250], ['songResist', 0.12]],
  'second-clutch': [['maxHealth', 300]], 'thunderbird-heart': [['maxHealth', 750], ['healthRegen', 8], ['healAmp', 0.1]],
  'unbowed-crest': [['statusResist', 0.3], ['maxHealth', 350], ['songResist', 0.15]], 'nestmother-mantle': [['maxHealth', 400]],
  'grit-gizzard': [['songResist', 0.1], ['maxHealth', 60]], 'rescue-call': [['maxHealth', 125], ['healthRegen', 1.5]],
  'kite-lift': [['stamina', 1], ['moveSpeed', 0.5], ['sprintSpeed', 1.5], ['maxHealth', 150]],
  'burr-coat': [['maxHealth', 250], ['talonResist', 0.1]], 'heartwood-bark': [['maxHealth', 450], ['talonResist', 0.18], ['meleeDamageTaken', -0.3]],
  'lilt-seed': [['songPower', 8], ['maxHealth', 50]], 'quick-refrain': [['cooldownReduction', 0.08]],
  'carrying-voice': [['abilityRange', 0.15], ['songPower', 6]], 'mocking-note': [['songPower', 4]],
  'second-verse': [['abilityCharges', 1], ['cooldownReduction', 0.06], ['songPower', 4]], crescendo: [['songPower', 12]],
  'muting-whistle': [['songPower', 8]], 'long-chorus': [['abilityDuration', 0.2], ['songPower', 8]],
  'rising-song': [['songPower', 24], ['maxHealth', 150]], 'tempo-shift': [['cooldownReduction', 0.18], ['songPower', 8]],
  'song-siphon': [['songLifesteal', 0.18], ['songPower', 10]], 'whirlwind-knot': [['songPower', 10], ['maxHealth', 100]],
  encore: [['songPower', 15], ['cooldownReduction', 0.1]], 'gloom-curse': [['songPower', 18]],
  'boundless-song': [['songPower', 40], ['abilityRange', 0.2]], 'echo-chamber': [['songPower', 20]],
  'nettle-sting': [['songPower', 6]], 'warblers-trill': [['songPower', 6], ['fireRate', 0.04]],
  'tangle-pod': [['songPower', 8], ['maxHealth', 75]], 'blight-spores': [['songPower', 14]],
  'skylark-cadence': [['songPower', 24], ['fireRate', 0.1], ['cooldownReduction', 0.1]],
  'rookery-dirge': [['songPower', 20], ['maxHealth', 300], ['songResist', 0.1]],
};

describe('W5 one effect test per item: the stats column (§10)', { timeout: TIMEOUT_MS }, () => {
  it('the table below covers every one of the 64 catalogue rows', () => {
    for (const row of CATALOGUE) expect(STATS[row.id], `${row.id} has a §10 stats entry`).toBeDefined();
    expect(Object.keys(STATS)).toHaveLength(64);
  });

  it.each(CATALOGUE.map((r) => [r.id, r.name, r.tier] as const))('§10 %s (%s, tier %i): owning it gives the stats its row lists', async (id) => {
    const { before, after } = await owning(id);
    for (const [stat, v] of STATS[id] ?? []) expectGain(`${id} ${stat}`, before[stat], after[stat], v);
  });
});

// ---- Part 3: behaviours ---------------------------------------------------------------------------------------------

/** Fire the gun at the foe until `n` damage events from the weapon land (or the tick budget runs out). */
function shoot(s: Shop, n = 1, maxTicks = t(3)): void {
  const { sb, buyer, foe } = s;
  sb.aimAt(buyer, foe, 'body');
  sb.fire(buyer);
  sb.stepUntil(() => sb.eventsOf('damage.applied').filter((e) => e.source === buyer && e.target === foe && e.via === 'weapon').length >= n, maxTicks);
  sb.fire(buyer, false);
}
const songDamage = (sb: Sandbox, source: EntityId, target: EntityId) =>
  sb.eventsOf('damage.applied').filter((e) => e.source === source && e.target === target && e.damageType === 'song');
const ability = (sb: Sandbox, caster: EntityId, foe: EntityId, damage = 50): void => {
  sb.apply({ kind: 'damage', amount: damage, type: 'song' }, foe, sb.cause(caster, { via: 'ability' }));
  sb.step();
};

describe('W5 the Stage 4 items, in play (§10.1–10.3 ★)', { timeout: TIMEOUT_MS }, () => {
  it('★ Hooked Spur §10.1: a heavy melee hit on a hero slows it 25% for 1.5 s', async () => {
    const s = await shop();
    s.buy('hooked-spur');
    s.lane(1.4);
    heavyMelee(s.sb, s.buyer);
    expect(s.sb.hero(s.foe).stats.final.slow).toBeCloseTo(0.25, 2);
    s.sb.step(t(1.8));
    expect(s.sb.hero(s.foe).stats.final.slow).toBeCloseTo(0, 2);
  });

  it('★ Sourberry Rounds §10.1: gun hits on heroes apply 35% heal reduction for 2.5 s', async () => {
    const s = await shop();
    s.buy('sourberry-rounds');
    s.lane();
    shoot(s);
    expect(s.sb.hero(s.foe).stats.final.healReduction).toBeCloseTo(0.35, 2);
    s.sb.step(t(2.8));
    expect(s.sb.hero(s.foe).stats.final.healReduction).toBeCloseTo(0, 2);
  });

  it('★ Wasp Barbs §10.1: each shot that hits a hero also deals 8 + 0.15×SP Song damage', async () => {
    const s = await shop();
    s.buy('wasp-barbs');
    s.lane();
    shoot(s);
    const sp = s.sb.hero(s.buyer).stats.final.songPower;
    const extra = songDamage(s.sb, s.buyer, s.foe)[0];
    expect(extra, 'a Song hit rides the shot').toBeDefined();
    expect(extra!.amount).toBeCloseTo((8 + 0.15 * sp) * (1 - s.sb.hero(s.foe).stats.final.songResist), 0);
  });

  it('★ Stoop Dive §10.1: dash to the enemy hero nearest the crosshair within 18 m, strike for 140 Talon, 40% slow for 2 s, disarm 1 s; 30 s cooldown', async () => {
    const s = await shop();
    s.buy('stoop-dive');
    s.lane(14);
    s.sb.aimAt(s.buyer, s.foe, 'body');
    s.sb.press(s.buyer, ITEM_BUTTONS[s.sb.hero(s.buyer).inventory.actives.indexOf('stoop-dive')]!);
    s.sb.step(t(0.6));
    expect(Math.hypot(s.sb.hero(s.buyer).pos.x - s.sb.hero(s.foe).pos.x, s.sb.hero(s.buyer).pos.z - s.sb.hero(s.foe).pos.z), 'arrived beside it').toBeLessThan(2.5);
    const hit = s.sb.eventsOf('damage.applied').find((e) => e.target === s.foe && e.item === 'stoop-dive');
    expect(hit?.amount).toBeCloseTo(140 * (1 - s.sb.hero(s.foe).stats.final.talonResist), 0);
    expect(s.sb.hero(s.foe).stats.final.slow).toBeCloseTo(0.4, 2);
    expect(s.sb.hero(s.foe).stats.conditions.has('disarmed')).toBe(true);
    s.sb.step(t(1.2));
    expect(s.sb.hero(s.foe).stats.conditions.has('disarmed'), 'disarm is 1 s').toBe(false);
    expect(s.sb.hero(s.foe).stats.final.slow, 'slow is 2 s').toBeGreaterThan(0.3);
  });

  it('★ Stoop Dive §10.1: nothing happens with no enemy hero within 18 m of the crosshair', async () => {
    const s = await shop();
    s.buy('stoop-dive');
    s.lane(25);
    s.sb.aimAt(s.buyer, s.foe, 'body');
    s.sb.press(s.buyer, ITEM_BUTTONS[s.sb.hero(s.buyer).inventory.actives.indexOf('stoop-dive')]!);
    s.sb.step(t(0.8));
    expect(s.sb.eventsOf('damage.applied').filter((e) => e.item === 'stoop-dive')).toHaveLength(0);
  });

  it('★ Kestrel\'s Eye §10.1: gun hits from 25 m or farther deal +20% damage and reveal the target for 3 s', async () => {
    // Damage per gun hit, Kestrel's Eye's share included: the +20% may land as a repeat of the hit (D-SYS-014).
    const perHit = (s: Shop): number => {
      s.sb.step(2);
      const dealt = s.sb.eventsOf('damage.applied').filter((e) => e.source === s.buyer && e.target === s.foe);
      const hits = dealt.filter((e) => e.via === 'weapon').length;
      return dealt.filter((e) => e.via === 'weapon' || e.item === 'kestrel-eye').reduce((n, e) => n + e.amount, 0) / hits;
    };
    const near = await shop();
    near.buy('kestrel-eye');
    near.lane(15);
    shoot(near);
    const nearHit = perHit(near);
    const far = await shop();
    far.buy('kestrel-eye');
    far.lane(30);
    shoot(far);
    const farHit = perHit(far);
    expect(far.sb.hero(far.foe).stats.conditions.has('revealed'), 'revealed after a long-range hit').toBe(true);
    expect(near.sb.hero(near.foe).stats.conditions.has('revealed'), 'not from close range').toBe(false);
    expect(farHit / nearHit, '+20% beyond 25 m (falloff aside)').toBeGreaterThan(1.1);
    far.sb.step(t(3.4));
    expect(far.sb.hero(far.foe).stats.conditions.has('revealed'), 'reveal lasts 3 s').toBe(false);
  });

  it('★ Grit Gizzard §10.2: +10% Song resist and +60 HP reduce a real Song hit', async () => {
    const s = await shop();
    const raw = 200;
    s.sb.apply({ kind: 'damage', amount: raw, type: 'song' }, s.buyer, s.sb.cause(s.foe, { via: 'ability' }));
    s.sb.step();
    const without = s.sb.eventsOf('damage.applied').find((e) => e.target === s.buyer)!.amount;
    s.sb.clearEvents();
    s.buy('grit-gizzard');
    s.sb.apply({ kind: 'damage', amount: raw, type: 'song' }, s.buyer, s.sb.cause(s.foe, { via: 'ability' }));
    s.sb.step();
    expect(s.sb.eventsOf('damage.applied').find((e) => e.target === s.buyer)!.amount / without).toBeCloseTo(0.9 / (1 - s.sb.hero(s.buyer).stats.final.songResist + 0.1), 1);
  });

  it('★ Rescue Call §10.2: heals the allied hero nearest the crosshair within 25 m (or yourself) 150 + 1.0×SP over 3 s and gives +15% Talon and Song resist for 3 s; 40 s cooldown', async () => {
    const s = await shop();
    s.buy('rescue-call');
    s.lane();
    const sp = s.sb.hero(s.buyer).stats.final.songPower;
    s.sb.apply({ kind: 'damage', amount: 500, type: 'talon' }, s.ally, s.sb.cause(s.foe, { via: 'weapon' }));
    s.sb.apply({ kind: 'damage', amount: 500, type: 'talon' }, s.buyer, s.sb.cause(s.foe, { via: 'weapon' }));
    s.sb.step();
    const ally0 = s.sb.health(s.ally).hp;
    const self0 = s.sb.health(s.buyer).hp;
    s.sb.aimAt(s.buyer, s.ally, 'body');
    s.sb.press(s.buyer, ITEM_BUTTONS[s.sb.hero(s.buyer).inventory.actives.indexOf('rescue-call')]!);
    s.sb.step(t(3.3));
    expect(s.sb.health(s.ally).hp - ally0, 'the ally in the cone').toBeCloseTo(150 + sp, -1);
    expect(s.sb.health(s.buyer).hp, 'not you').toBe(self0);
    const cd = s.sb.hero(s.buyer).inventory.items.find((i) => i.item === 'rescue-call')!.readyAt;
    expect(cd - s.sb.sim.tick).toBeGreaterThan(t(40) - t(3.5));
    s.sb.step(t(41));
    s.sb.aimAt(s.buyer, { x: 0, y: 1, z: -200 });
    s.sb.press(s.buyer, ITEM_BUTTONS[s.sb.hero(s.buyer).inventory.actives.indexOf('rescue-call')]!);
    s.sb.step(t(3.3));
    expect(s.sb.health(s.buyer).hp - self0, 'selfFallback: nobody in the cone, so you').toBeGreaterThan(100);
  });

  it('★ Kite Lift §10.2: rise 8 m straight up, then glide up to 4 s falling at 2 m/s with +15% Talon resist while airborne; Jump ends it; 35 s cooldown', async () => {
    const s = await shop();
    s.buy('kite-lift');
    s.lane();
    const y0 = s.sb.hero(s.buyer).pos.y;
    const base = s.sb.hero(s.buyer).stats.final.talonResist;
    s.sb.press(s.buyer, ITEM_BUTTONS[s.sb.hero(s.buyer).inventory.actives.indexOf('kite-lift')]!);
    s.sb.step(t(1.5));
    expect(s.sb.hero(s.buyer).pos.y - y0, 'rose about 8 m').toBeGreaterThan(7);
    expect(s.sb.hero(s.buyer).motor.mode, 'gliding').toBe('glide');
    expect(s.sb.hero(s.buyer).stats.final.talonResist - base).toBeCloseTo(0.15, 2);
    const y1 = s.sb.hero(s.buyer).pos.y;
    s.sb.step(t(1));
    expect(y1 - s.sb.hero(s.buyer).pos.y, 'falls 2 m/s').toBeCloseTo(2, 0);
    s.sb.press(s.buyer, 1);
    s.sb.step(3);
    expect(s.sb.hero(s.buyer).motor.mode, 'Jump ends the glide').toBeNull();
  });

  it('★ Burr Coat §10.2: an enemy hero within 20 m who deals you gun damage takes 15% of it (before your resists) back as Song damage', async () => {
    const near = await shop();
    near.buy('burr-coat');
    near.lane(10);
    near.sb.apply({ kind: 'damage', amount: 100, type: 'talon' }, near.buyer, near.sb.cause(near.foe, { via: 'weapon' }));
    near.sb.step();
    const back = songDamage(near.sb, near.buyer, near.foe);
    expect(back).toHaveLength(1);
    expect(back[0]!.amount).toBeCloseTo(15 * (1 - near.sb.hero(near.foe).stats.final.songResist), 0);
    const far = await shop();
    far.buy('burr-coat');
    far.lane(25);
    far.sb.apply({ kind: 'damage', amount: 100, type: 'talon' }, far.buyer, far.sb.cause(far.foe, { via: 'weapon' }));
    far.sb.step();
    expect(songDamage(far.sb, far.buyer, far.foe), 'no reflection beyond 20 m').toHaveLength(0);
  });

  it('★ Heartwood Bark §10.2: a 500 Talon shield that refills after 8 s without damage, and −30% melee damage taken', async () => {
    const s = await shop();
    s.buy('heartwood-bark');
    s.sb.step(2);
    expect(s.sb.health(s.buyer).talonShield).toBe(500);
    s.sb.apply({ kind: 'damage', amount: 300, type: 'talon' }, s.buyer, s.sb.cause(s.foe, { via: 'weapon' }));
    s.sb.step();
    expect(s.sb.health(s.buyer).talonShield).toBeLessThan(500);
    s.sb.step(t(7));
    expect(s.sb.health(s.buyer).talonShield, 'not yet after 7 s').toBeLessThan(500);
    s.sb.step(t(2));
    expect(s.sb.health(s.buyer).talonShield, 'refilled after 8 s quiet').toBe(500);
    s.sb.clearEvents();
    s.sb.apply({ kind: 'damage', amount: 100, type: 'talon' }, s.buyer, s.sb.cause(s.foe, { via: 'melee' }));
    s.sb.step();
    const melee = s.sb.eventsOf('damage.applied').find((e) => e.target === s.buyer)!;
    expect(melee.amount).toBeCloseTo(100 * (1 - s.sb.hero(s.buyer).stats.final.talonResist) * 0.7, 0);
  });

  it('★ Nettle Sting §10.3: ability damage to heroes applies 25% heal reduction for 3 s', async () => {
    const s = await shop();
    s.buy('nettle-sting');
    s.lane();
    ability(s.sb, s.buyer, s.foe);
    expect(s.sb.hero(s.foe).stats.final.healReduction).toBeCloseTo(0.25, 2);
    s.sb.step(t(3.3));
    expect(s.sb.hero(s.foe).stats.final.healReduction).toBeCloseTo(0, 2);
  });

  it('★ Warbler\'s Trill §10.3: after you cast an ability, your next gun shot within 5 s that hits a hero deals +25 + 0.6×SP Song damage, once', async () => {
    const s = await shop();
    s.buy('warblers-trill');
    s.lane();
    const sp = s.sb.hero(s.buyer).stats.final.songPower;
    s.sb.cast(s.buyer, 0);
    s.sb.step(t(0.5));
    s.sb.clearEvents();
    shoot(s, 3, t(2));
    const extra = songDamage(s.sb, s.buyer, s.foe).filter((e) => e.item === 'warblers-trill' || e.proc);
    expect(extra, 'one rider only').toHaveLength(1);
    expect(extra[0]!.amount).toBeCloseTo((25 + 0.6 * sp) * (1 - s.sb.hero(s.foe).stats.final.songResist), 0);
  });

  it('★ Tangle Pod §10.2: lob a pod up to 25 m; it bursts in a 4 m radius for 70 + 0.8×SP Song, slowing 35% and grounding for 2 s; 35 s cooldown', async () => {
    const s = await shop();
    s.buy('tangle-pod');
    s.lane(15);
    const sp = s.sb.hero(s.buyer).stats.final.songPower;
    s.sb.aimAt(s.buyer, s.foe, 'body');
    s.sb.press(s.buyer, ITEM_BUTTONS[s.sb.hero(s.buyer).inventory.actives.indexOf('tangle-pod')]!);
    s.sb.step(t(1.2));
    const hit = songDamage(s.sb, s.buyer, s.foe)[0];
    expect(hit, 'the pod burst on the foe').toBeDefined();
    expect(hit!.amount).toBeCloseTo((70 + 0.8 * sp) * (1 - s.sb.hero(s.foe).stats.final.songResist), 0);
    expect(s.sb.hero(s.foe).stats.final.slow).toBeCloseTo(0.35, 2);
    expect(s.sb.hero(s.foe).stats.conditions.has('grounded')).toBe(true);
    s.sb.step(t(2.2));
    expect(s.sb.hero(s.foe).stats.conditions.has('grounded'), 'for 2 s').toBe(false);
  });

  it('★ Blight Spores §10.3: ability damage to heroes applies 40% heal reduction for 4 s and Blight, 3% of the target\'s current HP + 0.06×SP Song per second for 4 s', async () => {
    const s = await shop();
    s.buy('blight-spores');
    s.lane();
    const sp = s.sb.hero(s.buyer).stats.final.songPower;
    ability(s.sb, s.buyer, s.foe, 10);
    expect(s.sb.hero(s.foe).stats.final.healReduction).toBeCloseTo(0.4, 2);
    const hp = s.sb.health(s.foe).hp;
    s.sb.clearEvents();
    s.sb.step(t(4.2));
    const ticks = songDamage(s.sb, s.buyer, s.foe);
    const total = ticks.reduce((n, e) => n + e.amount, 0);
    // "3% of the target's current HP": read as each tick lands, so four seconds of it lie between the totals at the
    // starting and the ending HP.
    const blight = (current: number) => 4 * (0.03 * current + 0.06 * sp) * (1 - s.sb.hero(s.foe).stats.final.songResist);
    expect(total, 'four seconds of Blight').toBeLessThanOrEqual(blight(hp) + 1);
    expect(total, 'four seconds of Blight').toBeGreaterThanOrEqual(blight(hp - total) - 1);
    s.sb.clearEvents();
    s.sb.step(t(2));
    expect(songDamage(s.sb, s.buyer, s.foe), 'Blight is over').toHaveLength(0);
  });

  it('★ Skylark Cadence §10.3: after you cast, your next 3 gun hits on heroes within 6 s each deal +45 + 0.8×SP Song and slow 20% for 1 s', async () => {
    const s = await shop();
    s.buy('skylark-cadence');
    s.lane();
    const sp = s.sb.hero(s.buyer).stats.final.songPower;
    s.sb.cast(s.buyer, 0);
    s.sb.step(t(0.5));
    s.sb.clearEvents();
    shoot(s, 6, t(3));
    const extra = songDamage(s.sb, s.buyer, s.foe);
    expect(extra, 'exactly three riders').toHaveLength(3);
    for (const e of extra) expect(e.amount).toBeCloseTo((45 + 0.8 * sp) * (1 - s.sb.hero(s.foe).stats.final.songResist), 0);
  });

  it('★ Rookery Dirge §10.3: aura 12 m: enemy heroes inside take Song damage of 1.5% max HP + 0.05×SP per second and have −8% Song resist', async () => {
    const s = await shop();
    // Effective Song resist: resist less shred (−8% may be either). Measured before the foe walks into the aura.
    const resist = () => s.sb.hero(s.foe).stats.final.songResist - s.sb.hero(s.foe).stats.final.songShred;
    const resist0 = resist();
    s.buy('rookery-dirge');
    s.lane(10);
    const sp = s.sb.hero(s.buyer).stats.final.songPower;
    const max = s.sb.hero(s.foe).stats.final.maxHealth;
    s.sb.clearEvents();
    s.sb.step(t(3));
    const dealt = songDamage(s.sb, s.buyer, s.foe).reduce((n, e) => n + e.amount, 0);
    expect(dealt / 3, 'per second').toBeCloseTo((0.015 * max + 0.05 * sp) * (1 - (resist0 - 0.08)), -1);
    expect(resist() - resist0).toBeCloseTo(-0.08, 2);
    s.lane(16);
    s.sb.clearEvents();
    s.sb.step(t(3));
    expect(songDamage(s.sb, s.buyer, s.foe), 'outside 12 m: nothing').toHaveLength(0);
  });
});

describe('W5 the other actives and notable passives (§10)', { timeout: TIMEOUT_MS }, () => {
  it.each(CATALOGUE.filter((r) => r.cooldownS !== null).map((r) => [r.id, r.cooldownS] as const))(
    '§10 active %s: pressing its key fires item.activated and starts its cooldown', async (id, cd) => {
      const s = await shop();
      s.buy(id);
      s.lane(10);
      s.sb.aimAt(s.buyer, s.foe, 'body');
      s.sb.clearEvents();
      const key = ITEM_BUTTONS[s.sb.hero(s.buyer).inventory.actives.indexOf(id)]!;
      s.sb.press(s.buyer, key);
      s.sb.step(2);
      expect(s.sb.eventsOf('item.activated').filter((e) => e.item === id)).toHaveLength(1);
      const owned = s.sb.hero(s.buyer).inventory.items.find((i) => i.item === id)!;
      expect(owned.readyAt - s.sb.sim.tick, `${cd} s`).toBeGreaterThan(t(cd!) - t(1));
      expect(owned.readyAt - s.sb.sim.tick).toBeLessThanOrEqual(t(cd!));
    });

  it('§10 Second Clutch: when you would die, heal to 25% of max HP and become intangible for 1.5 s (150 s internal cooldown)', async () => {
    const s = await shop();
    s.buy('second-clutch');
    s.sb.apply({ kind: 'damage', amount: 1_000_000, type: 'talon' }, s.buyer, s.sb.cause(s.foe, { via: 'weapon' }));
    s.sb.step(2);
    expect(s.sb.health(s.buyer).dead, 'survives').toBe(false);
    expect(s.sb.health(s.buyer).hp).toBeCloseTo(s.sb.hero(s.buyer).stats.final.maxHealth * 0.25, -1);
    expect(s.sb.hero(s.buyer).stats.conditions.has('intangible')).toBe(true);
    s.sb.step(t(2));
    s.sb.apply({ kind: 'damage', amount: 1_000_000, type: 'talon' }, s.buyer, s.sb.cause(s.foe, { via: 'weapon' }));
    s.sb.step(2);
    expect(s.sb.health(s.buyer).dead, 'no second save inside 150 s').toBe(true);
  });

  it('§10 Nestmother\'s Mantle: a 15 m aura gives allied heroes (you included) +10% Talon and Song resist and +4 HP/s', async () => {
    const s = await shop('shrike', true); // keep regeneration: the sandbox otherwise multiplies healthRegen by 0
    s.buy('nestmother-mantle');
    s.lane(10);
    s.sb.step(t(1));
    const a = s.sb.hero(s.ally).stats.final;
    expect(a.talonResist).toBeCloseTo(0.1, 2);
    expect(a.songResist).toBeCloseTo(0.1, 2);
    expect(a.healthRegen).toBeGreaterThanOrEqual(4);
    expect(s.sb.hero(s.buyer).stats.final.talonResist, 'you too').toBeCloseTo(0.1, 6);
    expect(s.sb.hero(s.foe).stats.final.talonResist, 'not enemies').toBe(0);
  });
});
