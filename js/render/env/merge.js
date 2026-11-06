// 靜態裝飾合併（擁有者：C）：把不會動的裝飾依「材質＋屬性格式＋陰影設定」合併成少量 mesh。
// 有 userData.update、燈光、Sprite、Points、InstancedMesh、多重材質的物件保留原樣（回傳在 kept）。
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

function isDynamic(o) {
  if (o.userData && typeof o.userData.update === 'function') return true;
  let dyn = false;
  o.traverse((ch) => {
    if (dyn) return;
    if (ch !== o && ch.userData && typeof ch.userData.update === 'function') dyn = true;
    else if (ch.isLight || ch.isSprite || ch.isPoints || ch.isLine || ch.isSkinnedMesh || ch.isInstancedMesh) dyn = true;
    else if (ch.isMesh && (Array.isArray(ch.material) || (ch.morphTargetInfluences && ch.morphTargetInfluences.length))) dyn = true;
    else if (ch.isMesh) {
      for (const a of Object.values(ch.geometry.attributes)) if (a.isInterleavedBufferAttribute) { dyn = true; break; }
    }
  });
  return dyn;
}

function sig(g) {
  return Object.keys(g.attributes).sort().map((k) => {
    const a = g.attributes[k];
    return `${k}:${a.itemSize}:${a.array.constructor.name}:${a.normalized ? 1 : 0}`;
  }).join(',');
}

/**
 * objs：已經擺好位置、掛在 parent 底下的物件
 * 回傳 { meshes, kept }；被合併的原物件會從 parent 移除（kept 的留著）。
 */
export function mergeStatic(objs, parent, { shadows = true } = {}) {
  const buckets = new Map();
  const kept = [];
  parent.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(parent.matrixWorld).invert();
  const m = new THREE.Matrix4();
  for (const o of objs) {
    if (isDynamic(o)) { kept.push(o); continue; }
    o.updateMatrixWorld(true);
    o.traverse((ch) => {
      if (!ch.isMesh || !ch.visible) return;
      const g = ch.geometry.index ? ch.geometry.toNonIndexed() : ch.geometry.clone();
      g.morphAttributes = {};
      m.multiplyMatrices(inv, ch.matrixWorld);
      g.applyMatrix4(m);
      if (!g.attributes.normal) g.computeVertexNormals();
      const cast = shadows && ch.castShadow, recv = ch.receiveShadow;
      const key = `${ch.material.uuid}|${sig(g)}|${cast ? 1 : 0}${recv ? 1 : 0}|${ch.renderOrder}`;
      let b = buckets.get(key);
      if (!b) { b = { material: ch.material, geos: [], cast, recv, renderOrder: ch.renderOrder }; buckets.set(key, b); }
      b.geos.push(g);
    });
    parent.remove(o);
  }
  const meshes = [];
  for (const b of buckets.values()) {
    const merged = b.geos.length === 1 ? b.geos[0] : mergeGeometries(b.geos, false);
    if (!merged) {
      for (const g of b.geos) {
        const mesh = new THREE.Mesh(g, b.material);
        mesh.castShadow = b.cast; mesh.receiveShadow = b.recv; mesh.renderOrder = b.renderOrder;
        mesh.userData.mergedGeometry = true;
        parent.add(mesh); meshes.push(mesh);
      }
      continue;
    }
    if (b.geos.length > 1) for (const g of b.geos) g.dispose();
    merged.computeBoundingSphere();
    const mesh = new THREE.Mesh(merged, b.material);
    mesh.castShadow = b.cast; mesh.receiveShadow = b.recv; mesh.renderOrder = b.renderOrder;
    mesh.name = 'decor-merged';
    mesh.userData.mergedGeometry = true;
    parent.add(mesh);
    meshes.push(mesh);
  }
  return { meshes, kept };
}
