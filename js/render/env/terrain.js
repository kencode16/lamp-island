// 島嶼地形產生器（擁有者：C）
// 產出：頂面（一張 canvas 貼圖的平面）、崖壁＋岸邊岩石＋塔基座＋木橋＋碼頭＋路面小石頭（合併成一個頂點色 mesh）、
// 海岸距離場（給海面畫泡沫與淺灘）。全部在「格子空間」建好，最後整組平移 (-W/2, 0, -H/2) 到世界空間。
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeRng, hash2, hash3, vnoise, fbm } from './rng.js';

export const SEA_Y = -0.35;
export const SAND_Y = -0.1;
export const PLATFORM_TOP = 0.12;
export const DOCK_TOP = -0.03;
export const BOTTOM_Y = -1.7;

export const DECOR_KIND = {
  T: 'tree', P: 'pine', R: 'rock', M: 'mushroom', H: 'house', W: 'windmill', F: 'fence',
  G: 'grave', D: 'dock', K: 'bush', C: 'crystal', Y: 'lamppost',
  U: 'glowshroom', X: 'stalagmite', Q: 'minecart',
};
/** 第二章洞窟主題時，覆蓋上面的對照（C 換成洞窟水晶） */
export const CAVE_DECOR_KIND = { C: 'cavecrystal', U: 'glowshroom', X: 'stalagmite', Q: 'minecart' };
export const WALKABLE = new Set(['=', 'B', 'o', 'S', 'L']);

export function makeGridInfo(levelDef) {
  const rows = levelDef.grid || [];
  const H = rows.length;
  let W = 0;
  for (const r of rows) W = Math.max(W, r.length);
  const at = (c, r) => (c < 0 || r < 0 || c >= W || r >= H) ? '~' : (rows[r][c] || '~');
  return { W, H, at, rows };
}
export const isLand = (ch) => ch !== '~' && ch !== 'B' && ch !== 'D';
export const topOf = (ch) => (ch === ',' ? SAND_Y : 0);
/** 物件該擺的高度（塔基座頂、沙灘、碼頭、橋面） */
export function surfaceOf(ch) {
  switch (ch) {
    case '~': return SEA_Y;
    case ',': return SAND_Y;
    case '#': return PLATFORM_TOP;
    case 'D': return DOCK_TOP;
    default: return 0;
  }
}

// ---------------------------------------------------------------------------
// 共用：幫幾何體加上每面一色的頂點色（非索引）
const _col = new THREE.Color();
export function faceColored(geo, hex, vary, rnd, mossHex = null, mossChance = 0) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  for (const k of Object.keys(g.attributes)) if (k !== 'position') g.deleteAttribute(k);
  g.computeVertexNormals();
  const n = g.attributes.position.count;
  const col = new Float32Array(n * 3);
  const nor = g.attributes.normal.array;
  const base = new THREE.Color(hex), moss = mossHex ? new THREE.Color(mossHex) : null;
  for (let i = 0; i < n; i += 3) {
    _col.copy(base);
    if (moss && nor[i * 3 + 1] > 0.55 && rnd() < mossChance) _col.copy(moss);
    _col.multiplyScalar(1 - vary + rnd() * vary * 2);
    for (let k = 0; k < 3; k++) { col[(i + k) * 3] = _col.r; col[(i + k) * 3 + 1] = _col.g; col[(i + k) * 3 + 2] = _col.b; }
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
export function place(geo, x, y, z, ry = 0, sx = 1, sy = 1, sz = 1, rx = 0, rz = 0) {
  _e.set(rx, ry, rz); _q.setFromEuler(_e); _p.set(x, y, z); _s.set(sx, sy, sz);
  geo.applyMatrix4(_m4.compose(_p, _q, _s));
  return geo;
}

/** 不規則的低多邊形岩石 */
export function rockGeo(rnd, hex, moss = true) {
  const g = new THREE.IcosahedronGeometry(1, 0);   // 本來就是 non-indexed
  const a = g.attributes.position.array;
  const k = Math.floor(rnd() * 1e6);
  for (let i = 0; i < a.length; i += 3) {
    const qx = Math.round(a[i] * 1000), qy = Math.round(a[i + 1] * 1000), qz = Math.round(a[i + 2] * 1000);
    const f = 0.72 + hash3(qx, qy, qz, k) * 0.5;
    a[i] *= f; a[i + 1] *= f; a[i + 2] *= f;
  }
  return faceColored(g, hex, 0.09, rnd, moss ? '#7fa05a' : null, 0.45);
}

// ---------------------------------------------------------------------------
// 半格網格頂點（ix, iz 是 0..2W, 0..2H）：海岸上的頂點會被擾動、轉角被磨圓
function makeLattice(G, seed) {
  const { at } = G;
  const cache = new Map();
  return function lattice(ix, iz) {
    const key = ix * 8192 + iz;
    let v = cache.get(key);
    if (v) return v;
    const gx = ix / 2, gz = iz / 2;
    const cs = (ix % 2 === 0) ? [ix / 2 - 1, ix / 2] : [(ix - 1) / 2];
    const rs = (iz % 2 === 0) ? [iz / 2 - 1, iz / 2] : [(iz - 1) / 2];
    let nLand = 0, nWater = 0, bridge = false, ox = 0, oz = 0;
    for (const c of cs) for (const r of rs) {
      const ch = at(c, r);
      const cx = c + 0.5 - gx, cz = r + 0.5 - gz;
      if (ch === 'B' || ch === 'D') bridge = true;
      if (isLand(ch)) { nLand++; ox -= cx; oz -= cz; } else { nWater++; ox += cx; oz += cz; }
    }
    let x = gx, z = gz, dx = 0, dz = 0;
    const coast = nLand > 0 && nWater > 0;
    if (coast) {
      const l = Math.hypot(ox, oz);
      if (l > 1e-6) { dx = ox / l; dz = oz / l; }
      if (!bridge) {
        const h = hash2(ix, iz, seed) - 0.5, h2 = hash2(ix, iz, seed + 7) - 0.5;
        const corner = (ix % 2 === 0 && iz % 2 === 0);
        let push;
        if (corner && nLand === 1) push = -0.21 + h * 0.06;       // 凸角磨圓
        else if (corner && nLand === 3) push = 0.09 + h * 0.05;   // 凹角補一點
        else push = h * 0.2;                                      // 直線海岸起伏
        x += dx * push - dz * h2 * 0.07;
        z += dz * push + dx * h2 * 0.07;
      }
    }
    v = { x, z, dx, dz, coast, bridge };
    cache.set(key, v);
    return v;
  };
}

// ---------------------------------------------------------------------------
// 頂面
function buildTop(G, L) {
  const { W, H, at } = G;
  const pos = [], uv = [];
  const push = (v, y) => { pos.push(v.x, y, v.z); uv.push(v.x / W, 1 - v.z / H); };
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
    const ch = at(c, r);
    if (!isLand(ch)) continue;
    const y = topOf(ch);
    for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) {
      const a = L(2 * c + i, 2 * r + j), b = L(2 * c + i, 2 * r + j + 1);
      const d = L(2 * c + i + 1, 2 * r + j + 1), e = L(2 * c + i + 1, 2 * r + j);
      push(a, y); push(b, y); push(d, y);
      push(a, y); push(d, y); push(e, y);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  const nor = new Float32Array(pos.length);
  for (let i = 1; i < nor.length; i += 3) nor[i] = 1;
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  return g;
}

// ---------------------------------------------------------------------------
// 崖壁（海側分層土石、陸地高低差的小台階）
const SEA_OUT = [0, 0.012, 0.05, 0.1, 0.17, 0.38];
const LIP = { grass: '#63a947', sand: '#dcc68e', road: '#a27c4e', plaza: '#b3a996' };
function lipKind(ch) { return ch === ',' ? 'sand' : (ch === '=' || ch === 'S') ? 'road' : 'grass'; }

const WALL_COLORS = {
  island: {
    grass: ['#63a947', '#8e6a44', '#7a583a', '#857c71', '#686159'],
    road: ['#a27c4e', '#8e6a44', '#7a583a', '#857c71', '#686159'],
    sand: ['#dcc68e', '#cbb07a', '#a8875a', '#857c71', '#686159'],
    step: '#8a7048',
  },
  cave: {
    grass: ['#6a6058', '#4f4842', '#423c38', '#37332f', '#2a2725'],
    road: ['#7c654e', '#56493d', '#463d35', '#37332f', '#2a2725'],
    sand: ['#7a736a', '#5c5650', '#47423d', '#37332f', '#2a2725'],
    step: '#4f4842',
  },
};

function buildWalls(G, L, seed, theme = 'island') {
  const { W, H, at } = G;
  const pos = [], col = [];
  const c3 = new THREE.Color();
  const rowColors = WALL_COLORS[theme] || WALL_COLORS.island;
  const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3(), tmpN = new THREE.Vector3();
  function quad(p0, p1, p2, p3, hex, vary, outX, outZ) {
    // p0,p1 上緣；p3,p2 下緣
    tmpA.set(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]);
    tmpB.set(p3[0] - p0[0], p3[1] - p0[1], p3[2] - p0[2]);
    tmpN.crossVectors(tmpA, tmpB);
    let order = [p0, p1, p2, p0, p2, p3];
    if (tmpN.x * outX + tmpN.z * outZ < 0) order = [p0, p2, p1, p0, p3, p2];
    c3.set(hex).multiplyScalar(1 - vary + hash2(Math.floor(p0[0] * 97), Math.floor(p0[2] * 89 + p0[1] * 53), seed + 3) * vary * 2);
    for (const p of order) { pos.push(p[0], p[1], p[2]); col.push(c3.r, c3.g, c3.b); }
  }
  const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];
  const seaEdges = [];
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
    const ch = at(c, r);
    if (!isLand(ch)) continue;
    const top = topOf(ch);
    for (const [dc, dr] of dirs) {
      const nb = at(c + dc, r + dr);
      // 邊上的 3 個半格頂點
      let pts;
      if (dr === -1) pts = [[2 * c, 2 * r], [2 * c + 1, 2 * r], [2 * c + 2, 2 * r]];
      else if (dr === 1) pts = [[2 * c, 2 * r + 2], [2 * c + 1, 2 * r + 2], [2 * c + 2, 2 * r + 2]];
      else if (dc === -1) pts = [[2 * c, 2 * r], [2 * c, 2 * r + 1], [2 * c, 2 * r + 2]];
      else pts = [[2 * c + 2, 2 * r], [2 * c + 2, 2 * r + 1], [2 * c + 2, 2 * r + 2]];
      if (isLand(nb)) {
        const nt = topOf(nb);
        if (nt < top - 0.001) {
          for (let s = 0; s < 2; s++) {
            const a = L(pts[s][0], pts[s][1]), b = L(pts[s + 1][0], pts[s + 1][1]);
            quad([a.x, top, a.z], [b.x, top, b.z], [b.x, nt, b.z], [a.x, nt, a.z], rowColors.step, 0.06, dc, dr);
          }
        }
        continue;
      }
      // 海側崖壁：6 層頂點
      seaEdges.push({ c, r, dc, dr, nb, pts });
      const kind = lipKind(ch);
      const ys = [top, top - 0.07, -0.25, -0.5, -0.85, BOTTOM_Y];
      const colors = rowColors[kind];
      const vtx = (ix, iz, k) => {
        const v = L(ix, iz);
        let o = SEA_OUT[k], y = ys[k];
        if (k >= 2) {
          o += (hash3(ix, iz, k, seed) - 0.5) * 0.09;
          if (k <= 4) y += (hash3(ix, iz, k + 10, seed) - 0.5) * 0.07;
        }
        return [v.x + v.dx * o, y, v.z + v.dz * o];
      };
      for (let s = 0; s < 2; s++) {
        const [ax, az] = pts[s], [bx, bz] = pts[s + 1];
        for (let k = 0; k < 5; k++) {
          quad(vtx(ax, az, k), vtx(bx, bz, k), vtx(bx, bz, k + 1), vtx(ax, az, k + 1), colors[k], k === 0 ? 0.04 : 0.08, dc, dr);
        }
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  return { geo: g, seaEdges };
}

// ---------------------------------------------------------------------------
// 岸邊岩石
function buildCoastRocks(G, L, seaEdges, rnd, out, theme = 'island') {
  const { at } = G;
  const cave = theme === 'cave';
  const rc = cave ? ['#4c4845', '#57524d', '#45423f'] : ['#8f8a84', '#9a9186', '#8a857e'];
  for (const e of seaEdges) {
    const { c, r, dc, dr, nb } = e;
    if (nb === 'B' || nb === 'D') continue;
    // 邊的兩端不能緊鄰橋／碼頭
    const side1 = at(c + dc + dr, r + dr + dc), side2 = at(c + dc - dr, r + dr - dc);
    if (side1 === 'B' || side1 === 'D' || side2 === 'B' || side2 === 'D') continue;
    if (rnd() > 0.34) continue;
    const mid = L(e.pts[1][0], e.pts[1][1]);
    const nRocks = rnd() < 0.3 ? 2 : 1;
    for (let i = 0; i < nRocks; i++) {
      const s = (i === 0 ? 0.16 + rnd() * 0.24 : 0.08 + rnd() * 0.12);
      const along = (rnd() - 0.5) * 0.8;
      const outD = 0.14 + rnd() * 0.22 + s * 0.4;
      const x = mid.x + dc * outD + (dc === 0 ? along : 0);
      const z = mid.z + dr * outD + (dr === 0 ? along : 0);
      const y = SEA_Y - 0.05 + (rnd() - 0.2) * s * 0.7;
      const g = rockGeo(rnd, rnd() < 0.5 ? rc[0] : rc[1], !cave);
      place(g, x, y, z, rnd() * 6.28, s * (0.9 + rnd() * 0.5), s * (0.6 + rnd() * 0.4), s * (0.9 + rnd() * 0.5));
      out.push(g);
    }
  }
  // 外海幾顆小礁石（點綴；洞窟的外圍是岩壁，不放）
  const { W, H } = G;
  for (let i = 0; i < (cave ? 0 : Math.round((W + H) / 6)); i++) {
    const side = Math.floor(rnd() * 4);
    let x, z;
    if (side === 0) { x = rnd() * W; z = -1.5 - rnd() * 2.5; }
    else if (side === 1) { x = rnd() * W; z = H + 1.5 + rnd() * 2.5; }
    else if (side === 2) { x = -1.5 - rnd() * 2.5; z = rnd() * H; }
    else { x = W + 1.5 + rnd() * 2.5; z = rnd() * H; }
    // 不要放在陸地或橋附近
    const cc = Math.floor(x), rr = Math.floor(z);
    let near = false;
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) if (at(cc + a, rr + b) !== '~') near = true;
    if (near) continue;
    const s = 0.18 + rnd() * 0.3;
    const g = rockGeo(rnd, rc[2], !cave);
    place(g, x, SEA_Y - 0.08, z, rnd() * 6.28, s, s * 0.8, s * 1.1);
    out.push(g);
  }
}

// ---------------------------------------------------------------------------
// 塔基座：明顯的圓形石台
const PLATFORM_COLORS = {
  island: ['#8c8274', '#ddd3c0', '#c3b7a1', '#a69a88'],
  cave: ['#5f5953', '#a49b8e', '#8d8478', '#79716a'],
};
function buildPlatform(x, z, rnd, out, theme = 'island') {
  const PC = PLATFORM_COLORS[theme] || PLATFORM_COLORS.island;
  const ry = rnd() * 6.28;
  out.push(place(faceColored(new THREE.CylinderGeometry(0.45, 0.49, 0.09, 18), PC[0], 0.05, rnd), x, 0.045, z, ry));
  out.push(place(faceColored(new THREE.CylinderGeometry(0.405, 0.43, 0.035, 18), PC[1], 0.035, rnd), x, 0.1025, z, ry));
  out.push(place(faceColored(new THREE.CylinderGeometry(0.23, 0.23, 0.014, 16), PC[2], 0.03, rnd), x, PLATFORM_TOP + 0.003, z, ry));
  for (let i = 0; i < 8; i++) {
    const a = ry + (i / 8) * Math.PI * 2;
    const g = faceColored(new THREE.BoxGeometry(0.15, 0.07, 0.08), PC[3], 0.08, rnd);
    out.push(place(g, x + Math.cos(a) * 0.475, 0.035, z + Math.sin(a) * 0.475, -a + Math.PI / 2));
  }
}

// ---------------------------------------------------------------------------
// 木橋與碼頭
function buildDeck(G, c, r, rnd, out, isDock) {
  const { at } = G;
  const cx = c + 0.5, cz = r + 0.5;
  let alongX;
  let seaDir = null;
  if (isDock) {
    const opts = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (const [dc, dr] of opts) if (at(c + dc, r + dr) === '~') { seaDir = [dc, dr]; break; }
    alongX = seaDir ? seaDir[0] !== 0 : true;
  } else {
    const l = at(c - 1, r), rr = at(c + 1, r), u = at(c, r - 1), d = at(c, r + 1);
    const hx = (l !== '~') + (rr !== '~'), hz = (u !== '~') + (d !== '~');
    alongX = hx >= hz;
  }
  const top = isDock ? DOCK_TOP : 0;
  // 本地座標 (u 沿行進方向, w 橫向) → 格子座標
  const P = (u, w) => alongX ? [cx + u, cz + w] : [cx + w, cz + u];
  const ry = alongX ? 0 : Math.PI / 2;
  const woods = ['#b07b4b', '#c18c58', '#a6703f', '#bb8452'];
  const prevCh = alongX ? at(c - 1, r) : at(c, r - 1);
  const nextCh = alongX ? at(c + 1, r) : at(c, r + 1);
  const width = isDock ? 0.86 : 0.9;
  // 木板（橫跨行進方向）
  const us = [-0.4, -0.2, 0, 0.2, 0.4];
  if (isLand(prevCh)) us.unshift(-0.56);
  if (isLand(nextCh)) us.push(0.56);
  for (const u of us) {
    const g = faceColored(new THREE.BoxGeometry(0.175, 0.06, width + (rnd() - 0.5) * 0.06), woods[Math.floor(rnd() * 4)], 0.05, rnd);
    const [x, z] = P(u + (rnd() - 0.5) * 0.015, (rnd() - 0.5) * 0.03);
    out.push(place(g, x, top - 0.03 + (rnd() - 0.5) * 0.012, z, ry + (rnd() - 0.5) * 0.05));
  }
  // 縱樑
  for (const w of [-0.34, 0.34]) {
    const [x, z] = P(0, w);
    out.push(place(faceColored(new THREE.BoxGeometry(1.04, 0.07, 0.08), '#7c5434', 0.04, rnd), x, top - 0.09, z, ry));
  }
  // 木樁（插進水裡）
  const pileU = isDock ? [-0.36, 0.36] : [0];
  for (const u of pileU) for (const w of [-0.42, 0.42]) {
    const [x, z] = P(u, w);
    const len = top - BOTTOM_Y + 0.12;
    out.push(place(faceColored(new THREE.CylinderGeometry(0.058, 0.068, len, 7), '#6b4a30', 0.06, rnd), x, top - len / 2 + 0.06, z, rnd()));
  }
  if (!isDock) {
    // 欄杆：每格中間一根柱子，扶手連續
    for (const w of [-0.47, 0.47]) {
      const [x, z] = P(0, w);
      out.push(place(faceColored(new THREE.BoxGeometry(0.07, 0.34, 0.07), '#8a5d3a', 0.05, rnd), x, 0.17, z, ry));
      const [x2, z2] = P(0, w);
      out.push(place(faceColored(new THREE.BoxGeometry(1.02, 0.05, 0.055), '#9b6a42', 0.05, rnd), x2, 0.32, z2, ry));
    }
    // 端點加一根柱子
    for (const [ch, u] of [[prevCh, -0.5], [nextCh, 0.5]]) {
      if (!isLand(ch)) continue;
      for (const w of [-0.47, 0.47]) {
        const [x, z] = P(u, w);
        out.push(place(faceColored(new THREE.BoxGeometry(0.085, 0.4, 0.085), '#7d5434', 0.05, rnd), x, 0.2, z, ry));
      }
    }
  } else {
    // 碼頭外端兩根高一點的繫船柱
    if (seaDir) for (const w of [-0.38, 0.38]) {
      const [x, z] = P(0.4 * (alongX ? seaDir[0] : seaDir[1]), w);
      out.push(place(faceColored(new THREE.CylinderGeometry(0.06, 0.07, 0.3, 7), '#6b4a30', 0.05, rnd), x, top + 0.12, z));
    }
  }
  return { alongX, seaDir };
}

// ---------------------------------------------------------------------------
// 地面貼圖（canvas）
const K_NONE = 0, K_GRASS = 1, K_OPEN = 2, K_ROAD = 3, K_SAND = 4, K_PLAZA = 5, K_BASE = 6, K_SPAWN = 7;
function kindOf(ch) {
  switch (ch) {
    case '~': case 'B': case 'D': return K_NONE;
    case ',': return K_SAND;
    case '=': return K_ROAD;
    case 'S': return K_SPAWN;
    case 'o': return K_OPEN;
    case 'L': return K_PLAZA;
    case '#': return K_BASE;
    default: return K_GRASS;
  }
}
const isRoadK = (k) => k === K_ROAD || k === K_SPAWN;
const isGrassK = (k) => k === K_GRASS || k === K_BASE || k === K_PLAZA;

function paintGround(G, seed, PX) {
  const { W, H, at } = G;
  const cw = W * PX, chh = H * PX;
  const canvas = document.createElement('canvas');
  canvas.width = cw; canvas.height = chh;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(cw, chh);
  const d = img.data;
  const kinds = new Uint8Array(W * H);
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) kinds[r * W + c] = kindOf(at(c, r));
  const kAt = (c, r) => (c < 0 || r < 0 || c >= W || r >= H) ? K_NONE : kinds[r * W + c];
  const inv = 1 / PX;
  for (let py = 0; py < chh; py++) {
    const gz = (py + 0.5) * inv;
    for (let px = 0; px < cw; px++) {
      const gx = (px + 0.5) * inv;
      const kb = kAt(Math.floor(gx), Math.floor(gz));
      let k = kb;
      if (isRoadK(kb) || isGrassK(kb)) {
        const n1 = vnoise(gx * 2.6, gz * 2.6, seed + 1) - 0.5, n2 = vnoise(gx * 2.6 + 17.3, gz * 2.6 - 9.1, seed + 2) - 0.5;
        const kw = kAt(Math.floor(gx + n1 * 0.4), Math.floor(gz + n2 * 0.4));
        if ((isRoadK(kw) && isGrassK(kb)) || (isGrassK(kw) && isRoadK(kb))) k = kw;
      }
      const n = fbm(gx * 0.9, gz * 0.9, seed + 3, 3);
      const m = vnoise(gx * 5.5, gz * 5.5, seed + 4);
      const fine = (hash2(px, py, seed) - 0.5) * 10;
      let R, Gc, B;
      if (k === K_SAND) {
        const t = n * 0.7 + m * 0.3;
        R = 238 - t * 18; Gc = 221 - t * 22; B = 168 - t * 26;
      } else if (k === K_ROAD || k === K_SPAWN) {
        const t = n * 0.6 + m * 0.4;
        R = 190 - t * 30; Gc = 152 - t * 28; B = 103 - t * 24;
        if (hash2(px, py, seed + 9) > 0.94) { R -= 22; Gc -= 20; B -= 16; }
      } else if (k === K_OPEN) {
        const t = n * 0.6 + m * 0.4;
        R = 158 - t * 22; Gc = 214 - t * 18; B = 112 - t * 20;
      } else {
        const t = n * 0.65 + m * 0.35;
        R = 92 + t * 44; Gc = 166 + t * 34; B = 60 + t * 24;
        if (k === K_BASE) { R -= 6; Gc -= 6; B -= 4; }
      }
      const i = (py * cw + px) * 4;
      d[i] = R + fine; d[i + 1] = Gc + fine; d[i + 2] = B + fine * 0.6; d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  const rnd = makeRng(seed + 77);
  ctx.lineCap = 'round';
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
    const k = kinds[r * W + c];
    const x0 = c * PX, y0 = r * PX;
    const ch = at(c, r);
    if (isGrassK(k)) {
      // 草葉筆觸
      ctx.lineWidth = Math.max(1, PX / 28);
      for (let i = 0; i < 16; i++) {
        const x = x0 + rnd() * PX, y = y0 + rnd() * PX, len = PX * (0.05 + rnd() * 0.07);
        ctx.strokeStyle = rnd() < 0.55 ? 'rgba(52,112,40,0.42)' : 'rgba(196,236,140,0.42)';
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (rnd() - 0.5) * len * 0.6, y - len); ctx.stroke();
      }
    }
    if (isRoadK(k)) {
      for (let i = 0; i < 8; i++) {
        const x = x0 + rnd() * PX, y = y0 + rnd() * PX, rr = PX * (0.03 + rnd() * 0.05);
        ctx.fillStyle = rnd() < 0.55 ? 'rgba(234,218,186,0.9)' : 'rgba(118,90,58,0.65)';
        ctx.beginPath(); ctx.ellipse(x, y, rr, rr * 0.75, rnd() * 3, 0, Math.PI * 2); ctx.fill();
      }
      // 路邊用草葉蓋掉硬邊
      const nb = [[0, -1], [0, 1], [-1, 0], [1, 0]];
      for (const [dc, dr] of nb) {
        if (!isGrassK(kAt(c + dc, r + dr))) continue;
        ctx.lineWidth = Math.max(1, PX / 26);
        for (let i = 0; i < 7; i++) {
          const t = rnd();
          let x = x0 + (dc === 0 ? t * PX : (dc > 0 ? PX - rnd() * PX * 0.14 : rnd() * PX * 0.14));
          let y = y0 + (dr === 0 ? t * PX : (dr > 0 ? PX - rnd() * PX * 0.14 : rnd() * PX * 0.14));
          const len = PX * (0.06 + rnd() * 0.06);
          ctx.strokeStyle = rnd() < 0.5 ? 'rgba(70,140,52,0.75)' : 'rgba(120,180,80,0.7)';
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (rnd() - 0.5) * len, y - len); ctx.stroke();
        }
      }
    }
    if (k === K_SPAWN) {
      const g = ctx.createRadialGradient(x0 + PX / 2, y0 + PX / 2, 0, x0 + PX / 2, y0 + PX / 2, PX * 0.62);
      g.addColorStop(0, 'rgba(70,28,96,0.55)'); g.addColorStop(0.6, 'rgba(96,48,130,0.3)'); g.addColorStop(1, 'rgba(96,48,130,0)');
      ctx.fillStyle = g; ctx.fillRect(x0 - PX * 0.2, y0 - PX * 0.2, PX * 1.4, PX * 1.4);
    }
    if (k === K_OPEN) {
      ctx.lineWidth = Math.max(1, PX / 24);
      ctx.strokeStyle = 'rgba(60,110,40,0.30)';
      const ins = PX * 0.06;
      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') ctx.roundRect(x0 + ins, y0 + ins, PX - ins * 2, PX - ins * 2, PX * 0.12);
      else ctx.rect(x0 + ins, y0 + ins, PX - ins * 2, PX - ins * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,230,0.10)';
      ctx.fillRect(x0 + PX * 0.2, y0 + PX * 0.2, PX * 0.6, PX * 0.6);
    }
    if (k === K_BASE) {
      const g = ctx.createRadialGradient(x0 + PX / 2, y0 + PX / 2, PX * 0.38, x0 + PX / 2, y0 + PX / 2, PX * 0.66);
      g.addColorStop(0, 'rgba(40,60,30,0.38)'); g.addColorStop(1, 'rgba(40,60,30,0)');
      ctx.fillStyle = g; ctx.fillRect(x0 - PX * 0.2, y0 - PX * 0.2, PX * 1.4, PX * 1.4);
    }
    if (k === K_SAND) {
      for (let i = 0; i < 14; i++) {
        ctx.fillStyle = rnd() < 0.6 ? 'rgba(190,160,110,0.45)' : 'rgba(255,250,235,0.6)';
        const s = Math.max(1, PX * (0.02 + rnd() * 0.025));
        ctx.fillRect(x0 + rnd() * PX, y0 + rnd() * PX, s, s);
      }
      ctx.strokeStyle = 'rgba(205,180,128,0.45)'; ctx.lineWidth = Math.max(1, PX / 30);
      for (let i = 0; i < 2; i++) {
        const y = y0 + PX * (0.25 + rnd() * 0.5);
        ctx.beginPath(); ctx.moveTo(x0 + PX * 0.1, y);
        ctx.quadraticCurveTo(x0 + PX * 0.5, y + (rnd() - 0.5) * PX * 0.25, x0 + PX * 0.9, y); ctx.stroke();
      }
    }
    if (ch === 'H' || ch === 'W') {
      ctx.fillStyle = 'rgba(150,120,80,0.45)';
      ctx.beginPath(); ctx.ellipse(x0 + PX / 2, y0 + PX / 2, PX * 0.46, PX * 0.42, 0, 0, Math.PI * 2); ctx.fill();
    }
    if (ch === 'G') {
      ctx.fillStyle = 'rgba(70,90,50,0.45)';
      ctx.beginPath(); ctx.ellipse(x0 + PX / 2, y0 + PX * 0.6, PX * 0.3, PX * 0.38, 0, 0, Math.PI * 2); ctx.fill();
    }
    if (ch === 'M' || ch === 'C') {
      ctx.fillStyle = ch === 'M' ? 'rgba(60,100,50,0.35)' : 'rgba(150,120,220,0.22)';
      ctx.beginPath(); ctx.arc(x0 + PX / 2, y0 + PX / 2, PX * 0.45, 0, Math.PI * 2); ctx.fill();
    }
    if (k === K_PLAZA) {
      // 守護燈下的圓形石板廣場
      const cx = x0 + PX / 2, cy = y0 + PX / 2, R0 = PX * 0.56;
      ctx.fillStyle = 'rgba(120,108,92,0.9)';
      ctx.beginPath(); ctx.arc(cx, cy, R0, 0, Math.PI * 2); ctx.fill();
      const rings = [[0, 1], [0.2, 7], [0.36, 12], [0.5, 17]];
      for (const [rr, cnt] of rings) {
        for (let i = 0; i < cnt; i++) {
          const a = (i + (rr * 3) % 1) / cnt * Math.PI * 2;
          const x = cx + Math.cos(a) * rr * PX, y = cy + Math.sin(a) * rr * PX;
          const s = PX * (rr === 0 ? 0.12 : 0.075);
          const l = 178 + Math.floor(rnd() * 40);
          ctx.fillStyle = `rgb(${l},${l - 8},${l - 22})`;
          ctx.beginPath(); ctx.ellipse(x, y, s, s * 0.82, a, 0, Math.PI * 2); ctx.fill();
        }
      }
    }
  }
  return canvas;
}

// ---------------------------------------------------------------------------
// 洞窟地面貼圖（第二章）：石地、碎石、踩實的土路、石板開放地、黑色地洞出生點
function paintGroundCave(G, seed, PX) {
  const { W, H, at } = G;
  const cw = W * PX, chh = H * PX;
  const canvas = document.createElement('canvas');
  canvas.width = cw; canvas.height = chh;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(cw, chh);
  const d = img.data;
  const kinds = new Uint8Array(W * H);
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) kinds[r * W + c] = kindOf(at(c, r));
  const kAt = (c, r) => (c < 0 || r < 0 || c >= W || r >= H) ? K_NONE : kinds[r * W + c];
  const isPath = (k) => k === K_ROAD || k === K_SPAWN;
  const inv = 1 / PX;
  for (let py = 0; py < chh; py++) {
    const gz = (py + 0.5) * inv;
    for (let px = 0; px < cw; px++) {
      const gx = (px + 0.5) * inv;
      const kb = kAt(Math.floor(gx), Math.floor(gz));
      let k = kb;
      if (isPath(kb) || isGrassK(kb) || kb === K_SAND) {
        // 土路與石地的交界抖一下，不要硬邊
        const n1 = vnoise(gx * 2.4, gz * 2.4, seed + 1) - 0.5, n2 = vnoise(gx * 2.4 + 17.3, gz * 2.4 - 9.1, seed + 2) - 0.5;
        const kw = kAt(Math.floor(gx + n1 * 0.42), Math.floor(gz + n2 * 0.42));
        if ((isPath(kw) && !isPath(kb) && kb !== K_OPEN) || (!isPath(kw) && kw !== K_NONE && kw !== K_OPEN && isPath(kb))) k = kw;
      }
      const n = fbm(gx * 0.8, gz * 0.8, seed + 3, 3);
      const m = vnoise(gx * 6.5, gz * 6.5, seed + 4);
      const strata = vnoise(gx * 1.7 + gz * 0.6, gz * 3.2, seed + 6);
      const fine = (hash2(px, py, seed) - 0.5) * 12;
      let R, Gc, B;
      if (k === K_SAND) {                 // 碎石地
        const t = n * 0.6 + m * 0.4;
        R = 124 - t * 26; Gc = 118 - t * 24; B = 110 - t * 22;
        const h = vnoise(gx * 9, gz * 9, seed + 11);
        if (h > 0.68) { const a = (h - 0.68) * 50; R += a; Gc += a; B += a * 0.9; } else if (h < 0.3) { const a = (0.3 - h) * 45; R -= a; Gc -= a; B -= a; }
      } else if (k === K_ROAD || k === K_SPAWN) {   // 踩實的土路
        const t = n * 0.55 + m * 0.45;
        R = 150 - t * 30; Gc = 118 - t * 26; B = 86 - t * 22;
        if (hash2(px, py, seed + 9) > 0.93) { R -= 26; Gc -= 22; B -= 16; }
      } else if (k === K_OPEN) {          // 石板開放地
        const t = n * 0.5 + m * 0.5;
        R = 128 - t * 18; Gc = 122 - t * 16; B = 116 - t * 14;
      } else {                            // 洞窟石地
        const t = n * 0.6 + m * 0.25 + strata * 0.15;
        R = 98 + t * 30; Gc = 90 + t * 26; B = 84 + t * 24;
        if (k === K_BASE) { R -= 6; Gc -= 6; B -= 5; }
        // 少量青綠苔蘚斑
        const moss = vnoise(gx * 1.3 + 40, gz * 1.3 - 12, seed + 8);
        if (moss > 0.72) { const a = (moss - 0.72) * 2.2; R -= 24 * a; Gc += 6 * a; B += 2 * a; }
      }
      const i = (py * cw + px) * 4;
      d[i] = R + fine; d[i + 1] = Gc + fine; d[i + 2] = B + fine * 0.8; d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  const rnd = makeRng(seed + 77);
  ctx.lineCap = 'round';
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
    const k = kinds[r * W + c];
    const x0 = c * PX, y0 = r * PX;
    const ch = at(c, r);
    if (isGrassK(k)) {
      // 石地裂縫
      if (rnd() < 0.55) {
        ctx.strokeStyle = 'rgba(30,26,24,0.5)'; ctx.lineWidth = Math.max(1, PX / 30);
        let x = x0 + rnd() * PX, y = y0 + rnd() * PX;
        ctx.beginPath(); ctx.moveTo(x, y);
        for (let s = 0; s < 3; s++) { x += (rnd() - 0.5) * PX * 0.5; y += (rnd() - 0.5) * PX * 0.5; ctx.lineTo(x, y); }
        ctx.stroke();
      }
      // 亮色小石屑
      for (let i = 0; i < 6; i++) {
        ctx.fillStyle = rnd() < 0.5 ? 'rgba(170,160,148,0.55)' : 'rgba(52,46,42,0.5)';
        const s = Math.max(1, PX * (0.02 + rnd() * 0.03));
        ctx.fillRect(x0 + rnd() * PX, y0 + rnd() * PX, s, s);
      }
    }
    if (isRoadK(k)) {
      for (let i = 0; i < 9; i++) {
        const x = x0 + rnd() * PX, y = y0 + rnd() * PX, rr = PX * (0.025 + rnd() * 0.045);
        ctx.fillStyle = rnd() < 0.5 ? 'rgba(200,184,160,0.75)' : 'rgba(80,62,46,0.6)';
        ctx.beginPath(); ctx.ellipse(x, y, rr, rr * 0.75, rnd() * 3, 0, Math.PI * 2); ctx.fill();
      }
    }
    if (k === K_SPAWN) {
      // 黑色地洞（傳送門下方）
      const g = ctx.createRadialGradient(x0 + PX / 2, y0 + PX / 2, 0, x0 + PX / 2, y0 + PX / 2, PX * 0.66);
      g.addColorStop(0, 'rgba(8,4,14,0.92)'); g.addColorStop(0.45, 'rgba(30,14,44,0.6)'); g.addColorStop(1, 'rgba(40,20,60,0)');
      ctx.fillStyle = g; ctx.fillRect(x0 - PX * 0.2, y0 - PX * 0.2, PX * 1.4, PX * 1.4);
    }
    if (k === K_OPEN) {
      // 石板：四塊、縫線
      const ins = PX * 0.05;
      ctx.lineWidth = Math.max(1, PX / 22);
      ctx.strokeStyle = 'rgba(48,44,40,0.55)';
      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') ctx.roundRect(x0 + ins, y0 + ins, PX - ins * 2, PX - ins * 2, PX * 0.1);
      else ctx.rect(x0 + ins, y0 + ins, PX - ins * 2, PX - ins * 2);
      ctx.stroke();
      ctx.lineWidth = Math.max(1, PX / 40);
      ctx.strokeStyle = 'rgba(48,44,40,0.3)';
      const off = (rnd() - 0.5) * PX * 0.16;
      ctx.beginPath(); ctx.moveTo(x0 + PX / 2 + off, y0 + ins); ctx.lineTo(x0 + PX / 2 + off, y0 + PX - ins); ctx.stroke();
      ctx.fillStyle = 'rgba(255,248,230,0.07)';
      ctx.fillRect(x0 + PX * 0.12, y0 + PX * 0.12, PX * 0.32, PX * 0.32);
    }
    if (k === K_BASE) {
      const g = ctx.createRadialGradient(x0 + PX / 2, y0 + PX / 2, PX * 0.36, x0 + PX / 2, y0 + PX / 2, PX * 0.66);
      g.addColorStop(0, 'rgba(20,16,14,0.45)'); g.addColorStop(1, 'rgba(20,16,14,0)');
      ctx.fillStyle = g; ctx.fillRect(x0 - PX * 0.2, y0 - PX * 0.2, PX * 1.4, PX * 1.4);
    }
    if (k === K_SAND) {
      for (let i = 0; i < 8; i++) {
        ctx.fillStyle = rnd() < 0.5 ? 'rgba(176,168,156,0.35)' : 'rgba(48,44,40,0.32)';
        const s = Math.max(1, PX * (0.035 + rnd() * 0.04));
        ctx.beginPath(); ctx.ellipse(x0 + rnd() * PX, y0 + rnd() * PX, s, s * 0.7, rnd() * 3, 0, Math.PI * 2); ctx.fill();
      }
    }
    if (ch === 'U' || ch === 'C') {
      // 發光蘑菇／水晶腳下：礦物色的地面
      ctx.fillStyle = ch === 'U' ? 'rgba(60,150,140,0.28)' : 'rgba(120,90,200,0.25)';
      ctx.beginPath(); ctx.arc(x0 + PX / 2, y0 + PX / 2, PX * 0.46, 0, Math.PI * 2); ctx.fill();
    }
    if (ch === 'X' || ch === 'R') {
      ctx.fillStyle = 'rgba(28,24,22,0.35)';
      ctx.beginPath(); ctx.ellipse(x0 + PX / 2, y0 + PX / 2, PX * 0.42, PX * 0.38, 0, 0, Math.PI * 2); ctx.fill();
    }
    if (k === K_PLAZA) {
      const cx = x0 + PX / 2, cy = y0 + PX / 2, R0 = PX * 0.56;
      ctx.fillStyle = 'rgba(84,76,68,0.92)';
      ctx.beginPath(); ctx.arc(cx, cy, R0, 0, Math.PI * 2); ctx.fill();
      const rings = [[0, 1], [0.2, 7], [0.36, 12], [0.5, 17]];
      for (const [rr, cnt] of rings) {
        for (let i = 0; i < cnt; i++) {
          const a = (i + (rr * 3) % 1) / cnt * Math.PI * 2;
          const x = cx + Math.cos(a) * rr * PX, y = cy + Math.sin(a) * rr * PX;
          const s = PX * (rr === 0 ? 0.12 : 0.075);
          const l = 128 + Math.floor(rnd() * 36);
          ctx.fillStyle = `rgb(${l},${l - 6},${l - 14})`;
          ctx.beginPath(); ctx.ellipse(x, y, s, s * 0.82, a, 0, Math.PI * 2); ctx.fill();
        }
      }
    }
  }
  return canvas;
}

// 洞窟地面的碎石（合併進 props；礦車的鐵軌是 B 的 minecart 模型自帶）
function buildCaveProps(G, rnd, out) {
  const { W, H, at } = G;
  const pebble = ['#6e6760', '#5d5751', '#7c746b'];
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
    const ch = at(c, r);
    const x = c + 0.5, z = r + 0.5;
    if (ch === '.' || ch === ',') {
      const n = ch === ',' ? 3 + Math.floor(rnd() * 4) : (rnd() < 0.7 ? 0 : 1);
      for (let i = 0; i < n; i++) {
        const s = (ch === ',' ? 0.04 : 0.05) + rnd() * 0.07;
        const g = rockGeo(rnd, pebble[Math.floor(rnd() * 3)], false);
        const y = topOf(ch) + s * 0.2;
        out.push(place(g, x + (rnd() - 0.5) * 0.8, y, z + (rnd() - 0.5) * 0.8, rnd() * 6.28, s * 1.2, s * 0.65, s));
      }
    }
  }
}

// ---------------------------------------------------------------------------
// 海岸距離場：每格 R 像素，四周多留 M 格；值＝到陸地的距離（格）/ 4，0–1
function computeShore(G, M = 8, R = 8) {
  const { W, H, at } = G;
  const NX = (W + 2 * M) * R, NZ = (H + 2 * M) * R;
  const INF = 1e9;
  const dist = new Float32Array(NX * NZ);
  for (let z = 0; z < NZ; z++) {
    const r = Math.floor(z / R) - M;
    for (let x = 0; x < NX; x++) {
      const c = Math.floor(x / R) - M;
      dist[z * NX + x] = isLand(at(c, r)) ? 0 : INF;
    }
  }
  const D1 = 1, D2 = Math.SQRT2;
  for (let z = 0; z < NZ; z++) for (let x = 0; x < NX; x++) {
    const i = z * NX + x; let v = dist[i];
    if (v === 0) continue;
    if (x > 0) v = Math.min(v, dist[i - 1] + D1);
    if (z > 0) {
      v = Math.min(v, dist[i - NX] + D1);
      if (x > 0) v = Math.min(v, dist[i - NX - 1] + D2);
      if (x < NX - 1) v = Math.min(v, dist[i - NX + 1] + D2);
    }
    dist[i] = v;
  }
  for (let z = NZ - 1; z >= 0; z--) for (let x = NX - 1; x >= 0; x--) {
    const i = z * NX + x; let v = dist[i];
    if (v === 0) continue;
    if (x < NX - 1) v = Math.min(v, dist[i + 1] + D1);
    if (z < NZ - 1) {
      v = Math.min(v, dist[i + NX] + D1);
      if (x < NX - 1) v = Math.min(v, dist[i + NX + 1] + D2);
      if (x > 0) v = Math.min(v, dist[i + NX - 1] + D2);
    }
    dist[i] = v;
  }
  const data = new Uint8Array(NX * NZ);
  for (let i = 0; i < data.length; i++) data[i] = Math.min(255, Math.round((dist[i] / R) / 4 * 255));
  // 3x3 模糊一次，讓邊緣平順
  const out = new Uint8Array(NX * NZ);
  for (let z = 0; z < NZ; z++) for (let x = 0; x < NX; x++) {
    let s = 0, n = 0;
    for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) {
      const xx = x + a, zz = z + b;
      if (xx < 0 || zz < 0 || xx >= NX || zz >= NZ) continue;
      s += data[zz * NX + xx]; n++;
    }
    out[z * NX + x] = Math.round(s / n);
  }
  const tex = new THREE.DataTexture(out, NX, NZ, THREE.RedFormat, THREE.UnsignedByteType);
  tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearFilter;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  const minX = -M - W / 2, minZ = -M - H / 2, sizeX = W + 2 * M, sizeZ = H + 2 * M;
  return { tex, rect: new THREE.Vector4(minX, minZ, 1 / sizeX, 1 / sizeZ), minX, minZ, sizeX, sizeZ };
}

// ---------------------------------------------------------------------------
/**
 * 建地形。回傳 { group, shore, bounds, topMaterial, dispose() }
 * group 已經平移到世界空間（原點＝地圖中心）。
 */
export function buildTerrain(G, seed, opts = {}) {
  const { W, H, at } = G;
  const PX = opts.px || 32;
  const group = new THREE.Group();
  group.name = 'terrain';
  group.position.set(-W / 2, 0, -H / 2);
  const L = makeLattice(G, seed);
  const rnd = makeRng(seed + 1234);
  const theme = opts.theme === 'cave' ? 'cave' : 'island';

  // 頂面
  const topGeo = buildTop(G, L);
  const canvas = theme === 'cave' ? paintGroundCave(G, seed, PX) : paintGround(G, seed, PX);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = opts.anisotropy || 4;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  const topMat = new THREE.MeshLambertMaterial({ map: tex });
  const top = new THREE.Mesh(topGeo, topMat);
  top.receiveShadow = true;
  top.name = 'terrain-top';
  group.add(top);

  // 崖壁＋道具
  const { geo: wallGeo, seaEdges } = buildWalls(G, L, seed, theme);
  const props = [wallGeo];
  buildCoastRocks(G, L, seaEdges, rnd, props, theme);
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
    const ch = at(c, r);
    const x = c + 0.5, z = r + 0.5;
    if (ch === '#') buildPlatform(x, z, rnd, props, theme);
    else if (ch === 'B') buildDeck(G, c, r, rnd, props, false);
    else if (ch === 'D') buildDeck(G, c, r, rnd, props, true);
    else if (ch === '=' || ch === 'S') {
      const n = 2 + Math.floor(rnd() * 4);
      for (let i = 0; i < n; i++) {
        const s = 0.028 + rnd() * 0.04;
        const g = rockGeo(rnd, rnd() < 0.5 ? (theme === 'cave' ? '#a3927c' : '#b9ad9b') : (theme === 'cave' ? '#7a6a58' : '#9d8f7b'), false);
        props.push(place(g, x + (rnd() - 0.5) * 0.8, s * 0.15, z + (rnd() - 0.5) * 0.8, rnd() * 6.28, s * 1.2, s * 0.5, s));
      }
    }
  }
  if (theme === 'cave') buildCaveProps(G, makeRng(seed + 4321), props);
  const propsGeo = mergeGeometries(props, false);
  for (const g of props) g.dispose();
  const propsMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  const propsMesh = new THREE.Mesh(propsGeo, propsMat);
  propsMesh.castShadow = true;
  propsMesh.receiveShadow = true;
  propsMesh.name = 'terrain-props';
  group.add(propsMesh);

  // 陸地範圍（格子座標）
  let minC = W, maxC = -1, minR = H, maxR = -1;
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) if (at(c, r) !== '~') {
    minC = Math.min(minC, c); maxC = Math.max(maxC, c); minR = Math.min(minR, r); maxR = Math.max(maxR, r);
  }
  if (maxC < 0) { minC = 0; maxC = W - 1; minR = 0; maxR = H - 1; }
  const bounds = { minC, maxC, minR, maxR };

  const shore = computeShore(G);
  return {
    group, shore, bounds, topMaterial: topMat, theme, propsMaterial: propsMat,
    dispose() {
      topGeo.dispose(); tex.dispose(); topMat.dispose();
      propsGeo.dispose(); propsMat.dispose();
      shore.tex.dispose();
    },
  };
}
