// 模型工具：把基本幾何組合成一個「頂點色」geometry，並依 key 快取（擁有者：B）
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { MAT } from '../palette.js';

export const TAU = Math.PI * 2;
export const PI = Math.PI;

// ---- 決定性亂數 ----
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hash3(x, y, z, k) {
  const h = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719 + k * 4.581) * 43758.5453;
  return h - Math.floor(h);
}

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler();
const _p = new THREE.Vector3(), _s = new THREE.Vector3();
const _c = new THREE.Color(), _c2 = new THREE.Color();

/** t = { p:[x,y,z], r:[rx,ry,rz], s:number|[sx,sy,sz], o:'XYZ' } */
function tmat(t) {
  const p = t.p || [0, 0, 0], r = t.r || [0, 0, 0], s = t.s ?? 1;
  _p.set(p[0], p[1], p[2]);
  _e.set(r[0], r[1], r[2], t.o || 'XYZ');
  _q.setFromEuler(_e);
  if (typeof s === 'number') _s.set(s, s, s); else _s.set(s[0], s[1], s[2]);
  return _m.compose(_p, _q, _s);
}

/**
 * Builder：收集零件 → build() 合併成一個 BufferGeometry（position / normal / color / fx）
 * o（選項）：
 *   top: 顏色      由下到上漸層到這個顏色
 *   jit: 0.06      每個三角形的明暗隨機（手繪感）
 *   glow: 0–1      自發光強度（夜晚會亮）
 *   shine: 0–1     光澤（金屬、水晶）
 *   wob: 0         頂點擾動幅度（岩石、樹冠、史萊姆更自然）
 *   seed           擾動種子
 */
export class Builder {
  constructor(seed = 1) { this.geos = []; this.seed = seed * 7919 + 13; }

  add(src, color, t = {}, o = {}) {
    const g = src.index ? src.toNonIndexed() : src.clone();
    for (const k of Object.keys(g.attributes)) if (k !== 'position') g.deleteAttribute(k);
    const pos = g.attributes.position, n = pos.count, arr = pos.array;
    if (o.wob) {
      const w = o.wob, k = o.seed ?? 0;
      for (let i = 0; i < n; i++) {
        const x = Math.round(arr[i * 3] * 1e4) / 1e4, y = Math.round(arr[i * 3 + 1] * 1e4) / 1e4, z = Math.round(arr[i * 3 + 2] * 1e4) / 1e4;
        arr[i * 3] += (hash3(x, y, z, k + 1) - 0.5) * 2 * w;
        arr[i * 3 + 1] += (hash3(x, y, z, k + 2) - 0.5) * 2 * w * (o.wobY ?? 1);
        arr[i * 3 + 2] += (hash3(x, y, z, k + 3) - 0.5) * 2 * w;
      }
    }
    let minY = Infinity, maxY = -Infinity;
    if (o.top) for (let i = 0; i < n; i++) { const y = arr[i * 3 + 1]; if (y < minY) minY = y; if (y > maxY) maxY = y; }
    _c.set(color); if (o.top) _c2.set(o.top);
    const col = new Float32Array(n * 3);
    const jit = o.jit ?? 0.06;
    for (let i = 0; i < n; i += 3) {
      this.seed++;
      const j = 1 + (hash3(this.seed, 0.37, 1.7, 3) - 0.5) * 2 * jit;
      for (let k = 0; k < 3 && i + k < n; k++) {
        const vi = i + k;
        let r = _c.r, gg = _c.g, b = _c.b;
        if (o.top) {
          const f = maxY > minY ? (arr[vi * 3 + 1] - minY) / (maxY - minY) : 0;
          r += (_c2.r - r) * f; gg += (_c2.g - gg) * f; b += (_c2.b - b) * f;
        }
        col[vi * 3] = Math.min(1, r * j); col[vi * 3 + 1] = Math.min(1, gg * j); col[vi * 3 + 2] = Math.min(1, b * j);
      }
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const fx = new Float32Array(n * 2);
    const gl = o.glow || 0, sh = o.shine || 0;
    if (gl || sh) for (let i = 0; i < n; i++) { fx[i * 2] = gl; fx[i * 2 + 1] = sh; }
    g.setAttribute('fx', new THREE.BufferAttribute(fx, 2));
    g.applyMatrix4(tmat(t));
    g.computeVertexNormals();
    this.geos.push(g);
    return this;
  }
  _tmp(geo, color, t, o) { this.add(geo, color, t, o); geo.dispose(); return this; }

  // ---- 基本形狀（box / cyl / cone 底部在 y=0；其餘以中心為原點）----
  box(w, h, d, color, t, o) { return this._tmp(new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0), color, t, o); }
  boxC(w, h, d, color, t, o) { return this._tmp(new THREE.BoxGeometry(w, h, d), color, t, o); }
  cyl(rt, rb, h, seg, color, t, o) { return this._tmp(new THREE.CylinderGeometry(rt, rb, h, seg, 1).translate(0, h / 2, 0), color, t, o); }
  cylC(rt, rb, h, seg, color, t, o) { return this._tmp(new THREE.CylinderGeometry(rt, rb, h, seg, 1), color, t, o); }
  cone(r, h, seg, color, t, o) { return this._tmp(new THREE.ConeGeometry(r, h, seg, 1).translate(0, h / 2, 0), color, t, o); }
  coneC(r, h, seg, color, t, o) { return this._tmp(new THREE.ConeGeometry(r, h, seg, 1), color, t, o); }
  ico(r, detail, color, t, o) { return this._tmp(new THREE.IcosahedronGeometry(r, detail), color, t, o); }
  dodec(r, color, t, o) { return this._tmp(new THREE.DodecahedronGeometry(r, 0), color, t, o); }
  oct(r, color, t, o) { return this._tmp(new THREE.OctahedronGeometry(r, 0), color, t, o); }
  tet(r, color, t, o) { return this._tmp(new THREE.TetrahedronGeometry(r, 0), color, t, o); }
  sphere(r, ws, hs, color, t, o) { return this._tmp(new THREE.SphereGeometry(r, ws, hs), color, t, o); }
  /** pts: [[半徑, y], ...] 由下到上 */
  lathe(pts, seg, color, t, o) {
    return this._tmp(new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(Math.max(r, 0), y)), seg), color, t, o);
  }
  torus(R, r, rs, ts, arc, color, t, o) { return this._tmp(new THREE.TorusGeometry(R, r, rs, ts, arc), color, t, o); }
  /** 2D 外形（xy 平面）沿 z 擠出 depth，z 方向置中 */
  shape(pts, depth, color, t, o, bevel = 0) {
    const s = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
    const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 1, curveSegments: 4 });
    g.translate(0, 0, -depth / 2);
    return this._tmp(g, color, t, o);
  }
  /** 三角柱（屋頂）：寬 w（x）、高 h、長 d（z），底在 y=0 */
  prism(w, h, d, color, t, o) { return this.shape([[-w / 2, 0], [w / 2, 0], [0, h]], d, color, t, o); }

  build() {
    if (!this.geos.length) return null;
    const m = mergeGeometries(this.geos, false);
    for (const g of this.geos) g.dispose();
    this.geos = [];
    m.computeBoundingSphere(); m.computeBoundingBox();
    return m;
  }
}

// ---- 快取 ----
const GEO = new Map();
export function cachedGeo(key, fn) {
  let g = GEO.get(key);
  if (g === undefined) { g = fn(); GEO.set(key, g); }
  return g;
}
export function geoCacheSize() { return GEO.size; }

/** 依 key 建立（或取用快取的）頂點色 mesh；fn(b) 用 Builder 加零件 */
export function part(key, fn, { receive = false, cast = true, seed = 1 } = {}) {
  const geo = cachedGeo(key, () => { const b = new Builder(seed); fn(b); return b.build(); });
  const m = new THREE.Mesh(geo, MAT.vc);
  m.castShadow = cast; m.receiveShadow = receive; m.name = key;
  return m;
}

/** 空的群組（樞紐點），可直接設定位置 */
export function pivot(x = 0, y = 0, z = 0, ...children) {
  const g = new THREE.Group(); g.position.set(x, y, z);
  for (const c of children) g.add(c);
  return g;
}

/** 受擊閃白＋冰凍換材質（只換 MAT.vc 的 mesh；共用材質，不會每隻 new） */
export function makeSkin(root) {
  const meshes = [];
  root.traverse((o) => { if (o.isMesh && o.material === MAT.vc) meshes.push(o); });
  let state = 0, flashT = 0;
  const mats = [MAT.vc, MAT.flash, MAT.frozen];
  return {
    hit() { flashT = 0.12; },
    update(dt, frozen) {
      if (flashT > 0) flashT -= dt;
      const s = flashT > 0 ? 1 : frozen ? 2 : 0;
      if (s !== state) { state = s; for (const m of meshes) m.material = mats[s]; }
    },
    reset() { flashT = 0; state = 0; for (const m of meshes) m.material = MAT.vc; },
  };
}

/** 計算 Object3D 底下所有 mesh 的三角形數 */
export function countTris(obj) {
  let n = 0;
  obj.traverse((o) => {
    if (o.isMesh && o.geometry) {
      const g = o.geometry;
      n += (g.index ? g.index.count : g.attributes.position.count) / 3;
    }
  });
  return n;
}

// ---- 動畫小工具 ----
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
/** 指數趨近（與幀率無關） */
export const damp = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));
