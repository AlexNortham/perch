/**
 * The in-match HUD (GDD §12.4, G03 to G10): crosshair with the ammo count under it, the health gauge beside the bird,
 * the ability row at the bottom centre (hold the upgrade key to click an icon or press 1-4, D-EP-038), wallet, item
 * actives, the melee hint only when it applies, and the pop-ups that make gains and hard effects felt. DOM is built
 * once; every frame only the cells whose value changed are written.
 */
import { ViewFlag } from '../../sim/core/contracts';
import type { ItemDef, SimEvent, SimView } from '../../sim/core/contracts';
import { AP_COSTS } from '../../sim/data/abilities';
import { COMBAT } from '../../sim/data/combat';
import { TICK_RATE } from '../../sim/data/core';
import { HEROES } from '../../sim/heroes/registry';
import type { AppActions, Bindings, Frame } from '../app/contracts';
import { ABILITY_SLOTS, ALLY_CSS, CROSSHAIR_PARTS, ENEMY_CSS, HIT_MARKER, HIT_MARKER_POP, LOW_AMMO_FRACTION, MAX_TIER, POD_BANNER_MS, ULTIMATE_SLOT } from './constants';
import { abilityDisplay, ammoText, cooldownText, healthDisplay, hitKind, keyLabel, staminaPips } from './display';
import { attr, cell, display, el, flag, pct, text } from './dom';
import { entityName, FULL_CHUNK, meleeTargetNear, statusWord, stepChunk } from './hud-model';
import type { Chunk } from './hud-model';
import { dummies, upgradeDisplay } from './model';
import type { Callout } from './streaks';

const SLOT_KEYS = ['ability1', 'ability2', 'ability3', 'ability4'] as const;
const ITEM_KEYS = ['item1', 'item2', 'item3', 'item4'] as const;
/** The melee hint shows for a player's first minutes in a match, ever (G09); the total is kept in localStorage. */
const HINT_KEY = 'perch.hint.melee.seconds';
const HINT_FIRST_S = 120;
const HINT_SAVE_EVERY_S = 5;
/** Pop-up lifetimes in ms (G08, G10). */
const KILL_BADGE_MS = 1200;
const SEEDS_POP_MS = 800;
const ANNOUNCE_MS = 1500;
const MIN_SEEDS_POP = 10;
const MS_PER_S = 1000;
const PERCENT_ROUND = 100;
const style = (e: HTMLElement, prop: 'transform' | 'width' | 'height'): ((v: string) => void) => cell((v) => void (e.style[prop] = v));

const storage = (): Storage | null => {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

export interface Hud {
  readonly root: HTMLElement;
  setBindings(b: Bindings): void;
  setCatalogue(items: readonly ItemDef[]): void;
  setPractice(on: boolean): void;
  /** The upgrade key is held: the cursor is free and the ability row takes clicks. */
  setUpgrading(on: boolean): void;
  /** The pause menu is up: its own Swap bird button stands in for the on-screen one. */
  setPaused(on: boolean): void;
  onEvents(events: readonly SimEvent[], view: SimView, callouts: readonly Callout[]): void;
  update(frame: Frame): void;
}

export function createHud(actions: AppActions): Hud {
  const root = el('pu-hud');

  // Crosshair, hit marker, ammo, pop-ups, death overlay.
  const cross = el('pu-cross', 'div', root);
  for (let i = 0; i < CROSSHAIR_PARTS; i++) el('', 'i', cross);
  const hit = el('pu-hit', 'div', cross);
  const ammoBox = el('pu-ammo', 'div', cross);
  const ammoMain = el('', 'span', ammoBox);
  const ammoSub = el('', 'small', ammoBox);
  const killBadge = el('pu-killbadge', 'div', cross);
  const killBadgeText = el('', 'b', killBadge);
  const killBadgeSeeds = el('', 'small', killBadge);
  const seedsPop = el('pu-seedspop', 'div', cross);
  const banner = el('pu-banner', 'div', root);
  const announce = el('pu-announce', 'div', root);
  const announceMain = el('', 'b', announce);
  const announceSub = el('', 'small', announce);
  const statusEl = el('pu-statusword', 'div', root);
  const dead = el('pu-dead', 'div', root);
  text(el('', 'small', dead))('RESPAWNING IN');
  const deadSecs = el('', 'b', dead);

  // Health gauge beside the bird.
  const gauge = el('pu-gauge', 'div', root);
  const shell = el('shell', 'div', gauge);
  const chunkEl = el('chunk', 'div', shell);
  const stack = el('stack', 'div', shell);
  const hpSeg = el('hp', 'div', stack);
  const songSeg = el('song', 'div', stack);
  const talonSeg = el('talon', 'div', stack);
  const barrierSeg = el('barrier', 'div', stack);
  const hpNow = el('now', 'b', gauge);
  const hpMax = el('max', 'small', gauge);
  const pipsBox = el('pu-pips', 'div', gauge);
  const wallet = el('pu-wallet', 'div', root);
  const level = el('lv', 'span', wallet);
  const keep = el('keep', 'span', wallet);
  const ap = el('pu-ap', 'span', wallet);
  const seeds = el('pu-seeds', 'span', wallet);

  // Ability row: round icons, cooldown inside, key under, tier pips under; hold the upgrade key to click one.
  const bottom = el('pu-bottom', 'div', root);
  const abil = el('pu-abil', 'div', bottom);
  const slots = Array.from({ length: ABILITY_SLOTS }, (_, n) => n).map((i) => {
    const s = el(i === ULTIMATE_SLOT ? 'pu-slot ult' : 'pu-slot', 'div', abil);
    const ico = el('ico', 'button', s);
    ico.type = 'button';
    ico.tabIndex = -1;
    const name = el('nm', 'div', ico);
    const sweep = el('sweep', 'div', ico);
    const cd = el('cd', 'div', ico);
    const ch = el('ch', 'div', ico);
    const lk = el('lk', 'div', ico);
    lk.textContent = 'LOCKED';
    const key = el('key', 'div', s);
    const tiers = el('tiers', 'div', s);
    const tierPips = Array.from({ length: MAX_TIER }, () => el('', 'i', tiers));
    const card = el('pu-card-tip', 'div', s);
    const cardHead = el('hd', 'b', card);
    const cardDesc = el('', 'p', card);
    const cardTiers = el('', 'ul', card);
    const cardStat = el('stat', 'p', card);
    const cardCost = el('cost', 'p', card);
    ico.addEventListener('click', () => {
      if (ico.getAttribute('aria-disabled') !== 'true') actions.submit({ upgrade: i });
    });
    return {
      s,
      ico,
      name: text(name),
      setKey: text(key),
      setSweep: style(sweep, 'transform'),
      setCd: text(cd),
      setCharges: text(ch),
      setLocked: flag(s, 'lock'),
      setReady: flag(s, 'rdy'),
      setUp: flag(s, 'up'),
      setTier: cell((t: number) => tierPips.forEach((p, n) => p.classList.toggle('on', n < t))),
      aria: attr(ico, 'aria-label'),
      disabled: attr(ico, 'aria-disabled'),
      head: text(cardHead),
      desc: text(cardDesc),
      stat: text(cardStat),
      cost: text(cardCost),
      tiersList: cardTiers,
    };
  });
  const actsBox = el('pu-acts', 'div', bottom);
  const acts = Array.from({ length: ABILITY_SLOTS }, (_, n) => n).map(() => {
    const s = el('pu-act', 'div', actsBox);
    const key = el('key', 'div', s);
    const name = el('nm', 'div', s);
    const cd = el('cd', 'div', s);
    return { s, key: text(key), name: text(name), cd: text(cd), set: flag(s, 'on'), rdy: flag(s, 'rdy') };
  });
  const upHint = el('pu-uphint', 'div', root);
  let catalogue: readonly ItemDef[] = [];

  // Melee hint: only when a claimable target is near (and in a player's first minutes ever).
  const melee = el('pu-melee', 'div', root);
  const meleeKey = el('key', 'kbd', melee);
  const meleeHelp = el('help', 'span', melee);
  const meleeBar = el('bar', 'div', melee);
  const meleeFill = el('', 'i', meleeBar);
  const meleeState = el('st', 'b', melee);
  const setMeleeKey = text(meleeKey);
  const setMeleeHelp = text(meleeHelp);
  const setMeleeState = text(meleeState);
  const setMeleeFill = style(meleeFill, 'width');
  const setMeleeMode = cell((m: string) => void (melee.dataset['mode'] = m));
  const setMeleeShown = display(melee);
  let poseName = '';
  let poseFor = 0;
  let hintSeconds = Number(storage()?.getItem(HINT_KEY) ?? 0) || 0;
  let hintSavedAt = hintSeconds;
  const jumpCue = el('pu-jumpcue', 'div', root);
  const setJumpCue = display(jumpCue);
  const setJumpText = text(jumpCue);

  // Practice Hub: dummy health bars with the last damage each took, and the Swap bird button (D-EP-040).
  const dummyBox = el('pu-dummies', 'div', root);
  const setDummyBox = display(dummyBox);
  setDummyBox(false);
  const swap = el('pu-btn pu-swap', 'button', dummyBox);
  swap.type = 'button';
  swap.textContent = 'Swap bird';
  swap.addEventListener('click', () => actions.swapBird?.());
  const swapNote = el('note', 'small', dummyBox);
  const dummyRows = new Map<number, { bar: HTMLElement; fill: HTMLElement; name: HTMLElement; fb: HTMLElement; setFb: (v: string) => void }>();
  const lastFeedback = new Map<number, string>();
  let practice = false;
  const dummyList = el('list', 'div', dummyBox);
  dummyBox.insertBefore(dummyList, swap);

  const setHp = style(hpSeg, 'height');
  const setSong = style(songSeg, 'height');
  const setTalon = style(talonSeg, 'height');
  const setBarrier = style(barrierSeg, 'height');
  const setChunk = style(chunkEl, 'height');
  const setHpNow = text(hpNow);
  const setHpMax = text(hpMax);
  const setLevel = text(level);
  const setKeep = text(keep);
  const setKeepShown = display(keep);
  const setAp = text(ap);
  const setApOn = flag(ap, 'on');
  const setSeeds = text(seeds);
  const setDead = flag(dead, 'on');
  const setDeadSecs = text(deadSecs);
  const setGauge = display(gauge);
  const setWallet = display(wallet);
  const setBottom = display(bottom);
  const setStatus = text(statusEl);
  const setStatusShown = display(statusEl);
  const setUpHint = text(upHint);
  const setAmmo = text(ammoMain);

  let pips: { fill: HTMLElement; set: (v: string) => void }[] = [];
  const scale = (f: number): string => `scale(${Math.round(f * PERCENT_ROUND) / PERCENT_ROUND}, 1)`;
  let keys: Bindings | null = null;
  let heroKey = '';
  let chunk: Chunk = FULL_CHUNK;
  let killBadgeUntil = 0;
  let upgrading = false;
  let clock = 0;

  const animate = (target: HTMLElement, ms: number, from: Keyframe, to: Keyframe): void => void target.animate([from, to], ms);
  const popup = (target: HTMLElement, content: string, ms: number): void => {
    target.textContent = content;
    animate(target, ms, { opacity: 1, transform: 'translate(0,0) scale(1.15)' }, { opacity: 0, transform: 'translate(0,-24px) scale(1)' });
  };
  const flash = (target: HTMLElement, content: string, colour: string): void => {
    target.textContent = content;
    target.style.color = colour;
    target.animate(
      [
        { opacity: 1, transform: 'translateX(-50%) scale(1.15)' },
        { opacity: 1, transform: 'translateX(-50%) scale(1)', offset: 0.15 },
        { opacity: 0, transform: 'translateX(-50%) scale(1)' },
      ],
      POD_BANNER_MS,
    );
  };
  const say = (main: string, sub: string): void => {
    announceMain.textContent = main;
    announceSub.textContent = sub;
    announce.animate([{ opacity: 1 }, { opacity: 1, offset: 0.8 }, { opacity: 0 }], ANNOUNCE_MS);
  };

  return {
    root,
    setBindings(b) {
      keys = b;
      heroKey = '';
    },
    setCatalogue(items) {
      catalogue = items;
    },
    setPractice(on) {
      practice = on;
      setDummyBox(on);
      if (!on) {
        dummyList.replaceChildren();
        dummyRows.clear();
        lastFeedback.clear();
      }
    },
    setPaused(on) {
      swap.hidden = on;
    },
    setUpgrading(on) {
      upgrading = on;
      root.classList.toggle('upgrading', on);
    },
    onEvents(events, view, callouts) {
      const me = view.localHero;
      if (me === null) return;
      const mine = view.heroes.find((h) => h.id === me);
      const flex = events.some((e) => e.type === 'flexSlots' && e.team === mine?.team);
      for (const e of events) {
        if (practice && e.type === 'damage.applied' && e.source === me) lastFeedback.set(e.target, `Hit -${Math.round(e.amount)}${e.beakShot ? ' (beak shot)' : ''}`);
        else if (practice && e.type === 'heal.applied' && e.source === me) lastFeedback.set(e.target, `Healed +${Math.round(e.amount)}`);
        if (e.type === 'damage.applied' && e.source === me && e.target !== me) {
          const m = HIT_MARKER[hitKind(e)];
          hit.style.setProperty('--c', m.colour);
          hit.animate(
            [
              { opacity: 1, transform: `scale(${m.scale * HIT_MARKER_POP})` },
              { opacity: 0, transform: `scale(${m.scale})` },
            ],
            m.ms,
          );
        } else if (e.type === 'pod.resolved' && e.by === me) {
          flash(banner, e.outcome === 'secured' ? 'SECURED' : 'DENIED', e.outcome === 'secured' ? '#f2d46b' : '#ff6a5a');
        } else if (e.type === 'entity.died' && e.creditHero === me && e.victimKind === 'hero' && e.victim !== me && !e.revives) {
          killBadgeUntil = clock + KILL_BADGE_MS / MS_PER_S;
          killBadgeSeeds.textContent = '';
          popup(killBadge, '', KILL_BADGE_MS);
          killBadgeText.textContent = 'KILL';
        } else if (e.type === 'seeds.gained' && e.hero === me) {
          if (e.reason === 'heroKill' && clock < killBadgeUntil) killBadgeSeeds.textContent = `+${e.amount}`;
          else if (e.amount >= MIN_SEEDS_POP && e.reason !== 'heroKill') popup(seedsPop, `+${e.amount}`, SEEDS_POP_MS);
        } else if (e.type === 'hero.level' && e.hero === me) {
          const slot = e.unlockSlot === null ? null : HEROES[mine?.heroId ?? 'shrike'].def.abilities[e.unlockSlot]?.name;
          say(`LEVEL ${e.level}`, `+${e.ap} AP${slot ? `  •  ${slot} unlocked` : ''}`);
        } else if (e.type === 'entity.died' && e.victimKind === 'structure' && e.victimType !== 'patron' && e.victimType !== 'nest') {
          say(`${entityName({ kind: 'structure', team: e.victimTeam, type: e.victimType }).toUpperCase()} DESTROYED`, flex ? 'An extra item slot opens' : '');
        }
      }
      const own = callouts.find((c) => c.hero === me);
      if (own) say(own.text.toUpperCase(), '');
    },
    update({ curr, dt }) {
      clock += dt;
      const h = curr.heroes.find((x) => x.id === curr.localHero);
      const ent = h && curr.entities.find((x) => x.id === h.id);
      if (!h || !ent) {
        setGauge(false);
        setWallet(false);
        setBottom(false);
        return;
      }
      setGauge(true);
      setWallet(true);
      setBottom(true);
      const def = HEROES[h.heroId].def;

      // Health gauge: the real fill, the shield caps and the red chunk of recent damage.
      const hd = healthDisplay(ent.hp, ent.maxHp, h);
      const total = Math.max(1, ent.maxHp, ent.hp + h.talonShield + h.songShield + h.barrier);
      chunk = stepChunk(chunk, Math.max(0, ent.hp) / total, dt);
      setHp(pct(hd.hp));
      setSong(pct(hd.song));
      setTalon(pct(hd.talon));
      setBarrier(pct(hd.barrier));
      setChunk(pct(chunk.shown));
      setHpNow(String(Math.ceil(ent.hp)));
      setHpMax(`/ ${Math.ceil(ent.maxHp)}`);
      if (pips.length !== Math.round(h.staminaMax)) {
        pipsBox.replaceChildren();
        pips = staminaPips(h.staminaMax, h.staminaMax).map(() => {
          const pip = el('pu-pip', 'div', pipsBox);
          const fill = el('', 'i', pip);
          return { fill, set: style(fill, 'transform') };
        });
      }
      staminaPips(h.stamina, h.staminaMax).forEach((f, i) => pips[i]?.set(scale(f)));

      setLevel(`Lv ${h.level}`);
      const keepCount = h.keepsakes?.count ?? 0;
      setKeepShown(keepCount > 0);
      setKeep(`✦ ${keepCount}`);
      keep.title = Object.entries(h.keepsakes?.totals ?? {}).map(([stat, v]) => `${stat} ${v}`).join(', ');
      setAp(`AP ${h.ap}`);
      setApOn(h.ap > 0 || upgrading);
      setSeeds(`Seeds ${h.seeds.toLocaleString('en-GB')}`);
      setUpHint(upgrading ? `Click an ability or press ${keys ? keyLabel(keys.ability1) : '1'}-${keys ? keyLabel(keys.ability4) : '4'} to upgrade. Unspent AP: ${h.ap}` : '');

      // Item actives.
      acts.forEach((a, i) => {
        const id = h.actives[i] ?? null;
        const owned = id === null ? undefined : h.items.find((o) => o.item === id);
        a.set(id !== null);
        a.key(keys ? keyLabel(keys[ITEM_KEYS[i] ?? 'item1']) : '');
        a.name(id === null ? '' : (catalogue.find((c) => c.id === id)?.name ?? id));
        const left = owned ? Math.max(0, owned.readyAt - curr.tick) / TICK_RATE : 0;
        a.cd(cooldownText(left));
        a.rdy(id !== null && left <= 0);
      });

      // Melee hint: only with a claimable target near, or in the first minutes ever. Charge, swing and parry fill live.
      const pose = ent.meleePose ?? '';
      if (pose !== poseName) {
        poseName = pose;
        poseFor = 0;
      } else poseFor += dt;
      hintSeconds += dt;
      if (hintSeconds - hintSavedAt >= HINT_SAVE_EVERY_S) {
        hintSavedAt = hintSeconds;
        try {
          storage()?.setItem(HINT_KEY, String(Math.round(hintSeconds)));
        } catch {
          /* storage blocked: the hint just restarts its two minutes next time */
        }
      }
      const heavyHold = COMBAT.melee.heavyHoldS;
      setMeleeShown(pose !== '' || meleeTargetNear(curr) || hintSeconds < HINT_FIRST_S);
      setMeleeKey(keys ? keyLabel(keys.melee) : 'MELEE');
      setMeleeHelp('tap: light   hold: heavy');
      setMeleeMode(pose === '' ? 'idle' : pose === 'charging' && poseFor >= heavyHold ? 'ready' : pose);
      setMeleeState(
        pose === 'charging' ? (poseFor >= heavyHold ? 'HEAVY READY' : 'CHARGING') : pose === 'light' ? 'LIGHT' : pose === 'heavy' ? 'HEAVY' : pose === 'parry' ? 'PARRY' : '',
      );
      setMeleeFill(pct(pose === 'charging' ? Math.min(1, poseFor / heavyHold) : pose === 'parry' ? Math.max(0, 1 - poseFor / COMBAT.parry.windowS) : 0));
      const jumpKey = keys ? keyLabel(keys.jump) : 'JUMP';
      setJumpCue(h.updraftInReach === true || h.dashJumpReady === true);
      setJumpText(h.updraftInReach === true ? `HOLD ${jumpKey}: ride the updraft` : `DASH-JUMP: press ${jumpKey}`);

      // A strong effect on the local bird gets a word at the bottom centre.
      const word = statusWord(ent.flags, h.statuses);
      setStatusShown(word !== null);
      if (word !== null) setStatus(word);

      if (practice) {
        const live = new Set<number>();
        for (const d of dummies(curr)) {
          live.add(d.id);
          let r = dummyRows.get(d.id);
          if (!r) {
            const row = el('pu-dummy', 'div', dummyList);
            const name = el('nm', 'span', row);
            const bar = el('bar', 'div', row);
            bar.setAttribute('role', 'progressbar');
            const fill = el('', 'i', bar);
            const fb = el('fb', 'small', row);
            r = { bar, fill, name, fb, setFb: text(fb) };
            dummyRows.set(d.id, r);
          }
          const enemy = d.label === 'Enemy dummy';
          r.fill.style.background = enemy ? ENEMY_CSS : ALLY_CSS;
          r.fill.style.width = pct(d.maxHp > 0 ? d.hp / d.maxHp : 0);
          r.bar.setAttribute('aria-label', `${d.label} health`);
          r.bar.setAttribute('aria-valuemin', '0');
          r.bar.setAttribute('aria-valuemax', String(Math.round(d.maxHp)));
          r.bar.setAttribute('aria-valuenow', String(Math.round(d.hp)));
          const next = `${d.label}: ${HEROES[d.hero.heroId].def.name}  ${Math.ceil(d.hp)} / ${Math.ceil(d.maxHp)}`;
          if (r.name.textContent !== next) r.name.textContent = next;
          r.setFb(lastFeedback.get(d.id) ?? (enemy ? 'Shoot or cast at it' : 'Heal it back up'));
        }
        for (const [id, r] of dummyRows) {
          if (live.has(id)) continue;
          r.bar.parentElement?.remove();
          dummyRows.delete(id);
        }
        swapNote.textContent = `Hold ${keys ? keyLabel(keys.upgradeModifier) : 'Alt'} to use the cursor`;
      }

      if (heroKey !== h.heroId) {
        heroKey = h.heroId;
        slots.forEach((s, i) => {
          s.name(def.abilities[i]?.name ?? '');
          s.setKey(keys ? keyLabel(keys[SLOT_KEYS[i] ?? 'ability1']) : '');
          s.tiersList.replaceChildren();
          def.abilities[i]?.upgrades.forEach((u, t) => el('', 'li', s.tiersList, `Tier ${t + 1} (${AP_COSTS[t] ?? '?'} AP): ${u.description}`));
          s.head(`Ability ${i + 1}: ${def.abilities[i]?.name ?? ''}`);
          s.desc(def.abilities[i]?.description ?? '');
        });
      }
      h.abilities.forEach((a, i) => {
        const s = slots[i];
        if (!s) return;
        const d = abilityDisplay(a, def.abilities[i]?.charges ?? 1, curr.tick, h.ap);
        s.setLocked(d.locked);
        s.setReady(d.ready);
        s.setUp(d.canUpgrade);
        s.setSweep(`scaleY(${Math.round(d.sweep * PERCENT_ROUND) / PERCENT_ROUND})`);
        s.setCd(d.cooldown);
        s.setCharges(d.charges);
        s.setTier(d.tier);
        // The upgrade readout: what the click does now, or why it cannot.
        const u = upgradeDisplay(a, i, h.ap, a.nextUpgradeCost);
        const label = `Upgrade ${def.abilities[i]?.name ?? ''}`;
        s.aria(u.reason === null ? label : `${label}: ${u.reason}`);
        s.disabled(String(u.reason !== null));
        s.stat(`Tier ${u.tier} of ${MAX_TIER} learned.`);
        s.cost(u.reason === null ? `Next: tier ${u.tier + 1}, costs ${u.cost} AP. Unspent AP: ${h.ap}` : `${u.reason}. Unspent AP: ${h.ap}`);
        Array.from(s.tiersList.children).forEach((li, n) => {
          li.classList.toggle('done', n < u.tier);
          li.classList.toggle('next', n === u.tier);
        });
      });

      const reloading = (ent.flags & ViewFlag.Reloading) !== 0;
      setAmmo(ammoText(h));
      ammoBox.classList.toggle('rl', reloading);
      ammoBox.classList.toggle('low', h.ammo <= Math.ceil(h.magazine * LOW_AMMO_FRACTION));
      const sub = reloading ? 'RELOADING' : h.ammo === 0 ? `PRESS ${keys ? keyLabel(keys.reload) : 'RELOAD'}` : 'rounds';
      if (ammoSub.textContent !== sub) ammoSub.textContent = sub;

      const secs = h.respawnAt === null ? null : Math.max(0, Math.ceil((h.respawnAt - curr.tick) / TICK_RATE));
      setDead(secs !== null);
      if (secs !== null) setDeadSecs(String(secs));
    },
  };
}
