/** Chimney warm-air shimmer (§1.4): faint rising streaks, strongest at the column's silhouette, additive. */
export const SHIMMER_VERTEX = /* glsl */ `
varying vec2 vUv;
varying float vRim;
void main() {
  vUv = uv;
  vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );
  vec3 n = normalize( normalMatrix * normal );
  vRim = 1.0 - abs( dot( n, normalize( -mvPosition.xyz ) ) );
  gl_Position = projectionMatrix * mvPosition;
}
`;

export const SHIMMER_FRAGMENT = /* glsl */ `
uniform float uTime;
uniform vec3 uColour;
uniform float uStrength;
varying vec2 vUv;
varying float vRim;
float h( vec2 p ) { return fract( sin( dot( p, vec2( 12.9898, 78.233 ) ) ) * 43758.5453 ); }
float n( vec2 p ) {
  vec2 i = floor( p ); vec2 f = fract( p ); f = f * f * ( 3.0 - 2.0 * f );
  return mix( mix( h( i ), h( i + vec2( 1.0, 0.0 ) ), f.x ), mix( h( i + vec2( 0.0, 1.0 ) ), h( i + vec2( 1.0, 1.0 ) ), f.x ), f.y );
}
void main() {
  float streak = n( vec2( vUv.x * 24.0, vUv.y * 3.0 - uTime * 0.8 ) ) * n( vec2( vUv.x * 9.0 + 3.0, vUv.y * 6.0 - uTime * 1.3 ) );
  float fade = smoothstep( 0.0, 0.15, vUv.y ) * smoothstep( 1.0, 0.7, vUv.y );
  gl_FragColor = vec4( uColour * uStrength * ( 0.35 + vRim ) * streak * fade, 1.0 );
}
`;
