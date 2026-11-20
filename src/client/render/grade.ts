/**
 * The final grade (§10.4): a gentle split tone (warm highlights, cool shadows) and a soft vignette, folded into the
 * OutputPass (tone mapping and sRGB) so the frame pays for one full-screen pass, not two.
 */
import { Vector3 } from 'three';
import type { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const DECLARE = /* glsl */ `
uniform sampler2D tDiffuse;
uniform vec3 uWarm;
uniform vec3 uCool;
uniform float uVignette;
`;
const GRADE = /* glsl */ `
{
  float lum = dot( gl_FragColor.rgb, vec3( 0.2126, 0.7152, 0.0722 ) );
  gl_FragColor.rgb *= mix( uCool, uWarm, smoothstep( 0.15, 0.75, lum ) );
  vec2 d = vUv - 0.5;
  gl_FragColor.rgb *= 1.0 - uVignette * smoothstep( 0.3, 0.85, length( d * vec2( 1.2, 1.0 ) ) * 1.41 );
}
`;

export interface Grade {
  readonly warm: { readonly r: number; readonly g: number; readonly b: number };
  readonly cool: { readonly r: number; readonly g: number; readonly b: number };
  readonly vignette: number;
}

/** Add the grade to an OutputPass, after its tone mapping and colour-space conversion. */
export function gradeOutput(pass: OutputPass, g: Grade): OutputPass {
  pass.uniforms['uWarm'] = { value: new Vector3(g.warm.r, g.warm.g, g.warm.b) };
  pass.uniforms['uCool'] = { value: new Vector3(g.cool.r, g.cool.g, g.cool.b) };
  pass.uniforms['uVignette'] = { value: g.vignette };
  const m = pass.material;
  m.fragmentShader = m.fragmentShader
    .replace('uniform sampler2D tDiffuse;', DECLARE)
    .replace(/(sRGBTransferOETF\( gl_FragColor \);\s*#endif)/, `$1\n${GRADE}`);
  m.needsUpdate = true;
  return pass;
}
