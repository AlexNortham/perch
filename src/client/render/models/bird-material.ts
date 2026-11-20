/**
 * Materials for sculpted birds (style guide §7.3, §8.2, §8.7). Two per bird kind, shared by every sculpted bird:
 * - `solid`: the opaque body, gear and gun. Vertex colour × a tile of the solid pattern atlas (feather scales, wood,
 *   leather…), chosen per vertex by the finish attribute `fx.w` and repeated in the shader;
 * - `cards`: the double-sided feathers, solid tapered geometry (clean edges at every distance, no alpha test),
 *   vertex colour × an opaque feather pattern.
 * Both are physically based (metalness 0), with the per-vertex finish `fx` = (iridescence, glow, gloss, tile):
 * iridescent plumage shifts hue with view angle by up to 40°, glow lights catchlights, beads and chambers, gloss
 * polishes eyes, bills, claws and brass, and a fresnel rim (#FFE6C0) keeps birds the crispest thing on screen.
 * Built against the shared material library's conventions; see D-ART-004 for the switch-over.
 */
import { Color, DoubleSide, MeshStandardMaterial } from 'three';
import type { WebGLProgramParametersWithUniforms } from 'three';
import { cardAtlas, solidAtlas, TILE, TILE_GRID } from './feathers';
import { PATTERN_FADE } from './sculpt';

/** Style guide §8.7 and §7.3. */
export const BIRD_SHADING = {
  rimColour: 0xffe6c0,
  rimStrength: 0.25,
  rimPower: 3,
  /** Largest iridescent hue shift: 0.7 rad, 40°. */
  iridescence: 0.7,
  roughness: 0.68,
  /** Roughness where gloss is 1 (eyes, claws, bills, brass). */
  glossRoughness: 0.2,
  cardRoughness: 0.72,
  /** Inset of a tile's uv so bilinear filtering never reads the next tile (texels). */
  tileInset: 0.5,
} as const;

/** The procedural feather surface on implicit skins (D-ART-008 v2.1). */
export const FEATHER_SURFACE = {
  /** Contour feathers: length and half-width in feather spacings (the region's tile size); hair is thin. Both stay
   * within 1.15 spacings of their root, so the 3 × 3 × 3 search always finds every feather that covers a point. */
  length: 1.15,
  width: 0.62,
  hairLength: 1.15,
  hairWidth: 0.22,
  /** Relief of a feather's edge over the one beneath, as a share of the spacing. */
  relief: 0.12,
  hairRelief: 0.035,
  /** Detail fades as a feather spacing shrinks from this many pixels' worth to that many (spacings per pixel). */
  fadeFrom: 0.08,
  fadeTo: 0.32,
  /** Closest to the camera the detail is strongest; beyond this distance (m) it settles to `far` of full. */
  near: 2.5,
  nearTo: 10,
  far: 0.65,
} as const;

const VERTEX_HEAD = /* glsl */ `
attribute vec4 fx;
varying vec4 vFx;
varying vec2 vRawUv;
varying vec3 vBindPos;
varying vec3 vBindNormal;
varying vec3 vFlow;
`;

const FRAGMENT_HEAD = /* glsl */ `
varying vec4 vFx;
varying vec2 vRawUv;
varying vec3 vBindPos;
varying vec3 vBindNormal;
varying vec3 vFlow;
uniform vec3 rimColour;
uniform float rimStrength;
uniform float rimPower;
uniform float iriMax;
uniform float glossRoughness;
vec3 hueShift(vec3 c, float a) {
  const vec3 k = vec3(0.57735);
  float ca = cos(a);
  return c * ca + cross(k, c) * sin(a) + k * dot(k, c) * (1.0 - ca);
}
vec4 tileTap(sampler2D atlas, vec2 raw, vec2 dx, vec2 dy, vec2 origin, vec2 count, float inset) {
  vec2 inTile = inset + fract(raw) * (1.0 - 2.0 * inset);
  return textureGrad(atlas, (origin + inTile) / count, dx / count, dy / count);
}
vec3 featherHash(vec3 p) {
  p = fract(p * vec3(0.1031, 0.1030, 0.0973));
  p += dot(p, p.yxz + 33.33);
  return fract((p.xxy + p.yxx) * p.zyx);
}
// Overlapping feathers along a flow, in units of the feather spacing: each cell of a jittered 3D grid roots one
// feather, an oval running downstream (along f) from its root. Where several cover a point the most upstream lies on
// top; across its edge the surface steps down to the feather beneath, which it shades, over about two pixels so the
// edge reads as a clean line, not speckle. Returns (height 0-1, albedo multiplier).
vec2 featherField(vec3 P, vec3 n, vec3 f, float len, float wid, float px) {
  vec3 s = cross(n, f);
  vec3 base = floor(P);
  // x: key (upstream first), y: along (0 root, 1 tip), z: inside (0 at the edge), w: tint.
  vec4 top = vec4(1e9, 0.0, 0.0, 1.0);
  vec4 under = vec4(1e9, 0.0, 0.0, 1.0);
  float shadeKey = 1e9;
  float shade = 0.0;
  for (int k = -1; k <= 1; k++) for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec3 cell = base + vec3(float(i), float(j), float(k));
    vec3 r = featherHash(cell);
    vec3 c = cell + 0.15 + 0.7 * r;
    vec3 d = P - c;
    if (abs(dot(d, n)) > 0.9) continue;
    float t = dot(d, f) / len;
    float u = dot(d, s) / wid;
    float m = 1.0 - length(vec2(u, (t - 0.42) / 0.58));
    vec4 me = vec4(dot(c, f), clamp(t, 0.0, 1.0), m, 0.9 + 0.2 * r.z);
    if (m > 0.0) {
      if (me.x < top.x) { under = top; top = me; }
      else if (me.x < under.x) under = me;
    } else if (t > 0.6) {
      float sh = 1.0 - clamp(-m / 0.22, 0.0, 1.0);
      if (sh > shade) { shade = sh; shadeKey = me.x; }
    }
  }
  if (top.x > 1e8) return vec2(0.3, 0.8);
  float ew = clamp(px * 2.0, 0.04, 0.35);
  float hTop = 0.35 + 0.65 * top.y;
  float vTop = top.w * (0.88 + 0.16 * top.y);
  bool hasUnder = under.x < 1e8;
  float hUnder = hasUnder ? 0.35 + 0.65 * under.y : 0.3;
  // The feather beneath is in the top one's shadow right at its edge.
  float vUnder = (hasUnder ? under.w * (0.88 + 0.16 * under.y) : 0.8) * 0.62;
  float cover = smoothstep(0.0, ew, top.z);
  float edge = (1.0 - smoothstep(0.0, ew + 0.08, top.z)) * smoothstep(0.45, 0.65, top.y) * cover;
  float h = mix(hUnder, hTop, cover);
  // Hair (narrow strands) takes no edge highlight: on thin strands it would sparkle.
  float v = mix(vUnder, vTop, cover) + 0.1 * edge * step(0.4, wid);
  if (shadeKey < top.x) v *= 1.0 - 0.38 * shade;
  return vec2(h, v);
}
`;

/**
 * The solid atlas: pick the tile in fx.w, repeat it with fract, keep mip selection from the unwrapped uv. Implicit
 * body skins (a negative u: minus repeats per metre) have no uv; they take the tile world-aligned from three
 * projections of the bind-pose position, blended by the bind-pose normal (D-ART-008). Where a skin region is
 * feathered (the scales tile) or hairy (the wood tile), the procedural feather surface replaces the tile: overlapping
 * feathers along the baked flow, in albedo here and in the normal below (v2.1).
 */
const S = FEATHER_SURFACE;
const TILE_SAMPLE = /* glsl */ `
  float featherH = 0.0;
  float featherDepth = 0.0;
#ifdef USE_MAP
  vec2 tileCount = vec2(${TILE_GRID.cols}.0, ${TILE_GRID.rows}.0);
  float tileIndex = floor(vFx.w + 0.5);
  float tileStrength = 1.0 - clamp((vFx.w - tileIndex) / ${PATTERN_FADE}, 0.0, 1.0);
  vec2 tileOrigin = vec2(mod(tileIndex, tileCount.x), floor(tileIndex / tileCount.x));
  float inset = ${BIRD_SHADING.tileInset} / ${TILE_GRID.px}.0;
  vec3 bpDx = dFdx(vBindPos);
  vec3 bpDy = dFdy(vBindPos);
  vec2 uvDx = dFdx(vRawUv);
  vec2 uvDy = dFdy(vRawUv);
  vec4 sampledDiffuseColor;
  if (vRawUv.x < 0.0) {
    float rep = -vRawUv.x;
    vec3 bp = vBindPos * rep;
    bpDx *= rep;
    bpDy *= rep;
    vec3 bn = normalize(vBindNormal);
    bool hair = abs(tileIndex - ${TILE.wood}.0) < 0.5;
    if ((hair || abs(tileIndex - ${TILE.scales}.0) < 0.5) && dot(vFlow, vFlow) > 0.25) {
      vec3 fl = normalize(vFlow - bn * dot(vFlow, bn));
      float px = length(bpDx) + length(bpDy);
      vec2 fv = featherField(bp, bn, fl, hair ? ${S.hairLength} : ${S.length}, hair ? ${S.hairWidth} : ${S.width}, px);
      float k = (1.0 - smoothstep(${S.fadeFrom}, ${S.fadeTo}, px)) * mix(1.0, ${S.far}, smoothstep(${S.near.toFixed(1)}, ${S.nearTo.toFixed(1)}, length(vViewPosition)));
      featherH = fv.x * k * tileStrength;
      featherDepth = (hair ? ${S.hairRelief} : ${S.relief}) / rep;
      sampledDiffuseColor = vec4(vec3(mix(1.0, fv.y, k)), 1.0);
    } else {
      vec3 bw = pow(abs(bn), vec3(4.0));
      bw /= bw.x + bw.y + bw.z;
      sampledDiffuseColor = bw.x * tileTap(map, bp.zy, bpDx.zy, bpDy.zy, tileOrigin, tileCount, inset)
        + bw.y * tileTap(map, bp.xz, bpDx.xz, bpDy.xz, tileOrigin, tileCount, inset)
        + bw.z * tileTap(map, bp.xy, bpDx.xy, bpDy.xy, tileOrigin, tileCount, inset);
    }
  } else {
    sampledDiffuseColor = tileTap(map, vRawUv, uvDx, uvDy, tileOrigin, tileCount, inset);
  }
  diffuseColor *= mix(vec4(1.0), sampledDiffuseColor, tileStrength);
#endif
`;

/** The feather surface's relief: bump the view-space normal by the height's screen derivatives (no tangents needed). */
const FEATHER_BUMP = /* glsl */ `
  {
    vec3 dpx = dFdx(-vViewPosition);
    vec3 dpy = dFdy(-vViewPosition);
    float hh = featherH * featherDepth;
    float dhx = dFdx(hh);
    float dhy = dFdy(hh);
    vec3 r1 = cross(dpy, normal);
    vec3 r2 = cross(normal, dpx);
    float det = dot(dpx, r1);
    if (abs(det) > 1e-12) normal = normalize(abs(det) * normal - sign(det) * (dhx * r1 + dhy * r2));
  }
`;

const SHADE = /* glsl */ `
  vec3 birdView = normalize(vViewPosition);
  float birdFacing = clamp(abs(dot(normal, birdView)), 0.0, 1.0);
  diffuseColor.rgb = hueShift(diffuseColor.rgb, vFx.x * (1.0 - birdFacing) * iriMax);
`;

const EMIT = /* glsl */ `
  totalEmissiveRadiance += diffuseColor.rgb * vFx.y + rimColour * rimStrength * pow(1.0 - birdFacing, rimPower);
`;

function patch(m: MeshStandardMaterial, tiled: boolean): MeshStandardMaterial {
  m.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    shader.uniforms['rimColour'] = { value: new Color(BIRD_SHADING.rimColour) };
    shader.uniforms['rimStrength'] = { value: BIRD_SHADING.rimStrength };
    shader.uniforms['rimPower'] = { value: BIRD_SHADING.rimPower };
    shader.uniforms['iriMax'] = { value: BIRD_SHADING.iridescence };
    shader.uniforms['glossRoughness'] = { value: BIRD_SHADING.glossRoughness };
    // Only the solid layer carries the skin's feather flow; the cards have none.
    const flow = tiled ? 'attribute vec3 flow;\n' : '';
    shader.vertexShader = flow + VERTEX_HEAD + shader.vertexShader.replace('#include <uv_vertex>', `#include <uv_vertex>\n  vFx = fx;\n  vRawUv = uv;\n  vBindPos = position;\n  vBindNormal = normal;\n  vFlow = ${tiled ? 'flow' : 'vec3(0.0)'};`);
    let f = FRAGMENT_HEAD + shader.fragmentShader;
    if (tiled) f = f.replace('#include <map_fragment>', TILE_SAMPLE);
    f = f
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n  roughnessFactor = mix(roughnessFactor, glossRoughness, vFx.z);')
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n' + (tiled ? FEATHER_BUMP : '') + SHADE)
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n' + EMIT);
    shader.fragmentShader = f;
  };
  // One program for every sculpted bird of this layer.
  m.customProgramCacheKey = () => (tiled ? 'perch-bird-solid' : 'perch-bird-cards');
  return m;
}

export interface BirdMaterials {
  readonly solid: MeshStandardMaterial;
  readonly cards: MeshStandardMaterial;
}

/** The two shared bird materials (textures are generated once per session). */
export function birdMaterials(): BirdMaterials {
  // vRawUv needs USE_UV-free uv access: the map's own uv transform is unused (the atlas is sampled by hand).
  const solid = patch(new MeshStandardMaterial({ vertexColors: true, roughness: BIRD_SHADING.roughness, metalness: 0, map: solidAtlas() }), true);
  const cards = patch(
    new MeshStandardMaterial({
      vertexColors: true,
      roughness: BIRD_SHADING.cardRoughness,
      metalness: 0,
      map: cardAtlas(),
      side: DoubleSide,
    }),
    false,
  );
  solid.name = 'bird-solid';
  cards.name = 'bird-cards';
  return { solid, cards };
}
