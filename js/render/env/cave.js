// 第二章洞窟（擁有者：C）：外圍岩壁（一圈往上長的岩石＋石筍＋嵌在牆上的發光礦石），
// 以及 B 的模型還沒提供洞窟裝飾時的簡單備用模型（stalagmite／glowshroom／cavecrystal／minecart）。
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeRng, hash2 } from './rng.js';
import { faceColored, place, rockGeo, SEA_Y } from './terrain.js';

const WALL_ROCK = ['#4a4541', '#55504a', '#3f3b38', '#4d4a48', '#433f3b'];
const MINERAL = ['#8b6cff', '#4fd8d0', '#b07dff'];

/** 尖錐（石筍）：底部寬、往上收尖，略為彎曲 */
function spireGeo(rnd, hex, h, r) {
  const g = new THREE.ConeGeometry(r, h, 6, 3).translate(0, h / 2, 0);
  const a = g.attributes.position.array;
  const bend = (rnd() - 0.5) * 0.25, k = Math.floor(rnd() * 1e5);
  for (let i = 0; i < a.length; i += 3) {
    const t = a[i + 1] / h;
    a[i] += bend * t * t * h * 0.3 + (hash2(Math.round(a[i] * 97), Math.round(a[i + 1] * 61), k) - 0.5) * r * 0.25;
    a[i + 2] += (hash2(Math.round(a[i + 2] * 89), Math.round(a[i + 1] * 53), k + 3) - 0.5) * r * 0.25;
  }
  return faceColored(g, hex, 0.1, rnd);
}

/**
 * 外圍岩壁。G：makeGridInfo 的結果。回傳 { group, minerals:[{x,y,z,color}]（世界座標）, dispose() }
 * 岩壁在地圖矩形外 0.2～5 格，高度由內往外變高；鏡頭在一般俯角下不會被擋住。
 */
export function buildCaveWalls(G, seed) {
  const { W, H } = G;
  const rnd = makeRng(seed + 99173);
  const geos = [];
  const minerals = [];
  // 沿矩形外圈取樣：t 走周長，回傳 (x, z, 外法線)
  const per = 2 * (W + H);
  function edgePoint(t, out) {
    t = ((t % per) + per) % per;
    if (t < W) return { x: t, z: 0, nx: 0, nz: -1 };
    t -= W; if (t < H) return { x: W, z: t, nx: 1, nz: 0 };
    t -= H; if (t < W) return { x: W - t, z: H, nx: 0, nz: 1 };
    t -= W; return { x: 0, z: H - t, nx: -1, nz: 0 };
  }
  const rows = [
    { step: 0.62, off: [0.15, 0.85], h: [0.35, 1.05], s: [0.35, 0.6] },
    { step: 0.85, off: [1.0, 2.0], h: [1.1, 2.4], s: [0.55, 0.9] },
    { step: 1.1, off: [2.4, 4.2], h: [2.2, 3.8], s: [0.8, 1.3] },
    { step: 1.6, off: [4.5, 7.0], h: [3.0, 5.0], s: [1.1, 1.8] },
  ];
  for (const row of rows) {
    for (let t = rnd() * row.step; t < per; t += row.step * (0.75 + rnd() * 0.5)) {
      const e = edgePoint(t);
      const off = row.off[0] + rnd() * (row.off[1] - row.off[0]);
      // 角落往外推一點，避免四個角堆成一團
      const x = e.x + e.nx * off + (e.nx === 0 ? (rnd() - 0.5) * 0.3 : 0);
      const z = e.z + e.nz * off + (e.nz === 0 ? (rnd() - 0.5) * 0.3 : 0);
      const h = row.h[0] + rnd() * (row.h[1] - row.h[0]);
      const s = row.s[0] + rnd() * (row.s[1] - row.s[0]);
      const g = rockGeo(rnd, WALL_ROCK[Math.floor(rnd() * WALL_ROCK.length)], false);
      place(g, x, SEA_Y - 0.25 + h * 0.42, z, rnd() * 6.28, s * (0.9 + rnd() * 0.4), h * 0.62, s * (0.9 + rnd() * 0.4), (rnd() - 0.5) * 0.3, (rnd() - 0.5) * 0.3);
      geos.push(g);
      // 外兩排夾幾根高石筍
      if (row !== rows[0] && rnd() < 0.32) {
        const sh = h * (0.9 + rnd() * 0.8), sr = 0.12 + rnd() * 0.2;
        const sg = spireGeo(rnd, WALL_ROCK[Math.floor(rnd() * WALL_ROCK.length)], sh, sr);
        place(sg, x + (rnd() - 0.5) * s, SEA_Y - 0.2, z + (rnd() - 0.5) * s, rnd() * 6.28);
        geos.push(sg);
      }
      // 嵌在岩壁上的發光礦石
      if (row !== rows[3] && rnd() < 0.07) {
        const col = MINERAL[Math.floor(rnd() * MINERAL.length)];
        minerals.push({ x: x - e.nx * s * 0.45, y: SEA_Y + h * (0.35 + rnd() * 0.4), z: z - e.nz * s * 0.45, color: col, s: 0.08 + rnd() * 0.08 });
      }
    }
  }
  // 湖面上幾塊露出水面的岩石（內圈 0.4～1.6 格）
  for (let i = 0; i < Math.round(per / 7); i++) {
    const e = edgePoint(rnd() * per);
    const off = -1.6 + rnd() * 1.4;
    const x = e.x + e.nx * off, z = e.z + e.nz * off;
    const cc = Math.floor(x), rr = Math.floor(z);
    let near = false;
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) if (G.at(cc + a, rr + b) !== '~') near = true;
    if (near) continue;
    const s = 0.16 + rnd() * 0.26;
    const g = rockGeo(rnd, WALL_ROCK[Math.floor(rnd() * WALL_ROCK.length)], false);
    place(g, x, SEA_Y - 0.06, z, rnd() * 6.28, s, s * (0.7 + rnd() * 0.6), s * 1.1);
    geos.push(g);
  }
  const merged = mergeGeometries(geos, false);
  for (const g of geos) g.dispose();
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  const mesh = new THREE.Mesh(merged, mat);
  mesh.name = 'cave-walls';
  mesh.castShadow = false; mesh.receiveShadow = true;
  const group = new THREE.Group();
  group.name = 'cave';
  group.position.set(-W / 2, 0, -H / 2);
  group.add(mesh);

  // 發光礦石：自發光材質（不受黑暗影響）
  let minMesh = null, minGeo = null, minMat = null;
  if (minerals.length) {
    const parts = [];
    const tmpRnd = makeRng(seed + 5);
    for (const m of minerals) {
      for (let k = 0; k < 3; k++) {
        const g = new THREE.OctahedronGeometry(1, 0);
        g.deleteAttribute('uv');
        const c = new THREE.Color(m.color);
        const col = new Float32Array(g.attributes.position.count * 3);
        for (let i = 0; i < col.length; i += 3) { col[i] = c.r; col[i + 1] = c.g; col[i + 2] = c.b; }
        g.setAttribute('color', new THREE.BufferAttribute(col, 3));
        place(g, m.x + (tmpRnd() - 0.5) * 0.15, m.y + (tmpRnd() - 0.5) * 0.12, m.z + (tmpRnd() - 0.5) * 0.15, tmpRnd() * 6, m.s * 0.6, m.s * (1.2 + tmpRnd()), m.s * 0.6, (tmpRnd() - 0.5) * 1.2, (tmpRnd() - 0.5) * 1.2);
        parts.push(g);
      }
    }
    minGeo = mergeGeometries(parts, false);
    for (const g of parts) g.dispose();
    minMat = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
    minMat.userData.noDark = true;
    minMesh = new THREE.Mesh(minGeo, minMat);
    minMesh.name = 'cave-minerals';
    group.add(minMesh);
  }
  return {
    group,
    minerals: minerals.map((m) => ({ x: m.x - W / 2, y: m.y, z: m.z - H / 2, color: m.color })),
    dispose() { merged.dispose(); mat.dispose(); if (minGeo) { minGeo.dispose(); minMat.dispose(); } },
  };
}

// ---------------------------------------------------------------------------
// 備用洞窟裝飾（B 的 makeDecor 還不認得這些 kind 時才用）
const fbCache = new Map();
const fbMat = {};
function mats() {
  if (fbMat.stone) return fbMat;
  fbMat.stone = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  fbMat.glowTeal = new THREE.MeshStandardMaterial({ color: '#7ff0dc', emissive: '#2fd2bd', emissiveIntensity: 1.1, roughness: 0.6, flatShading: true });
  fbMat.glowPurple = new THREE.MeshStandardMaterial({ color: '#c6a8ff', emissive: '#8a5cff', emissiveIntensity: 0.9, roughness: 0.25, flatShading: true });
  return fbMat;
}
function cached(key, fn) { let g = fbCache.get(key); if (!g) { g = fn(); fbCache.set(key, g); } return g; }
function colored(geo, hex, rnd, vary = 0.08) { return faceColored(geo, hex, vary, rnd); }

export function makeCaveDecorFallback(kind, rng = Math.random) {
  const M = mats();
  const v = Math.floor(rng() * 3);
  const g = new THREE.Group();
  g.name = 'caveDecor:' + kind;
  if (kind === 'stalagmite') {
    const geo = cached(`st${v}`, () => {
      const r = makeRng(31 + v);
      const parts = [spireGeo(r, '#6d6258', 0.9 + v * 0.25, 0.2), spireGeo(r, '#5d544c', 0.5 + v * 0.1, 0.13), spireGeo(r, '#776b60', 0.35, 0.1)];
      place(parts[1], 0.17, 0, 0.08, 0.5); place(parts[2], -0.14, 0, -0.12, 1.3);
      const base = colored(new THREE.CylinderGeometry(0.28, 0.34, 0.08, 7), '#4f4842', r);
      parts.push(place(base, 0, 0.04, 0));
      return mergeGeometries(parts, false);
    });
    const m = new THREE.Mesh(geo, M.stone); m.castShadow = true; m.receiveShadow = true; g.add(m);
  } else if (kind === 'glowshroom') {
    const stem = cached(`gs${v}`, () => {
      const r = makeRng(77 + v), parts = [];
      for (let i = 0; i < 3 + v; i++) {
        const a = i * 2.3 + v, d = i === 0 ? 0 : 0.18 + r() * 0.12, h = i === 0 ? 0.42 : 0.18 + r() * 0.18;
        parts.push(place(colored(new THREE.CylinderGeometry(0.03, 0.045, h, 6), '#d8e8e0', r), Math.cos(a) * d, h / 2, Math.sin(a) * d));
      }
      return mergeGeometries(parts, false);
    });
    const caps = cached(`gc${v}`, () => {
      const r = makeRng(77 + v), parts = [];
      for (let i = 0; i < 3 + v; i++) {
        const a = i * 2.3 + v, d = i === 0 ? 0 : 0.18 + r() * 0.12, h = i === 0 ? 0.42 : 0.18 + r() * 0.18;
        const s = i === 0 ? 0.2 : 0.09 + r() * 0.06;
        const c = new THREE.SphereGeometry(1, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2).toNonIndexed();
        parts.push(place(c, Math.cos(a) * d, h - 0.02, Math.sin(a) * d, 0, s, s * 0.6, s));
      }
      return mergeGeometries(parts, false);
    });
    const a = new THREE.Mesh(stem, M.stone), b = new THREE.Mesh(caps, M.glowTeal);
    a.castShadow = true; b.castShadow = true;
    g.add(a, b);
  } else if (kind === 'cavecrystal') {
    const geo = cached(`cc${v}`, () => {
      const r = makeRng(55 + v), parts = [];
      for (let i = 0; i < 5; i++) {
        const o = new THREE.OctahedronGeometry(1, 0);
        const h = i === 0 ? 0.55 + v * 0.1 : 0.22 + r() * 0.25;
        const a = i * 1.7, d = i === 0 ? 0 : 0.14 + r() * 0.08;
        parts.push(place(o, Math.cos(a) * d, h * 0.8, Math.sin(a) * d, r() * 3, 0.1 + r() * 0.04, h, 0.1 + r() * 0.04, (r() - 0.5) * 0.6, (r() - 0.5) * 0.6));
      }
      return mergeGeometries(parts, false);
    });
    const base = cached('ccb', () => colored(new THREE.CylinderGeometry(0.26, 0.32, 0.1, 7).translate(0, 0.05, 0), '#4c4560', makeRng(3)));
    const a = new THREE.Mesh(geo, M.glowPurple), b = new THREE.Mesh(base, M.stone);
    a.castShadow = true; b.receiveShadow = true;
    g.add(a, b);
  } else if (kind === 'minecart') {
    const geo = cached('mc', () => {
      const r = makeRng(9), parts = [];
      parts.push(place(colored(new THREE.BoxGeometry(0.62, 0.3, 0.42), '#6a4a32', r), 0, 0.3, 0));
      parts.push(place(colored(new THREE.BoxGeometry(0.66, 0.05, 0.46), '#55575c', r), 0, 0.46, 0));
      for (const sx of [-0.2, 0.2]) for (const sz of [-0.22, 0.22]) {
        parts.push(place(colored(new THREE.CylinderGeometry(0.08, 0.08, 0.05, 8), '#3d3f44', r), sx, 0.1, sz, 0, 1, 1, 1, Math.PI / 2));
      }
      for (let i = 0; i < 5; i++) parts.push(place(rockGeo(r, i % 2 ? '#8a7f74' : '#6a6460', false), (r() - 0.5) * 0.4, 0.5, (r() - 0.5) * 0.25, r() * 6, 0.1, 0.08, 0.1));
      // 鐵軌（沿 x 軸橫跨整格，相鄰格會接起來）＋枕木
      for (const u of [-0.375, -0.125, 0.125, 0.375]) parts.push(place(colored(new THREE.BoxGeometry(0.1, 0.035, 0.66), '#5e4632', r), u, 0.017, 0));
      for (const w of [-0.2, 0.2]) parts.push(place(colored(new THREE.BoxGeometry(1.0, 0.04, 0.04), '#77726c', r), 0, 0.05, w));
      return mergeGeometries(parts, false);
    });
    const m = new THREE.Mesh(geo, M.stone); m.castShadow = true; m.receiveShadow = true; g.add(m);
    g.userData.noRandomYaw = true;
  } else return null;
  return g;
}
