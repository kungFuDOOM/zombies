// GPU resource hygiene. Resources that outlive a level (cached geometry, shared textures, prop templates) are marked with
// keep(); disposeTree() frees everything else under a root (the previous level's geometries, materials and canvas textures).
// Disposing something that is still needed is harmless (three.js re-uploads on next use), so this only has to be roughly right.
const KEEP = new WeakSet();
export function keep(o) { if (o) KEEP.add(o); return o; }
function matTextures(m, fn) { for (const k in m) { const v = m[k]; if (v && v.isTexture) fn(v); } }
export function keepTree(root) {
  root.traverse((o) => {
    if (!o.isMesh && !o.isPoints) return;
    keep(o.geometry);
    for (const m of [].concat(o.material)) { keep(m); matTextures(m, keep); }
  });
  return root;
}
export function disposeTree(root) {
  const geos = new Set(), mats = new Set(), texs = new Set();
  root.traverse((o) => {
    if (o.isInstancedMesh) o.dispose(); // instance matrix / colour buffers
    if (o.isSkinnedMesh && o.skeleton) o.skeleton.dispose(); // (bone texture; character geometry / pooled materials are keep()-marked)
    if (!o.isMesh && !o.isPoints && !o.isSprite) return;
    if (o.geometry && !o.isSprite && !KEEP.has(o.geometry)) geos.add(o.geometry); // (all Sprites share one three.js geometry)
    for (const m of [].concat(o.material || [])) {
      if (KEEP.has(m)) continue;
      mats.add(m);
      matTextures(m, (t) => { if (!KEEP.has(t)) texs.add(t); });
    }
  });
  geos.forEach((g) => g.dispose());
  mats.forEach((m) => m.dispose());
  texs.forEach((t) => t.dispose());
  return { geometries: geos.size, materials: mats.size, textures: texs.size };
}
