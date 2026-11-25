// Procedural "rotting corpse" look for the four zombie types, layered over the baked Quaternius
// bodies without any new assets: one shared shader patch (so one program for every zombie) that
//   - desaturates the body and pushes it toward a per-type sickly grey-green,
//   - paints purple bruises, blood-soaked blotches and drips in model space,
//   - tears a ragged hole in the shirt front (exposed ribs on the chest, raw flesh on the belly/back).
// Per-material uniforms hold the per-type look. Everything is a function of the bind-pose position,
// so it costs no geometry, no draw calls and no textures.
import * as THREE from 'three';

// tint: skin/cloth multiplier after desaturation; bruise/blood: patch colours; gore: how much of the
// body is soaked; holeA (chest) / holeB (back): [cx, cy, rx, ry] in height-normalised model space.
export const UNDEAD_LOOK = {
  z_walker: { tint: '#b4c0a4', bruise: '#4a3058', blood: '#6a0808', gore: 1.0, holeA: [0.02, 0.71, 0.085, 0.08], holeB: [-0.02, 0.71, 0.075, 0.1], eye: '#ffd21a', glow: '#ffc800' },
  z_sprinter: { tint: '#c0b8a0', bruise: '#5a2a38', blood: '#8a0c0c', gore: 1.2, holeA: [-0.025, 0.69, 0.08, 0.085], holeB: [0.025, 0.7, 0.07, 0.1], eye: '#ff3030', glow: '#ff1a1a' },
  z_brute: { tint: '#a8b4b4', bruise: '#3a2850', blood: '#6a0808', gore: 1.3, holeA: [0.0, 0.70, 0.1, 0.09], holeB: [0.03, 0.7, 0.085, 0.11], eye: '#ff8a10', glow: '#ff6a00' },
  z_spitter: { tint: '#b4cc88', bruise: '#3a4a20', blood: '#5a7a10', gore: 0.9, holeA: [0.0, 0.68, 0.07, 0.07], holeB: [0.0, 0.7, 0.06, 0.09], eye: '#9aff20', glow: '#7aff00' },
  z_shopper: { tint: '#c8d0c8', bruise: '#40304a', blood: '#6a0808', gore: 0.5, holeA: [0.0, 0.7, 0.05, 0.05], holeB: [0.0, 0.55, 0.04, 0.04], eye: '#ff2a1a', glow: '#ff2a1a' },
};

const GLSL_FUNCS = /* glsl */`
uniform vec3 uBase; uniform float uH; uniform vec3 uTint; uniform vec3 uBruise; uniform vec3 uBlood;
uniform vec4 uHoleA; uniform vec4 uHoleB; uniform float uSeed; uniform float uGore;
varying vec3 vUPos;
float uHash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float uNoise(vec3 x) {
  vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(uHash(i), uHash(i + vec3(1,0,0)), f.x), mix(uHash(i + vec3(0,1,0)), uHash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(uHash(i + vec3(0,0,1)), uHash(i + vec3(1,0,1)), f.x), mix(uHash(i + vec3(0,1,1)), uHash(i + vec3(1,1,1)), f.x), f.y), f.z);
}
`;

const GLSL_GORE = /* glsl */`
{
  vec3 d0 = vUPos - uBase;
  vec3 n = vec3(d0.x, d0.z, -d0.y) / uH;   // the baked meshes are Z-up (T-pose along x, face toward -y): n = (side, height 0..1, front)
  vec3 c = diffuseColor.rgb;
  float lum = dot(c, vec3(0.299, 0.587, 0.114));
  c = mix(vec3(lum), c, 0.9) * mix(vec3(1.0), uTint, 0.45);          // the baked palette is already light and desaturated; a faint per-type cast
  float rag = uNoise(n * 36.0 + uSeed) - 0.5;
  // chest wound: dark wet edge, raw flesh, pale ribs
  float front = step(-0.004, n.z);
  vec2 dA = (n.xy - uHoleA.xy) / uHoleA.zw;
  float rA = length(dA) + rag * 0.6;
  float inA = step(rA, 1.0) * front;
  float ribs = step(0.55, sin(n.y * 210.0) * 0.5 + 0.5);
  vec3 woundA = mix(vec3(0.16, 0.01, 0.02), vec3(0.6, 0.5, 0.4), ribs * step(rA, 0.5) * 0.55);
  c = mix(c, woundA, inA);
  c = mix(c, uBlood * 0.45, step(rA, 1.0) * (1.0 - step(rA, 0.9)) * front);
  // drips running down from it
  float drip = smoothstep(0.45, 0.7, uNoise(vec3(n.x * 70.0, n.y * 5.0, uSeed))) * step(n.y, uHoleA.y - uHoleA.w * 0.5) * smoothstep(0.32, 0.0, uHoleA.y - n.y) * step(abs(n.x - uHoleA.x), uHoleA.z * 1.1) * front;
  c = mix(c, uBlood * 0.8, drip);
  // back wound (what the high camera sees on a hunched zombie): ragged, raw red, ribs and a spine showing through
  vec2 dB = (n.xy - uHoleB.xy) / uHoleB.zw;
  float rB = length(dB) + rag * 0.7;
  float inB = step(rB, 1.0) * (1.0 - front);
  float ribsB = step(0.5, sin(n.y * 170.0) * 0.5 + 0.5) * step(abs(n.x - uHoleB.x), uHoleB.z * 0.65);
  vec3 woundB = mix(vec3(0.5, 0.06, 0.07), vec3(0.14, 0.0, 0.01), smoothstep(0.55, 0.95, rB));
  woundB = mix(woundB, vec3(0.6, 0.5, 0.4), ribsB * step(rB, 0.5) * 0.5);
  c = mix(c, woundB, inB);
  float dripB = smoothstep(0.45, 0.7, uNoise(vec3(n.x * 60.0, n.y * 5.0, uSeed + 4.0))) * step(n.y, uHoleB.y - uHoleB.w * 0.5) * smoothstep(0.3, 0.0, uHoleB.y - n.y) * step(abs(n.x - uHoleB.x), uHoleB.z) * (1.0 - front);
  c = mix(c, uBlood * 0.8, dripB);
  diffuseColor.rgb = c;
}
`;

// Dress a pooled zombie material (once) with the look of its type. `geo` supplies the model-space box.
export function undeadMaterial(m, type, geo, variant = 0) {
  const look = UNDEAD_LOOK[type] || UNDEAD_LOOK.z_walker;
  if (!geo.boundingBox) geo.computeBoundingBox();
  const b = geo.boundingBox;
  const H = Math.max(1e-4, b.max.z - b.min.z); // (Z-up, see GLSL_GORE)
  const u = {
    uBase: { value: new THREE.Vector3((b.min.x + b.max.x) / 2, (b.min.y + b.max.y) / 2, b.min.z) },
    uH: { value: H },
    uTint: { value: new THREE.Color(look.tint).convertSRGBToLinear() },
    uBruise: { value: new THREE.Color(look.bruise).convertSRGBToLinear() },
    uBlood: { value: new THREE.Color(look.blood).convertSRGBToLinear() },
    uHoleA: { value: new THREE.Vector4(...look.holeA) },
    uHoleB: { value: new THREE.Vector4(...look.holeB) },
    uSeed: { value: variant * 3.7 + (type.length % 5) },
    uGore: { value: look.gore },
  };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', 'varying vec3 vUPos;\n#include <common>')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvUPos = position;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\n${GLSL_FUNCS}`)
      .replace('#include <color_fragment>', `#include <color_fragment>\n${GLSL_GORE}`)
      .replace('#include <opaque_fragment>',
        `float zr = 1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0);
         outgoingLight += diffuseColor.rgb * 0.55; // self-lit in proportion to its own colour: pale skin and dark red blood both keep their contrast
         outgoingLight += vec3(0.45, 0.6, 0.5) * pow(zr, 3.0) * 0.28;
         #include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => 'undeadGore';
  m.userData.hook = m.onBeforeCompile; m.userData.hookKey = 'undeadGore'; // Material.clone() drops both: assets.js re-applies them to flash / fade copies
}
