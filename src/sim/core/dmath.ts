/* eslint-disable @typescript-eslint/no-magic-numbers -- published fdlibm coefficients and IEEE-754 bit masks */
/**
 * Deterministic transcendental functions for the sim (D-ARCH-021).
 *
 * ECMAScript leaves `Math.sin`, `cos`, `tan`, `atan2`, `asin`, `acos` and `hypot` "implementation-approximated", and
 * engines really do differ: Node 22 (V8 12.4) and Edge 156 disagree in the last bit on 3–18 % of inputs, which is what
 * split the siege replay hash from tick 3. Everything here uses only + − × ÷ and `Math.sqrt`, which IEEE-754 rounds
 * exactly, so every engine returns the same bits.
 *
 * The algorithms are Sun's fdlibm 5.3 as V8 ships them, and `hypot` is V8's own builtin, so results equal Node 22's
 * `Math` bit for bit inside the sim's ranges and saved hashes stay valid. The sim never calls those `Math` functions;
 * `dmath.test.ts` scans `src/sim` to keep it so.
 */

const f64 = new Float64Array(1);
const u32 = new Uint32Array(f64.buffer);
// Little-endian on every engine PERCH runs on (x86-64 and ARM64).
const LO = 0;
const HI = 1;

function hi(x: number): number {
  f64[0] = x;
  return (u32[HI] as number) | 0;
}
function lo(x: number): number {
  f64[0] = x;
  return u32[LO] as number;
}
/** x with its low 32 bits cleared. */
function zeroLow(x: number): number {
  f64[0] = x;
  u32[LO] = 0;
  return f64[0];
}
function fromWords(h: number, l: number): number {
  u32[HI] = h >>> 0;
  u32[LO] = l >>> 0;
  return f64[0] as number;
}

// ---- sin / cos / tan kernels on [-π/4, π/4] (k_sin.c, k_cos.c, k_tan.c) ----

const S1 = -1.66666666666666324348e-1;
const S2 = 8.33333333332248946124e-3;
const S3 = -1.98412698298579493134e-4;
const S4 = 2.75573137070700676789e-6;
const S5 = -2.50507602534068634195e-8;
const S6 = 1.58969099521155010221e-10;

function kernelSin(x: number, y: number, iy: number): number {
  const ix = hi(x) & 0x7fffffff;
  if (ix < 0x3e400000 && Math.trunc(x) === 0) return x;
  const z = x * x;
  const v = z * x;
  const r = S2 + z * (S3 + z * (S4 + z * (S5 + z * S6)));
  if (iy === 0) return x + v * (S1 + z * r);
  return x - (z * (0.5 * y - v * r) - y - v * S1);
}

const C1 = 4.16666666666666019037e-2;
const C2 = -1.38888888888741095749e-3;
const C3 = 2.48015872894767294178e-5;
const C4 = -2.75573143513906633035e-7;
const C5 = 2.0875723212981748279e-9;
const C6 = -1.13596475577881948265e-11;

function kernelCos(x: number, y: number): number {
  const ix = hi(x) & 0x7fffffff;
  if (ix < 0x3e400000 && Math.trunc(x) === 0) return 1;
  const z = x * x;
  const r = z * (C1 + z * (C2 + z * (C3 + z * (C4 + z * (C5 + z * C6)))));
  if (ix < 0x3fd33333) return 1 - (0.5 * z - (z * r - x * y));
  const qx = ix > 0x3fe90000 ? 0.28125 : fromWords(ix - 0x00200000, 0);
  const hz = 0.5 * z - qx;
  const a = 1 - qx;
  return a - (hz - (z * r - x * y));
}

const T = [
  3.33333333333334091986e-1, 1.33333333333201242699e-1, 5.39682539762260521377e-2, 2.18694882948595424599e-2,
  8.86323982359930005737e-3, 3.59207910759131235356e-3, 1.45620945432529025516e-3, 5.88041240820264096874e-4,
  2.46463134818469906812e-4, 7.817944429395570923e-5, 7.14072491382608190305e-5, -1.85586374855275456654e-5,
  2.59073051863633712884e-5,
] as const;
const PIO4 = 7.85398163397448278999e-1;
const PIO4_LO = 3.06161699786838301793e-17;

/** -1/(x+r), computed carefully (k_tan.c). */
function negRecip(x: number, r: number, w: number): number {
  const z = zeroLow(w);
  const v = r - (z - x);
  const a = -1 / w;
  const t = zeroLow(a);
  const s = 1 + t * z;
  return t + a * (s + t * v);
}

function kernelTan(xIn: number, yIn: number, iy: number): number {
  let x = xIn;
  let y = yIn;
  const hx = hi(x);
  const ix = hx & 0x7fffffff;
  if (ix < 0x3e300000 && Math.trunc(x) === 0) {
    if ((ix | lo(x) | (iy + 1)) === 0) return 1 / Math.abs(x);
    if (iy === 1) return x;
    return negRecip(x, y, x + y);
  }
  const big = ix >= 0x3fe59428;
  if (big) {
    if (hx < 0) {
      x = -x;
      y = -y;
    }
    x = PIO4 - x + (PIO4_LO - y);
    y = 0;
  }
  const z = x * x;
  let w = z * z;
  let r = T[1] + w * (T[3] + w * (T[5] + w * (T[7] + w * (T[9] + w * T[11]))));
  const v = z * (T[2] + w * (T[4] + w * (T[6] + w * (T[8] + w * (T[10] + w * T[12])))));
  const s = z * x;
  r = y + z * (s * (r + v) + y);
  r += T[0] * s;
  w = x + r;
  if (big) return (1 - ((hx >> 30) & 2)) * (iy - 2 * (x - ((w * w) / (w + iy) - r)));
  if (iy === 1) return w;
  return negRecip(x, r, w);
}

// ---- argument reduction by π/2 (e_rem_pio2.c) ----

const INV_PIO2 = 6.36619772367581382433e-1;
const PIO2_1 = 1.57079632673412561417;
const PIO2_1T = 6.07710050650619224932e-11;
const PIO2_2 = 6.0771005063039659766e-11;
const PIO2_2T = 2.02226624879595063154e-21;
const PIO2_3 = 2.0222662487111664558e-21;
const PIO2_3T = 8.47842766036889956997e-32;
const NPIO2_HW = [
  0x3ff921fb, 0x400921fb, 0x4012d97c, 0x401921fb, 0x401f6a7a, 0x4022d97c, 0x4025fdbb, 0x402921fb, 0x402c463a,
  0x402f6a7a, 0x4031475c, 0x4032d97c, 0x40346b9c, 0x4035fdbb, 0x40378fdb, 0x403921fb, 0x403ab41b, 0x403c463a,
  0x403dd85a, 0x403f6a7a, 0x40407e4c, 0x4041475c, 0x4042106c, 0x4042d97c, 0x4043a28c, 0x40446b9c, 0x404534ac,
  0x4045fdbb, 0x4046c6cb, 0x40478fdb, 0x404858eb, 0x404921fb,
] as const;

/** x = n·π/2 + (y0 + y1); returns n and writes y0, y1 into `rem`. Callers have already handled |x| ≤ π/4 and NaN/∞. */
const rem: [number, number] = [0, 0];
function remPio2(x: number): number {
  const hx = hi(x);
  const ix = hx & 0x7fffffff;
  if (ix < 0x4002d97c) {
    // |x| < 3π/4: n = ±1
    const sign = hx > 0 ? 1 : -1;
    let z = x - sign * PIO2_1;
    let t = PIO2_1T;
    if (ix === 0x3ff921fb) {
      z -= sign * PIO2_2;
      t = PIO2_2T;
    }
    rem[0] = z - sign * t;
    rem[1] = z - rem[0] - sign * t;
    return sign;
  }
  // ponytail: no Payne–Hanek for |x| > 2^19·π/2; the medium path stays deterministic but loses accuracy there.
  // Sim angles are wrapped or small; port __kernel_rem_pio2 if one ever is not.
  const t0 = Math.abs(x);
  const n = Math.floor(t0 * INV_PIO2 + 0.5);
  const fn = n;
  let r = t0 - fn * PIO2_1;
  let w = fn * PIO2_1T;
  if (n < 32 && ix !== NPIO2_HW[n - 1]) {
    rem[0] = r - w;
  } else {
    const j = ix >> 20;
    rem[0] = r - w;
    let i = j - ((hi(rem[0]) >> 20) & 0x7ff);
    if (i > 16) {
      let t = r;
      w = fn * PIO2_2;
      r = t - w;
      w = fn * PIO2_2T - (t - r - w);
      rem[0] = r - w;
      i = j - ((hi(rem[0]) >> 20) & 0x7ff);
      if (i > 49) {
        t = r;
        w = fn * PIO2_3;
        r = t - w;
        w = fn * PIO2_3T - (t - r - w);
        rem[0] = r - w;
      }
    }
  }
  rem[1] = r - rem[0] - w;
  if (hx < 0) {
    rem[0] = -rem[0];
    rem[1] = -rem[1];
    return -n;
  }
  return n;
}

export function sin(x: number): number {
  const ix = hi(x) & 0x7fffffff;
  if (ix <= 0x3fe921fb) return kernelSin(x, 0, 0);
  if (ix >= 0x7ff00000) return NaN;
  switch (remPio2(x) & 3) {
    case 0:
      return kernelSin(rem[0], rem[1], 1);
    case 1:
      return kernelCos(rem[0], rem[1]);
    case 2:
      return -kernelSin(rem[0], rem[1], 1);
    default:
      return -kernelCos(rem[0], rem[1]);
  }
}

export function cos(x: number): number {
  const ix = hi(x) & 0x7fffffff;
  if (ix <= 0x3fe921fb) return kernelCos(x, 0);
  if (ix >= 0x7ff00000) return NaN;
  switch (remPio2(x) & 3) {
    case 0:
      return kernelCos(rem[0], rem[1]);
    case 1:
      return -kernelSin(rem[0], rem[1], 1);
    case 2:
      return -kernelCos(rem[0], rem[1]);
    default:
      return kernelSin(rem[0], rem[1], 1);
  }
}

export function tan(x: number): number {
  const ix = hi(x) & 0x7fffffff;
  if (ix <= 0x3fe921fb) return kernelTan(x, 0, 1);
  if (ix >= 0x7ff00000) return NaN;
  const n = remPio2(x);
  return kernelTan(rem[0], rem[1], 1 - ((n & 1) << 1));
}

// ---- atan / atan2 (s_atan.c, e_atan2.c) ----

const ATAN_HI = [4.63647609000806093515e-1, 7.85398163397448278999e-1, 9.82793723247329054082e-1, 1.570796326794896558] as const;
const ATAN_LO = [
  2.26987774529616870924e-17, 3.06161699786838301793e-17, 1.39033110312309984516e-17, 6.12323399573676603587e-17,
] as const;
const AT = [
  3.33333333333329318027e-1, -1.99999999998764832476e-1, 1.42857142725034663711e-1, -1.1111110405462355788e-1,
  9.09088713343650656196e-2, -7.69187620504482999495e-2, 6.66107313738753120669e-2, -5.83357013379057348645e-2,
  4.97687799461593236017e-2, -3.6531572744216915527e-2, 1.62858201153657823623e-2,
] as const;

export function atan(xIn: number): number {
  let x = xIn;
  const hx = hi(x);
  const ix = hx & 0x7fffffff;
  let id: number;
  if (ix >= 0x44100000) {
    // |x| ≥ 2^66
    if (x !== x) return x;
    return hx > 0 ? ATAN_HI[3] + ATAN_LO[3] : -ATAN_HI[3] - ATAN_LO[3];
  }
  if (ix < 0x3fdc0000) {
    // |x| < 0.4375
    if (ix < 0x3e400000) return x;
    id = -1;
  } else {
    x = Math.abs(x);
    if (ix < 0x3ff30000) {
      if (ix < 0x3fe60000) {
        id = 0;
        x = (2 * x - 1) / (2 + x);
      } else {
        id = 1;
        x = (x - 1) / (x + 1);
      }
    } else if (ix < 0x40038000) {
      id = 2;
      x = (x - 1.5) / (1 + 1.5 * x);
    } else {
      id = 3;
      x = -1 / x;
    }
  }
  const z = x * x;
  const w = z * z;
  const s1 = z * (AT[0] + w * (AT[2] + w * (AT[4] + w * (AT[6] + w * (AT[8] + w * AT[10])))));
  const s2 = w * (AT[1] + w * (AT[3] + w * (AT[5] + w * (AT[7] + w * AT[9]))));
  if (id < 0) return x - x * (s1 + s2);
  const r = (ATAN_HI[id] as number) - (x * (s1 + s2) - (ATAN_LO[id] as number) - x);
  return hx < 0 ? -r : r;
}

const PI = 3.141592653589793116;
const PI_LO = 1.2246467991473531772e-16;
const PIO2_HI = 1.570796326794896558;
const PIO2_LO = 6.12323399573676603587e-17;

export function atan2(y: number, x: number): number {
  if (x !== x || y !== y) return NaN;
  const hx = hi(x);
  const ix = hx & 0x7fffffff;
  const lx = lo(x);
  const hy = hi(y);
  const iy = hy & 0x7fffffff;
  const ly = lo(y);
  if (((hx - 0x3ff00000) | lx) === 0) return atan(y);
  let m = ((hy >> 31) & 1) | ((hx >> 30) & 2);
  if ((iy | ly) === 0) {
    if (m < 2) return y;
    return m === 2 ? PI : -PI;
  }
  if ((ix | lx) === 0) return hy < 0 ? -PIO2_HI : PIO2_HI;
  if (ix === 0x7ff00000) {
    if (iy === 0x7ff00000) return [PIO4, -PIO4, 3 * PIO4, -3 * PIO4][m] as number;
    return [0, -0, PI, -PI][m] as number;
  }
  if (iy === 0x7ff00000) return hy < 0 ? -PIO2_HI : PIO2_HI;
  const k = (iy - ix) >> 20;
  let z: number;
  if (k > 60) {
    z = PIO2_HI + 0.5 * PI_LO;
    m &= 1;
  } else if (hx < 0 && k < -60) {
    z = 0;
  } else {
    z = atan(Math.abs(y / x));
  }
  switch (m) {
    case 0:
      return z;
    case 1:
      return -z;
    case 2:
      return PI - (z - PI_LO);
    default:
      return z - PI_LO - PI;
  }
}

// ---- asin / acos (e_asin.c, e_acos.c) ----

const PS0 = 1.66666666666666657415e-1;
const PS1 = -3.25565818622400915405e-1;
const PS2 = 2.01212532134862925881e-1;
const PS3 = -4.00555345006794114027e-2;
const PS4 = 7.91534994289814532176e-4;
const PS5 = 3.4793310759602116757e-5;
const QS1 = -2.40339491173441421878;
const QS2 = 2.02094576023350569471;
const QS3 = -6.8828397160545329303e-1;
const QS4 = 7.70381505559019352791e-2;

/** R(t) = p(t)/q(t), the rational part shared by asin and acos. */
function asinR(t: number): number {
  const p = t * (PS0 + t * (PS1 + t * (PS2 + t * (PS3 + t * (PS4 + t * PS5)))));
  const q = 1 + t * (QS1 + t * (QS2 + t * (QS3 + t * QS4)));
  return p / q;
}

export function asin(x: number): number {
  const hx = hi(x);
  const ix = hx & 0x7fffffff;
  if (ix >= 0x3ff00000) {
    if (((ix - 0x3ff00000) | lo(x)) === 0) return x * PIO2_HI + x * PIO2_LO;
    return NaN;
  }
  if (ix < 0x3fe00000) {
    if (ix < 0x3e400000) return x;
    return x + x * asinR(x * x);
  }
  const t = (1 - Math.abs(x)) * 0.5;
  const s = Math.sqrt(t);
  let r: number;
  if (ix >= 0x3fef3333) {
    r = PIO2_HI - (2 * (s + s * asinR(t)) - PIO2_LO);
  } else {
    const w = zeroLow(s);
    const c = (t - w * w) / (s + w);
    const p = 2 * s * asinR(t) - (PIO2_LO - 2 * c);
    const q = PIO4 - 2 * w;
    r = PIO4 - (p - q);
  }
  return hx > 0 ? r : -r;
}

export function acos(x: number): number {
  const hx = hi(x);
  const ix = hx & 0x7fffffff;
  if (ix >= 0x3ff00000) {
    if (((ix - 0x3ff00000) | lo(x)) === 0) return hx > 0 ? 0 : PI + 2 * PIO2_LO;
    return NaN;
  }
  if (ix < 0x3fe00000) {
    if (ix <= 0x3c600000) return PIO2_HI + PIO2_LO;
    return PIO2_HI - (x - (PIO2_LO - x * asinR(x * x)));
  }
  if (hx < 0) {
    const z = (1 + x) * 0.5;
    const s = Math.sqrt(z);
    return PI - 2 * (s + (asinR(z) * s - PIO2_LO));
  }
  const z = (1 - x) * 0.5;
  const s = Math.sqrt(z);
  const df = zeroLow(s);
  const c = (z - df * df) / (s + df);
  return 2 * (df + (asinR(z) * s + c));
}

// ---- hypot (V8's Math.hypot builtin: scale by the largest, Kahan-sum the squares) ----

/** √(a² + b² [+ c²]). Two or three terms, matching `Math.hypot` with the same number of arguments. */
export function hypot(a: number, b: number, c?: number): number {
  const x = Math.abs(a);
  const y = Math.abs(b);
  const z = c === undefined ? 0 : Math.abs(c);
  if (x === Infinity || y === Infinity || z === Infinity) return Infinity;
  const max = Math.max(x, y, z);
  if (max !== max) return NaN;
  if (max === 0) return 0;
  let sum = 0;
  let comp = 0;
  let n = x / max;
  let summand = n * n - comp;
  let pre = sum + summand;
  comp = pre - sum - summand;
  sum = pre;
  n = y / max;
  summand = n * n - comp;
  pre = sum + summand;
  comp = pre - sum - summand;
  sum = pre;
  if (c !== undefined) {
    n = z / max;
    summand = n * n - comp;
    pre = sum + summand;
    sum = pre;
  }
  return Math.sqrt(sum) * max;
}
