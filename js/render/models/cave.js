// 第二章洞窟裝飾（擁有者：B）：石筍、發光蘑菇、洞窟水晶、礦車鐵軌，以及第一章裝飾的洞窟版。
// 格式同 decor.js 的 DEF：{ n, rot, scale, build(b, r, v), glow?(b, r, v), extra?(g, v, mesh, glowMesh) }
//   build：一般零件（MAT.vc，會被黑暗效果變暗）；glow：自發光零件（MAT.glow，noDark）
import * as THREE from 'three';
import { C, MAT, halo, haloOwn } from '../palette.js';
import { PI, TAU, damp } from './lib.js';

const H2 = PI / 2;
const rr = (r, a, b) => a + (b - a) * r();
const pick = (r, arr) => arr[Math.floor(r() * arr.length) % arr.length];

const STONES = [[C.caveStone, C.caveStoneLight], [C.caveStoneDark, C.caveStone], ['#6a6480', '#9a92b0'], ['#56708a', '#8aa8c0'], [C.caveStoneWarm, '#a49cb4'], [C.caveStoneDark, C.caveStoneLight]];

/** 有機感的尖錐（石筍），底在 y=0 */
function spike(b, x, z, r, h, col, top, seed, tilt = 0, ry = 0) {
  b.lathe([[r, 0], [r * 0.82, h * 0.28], [r * 0.55, h * 0.58], [r * 0.26, h * 0.84], [0.004, h]], 6, col, { p: [x, -0.02, z], r: [tilt, ry, tilt * 0.5] }, { top, wob: r * 0.09, jit: 0.08, seed });
}
/** 蘑菇傘（lathe），底在 y=0 */
function cap(b, x, y, z, cr, col, top, o = {}) {
  b.lathe([[cr, 0], [cr * 0.95, cr * 0.3], [cr * 0.7, cr * 0.62], [cr * 0.35, cr * 0.82], [0, cr * 0.88]], o.seg || 7, col, { p: [x, y, z], r: [o.tx || 0, o.ry || 0, o.tz || 0] }, { top, glow: o.glow || 0, jit: 0.05 });
}

export const CAVE_DEF = {
  // 石筍／鐘乳石（X）
  stalagmite: {
    n: 6, rot: true, scale: [0.85, 1.2],
    build(b, r, v) {
      const [c0, c1] = STONES[v];
      b.dodec(0.2, C.caveStoneDark, { p: [0, 0, 0], s: [1.4, 0.35, 1.3] }, { top: c0, wob: 0.03, seed: v });
      if (v === 0) { spike(b, 0, 0, 0.17, 0.95, c0, c1, 1); spike(b, 0.17, 0.08, 0.08, 0.36, c0, c1, 2, 0.2); spike(b, -0.14, -0.1, 0.07, 0.28, c0, c1, 3, -0.2); }
      else if (v === 1) { for (let i = 0; i < 3; i++) { const a = i / 3 * TAU + 0.4; spike(b, Math.sin(a) * 0.11, Math.cos(a) * 0.11, rr(r, 0.09, 0.12), rr(r, 0.45, 0.7), c0, c1, 4 + i, rr(r, -0.15, 0.15)); } }
      else if (v === 2) { spike(b, -0.08, 0, 0.13, 0.8, c0, c1, 7, -0.08); spike(b, 0.1, 0.03, 0.11, 0.62, c0, c1, 8, 0.1); }
      else if (v === 3) { b.dodec(0.22, c0, { p: [0, 0.08, 0], s: [1.1, 0.7, 1] }, { top: c1, wob: 0.03 }); for (let i = 0; i < 4; i++) { const a = i / 4 * TAU; spike(b, Math.sin(a) * 0.13, Math.cos(a) * 0.13, 0.06, rr(r, 0.2, 0.36), c0, c1, 9 + i, Math.cos(a) * 0.3, a); } }
      else if (v === 4) { spike(b, 0, 0, 0.19, 1.1, c0, c1, 13); b.ico(0.025, 0, '#cfe8ff', { p: [0, 1.06, 0] }, { shine: 1, jit: 0 }); spike(b, 0.15, -0.1, 0.07, 0.3, c0, c1, 14, 0.25); }
      else { b.cyl(0.13, 0.17, 0.34, 6, c0, {}, { top: c1, wob: 0.02 }); b.cyl(0.11, 0.13, 0.04, 6, c1, { p: [0, 0.33, 0] }, { wob: 0.01 }); spike(b, -0.15, 0.1, 0.07, 0.3, c0, c1, 15, -0.2); }
    },
  },
  // 發光蘑菇（U）：一叢青／青綠／紫色會發光的蘑菇（傘是 noDark）
  glowshroom: {
    n: 4, rot: true, scale: [0.85, 1.15], dynamic: true,
    cols: [[C.glowCyan, C.glowCyanCore], [C.glowTeal, '#d8fff0'], [C.glowViolet, C.glowVioletCore], [C.glowCyan, C.glowVioletCore]],
    layout(r) {
      const n = 3 + Math.floor(r() * 3), out = [];
      for (let i = 0; i < n; i++) {
        const big = i === 0 ? 1.25 : rr(r, 0.45, 0.85);
        const a = r() * TAU, d = i === 0 ? 0 : rr(r, 0.12, 0.22);
        out.push({ x: Math.sin(a) * d, z: Math.cos(a) * d, h: 0.2 * big, cr: 0.12 * big, tx: rr(r, -0.18, 0.18), tz: rr(r, -0.18, 0.18), ry: r() * TAU });
      }
      return out;
    },
    build(b, r, v) {
      b.dodec(0.16, C.caveStoneDark, { s: [1.4, 0.3, 1.3] }, { top: C.caveMoss, wob: 0.02 });
      for (const m of this.layout(r)) b.cyl(m.cr * 0.2, m.cr * 0.28, m.h, 5, '#c8d2e4', { p: [m.x, 0, m.z], r: [m.tx, 0, m.tz] }, { top: '#eef4ff' });
    },
    glow(b, r, v) {
      const [c0, c1] = this.cols[v];
      this.layout(r).forEach((m, i) => {
        const col = v === 3 && i % 2 ? C.glowViolet : c0;
        // 傘的位置沿著傾斜的菇柄頂端
        const tx = m.x - Math.sin(m.tz) * m.h, tz = m.z + Math.sin(m.tx) * m.h, ty = m.h * Math.cos(m.tx) * Math.cos(m.tz);
        cap(b, tx, ty - 0.01, tz, m.cr, col, c1, { tx: m.tx, tz: m.tz, ry: m.ry, glow: 1.1, seg: 6 });
        b._tmp(new THREE.CircleGeometry(m.cr * 0.94, 6).rotateX(H2), col, { p: [tx, ty - 0.012, tz], r: [m.tx, 0, m.tz] }, { glow: 0.55 });
        if (i < 2) for (let k = 0; k < 3; k++) { const aa = k / 3 * TAU + m.ry; b.oct(m.cr * 0.16, C.white, { p: [tx + Math.sin(aa) * m.cr * 0.5, ty + m.cr * 0.5, tz + Math.cos(aa) * m.cr * 0.5], s: [1, 0.5, 1] }, { glow: 1.3, jit: 0 }); }
      });
    },
    extra(g, v) {
      const col = [C.glowCyan, C.glowTeal, C.glowViolet, '#9ad8ff'][v];
      const h = halo(col, 1.0, 0.32); h.position.y = 0.24; g.add(h);
      // 飄起來的孢子
      const spores = [];
      for (let i = 0; i < 1; i++) { const s = halo(col, 0.06, 0.9); g.add(s); spores.push(s); }
      let t = Math.random() * 10;
      g.userData.update = (dt) => {
        t += dt;
        const k = 1 + Math.sin(t * 1.6) * 0.06;
        h.scale.set(k, k, 1);
        for (let i = 0; i < spores.length; i++) {
          const f = (t * 0.18 + i * 0.5) % 1;
          spores[i].position.set(Math.sin(t * 0.7 + i * 3) * 0.12, 0.2 + f * 0.6, Math.cos(t * 0.6 + i * 2) * 0.12);
          spores[i].material.opacity = 0.9;
          spores[i].visible = f < 0.9;
        }
      };
    },
  },
  // 洞窟水晶（C）：岩座上的一簇水晶；userData.setLit(on) 被照到時變亮（光的中繼），沒照到時微弱發光
  cavecrystal: {
    n: 4, rot: true, scale: [0.9, 1.15], dynamic: true,
    cols: [[C.glowCyan, C.glowCyanCore], [C.glowViolet, C.glowVioletCore], [C.glowTeal, '#dcfff0'], ['#7aa8ff', '#e6eeff']],
    build(b, r, v) {
      b.dodec(0.17, C.caveStoneDark, { p: [0, 0.03, 0], s: [1.4, 0.55, 1.25] }, { top: C.caveStone, wob: 0.02 });
      b.dodec(0.08, C.caveStone, { p: [0.16, 0.02, 0.1] }, { wob: 0.01 });
    },
    glow(b, r, v) {
      const [cc, ct] = this.cols[v];
      const n = 4 + Math.floor(r() * 3);
      for (let i = 0; i < n; i++) {
        const a = i / n * TAU + r() * 0.6, d = i === 0 ? 0 : rr(r, 0.07, 0.14);
        const h = i === 0 ? rr(r, 0.42, 0.55) : rr(r, 0.16, 0.32), w = i === 0 ? 0.07 : rr(r, 0.035, 0.055);
        const tilt = i === 0 ? rr(r, -0.1, 0.1) : rr(r, 0.3, 0.65);
        const t = { p: [Math.sin(a) * d, 0.04, Math.cos(a) * d], r: [Math.cos(a) * tilt, r() * TAU, -Math.sin(a) * tilt], o: 'XZY' };
        b._tmp(new THREE.CylinderGeometry(w, w * 1.08, h, 6, 1).translate(0, h / 2, 0), cc, t, { top: ct, glow: 0.9, shine: 1, jit: 0.06 });
        b._tmp(new THREE.ConeGeometry(w, w * 2.3, 6, 1).translate(0, h + w * 1.15, 0), ct, t, { glow: 1.1, shine: 1, jit: 0.05 });
      }
    },
    extra(g, v, mesh, glowMesh) {
      const col = this.cols[v][0];
      const h = haloOwn(col, 1.0, 0.5); h.position.y = 0.3; g.add(h);
      let lit = false, k = 0, t = Math.random() * 10;
      glowMesh.material = MAT.glowDim;
      g.userData.lit = false;
      g.userData.setLit = (on) => { on = !!on; if (on === lit) return; lit = on; g.userData.lit = on; glowMesh.material = on ? MAT.glow : MAT.glowDim; };
      g.userData.update = (dt) => {
        t += dt;
        k = damp(k, lit ? 1 : 0, 5, dt);
        const s = (0.75 + k * 0.55) * (1 + Math.sin(t * 2.2) * 0.05);
        h.scale.set(s, s, 1);
        h.material.opacity = 0.14 + k * 0.42;
      };
      g.userData.update(0);
    },
  },
  // 礦車與鐵軌（Q）：軌道沿 x 軸橫跨整格（-0.5～0.5），相鄰格會接起來；不隨機旋轉（直向請轉 90°）
  minecart: {
    n: 3, rot: false, scale: [1, 1],
    build(b, r, v) {
      for (const x of [-0.34, 0, 0.34]) b.box(0.09, 0.03, 0.48, C.caveWoodDark, { p: [x + rr(r, -0.02, 0.02), 0, 0], r: [0, rr(r, -0.06, 0.06), 0] }, { top: C.caveWood, jit: 0.08 });
      for (const z of [-0.15, 0.15]) {
        b.box(1.0, 0.035, 0.035, C.iron, { p: [0, 0.03, z] }, { top: C.steel, shine: 0.6 });
      }
      if (v === 2) { b.dodec(0.09, C.caveStone, { p: [0.12, 0.05, 0.3] }, { top: C.caveStoneLight, wob: 0.01 }); return; }
      const tip = v === 1 ? 0.12 : 0;
      const y0 = 0.1;
      // 車斗（上寬下窄）
      b.lathe([[0.0, 0], [0.2, 0], [0.27, 0.24], [0.25, 0.24], [0.18, 0.03], [0, 0.03]], 4, C.rust, { p: [0, y0, 0], r: [0, PI / 4, tip], s: [1, 1, 0.8] }, { top: C.rustLight, jit: 0.12, shine: 0.3 });
      b.boxC(0.5, 0.03, 0.03, C.ironDark, { p: [0, y0 + 0.23, 0.175], r: [0, 0, tip] }, { shine: 0.5 });
      b.boxC(0.5, 0.03, 0.03, C.ironDark, { p: [0, y0 + 0.23, -0.175], r: [0, 0, tip] }, { shine: 0.5 });
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.cylC(0.065, 0.065, 0.03, 7, C.ironDark, { p: [sx * 0.14, 0.085, sz * 0.15], r: [H2, 0, 0] }, { shine: 0.5 });
      if (v === 0) {
        for (const [x, z, s] of [[-0.06, 0.02, 0.09], [0.08, -0.04, 0.08], [0.02, 0.07, 0.07], [-0.1, -0.06, 0.06]]) b.dodec(s, pick(r, [C.caveStone, C.caveStoneLight, '#7d86a0']), { p: [x, y0 + 0.24, z] }, { wob: 0.01 });
        b.oct(0.04, C.crystal, { p: [0.12, y0 + 0.28, 0.06], s: [0.8, 1.4, 0.8] }, { shine: 1 });
      }
    },
  },
};

// 第一章裝飾的洞窟版（theme === 'cave' 時由 makeDecor 換過來）
export const CAVE_ALT = {
  rock: 'caveRock', bush: 'caveFern', mushroom: 'caveFungus', tree: 'caveBigShroom', pine: 'stalagmite', crystal: 'cavecrystal',
  grassTuft: 'cavePebbles', flower: 'caveSprouts', grave: 'caveGrave', lamppost: 'caveLampOff', fence: 'caveFence',
};
export const CAVE_ALT_DEF = {
  caveRock: {
    n: 6, rot: true, scale: [0.8, 1.3],
    build(b, r, v) {
      const [c0, c1] = STONES[v];
      const n = v < 2 ? 1 : 1 + Math.floor(r() * 3);
      for (let i = 0; i < n; i++) {
        const s = i === 0 ? rr(r, 0.16, 0.22) : rr(r, 0.07, 0.12);
        const a = r() * TAU, d = i === 0 ? 0 : rr(r, 0.16, 0.24), sy = rr(r, 0.55, 0.9);
        b.dodec(s, c0, { p: [Math.sin(a) * d, s * sy * 0.7, Math.cos(a) * d], r: [r(), r() * TAU, r()], s: [1, sy, 1] }, { top: c1, wob: s * 0.14, jit: 0.08, seed: v * 7 + i });
      }
      if (v === 1 || v === 4) b.ico(0.11, 0, C.caveMoss, { p: [0.02, 0.15, 0.0], s: [1.2, 0.3, 1] }, { top: C.caveMossLight, wob: 0.015 });
    },
  },
  caveFern: {
    n: 4, rot: true, scale: [0.85, 1.2],
    build(b, r, v) {
      const [c0, c1] = [[C.caveMoss, C.caveMossLight], ['#3a5a6e', '#7aa0b8'], ['#4a6a5a', '#9ac0a0'], ['#4a4a6e', '#9a9ac8']][v];
      b.ico(0.1, 0, c0, { p: [0, 0.03, 0], s: [1.3, 0.45, 1.3] }, { top: c1, wob: 0.015 });
      const n = 6 + Math.floor(r() * 3);
      for (let i = 0; i < n; i++) {
        const a = i / n * TAU + r() * 0.4, el = rr(r, 0.5, 0.95), L = rr(r, 0.18, 0.28);
        b.cone(0.04, L, 3, c0, { p: [Math.sin(a) * 0.04, 0.03, Math.cos(a) * 0.04], r: [Math.cos(a) * el, 0, -Math.sin(a) * el], s: [1.6, 1, 0.5] }, { top: c1, jit: 0.06 });
      }
    },
  },
  caveFungus: {
    n: 4, rot: true, scale: [0.8, 1.25],
    build(b, r, v) {
      const [c0, c1] = [['#8a6a8a', '#c8a8c0'], ['#6e7494', '#aab0d0'], ['#9a7a5a', '#d0b090'], ['#7a6a9a', '#b8a8e0']][v];
      const n = 1 + Math.floor(r() * 3);
      for (let i = 0; i < n; i++) {
        const big = i === 0 ? 1 : rr(r, 0.5, 0.75);
        const a = r() * TAU, d = i === 0 ? 0 : rr(r, 0.1, 0.17);
        const x = Math.sin(a) * d, z = Math.cos(a) * d, h = 0.12 * big, cr = 0.1 * big;
        b.cyl(0.022 * big, 0.03 * big, h, 6, '#b8b4c4', { p: [x, 0, z] }, { top: '#d8d4e4' });
        cap(b, x, h - 0.005, z, cr, c0, c1, { ry: r() * TAU });
        b.cyl(cr * 0.92, cr * 0.98, 0.01, 7, '#5a5068', { p: [x, h - 0.012, z] });
      }
    },
  },
  caveBigShroom: {
    n: 3, rot: true, scale: [0.85, 1.15],
    build(b, r, v) {
      const [c0, c1] = [['#6a5a8a', '#a898c8'], ['#5a6a8a', '#98a8c8'], ['#7a5a6a', '#c098a8']][v];
      b.dodec(0.14, C.caveStoneDark, { s: [1.4, 0.35, 1.3] }, { top: C.caveMoss, wob: 0.02 });
      b.cyl(0.06, 0.09, 0.62, 6, '#b8b4c8', { r: [0.06, 0, 0.04] }, { top: '#dcd8ea', wob: 0.008 });
      cap(b, 0.02, 0.58, 0.01, 0.36, c0, c1, { tx: 0.06, tz: -0.04 });
      b.cyl(0.33, 0.35, 0.02, 7, '#4a4058', { p: [0.02, 0.575, 0.01], r: [0.06, 0, -0.04] });
      for (let i = 0; i < 5; i++) { const a = i / 5 * TAU + v; b.ico(0.04, 0, '#e8e0f4', { p: [Math.sin(a) * 0.2, 0.83 - (i % 2) * 0.04, Math.cos(a) * 0.2], s: [1, 0.45, 1] }, { jit: 0 }); }
      // 旁邊的小菇
      b.cyl(0.02, 0.025, 0.1, 5, '#b8b4c8', { p: [0.16, 0, 0.1] });
      cap(b, 0.16, 0.095, 0.1, 0.07, c0, c1);
    },
  },
  cavePebbles: {
    n: 4, rot: true, scale: [0.8, 1.3], noShadow: true,
    build(b, r, v) {
      const n = 3 + Math.floor(r() * 3);
      for (let i = 0; i < n; i++) {
        const a = r() * TAU, d = rr(r, 0, 0.12), s = rr(r, 0.025, 0.05);
        const [c0, c1] = pick(r, STONES);
        b.ico(s, 0, c0, { p: [Math.sin(a) * d, s * 0.4, Math.cos(a) * d], s: [1, 0.6, 1], r: [0, r() * TAU, 0] }, { top: c1, jit: 0.06 });
      }
      if (v % 2) b.ico(0.05, 0, C.caveMoss, { p: [0.03, 0.01, 0.02], s: [1.3, 0.3, 1.1] }, { top: C.caveMossLight });
    },
  },
  caveSprouts: {
    n: 4, rot: true, scale: [0.85, 1.2], noShadow: true,
    build(b, r, v) {
      const c0 = ['#c8c0e0', '#b8d8e0', '#e0c8d8', '#c8d8c8'][v];
      const n = 3 + Math.floor(r() * 3);
      for (let i = 0; i < n; i++) {
        const a = r() * TAU, d = i === 0 ? 0 : rr(r, 0.04, 0.1), h = rr(r, 0.05, 0.1);
        const x = Math.sin(a) * d, z = Math.cos(a) * d;
        b.cyl(0.006, 0.008, h, 3, '#d8d4e4', { p: [x, 0, z] }, { jit: 0 });
        b.cone(0.022, 0.02, 5, c0, { p: [x, h, z] }, { jit: 0.04 });
      }
    },
  },
  caveGrave: {
    n: 3, rot: true, rotJitter: 0.5, scale: [0.9, 1.1],
    build(b, r, v) {
      const st = pick(r, [C.caveStone, C.caveStoneDark, C.caveStoneWarm]);
      b.dodec(0.14, C.caveStoneDeep, { p: [0, 0, 0.1], s: [1, 0.3, 1.5] }, { top: C.caveStoneDark, wob: 0.01 });
      const tilt = rr(r, -0.15, 0.15);
      if (v === 0) {
        b.box(0.22, 0.24, 0.07, st, { p: [0, 0, -0.06], r: [tilt * 0.5, 0, tilt] }, { top: C.caveStoneLight, wob: 0.004 });
        b.cylC(0.11, 0.11, 0.07, 8, st, { p: [0, 0.24, -0.06], r: [H2 + tilt * 0.5, 0, tilt] }, { top: C.caveStoneLight });
      } else if (v === 1) {
        b.box(0.06, 0.4, 0.06, st, { p: [0, 0, -0.06], r: [tilt, 0, tilt * 0.5] }, { top: C.caveStoneLight });
        b.boxC(0.24, 0.06, 0.06, st, { p: [0, 0.3, -0.06 + tilt * 0.3], r: [tilt, 0, tilt * 0.5] }, { top: C.caveStoneLight });
      } else {
        b.box(0.24, 0.16, 0.07, st, { p: [0, 0, -0.06], r: [-0.4, 0, 0.25] }, { top: C.caveStoneLight, wob: 0.006 });
        b.box(0.12, 0.08, 0.06, st, { p: [0.15, 0, 0.12], r: [0, 0.5, 0.6] }, { wob: 0.006 });
      }
      b.ico(0.05, 0, C.caveMoss, { p: [-0.1, 0.03, 0.0], s: [1.2, 0.6, 1] }, { top: C.caveMossLight });
    },
  },
  caveLampOff: {
    // 熄掉的舊礦燈柱（不發光，免得被當成光源）
    n: 2, rot: true, scale: [1, 1],
    build(b, r, v) {
      b.cyl(0.09, 0.1, 0.06, 6, C.caveStoneDark, {}, { top: C.caveStone });
      b.box(0.07, 0.8, 0.07, C.caveWoodDark, { p: [0, 0.04, 0], r: [0, 0, v ? 0.06 : -0.04] }, { top: C.caveWood });
      b.boxC(0.26, 0.05, 0.05, C.caveWoodDark, { p: [0.08, 0.8, 0] }, { top: C.caveWood });
      b.cylC(0.005, 0.005, 0.08, 4, C.ironDark, { p: [0.18, 0.74, 0] });
      b.cyl(0.05, 0.05, 0.1, 6, '#3a4050', { p: [0.18, 0.6, 0] }, { shine: 0.4 });
      b.cone(0.06, 0.05, 6, C.ironDark, { p: [0.18, 0.7, 0] }, { shine: 0.4 });
      b.cyl(0.055, 0.055, 0.015, 6, C.ironDark, { p: [0.18, 0.59, 0] });
    },
  },
  caveFence: {
    // 礦坑木柵（沿 x 軸橫跨整格，不隨機旋轉）
    n: 2, rot: false, scale: [1, 1],
    build(b, r, v) {
      for (const x of [-0.4, 0, 0.4]) {
        const tilt = rr(r, -0.06, 0.06);
        b.box(0.07, 0.34, 0.07, C.caveWoodDark, { p: [x, 0, 0], r: [tilt, 0, rr(r, -0.05, 0.05)] }, { top: C.caveWood });
      }
      for (const y of [0.12, 0.25]) b.boxC(1.0, 0.05, 0.035, C.caveWood, { p: [0, y + rr(r, -0.01, 0.01), 0.04], r: [0, 0, rr(r, -0.03, 0.03)] });
      if (v === 1) b.torus(0.06, 0.012, 3, 6, TAU, C.rope, { p: [0.4, 0.3, 0.05], r: [H2, 0, 0] });
    },
  },
};
