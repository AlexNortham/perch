/**
 * Materials for sculpted birds (style guide §7.3, §8.2, §8.7). Two per bird kind, shared by every sculpted bird:
 * - `solid`: the opaque body, gear and gun. Vertex colour × a tile of the solid pattern atlas (feather scales, wood,
 *   leather…), chosen per vertex by the finish attribute `fx.w` and repeated in the shader;
 * - `cards`: the alpha-tested, double-sided feather cards, vertex colour × the card atlas (cut out at 0.5).
 * Both are physically based (metalness 0), with the per-vertex finish `fx` = (iridescence, glow, gloss, tile):
 * iridescent plumage shifts hue with view angle by up to 40°, glow lights catchlights, beads and chambers, gloss
 * polishes eyes, bills, claws and brass, and a fresnel rim (#FFE6C0) keeps birds the crispest thing on screen.
 * Built against the shared material library's conventions; see D-ART-004 for the switch-over.
 */
import { Color, DoubleSide, MeshStandardMaterial } from 'three';
import type { WebGLProgramParametersWithUniforms } from 'three';
import { cardAtlas, solidAtlas, TILE_GRID } from './feathers';
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
  alphaTest: 0.5,
  /** Inset of a tile's uv so bilinear filtering never reads the next tile (texels). */
  tileInset: 0.5,
} as const;

const VERTEX_HEAD = /* glsl */ `
attribute vec4 fx;
varying vec4 vFx;
varying vec2 vRawUv;
`;

const FRAGMENT_HEAD = /* glsl */ `
varying vec4 vFx;
varying vec2 vRawUv;
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
`;

/** The solid atlas: pick the tile in fx.w, repeat it with fract, keep mip selection from the unwrapped uv. */
const TILE_SAMPLE = /* glsl */ `
#ifdef USE_MAP
  vec2 tileCount = vec2(${TILE_GRID.cols}.0, ${TILE_GRID.rows}.0);
  float tileIndex = floor(vFx.w + 0.5);
  float tileStrength = 1.0 - clamp((vFx.w - tileIndex) / ${PATTERN_FADE}, 0.0, 1.0);
  vec2 tileOrigin = vec2(mod(tileIndex, tileCount.x), floor(tileIndex / tileCount.x));
  float inset = ${BIRD_SHADING.tileInset} / ${TILE_GRID.px}.0;
  vec2 inTile = inset + fract(vRawUv) * (1.0 - 2.0 * inset);
  vec2 atlasUv = (tileOrigin + inTile) / tileCount;
  vec4 sampledDiffuseColor = textureGrad(map, atlasUv, dFdx(vRawUv) / tileCount, dFdy(vRawUv) / tileCount);
  diffuseColor *= mix(vec4(1.0), sampledDiffuseColor, tileStrength);
#endif
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
    shader.vertexShader = VERTEX_HEAD + shader.vertexShader.replace('#include <uv_vertex>', '#include <uv_vertex>\n  vFx = fx;\n  vRawUv = uv;');
    let f = FRAGMENT_HEAD + shader.fragmentShader;
    if (tiled) f = f.replace('#include <map_fragment>', TILE_SAMPLE);
    f = f
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n  roughnessFactor = mix(roughnessFactor, glossRoughness, vFx.z);')
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n' + SHADE)
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
      alphaTest: BIRD_SHADING.alphaTest,
      alphaToCoverage: true,
      side: DoubleSide,
    }),
    false,
  );
  solid.name = 'bird-solid';
  cards.name = 'bird-cards';
  return { solid, cards };
}
