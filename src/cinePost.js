// Cinematic toolkit, part 2: the post chain. three's EffectComposer is not vendored in this project, so this is a small
// purpose-built chain of render-target passes.
//
//   High:  scene -> HDR target (+ depth texture)
//          -> bright-pass + blur at 1/4 and 1/8 size (bloom)
//          -> composite: depth-of-field gather, whip-pan motion blur, bloom, filmic tone map, colour grade,
//             chromatic fringe, vignette, film grain -> canvas
//   Low:   the plain forward render straight to the canvas with the renderer's own tone mapping. No targets, no extra passes
//          (the 2D overlay adds a cheap vignette and the letterbox).
//
// The renderer is shared with the game, so everything this touches (tone mapping, exposure, render target) is restored.

import * as THREE from 'three';

const VERT = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';

const BRIGHT = `
uniform sampler2D tSrc; uniform float uThresh; varying vec2 vUv;
void main() {
  vec3 c = texture2D(tSrc, vUv).rgb;
  float l = max(c.r, max(c.g, c.b));
  float k = clamp((l - uThresh) / max(l, 1e-4), 0.0, 1.0);   // soft knee: only the part above the threshold glows
  gl_FragColor = vec4(c * k, 1.0);
}`;

const BLUR = `
uniform sampler2D tSrc; uniform vec2 uDir; varying vec2 vUv;
void main() {
  // 9-tap gaussian (5 fetches using linear sampling)
  vec3 c = texture2D(tSrc, vUv).rgb * 0.2270270270;
  c += texture2D(tSrc, vUv + uDir * 1.3846153846).rgb * 0.3162162162;
  c += texture2D(tSrc, vUv - uDir * 1.3846153846).rgb * 0.3162162162;
  c += texture2D(tSrc, vUv + uDir * 3.2307692308).rgb * 0.0702702703;
  c += texture2D(tSrc, vUv - uDir * 3.2307692308).rgb * 0.0702702703;
  gl_FragColor = vec4(c, 1.0);
}`;

const COMPOSITE = `
#include <packing>
uniform sampler2D tScene; uniform sampler2D tDepth; uniform sampler2D tBloomA; uniform sampler2D tBloomB;
uniform vec2 uRes; uniform float uNear; uniform float uFar;
uniform float uFocus; uniform float uAperture; uniform vec2 uMotion;
uniform float uExposure; uniform float uBloom; uniform float uGrain; uniform float uVig; uniform float uTime;
uniform vec3 uLift; uniform vec3 uGain; uniform float uGamma; uniform float uSat;
varying vec2 vUv;

float distAt(vec2 uv) { return -perspectiveDepthToViewZ(texture2D(tDepth, uv).x, uNear, uFar); }
// circle of confusion in pixels: grows with distance from the focus plane, capped
float cocAt(vec2 uv) {
  if (uAperture <= 0.0) return 0.0;
  float d = distAt(uv);
  return clamp(uAperture * abs(d - uFocus) / max(d, 8.0), 0.0, 1.0) * (uRes.y / 54.0);
}
float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }

void main() {
  vec2 px = 1.0 / uRes;
  vec3 col = texture2D(tScene, vUv).rgb;
  // ---- depth of field: a golden-spiral gather. A sample only counts if its own blur reaches this pixel, so a sharp
  // foreground never smears into a blurred background and vice versa.
  float coc = cocAt(vUv);
  if (coc > 0.4) {
    vec3 acc = col; float wsum = 1.0;
    for (int i = 0; i < 14; i++) {
      float fi = float(i) + 0.5;
      float r = sqrt(fi / 14.0) * coc, a = fi * 2.39996323;
      vec2 o = vec2(cos(a), sin(a)) * r;
      vec2 uv2 = vUv + o * px;
      float cs = cocAt(uv2);
      float w = clamp(cs - r + 1.0, 0.0, 1.0);
      vec3 s = texture2D(tScene, uv2).rgb;
      w *= 1.0 + 3.0 * clamp(dot(s, vec3(0.333)) - 1.0, 0.0, 4.0);   // bright lights bloom into bokeh discs
      acc += s * w; wsum += w;
    }
    col = acc / wsum;
  }
  // ---- whip-pan motion blur along uMotion (uv units)
  if (abs(uMotion.x) + abs(uMotion.y) > 0.002) {
    vec3 acc = col;
    for (int i = 1; i <= 7; i++) acc += texture2D(tScene, vUv + uMotion * (float(i) / 7.0 - 0.5) * 0.14).rgb;
    col = acc / 8.0;
  }
  // ---- bloom
  col += (texture2D(tBloomA, vUv).rgb * 0.7 + texture2D(tBloomB, vUv).rgb * 0.9) * uBloom;
  // ---- chromatic fringe, growing toward the edges (cheap lens character)
  vec2 d = vUv - 0.5;
  float edge = dot(d, d);
  col.r = mix(col.r, texture2D(tScene, vUv + d * edge * 0.006).r, 0.5);
  col.b = mix(col.b, texture2D(tScene, vUv - d * edge * 0.006).b, 0.5);
  // ---- filmic tone map + grade
  col = aces(col * uExposure);
  col = pow(max(col * uGain + uLift, 0.0), vec3(1.0 / uGamma));
  float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(vec3(l), col, uSat);
  // ---- vignette + grain (grain is strongest in the mid-tones and shadows, like real stock)
  col *= 1.0 - uVig * smoothstep(0.25, 0.85, length(d * vec2(1.0, 0.9)) * 1.25);
  col = pow(max(col, 0.0), vec3(1.0 / 2.2));   // gamma encode (sRGB-ish)
  float g = hash12(floor(gl_FragCoord.xy * 0.75) + fract(uTime * 7.31) * 311.0) - 0.5;
  col += g * uGrain * (1.0 - 0.6 * l);         // grain is added in display space, a little stronger in the shadows
  gl_FragColor = vec4(col, 1.0);
}`;

function pass(frag, uniforms) {
  const tri = new THREE.BufferGeometry();
  tri.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
  tri.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 0, 2, 0, 0, 2]), 2));
  const mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: frag, uniforms, depthTest: false, depthWrite: false });
  const mesh = new THREE.Mesh(tri, mat);
  mesh.frustumCulled = false;
  const scene = new THREE.Scene(); scene.add(mesh);
  return { scene, mat, tri };
}

export class CinePost {
  constructor(renderer, { high }) {
    this.r = renderer;
    this.high = high;
    this.saved = null;
    this.hasRT = high;   // High allocated targets (kept even if `high` is switched off later by the frame-rate guard)
    if (!high) return;
    const opts = { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false };
    this.rtScene = new THREE.WebGLRenderTarget(4, 4, { ...opts, depthBuffer: true, samples: 4 });
    this.rtScene.depthTexture = new THREE.DepthTexture(4, 4);
    this.rtScene.depthTexture.type = THREE.UnsignedIntType;
    this.rtA = [new THREE.WebGLRenderTarget(4, 4, opts), new THREE.WebGLRenderTarget(4, 4, opts)];   // 1/4 size ping-pong
    this.rtB = [new THREE.WebGLRenderTarget(4, 4, opts), new THREE.WebGLRenderTarget(4, 4, opts)];   // 1/8 size ping-pong
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.pBright = pass(BRIGHT, { tSrc: { value: null }, uThresh: { value: 1.0 } });
    this.pBlur = pass(BLUR, { tSrc: { value: null }, uDir: { value: new THREE.Vector2() } });
    this.pComp = pass(COMPOSITE, {
      tScene: { value: this.rtScene.texture }, tDepth: { value: this.rtScene.depthTexture }, tBloomA: { value: this.rtA[0].texture }, tBloomB: { value: this.rtB[0].texture },
      uRes: { value: new THREE.Vector2(1, 1) }, uNear: { value: 3 }, uFar: { value: 3600 }, uFocus: { value: 300 }, uAperture: { value: 0 }, uMotion: { value: new THREE.Vector2() },
      uExposure: { value: 1 }, uBloom: { value: 0.5 }, uGrain: { value: 0.04 }, uVig: { value: 0.45 }, uTime: { value: 0 },
      uLift: { value: new THREE.Vector3() }, uGain: { value: new THREE.Vector3(1, 1, 1) }, uGamma: { value: 1.05 }, uSat: { value: 1.1 },
    });
    this.size = new THREE.Vector2();
  }

  resize() {
    const r = this.r;
    r.getDrawingBufferSize(this.size);
    const w = Math.max(2, this.size.x | 0), h = Math.max(2, this.size.y | 0);
    if (this.w === w && this.h === h) return;
    this.w = w; this.h = h;
    this.rtScene.setSize(w, h);
    for (const t of this.rtA) t.setSize(Math.max(2, w >> 2), Math.max(2, h >> 2));
    for (const t of this.rtB) t.setSize(Math.max(2, w >> 3), Math.max(2, h >> 3));
    this.pComp.mat.uniforms.uRes.value.set(w, h);
  }

  blur(src, pp, w, h) {   // separable gaussian: src -> pp[0] (horizontal) -> pp[1] (vertical); result in pp[1]
    const r = this.r, u = this.pBlur.mat.uniforms;
    u.tSrc.value = src; u.uDir.value.set(1 / w, 0);
    r.setRenderTarget(pp[0]); r.render(this.pBlur.scene, this.cam);
    u.tSrc.value = pp[0].texture; u.uDir.value.set(0, 1 / h);
    r.setRenderTarget(pp[1]); r.render(this.pBlur.scene, this.cam);
  }

  /** p: { exposure, bloom, focus, aperture, blur:[x,y], grain, vignette, grade, time } */
  render(scene, camera, p) {
    const r = this.r;
    if (!this.high) {
      if (!this.saved) this.saved = { tm: r.toneMapping, ex: r.toneMappingExposure };
      r.toneMapping = THREE.ACESFilmicToneMapping;
      r.toneMappingExposure = 0.95 * p.exposure;
      r.render(scene, camera);
      return;
    }
    this.resize();
    const prevTarget = r.getRenderTarget();
    const tm = r.toneMapping;
    r.toneMapping = THREE.NoToneMapping;   // tone mapping happens once, in the composite
    r.setRenderTarget(this.rtScene);
    r.clear();
    r.render(scene, camera);
    // bloom: bright pass into the 1/4 target, blur it, then a second blur from a 1/8 copy for the wide halo
    const bu = this.pBright.mat.uniforms;
    bu.tSrc.value = this.rtScene.texture; bu.uThresh.value = p.threshold ?? 1.4;
    r.setRenderTarget(this.rtA[1]); r.render(this.pBright.scene, this.cam);
    this.blur(this.rtA[1].texture, this.rtA, this.rtA[0].width, this.rtA[0].height);
    bu.tSrc.value = this.rtA[1].texture; bu.uThresh.value = 0.0;
    r.setRenderTarget(this.rtB[1]); r.render(this.pBright.scene, this.cam);
    this.blur(this.rtB[1].texture, this.rtB, this.rtB[0].width, this.rtB[0].height);
    this.pComp.mat.uniforms.tBloomA.value = this.rtA[1].texture;
    this.pComp.mat.uniforms.tBloomB.value = this.rtB[1].texture;
    // composite to the canvas
    const u = this.pComp.mat.uniforms, g = p.grade;
    u.uNear.value = camera.near; u.uFar.value = camera.far;
    u.uFocus.value = p.focus || 300; u.uAperture.value = p.aperture || 0;
    u.uMotion.value.set(p.blur ? p.blur[0] : 0, p.blur ? p.blur[1] : 0);
    u.uExposure.value = p.exposure; u.uBloom.value = p.bloom; u.uGrain.value = p.grain; u.uVig.value = p.vignette; u.uTime.value = p.time;
    u.uLift.value.set(...g.lift); u.uGain.value.set(...g.gain); u.uGamma.value = g.gamma; u.uSat.value = g.sat;
    r.setRenderTarget(null);
    r.render(this.pComp.scene, this.cam);
    r.toneMapping = tm;
    r.setRenderTarget(prevTarget);
  }

  dispose() {
    if (this.saved) { this.r.toneMapping = this.saved.tm; this.r.toneMappingExposure = this.saved.ex; this.saved = null; }
    if (!this.hasRT) return;
    for (const t of [this.rtScene, ...this.rtA, ...this.rtB]) t.dispose();
    this.rtScene.depthTexture.dispose();
    for (const p of [this.pBright, this.pBlur, this.pComp]) { p.mat.dispose(); p.tri.dispose(); }
  }
}
