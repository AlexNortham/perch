import { TICK_RATE } from '../data/core';
import type { Vec3 } from './contracts/base';

/** Seconds (as written in data) to whole ticks. Every duration in the sim is a tick count. */
export function ticks(seconds: number): number {
  return Math.round(seconds * TICK_RATE);
}

export function vec3(x = 0, y = 0, z = 0): Vec3 {
  return { x, y, z };
}

export function copy(v: Vec3): Vec3 {
  return { x: v.x, y: v.y, z: v.z };
}

export function add(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

export function sub(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

export function scale(v: Vec3, s: number): Vec3 {
  return { x: v.x * s, y: v.y * s, z: v.z * s };
}

/** a + b·s */
export function addScaled(a: Vec3, b: Vec3, s: number): Vec3 {
  return { x: a.x + b.x * s, y: a.y + b.y * s, z: a.z + b.z * s };
}

export function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

export function length(v: Vec3): number {
  return Math.sqrt(dot(v, v));
}

export function distSq(a: Vec3, b: Vec3): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return dx * dx + dy * dy + dz * dz;
}

/** Unit vector, or (0,0,0) for a zero vector. */
export function normalize(v: Vec3): Vec3 {
  const len = length(v);
  return len > 0 ? scale(v, 1 / len) : vec3();
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function lerpVec(a: Vec3, b: Vec3, t: number): Vec3 {
  return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), z: lerp(a.z, b.z, t) };
}

/** Shortest-path interpolation between two angles (radians). */
export function lerpAngle(a: number, b: number, t: number): number {
  const turn = Math.PI * 2;
  const d = ((((b - a + Math.PI) % turn) + turn) % turn) - Math.PI;
  return a + d * t;
}

export function clamp(x: number, min: number, max: number): number {
  return x < min ? min : x > max ? max : x;
}
