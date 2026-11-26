// Cinematic toolkit, part 2: the post chain. three's EffectComposer is not vendored in this project, so this is a small
// purpose-built chain of render-target passes. Both tiers end in the same film "develop" step (cineGrade.js: ACES,
// the grade, lifted blacks, scope-picture vignette, 24 fps grain, gate weave and exposure breathing).
//
//   High:  scene -> HDR target (+ depth texture)
//          -> bright-pass + blur at 1/4 and 1/8 size (bloom, whose blurred bright pixels also feed the anamorphic streaks)
//          -> composite: depth-of-field gather, camera motion blur, bloom, haze streaks, chromatic fringe, develop -> canvas
//   Low:   scene -> one target -> a single develop pass -> canvas. If the pass cannot be built or cannot hold the frame
//          rate, it drops to the plain forward render (the 2D overlay then adds a cheap vignette).
//
// The renderer is shared with the game, so everything this touches (tone mapping, exposure, render target) is restored.

import * as THREE from 'three';
import { GRADE_GLSL, gradeUniforms, setGrade } from './cineGrade.js';

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
uniform float uNear; uniform float uFar;
uniform float uFocus; uniform float uAperture; uniform vec2 uMotion;
uniform float uBloom; uniform float uCA; uniform float uStreak;
varying vec2 vUv;
${GRADE_GLSL}

float distAt(vec2 uv) { return -perspectiveDepthToViewZ(texture2D(tDepth, uv).x, uNear, uFar); }
// circle of confusion in pixels: grows with distance from the focus plane, capped
float cocAt(vec2 uv) {
  if (uAperture <= 0.0) return 0.0;
  float d = distAt(uv);
  return clamp(uAperture * abs(d - uFocus) / max(d, 8.0), 0.0, 1.0) * (uRes.y / 54.0);
}

void main() {
  vec2 uv = weaveUv(vUv);
  vec2 px = 1.0 / uRes;
  vec3 col = texture2D(tScene, uv).rgb;
  // ---- depth of field: a golden-spiral gather. A sample only counts if its own blur reaches this pixel, so a sharp
  // foreground never smears into a blurred background and vice versa.
  float coc = cocAt(uv);
  if (coc > 0.4) {
    vec3 acc = col; float wsum = 1.0;
    for (int i = 0; i < 14; i++) {
      float fi = float(i) + 0.5;
      float r = sqrt(fi / 14.0) * coc, a = fi * 2.39996323;
      vec2 o = vec2(cos(a), sin(a)) * r;
      vec2 uv2 = uv + o * px;
      float cs = cocAt(uv2);
      float w = clamp(cs - r + 1.0, 0.0, 1.0);
      vec3 s = texture2D(tScene, uv2).rgb;
      w *= 1.0 + 3.0 * clamp(dot(s, vec3(0.333)) - 1.0, 0.0, 4.0);   // bright lights bloom into bokeh discs
      acc += s * w; wsum += w;
    }
    col = acc / wsum;
  }
  // ---- camera motion blur along uMotion (uv units: the shutter's share of this frame's camera movement)
  if (abs(uMotion.x) + abs(uMotion.y) > 0.0015) {
    vec3 acc = col;
    for (int i = 0; i < 8; i++) acc += texture2D(tScene, uv + uMotion * (float(i) / 7.0 - 0.5)).rgb;
    col = acc / 9.0;
  }
  // ---- bloom, and the anamorphic streak: the wide bloom smeared sideways, in cold blue
  col += (texture2D(tBloomA, uv).rgb * 0.7 + texture2D(tBloomB, uv).rgb * 0.9) * uBloom;
  if (uStreak > 0.0) {
    vec3 st = vec3(0.0);
    for (int i = 1; i <= 6; i++) {
      float o = float(i) * 0.022, w = 1.0 - float(i) / 7.0;
      st += (max(texture2D(tBloomB, uv + vec2(o, 0.0)).rgb - 0.55, 0.0) + max(texture2D(tBloomB, uv - vec2(o, 0.0)).rgb - 0.55, 0.0)) * w;
    }
    col += dot(st, vec3(0.333)) * vec3(0.36, 0.6, 1.0) * uStreak;
  }
  // ---- chromatic aberration, growing toward the edges; spikes on a hit
  if (uCA > 0.0) {
    vec2 d = uv - 0.5;
    vec2 o = d * dot(d, d) * uCA * 2.2;
    col.r = mix(col.r, texture2D(tScene, uv + o).r, 0.55);
    col.b = mix(col.b, texture2D(tScene, uv - o).b, 0.55);
  }
  gl_FragColor = vec4(develop(col, vUv), 1.0);
}`;

const LOW = `
uniform sampler2D tScene;
varying vec2 vUv;
${GRADE_GLSL}
void main() { gl_FragColor = vec4(develop(texture2D(tScene, weaveUv(vUv)).rgb, vUv), 1.0); }`;

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
    this.hasRT = false;    // High targets allocated (kept even if `high` is switched off later by the frame-rate guard)
    this.lowOk = true;     // the Low develop pass is usable (a failure or the frame-rate guard switches it off)
    this.lean = false;     // set by the frame-rate guard: the overlay then skips its stand-in grain too
    this.low = null;
    this.size = new THREE.Vector2();
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    if (!high) return;
    this.hasRT = true;
    const opts = { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false };
    this.rtScene = new THREE.WebGLRenderTarget(4, 4, { ...opts, depthBuffer: true, samples: 4 });
    this.rtScene.depthTexture = new THREE.DepthTexture(4, 4);
    this.rtScene.depthTexture.type = THREE.UnsignedIntType;
    this.rtA = [new THREE.WebGLRenderTarget(4, 4, opts), new THREE.WebGLRenderTarget(4, 4, opts)];   // 1/4 size ping-pong
    this.rtB = [new THREE.WebGLRenderTarget(4, 4, opts), new THREE.WebGLRenderTarget(4, 4, opts)];   // 1/8 size ping-pong
    this.pBright = pass(BRIGHT, { tSrc: { value: null }, uThresh: { value: 1.0 } });
    this.pBlur = pass(BLUR, { tSrc: { value: null }, uDir: { value: new THREE.Vector2() } });
    this.pComp = pass(COMPOSITE, {
      tScene: { value: this.rtScene.texture }, tDepth: { value: this.rtScene.depthTexture }, tBloomA: { value: this.rtA[0].texture }, tBloomB: { value: this.rtB[0].texture },
      uNear: { value: 3 }, uFar: { value: 3600 }, uFocus: { value: 300 }, uAperture: { value: 0 }, uMotion: { value: new THREE.Vector2() },
      uBloom: { value: 0.5 }, uCA: { value: 0.004 }, uStreak: { value: 0.5 }, ...gradeUniforms(THREE),
    });
  }

  /** Does a develop pass (either tier) draw the picture? When not, the 2D overlay adds its own vignette. */
  get graded() { return this.high || this.lowOk; }

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

  buildLow() {
    const ext = this.r.extensions;
    const half = !!(ext && (ext.has('EXT_color_buffer_float') || ext.has('EXT_color_buffer_half_float')));
    const rt = new THREE.WebGLRenderTarget(4, 4, { type: half ? THREE.HalfFloatType : THREE.UnsignedByteType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: true, samples: 0 });
    this.low = { rt, pass: pass(LOW, { tScene: { value: rt.texture }, ...gradeUniforms(THREE) }), w: 0, h: 0 };
  }

  renderPlain(scene, camera, p) {
    const r = this.r;
    if (!this.saved) this.saved = { tm: r.toneMapping, ex: r.toneMappingExposure };
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 0.95 * p.exposure;
    r.setRenderTarget(null);
    r.render(scene, camera);
  }

  renderLow(scene, camera, p) {
    const r = this.r;
    if (!this.low) this.buildLow();
    const L = this.low;
    r.getDrawingBufferSize(this.size);
    const w = Math.max(2, this.size.x | 0), h = Math.max(2, this.size.y | 0);
    const resized = L.w !== w || L.h !== h;
    if (resized) { L.w = w; L.h = h; L.rt.setSize(w, h); }
    const prevTarget = r.getRenderTarget(), tm = r.toneMapping;
    try {
      if (resized) { // an incomplete framebuffer does not throw: ask, or a phone could show black
        r.setRenderTarget(L.rt);
        const gl = r.getContext();
        if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('low film target is not renderable');
      }
      r.toneMapping = THREE.NoToneMapping;
      r.setRenderTarget(L.rt);
      r.clear();
      r.render(scene, camera);
      const u = L.pass.mat.uniforms;
      setGrade(u, { ...p, exposure: p.exposure * 0.97 });
      u.uRes.value.set(w, h);
      r.setRenderTarget(null);
      r.render(L.pass.scene, this.cam);
    } finally {
      r.toneMapping = tm;
      r.setRenderTarget(prevTarget);
    }
  }

  blur(src, pp, w, h) {   // separable gaussian: src -> pp[0] (horizontal) -> pp[1] (vertical); result in pp[1]
    const r = this.r, u = this.pBlur.mat.uniforms;
    u.tSrc.value = src; u.uDir.value.set(1 / w, 0);
    r.setRenderTarget(pp[0]); r.render(this.pBlur.scene, this.cam);
    u.tSrc.value = pp[0].texture; u.uDir.value.set(0, 1 / h);
    r.setRenderTarget(pp[1]); r.render(this.pBlur.scene, this.cam);
  }

  /** p: { exposure, bloom, focus, aperture, blur:[x,y], ca, grain, vignette, grade, time, bar } */
  render(scene, camera, p) {
    const r = this.r;
    if (!this.high) {
      if (this.lowOk) {
        try { this.renderLow(scene, camera, p); return; } catch (err) { console.warn('low film pass unavailable', err); this.lowOk = false; }
      }
      this.renderPlain(scene, camera, p);
      return;
    }
    this.resize();
    const prevTarget = r.getRenderTarget();
    const tm = r.toneMapping;
    try {
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
      const u = this.pComp.mat.uniforms;
      setGrade(u, p);
      u.uNear.value = camera.near; u.uFar.value = camera.far;
      u.uFocus.value = p.focus || 300; u.uAperture.value = p.aperture || 0;
      u.uMotion.value.set(p.blur ? p.blur[0] : 0, p.blur ? p.blur[1] : 0);
      u.uBloom.value = p.bloom; u.uCA.value = p.ca ?? 0.004;
      r.setRenderTarget(null);
      r.render(this.pComp.scene, this.cam);
    } finally {
      r.toneMapping = tm;
      r.setRenderTarget(prevTarget);
    }
  }

  dispose() {
    if (this.saved) { this.r.toneMapping = this.saved.tm; this.r.toneMappingExposure = this.saved.ex; this.saved = null; }
    if (this.low) { this.low.rt.dispose(); this.low.pass.mat.dispose(); this.low.pass.tri.dispose(); this.low = null; }
    if (!this.hasRT) return;
    this.hasRT = false;
    for (const t of [this.rtScene, ...this.rtA, ...this.rtB]) t.dispose();
    this.rtScene.depthTexture.dispose();
    for (const p of [this.pBright, this.pBlur, this.pComp]) { p.mat.dispose(); p.tri.dispose(); }
  }
}
