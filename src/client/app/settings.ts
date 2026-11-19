import { DEFAULT_BINDINGS } from './bindings';
import type { BindAction, Bindings, Quality, Settings } from './contracts';

const STORAGE_KEY = 'perch.settings.v2';
const LEGACY_KEY = 'perch.settings.v1';
const QUALITIES: readonly Quality[] = ['low', 'medium', 'high'];
const FOV_MIN = 75;
const FOV_MAX = 110;
const SENSITIVITY_MIN = 0.1;
const SENSITIVITY_MAX = 5;

export const DEFAULT_SETTINGS: Settings = {
  sensitivity: 1,
  aimSensitivity: 1,
  invertY: false,
  crouchToggle: false,
  fovDeg: 90,
  bindings: DEFAULT_BINDINGS,
  volume: { master: 0.8, sfx: 1, music: 0.6 },
  quality: 'medium',
  damageNumbers: true,
};

/** localStorage, or null where it is blocked (privacy modes, some file:// pages). */
function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function num(v: unknown, fallback: number, min: number, max: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;
}

function obj(v: unknown): Record<string, unknown> {
  return typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : {};
}

/** Keep only well-formed known fields from stored JSON; everything else falls back to the defaults. */
export function sanitizeSettings(raw: unknown): Settings {
  const r = obj(raw);
  const d = DEFAULT_SETTINGS;
  const vol = obj(r['volume']);
  const keys = obj(r['bindings']);
  const bindings = Object.fromEntries(
    (Object.keys(d.bindings) as BindAction[]).map((a) => {
      const k = keys[a];
      return [a, typeof k === 'string' && k.length > 0 ? k : d.bindings[a]];
    }),
  ) as Bindings;
  return {
    sensitivity: num(r['sensitivity'], d.sensitivity, SENSITIVITY_MIN, SENSITIVITY_MAX),
    aimSensitivity: num(r['aimSensitivity'], d.aimSensitivity, SENSITIVITY_MIN, SENSITIVITY_MAX),
    invertY: typeof r['invertY'] === 'boolean' ? r['invertY'] : d.invertY,
    crouchToggle: typeof r['crouchToggle'] === 'boolean' ? r['crouchToggle'] : d.crouchToggle,
    fovDeg: num(r['fovDeg'], d.fovDeg, FOV_MIN, FOV_MAX),
    bindings,
    volume: {
      master: num(vol['master'], d.volume.master, 0, 1),
      sfx: num(vol['sfx'], d.volume.sfx, 0, 1),
      music: num(vol['music'], d.volume.music, 0, 1),
    },
    damageNumbers: typeof r['damageNumbers'] === 'boolean' ? r['damageNumbers'] : true,
    quality: QUALITIES.includes(r['quality'] as Quality) ? (r['quality'] as Quality) : d.quality,
  };
}

/** Stored settings, or the defaults when storage is blocked, empty or corrupt. */
export function loadSettings(store: Storage | null = storage()): Settings {
  try {
    const raw = store?.getItem(STORAGE_KEY);
    if (raw) return sanitizeSettings(JSON.parse(raw));
    const legacy = store?.getItem(LEGACY_KEY);
    if (!legacy) return DEFAULT_SETTINGS;
    const old = obj(JSON.parse(legacy));
    const bindings = { ...obj(old['bindings']) };
    // Reserve custom codes first. Only legacy defaults are candidates for migration.
    const migrateCrouch = bindings['crouch'] === 'ControlLeft' || !bindings['crouch'];
    const migrateSlot = bindings['item3'] === 'KeyC' || !bindings['item3'];
    const reserved = new Set((Object.keys(DEFAULT_BINDINGS) as BindAction[])
      .filter((a) => !(a === 'crouch' && migrateCrouch) && !(a === 'item3' && migrateSlot))
      .map((a) => bindings[a] ?? DEFAULT_BINDINGS[a]));
    const free = (preferred: string): string => {
      const code = [preferred, 'KeyH', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((c) => 'Key' + c),
        ...'0123456789'.split('').map((c) => 'Digit' + c)].find((candidate) => !reserved.has(candidate));
      if (!code) throw new Error('No free gameplay binding');
      reserved.add(code);
      return code;
    };
    if (migrateCrouch) bindings['crouch'] = free(DEFAULT_BINDINGS.crouch);
    if (migrateSlot) bindings['item3'] = free(DEFAULT_BINDINGS.item3);
    const migrated = sanitizeSettings({ ...old, bindings });
    saveSettings(migrated, store);
    return migrated;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

/** Persist settings; silently keeps them in memory only when storage is blocked or full. */
export function saveSettings(settings: Settings, store: Storage | null = storage()): void {
  try {
    store?.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Storage blocked or full: the settings still apply for this session.
  }
}
