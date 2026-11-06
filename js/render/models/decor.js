// 裝飾模型（擁有者：B）：makeDecor(kind, rng)
// 每種裝飾預先做幾個「變體」geometry（快取共用），rng 決定用哪個變體＋旋轉＋縮放，
// 所以同種裝飾全部共用少數幾份 geometry，而且全部都是 MAT.vc，場景代理可以依材質合併成少量 mesh。
// 例外（不要合併）：userData.animated = true 的 mesh（風車葉片），以及 Sprite（光暈）。
import * as THREE from 'three';
import { C, halo } from '../palette.js';
import { part, mulberry32, PI, TAU } from './lib.js';

const H2 = PI / 2;
const pick = (r, arr) => arr[Math.floor(r() * arr.length) % arr.length];
const rr = (r, a, b) => a + (b - a) * r();

// ---------------------------------------------------------------------------
// 各種裝飾的變體建構（r = 該變體自己的決定性亂數）
// ---------------------------------------------------------------------------
const LEAVES = [[C.leaf, C.leafLight], [C.leafDark, C.leaf], ['#86c94a', '#cfe86a'], [C.leaf, C.leafYellow], ['#e99a48', '#f7d36a'], ['#f2a2c6', '#ffe0ee']];

const DEF = {
  tree: {
    n: 6, rot: true, scale: [0.85, 1.15],
    build(b, r, v) {
      const [lc, lt] = LEAVES[v % LEAVES.length];
      const th = rr(r, 0.3, 0.4);
      b.cyl(0.05, 0.08, th, 6, C.trunk, {}, { top: '#a87650', wob: 0.006 });
      for (let i = 0; i < 3; i++) { const a = i / 3 * TAU + r(); b.cone(0.035, 0.12, 4, C.trunk, { p: [Math.sin(a) * 0.05, 0.02, Math.cos(a) * 0.05], r: [Math.cos(a) * 1.2, 0, -Math.sin(a) * 1.2] }); }
      b.cyl(0.02, 0.03, 0.14, 4, C.trunk, { p: [0.03, th - 0.06, 0], r: [0, 0, -0.7] });
      const cy = th + 0.18;
      b.ico(rr(r, 0.24, 0.28), 1, lc, { p: [0, cy, 0] }, { top: lt, wob: 0.025, jit: 0.07, seed: v });
      const nb = 2 + Math.floor(r() * 2);
      for (let i = 0; i < nb; i++) {
        const a = r() * TAU, d = rr(r, 0.15, 0.22);
        b.ico(rr(r, 0.13, 0.18), i === 0 ? 1 : 0, lc, { p: [Math.sin(a) * d, cy + rr(r, -0.1, 0.12), Math.cos(a) * d] }, { top: lt, wob: 0.015, jit: 0.07, seed: v * 10 + i });
      }
      if (v === 1 || v === 3) for (let i = 0; i < 4; i++) { const a = r() * TAU; b.ico(0.025, 0, v === 1 ? C.red : C.petalWhite, { p: [Math.sin(a) * 0.24, cy + rr(r, -0.05, 0.15), Math.cos(a) * 0.24] }); }
    },
  },
  pine: {
    n: 5, rot: true, scale: [0.85, 1.2],
    build(b, r, v) {
      b.cyl(0.04, 0.06, 0.22, 5, C.trunkDark, {}, { top: C.trunk });
      const cols = [[C.pineDark, C.pine], [C.pine, C.pineLight], ['#2f8a6a', '#5cb88f'], [C.pineDark, '#4f9a62'], [C.pine, C.pineLight]][v];
      let y = 0.14, rad = rr(r, 0.29, 0.33), h = 0.32;
      for (let i = 0; i < 3; i++) {
        b.cone(rad, h, 7, cols[0], { p: [0, y, 0], r: [0, r() * TAU, 0] }, { top: cols[1], wob: 0.012, jit: 0.06, seed: v * 5 + i });
        y += h * 0.55; rad *= 0.76; h *= 0.88;
      }
      if (v === 4) b.cone(0.09, 0.08, 7, C.snow, { p: [0, y + 0.06, 0] });
    },
  },
  rock: {
    n: 6, rot: true, scale: [0.8, 1.3],
    build(b, r, v) {
      const cols = [[C.stone, C.stoneLight], [C.stoneDark, C.stone], ['#a9a49c', '#cfcac2'], ['#9aa3ad', '#c4ccd4'], [C.stoneWarm, '#ece0c8'], [C.stoneDark, C.stone]][v];
      const n = v < 2 ? 1 : 1 + Math.floor(r() * 3);
      for (let i = 0; i < n; i++) {
        const s = i === 0 ? rr(r, 0.16, 0.22) : rr(r, 0.07, 0.12);
        const a = r() * TAU, d = i === 0 ? 0 : rr(r, 0.16, 0.24);
        const sy = rr(r, 0.55, 0.85);
        if (r() < 0.5) b.dodec(s, cols[0], { p: [Math.sin(a) * d, s * sy * 0.7, Math.cos(a) * d], r: [r(), r() * TAU, r()], s: [1, sy, 1] }, { top: cols[1], wob: s * 0.12, jit: 0.07, seed: v * 7 + i });
        else b.ico(s, 0, cols[0], { p: [Math.sin(a) * d, s * sy * 0.7, Math.cos(a) * d], r: [r(), r() * TAU, r()], s: [1, sy, 1] }, { top: cols[1], wob: s * 0.12, jit: 0.07, seed: v * 7 + i });
      }
      if (v === 1 || v === 5) b.ico(0.12, 0, C.moss, { p: [0.02, 0.15, 0.0], s: [1.2, 0.3, 1] }, { top: C.leafLight, wob: 0.015 });
    },
  },
  mushroom: {
    n: 6, rot: true, scale: [0.8, 1.25],
    build(b, r, v) {
      const caps = [[C.roofRed, C.white, 0], [C.roofRed, C.white, 0], ['#a070e0', '#f0d8ff', 0.15], ['#5ab8f0', '#d8f4ff', 0.6], [C.roofOrange, C.cream, 0], ['#c060d8', '#ffd0ff', 0.6]][v];
      const n = v === 1 ? 1 : 1 + Math.floor(r() * 3);
      for (let i = 0; i < n; i++) {
        const big = v === 1 ? 2.1 : i === 0 ? 1 : rr(r, 0.5, 0.75);
        const a = r() * TAU, d = i === 0 ? 0 : rr(r, 0.1, 0.17);
        const x = Math.sin(a) * d, z = Math.cos(a) * d, h = 0.12 * big, cr = 0.09 * big;
        b.cyl(0.022 * big, 0.03 * big, h, 6, C.cream, { p: [x, 0, z], r: [rr(r, -0.15, 0.15), 0, rr(r, -0.15, 0.15)] }, { top: C.white });
        b.lathe([[cr, 0], [cr * 0.95, cr * 0.3], [cr * 0.7, cr * 0.62], [cr * 0.35, cr * 0.82], [0, cr * 0.88]], 8, caps[0], { p: [x, h - 0.005, z], r: [0, r() * TAU, 0] }, { top: caps[0], glow: caps[2], jit: 0.05 });
        b.cyl(cr * 0.92, cr * 0.98, 0.01, 8, caps[1], { p: [x, h - 0.012, z] });
        for (let k = 0; k < 3; k++) { const aa = k / 3 * TAU + r(); b.ico(cr * 0.16, 0, caps[1], { p: [x + Math.sin(aa) * cr * 0.55, h + cr * 0.45, z + Math.cos(aa) * cr * 0.55], s: [1, 0.5, 1] }, { glow: caps[2] * 0.8, jit: 0 }); }
      }
    },
  },
  house: {
    n: 5, rot: true, scale: [0.95, 1.05],
    build(b, r, v) {
      const roof = [C.roofRed, C.roofBlue, C.roofTeal, C.roofOrange, C.roofPurple][v];
      const wall = [C.cream, C.white, '#f3e3c3', C.cream, '#ecdcc4'][v];
      const W = 0.46, D = 0.52, Hh = 0.34;
      b.box(W + 0.06, 0.06, D + 0.06, C.cobble, {}, { wob: 0.006 });
      b.box(W, Hh, D, wall, { p: [0, 0.06, 0] }, { jit: 0.04 });
      // 木框
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(0.04, Hh, 0.04, C.woodDark, { p: [sx * W / 2, 0.06, sz * D / 2] });
      for (const sz of [-1, 1]) b.box(W + 0.02, 0.035, 0.035, C.woodDark, { p: [0, 0.06 + Hh - 0.02, sz * D / 2] });
      for (const sx of [-1, 1]) b.box(0.035, 0.035, D + 0.02, C.woodDark, { p: [sx * W / 2, 0.06 + Hh - 0.02, 0] });
      // 山牆＋屋頂（屋脊沿 z，山牆朝前）
      b.prism(W, 0.22, D - 0.02, wall, { p: [0, 0.06 + Hh, 0] });
      const rh = 0.27, rw = W + 0.16;
      const slope = Math.atan2(rh, rw / 2), L = Math.hypot(rh, rw / 2) + 0.02;
      for (const sx of [-1, 1]) {
        b.boxC(L, 0.045, D + 0.12, roof, { p: [sx * (rw / 4), 0.06 + Hh + rh / 2 - 0.0, 0], r: [0, 0, -sx * slope] }, { top: roof, jit: 0.07 });
      }
      b.boxC(0.05, 0.05, D + 0.14, C.woodDark, { p: [0, 0.06 + Hh + rh - 0.005, 0] });
      // 煙囪
      b.box(0.08, 0.26, 0.08, C.stoneDark, { p: [0.12, 0.06 + Hh + 0.05, -0.12] }, { top: C.stone, wob: 0.004 });
      // 門、窗（夜晚發光）
      b.box(0.11, 0.18, 0.03, C.woodRed, { p: [-0.08, 0.06, D / 2 + 0.005] });
      b.boxC(0.02, 0.02, 0.02, C.gold, { p: [-0.045, 0.15, D / 2 + 0.022] }, { shine: 1 });
      b.boxC(0.11, 0.09, 0.02, C.windowGlow, { p: [0.11, 0.24, D / 2 + 0.006] }, { glow: 0.85, jit: 0 });
      b.boxC(0.13, 0.025, 0.03, C.woodDark, { p: [0.11, 0.185, D / 2 + 0.01] });
      b.boxC(0.012, 0.09, 0.025, C.woodDark, { p: [0.11, 0.24, D / 2 + 0.012] });
      b.cylC(0.04, 0.04, 0.02, 8, C.windowGlow, { p: [0, 0.06 + Hh + 0.09, D / 2 - 0.004], r: [H2, 0, 0] }, { glow: 0.85, jit: 0 });
      for (const sx of [-1, 1]) {
        b.boxC(0.02, 0.09, 0.11, C.windowGlow, { p: [sx * (W / 2 + 0.005), 0.24, 0.02] }, { glow: 0.85, jit: 0 });
        b.boxC(0.03, 0.025, 0.13, C.woodDark, { p: [sx * (W / 2 + 0.01), 0.185, 0.02] });
      }
      // 花箱
      b.box(0.13, 0.035, 0.04, C.woodDark, { p: [0.11, 0.155, D / 2 + 0.03] });
      for (const x of [0.07, 0.11, 0.15]) b.ico(0.022, 0, pick(r, [C.petalPink, C.petalRed, C.petalYellow]), { p: [x, 0.2, D / 2 + 0.035] });
      if (v % 2 === 0) b.ico(0.08, 0, C.leafDark, { p: [-0.24, 0.05, 0.24], s: [1, 0.8, 1] }, { top: C.leaf });
    },
  },
  windmill: {
    n: 2, rot: true, scale: [0.95, 1.05],
    build(b, r, v) {
      const wall = v ? C.stoneWarm : C.cream, roof = v ? C.roofBlue : C.roofRed;
      b.cyl(0.33, 0.34, 0.06, 8, C.cobble, { r: [0, PI / 8, 0] }, { wob: 0.006 });
      b.cyl(0.19, 0.29, 0.86, 8, wall, { p: [0, 0.06, 0], r: [0, PI / 8, 0] }, { top: v ? '#efe2c8' : C.white, jit: 0.04 });
      b.cylC(0.25, 0.25, 0.04, 8, C.woodDark, { p: [0, 0.47, 0], r: [0, PI / 8, 0] });
      b.cone(0.27, 0.3, 8, roof, { p: [0, 0.9, 0], r: [0, PI / 8, 0] }, { top: roof === C.roofRed ? '#f08a78' : '#88b0ec' });
      b.box(0.12, 0.2, 0.03, C.woodDark, { p: [0, 0.06, 0.28] });
      b.boxC(0.07, 0.09, 0.03, C.windowGlow, { p: [0, 0.65, 0.215] }, { glow: 0.85, jit: 0 });
      b.boxC(0.06, 0.08, 0.03, C.windowGlow, { p: [0.19, 0.3, 0.17], r: [0, 0.8, 0] }, { glow: 0.85, jit: 0 });
      b.cylC(0.045, 0.045, 0.12, 6, C.woodDark, { p: [0, 0.92, 0.24], r: [H2, 0, 0] });
    },
    extra(g, v) {
      // 葉片（自己會轉）
      const blades = part('decor:windmill:blades:' + v, (b) => {
        b.cylC(0.06, 0.06, 0.05, 6, C.gold, { r: [H2, 0, 0] }, { shine: 1 });
        for (let i = 0; i < 4; i++) {
          const a = i / 4 * TAU;
          const t = { r: [0, 0, a] };
          b._tmp(new THREE.BoxGeometry(0.03, 0.62, 0.025).translate(0, 0.33, 0), C.woodDark, t);
          b._tmp(new THREE.BoxGeometry(0.13, 0.42, 0.012).translate(0.075, 0.4, 0.012), v ? C.cream : '#f7e9cf', t, { jit: 0.04 });
          for (const y of [0.25, 0.4, 0.55]) b._tmp(new THREE.BoxGeometry(0.15, 0.012, 0.02).translate(0.075, y, 0.015), C.woodDark, t, { jit: 0 });
        }
      });
      blades.position.set(0, 0.92, 0.31);
      blades.userData.animated = true;
      const phase = Math.random() * TAU, speed = 0.7 + Math.random() * 0.3;
      blades.onBeforeRender = function () {
        this.rotation.z = -(performance.now() / 1000) * speed + phase;
        this.updateMatrixWorld();
      };
      g.add(blades);
    },
  },
  fence: {
    n: 3, rot: false, scale: [1, 1],
    build(b, r, v) {
      const post = v === 2 ? C.white : C.woodDark, rail = v === 2 ? C.cream : C.wood;
      for (const x of [-0.4, 0, 0.4]) {
        const tilt = rr(r, -0.06, 0.06);
        b.box(0.06, 0.3, 0.06, post, { p: [x, 0, 0], r: [tilt, 0, rr(r, -0.04, 0.04)] }, { top: v === 2 ? C.white : C.wood });
        b.cone(0.045, 0.06, 4, post, { p: [x, 0.3, 0], r: [tilt, PI / 4, 0] });
      }
      for (const y of [0.1, 0.22]) {
        if (v === 1 && y > 0.2) {
          b.boxC(0.5, 0.045, 0.03, rail, { p: [-0.25, y, 0.035], r: [0, 0, 0.02] });
          b.boxC(0.32, 0.045, 0.03, rail, { p: [0.38, y - 0.06, 0.035], r: [0, 0, -0.35] });
        } else b.boxC(1.0, 0.045, 0.03, rail, { p: [0, y + rr(r, -0.01, 0.01), 0.035], r: [0, 0, rr(r, -0.02, 0.02)] });
      }
      if (v === 0) b.ico(0.05, 0, C.leafDark, { p: [0.2, 0.03, 0.08], s: [1.3, 0.7, 1] }, { top: C.leaf });
    },
  },
  grave: {
    n: 5, rot: true, rotJitter: 0.5, scale: [0.9, 1.1],
    build(b, r, v) {
      const st = pick(r, [C.stone, C.stoneDark, '#a9a4b4']);
      b.dodec(0.14, '#7a6450', { p: [0, 0.0, 0.1], s: [1, 0.3, 1.5] }, { top: '#8f7a5c', wob: 0.01 });
      const tilt = rr(r, -0.12, 0.12);
      if (v === 0 || v === 3) {
        b.box(0.22, 0.24, 0.07, st, { p: [0, 0, -0.06], r: [tilt * 0.5, 0, tilt] }, { top: C.stoneLight, wob: 0.004 });
        b.cylC(0.11, 0.11, 0.07, 8, st, { p: [0, 0.24, -0.06], r: [H2 + tilt * 0.5, 0, tilt] }, { top: C.stoneLight });
        b.boxC(0.1, 0.02, 0.01, C.stoneDeep, { p: [0, 0.2, -0.02], r: [0, 0, tilt] }, { jit: 0 });
        b.boxC(0.02, 0.08, 0.01, C.stoneDeep, { p: [0, 0.2, -0.02], r: [0, 0, tilt] }, { jit: 0 });
      } else if (v === 1) {
        b.box(0.06, 0.4, 0.06, st, { p: [0, 0, -0.06], r: [tilt, 0, tilt * 0.5] }, { top: C.stoneLight });
        b.boxC(0.24, 0.06, 0.06, st, { p: [0, 0.3, -0.06 + tilt * 0.3], r: [tilt, 0, tilt * 0.5] }, { top: C.stoneLight });
      } else if (v === 2) {
        b.box(0.14, 0.06, 0.14, st, { p: [0, 0, -0.08] });
        b.cone(0.07, 0.42, 4, st, { p: [0, 0.06, -0.08], r: [0, PI / 4, 0] }, { top: C.stoneLight });
      } else {
        b.box(0.24, 0.16, 0.07, st, { p: [0, 0, -0.06], r: [-0.4, 0, 0.25] }, { top: C.stoneLight, wob: 0.006 });
        b.box(0.12, 0.08, 0.06, st, { p: [0.15, 0, 0.12], r: [0, 0.5, 0.6] }, { wob: 0.006 });
      }
      if (v === 3 || v === 1) {
        b.cyl(0.018, 0.02, 0.06, 5, C.cream, { p: [0.12, 0.02, 0.06] });
        b.ico(0.016, 0, C.flame, { p: [0.12, 0.095, 0.06], s: [1, 1.5, 1] }, { glow: 1.5, jit: 0 });
      }
      b.ico(0.05, 0, C.moss, { p: [-0.1, 0.03, 0.0], s: [1.2, 0.6, 1] }, { top: C.leafLight });
    },
  },
  dock: {
    n: 3, rot: false, scale: [1, 1],
    build(b, r, v) {
      for (let i = 0; i < 5; i++) {
        const z = -0.4 + i * 0.2;
        b.box(1.0, 0.05, 0.18, i % 2 ? C.wood : C.woodLight, { p: [rr(r, -0.01, 0.01), -0.02, z], r: [0, rr(r, -0.015, 0.015), 0] }, { jit: 0.08 });
      }
      for (const sz of [-1, 1]) b.box(1.0, 0.06, 0.06, C.woodDark, { p: [0, -0.08, sz * 0.42] });
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        b.cyl(0.045, 0.05, 0.9, 6, C.woodDark, { p: [sx * 0.44, -0.8, sz * 0.42] }, { top: C.wood });
        b.ico(0.03, 0, C.rope, { p: [sx * 0.44, 0.03, sz * 0.42] });
      }
      if (v === 0) b.torus(0.07, 0.025, 3, 8, TAU, C.rope, { p: [0.25, 0.05, 0.15], r: [H2, 0, 0] });
      if (v === 1) {
        b.cyl(0.08, 0.075, 0.18, 8, C.woodRed, { p: [-0.28, 0.03, -0.2] }, { top: C.wood });
        for (const y of [0.06, 0.17]) b.cylC(0.083, 0.083, 0.02, 8, C.iron, { p: [-0.28, y, -0.2] });
        b.box(0.16, 0.14, 0.16, C.woodLight, { p: [-0.1, 0.03, -0.28], r: [0, 0.3, 0] });
      }
    },
  },
  bush: {
    n: 6, rot: true, scale: [0.85, 1.2],
    build(b, r, v) {
      const [lc, lt] = [[C.leafDark, C.leaf], [C.leaf, C.leafLight], ['#5aa860', '#9ad87a'], [C.leafDark, C.leafYellow], [C.leaf, C.leafLight], ['#4f9a52', '#8acb6a']][v];
      const n = 2 + Math.floor(r() * 3);
      for (let i = 0; i < n; i++) {
        const a = r() * TAU, d = i === 0 ? 0 : rr(r, 0.08, 0.16), s = i === 0 ? rr(r, 0.14, 0.17) : rr(r, 0.08, 0.12);
        b.ico(s, i === 0 ? 1 : 0, lc, { p: [Math.sin(a) * d, s * 0.7, Math.cos(a) * d], s: [1, 0.85, 1] }, { top: lt, wob: s * 0.1, jit: 0.07, seed: v * 3 + i });
      }
      if (v === 1 || v === 4) {
        const col = v === 1 ? C.red : C.petalPink;
        for (let i = 0; i < 6; i++) { const a = r() * TAU, el = rr(r, 0.1, 1.1); b.ico(0.022, 0, col, { p: [Math.sin(a) * Math.cos(el) * 0.15, 0.1 + Math.sin(el) * 0.12, Math.cos(a) * Math.cos(el) * 0.15] }, { glow: v === 4 ? 0.1 : 0 }); }
      }
    },
  },
  crystal: {
    n: 5, rot: true, scale: [0.85, 1.2],
    build(b, r, v) {
      const [cc, ct] = [['#58c8f0', '#d6f6ff'], ['#a77cf0', '#eedcff'], ['#f07cc8', '#ffe0f4'], ['#5ce0b0', '#dcfff0'], ['#7aa0ff', '#e0e8ff']][v];
      b.dodec(0.12, C.stoneDark, { p: [0, 0.02, 0], s: [1.3, 0.45, 1.2] }, { top: C.stone, wob: 0.015 });
      const n = 3 + Math.floor(r() * 3);
      for (let i = 0; i < n; i++) {
        const a = i / n * TAU + r() * 0.6, d = i === 0 ? 0 : rr(r, 0.06, 0.12);
        const h = i === 0 ? rr(r, 0.32, 0.42) : rr(r, 0.14, 0.26), w = i === 0 ? 0.055 : rr(r, 0.03, 0.045);
        const tilt = i === 0 ? rr(r, -0.1, 0.1) : rr(r, 0.3, 0.6);
        const t = { p: [Math.sin(a) * d, 0.02, Math.cos(a) * d], r: [Math.cos(a) * tilt, r() * TAU, -Math.sin(a) * tilt], o: 'XZY' };
        b._tmp(new THREE.CylinderGeometry(w, w * 1.05, h, 6, 1).translate(0, h / 2, 0), cc, t, { top: ct, glow: 0.55, shine: 1, jit: 0.06 });
        b._tmp(new THREE.ConeGeometry(w, w * 2.2, 6, 1).translate(0, h + w * 1.1, 0), ct, t, { glow: 0.7, shine: 1, jit: 0.05 });
      }
    },
    extra(g, v) {
      const col = ['#58c8f0', '#a77cf0', '#f07cc8', '#5ce0b0', '#7aa0ff'][v];
      const h = halo(col, 0.75, 0.35); h.position.y = 0.22; g.add(h);
    },
  },
  lamppost: {
    n: 2, rot: true, scale: [1, 1],
    build(b, r, v) {
      b.cyl(0.09, 0.1, 0.08, 6, C.stoneDark, {}, { top: C.stone });
      b.cyl(0.03, 0.035, 0.76, 6, C.ironDark, { p: [0, 0.08, 0] }, { shine: 0.5 });
      b.cylC(0.045, 0.045, 0.03, 6, C.gold, { p: [0, 0.2, 0] }, { shine: 1 });
      if (v === 0) {
        // 頂上一盞燈
        b.cyl(0.07, 0.05, 0.03, 6, C.ironDark, { p: [0, 0.84, 0] });
        b.cyl(0.055, 0.055, 0.12, 6, C.windowGlow, { p: [0, 0.87, 0] }, { glow: 1.3, jit: 0 });
        for (let i = 0; i < 3; i++) { const a = i / 3 * TAU; b.box(0.012, 0.13, 0.012, C.ironDark, { p: [Math.sin(a) * 0.058, 0.86, Math.cos(a) * 0.058] }); }
        b.cone(0.09, 0.08, 6, C.ironDark, { p: [0, 0.99, 0] }, { shine: 0.5 });
        b.ico(0.02, 0, C.gold, { p: [0, 1.08, 0] }, { shine: 1 });
      } else {
        // 彎鉤吊燈
        b.torus(0.12, 0.014, 3, 8, PI, C.ironDark, { p: [0.12, 0.84, 0], r: [0, 0, 0] });
        b.cylC(0.006, 0.006, 0.06, 4, C.ironDark, { p: [0.24, 0.81, 0] });
        b.cone(0.06, 0.05, 6, C.ironDark, { p: [0.24, 0.73, 0] });
        b.cyl(0.04, 0.045, 0.1, 6, C.windowGlow, { p: [0.24, 0.63, 0] }, { glow: 1.3, jit: 0 });
        b.cyl(0.05, 0.05, 0.02, 6, C.ironDark, { p: [0.24, 0.62, 0] });
      }
    },
    extra(g, v) {
      const h = halo(C.lampGlow, 0.55, 0.45); h.position.set(v ? 0.24 : 0, v ? 0.68 : 0.93, 0); g.add(h);
    },
  },
  flower: {
    n: 8, rot: true, scale: [0.85, 1.2], noShadow: true,
    build(b, r, v) {
      const cols = [C.petalPink, C.petalYellow, C.petalWhite, C.petalPurple, C.petalRed, C.petalBlue];
      const n = 3 + Math.floor(r() * 3);
      for (let i = 0; i < n; i++) {
        const a = r() * TAU, d = i === 0 ? 0 : rr(r, 0.05, 0.12), h = rr(r, 0.07, 0.14);
        const x = Math.sin(a) * d, z = Math.cos(a) * d;
        const col = v < 6 ? cols[(v + (i % 2)) % cols.length] : pick(r, cols);
        b.cyl(0.006, 0.008, h, 3, C.grassDark, { p: [x, 0, z] }, { jit: 0 });
        b.cylC(0.032, 0.032, 0.014, 5, col, { p: [x, h, z], r: [rr(r, -0.3, 0.3), r() * TAU, rr(r, -0.3, 0.3)] }, { jit: 0.04 });
        b.boxC(0.016, 0.016, 0.016, col === C.petalYellow ? C.roofOrange : C.petalYellow, { p: [x, h + 0.01, z] }, { jit: 0 });
        if (i < 2) b.coneC(0.018, 0.06, 3, C.grass, { p: [x + 0.02, 0.03, z], r: [0, 0, -0.8] }, { jit: 0 });
      }
    },
  },
  grassTuft: {
    n: 6, rot: true, scale: [0.8, 1.3], noShadow: true,
    build(b, r, v) {
      const [gc, gt] = [[C.grassDark, C.grassLight], [C.grassDark, C.grass], ['#5aa046', '#a8dc72'], [C.grassDark, C.leafYellow], [C.grass, C.grassLight], ['#5c9e4a', '#9fd06a']][v];
      const n = 4 + Math.floor(r() * 3);
      for (let i = 0; i < n; i++) {
        const a = r() * TAU, d = rr(r, 0, 0.05), h = rr(r, 0.09, 0.17);
        b.cone(0.016, h, 3, gc, { p: [Math.sin(a) * d, 0, Math.cos(a) * d], r: [Math.cos(a) * rr(r, 0.1, 0.45), r() * TAU, -Math.sin(a) * rr(r, 0.1, 0.45)] }, { top: gt, jit: 0.04 });
      }
    },
  },
};

// ---------------------------------------------------------------------------
/** makeDecor(kind, rng)：kind 見 架構.md §6；rng() 回傳 0–1 */
export function makeDecor(kind, rng = Math.random) {
  const def = DEF[kind] || DEF.bush;
  const k = DEF[kind] ? kind : 'bush';
  const v = Math.floor(rng() * def.n) % def.n;
  const g = new THREE.Group();
  g.name = `decor:${k}`;
  const m = part(`decor:${k}:${v}`, (b) => def.build(b, mulberry32(1000 + v * 97 + k.length * 13), v), {
    receive: k === 'house' || k === 'windmill' || k === 'dock', cast: !def.noShadow, seed: v + 1,
  });
  g.add(m);
  def.extra?.(g, v);
  if (def.rot) g.rotation.y = rng() * TAU;
  else g.rotation.y = (rng() - 0.5) * 0.04;
  if (def.rotJitter) g.rotation.y = (rng() - 0.5) * def.rotJitter;
  const s = def.scale[0] + (def.scale[1] - def.scale[0]) * rng();
  g.scale.setScalar(s);
  g.userData = { kind: 'decor', type: k, variant: v };
  return g;
}
export const DECOR_KINDS = Object.keys(DEF);
export const DECOR_VARIANTS = Object.fromEntries(Object.entries(DEF).map(([k, d]) => [k, d.n]));
