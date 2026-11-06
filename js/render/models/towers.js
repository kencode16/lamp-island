// 塔模型：弓箭塔、投石砲、法師塔、樹靈塔（1–3 級＋第 4 級分支 a/b）（擁有者：B）
import * as THREE from 'three';
import { C, halo } from '../palette.js';
import { part, pivot, PI, TAU, clamp, damp } from './lib.js';

const H2 = PI / 2;

// ---------------------------------------------------------------------------
// 共用小零件
// ---------------------------------------------------------------------------
/** 掛布旗（從 y 往下垂），正面朝 +z（可用 ry 轉向） */
function banner(b, x, y, z, w, h, cloth, emblem, ry = 0, trim = C.gold) {
  const t = { p: [x, y, z], r: [0, ry, 0] };
  b.shape([[-w / 2, 0], [w / 2, 0], [w / 2, -h], [0, -h - w * 0.45], [-w / 2, -h]], 0.018, cloth, t, { jit: 0.03 });
  // 上緣橫桿
  b.cylC(0.012, 0.012, w + 0.06, 5, C.woodDark, { p: [x, y + 0.01, z], r: [0, ry, H2] });
  // 徽章
  const ex = x + Math.sin(ry) * 0.014, ez = z + Math.cos(ry) * 0.014;
  b.oct(w * 0.2, emblem, { p: [ex, y - h * 0.48, ez], r: [0, ry, 0], s: [1, 1.25, 0.35] }, { shine: 0.6 });
  // 金邊
  b.boxC(w, 0.018, 0.024, trim, { p: [x, y - 0.012, z], r: [0, ry, 0] }, { shine: 0.6 });
}
/** 旗桿＋三角小旗 */
function flag(b, x, y, z, h, color, ry = 0, len = 0.2) {
  b.cyl(0.011, 0.014, h, 5, C.woodDark, { p: [x, y, z] });
  b.ico(0.022, 0, C.gold, { p: [x, y + h + 0.015, z] }, { shine: 0.8 });
  b.shape([[0, 0], [len, -0.045], [0, -0.1]], 0.012, color, { p: [x, y + h - 0.01, z], r: [0, ry, 0] }, { jit: 0.03 });
}
/** 四根腳的木架（從 (±h0,y0,±h0) 斜到 (±h1,y1,±h1)），braces = X 形斜撐的層數 */
function legFrame(b, y0, y1, h0, h1, legW, color, braceColor, braces = 1, single = false) {
  const H = y1 - y0, a = Math.atan2(h0 - h1, H);
  const L = H / Math.cos(a) * 1.02;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    b.box(legW, L, legW, color, { p: [sx * h0, y0, sz * h0], r: [-a * sz, 0, a * sx] }, { jit: 0.04 });
  }
  for (let i = 0; i < braces; i++) {
    const ya = y0 + (H * i) / braces + 0.04, yb = y0 + (H * (i + 1)) / braces - 0.02;
    const fm = (ya + yb) / 2, hh = h0 + (h1 - h0) * ((fm - y0) / H);
    const dy = yb - ya, L2 = Math.hypot(2 * hh, dy), th = Math.atan2(2 * hh, dy);
    const alt = i % 2 ? 1 : -1;
    for (const s of [-1, 1]) {
      b.boxC(0.026, L2, 0.026, braceColor, { p: [0, fm, s * hh], r: [0, 0, th * alt] });
      b.boxC(0.026, L2, 0.026, braceColor, { p: [s * hh, fm, 0], r: [th * alt, 0, 0] });
      if (single) continue;
      b.boxC(0.026, L2, 0.026, braceColor, { p: [0, fm, s * hh], r: [0, 0, -th * alt] });
      b.boxC(0.026, L2, 0.026, braceColor, { p: [s * hh, fm, 0], r: [-th * alt, 0, 0] });
    }
  }
}
/** 木平台＋欄杆（中心 y 為平台頂） */
function deck(b, y, half, railH, floor, rail, trim) {
  b.box(half * 2 + 0.04, 0.06, half * 2 + 0.04, floor, { p: [0, y - 0.06, 0] }, { jit: 0.05 });
  for (const s of [-1, 1]) {
    b.box(half * 2, railH, 0.035, rail, { p: [0, y, s * half] });
    b.box(0.035, railH, half * 2, rail, { p: [s * half, y, 0] });
  }
  if (trim) {
    for (const s of [-1, 1]) {
      b.box(half * 2 + 0.03, 0.022, 0.05, trim, { p: [0, y + railH, s * half] }, { shine: 0.6 });
      b.box(0.05, 0.022, half * 2 + 0.03, trim, { p: [s * half, y + railH, 0] }, { shine: 0.6 });
    }
  }
}
/** 方形尖屋頂（含簷口），bottom = 屋頂底部高度 */
function pyramidRoof(b, bottom, r, h, color, topColor, trim) {
  b.cone(r, h, 4, color, { p: [0, bottom, 0], r: [0, PI / 4, 0] }, { top: topColor, jit: 0.05 });
  const half = r * Math.SQRT1_2;
  if (trim) {
    for (const s of [-1, 1]) {
      b.box(half * 2 + 0.02, 0.03, 0.03, trim, { p: [0, bottom - 0.01, s * half] }, { shine: 0.7 });
      b.box(0.03, 0.03, half * 2 + 0.02, trim, { p: [s * half, bottom - 0.01, 0] }, { shine: 0.7 });
    }
  }
}
/** 方形外框（只有四邊，不蓋住頂面） */
function rim(b, w, y, color, shine = 0, t = 0.05, h = 0.035) {
  for (const s of [-1, 1]) {
    b.box(w, h, t, color, { p: [0, y, s * (w - t) / 2] }, { shine });
    b.box(t, h, w - 2 * t, color, { p: [s * (w - t) / 2, y, 0] }, { shine });
  }
}
/** 八角石基座 */
function stoneDrum(b, y, rb, rt, h, color, topColor, seg = 8, wob = 0.008) {
  b.cyl(rt, rb, h, seg, color, { p: [0, y, 0], r: [0, PI / seg, 0] }, { top: topColor, wob, jit: 0.07 });
}
/** 一圈石磚凸塊（堞口） */
function merlonRing(b, y, r, n, w, h, color, offset = 0) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + offset;
    b.box(w, h, w * 0.8, color, { p: [Math.sin(a) * r, y, Math.cos(a) * r], r: [0, a, 0] }, { jit: 0.06 });
  }
}
/** 樹臉（眼睛會發光） */
function treeFace(b, y, z, s, eye, socket = C.trunkDark, mouthColor = '#3a2418') {
  for (const sx of [-1, 1]) {
    b.boxC(0.075 * s, 0.06 * s, 0.03, socket, { p: [sx * 0.055 * s, y, z], r: [0, sx * 0.25, sx * -0.12] });
    b.boxC(0.045 * s, 0.035 * s, 0.03, eye, { p: [sx * 0.055 * s, y, z + 0.012] , r: [0, sx * 0.25, sx * -0.12] }, { glow: 1.1, jit: 0 });
    // 眉毛
    b.boxC(0.085 * s, 0.022 * s, 0.04, C.trunkDark, { p: [sx * 0.058 * s, y + 0.05 * s, z + 0.005], r: [0, sx * 0.25, sx * 0.3] });
  }
  b.coneC(0.028 * s, 0.07 * s, 4, C.trunk, { p: [0, y - 0.035 * s, z + 0.02], r: [H2, 0, 0] });
  b.boxC(0.09 * s, 0.03 * s, 0.03, mouthColor, { p: [0, y - 0.1 * s, z - 0.004] });
}

// ---------------------------------------------------------------------------
// 動畫：後座、閃光
// ---------------------------------------------------------------------------
function makeFlash(color, size) {
  const f = halo(color, size, 0.9);
  f.visible = false;
  return f;
}

// ===========================================================================
// 弓箭塔
// ===========================================================================
function ballista(b, s = 1, opts = {}) {
  const wood = opts.wood || C.woodDark, limb = opts.limb || C.wood;
  b.cyl(0.045 * s, 0.06 * s, 0.08 * s, 6, C.iron, {}, { shine: 0.4 });
  b.boxC(0.075 * s, 0.06 * s, 0.4 * s, wood, { p: [0, 0.11 * s, 0.03 * s] });
  for (const sx of [-1, 1]) {
    b.boxC(0.22 * s, 0.04 * s, 0.045 * s, limb, { p: [sx * 0.105 * s, 0.12 * s, 0.2 * s], r: [0, sx * 0.4, 0] });
    b.boxC(0.03 * s, 0.05 * s, 0.03 * s, opts.tip || C.iron, { p: [sx * 0.205 * s, 0.12 * s, 0.155 * s] }, { shine: 0.5 });
  }
  b.boxC(0.4 * s, 0.01, 0.01, C.cream, { p: [0, 0.12 * s, 0.155 * s] }, { jit: 0 });
  b.boxC(0.022 * s, 0.022 * s, 0.34 * s, C.woodPale, { p: [0, 0.155 * s, 0.13 * s] });
  b.coneC(0.03 * s, 0.07 * s, 4, C.steel, { p: [0, 0.155 * s, 0.32 * s], r: [H2, 0, 0] }, { shine: 0.8 });
  b.boxC(0.06 * s, 0.03 * s, 0.03 * s, C.red, { p: [0, 0.16 * s, -0.04 * s] });
}

function repeater(b) {
  // 連弩：三管並排＋寬大弓臂＋箭匣
  b.cyl(0.07, 0.09, 0.08, 8, C.ironDark, {}, { shine: 0.4 });
  b.boxC(0.3, 0.07, 0.16, C.woodDark, { p: [0, 0.11, -0.04] });
  for (const x of [-0.1, 0, 0.1]) {
    b.boxC(0.06, 0.055, 0.42, C.wood, { p: [x, 0.15, 0.06] });
    b.boxC(0.02, 0.02, 0.34, C.woodPale, { p: [x, 0.19, 0.12] });
    b.coneC(0.026, 0.07, 4, C.steel, { p: [x, 0.19, 0.31], r: [H2, 0, 0] }, { shine: 0.8 });
  }
  for (const sx of [-1, 1]) {
    b.boxC(0.3, 0.05, 0.05, C.woodDark, { p: [sx * 0.18, 0.16, 0.24], r: [0, sx * 0.42, 0] });
    b.boxC(0.04, 0.07, 0.04, C.gold, { p: [sx * 0.32, 0.16, 0.18] }, { shine: 0.8 });
  }
  b.boxC(0.6, 0.012, 0.012, C.cream, { p: [0, 0.16, 0.18] }, { jit: 0 });
  // 箭匣
  b.box(0.26, 0.12, 0.14, C.woodRed, { p: [0, 0.18, -0.06] });
  b.box(0.27, 0.025, 0.15, C.gold, { p: [0, 0.27, -0.06] }, { shine: 0.8 });
  b.box(0.27, 0.025, 0.15, C.gold, { p: [0, 0.2, -0.06] }, { shine: 0.8 });
  for (const x of [-0.08, 0, 0.08]) b.cyl(0.012, 0.012, 0.08, 4, C.woodPale, { p: [x, 0.3, -0.06] });
}

function hawkArcher(b) {
  // 鷹眼弓手：綠斗篷、長弓、箭袋
  b.lathe([[0.0, 0], [0.11, 0], [0.1, 0.06], [0.07, 0.2], [0.05, 0.24], [0, 0.25]], 7, C.green, {}, { top: '#7ccf6a' });
  b.ico(0.058, 1, C.skin, { p: [0, 0.29, 0.005] });
  b.cone(0.075, 0.13, 6, '#3f9a4c', { p: [0, 0.27, -0.015], r: [-0.25, 0, 0] });
  b.boxC(0.1, 0.02, 0.02, C.dark, { p: [0, 0.29, 0.055] }, { jit: 0 });
  b.boxC(0.07, 0.03, 0.01, C.eyeWhite, { p: [0, 0.296, 0.062] }, { glow: 0.3, jit: 0 });
  // 長弓（左手持，弓身垂直，位於前方）
  b.torus(0.17, 0.014, 3, 10, PI * 0.9, C.woodDark, { p: [0.06, 0.2, 0.13], r: [0, H2, PI * 0.55] });
  b.boxC(0.008, 0.33, 0.008, C.cream, { p: [0.06, 0.2, 0.09] }, { jit: 0 });
  b.boxC(0.02, 0.02, 0.26, C.woodPale, { p: [0.06, 0.21, 0.12] });
  b.coneC(0.022, 0.05, 4, C.steel, { p: [0.06, 0.21, 0.27], r: [H2, 0, 0] }, { shine: 0.8 });
  // 手臂
  b.boxC(0.04, 0.04, 0.13, '#3f9a4c', { p: [0.06, 0.2, 0.05] });
  b.boxC(0.04, 0.04, 0.1, '#3f9a4c', { p: [-0.03, 0.2, 0.06], r: [0, 0.6, 0] });
  // 箭袋
  b.box(0.06, 0.15, 0.05, C.leather, { p: [-0.05, 0.1, -0.08], r: [0.3, 0, 0.25] });
  for (const x of [-0.06, -0.04]) b.box(0.01, 0.07, 0.01, C.red, { p: [x - 0.03, 0.24, -0.12], r: [0.3, 0, 0.25] });
}

function archerTower(v) {
  const g = new THREE.Group();
  const k = `tw:archer:${v}`;
  let headY, roofParts;
  const base = part(k + ':base', (b) => {
    if (v === 1) {
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(0.13, 0.05, 0.13, C.stoneDark, { p: [sx * 0.25, 0, sz * 0.25] }, { wob: 0.01 });
      legFrame(b, 0.04, 0.42, 0.25, 0.27, 0.07, C.woodDark, C.wood, 1);
      deck(b, 0.46, 0.3, 0.12, C.woodLight, C.wood);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(0.045, 0.34, 0.045, C.woodDark, { p: [sx * 0.29, 0.46, sz * 0.29] });
      pyramidRoof(b, 0.8, 0.56, 0.3, C.roofRed, '#f08a78');
      b.cone(0.03, 0.08, 5, C.woodDark, { p: [0, 1.08, 0] });
    } else if (v === 2) {
      stoneDrum(b, 0, 0.44, 0.4, 0.28, C.stone, C.stoneLight);
      b.cyl(0.43, 0.43, 0.05, 8, C.stoneDark, { p: [0, 0.28, 0], r: [0, PI / 8, 0] });
      b.box(0.13, 0.17, 0.04, C.woodDark, { p: [0, 0, 0.405] });
      legFrame(b, 0.32, 0.64, 0.27, 0.29, 0.075, C.woodDark, C.wood, 1);
      deck(b, 0.68, 0.32, 0.13, C.woodLight, C.wood);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(0.05, 0.37, 0.05, C.woodDark, { p: [sx * 0.31, 0.68, sz * 0.31] });
      pyramidRoof(b, 1.04, 0.6, 0.32, C.roofRed, '#f08a78', C.roofRedDark);
      flag(b, 0, 1.33, 0, 0.18, C.red, 0.3);
    } else if (v === 3) {
      stoneDrum(b, 0, 0.45, 0.39, 0.56, C.stone, C.stoneLight);
      b.cyl(0.42, 0.42, 0.06, 8, C.stoneDark, { p: [0, 0.54, 0], r: [0, PI / 8, 0] });
      b.cyl(0.425, 0.425, 0.03, 8, C.gold, { p: [0, 0.49, 0], r: [0, PI / 8, 0] }, { shine: 0.8 });
      b.box(0.14, 0.2, 0.04, C.woodDark, { p: [0, 0, 0.42] });
      b.box(0.16, 0.025, 0.05, C.gold, { p: [0, 0.2, 0.42] }, { shine: 0.8 });
      for (const a of [0.9, -0.9]) b.box(0.04, 0.1, 0.03, C.dark, { p: [Math.sin(a) * 0.4, 0.3, Math.cos(a) * 0.4], r: [0, a, 0] });
      banner(b, -0.2, 0.47, 0.37, 0.13, 0.25, C.red, C.gold, -0.4);
      banner(b, 0.2, 0.47, 0.37, 0.13, 0.25, C.red, C.gold, 0.4);
      deck(b, 0.66, 0.33, 0.14, C.woodLight, C.wood, C.gold);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(0.055, 0.42, 0.055, C.woodDark, { p: [sx * 0.32, 0.66, sz * 0.32] });
      pyramidRoof(b, 1.07, 0.64, 0.36, C.roofRed, '#f59a86', C.gold);
      b.cone(0.05, 0.1, 6, C.gold, { p: [0, 1.4, 0] }, { shine: 0.8 });
      flag(b, 0, 1.44, 0, 0.16, C.red, 0.3, 0.24);
    } else if (v === 'a') {
      // 連弩：方形石堡＋堞口＋大屋頂
      b.box(0.78, 0.62, 0.78, C.stone, {}, { top: C.stoneLight, wob: 0.008, jit: 0.07 });
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(0.15, 0.7, 0.15, C.stoneDark, { p: [sx * 0.37, 0, sz * 0.37] }, { wob: 0.008 });
      b.box(0.82, 0.04, 0.82, C.gold, { p: [0, 0.56, 0] }, { shine: 0.8 });
      b.box(0.84, 0.06, 0.84, C.stoneDark, { p: [0, 0.6, 0] });
      for (const s of [-1, 1]) for (const t of [-0.17, 0.17]) {
        b.box(0.11, 0.1, 0.08, C.stoneDark, { p: [t, 0.66, s * 0.38] });
        b.box(0.08, 0.1, 0.11, C.stoneDark, { p: [s * 0.38, 0.66, t] });
      }
      b.box(0.16, 0.24, 0.04, C.woodDark, { p: [0, 0, 0.395] });
      b.box(0.18, 0.03, 0.05, C.gold, { p: [0, 0.24, 0.395] }, { shine: 0.8 });
      banner(b, -0.24, 0.52, 0.42, 0.14, 0.3, C.redDark, C.gold, 0);
      banner(b, 0.24, 0.52, 0.42, 0.14, 0.3, C.redDark, C.gold, 0);
      b.box(0.7, 0.04, 0.7, C.woodLight, { p: [0, 0.62, 0] });
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(0.065, 0.62, 0.065, C.woodDark, { p: [sx * 0.33, 0.66, sz * 0.33] });
      pyramidRoof(b, 1.26, 0.72, 0.4, C.roofRedDark, C.roofRed, C.gold);
      b.cone(0.3, 0.16, 4, C.roofRed, { p: [0, 1.38, 0], r: [0, PI / 4, 0] }, { top: '#f59a86' });
      b.cone(0.05, 0.12, 6, C.gold, { p: [0, 1.62, 0] }, { shine: 0.8 });
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.cone(0.03, 0.1, 5, C.gold, { p: [sx * 0.5, 1.22, sz * 0.5] }, { shine: 0.8 });
      flag(b, 0, 1.68, 0, 0.18, C.red, 0.3, 0.26);
    } else {
      // 鷹眼：高聳瞭望台
      stoneDrum(b, 0, 0.36, 0.33, 0.14, C.stone, C.stoneLight);
      legFrame(b, 0.12, 1.32, 0.27, 0.17, 0.065, C.woodDark, C.wood, 3, true);
      b.cyl(0.3, 0.3, 0.06, 8, C.woodLight, { p: [0, 1.28, 0], r: [0, PI / 8, 0] });
      b.cyl(0.3, 0.27, 0.13, 8, C.wood, { p: [0, 1.34, 0], r: [0, PI / 8, 0] }, { top: C.woodLight });
      b.cyl(0.315, 0.315, 0.025, 8, C.gold, { p: [0, 1.46, 0], r: [0, PI / 8, 0] }, { shine: 0.8 });
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * TAU + PI;
        b.box(0.035, 0.3, 0.035, C.woodDark, { p: [Math.sin(a) * 0.27, 1.46, Math.cos(a) * 0.27] });
      }
      b.cone(0.36, 0.38, 6, C.roofTeal, { p: [0, 1.74, 0] }, { top: '#7fd8c6' });
      b.cyl(0.37, 0.37, 0.025, 6, C.gold, { p: [0, 1.735, 0] }, { shine: 0.8 });
      flag(b, 0, 2.1, 0, 0.16, C.blue, 0.3, 0.3);
      banner(b, 0, 1.3, 0.3, 0.15, 0.38, C.blue, C.white, 0);
    }
  }, { receive: true });
  g.add(base);

  const head = new THREE.Group();
  const gun = new THREE.Group();
  head.add(gun);
  let muzzleZ = 0.34, muzzleY = 0.155, s = 1;
  if (v === 1) headY = 0.46;
  else if (v === 2) headY = 0.68;
  else if (v === 3) { headY = 0.66; s = 1.08; }
  else if (v === 'a') { headY = 0.66; muzzleY = 0.19; muzzleZ = 0.36; }
  else { headY = 1.34; muzzleY = 0.21; muzzleZ = 0.3; }
  head.position.y = headY;
  if (v === 'a') gun.add(part(k + ':gun', (b) => repeater(b)));
  else if (v === 'b') gun.add(part(k + ':gun', (b) => hawkArcher(b)));
  else gun.add(part(k + ':gun', (b) => ballista(b, s, v === 3 ? { tip: C.gold, limb: C.woodDark, wood: C.woodRed } : {})));
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, muzzleY * (v === 3 ? s : 1), muzzleZ * (v === 3 ? s : 1));
  gun.add(muzzle);
  const flash = makeFlash('#fff0b8', 0.22); flash.position.copy(muzzle.position); gun.add(flash);
  g.add(head);

  let recoil = 0, flashT = 0;
  g.userData = {
    kind: 'tower', type: 'archer', level: v,
    head, muzzle, height: v === 1 ? 1.12 : v === 2 ? 1.5 : v === 3 ? 1.6 : v === 'a' ? 1.85 : 2.25,
    fire() { recoil = 1; flashT = 0.07; },
    update(dt) {
      if (recoil > 0) recoil = Math.max(0, recoil - dt * 5);
      gun.position.z = -Math.sin(recoil * PI * 0.5) * 0.07 * (v === 'b' ? 0.5 : 1);
      if (flashT > 0) { flashT -= dt; flash.visible = flashT > 0; }
    },
  };
  return g;
}

// ===========================================================================
// 投石砲
// ===========================================================================
function catapultFrame(b, s, o) {
  const wood = o.wood, dark = o.dark;
  for (const sx of [-1, 1]) {
    b.boxC(0.06 * s, 0.06 * s, 0.58 * s, dark, { p: [sx * 0.17 * s, 0.09 * s, 0] });
    // 後腳斜撐到軸心、前柱垂直到擋桿
    b.boxC(0.05 * s, 0.42 * s, 0.05 * s, wood, { p: [sx * 0.17 * s, 0.26 * s, -0.11 * s], r: [-0.6, 0, 0] });
    b.box(0.05 * s, 0.5 * s, 0.05 * s, wood, { p: [sx * 0.17 * s, 0.09 * s, 0.13 * s] });
    b.boxC(0.045 * s, 0.045 * s, 0.16 * s, wood, { p: [sx * 0.17 * s, 0.4 * s, 0.06 * s] });
    if (o.wheels) for (const sz of [-1, 1]) {
      b.cylC(0.09 * s, 0.09 * s, 0.045 * s, 7, o.wheel, { p: [sx * 0.225 * s, 0.09 * s, sz * 0.19 * s], r: [0, 0, H2] }, { jit: 0.08 });
      b.boxC(0.06 * s, 0.045 * s, 0.045 * s, C.iron, { p: [sx * 0.235 * s, 0.09 * s, sz * 0.19 * s] }, { shine: 0.5 });
    }
    if (o.bands) {
      b.boxC(0.07 * s, 0.07 * s, 0.03 * s, o.bands, { p: [sx * 0.17 * s, 0.09 * s, 0.27 * s] }, { shine: 0.6 });
      b.boxC(0.07 * s, 0.07 * s, 0.03 * s, o.bands, { p: [sx * 0.17 * s, 0.09 * s, -0.27 * s] }, { shine: 0.6 });
    }
  }
  for (const sz of [-1, 1]) b.boxC(0.4 * s, 0.05 * s, 0.06 * s, dark, { p: [0, 0.09 * s, sz * 0.25 * s] });
  // 擋桿（有軟墊）
  b.boxC(0.4 * s, 0.05 * s, 0.06 * s, dark, { p: [0, 0.6 * s, 0.13 * s] });
  b.boxC(0.16 * s, 0.07 * s, 0.08 * s, o.pad, { p: [0, 0.6 * s, 0.13 * s] });
  // 軸與扭力繩
  b.cylC(0.028 * s, 0.028 * s, 0.42 * s, 6, C.iron, { p: [0, 0.4 * s, 0], r: [0, 0, H2] }, { shine: 0.5 });
  b.cylC(0.06 * s, 0.06 * s, 0.24 * s, 6, C.rope, { p: [0, 0.4 * s, 0], r: [0, 0, H2] });
}
function catapultArm(b, s, len, o) {
  b.box(0.05 * s, len, 0.05 * s, o.arm, { p: [0, -0.06 * s, 0] });
  if (o.wrap) for (const y of [0.12, 0.3]) b.box(0.06 * s, 0.03, 0.06 * s, o.wrap, { p: [0, y * len, 0] });
  b.cylC(0.085 * s, 0.055 * s, 0.06 * s, 7, o.cup, { p: [0, len - 0.06 * s, 0.03 * s], r: [H2, 0, 0] });
}

function catapultTower(v) {
  const g = new THREE.Group();
  const k = `tw:catapult:${v}`;
  const fireB = v === 'b';
  const big = v === 'a';
  const base = part(k + ':base', (b) => {
    if (v === 1) {
      b.cyl(0.4, 0.42, 0.06, 10, C.woodDark, {}, { jit: 0.08 });
      for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + 0.3; b.dodec(0.05, C.stoneDark, { p: [Math.sin(a) * 0.4, 0.02, Math.cos(a) * 0.4], s: [1, 0.6, 1] }); }
    } else if (v === 2 || v === 3) {
      const h = v === 2 ? 0.14 : 0.2;
      b.box(0.8, h, 0.8, C.stone, {}, { top: C.stoneLight, wob: 0.008, jit: 0.07 });
      rim(b, 0.83, h - 0.005, v === 3 ? C.gold : C.stoneDark, v === 3 ? 0.8 : 0);
      b.cyl(0.34, 0.34, 0.03, 12, v === 3 ? C.goldDark : C.iron, { p: [0, h, 0] }, { shine: 0.5 });
      for (const [x, z, r] of [[0.3, -0.3, 0.07], [0.24, -0.33, 0.055], [0.33, -0.22, 0.05], [0.29, -0.27, 0.05]]) b.dodec(r, C.stoneDark, { p: [x, h + r * 0.8, z] }, { wob: 0.01 });
      if (v === 3) {
        flag(b, -0.34, h, -0.34, 0.5, C.roofOrange, 0.4, 0.22);
        flag(b, 0.34, h, 0.34, 0.5, C.roofOrange, 0.4, 0.22);
      }
    } else if (v === 'a') {
      b.box(0.86, 0.22, 0.86, C.stoneDark, {}, { top: C.stone, wob: 0.01, jit: 0.08 });
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(0.16, 0.3, 0.16, C.stone, { p: [sx * 0.37, 0, sz * 0.37] }, { top: C.stoneLight, wob: 0.01 });
      rim(b, 0.88, 0.2, C.gold, 0.8);
      for (const [x, z, r] of [[0.32, 0.18, 0.1], [0.3, 0.03, 0.08], [0.2, 0.3, 0.07]]) b.dodec(r, C.stoneDeep, { p: [x, 0.22 + r * 0.7, z] }, { wob: 0.015 });
    } else {
      b.box(0.82, 0.18, 0.82, C.stoneDeep, {}, { top: C.stoneDark, wob: 0.008, jit: 0.08 });
      rim(b, 0.85, 0.165, C.copper, 0.6);
      // 火盆的腳與盆（火焰另外做成會跳動的 mesh）
      for (const [x, z] of [[-0.33, 0.33], [0.33, 0.33], [-0.33, -0.33]]) {
        b.box(0.05, 0.2, 0.05, C.ironDark, { p: [x, 0.18, z] });
        b.cyl(0.1, 0.06, 0.08, 6, C.ironDark, { p: [x, 0.37, z] }, { shine: 0.4, top: C.copper });
        b.oct(0.08, C.fire, { p: [x, 0.44, z], s: [1, 0.4, 1] }, { glow: 1.2, jit: 0.1 });
      }
    }
  }, { receive: true });
  g.add(base);

  const baseTop = v === 1 ? 0.06 : v === 2 ? 0.17 : v === 3 ? 0.235 : v === 'a' ? 0.24 : 0.2;
  const s = v === 1 ? 1 : v === 2 ? 1.08 : v === 3 ? 1.16 : 1.16;
  const head = new THREE.Group(); head.position.y = baseTop;
  const rig = new THREE.Group(); head.add(rig);
  let arm, armPivot, ammo, restA, fireA, cw = null;
  const muzzle = new THREE.Object3D();

  if (!big) {
    const o = v === 'b'
      ? { wood: C.woodRed, dark: C.ironDark, wheel: C.woodDark, pad: C.redDark, wheels: true, bands: C.copper, arm: C.woodRed, cup: C.ironDark, wrap: C.red }
      : { wood: C.wood, dark: C.woodDark, wheel: C.woodLight, pad: v === 3 ? C.red : C.cream, wheels: true, bands: v >= 2 ? (v === 3 ? C.gold : C.iron) : null, arm: C.wood, cup: C.woodDark, wrap: v === 3 ? C.gold : null };
    rig.add(part(k + ':frame', (b) => catapultFrame(b, s, o)));
    armPivot = pivot(0, 0.4 * s, 0); rig.add(armPivot);
    const len = 0.5 * s;
    arm = part(k + ':arm', (b) => catapultArm(b, s, len, o)); armPivot.add(arm);
    ammo = part(k + ':ammo', (b) => {
      if (fireB) {
        b.ico(0.06, 0, C.ironDark, { p: [0, len - 0.06 * s, 0.07 * s] });
        b.ico(0.045, 0, C.fire, { p: [0, len - 0.03 * s, 0.09 * s] }, { glow: 1.3 });
      } else b.dodec(0.06 * s, C.stoneDark, { p: [0, len - 0.06 * s, 0.07 * s] }, { wob: 0.008 });
    });
    armPivot.add(ammo);
    restA = -1.05; fireA = 0.32;
    muzzle.position.set(0, 0.85 * s, 0.2 * s);
  } else {
    // 巨石：高大的配重投石機
    rig.add(part(k + ':frame', (b) => {
      for (const sx of [-1, 1]) {
        b.boxC(0.07, 0.07, 0.8, C.woodDark, { p: [sx * 0.22, 0.05, 0] });
        b.boxC(0.065, 1.05, 0.065, C.wood, { p: [sx * 0.22, 0.5, -0.17], r: [-0.33, 0, 0] });
        b.boxC(0.065, 1.05, 0.065, C.wood, { p: [sx * 0.22, 0.5, 0.17], r: [0.33, 0, 0] });
        b.boxC(0.05, 0.05, 0.42, C.woodDark, { p: [sx * 0.22, 0.42, 0] });
        b.cylC(0.05, 0.05, 0.06, 6, C.gold, { p: [sx * 0.26, 0.95, 0], r: [0, 0, H2] }, { shine: 0.8 });
      }
      for (const sz of [-1, 1]) b.boxC(0.5, 0.06, 0.07, C.woodDark, { p: [0, 0.05, sz * 0.37] });
      b.boxC(0.5, 0.05, 0.05, C.woodDark, { p: [0, 0.42, 0] });
      b.cylC(0.03, 0.03, 0.5, 6, C.iron, { p: [0, 0.95, 0], r: [0, 0, H2] }, { shine: 0.5 });
      // 吊索托架
      b.box(0.3, 0.04, 0.3, C.woodLight, { p: [0, 0.07, -0.25] });
    }));
    armPivot = pivot(0, 0.95, 0); rig.add(armPivot);
    arm = part(k + ':arm', (b) => {
      b.boxC(0.06, 0.92, 0.06, C.wood, { p: [0, 0.18, 0] });
      for (const y of [-0.2, 0.3, 0.55]) b.boxC(0.075, 0.03, 0.075, C.gold, { p: [0, y, 0] }, { shine: 0.8 });
      b.cylC(0.012, 0.012, 0.14, 4, C.rope, { p: [0, 0.68, 0.05], r: [0.6, 0, 0] });
    });
    armPivot.add(arm);
    ammo = part(k + ':ammo', (b) => b.dodec(0.11, C.stoneDark, { p: [0, 0.7, 0.12] }, { wob: 0.015, top: C.stone }));
    armPivot.add(ammo);
    cw = pivot(0, -0.26, 0); armPivot.add(cw);
    cw.add(part(k + ':cw', (b) => {
      b.boxC(0.03, 0.12, 0.03, C.ironDark, { p: [0, -0.05, 0] });
      b.box(0.3, 0.24, 0.22, C.ironDark, { p: [0, -0.34, 0] }, { top: C.iron, shine: 0.3 });
      b.box(0.31, 0.03, 0.23, C.gold, { p: [0, -0.15, 0] }, { shine: 0.8 });
      b.box(0.31, 0.03, 0.23, C.gold, { p: [0, -0.3, 0] }, { shine: 0.8 });
    }));
    restA = -2.25; fireA = 0.55;
    muzzle.position.set(0, 1.6, 0.3);
  }
  armPivot.rotation.x = restA;
  rig.add(muzzle);
  g.add(head);

  // 燃燒彈：火盆火焰
  const flames = [];
  if (fireB) {
    for (const [x, z] of [[-0.33, 0.33], [0.33, 0.33], [-0.33, -0.33]]) {
      const f = part('tw:catapult:flame', (b) => {
        b.cone(0.07, 0.2, 5, C.fire, {}, { top: C.flameCore, glow: 1.3, jit: 0.04 });
        b.cone(0.04, 0.12, 5, C.flameCore, { p: [0.03, 0, 0.02] }, { glow: 1.4, jit: 0 });
      }, { cast: false });
      f.position.set(x, 0.44, z);
      g.add(f);
      const h = halo(C.flame, 0.42, 0.55); h.position.set(x, 0.55, z); g.add(h);
      flames.push(f);
    }
  }

  let t = 0, ft = -1, shake = 0;
  const seed = Math.random() * 10;
  g.userData = {
    kind: 'tower', type: 'catapult', level: v,
    head, muzzle, height: v === 1 ? 0.95 : v === 2 ? 1.15 : v === 3 ? 1.35 : v === 'a' ? 1.85 : 1.4,
    fire() { ft = 0; },
    update(dt) {
      t += dt;
      if (ft >= 0) {
        ft += dt;
        const up = 0.13, hold = 0.22, back = big ? 1.0 : 0.7;
        let a;
        if (ft < up) { const e = ft / up; a = restA + (fireA - restA) * (1 - (1 - e) * (1 - e) * (1 - e)); }
        else if (ft < up + hold) a = fireA + Math.sin((ft - up) * 40) * 0.03 * (1 - (ft - up) / hold);
        else if (ft < up + hold + back) { const e = (ft - up - hold) / back; a = fireA + (restA - fireA) * (e * e * (3 - 2 * e)); }
        else { a = restA; ft = -1; }
        armPivot.rotation.x = a;
        ammo.visible = ft < 0 || ft < up * 0.8 || ft > up + hold + back * 0.85;
        if (ft > 0 && ft < up + 0.05) shake = 1;
      }
      if (cw) cw.rotation.x = -armPivot.rotation.x;
      if (shake > 0) { shake = Math.max(0, shake - dt * 6); rig.position.z = -Math.sin(shake * PI) * 0.03; rig.position.y = Math.abs(Math.sin(shake * PI * 2)) * 0.01; }
      for (let i = 0; i < flames.length; i++) {
        const f = flames[i], p = t * 9 + i * 2.1 + seed;
        f.scale.set(1 + Math.sin(p * 1.3) * 0.12, 1 + Math.sin(p) * 0.22 + Math.sin(p * 2.7) * 0.1, 1 + Math.cos(p * 1.1) * 0.12);
        f.rotation.y = t * 1.5 + i;
      }
    },
  };
  return g;
}

// ===========================================================================
// 法師塔
// ===========================================================================
function mageTower(v) {
  const g = new THREE.Group();
  const k = `tw:mage:${v}`;
  const lightning = v === 'a', frost = v === 'b';
  const st = lightning ? C.slate : frost ? C.stoneIce : C.stoneMage;
  const stL = lightning ? '#8d98ba' : frost ? C.snow : C.stoneMageLight;
  const stD = lightning ? C.slateDark : frost ? C.stoneIceDark : C.stoneMageDark;
  const orbColor = lightning ? C.lightning : frost ? C.frost : C.magic;
  const winGlow = lightning ? C.electric : frost ? C.frost : C.magicPink;
  const trim = lightning ? C.copper : frost ? C.frostDeep : v === 3 ? C.gold : C.roofPurple;
  let top, orbY, orbR;
  if (v === 1) { top = 0.64; orbY = 0.86; orbR = 0.115; }
  else if (v === 2) { top = 0.86; orbY = 1.09; orbR = 0.125; }
  else if (v === 3) { top = 1.04; orbY = 1.3; orbR = 0.135; }
  else { top = 1.2; orbY = 1.5; orbR = 0.15; }

  const base = part(k + ':base', (b) => {
    // 塔身（Lathe 有收腰）
    const rb = v === 1 ? 0.34 : v === 2 ? 0.37 : 0.4;
    const rt = v === 1 ? 0.25 : v === 2 ? 0.25 : 0.27;
    b.lathe([[0, 0], [rb, 0], [rb, 0.07], [rb - 0.05, 0.12], [rt + 0.02, top * 0.55], [rt, top - 0.08], [rt + 0.06, top - 0.03], [rt + 0.06, top], [0, top]], 8, st, {}, { top: stL, jit: 0.06, wob: 0.006 });
    // 門與窗
    b.box(0.12, 0.17, 0.05, C.woodDark, { p: [0, 0.04, rb - 0.06] });
    b.cylC(0.06, 0.06, 0.05, 6, C.woodDark, { p: [0, 0.21, rb - 0.06], r: [H2, 0, 0] });
    b.box(0.15, 0.03, 0.06, stD, { p: [0, 0.03, rb - 0.04] });
    const wins = v === 1 ? [[0, top * 0.62]] : [[0, top * 0.62], [PI * 0.7, top * 0.45], [-PI * 0.7, top * 0.45]];
    for (const [a, y] of wins) {
      const r = rt + 0.025 + (rb - rt) * (1 - y / top) * 0.45;
      b.boxC(0.06, 0.11, 0.04, winGlow, { p: [Math.sin(a) * r, y, Math.cos(a) * r], r: [0, a, 0] }, { glow: 1.0, jit: 0 });
      b.boxC(0.09, 0.025, 0.05, stD, { p: [Math.sin(a) * (r + 0.005), y - 0.06, Math.cos(a) * (r + 0.005)], r: [0, a, 0] });
    }
    // 色帶
    if (v >= 2 || typeof v === 'string') {
      const yb = top * 0.32, r = rb - 0.05 - (rb - 0.05 - rt - 0.02) * ((yb - 0.12) / (top * 0.55 - 0.12));
      b.cylC(r + 0.012, r + 0.018, 0.04, 8, trim, { p: [0, yb, 0], r: [0, PI / 8, 0] }, { shine: 0.6 });
    }
    b.cylC(rt + 0.075, rt + 0.075, 0.025, 8, trim, { p: [0, top - 0.04, 0], r: [0, PI / 8, 0] }, { shine: 0.6 });
    // 四根石尖
    const pr = rt + 0.02, pc = v === 3 ? C.gold : lightning ? C.copper : frost ? C.ice : '#d9c4ff';
    const pb = lightning ? C.slateDark : C.roofPurple;
    if (!lightning && !frost) b.cyl(rt + 0.06, rt + 0.13, 0.1, 8, C.roofPurple, { p: [0, top - 0.17, 0], r: [0, PI / 8, 0] }, { top: '#a888e6', jit: 0.06 });
    for (let i = 0; i < 4; i++) {
      const a = i / 4 * TAU + PI / 4;
      const hh = v === 1 ? 0.2 : v === 2 ? 0.26 : 0.3;
      if (!frost && !lightning) b.cone(0.05, hh, 4, pb, { p: [Math.sin(a) * pr, top, Math.cos(a) * pr], r: [Math.cos(a) * 0.28, 0, -Math.sin(a) * 0.28] }, { top: pc, shine: v === 3 || lightning ? 0.6 : 0 });
    }
    b.cyl(0.07, 0.1, 0.07, 6, stD, { p: [0, top, 0] });
    if (v === 3) {
      for (const a of [PI * 0.25, -PI * 0.25]) banner(b, Math.sin(a) * (rb - 0.02), top * 0.58, Math.cos(a) * (rb - 0.02), 0.12, 0.24, C.roofPurple, C.gold, a);
    }
    if (lightning) {
      // 銅線圈與避雷針
      for (const y of [top * 0.25, top * 0.5, top * 0.72]) {
        const r = rt + 0.02 + (rb - 0.05 - rt) * Math.max(0, 1 - y / (top * 0.55)) + 0.012;
        b.torus(r, 0.016, 3, 6, TAU, C.copper, { p: [0, y, 0], r: [H2, 0, 0] }, { shine: 0.7 });
      }
      for (let i = 0; i < 4; i++) {
        const a = i / 4 * TAU + PI / 4;
        const x = Math.sin(a) * (rt + 0.03), z = Math.cos(a) * (rt + 0.03);
        b.cyl(0.014, 0.02, 0.42, 5, C.copper, { p: [x, top, z], r: [Math.cos(a) * 0.35, 0, -Math.sin(a) * 0.35] }, { shine: 0.7 });
        const tx = x + Math.sin(a) * 0.42 * Math.sin(0.35), tz = z + Math.cos(a) * 0.42 * Math.sin(0.35);
        b.oct(0.04, C.lightning, { p: [tx, top + 0.42 * Math.cos(0.35), tz] }, { glow: 1.2 });
      }
      banner(b, 0, top * 0.6, rb - 0.02, 0.13, 0.26, C.blueDark, C.lightning, 0, C.copper);
    }
    if (frost) {
      // 冰晶簇與積雪
      const ice = (x, y, z, h, rx, rz, w = 0.05) => b.cone(w, h, 4, C.frostDeep, { p: [x, y, z], r: [rx, 0.4, rz] }, { top: C.ice, glow: 0.35, shine: 1, jit: 0.04 });
      for (let i = 0; i < 6; i++) {
        const a = i / 6 * TAU + 0.3, r = rt + 0.03;
        ice(Math.sin(a) * r, top - 0.02, Math.cos(a) * r, 0.22 + (i % 2) * 0.12, Math.cos(a) * 0.45, -Math.sin(a) * 0.45, 0.05 + (i % 2) * 0.015);
      }
      for (const [a, h] of [[0.5, 0.26], [1.2, 0.18], [2.8, 0.22], [4.2, 0.3], [5.4, 0.2]]) {
        const r = rb - 0.02;
        ice(Math.sin(a) * r, 0, Math.cos(a) * r, h, Math.cos(a) * 0.35, -Math.sin(a) * 0.35, 0.045);
      }
      b.cyl(rt + 0.07, rt + 0.08, 0.035, 8, C.snow, { p: [0, top, 0], r: [0, PI / 8, 0] }, { wob: 0.01 });
      b.cyl(rb - 0.035, rb + 0.01, 0.04, 8, C.snow, { p: [0, 0.07, 0], r: [0, PI / 8, 0] }, { wob: 0.012 });
      banner(b, 0, top * 0.6, rb - 0.02, 0.13, 0.26, C.frostDeep, C.white, 0, C.white);
    }
  }, { receive: true });
  g.add(base);

  // 漂浮的水晶球
  const orbG = pivot(0, orbY, 0); g.add(orbG);
  const orb = part(k + ':orb', (b) => {
    b.ico(orbR, 1, orbColor, {}, { glow: 0.9, shine: 1, jit: 0.1, top: lightning ? C.white : frost ? C.white : C.magicPink });
  }, { cast: false });
  orbG.add(orb);
  const orbHalo = halo(orbColor, orbR * 5, 0.6); orbG.add(orbHalo);
  const muzzle = new THREE.Object3D(); orbG.add(muzzle);

  // 環繞物：3 級的小水晶、連鎖閃電的電環、冰霜的冰片
  let orbit = null, rings = [];
  if (v === 3 || frost) {
    orbit = new THREE.Group(); orbG.add(orbit);
    orbit.add(part(k + ':orbit', (b) => {
      for (let i = 0; i < 3; i++) {
        const a = i / 3 * TAU;
        b.oct(0.04, frost ? C.ice : C.magicPink, { p: [Math.sin(a) * 0.24, (i - 1) * 0.04, Math.cos(a) * 0.24], s: [0.7, 1.4, 0.7] }, { glow: 0.7, shine: 1 });
      }
    }, { cast: false }));
  }
  if (lightning) {
    for (let i = 0; i < 2; i++) {
      const r = pivot(); r.rotation.set(i ? 1.1 : -0.5, 0, i ? 0.4 : 0.9);
      const spin = new THREE.Group(); r.add(spin);
      spin.add(part('tw:mage:a:ring' + i, (b) => {
        b.torus(i ? 0.25 : 0.21, 0.014, 3, 10, TAU, C.electric, {}, { glow: 1.3, jit: 0 });
        b.oct(0.03, C.white, { p: [i ? 0.25 : 0.21, 0, 0] }, { glow: 1.5, jit: 0 });
      }, { cast: false }));
      orbG.add(r); rings.push(spin);
    }
  }

  let t = Math.random() * 10, pulse = 0;
  g.userData = {
    kind: 'tower', type: 'mage', level: v,
    head: null, muzzle, height: orbY + orbR + 0.1,
    fire() { pulse = 1; },
    update(dt) {
      t += dt;
      if (pulse > 0) pulse = Math.max(0, pulse - dt * 3.5);
      orbG.position.y = orbY + Math.sin(t * 2) * 0.03;
      orb.rotation.y = t * 0.8; orb.rotation.x = t * 0.45;
      const s = 1 + pulse * 0.4;
      orb.scale.setScalar(s);
      const hs = orbR * (5 + Math.sin(t * 3) * 0.4 + pulse * 4);
      orbHalo.scale.set(hs, hs, 1);
      if (orbit) { orbit.rotation.y = -t * 1.4; orbit.position.y = Math.sin(t * 1.3) * 0.02; }
      for (let i = 0; i < rings.length; i++) rings[i].rotation.z = t * (i ? -2.6 : 3.4) * (1 + pulse * 2);
    },
  };
  return g;
}

// ===========================================================================
// 樹靈塔
// ===========================================================================
function canopyBlobs(b, blobs, col, top, o = {}) {
  blobs.forEach(([x, y, z, r, d], i) => {
    const t = { p: [x, y, z], s: o.s || 1, r: [0, i * 1.3, 0] }, oo = { top, wob: r * 0.12, jit: 0.08, seed: Math.round(x * 100 + z * 10) };
    if (d === 1 || (d === undefined && i === 0)) b.ico(r, 1, col, t, oo);
    else if (d === 0) b.ico(r, 0, col, t, oo);
    else b.dodec(r, col, t, oo);
  });
}
function treantTower(v) {
  const g = new THREE.Group();
  const k = `tw:treant:${v}`;
  const thorn = v === 'a', ancient = v === 'b';
  const cfg = {
    1: { th: 0.5, rt: 0.14, rb: 0.21, cy: 0.5, faceY: 0.25 },
    2: { th: 0.62, rt: 0.16, rb: 0.24, cy: 0.62, faceY: 0.31 },
    3: { th: 0.74, rt: 0.18, rb: 0.27, cy: 0.74, faceY: 0.38 },
    a: { th: 0.86, rt: 0.17, rb: 0.27, cy: 0.86, faceY: 0.42 },
    b: { th: 0.92, rt: 0.23, rb: 0.36, cy: 0.9, faceY: 0.42 },
  }[v];
  const bark = thorn ? '#5e3b3e' : ancient ? '#7d5a3e' : C.trunk;
  const barkTop = thorn ? '#7a4a4e' : ancient ? '#a07a52' : '#a87650';
  const eye = thorn ? C.eyeRed : ancient ? C.eyeGold : C.eyeGreen;

  const base = part(k + ':base', (b) => {
    // 根
    const nR = ancient ? 7 : 5;
    for (let i = 0; i < nR; i++) {
      const a = i / nR * TAU + 0.4;
      const L = (ancient ? 0.3 : 0.19) + (i % 2) * 0.05;
      b.cone(cfg.rb * 0.5, L, 5, bark, { p: [Math.sin(a) * cfg.rb * 0.65, 0.05, Math.cos(a) * cfg.rb * 0.65], r: [1.3, a, 0], o: 'YXZ' }, { jit: 0.08, wob: 0.01 });
    }
    // 樹幹
    b.cyl(cfg.rt, cfg.rb, cfg.th, 7, bark, {}, { top: barkTop, wob: 0.014, jit: 0.08 });
    treeFace(b, cfg.faceY, cfg.rb - (cfg.rb - cfg.rt) * (cfg.faceY / cfg.th) - 0.01, ancient ? 1.35 : v === 1 ? 1 : 1.15, eye, thorn ? '#3a2226' : C.trunkDark);
    if (ancient) {
      // 苔鬚
      for (const [x, y, z, h] of [[-0.12, 0.62, 0.2, 0.16], [0.14, 0.58, 0.19, 0.2], [0.02, 0.5, 0.25, 0.1]]) b.coneC(0.035, h, 4, C.moss, { p: [x, y - h / 2, z], r: [PI, 0, 0] }, { top: C.leafLight });
    }
    if (v === 2 || v === 3 || ancient) {
      const n = ancient ? 4 : 6, R = ancient ? 0.4 : 0.36;
      for (let i = 0; i < n; i++) {
        const a = i / n * TAU + 0.2;
        b.ico(0.06 + (i % 3) * 0.012, 0, C.stone, { p: [Math.sin(a) * R, 0.03, Math.cos(a) * R], s: [1, 0.7, 1] }, { top: C.moss, wob: 0.01 });
      }
    }
    if (v === 3 || ancient) {
      // 符文石
      for (let i = 0; i < 4; i++) {
        const a = i / 4 * TAU + PI / 4, R = ancient ? 0.43 : 0.38;
        b.box(0.07, 0.2, 0.05, C.stoneDark, { p: [Math.sin(a) * R, 0, Math.cos(a) * R], r: [0, a, 0] }, { top: C.stone, wob: 0.006 });
        b.boxC(0.03, 0.06, 0.02, ancient ? C.eyeGold : C.eyeGreen, { p: [Math.sin(a) * (R + 0.027), 0.12, Math.cos(a) * (R + 0.027)], r: [0, a, 0] }, { glow: 1.2, jit: 0 });
      }
      // 蘑菇
      if (!ancient) for (const [a, s] of [[1.9, 1], [2.3, 0.7], [-2.1, 0.85]]) {
        const x = Math.sin(a) * 0.26, z = Math.cos(a) * 0.26;
        b.cyl(0.018 * s, 0.022 * s, 0.07 * s, 5, C.cream, { p: [x, 0, z] });
        b.cone(0.06 * s, 0.05 * s, 6, C.roofRed, { p: [x, 0.065 * s, z] });
      }
    }
    if (thorn) {
      // 荊棘藤圈
      for (let i = 0; i < 2; i++) b.torus(0.33 + i * 0.03, 0.024, 3, 8, TAU * 0.45, '#3f6a32', { p: [0, 0.05 + i * 0.03, 0], r: [H2, 0, i * 3.1] });
      for (let i = 0; i < 9; i++) {
        const a = i / 9 * TAU, R = 0.34 + (i % 3) * 0.02;
        b.cone(0.022, 0.1, 3, '#7a2a35', { p: [Math.sin(a) * R, 0.05, Math.cos(a) * R], r: [Math.cos(a) * 0.9, 0, -Math.sin(a) * 0.9] }, { top: '#e0606a' });
      }
      // 樹幹尖刺
      for (let i = 0; i < 4; i++) {
        const a = i / 4 * TAU + 0.5, y = 0.15 + (i % 3) * 0.2, r = cfg.rb - (cfg.rb - cfg.rt) * (y / cfg.th);
        b.cone(0.025, 0.1, 3, '#7a2a35', { p: [Math.sin(a) * r, y, Math.cos(a) * r], r: [Math.cos(a) * H2, 0, -Math.sin(a) * H2] }, { top: '#e0606a' });
      }
    }
  }, { receive: true });
  g.add(base);

  // 樹冠（擺動）
  const crown = pivot(0, cfg.cy, 0); g.add(crown);
  const leaf = thorn ? '#3f6b3c' : ancient ? '#7cbf4a' : C.leaf;
  const leafTop = thorn ? '#6d8f4a' : ancient ? C.leafGold : C.leafLight;
  crown.add(part(k + ':crown', (b) => {
    if (v === 1) canopyBlobs(b, [[0, 0.2, 0, 0.27], [-0.17, 0.08, 0.06, 0.17, 0], [0.16, 0.1, -0.06, 0.18, 0]], leaf, leafTop);
    else if (v === 2) {
      canopyBlobs(b, [[0, 0.24, 0, 0.3], [-0.2, 0.1, 0.05, 0.19, 0], [0.19, 0.12, -0.05, 0.2, 0], [0.02, 0.1, -0.2, 0.18, 0]], leaf, leafTop);
      for (const [x, y, z] of [[0.12, 0.44, 0.12], [-0.16, 0.3, 0.17], [0.22, 0.25, 0.1], [-0.05, 0.4, -0.18]]) b.oct(0.04, C.petalPink, { p: [x, y, z] }, { glow: 0.15 });
    } else if (v === 3) {
      canopyBlobs(b, [[0, 0.28, 0, 0.33], [-0.23, 0.12, 0.06, 0.21], [0.22, 0.14, -0.05, 0.22], [0.03, 0.1, -0.23, 0.2, 0], [0.04, 0.5, 0.04, 0.17, 0]], leaf, leafTop);
      for (const [x, y, z] of [[0.18, 0.4, 0.2], [-0.24, 0.3, 0.16], [0.28, 0.2, 0.1], [-0.08, 0.56, -0.12], [0.05, 0.22, 0.32]]) b.oct(0.032, C.lampGlow, { p: [x, y, z] }, { glow: 1.3, jit: 0 });
    } else if (thorn) {
      canopyBlobs(b, [[0, 0.3, 0, 0.32], [-0.22, 0.14, 0.04, 0.22], [0.21, 0.16, -0.04, 0.22], [0, 0.56, 0, 0.18, 0]], leaf, leafTop);
      // 滿滿的尖刺
      const spikes = [];
      for (let i = 0; i < 18; i++) {
        const u = (i * 0.618) % 1, w = i / 18;
        const a = u * TAU, el = (w - 0.3) * 1.6;
        spikes.push([a, el]);
      }
      for (const [a, el] of spikes) {
        const R = 0.33, cx = Math.sin(a) * Math.cos(el) * R, cz = Math.cos(a) * Math.cos(el) * R, cy = 0.3 + Math.sin(el) * R;
        const dir = new THREE.Vector3(cx, cy - 0.3, cz).normalize();
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
        const e = new THREE.Euler().setFromQuaternion(q);
        b.cone(0.035, 0.16, 3, '#7a2a35', { p: [cx * 0.9, cy - 0.03, cz * 0.9], r: [e.x, e.y, e.z] }, { top: '#ff7a80' });
      }
      for (const [x, y, z] of [[0.15, 0.45, 0.22], [-0.2, 0.2, 0.25], [0.26, 0.3, 0.05]]) b.oct(0.05, '#d8345a', { p: [x, y, z] }, { glow: 0.5 });
    } else {
      // 古樹：寬闊層層樹冠
      canopyBlobs(b, [[0, 0.22, 0, 0.42], [-0.32, 0.1, 0.08, 0.26], [0.32, 0.12, -0.06, 0.27], [0.05, 0.08, -0.3, 0.25], [0.03, 0.1, 0.3, 0.24], [0, 0.55, 0, 0.27]], leaf, leafTop, { s: [1, 0.72, 1] });
      for (const [x, y, z] of [[0.3, 0.3, 0.2], [-0.28, 0.35, 0.18], [0.1, 0.5, 0.3], [-0.1, 0.58, -0.25], [0.36, 0.18, -0.2]]) b.oct(0.055, C.leafOrange, { p: [x, y, z], s: [1, 1.2, 1] }, { glow: 0.1 });
      for (const [x, y, z, h] of [[0.3, -0.02, 0.2, 0.2], [-0.32, -0.02, 0.1, 0.24], [0.05, -0.04, 0.34, 0.16], [-0.1, -0.04, -0.3, 0.2]]) b.coneC(0.04, h, 4, C.moss, { p: [x, y - h / 2, z], r: [PI, 0, 0] }, { top: C.leafLight });
    }
  }));

  // 兩根手臂樹枝
  const arms = [];
  for (const sx of [-1, 1]) {
    const ay = cfg.th * 0.62;
    const ar = cfg.rb - (cfg.rb - cfg.rt) * 0.62;
    const p = pivot(sx * ar, ay, 0); g.add(p);
    p.add(part(`${k}:arm`, (b) => {
      const L = ancient ? 0.3 : 0.22;
      b.cyl(0.022, 0.04, L, 5, bark, { r: [0, 0, -1.0] }, { top: barkTop });
      const ex = Math.sin(1.0) * L, ey = Math.cos(1.0) * L;
      b.ico(ancient ? 0.12 : 0.09, 0, leaf, { p: [ex + 0.02, ey + 0.03, 0] }, { top: leafTop, wob: 0.01 });
      if (thorn) b.cone(0.022, 0.1, 3, '#7a2a35', { p: [ex, ey + 0.05, 0], r: [0, 0, -0.5] }, { top: '#ff7a80' });
    }));
    p.scale.x = sx;
    arms.push(p);
  }
  const muzzle = new THREE.Object3D(); muzzle.position.y = 0.25; crown.add(muzzle);
  let glowH = null;
  if (v === 3 || ancient) { glowH = halo(ancient ? C.eyeGold : C.eyeGreen, 0.9, 0.18); glowH.position.y = 0.3; crown.add(glowH); }

  let t = Math.random() * 10, pulse = 0;
  g.userData = {
    kind: 'tower', type: 'treant', level: v,
    head: null, muzzle, height: cfg.cy + (ancient ? 0.75 : thorn ? 0.78 : v === 3 ? 0.72 : v === 2 ? 0.58 : 0.5),
    fire() { pulse = 1; },
    update(dt) {
      t += dt;
      if (pulse > 0) pulse = Math.max(0, pulse - dt * 2.2);
      const p = Math.sin(pulse * PI);
      crown.rotation.z = Math.sin(t * 1.3) * 0.045;
      crown.rotation.x = Math.sin(t * 1.05 + 1) * 0.03;
      crown.scale.set(1 + p * 0.1, 1 - p * 0.08, 1 + p * 0.1);
      crown.position.y = cfg.cy + p * 0.04;
      for (let i = 0; i < 2; i++) {
        const a = arms[i];
        a.rotation.z = (i ? 1 : -1) * (Math.sin(t * 1.7 + i * 1.3) * 0.12 + p * 0.55);
        a.rotation.x = Math.sin(t * 1.2 + i) * 0.08;
      }
    },
  };
  return g;
}

// ===========================================================================
const BUILD = { archer: archerTower, catapult: catapultTower, mage: mageTower, treant: treantTower };

/** makeTower(type, level 1–3, branch null|'a'|'b') */
export function makeTower(type, level = 1, branch = null) {
  const fn = BUILD[type] || BUILD.archer;
  const v = branch === 'a' || branch === 'b' ? branch : clamp(level | 0 || 1, 1, 3);
  const g = fn(v);
  g.name = `tower:${type}:${v}`;
  return g;
}
