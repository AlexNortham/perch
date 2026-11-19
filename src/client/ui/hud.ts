/**
 * The in-match HUD (GDD §12.4): crosshair and hit marker, health, stamina, abilities, ammo, Seeds, pod feedback and the
 * respawn timer. DOM built once; every frame only the cells whose value changed are written.
 */
import type { ItemDef, SimEvent, SimView } from '../../sim/core/contracts';
import { COMBAT } from '../../sim/data/combat';
import { TICK_RATE } from '../../sim/data/core';
import { HEROES } from '../../sim/heroes/registry';
import type { Bindings, Frame } from '../app/contracts';
import { ALLY_CSS, ENEMY_CSS, HIT_MARKER, MAX_TIER, POD_BANNER_MS } from './constants';
import { cooldownText } from './display';
import { dummies } from './model';
import { abilityDisplay, ammoText, healthDisplay, hitKind, keyLabel, respawnSeconds, staminaPips } from './display';
import { ViewFlag } from '../../sim/core/contracts';

const el = (cls: string, tag = 'div', parent?: HTMLElement): HTMLElement => {
  const e = document.createElement(tag);
  e.className = cls;
  parent?.append(e);
  return e;
};

/** A writer that touches the DOM only when the value changes. */
const cell = <T>(apply: (v: T) => void): ((v: T) => void) => {
  let last: T | undefined;
  return (v) => {
    if (v !== last) {
      last = v;
      apply(v);
    }
  };
};
const text = (e: HTMLElement): ((v: string) => void) => cell((v) => void (e.textContent = v));
const style = (e: HTMLElement, prop: 'transform' | 'width' | 'display'): ((v: string) => void) =>
  cell((v) => void (e.style[prop] = v));
const flag = (e: HTMLElement, cls: string): ((v: boolean) => void) => cell((v) => e.classList.toggle(cls, v));

const SLOT_KEYS = ['ability1', 'ability2', 'ability3', 'ability4'] as const;
const ITEM_KEYS = ['item1', 'item2', 'item3', 'item4'] as const;

export interface Hud {
  readonly root: HTMLElement;
  setBindings(b: Bindings): void;
  setCatalogue(items: readonly ItemDef[]): void;
  setPractice(on: boolean): void;
  onEvents(events: readonly SimEvent[], view: SimView): void;
  update(frame: Frame): void;
}

export function createHud(): Hud {
  const root = el('pu-hud');

  // Crosshair, hit marker, pod banner, death overlay.
  const cross = el('pu-cross', 'div', root);
  for (let i = 0; i < 5; i++) el('', 'i', cross);
  const hit = el('pu-hit', 'div', cross);
  const banner = el('pu-banner', 'div', root);
  const dead = el('pu-dead', 'div', root);
  text(el('', 'small', dead))('RESPAWNING IN');
  const deadSecs = el('', 'b', dead);

  // Bottom-left cluster.
  const cluster = el('pu-cluster', 'div', root);
  const bar = el('pu-bar', 'div', cluster);
  const hpSeg = el('pu-hp', 'div', bar);
  const talonSeg = el('pu-talon', 'div', bar);
  const songSeg = el('pu-song', 'div', bar);
  const barrierSeg = el('pu-barrier', 'div', bar);
  const hpText = el('', 'span', bar);
  const row = el('pu-row', 'div', cluster);
  const pipsBox = el('pu-pips', 'div', row);
  const level = el('', 'div', row);
  const ap = el('pu-ap', 'div', row);
  const seeds = el('pu-seeds', 'div', row);

  const abil = el('pu-abil', 'div', cluster);
  const slots = [0, 1, 2, 3].map((i) => {
    const s = el(i === 3 ? 'pu-slot ult' : 'pu-slot', 'div', abil);
    const name = el('nm', 'div', s);
    const key = el('key', 'div', s);
    const sweep = el('sweep', 'div', s);
    const cd = el('cd', 'div', s);
    const ch = el('ch', 'div', s);
    const lk = el('lk', 'div', s);
    lk.textContent = 'LOCKED';
    const tiers = el('tiers', 'div', s);
    const tierPips = Array.from({ length: MAX_TIER }, () => el('', 'i', tiers));
    return {
      s,
      setName: text(name),
      setKey: text(key),
      setSweep: style(sweep, 'transform'),
      setCd: text(cd),
      setCharges: text(ch),
      setLocked: flag(s, 'lock'),
      setReady: flag(s, 'rdy'),
      setUp: flag(s, 'up'),
      setTier: cell((t: number) => tierPips.forEach((p, n) => p.classList.toggle('on', n < t))),
    };
  });
  const ammoBox = el('pu-ammo', 'div', abil);
  const ammoMain = el('', 'span', ammoBox);
  const ammoSub = el('', 'small', ammoBox);
  const setAmmo = text(ammoMain);
  const setAmmoSub = text(ammoSub);
  const setReloading = flag(ammoBox, 'rl');
  const setLow = flag(ammoBox, 'low');

  // Item actives (Z, X, N, V): the first four active items in slot order.
  const actsBox = el('pu-acts', 'div', cluster);
  const acts = [0, 1, 2, 3].map(() => {
    const s = el('pu-act', 'div', actsBox);
    const key = el('key', 'div', s);
    const name = el('nm', 'div', s);
    const cd = el('cd', 'div', s);
    return { s, key: text(key), name: text(name), cd: text(cd), set: flag(s, 'on'), rdy: flag(s, 'rdy') };
  });
  let catalogue: readonly ItemDef[] = [];

  // Melee: the binding is always shown with tap and hold spelled out; charge, swing and parry fill live.
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
  let poseName = '';
  let poseFor = 0;
  const jumpCue = el('pu-jumpcue', 'div', root);
  const setJumpCue = style(jumpCue, 'display');
  const setJumpText = text(jumpCue);

  // Practice Hub dummies: live health bars with the last damage or heal each took.
  const dummyBox = el('pu-dummies', 'div', root);
  const setDummyBox = style(dummyBox, 'display');
  setDummyBox('none');
  const dummyRows = new Map<number, { bar: HTMLElement; fill: HTMLElement; name: HTMLElement; fb: HTMLElement; setFb: (v: string) => void }>();
  const lastFeedback = new Map<number, string>();
  let practice = false;

  const setHp = style(hpSeg, 'width');
  const setTalon = style(talonSeg, 'width');
  const setSong = style(songSeg, 'width');
  const setBarrier = style(barrierSeg, 'width');
  const setHpText = text(hpText);
  const setLevel = text(level);
  const setAp = text(ap);
  const setApOn = flag(ap, 'on');
  const setSeeds = text(seeds);
  const setDead = style(dead, 'display');
  const setDeadSecs = text(deadSecs);
  const setCluster = style(cluster, 'display');

  let pips: { fill: HTMLElement; set: (v: string) => void }[] = [];
  const pct = (f: number): string => `${Math.round(f * 1000) / 10}%`;
  const scale = (f: number): string => `scale(${Math.round(f * 100) / 100}, 1)`;
  let keys: Bindings | null = null;
  let heroKey = '';

  const flash = (target: HTMLElement, text: string, colour: string): void => {
    target.textContent = text;
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
      setDummyBox(on ? '' : 'none');
      if (!on) {
        dummyBox.replaceChildren();
        dummyRows.clear();
        lastFeedback.clear();
      }
    },
    onEvents(events, view) {
      const me = view.localHero;
      if (me === null) return;
      for (const e of events) {
        if (practice && e.type === 'damage.applied' && e.source === me) lastFeedback.set(e.target, `Hit -${Math.round(e.amount)}${e.beakShot ? ' (beak shot)' : ''}`);
        else if (practice && e.type === 'heal.applied' && e.source === me) lastFeedback.set(e.target, `Healed +${Math.round(e.amount)}`);
        if (e.type === 'damage.applied' && e.source === me && e.target !== me) {
          const m = HIT_MARKER[hitKind(e)];
          hit.style.setProperty('--c', m.colour);
          hit.animate(
            [
              { opacity: 1, transform: `scale(${m.scale * 1.25})` },
              { opacity: 0, transform: `scale(${m.scale})` },
            ],
            m.ms,
          );
        } else if (e.type === 'pod.resolved' && e.by === me) {
          flash(banner, e.outcome === 'secured' ? 'SECURED' : 'DENIED', e.outcome === 'secured' ? '#f2d46b' : '#ff6a5a');
        }
      }
    },
    update({ curr, dt }) {
      const h = curr.heroes.find((x) => x.id === curr.localHero);
      const ent = h && curr.entities.find((x) => x.id === h.id);
      if (!h || !ent) {
        setCluster('none');
        return;
      }
      setCluster('');
      const def = HEROES[h.heroId].def;
      const hd = healthDisplay(ent.hp, ent.maxHp, h);
      setHp(pct(hd.hp));
      setTalon(pct(hd.talon));
      setSong(pct(hd.song));
      setBarrier(pct(hd.barrier));
      setHpText(hd.text);

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
      setAp(`AP ${h.ap}`);
      setApOn(h.ap > 0);
      setSeeds(`Seeds ${h.seeds.toLocaleString('en-GB')}`);

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

      // Melee: tap light, hold heavy; charge, swing and parry from the live pose.
      const pose = ent.meleePose ?? '';
      if (pose !== poseName) {
        poseName = pose;
        poseFor = 0;
      } else poseFor += dt;
      const heavyHold = COMBAT.melee.heavyHoldS;
      setMeleeKey(keys ? keyLabel(keys.melee) : 'MELEE');
      setMeleeHelp('tap: light   hold: heavy');
      setMeleeMode(pose === '' ? 'idle' : pose === 'charging' && poseFor >= heavyHold ? 'ready' : pose);
      setMeleeState(
        pose === 'charging' ? (poseFor >= heavyHold ? 'HEAVY READY' : 'CHARGING') : pose === 'light' ? 'LIGHT' : pose === 'heavy' ? 'HEAVY' : pose === 'parry' ? 'PARRY' : '',
      );
      setMeleeFill(pct(pose === 'charging' ? Math.min(1, poseFor / heavyHold) : pose === 'parry' ? Math.max(0, 1 - poseFor / COMBAT.parry.windowS) : 0));
      const jumpReady = h.dashJumpReady === true;
      setJumpCue(jumpReady ? '' : 'none');
      setJumpText(`DASH-JUMP: press ${keys ? keyLabel(keys.jump) : 'JUMP'}`);

      if (practice) {
        const live = new Set<number>();
        for (const d of dummies(curr)) {
          live.add(d.id);
          let r = dummyRows.get(d.id);
          if (!r) {
            const row = el('pu-dummy', 'div', dummyBox);
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
      }

      if (heroKey !== h.heroId) {
        heroKey = h.heroId;
        slots.forEach((s, i) => {
          s.setName(def.abilities[i]?.name ?? '');
          s.setKey(keys ? keyLabel(keys[SLOT_KEYS[i] ?? 'ability1']) : '');
        });
      }
      h.abilities.forEach((a, i) => {
        const s = slots[i];
        if (!s) return;
        const d = abilityDisplay(a, def.abilities[i]?.charges ?? 1, curr.tick, h.ap);
        s.setLocked(d.locked);
        s.setReady(d.ready);
        s.setUp(d.canUpgrade);
        s.setSweep(`scaleY(${Math.round(d.sweep * 100) / 100})`);
        s.setCd(d.cooldown);
        s.setCharges(d.charges);
        s.setTier(d.tier);
      });

      const reloading = (ent.flags & ViewFlag.Reloading) !== 0;
      setAmmo(ammoText(h));
      setReloading(reloading);
      setAmmoSub(reloading ? 'RELOADING' : h.ammo === 0 ? `PRESS ${keys ? keyLabel(keys.reload) : 'RELOAD'}` : '');
      setLow(h.ammo <= Math.ceil(h.magazine * 0.2));

      const secs = respawnSeconds(h.respawnAt, curr.tick);
      setDead(secs === null ? 'none' : 'flex');
      if (secs !== null) setDeadSecs(String(secs));
    },
  };
}
