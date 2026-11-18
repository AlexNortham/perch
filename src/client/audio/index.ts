// TODO(Audio): WebAudio synthesis (guns, hits, beak-shot tick, a call per hero, structure alarms, Egg jingle, Roc
// roar), positional audio from the camera pose, adaptive music, volumes from Settings.
import type { AudioOut, Settings } from '../app/contracts';

export const createAudio: (settings: Settings) => AudioOut = () => ({
  onEvents: () => undefined,
  update: () => undefined,
  resume: () => undefined,
  setSettings: () => undefined,
  dispose: () => undefined,
});
