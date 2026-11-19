/** The final grade (§10.4): a gentle split tone (warm highlights, cool shadows) and a soft vignette, in display space. */
export const GRADE_VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}
`;

export const GRADE_FRAGMENT = /* glsl */ `
uniform sampler2D tDiffuse;
uniform vec3 uWarm;
uniform vec3 uCool;
uniform float uVignette;
varying vec2 vUv;
void main() {
  vec4 c = texture2D( tDiffuse, vUv );
  float lum = dot( c.rgb, vec3( 0.2126, 0.7152, 0.0722 ) );
  c.rgb *= mix( uCool, uWarm, smoothstep( 0.15, 0.75, lum ) );
  vec2 d = vUv - 0.5;
  c.rgb *= 1.0 - uVignette * smoothstep( 0.3, 0.85, length( d * vec2( 1.2, 1.0 ) ) * 1.41 );
  gl_FragColor = c;
}
`;
