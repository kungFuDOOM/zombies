// Smooth-skinned body surfaces. A figure's arms, legs and torso are each ONE continuous lofted
// tube (rings of ellipses along the bones) whose vertices are weighted across the joints, so
// elbows, knees, shoulders and the waist bend like a body instead of a stack of rigid blocks.
// Pure geometry: no game imports. See DESIGN.md section 5.1.

import * as THREE from 'three';

const _t = new THREE.Vector3(), _s = new THREE.Vector3(), _f = new THREE.Vector3(), _c = new THREE.Vector3();
const REF_Z = new THREE.Vector3(0, 0, 1), REF_X = new THREE.Vector3(1, 0, 0);
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a || 1e-6))); return t * t * (3 - 2 * t); };

// A rig's skinning context: the bone order every pre-skinned geometry indexes into (the same
// order mergeParts / bind use) and bind-pose positions in rig space.
export function skinCtx(rig) {
  rig.updateMatrixWorld(true);
  const bones = [];
  rig.traverse((o) => { if (o.isBone) bones.push(o); });
  const index = new Map();
  bones.forEach((b, i) => { if (!index.has(b.name)) index.set(b.name, i); });
  const inv = new THREE.Matrix4().copy(rig.matrixWorld).invert();
  return {
    rig, bones, index, inv, skeleton: null,
    pos(name) {
      const b = rig.getObjectByName(name);
      return new THREE.Vector3().setFromMatrixPosition(b.matrixWorld).applyMatrix4(inv);
    },
    id(name) { return this.index.get(name) ?? 0; },
  };
}

// Interpolates [[d, ...values], ...] (sorted by d) with an ease between keys.
function sampler(keys0) {
  const keys = keys0.map((k) => [k[0], k[1], k[2] ?? k[1], k[3] ?? 0, k[4] ?? 0]);
  return (d) => {
    if (d <= keys[0][0]) return keys[0].slice(1);
    for (let i = 1; i < keys.length; i++) {
      if (d <= keys[i][0]) {
        const a = keys[i - 1], b = keys[i], t = smooth(a[0], b[0], d);
        return a.slice(1).map((v, k) => v + ((b[k + 1] ?? 0) - v) * t);
      }
    }
    return keys[keys.length - 1].slice(1);
  };
}

/**
 * Loft a skinned tube along a chain of joints.
 *  pts      joint positions (rig space); bone k drives the stretch pts[k] -> pts[k+1]
 *  bones    bone names, bones.length === pts.length - 1
 *  profile  [[d, rx, rz, oz, ox], ...] radii (side, front-back) and offsets, d = metres along the path
 *  ext0/1   metres the tube is extended past the first / last point (buried in the torso, or under a boot)
 *  blend    half-width of each joint's weight blend, in tube radii (per joint or one number)
 *  zones    [{ from, to, mat, inflate }] materials along the tube (sleeves, trousers...)
 * Returns [{ geometry, mat }], one per zone.
 */
export function loft(S, { pts, bones, profile, ext0 = 0, ext1 = 0, seg = 10, step = 0.05, blend = 0.9, zones = null, cap0 = true, cap1 = true, tint = null }) {
  const n = pts.length;
  const Q = [], qi = [];
  Q.push(pts[0].clone().addScaledVector(_t.subVectors(pts[1], pts[0]).normalize(), -ext0));
  pts.forEach((p, k) => { qi[k] = Q.length; Q.push(p.clone()); });
  if (ext1 > 0) Q.push(pts[n - 1].clone().addScaledVector(_t.subVectors(pts[n - 1], pts[n - 2]).normalize(), ext1));
  const A = [0];
  for (let i = 1; i < Q.length; i++) A.push(A[i - 1] + Q[i].distanceTo(Q[i - 1]));
  const total = A[A.length - 1];
  const joint = pts.map((_, k) => A[qi[k]]); // arc of each joint; bone k covers joint[k] .. joint[k+1]
  const prof = sampler(profile);
  const hw = (k) => (Array.isArray(blend) ? blend[k] : blend) * Math.max(...prof(joint[k]).slice(0, 2));

  // ring distances
  const ds = new Set([0, total]);
  for (let d = step; d < total; d += step) ds.add(+d.toFixed(5));
  for (const p of profile) if (p[0] > 0 && p[0] < total) ds.add(+p[0].toFixed(5));
  for (const z of zones || []) { ds.add(+Math.max(0, z.from).toFixed(5)); ds.add(+Math.min(total, z.to).toFixed(5)); }
  for (let k = 1; k < n - 1; k++) { ds.add(+joint[k].toFixed(5)); ds.add(+(joint[k] - hw(k) * 0.7).toFixed(5)); ds.add(+(joint[k] + hw(k) * 0.7).toFixed(5)); }
  const list = [...ds].filter((d) => d >= 0 && d <= total).sort((a, b) => a - b).filter((d, i, a) => !i || d - a[i - 1] > 1e-4);

  const at = (d) => { // centre and tangent
    let i = 1;
    while (i < Q.length - 1 && A[i] < d) i++;
    const a = Q[i - 1], b = Q[i], u = (d - A[i - 1]) / (A[i] - A[i - 1] || 1);
    const c = new THREE.Vector3().lerpVectors(a, b, Math.min(1, Math.max(0, u)));
    const tn = new THREE.Vector3().subVectors(b, a).normalize();
    return { c, t: tn };
  };
  const weights = (d) => {
    const w = new Array(bones.length).fill(0);
    w[0] = 1;
    for (let k = 1; k < bones.length; k++) {
      const t = smooth(joint[k] - hw(k), joint[k] + hw(k), d);
      w[k] = w[k - 1] * t;
      w[k - 1] *= 1 - t;
    }
    return w;
  };
  const ids = bones.map((b) => S.id(b));
  const out = [];
  const spans = zones && zones.length ? zones : [{ from: 0, to: total, mat: null }];
  for (const z of spans) {
    const rings = list.filter((d) => d >= z.from - 1e-4 && d <= z.to + 1e-4);
    if (rings.length < 2) continue;
    const pos = [], nor = [], uv = [], col = [], si = [], sw = [], idx = [];
    const cols = seg + 1;
    const addRing = (d, scale, capOut) => {
      const { c, t } = at(d);
      const ref = Math.abs(t.dot(REF_Z)) > 0.95 ? REF_X : REF_Z;
      _s.crossVectors(t, ref).normalize();
      _f.crossVectors(_s, t).normalize();
      const [rx0, rz0, oz = 0, ox = 0] = prof(d);
      const k = (z.inflate || 1) * scale;
      const w = weights(d);
      for (let i = 0; i <= seg; i++) {
        const a = (i / seg) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
        _c.copy(c).addScaledVector(_s, ox + ca * rx0 * k).addScaledVector(_f, oz + sa * rz0 * k);
        if (capOut) _c.addScaledVector(t, capOut);
        pos.push(_c.x, _c.y, _c.z);
        nor.push(0, 0, 0);
        uv.push(i / seg, d / 0.35);
        const shade = (tint ? tint(d, a) : 1) * (0.88 + 0.12 * sa);
        col.push(shade, shade, shade);
        for (let m = 0; m < 4; m++) { si.push(m < ids.length ? ids[m] : 0); sw.push(m < w.length ? w[m] : 0); }
      }
    };
    const capA = cap0 && z.from <= 1e-4, capB = cap1 && z.to >= total - 1e-4;
    if (capA) addRing(rings[0], 0, -0.002);
    for (const d of rings) addRing(d, 1, 0);
    if (capB) addRing(rings[rings.length - 1], 0, 0.002);
    const nr = pos.length / 3 / cols;
    for (let r = 0; r < nr - 1; r++) for (let i = 0; i < seg; i++) {
      const a = r * cols + i, b = a + 1, c2 = a + cols, d2 = c2 + 1;
      idx.push(a, c2, b, b, c2, d2);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
    g.setIndex(idx);
    // winding: a mid-tube triangle must face away from the chain
    const P = g.attributes.position;
    const mi = Math.max(1, Math.floor(nr / 2)) * seg * 6;
    const tri = [0, 1, 2].map((k) => new THREE.Vector3().fromBufferAttribute(P, idx[mi + k]));
    const fn = new THREE.Vector3().crossVectors(tri[1].clone().sub(tri[0]), tri[2].clone().sub(tri[0]));
    const cen = at(Math.max(0, Math.min(total, list[Math.floor(nr / 2)] ?? 0))).c;
    if (fn.dot(tri[0].clone().sub(cen)) < 0) for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; }
    g.setIndex(idx);
    g.computeVertexNormals();
    // weld the seam's normals
    const N = g.attributes.normal;
    for (let r = 0; r < nr; r++) {
      const a = r * cols, b = a + seg;
      const nx = N.getX(a) + N.getX(b), ny = N.getY(a) + N.getY(b), nz = N.getZ(a) + N.getZ(b), l = Math.hypot(nx, ny, nz) || 1;
      N.setXYZ(a, nx / l, ny / l, nz / l); N.setXYZ(b, nx / l, ny / l, nz / l);
    }
    out.push({ geometry: g, mat: z.mat });
  }
  return out;
}

// Put lofted geometry on the rig. merge=true leaves a plain Mesh (flagged) for mergeParts to bake
// into the actor's per-material skinned meshes; otherwise it becomes its own SkinnedMesh.
export function addSurface(S, { geometry, mat }, { merge = false } = {}) {
  if (mat && mat.flatShading) { mat.flatShading = false; mat.needsUpdate = true; } // smooth bodies
  if (merge) {
    const m = new THREE.Mesh(geometry, mat);
    m.frustumCulled = false;
    S.rig.add(m);
    return m;
  }
  if (!S.skeleton) S.skeleton = new THREE.Skeleton(S.bones);
  const m = new THREE.SkinnedMesh(geometry, mat);
  m.frustumCulled = false;
  S.rig.add(m);
  m.updateMatrixWorld(true);
  m.bind(S.skeleton, m.matrixWorld);
  return m;
}

export function addSurfaces(S, list, opts) { return list.map((s) => addSurface(S, s, opts)); }
