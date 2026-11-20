/**
 * Scoreboard portraits (D-EP-041): each bird rendered from its own in-game model, head and shoulders, three-quarter
 * view, warm key and rim light, transparent background (the UI frames it in team colour). Rendered on first request
 * with the live WebGL context and cached as PNG data URLs, so the offline single-file build needs no image files.
 *
 * The renderer registers `uiPortraits` with the UI's `setPortraitProvider` (ui/portraits.ts), so the top bar and
 * the kill feed show them; `portraits.get(hero, team)` gives the data URL directly.
 */
import {
  AmbientLight,
  Color,
  DirectionalLight,
  HemisphereLight,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderTarget,
} from 'three';
import type { WebGLRenderer } from 'three';
import type { EntityView, HeroId, PlayerTeam, SimView } from '../../sim/core/contracts';
import { HEROES } from '../../sim/heroes/registry';
import type { Frame, ModelKit } from '../app/contracts';
import { placeholderPortraits } from '../ui/portraits';
import type { PortraitProvider as UiPortraits } from '../ui/portraits';
import { PORTRAIT } from './constants';

export interface PortraitProvider {
  /** A PNG data URL of `hero` in `team`'s trim, or null when no renderer is running. */
  get(hero: HeroId, team: PlayerTeam): string | null;
  /** Render these up front (match start), so the first scoreboard frame doesn't pay for them. */
  prepare(roster: readonly { readonly hero: HeroId; readonly team: PlayerTeam }[]): void;
}

interface Source {
  readonly gl: () => WebGLRenderer;
  readonly kit: ModelKit;
}
let source: Source | null = null;
const cache = new Map<string, string>();

/** The renderer registers its context and model kit here; portraits come from the same models as the match. */
export function registerPortraitSource(s: Source | null): void {
  source = s;
  cache.clear();
}

function render(hero: HeroId, team: PlayerTeam, src: Source): string | null {
  const gl = src.gl();
  const plan = HEROES[hero].def.body;
  const view = {
    id: PORTRAIT.entityId, kind: 'hero', team, type: hero, pos: { x: 0, y: 0, z: 0 }, vel: { x: 0, y: 0, z: 0 }, yaw: 0, pitch: 0,
    radius: plan.radius, hp: 1, maxHp: 1, shield: 0, flags: 0, mode: null, seenBy: 3,
  } as EntityView;
  const sim = { entities: [view], heroes: [], localHero: null, seconds: 0, tick: 0 } as unknown as SimView;
  const model = src.kit.create(view);
  const scene = new Scene();
  scene.add(model);
  // Settle the idle pose (the rig blends toward each target).
  for (let i = 0; i < PORTRAIT.settleFrames; i++) {
    const frame: Frame = { prev: sim, curr: sim, alpha: 1, dt: PORTRAIT.settleDt };
    src.kit.pose(model, view, frame);
  }
  scene.add(new HemisphereLight(PORTRAIT.sky, PORTRAIT.ground, PORTRAIT.hemi));
  scene.add(new AmbientLight(PORTRAIT.ambientColour, PORTRAIT.ambient));
  const key = new DirectionalLight(PORTRAIT.key, PORTRAIT.keyIntensity);
  key.position.set(PORTRAIT.keyDir.x, PORTRAIT.keyDir.y, PORTRAIT.keyDir.z);
  const rim = new DirectionalLight(PORTRAIT.rim, PORTRAIT.rimIntensity);
  rim.position.set(PORTRAIT.rimDir.x, PORTRAIT.rimDir.y, PORTRAIT.rimDir.z);
  scene.add(key, rim);
  scene.updateMatrixWorld(true);

  // Head and shoulders: aim between the head and the chest, from three-quarters front and a little above.
  const head = new Vector3(plan.head.centre.right, plan.head.centre.up, plan.head.centre.forward);
  const aim = head.clone().setY(head.y - plan.head.radius * PORTRAIT.aimDrop);
  const reach = plan.head.radius * PORTRAIT.frameRadii + plan.radius * PORTRAIT.frameBody;
  const camera = new PerspectiveCamera(PORTRAIT.fovDeg, 1, PORTRAIT.near, PORTRAIT.far);
  const dist = reach / Math.tan((PORTRAIT.fovDeg * Math.PI) / PORTRAIT.halfTurnDeg / 2);
  const yaw = (PORTRAIT.yawDeg * Math.PI) / PORTRAIT.halfTurnDeg;
  camera.position.set(aim.x + Math.sin(yaw) * dist, aim.y + dist * PORTRAIT.rise, aim.z + Math.cos(yaw) * dist);
  camera.lookAt(aim);

  const size = PORTRAIT.size;
  const rt = new WebGLRenderTarget(size, size, { samples: PORTRAIT.samples });
  rt.texture.colorSpace = SRGBColorSpace;
  const before = { target: gl.getRenderTarget(), colour: gl.getClearColor(new Color()), alpha: gl.getClearAlpha(), shadows: gl.shadowMap.enabled };
  gl.shadowMap.enabled = false;
  gl.setRenderTarget(rt);
  gl.setClearColor(0, 0);
  gl.clear();
  gl.render(scene, camera);
  const px = new Uint8Array(size * size * PORTRAIT.rgba);
  gl.readRenderTargetPixels(rt, 0, 0, size, size, px);
  gl.setRenderTarget(before.target);
  gl.setClearColor(before.colour, before.alpha);
  gl.shadowMap.enabled = before.shadows;
  rt.dispose();
  scene.clear();

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const img = ctx.createImageData(size, size);
  // GL rows run bottom-up.
  for (let y = 0; y < size; y++) img.data.set(px.subarray((size - 1 - y) * size * PORTRAIT.rgba, (size - y) * size * PORTRAIT.rgba), y * size * PORTRAIT.rgba);
  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL('image/png');
}

export const portraits: PortraitProvider = {
  get(hero, team) {
    const key = `${hero}:${team}`;
    const hit = cache.get(key);
    if (hit) return hit;
    if (!source) return null;
    const url = render(hero, team, source);
    if (url) cache.set(key, url);
    return url;
  },
  prepare(roster) {
    for (const r of roster) portraits.get(r.hero, r.team);
  },
};

/**
 * The UI scoreboard's provider (ui/portraits.ts): an image filled in just after the current frame (so building a
 * match's bar never waits on twelve renders), the placeholder without a renderer.
 */
export const uiPortraits: UiPortraits = {
  face(hero, team) {
    if (!source) return placeholderPortraits.face(hero, team);
    const img = document.createElement('img');
    img.alt = '';
    img.draggable = false;
    img.style.cssText = 'display:block;width:100%;height:100%;object-fit:cover';
    const fill = (): void => {
      const url = portraits.get(hero, team);
      if (url) img.src = url;
    };
    if (cache.has(`${hero}:${team}`)) fill();
    else setTimeout(fill, 0);
    return img;
  },
};
