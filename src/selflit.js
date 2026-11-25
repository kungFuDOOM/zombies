// Self-lit mask for the High-quality grade pass. The scene is drawn into a render target whose ALPHA channel marks what was
// lit: 1 = lit surface (graded + tone-mapped by the post pass), 0 = self-lit (neon, signs, screens, eye glows, additive glows),
// which the post pass leaves un-tonemapped so it stays vivid. No colour/brightness detection: a material is self-lit only when
// it says so explicitly (toneMapped:false, additive blending, or userData.selfLit = true).
//  - opaque self-lit materials write alpha 0 straight from their fragment shader;
//  - transparent ones (glow sprites, particles, halos) keep their colour blend but multiply the target alpha by (1 - srcAlpha)
//    through separate alpha blend factors, so the mask fades with the glow.
// Installed once on THREE.Material.prototype before anything compiles. Materials that bring their own onBeforeCompile (the zombie
// shaders) are lit surfaces and are not affected.
import * as THREE from 'three';

export function isSelfLit(m) {
  return m.toneMapped === false || m.userData.selfLit === true || m.blending === THREE.AdditiveBlending;
}
const opaqueSelfLit = (m) => !m.transparent && isSelfLit(m);

export function installSelfLitMask() {
  const P = THREE.Material.prototype;
  if (P.__selfLitMask) return;
  P.__selfLitMask = true;
  const baseKey = P.customProgramCacheKey;
  P.customProgramCacheKey = function () { return baseKey.call(this) + (opaqueSelfLit(this) ? '|selflit' : ''); };
  P.onBeforeCompile = function (parameters) {
    if (!isSelfLit(this)) return;
    if (this.transparent) { // (blend state is read each draw, so this takes effect from the next draw call)
      const add = this.blending === THREE.AdditiveBlending;
      if ((add || this.blending === THREE.NormalBlending) && !this.premultipliedAlpha) {
        this.userData.selfLit = true;
        this.blending = THREE.CustomBlending;
        this.blendEquation = THREE.AddEquation; this.blendSrc = THREE.SrcAlphaFactor; this.blendDst = add ? THREE.OneFactor : THREE.OneMinusSrcAlphaFactor;
        this.blendEquationAlpha = THREE.AddEquation; this.blendSrcAlpha = THREE.ZeroFactor; this.blendDstAlpha = THREE.OneMinusSrcAlphaFactor;
      }
      return;
    }
    parameters.fragmentShader = parameters.fragmentShader.replace('#include <opaque_fragment>', '#include <opaque_fragment>\n\tgl_FragColor.a = 0.0; // self-lit: skip the grade pass');
  };
}
