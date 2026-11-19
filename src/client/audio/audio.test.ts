// Pure-logic checks on the audio engine, run in Node against a fake context (no browser, so fast). The signal checks
// that need a real OfflineAudioContext live in e2e/audio.spec.ts.
import { describe, expect, it } from 'vitest';
import type { SimEvent, SimView } from '../../sim/core/contracts';
import { createAudio, MAX_DISTANCE, MAX_VOICES } from './index';

interface FakeNode { connect(): void; disconnect(): void; gain: { value: number; setTargetAtTime: (v: number) => void; setValueAtTime(): void; linearRampToValueAtTime(): void; exponentialRampToValueAtTime(): void }; [k: string]: unknown }
const fakeContext = () => {
  const gains: FakeNode[] = [];
  let created = 0;
  const node = (): FakeNode => {
    const n: FakeNode = {
      connect() {}, disconnect() {}, start() {}, stop() {}, setValueAtTime() {},
      gain: { value: 0, setTargetAtTime(v: number) { n.gain.value = v; }, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} },
      frequency: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} },
      Q: { value: 0 }, detune: { value: 0 },
      positionX: { value: 0 }, positionY: { value: 0 }, positionZ: { value: 0 },
    };
    return n;
  };
  const ctx = {
    currentTime: 0, sampleRate: 8000, destination: node(), listener: {},
    createGain: () => { const n = node(); gains.push(n); return n; },
    createPanner: () => { created++; return node(); },
    createOscillator: node, createBiquadFilter: node, createDynamicsCompressor: node, createBufferSource: node,
    createBuffer: () => ({ getChannelData: () => new Float32Array(16) }),
  };
  return { ctx: ctx as unknown as BaseAudioContext, gains, created: () => created };
};

const view = (): SimView => ({
  tick: 0, seconds: 5, localHero: 1, over: false, winner: null,
  heroes: [{ id: 1, heroId: 'owl', team: 'dawn' }, { id: 2, heroId: 'kingfisher', team: 'dusk' }],
  entities: [],
} as unknown as SimView);
const pose = { position: { x: 0, y: 0, z: 0 }, target: { x: 0, y: 0, z: -1 }, fovDeg: 90 };
const fire = (x: number): SimEvent => ({ type: 'weapon.fired', shooter: 2, muzzle: { x, y: 0, z: 0 }, dir: { x: 0, y: 0, z: -1 } }) as SimEvent;
const settings = (master: number, sfx: number, music: number) => ({ volume: { master, sfx, music } }) as never;

describe('voice allocation', () => {
  const setup = () => {
    const f = fakeContext();
    const audio = createAudio(settings(1, 1, 0), { ctx: f.ctx });
    const v = view();
    audio.update({ curr: v, prev: v, alpha: 1, dt: 0.016 }, pose);
    return { f, audio, v };
  };

  it('drops positional voices beyond the maximum distance and keeps those inside', () => {
    const { f, audio, v } = setup();
    const before = f.created();
    audio.onEvents([fire(MAX_DISTANCE + 10)], v);
    expect(f.created()).toBe(before);
    audio.onEvents([fire(MAX_DISTANCE - 10)], v);
    expect(f.created()).toBeGreaterThan(before);
  });

  it('caps live voices at MAX_VOICES by stealing the farthest of equal priority, never a nearer one for a farther one', () => {
    const { f, audio, v } = setup();
    for (let i = 0; i < MAX_VOICES; i++) audio.onEvents([fire(10 + (i % 40))], v);
    const full = f.created();
    audio.onEvents([fire(MAX_DISTANCE - 1)], v); // farther than all: refused, no new voice bus
    expect(f.created()).toBe(full);
    audio.onEvents([fire(1)], v); // nearer: steals the farthest one
    expect(f.created()).toBe(full + 1);
  });

  it('reset() frees every voice so new ones are accepted again', () => {
    const { f, audio, v } = setup();
    for (let i = 0; i < MAX_VOICES; i++) audio.onEvents([fire(10)], v);
    audio.reset!();
    const before = f.created();
    audio.onEvents([fire(MAX_DISTANCE - 1)], v);
    expect(f.created()).toBeGreaterThan(before);
  });
});

describe('settings maths', () => {
  it('drives master, sfx and music buses from the volume settings, live', () => {
    const f = fakeContext();
    const audio = createAudio(settings(0.8, 0.5, 0.25), { ctx: f.ctx });
    const [master, sfx, music] = f.gains.slice(0, 3).map((g) => g.gain);
    expect([master!.value, sfx!.value, music!.value]).toEqual([0.8, 0.5, 0.25]);
    audio.setSettings(settings(0, 1, 0.5));
    expect([master!.value, sfx!.value, music!.value]).toEqual([0, 1, 0.5]);
  });
});
