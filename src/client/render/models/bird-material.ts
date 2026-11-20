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
  /** Width of a feather's edge on screen (pixels), whatever its size or angle (v2.2 filtering). */
  edgePx: 1.5,
  /** The soft shadow a feather casts beyond its edge (oval units, at least `edgePx` wide) and how dark it is there. */
  shadow: 0.22,
  shadowDepth: 0.38,
  /** Steepest relief slope: the bumped normal tilts at most atan(1.2), 50°, so it never turns away (no speckle). */
  maxSlope: 1.2,
  /** Mottled and barred plumage: the pattern tile's repeats per feather spacing (one tile spans 2.5 feathers). */
  pattern: 0.4,
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
// A tile taken world-aligned from three projections of p, blended by the normal n (D-ART-008).
vec4 triTap(sampler2D atlas, vec3 p, vec3 dx, vec3 dy, vec3 n, vec2 origin, vec2 count, float inset) {
  vec3 bw = pow(abs(n), vec3(4.0));
  bw /= bw.x + bw.y + bw.z;
  return bw.x * tileTap(atlas, p.zy, dx.zy, dy.zy, origin, count, inset)
    + bw.y * tileTap(atlas, p.xz, dx.xz, dy.xz, origin, count, inset)
    + bw.z * tileTap(atlas, p.xy, dx.xy, dy.xy, origin, count, inset);
}
vec3 featherHash(vec3 p) {
  p = fract(p * vec3(0.1031, 0.1030, 0.0973));
  p += dot(p, p.yxz + 33.33);
  return fract((p.xxy + p.yxx) * p.zyx);
}
// Overlapping feathers along a flow, in units of the feather spacing: each cell of a jittered 3D grid roots one
// feather, an oval running downstream (along f) from its root. Where several cover a point the most upstream lies on
// top; across its edge the surface steps down to the feather beneath, which lies in its shadow.
// Filtered, so it never speckles (v2.2): every value is continuous (a root leaving the surface's slab shrinks its
// feather away; the shadow outside an edge meets the dark band inside it), each edge is 1.5 pixels wide whatever the
// feather's shape (its exact screen footprint, from the analytic gradient and the pixel's footprint pdx, pdy), and the
// relief's gradient is analytic, so the bump never takes finite differences across an edge.
// Returns (height 0-1, albedo multiplier); grad is the height's gradient per spacing.
vec2 featherField(vec3 P, vec3 n, vec3 f, float len, float wid, vec3 pdx, vec3 pdy, out vec3 grad) {
  vec3 s = cross(n, f);
  vec3 base = floor(P);
  // x: key (upstream first), y: along (0 root, 1 tip), z: inside (0 at the edge), w: tint; and the offset from the root.
  vec4 top = vec4(1e9, 0.0, 0.0, 1.0);
  vec4 under = vec4(1e9, 0.0, 0.0, 1.0);
  vec3 topD = vec3(0.0);
  // The two strongest shadows of feathers that miss P: (key, strength 1 at their edge).
  vec2 sh1 = vec2(1e9, 0.0);
  vec2 sh2 = vec2(1e9, 0.0);
  float shadowW = max(${FEATHER_SURFACE.shadow}, ${FEATHER_SURFACE.edgePx} * max(length(pdx), length(pdy)) / min(wid, 0.58 * len));
  for (int k = -1; k <= 1; k++) for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec3 cell = base + vec3(float(i), float(j), float(k));
    vec3 r = featherHash(cell);
    vec3 c = cell + 0.15 + 0.7 * r;
    vec3 d = P - c;
    float dn = abs(dot(d, n));
    if (dn > 0.9) continue;
    float t = dot(d, f) / len;
    float u = dot(d, s) / wid;
    float m = 1.0 - length(vec2(u, (t - 0.42) / 0.58)) - 1.4 * smoothstep(0.6, 0.9, dn);
    vec4 me = vec4(dot(c, f), t, m, 0.9 + 0.2 * r.z);
    if (m > 0.0) {
      if (me.x < top.x) { under = top; top = me; topD = d; }
      else if (me.x < under.x) under = me;
    } else if (m > -shadowW) {
      float sh = 1.0 + m / shadowW;
      if (sh > sh1.y) { sh2 = sh1; sh1 = vec2(me.x, sh); }
      else if (sh > sh2.y) sh2 = vec2(me.x, sh);
    }
  }
  // Shadows fall only from feathers lying above the one on top here.
  float shade = max(sh1.x < top.x ? sh1.y : 0.0, sh2.x < top.x ? sh2.y : 0.0);
  float shadowed = 1.0 - ${FEATHER_SURFACE.shadowDepth} * shade;
  grad = vec3(0.0);
  if (top.x > 1e8) return vec2(0.3, 0.8 * shadowed);
  float tTop = clamp(top.y, 0.0, 1.0);
  float hTop = 0.35 + 0.65 * tTop;
  float vTop = top.w * (0.88 + 0.16 * tTop);
  bool hasUnder = under.x < 1e8;
  float tUnder = clamp(under.y, 0.0, 1.0);
  float hUnder = hasUnder ? 0.35 + 0.65 * tUnder : 0.3;
  // The feather beneath is in the top one's shadow right at its edge (as dark as the shadow just outside it).
  float vUnder = (hasUnder ? under.w * (0.88 + 0.16 * tUnder) : 0.8) * (1.0 - ${FEATHER_SURFACE.shadowDepth});
  // The top feather's edge: m's gradient, and so its exact footprint on screen.
  float qa = (top.y - 0.42) / 0.58;
  float ua = dot(topD, s) / wid;
  vec3 gm = -(ua / wid * s + qa / (0.58 * len) * f) / max(length(vec2(ua, qa)), 1e-4);
  float ew = max(${FEATHER_SURFACE.edgePx} * (abs(dot(gm, pdx)) + abs(dot(gm, pdy))), 0.04);
  float cover = smoothstep(0.0, ew, top.z);
  float x = clamp(top.z / ew, 0.0, 1.0);
  float edge = (1.0 - smoothstep(0.0, ew + 0.08, top.z)) * smoothstep(0.45, 0.65, tTop) * cover;
  float h = mix(hUnder, hTop, cover);
  float rise = 0.65 / len * mix(hasUnder && under.y > 0.0 && under.y < 1.0 ? 1.0 : 0.0, top.y > 0.0 && top.y < 1.0 ? 1.0 : 0.0, cover);
  grad = (hTop - hUnder) * 6.0 * x * (1.0 - x) / ew * gm + rise * f;
  // Hair (narrow strands) takes no edge highlight: on thin strands it would sparkle.
  float v = mix(vUnder, vTop, cover) + 0.1 * edge * step(0.4, wid);
  return vec2(h, v * shadowed);
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
  float featherDhx = 0.0;
  float featherDhy = 0.0;
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
    // Patterned plumage (mottled, barred) is feathered too, with its pattern laid over the feathers (v2.2).
    bool pattern = abs(tileIndex - ${TILE.mottle}.0) < 0.5 || abs(tileIndex - ${TILE.barred}.0) < 0.5;
    if ((hair || pattern || abs(tileIndex - ${TILE.scales}.0) < 0.5) && dot(vFlow, vFlow) > 0.25) {
      float px = length(bpDx) + length(bpDy);
      float k = (1.0 - smoothstep(${S.fadeFrom}, ${S.fadeTo}, px)) * mix(1.0, ${S.far}, smoothstep(${S.near.toFixed(1)}, ${S.nearTo.toFixed(1)}, length(vViewPosition)));
      sampledDiffuseColor = vec4(1.0);
      // Once fully faded (feathers under about 3 px) the search is skipped.
      if (k * tileStrength > 0.0) {
        vec3 fl = normalize(vFlow - bn * dot(vFlow, bn));
        vec3 grad;
        vec2 fv = featherField(bp, bn, fl, hair ? ${S.hairLength} : ${S.length}, hair ? ${S.hairWidth} : ${S.width}, bpDx, bpDy, grad);
        float depth = (hair ? ${S.hairRelief} : ${S.relief}) / rep * k * tileStrength;
        featherH = fv.x * k * tileStrength;
        featherDhx = depth * dot(grad, bpDx);
        featherDhy = depth * dot(grad, bpDy);
        sampledDiffuseColor = vec4(vec3(mix(1.0, fv.y, k)), 1.0);
      }
      // The pattern spans several feathers and stays when the feathers fade with distance.
      if (pattern) sampledDiffuseColor *= triTap(map, bp * ${S.pattern}, bpDx * ${S.pattern}, bpDy * ${S.pattern}, bn, tileOrigin, tileCount, inset);
    } else {
      sampledDiffuseColor = triTap(map, bp, bpDx, bpDy, bn, tileOrigin, tileCount, inset);
    }
  } else {
    sampledDiffuseColor = tileTap(map, vRawUv, uvDx, uvDy, tileOrigin, tileCount, inset);
  }
  diffuseColor *= mix(vec4(1.0), sampledDiffuseColor, tileStrength);
#endif
`;

/**
 * The feather surface's relief: bump the view-space normal by the height's change across the pixel (no tangents
 * needed). The change comes from the analytic gradient, not finite differences of the height, which spiked across
 * feather edges into single-pixel speckle; the slope is capped so the normal never turns away from the viewer.
 */
const FEATHER_BUMP = /* glsl */ `
  if (featherH > 0.0) {
    vec3 dpx = dFdx(-vViewPosition);
    vec3 dpy = dFdy(-vViewPosition);
    vec3 r1 = cross(dpy, normal);
    vec3 r2 = cross(normal, dpx);
    float det = dot(dpx, r1);
    if (abs(det) > 1e-12) {
      vec3 slope = sign(det) * (featherDhx * r1 + featherDhy * r2) / abs(det);
      normal = normalize(normal - slope * min(1.0, ${S.maxSlope} / max(length(slope), 1e-6)));
    }
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
