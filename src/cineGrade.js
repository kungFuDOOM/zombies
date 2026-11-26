// The films' "LUT": one analytic filmic grade (white balance, contrast, teal/orange split tone, sickly-green mids,
// desaturation, lifted milky blacks), shared by the High composite and the cheap Low pass, with named presets.

const preset = (wb, contrast, shadow, high, sick, sat, floor, vig, grain) =>
  ({ wb, contrast, shadow, high, sick, sat, floor, vig, grain, lift: [0, 0, 0], gain: [1, 1, 1], gamma: 1 });

export const GRADES = {
  NIGHT_RAIN: preset([0.96, 1, 1.05], 1.12, [-0.016, 0.004, 0.022], [0.022, 0.008, -0.02], 0.25, 0.74, 0.04, 0.5, 0.04),
  SICK_FLUOR: preset([0.95, 1.04, 0.93], 1.08, [-0.01, 0.012, 0.004], [0.01, 0.02, -0.018], 1.0, 0.68, 0.042, 0.55, 0.045),
  FRYER_HELL: preset([1.07, 0.98, 0.86], 1.16, [-0.012, 0.006, 0.018], [0.03, 0.01, -0.03], 0.45, 0.82, 0.036, 0.55, 0.04),
  PIZZA_EMBER: preset([1.04, 0.99, 0.92], 1.12, [-0.014, 0.004, 0.02], [0.026, 0.01, -0.024], 0.5, 0.8, 0.04, 0.5, 0.04),
  COLD_GRIEF: preset([0.92, 0.99, 1.08], 1.04, [-0.01, 0.004, 0.024], [0, 0.006, 0.012], 0.15, 0.58, 0.048, 0.6, 0.045),
  BLEACH_SHOCK: preset([1, 1, 1.02], 1.24, [-0.006, 0.004, 0.01], [0.01, 0.01, 0], 0.35, 0.32, 0.05, 0.62, 0.055),
  HERO_GRIT: preset([1.03, 1, 0.95], 1.14, [-0.018, 0.004, 0.024], [0.03, 0.012, -0.026], 0.12, 0.86, 0.032, 0.45, 0.035),
  PROJECTOR: preset([1, 1, 1], 1.0, [0, 0, 0], [0, 0, 0], 0, 0, 0.02, 0.7, 0.06),
};

export const gradeOf = (g, fallback = GRADES.NIGHT_RAIN) => (typeof g === 'string' ? GRADES[g] || fallback : g || fallback);

export const GRADE_GLSL = `
uniform vec3 uWB; uniform float uContrast; uniform vec3 uShadow; uniform vec3 uHigh; uniform float uSick; uniform float uSat; uniform float uFloor;
uniform vec3 uLift; uniform vec3 uGain; uniform float uGamma;
uniform float uExposure; uniform float uGrain; uniform float uVig; uniform float uTime; uniform float uBar; uniform vec2 uRes;
vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float film24(float k) { return hash12(vec2(mod(floor(uTime * 24.0), 997.0), k)); }     // steps at 24 fps, like a projector
vec2 weaveUv(vec2 uv) {   // gate weave: never more than about half a pixel
  vec2 o = vec2(sin(uTime * 1.3) * 0.25 + (film24(3.1) - 0.5) * 0.5, (film24(7.7) - 0.5) * 0.7) * 0.6;
  return uv + o / uRes;
}
float breath() { return 1.0 + 0.024 * (film24(11.3) - 0.5); }
vec3 filmGrade(vec3 c) {   // display space, 0..1
  c *= uWB;
  c = clamp((c - 0.42) * uContrast + 0.42, 0.0, 1.0);
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c += uShadow * (1.0 - l) * (1.0 - l) + uHigh * l * l;
  c = pow(max(c * uGain + uLift * (1.0 - c), 0.0), 1.0 / vec3(uGamma));
  c += uSick * 4.0 * l * (1.0 - l) * vec3(-0.02, 0.035, -0.04);
  l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(vec3(l), c, uSat);
  return uFloor + max(c, 0.0) * (1.0 - uFloor);
}
// linear HDR colour -> the finished film frame (tone map, grade, vignette on the scope picture, grain)
vec3 develop(vec3 hdr, vec2 uv) {
  vec3 col = pow(aces(hdr * uExposure * breath()), vec3(1.0 / 2.2));
  col = filmGrade(col);
  vec2 d = (uv - 0.5) * vec2(0.9, 0.9 / max(0.4, 1.0 - 2.0 * uBar));
  col *= 1.0 - uVig * smoothstep(0.28, 0.82, length(d) * 1.15);
  float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
  float g = hash12(floor(gl_FragCoord.xy * 0.75) + vec2(mod(floor(uTime * 24.0), 997.0) * 37.0)) - 0.5;
  return col + g * uGrain * (1.2 - l);
}`;

/** The uniforms GRADE_GLSL declares, as a fresh three.js uniforms object. V is THREE (passed in so this file stays pure). */
export function gradeUniforms(V) {
  const v3 = (a = 0) => ({ value: new V.Vector3(a, a, a) });
  const f = (a) => ({ value: a });
  return {
    uWB: v3(1), uContrast: f(1), uShadow: v3(), uHigh: v3(), uSick: f(0), uSat: f(1), uFloor: f(0),
    uLift: v3(), uGain: v3(1), uGamma: f(1), uExposure: f(1), uGrain: f(0.04), uVig: f(0.45), uTime: f(0), uBar: f(0.186),
    uRes: { value: new V.Vector2(960, 640) },
  };
}

/** p: { grade, exposure, grain?, vignette?, time, bar } */
export function setGrade(u, p) {
  const g = gradeOf(p.grade);
  u.uWB.value.set(...g.wb); u.uContrast.value = g.contrast; u.uShadow.value.set(...g.shadow); u.uHigh.value.set(...g.high);
  u.uSick.value = g.sick; u.uSat.value = g.sat; u.uFloor.value = g.floor;
  u.uLift.value.set(...(g.lift || [0, 0, 0])); u.uGain.value.set(...(g.gain || [1, 1, 1])); u.uGamma.value = g.gamma || 1;
  u.uExposure.value = p.exposure ?? 1; u.uGrain.value = p.grain ?? g.grain; u.uVig.value = p.vignette ?? g.vig;
  u.uTime.value = p.time || 0; u.uBar.value = p.bar ?? 0.186;
}
