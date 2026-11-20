/**
 * Friend-or-foe readability (GDD §14.4, style guide §8.7 and §10.5, feel gap G18), added to hero models by the
 * entity layer without touching the models themselves:
 * - enemies: a red 2 px screen-space outline when in sight (an inverted hull pushed out in clip space), and a red
 *   x-ray silhouette through walls while revealed;
 * - allies: a teal x-ray silhouette only where walls hide them (drawn before bodies with a "greater" depth test, so
 *   only occluded pixels pass);
 * - every hero: a warm fresnel rim term in its material (#FFE6C0), so birds stay the brightest thing on screen.
 * Each overlay shares the body's geometry and skeleton: one extra draw call per bird, no extra shadow casting.
 */
import { AdditiveBlending, BackSide, Color, GreaterDepth, ShaderMaterial, SkinnedMesh, Vector2 } from 'three';
import type { Material, Object3D, WebGLProgramParametersWithUniforms } from 'three';
import { ALLY_TEAL, ENEMY_RED } from '../app/palette';
import { IDENTITY } from './constants';

const OUTLINE_VERTEX = /* glsl */ `
#include <common>
#include <skinning_pars_vertex>
uniform float uWidth;
uniform vec2 uResolution;
void main() {
  #include <skinbase_vertex>
  #include <beginnormal_vertex>
  #include <skinnormal_vertex>
  #include <begin_vertex>
  #include <skinning_vertex>
  vec4 clip = projectionMatrix * modelViewMatrix * vec4( transformed, 1.0 );
  vec2 dir = ( projectionMatrix * vec4( normalize( normalMatrix * objectNormal ), 0.0 ) ).xy;
  float l = length( dir );
  if ( l > 1e-5 ) clip.xy += dir / l * uWidth * 2.0 / uResolution * clip.w;
  gl_Position = clip;
}
`;
const OUTLINE_FRAGMENT = /* glsl */ `
uniform vec3 uColour;
void main() { gl_FragColor = vec4( uColour, 1.0 ); }
`;
const XRAY_VERTEX = /* glsl */ `
#include <common>
#include <skinning_pars_vertex>
varying float vRim;
void main() {
  #include <skinbase_vertex>
  #include <beginnormal_vertex>
  #include <skinnormal_vertex>
  #include <begin_vertex>
  #include <skinning_vertex>
  vec4 mv = modelViewMatrix * vec4( transformed, 1.0 );
  vRim = 1.0 - abs( dot( normalize( normalMatrix * objectNormal ), normalize( -mv.xyz ) ) );
  gl_Position = projectionMatrix * mv;
}
`;
const XRAY_FRAGMENT = /* glsl */ `
uniform vec3 uColour;
uniform float uFill;
varying float vRim;
void main() { gl_FragColor = vec4( uColour * ( uFill + ( 1.0 - uFill ) * pow( vRim, 2.0 ) ), 1.0 ); }
`;

/** Screen size for the outline width; the renderer updates it on resize. */
export const identityResolution = new Vector2(1, 1);

const outlineMaterial = (hex: number): ShaderMaterial =>
  new ShaderMaterial({
    uniforms: { uColour: { value: new Color(hex) }, uWidth: { value: IDENTITY.outlinePx }, uResolution: { value: identityResolution } },
    vertexShader: OUTLINE_VERTEX,
    fragmentShader: OUTLINE_FRAGMENT,
    side: BackSide,
  });
const xrayMaterial = (hex: number): ShaderMaterial =>
  new ShaderMaterial({
    uniforms: { uColour: { value: new Color(hex) }, uFill: { value: IDENTITY.xrayFill } },
    vertexShader: XRAY_VERTEX,
    fragmentShader: XRAY_FRAGMENT,
    // Opaque list (drawn before bodies by renderOrder) yet blended: additive, never writing depth.
    blending: AdditiveBlending,
    depthFunc: GreaterDepth,
    depthWrite: false,
  });

const MATERIALS = {
  outline: outlineMaterial(ENEMY_RED),
  xrayEnemy: xrayMaterial(ENEMY_RED),
  xrayAlly: xrayMaterial(ALLY_TEAL),
};

/** Rim strength by quality (§8.7: 0.25 at Medium and High, 0.15 at Low). */
export const rimStrength: { value: number } = { value: IDENTITY.rim };
const rimColour = { value: new Color(IDENTITY.rimColour) };
const RIM = /* glsl */ `
#include <emissivemap_fragment>
totalEmissiveRadiance += uRimColour * uRim * pow( 1.0 - saturate( dot( normal, normalize( vViewPosition ) ) ), 3.0 );
`;
const rimmed = new WeakMap<Material, Material>();

/** The rim-lit copy of a body material (shared across every hero that uses the same original). */
function withRim(m: Material): Material {
  const done = rimmed.get(m);
  if (done) return done;
  const copy = m.clone();
  copy.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    shader.uniforms['uRim'] = rimStrength;
    shader.uniforms['uRimColour'] = rimColour;
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uRim;\nuniform vec3 uRimColour;')
      .replace('#include <emissivemap_fragment>', RIM);
  };
  copy.customProgramCacheKey = () => `${m.customProgramCacheKey()}:rim`;
  rimmed.set(m, copy);
  rimmed.set(copy, copy);
  return copy;
}

export interface Identity {
  readonly outline: SkinnedMesh;
  readonly xray: SkinnedMesh;
}

/** Add the identity overlays and the rim to a hero model, once. Null for models without a skinned body. */
export function attachIdentity(model: Object3D): Identity | null {
  let body: SkinnedMesh | null = null;
  model.traverse((o) => {
    if (!body && o instanceof SkinnedMesh && !o.userData['identity']) body = o;
  });
  const b = body as SkinnedMesh | null;
  if (!b || !b.parent) return null;
  if (!Array.isArray(b.material)) b.material = withRim(b.material);
  b.renderOrder = IDENTITY.bodyOrder;
  const overlay = (material: ShaderMaterial, name: string, order: number): SkinnedMesh => {
    const m = new SkinnedMesh(b.geometry, material);
    m.bind(b.skeleton, b.bindMatrix);
    m.name = name;
    m.userData['identity'] = true;
    m.frustumCulled = false;
    m.castShadow = false;
    m.receiveShadow = false;
    m.renderOrder = order;
    m.visible = false;
    m.position.copy(b.position);
    m.quaternion.copy(b.quaternion);
    m.scale.copy(b.scale);
    b.parent?.add(m);
    return m;
  };
  return { outline: overlay(MATERIALS.outline, 'outline', IDENTITY.bodyOrder), xray: overlay(MATERIALS.xrayAlly, 'xray', IDENTITY.xrayOrder) };
}

/**
 * Show the right overlays for a hero seen by `viewer`'s flock: enemies outlined in red (and x-rayed red while
 * revealed), allies x-rayed teal behind walls, the local bird and hidden models nothing.
 */
export function updateIdentity(id: Identity, relation: 'self' | 'ally' | 'enemy', revealed: boolean, shown: boolean): void {
  id.outline.visible = shown && relation === 'enemy';
  id.xray.visible = shown && (relation === 'ally' || (relation === 'enemy' && revealed));
  id.xray.material = relation === 'enemy' ? MATERIALS.xrayEnemy : MATERIALS.xrayAlly;
}
