import type { Hasher } from './contracts';

/**
 * State hash for the determinism test: two independent 32-bit FNV-1a-style lanes over a canonical byte stream.
 * Numbers are hashed by their exact float64 bits, so any divergence, however small, changes the digest.
 */

const LANE_A_OFFSET = 0x811c9dc5;
const LANE_B_OFFSET = 0x01000193;
const LANE_A_PRIME = 0x01000193;
const LANE_B_PRIME = 0x5bd1e995;
const HEX = 16;
const DIGEST_HALF = 8;
const BYTE_MASK = 0xff;
const BITS_PER_BYTE = 8;
const BYTES_PER_WORD = 4;

/** Type tags keep e.g. [1, 2] and { a: 1, b: 2 } apart. */
const TAG = { undef: 0, nul: 1, bool: 2, num: 3, str: 4, arr: 5, obj: 6, map: 7, set: 8 } as const;

export interface CoreHasher extends Hasher {
  digest(): string;
}

export function createHasher(): CoreHasher {
  let a = LANE_A_OFFSET;
  let b = LANE_B_OFFSET;
  const f64 = new Float64Array(1);
  const u32 = new Uint32Array(f64.buffer);

  const byte = (x: number): void => {
    a = Math.imul(a ^ (x & BYTE_MASK), LANE_A_PRIME);
    b = Math.imul(b ^ (x & BYTE_MASK), LANE_B_PRIME);
  };
  const word = (w: number): void => {
    for (let i = 0; i < BYTES_PER_WORD; i++) byte(w >>> (i * BITS_PER_BYTE));
  };

  const h: CoreHasher = {
    num(n) {
      f64[0] = n;
      word(u32[0] as number);
      word(u32[1] as number);
    },
    str(s) {
      word(s.length);
      for (let i = 0; i < s.length; i++) word(s.charCodeAt(i));
    },
    value(v) {
      if (v === undefined) return byte(TAG.undef);
      if (v === null) return byte(TAG.nul);
      switch (typeof v) {
        case 'boolean':
          byte(TAG.bool);
          return byte(v ? 1 : 0);
        case 'number':
          byte(TAG.num);
          return h.num(v);
        case 'string':
          byte(TAG.str);
          return h.str(v);
        case 'object':
          break;
        default:
          throw new Error(`hash: unsupported ${typeof v}`);
      }
      if (Array.isArray(v)) {
        byte(TAG.arr);
        word(v.length);
        for (const x of v) h.value(x);
      } else if (v instanceof Map) {
        byte(TAG.map);
        word(v.size);
        for (const [k, x] of v) {
          h.value(k);
          h.value(x);
        }
      } else if (v instanceof Set) {
        byte(TAG.set);
        word(v.size);
        for (const x of v) h.value(x);
      } else {
        const obj = v as Record<string, unknown>;
        const keys = Object.keys(obj).sort();
        byte(TAG.obj);
        word(keys.length);
        for (const k of keys) {
          h.str(k);
          h.value(obj[k]);
        }
      }
    },
    digest() {
      return (a >>> 0).toString(HEX).padStart(DIGEST_HALF, '0') + (b >>> 0).toString(HEX).padStart(DIGEST_HALF, '0');
    },
  };
  return h;
}
