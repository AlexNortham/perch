// Mechanics pages: prose from tools/wiki/pages/*.md with {{blocks}} generated from the game's data modules.
import { HERO_IDS } from '../../src/sim/core/contracts';
import { HEROES } from '../../src/sim/heroes/registry';
import { AIR, CHIMNEY, DASH, DISPLACE, GROUND, MANTLE, SLIDE, UPDRAFT, VINE } from '../../src/sim/data/movement';
import { COMBAT } from '../../src/sim/data/combat';
import { CAMERA, CROUCH_SCALE, DEFAULT_AIM_ZOOM, OWL_AIM_ZOOM, PING_LIMIT, PING_WINDOW_SECONDS, TICK_RATE, CONCEDE_AFTER_SECONDS, TEAM_SIZE } from '../../src/sim/data/core';
import { AP_COSTS, COOLDOWN_REDUCTION_CAP, UNIT_TARGET_CONE_DEG, UNLOCK_LEVELS, CHARGE_LOCKOUT_S } from '../../src/sim/data/abilities';
import { ECONOMY } from '../../src/sim/data/economy';
import { SHOP, DEW } from '../../src/sim/data/items';
import { FLEDGLINGS, VISION } from '../../src/sim/data/world';
import { DEFAULT_SETTINGS } from '../../src/client/app/settings';
import { FOV_RANGE, SENSITIVITY_RANGE } from '../../src/client/ui/constants';
import { STATUSES, isBuilt } from './facts';
import { esc, num, pct } from './lib';
import type { Ctx } from './generate';

const DEG = 180 / Math.PI;
/** Player-facing explanation of every status; the generator refuses to build a status without one. */
const STATUS_TEXT: Record<string, string> = {
  stun: 'No movement, gun, melee, parry, abilities or items. Interrupts channels and reloads.',
  silence: 'No abilities and no item actives. Gun and melee still work.',
  disarm: 'No gun fire. Melee, abilities and items still work.',
  root: 'No walking, jumping, dashing or movement abilities. You can still shoot and cast other abilities.',
  grounded: 'No dash, jump, Updraft, Chimney, Vine or movement abilities. You can still walk.',
  reveal: 'Shown on the enemy minimap and outlined through walls for the enemy flock.',
  trueSight: 'The holder sees invisible enemies within the effect radius.',
  invisible: 'Unseen by enemies beyond a short range. Firing, melee or casting ends it unless the source says otherwise.',
  unstoppable: 'Immune to stun, silence, disarm, root, grounded, slow and displacement; those are removed when it starts.',
  intangible: 'Takes no damage and no statuses; cannot be targeted; shots pass through.',
  undying: 'Health cannot fall below 1 while it lasts.',
  carried: 'Held in another bird\'s pouch: stunned and intangible.',
  eggCarrier: 'Carrying the Golden Egg: slowed, revealed and unable to fire or cast.',
  slow: 'Reduces movement speed by the stated fraction. Only the strongest slow applies, and speed never drops below the floor.',
  fireRateSlow: 'Reduces fire rate. Only the strongest instance applies.',
  healReduction: 'Reduces all healing received, including regeneration. Only the strongest instance applies.',
  damageAmp: 'Increases Talon and Song damage taken. Instances add together, up to a cap.',
  talonAmp: 'Increases Talon damage taken. Instances add together, up to a cap.',
  songAmp: 'Increases Song damage taken. Instances add together, up to a cap.',
  talonShred: 'Lowers Talon resist. Instances add together.',
  songShred: 'Lowers Song resist. Instances add together.',
  bleed: 'Talon damage over time, ticking every effect tick. Each source has its own instance; reapplying refreshes it.',
  burn: 'Song damage over time, ticking every effect tick. Each source has its own instance; reapplying refreshes it.',
};

export const table = (head: string[], rows: (string | number)[][], numeric: number[] = []): string =>
  `<div class="table-wrap"><table><thead><tr>${head.map((h, i) => `<th${numeric.includes(i) ? ' class="num"' : ''}>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c, i) => `<td${numeric.includes(i) ? ' class="num"' : ''}>${typeof c === 'number' ? num(c) : c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;

const oneLine = (s: string): string => s.replace(/\n/g, ' ');

/** Expand `{{name}}` lines in prose to generated single-line HTML. */
export function withBlocks(src: string, blocks: Record<string, () => string>): string {
  return src.split('\n').map((line) => {
    const m = /^\{\{([\w-]+)\}\}\s*$/.exec(line);
    if (!m) return line;
    const fn = blocks[m[1] ?? ''];
    if (!fn) throw new Error(`wiki: prose uses unknown block {{${m[1]}}}`);
    return oneLine(fn());
  }).join('\n');
}

const move = (name: string, rows: [string, string][]): string => `<h3>${esc(name)}</h3>${table(['Rule', 'Value'], rows)}`;

export function registerMechanics(ctx: Ctx): void {
  const built = HERO_IDS.filter(isBuilt);
  const blocks: Record<string, () => string> = {
    'pose-movement': () => ctx.figure('pose:movement'),
    'pose-shots': () => `<div class="gallery">${ctx.figure('pose:movement')}${ctx.figure('pose:melee')}${ctx.figure('pose:status')}</div>`,
    'hero-speeds': () => table(['Bird', 'Move speed', 'Sprint bonus', 'Stamina pips', 'Pip recharge'],
      built.map((id) => { const s = HEROES[id].def.stats; return [ctx.link(`heroes/${id}`, HEROES[id].def.name), `${num(s.moveSpeed ?? 0)} m/s`, `+${num(s.sprintSpeed ?? 0)} m/s`, num(s.stamina ?? 0), `${num(s.staminaRecharge ?? 0)} s`]; })),
    'move-ground': () => move('Running, sprinting and crouching', [
      ['Acceleration', `${num(GROUND.accel)} m/s²`], ['Deceleration with no input', `${num(GROUND.decel)} m/s²`], ['Crouch-walk speed', `${num(GROUND.crouchSpeed)} m/s`],
      ['Sprint starts after leaving combat for', `${num(GROUND.sprintDelayS)} s`], ['Sprint ramps in over', `${num(GROUND.sprintRampS)} s`],
      ['Step-up height (stairs and kerbs)', `${num(GROUND.stepUp)} m`], ['Steepest walkable slope', `${num(GROUND.maxSlope * DEG, 0)}°`],
      ['Slows never take speed below', `${num(GROUND.minSlowedSpeed)} m/s`], ['Crouching scales height by', `×${num(CROUCH_SCALE)}`],
    ]),
    'move-air': () => move('Jumping and air control', [
      ['Jump height', `${num(AIR.jumpApex)} m`], ['Jump stamina cost', `${num(AIR.jumpCost)} pip`], ['Gravity', `${num(AIR.gravity)} m/s²`], ['Terminal fall speed', `${num(AIR.maxFallSpeed)} m/s`],
      ['Coyote time (jump just after leaving a ledge)', `${num(AIR.coyoteS)} s`], ['Jump buffer (press just before landing)', `${num(AIR.jumpBufferS)} s`], ['Air acceleration', `${num(AIR.accel)} m/s²`],
      ['Wall kick: push off / launch up', `${num(AIR.wall.push)} / ${num(AIR.wall.launch)} m/s`], ['Wall kick: repeat cost and fatigue', `${num(AIR.wall.repeatCost)} pip, ${num(AIR.wall.fatigueS)} s`],
    ]),
    'move-dash': () => move('Dash, dash-jump and down-dash', [
      ['Ground dash distance', `${num(DASH.groundDistance)} m in ${num(DASH.durationS)} s`], ['Air dash distance', `${num(DASH.airDistance)} m`], ['Dash cost', `${num(DASH.cost)} pip`], ['Lockout between dashes', `${num(DASH.lockoutS)} s`],
      ['Exit speed', `run speed + ${num(DASH.exitBonus)} m/s`], ['Dash-jump window', `${num(DASH.jumpWindowOpenS)} to ${num(DASH.jumpWindowCloseS)} s after the dash starts`], ['Dash-jump extra cost', `${num(DASH.jumpCost)} pip`],
      ['Dash-jump speed', `${num(DASH.jumpHorizontal)} m/s forward, ${num(DASH.jumpVertical)} m/s up`], ['Down-dash (tap crouch in air)', `${num(DASH.down.speed)} m/s, ${num(DASH.down.cost)} pip`],
    ]),
    'move-slide': () => move('Slide', [
      ['Minimum speed to start', `${num(SLIDE.minSpeed)} m/s`], ['Start boost', `+${num(SLIDE.boost)} m/s (cap ${num(SLIDE.maxStartSpeed)} m/s)`], ['Boost cooldown', `${num(SLIDE.boostCooldownS)} s`],
      ['Flat-ground decay to crouch speed', `${num(SLIDE.decayS)} s`], ['Downhill gain from slopes over', `${num(SLIDE.minSlope * DEG, 0)}°, up to ${num(SLIDE.maxSlopeSpeed)} m/s`], ['Steering', `${num(SLIDE.steerPerS * DEG, 0)}°/s`],
    ]),
    'move-mantle': () => move('Mantle', [
      ['Ledge heights', `${num(MANTLE.minHeight)} to ${num(MANTLE.maxHeight)} m`], ['Duration', `${num(MANTLE.durationS)} s`], ['Reach', `${num(MANTLE.reach)} m`], ['Exit speed', `${pct(MANTLE.exitSpeedFraction, 0)} of entry speed`],
    ]),
    'move-world': () => move('Updrafts, Chimneys and Vines', [
      ['Updraft ride speed', `${num(UPDRAFT.rideSpeed)} m/s`], ['Updraft boost', `${num(UPDRAFT.boostSpeed)} m/s for ${num(UPDRAFT.boostS)} s, ${num(UPDRAFT.boostCooldownS)} s cooldown`],
      ['Latch by holding Jump for', `${num(UPDRAFT.latchHoldS)} s within ${num(UPDRAFT.reach)} m of the cable (a tap never latches)`], ['Latch in mid-air within', `${num(UPDRAFT.airReach)} m`], ['No latch for', `${num(UPDRAFT.damageLockoutS)} s after taking hero damage, or ${num(UPDRAFT.leaveLockoutS)} s after leaving`], ['No boost for', `${num(UPDRAFT.boostDamageLockS)} s after taking hero damage`],
      ['Dismount hop', `${num(UPDRAFT.dismountUp)} m/s up, keeps ${pct(UPDRAFT.dismountKeep, 0)} of speed`], ['Chimney lift speed', `${num(CHIMNEY.liftSpeed)} m/s (shaft radius ${num(CHIMNEY.radius)} m)`],
      ['Vine climb / shimmy speed', `${num(VINE.climbSpeed)} / ${num(VINE.shimmySpeed)} m/s`], ['Vine jump-off speed', `${num(VINE.jumpOffSpeed)} m/s`],
    ]),
    'move-displace': () => move('Being knocked about', [
      ['Air control while displaced', `${pct(DISPLACE.airControl, 0)} of normal`], ['Longest knock-up', `${num(DISPLACE.knockUpMaxS)} s`], ['Wall slam needs speed of at least', `${num(DISPLACE.wallSlamSpeed)} m/s`],
    ]),
    'camera-table': () => table(['Setting', 'Value'], [
      ['Shoulder offset', `${num(CAMERA.shoulderRight)} m right, ${num(CAMERA.shoulderUp)} m up (swap with the shoulder key)`], ['Camera boom', `${num(CAMERA.boom)} m for a ${num(CAMERA.referenceHeight)} m bird, between ${num(CAMERA.boomMin)} and ${num(CAMERA.boomMax)} m`],
      ['Look pitch limits', `${num(CAMERA.pitchMin * DEG, 0)}° to +${num(CAMERA.pitchMax * DEG, 0)}°`], ['Aim ray length', `${num(CAMERA.aimRange)} m`],
      ['Aiming zoom (right mouse)', `FOV ×${num(DEFAULT_AIM_ZOOM)}; ×${num(OWL_AIM_ZOOM)} for the Owl`], ['Field of view (Options)', `${FOV_RANGE[0]}° to ${FOV_RANGE[1]}°, default ${DEFAULT_SETTINGS.fovDeg}°`],
      ['Mouse sensitivity (Options)', `${SENSITIVITY_RANGE[0]} to ${SENSITIVITY_RANGE[1]}, default ${DEFAULT_SETTINGS.sensitivity}`], ['Pings', `at most ${PING_LIMIT} per ${PING_WINDOW_SECONDS} s`],
    ]),
    'combat-numbers': () => table(['Rule', 'Value'], [
      ['Beak shot (gun hit on the head)', `×${num(COMBAT.beakShotMult)} by default (Owl ×2)`], ['Ability beak shots', `×${num(COMBAT.abilityBeakShotMult)}`], ['Falloff floor', `${pct(COMBAT.falloffFloor, 0)} of damage beyond the falloff end`],
      ['Close range (Close Talons)', `${num(COMBAT.closeGunRange)} m`], ['Spread multiplier while airborne / aiming', `×${num(COMBAT.spreadAirborneMult)} / ×${num(COMBAT.spreadAimMult)}`],
      ['Resist limits', `${pct(COMBAT.resistMin, 0)} to ${pct(COMBAT.resistMax, 0)}`], ['Damage amplification cap', `+${pct(COMBAT.ampCap, 0)}`], ['Status resist cap', pct(COMBAT.statusResistCap, 0)],
      ['Structures take', `${pct(COMBAT.structureMeleeMult, 0)} melee, ${pct(COMBAT.structureSongMult, 0)} Song, nothing from areas or damage over time; weak point ×${num(COMBAT.weakPointMult)}`],
      ['Lifesteal from non-heroes', `${pct(COMBAT.lifestealNonHeroMult, 0)} effective`], ['In combat for', `${num(COMBAT.combatStateS)} s after dealing or taking hero damage, firing or casting`], ['Assist window', `${num(COMBAT.assistWindowS)} s`],
      ['Skipping Stone bounce', `${num(COMBAT.bounce.radius)} m, ${pct(COMBAT.bounce.fraction, 0)} damage`], ['Cooldown reduction cap', pct(COOLDOWN_REDUCTION_CAP, 0)], ['Unit-targeted abilities lock within', `${num(UNIT_TARGET_CONE_DEG)}° of the crosshair`],
      ['Multi-charge abilities', `${num(CHARGE_LOCKOUT_S)} s between uses`], ['Simulation rate', `${TICK_RATE} ticks per second`],
    ]),
    'melee-table': () => table(['Melee', 'Value'], [
      ['Tap (light) swing', `${num(COMBAT.melee.lightHitS)} s to hit, ${num(COMBAT.melee.lightTotalS)} s total; damage is your melee stat (${num(COMBAT.melee.lightDamage)} at level 1)`],
      ['Hold (heavy) swing', `hold ${num(COMBAT.melee.heavyHoldS)} s, then ${num(COMBAT.melee.heavyWindupS)} s wind-up and ${num(COMBAT.melee.heavyRecoveryS)} s recovery`],
      ['Heavy damage', `light × ${num(COMBAT.melee.heavyMult)} + ${num(COMBAT.melee.heavyFlat)}`], ['Heavy lunge / knockback', `${num(COMBAT.melee.heavyLungeM)} m / ${num(COMBAT.melee.heavyKnockbackM)} m`], ['Reach / radius', `${num(COMBAT.melee.reachM)} m / ${num(COMBAT.melee.radiusM)} m`],
      ['Parry', `opens after ${num(COMBAT.parry.delayS)} s, lasts ${num(COMBAT.parry.windowS)} s; stuns the attacker for ${num(COMBAT.parry.stunS)} s; a miss locks you out for ${num(COMBAT.parry.whiffLockoutS)} s; ${num(COMBAT.parry.cooldownS)} s cooldown`],
    ]),
    'guns-table': () => table(['Bird', 'Gun', 'Damage', 'Rate', 'Magazine', 'Falloff', 'Range', 'Type'],
      built.map((id) => { const d = HEROES[id].def; const w = d.weapon; return [ctx.link(`heroes/${id}`, d.name), esc(w.name), `${num(d.stats.weaponDamage ?? 0)}${w.pellets > 1 ? ` × ${w.pellets}` : ''}`, `${num(w.fireRate)}/s`, num(d.stats.magazine ?? 0), `${num(w.falloff.start)}-${num(w.falloff.end)} m`, `${num(w.range)} m`, w.hitscan ? 'Hitscan' : `Projectile ${num(w.projectileSpeed)} m/s`]; }), [2, 3, 4]),
    'status-table': () => table(['Status', 'Kind', 'Default length', 'Stacking', 'What it does'],
      STATUSES.map((s) => {
        const text = STATUS_TEXT[s.id];
        if (!text) throw new Error(`wiki: status "${s.id}" has no explanation; add it to STATUS_TEXT in tools/wiki/mechanics.ts`);
        return [`<span id="status-${s.id}"></span><strong>${esc(s.name)}</strong>`, s.negative ? 'Harmful' : 'Beneficial', `${num(s.durationS as number)} s`, esc(s.stacking), esc(text)];
      })),
    'economy-core': () => table(['Rule', 'Value'], [
      ['Starting Seeds', num(ECONOMY.startSeeds)], ['Passive income', `${num(ECONOMY.passivePerSecond)} Seed per second from ${num(ECONOMY.passiveFromS)} s`], ['Highest level', num(ECONOMY.levels.max)],
      ['Seeds to reach level L', `${num(ECONOMY.levels.baseCost)} × (L − 1) + ${num(ECONOMY.levels.costGrowth)} × (L − 1) × (L − 2)`],
      ['Ultimate unlocks at level', num(UNLOCK_LEVELS[3])], ['Ability Point cost of tiers 1, 2, 3', AP_COSTS.join(', ')], ['Item slots', `${SHOP.baseSlots} base, 4 flex`],
      ['Health regeneration bonus', `+${num(DEW.bonusRegen)} HP/s after ${num(DEW.quietSeconds)} s without damage (Dew Drinker style items)`],
    ]),
    'levels-table': () => {
      const rows: (string | number)[][] = [];
      let totalAp = 0;
      for (let level = 1; level <= ECONOMY.levels.max; level++) {
        const worth = ECONOMY.levels.baseCost * (level - 1) + ECONOMY.levels.costGrowth * (level - 1) * (level - 2);
        const ap = level === 1 ? 0 : level % ECONOMY.levels.doubleApEvery === 0 ? 2 : 1;
        totalAp += ap;
        rows.push([level, worth, ap, totalAp, level === 1 ? 'Abilities 1 to 3 usable' : level === UNLOCK_LEVELS[3] ? 'Ultimate unlocks' : level === ECONOMY.levels.max ? 'Everything upgradable' : '']);
      }
      return table(['Level', 'Net worth (Seeds)', 'AP gained', 'Total AP', 'Notes'], rows, [0, 1, 2, 3]);
    },
    'pods-table': () => table(['Pod rule', 'Value'], [
      ['Share of the fledgling\'s value held by the pod', pct(ECONOMY.pod.shareOfValue, 0)], ['Instant share for the last hit', pct(ECONOMY.fledgling.instantShare, 0)], ['Securer gets', 'the whole pod share'], ['Denier gets', `${pct(ECONOMY.pod.denyFraction, 0)} of the pod share`],
      ['Pod rises', `${num(ECONOMY.pod.riseM)} m over ${num(ECONOMY.pod.riseS)} s (can\'t be hit)`], ['Ripe for', `${num(ECONOMY.pod.ripeS)} s`], ['Heroes within this range share an unclaimed kill', `${num(ECONOMY.fledgling.shareRange)} m`],
      ['Fledgling value', `base × min(${num(ECONOMY.fledgling.growthCap)}, 1 + ${num(ECONOMY.fledgling.growthPerMin, 3)} × minutes)`], ['Base values', Object.entries(ECONOMY.fledgling.base).map(([k, v]) => `${k} ${v}`).join(', ')],
    ]),
    'fledgling-values': () => table(['Match time', ...Object.keys(ECONOMY.fledgling.base).map((k) => `${k[0]?.toUpperCase()}${k.slice(1)} value`)],
      [0, 10, 20, 30, 40].map((min) => [`${min}:00`, ...Object.values(ECONOMY.fledgling.base).map((b) => num(Math.floor(b * Math.min(ECONOMY.fledgling.growthCap, 1 + ECONOMY.fledgling.growthPerMin * min))))]), [1, 2]),
    'bounty-table': () => table(['Bounty rule', 'Value'], [
      ['Base bounty', num(ECONOMY.bounty.base)], ['Plus', `${pct(ECONOMY.bounty.worthFraction, 0)} of the victim's net worth`], ['Shut-down bonus', `${num(ECONOMY.bounty.perStreakKill)} per kill the victim made since their last death beyond ${ECONOMY.bounty.freeKills}, up to ${num(ECONOMY.bounty.streakCap)}`],
      ['Comeback multiplier', `1 + min(${num(ECONOMY.bounty.comebackCap)}, ${ECONOMY.bounty.comebackRate} × how much richer the victim's flock is, as a fraction)`], ['Kills by non-heroes', `shared by enemy heroes within ${num(ECONOMY.bounty.shareRange)} m`],
      ['Split', 'equally between the killer and every assister'],
    ]),
    'objective-bounties': () => table(['Objective', 'Seeds to every hero of the destroying flock', 'Flex slots unlocked'],
      [['Sentinel Hawk', ECONOMY.objective.hawk, ECONOMY.flexAwards.hawk], ['Stilt Heron', ECONOMY.objective.heron, ECONOMY.flexAwards.heron], ['Nest Warden', ECONOMY.objective.warden, ECONOMY.flexAwards.warden], ['Roost Shrine', ECONOMY.objective.shrine, ECONOMY.flexAwards.shrine]], [1, 2]),
    'respawn-table': () => table(['Match time', 'Respawn'], [0, 5, 10, 20, 30, 40].map((m) => [`${m}:00`, `${num(Math.min(COMBAT.respawn.maxS, COMBAT.respawn.baseS + COMBAT.respawn.perMinuteS * m))} s`]), [1]),
    'respawn-rule': () => `<p>Respawn time is the smaller of ${num(COMBAT.respawn.maxS)} and ${num(COMBAT.respawn.baseS)} + ${num(COMBAT.respawn.perMinuteS)} × minutes, rounded to ${num(COMBAT.respawn.roundS)} s. The Phoenix Ember buff multiplies it by ${num(COMBAT.respawn.emberMult)}.</p>`,
    'vision-table': () => table(['Source', 'Sees up to'], [['Hero', VISION.hero], ['Fledgling', VISION.fledgling], ['Structure', VISION.structure], ['Invisible enemies are spotted within', VISION.invisible], ['True sight (default)', VISION.trueSight]].map(([k, v]) => [String(k), `${num(Number(v))} m`])),
    'team-numbers': () => `<p>Each flock has ${TEAM_SIZE} heroes. A flock may concede after ${num(CONCEDE_AFTER_SECONDS / 60, 0)} minutes. A scrapper has ${FLEDGLINGS.scrapper.hp} HP and a slinger ${FLEDGLINGS.slinger.hp} at the start of the match.</p>`,
  };

  const page = (path: string, section: string, parent: string | undefined, prose: string, description: string, keywords = ''): void => {
    ctx.add({
      path, title: ctx.prose(prose).title, section, ...(parent ? { parent } : {}), description, keywords,
      body: () => {
        const p = ctx.prose(prose);
        return `<h1>${esc(p.title)}</h1>${ctx.md(withBlocks(p.body, blocks))}`;
      },
    });
  };
  page('mechanics/index.html', 'Mechanics', undefined, 'mechanics', 'How PERCH plays: movement, aim, combat, statuses, economy and vision.', 'rules guide mechanics');
  page('mechanics/movement.html', 'Mechanics', 'mechanics/index.html', 'movement', 'Every move in PERCH with its numbers.', 'run sprint jump dash slide mantle updraft chimney vine stamina crouch');
  page('mechanics/camera-aim.html', 'Mechanics', 'mechanics/index.html', 'camera-aim', 'The third-person camera, aiming and the crosshair.', 'camera aim crosshair shoulder fov sensitivity ping');
  page('mechanics/combat.html', 'Mechanics', 'mechanics/index.html', 'combat', 'Talon vs Song, resists, beak shots, falloff, melee and parry.', 'damage talon song resist beak shot falloff melee parry heavy gun');
  page('mechanics/statuses.html', 'Mechanics', 'mechanics/index.html', 'statuses', 'Every status effect: stun, silence, slow and more.', 'status stun silence disarm root slow reveal invisible unstoppable bleed burn');
  page('mechanics/economy.html', 'Mechanics', 'mechanics/index.html', 'economy', 'Seeds, pods, last hits, levels, Ability Points, Molts, bounties and respawn.', 'seeds pods secure deny last hit levels ap molts bounty comeback flex respawn');
  page('mechanics/vision.html', 'Mechanics', 'mechanics/index.html', 'vision', 'What you and your flock can see.', 'vision fog sight reveal');
}
