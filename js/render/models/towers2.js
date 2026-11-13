// 第二章的塔：燈籠（lantern 1–3）、水晶稜鏡塔（prism 1–3＋分支 a 分光／b 聚焦）（擁有者：B）
// 自發光部分（燈籠紙、稜鏡水晶）是獨立 mesh，材質 MAT.glow（userData.noDark = true）；
// setLit(false) 時換成 MAT.glowOff（熄滅／變暗），光暈跟著淡掉。不使用 PointLight（光照由 C 的黑暗效果處理）。
import * as THREE from 'three';
import { C, MAT, haloOwn } from '../palette.js';
import { part, glowPart, pivot, PI, TAU, damp } from './lib.js';

const H2 = PI / 2;

/** 把一組發光 mesh 在亮／暗材質之間切換 */
function glowSwitch(meshes, onMat = MAT.glow, offMat = MAT.glowOff) {
  let cur = true;
  return (on) => {
    if (on === cur) return;
    cur = on;
    for (const m of meshes) m.material = on ? onMat : offMat;
  };
}

// ===========================================================================
// 燈籠：石座＋木柱＋紅色紙燈籠（越高級越大越精緻）
// ===========================================================================
const LANTERN = {
  1: { cy: 0.6, r: 0.115, h: 0.22, height: 0.86, halo: 0.95 },
  2: { cy: 0.74, r: 0.12, h: 0.24, height: 1.02, halo: 1.1 },
  3: { cy: 0.92, r: 0.145, h: 0.28, height: 1.3, halo: 1.35 },
};

/** 紙燈籠的發光紙身（lathe，中心在 y＝cy） */
function paperBody(b, r, h, cy, color = C.lanternPaper) {
  const pts = [[r * 0.42, -h / 2], [r * 0.82, -h * 0.4], [r, -h * 0.16], [r, h * 0.16], [r * 0.82, h * 0.4], [r * 0.42, h / 2]];
  b.lathe(pts, 7, color, { p: [0, cy, 0] }, { glow: 0.95, jit: 0.03, top: '#ffd890' });
}
/** 開口的圓環帶（只有側面，三角形少） */
function band(b, r, h, seg, col, t, o) { return b._tmp(new THREE.CylinderGeometry(r, r, h, seg, 1, true), col, t, o); }
/** 紙燈籠的紅色上下蓋與竹骨（不發光），cy＝燈籠中心高度 */
function paperFrame(b, cy, r, h, gold = false) {
  const red = C.lanternRed, redD = C.lanternRedDark;
  b.cyl(r * 0.5, r * 0.48, h * 0.12, 6, redD, { p: [0, cy - h / 2 - h * 0.1, 0] }, { top: red });
  b.cyl(r * 0.44, r * 0.5, h * 0.12, 6, red, { p: [0, cy + h / 2 - h * 0.02, 0] }, { top: redD });
  for (const f of [-0.28, 0.28]) band(b, r * 1.01 - Math.abs(f) * r * 0.25, 0.014, 7, redD, { p: [0, cy + f * h, 0] }, { jit: 0 });
  if (gold) {
    band(b, r * 0.52, 0.02, 6, C.gold, { p: [0, cy + h / 2 + h * 0.1, 0] }, { shine: 1 });
    // 流蘇
    b.cone(0.03, 0.09, 5, C.gold, { p: [0, cy - h / 2 - h * 0.1, 0], r: [PI, 0, 0] }, { shine: 0.6 });
  }
}

function lanternTower(v) {
  const g = new THREE.Group();
  const k = `tw:lantern:${v}`;
  const cfg = LANTERN[v];
  const { cy, r, h } = cfg;
  g.add(part(k + ':base', (b) => {
    if (v === 1) {
      // 方石座＋木柱
      b.box(0.36, 0.1, 0.36, C.stoneDark, { r: [0, PI / 4, 0], s: [1, 1, 1] }, { top: C.stone, wob: 0.01 });
      b.box(0.26, 0.06, 0.26, C.stone, { p: [0, 0.1, 0] }, { top: C.stoneLight, wob: 0.006 });
      b.box(0.07, cy - h / 2 - 0.16, 0.07, C.woodDark, { p: [0, 0.16, 0] }, { top: C.wood });
      b.box(0.16, 0.025, 0.16, C.ironDark, { p: [0, cy - h / 2 - 0.04, 0] }, { shine: 0.4 });
      paperFrame(b, cy, r, h);
      // 提把
      b.torus(0.04, 0.008, 3, 6, PI, C.ironDark, { p: [0, cy + h / 2 + 0.03, 0] });
    } else if (v === 2) {
      // 兩層石座＋木柱＋小屋頂
      b.cyl(0.3, 0.33, 0.1, 6, C.stoneDark, {}, { top: C.stone, wob: 0.01 });
      b.cyl(0.22, 0.24, 0.1, 6, C.stone, { p: [0, 0.1, 0], r: [0, PI / 6, 0] }, { top: C.stoneLight, wob: 0.006 });
      b.box(0.08, cy - h / 2 - 0.22, 0.08, C.woodDark, { p: [0, 0.2, 0] }, { top: C.wood });
      band(b, 0.06, 0.03, 6, C.gold, { p: [0, 0.32, 0] }, { shine: 1 });
      b.cyl(0.11, 0.09, 0.03, 6, C.ironDark, { p: [0, cy - h / 2 - 0.05, 0] }, { shine: 0.4 });
      paperFrame(b, cy, r, h, true);
      b.cone(r * 1.25, 0.1, 6, C.lanternRedDark, { p: [0, cy + h / 2 + 0.03, 0] }, { top: C.lanternRed });
      b.ico(0.025, 0, C.gold, { p: [0, cy + h / 2 + 0.15, 0] }, { shine: 1 });
    } else {
      // 三層雕花石座＋石柱＋金屋頂；石座四角有小光石
      b.cyl(0.38, 0.4, 0.1, 8, C.stoneDark, { r: [0, PI / 8, 0] }, { top: C.stone, wob: 0.01 });
      b.cyl(0.3, 0.32, 0.1, 8, C.stone, { p: [0, 0.1, 0], r: [0, PI / 8, 0] }, { top: C.stoneLight, wob: 0.008 });
      band(b, 0.315, 0.025, 8, C.gold, { p: [0, 0.19, 0], r: [0, PI / 8, 0] }, { shine: 1 });
      b.lathe([[0.13, 0], [0.09, 0.06], [0.07, 0.12], [0.07, cy - h / 2 - 0.36], [0.11, cy - h / 2 - 0.3], [0, cy - h / 2 - 0.3]], 5, C.stoneLight, { p: [0, 0.2, 0] }, { top: C.white, jit: 0.05 });
      b.cyl(0.14, 0.11, 0.05, 6, C.ironDark, { p: [0, cy - h / 2 - 0.1, 0] }, { shine: 0.5 });
      paperFrame(b, cy, r, h, true);
      b.cone(r * 1.4, 0.14, 6, C.goldDark, { p: [0, cy + h / 2 + 0.03, 0] }, { top: C.gold, shine: 0.8 });
      b.ico(0.03, 0, C.gold, { p: [0, cy + h / 2 + 0.2, 0] }, { shine: 1 });
    }
  }, { receive: true }));

  // 發光部分：紙身（＋3 級四角小光石）
  const glow = glowPart(k + ':glow', (b) => {
    paperBody(b, r, h, cy);
    if (v === 3) for (let i = 0; i < 4; i++) { const a = i / 4 * TAU + PI / 4; b.oct(0.04, C.glowWarm, { p: [Math.sin(a) * 0.33, 0.24, Math.cos(a) * 0.33], s: [1, 1.3, 1] }, { glow: 1.1, jit: 0 }); }
  });
  g.add(glow);
  const haloA = haloOwn(C.lampGlow, cfg.halo, 0.5); haloA.position.y = cy; g.add(haloA);
  const muzzle = new THREE.Object3D(); muzzle.position.y = cy; g.add(muzzle);

  const sw = glowSwitch([glow]);
  let t = Math.random() * 10, lit = true, want = true, relight = 0, glowK = 1;
  g.userData = {
    kind: 'tower', type: 'lantern', level: v,
    head: null, muzzle, height: cfg.height, lit: true,
    fire() {},
    /** on＝false：熄滅（被噴墨）；true：點亮（會先閃爍一下） */
    setLit(on) {
      on = !!on;
      if (on === want) return;
      want = on; g.userData.lit = on;
      if (on) relight = 0.5; else { relight = 0; lit = false; sw(false); }
    },
    update(dt) {
      t += dt;
      if (relight > 0) {
        relight -= dt;
        const flick = relight > 0 ? (Math.sin(relight * 55) + Math.sin(relight * 23) > 0.4) : true;
        lit = flick; sw(flick);
      }
      glowK = damp(glowK, lit ? 1 : 0, lit ? 14 : 8, dt);
      const fl = 1 + Math.sin(t * 11) * 0.05 + Math.sin(t * 17.3) * 0.04;
      haloA.material.opacity = 0.5 * glowK * fl;
      haloA.visible = glowK > 0.02;
      const hs = cfg.halo * (0.92 + glowK * 0.08) * fl;
      haloA.scale.set(hs, hs, 1);
      glow.rotation.z = Math.sin(t * 1.7) * 0.03;
    },
  };
  return g;
}

// ===========================================================================
// 水晶稜鏡塔：淺色石柱＋黃銅托架＋發光水晶（中心高度 1.2 + 0.15×等級，分支 1.8）
// ===========================================================================
/** 雙尖水晶（六角雙錐），中心在 (x,y,z) */
function bipyramid(b, x, y, z, r, hu, hd, col, top, seg = 6, glow = 1.0, ry = 0) {
  b.cone(r, hu, seg, col, { p: [x, y, z], r: [0, ry, 0] }, { top, glow, shine: 1, jit: 0.07 });
  b.cone(r, hd, seg, col, { p: [x, y, z], r: [PI, ry, 0] }, { top: C.crystalDeep, glow: glow * 0.85, shine: 1, jit: 0.07 });
}
/** 黃銅爪：從 (底半徑, y0) 往外再往內彎到 (頂半徑, y1)，n 根 */
function prongs(b, n, r0, y0, r1, y1, w = 0.035, col = C.brass, off = 0) {
  for (let i = 0; i < n; i++) {
    const a = i / n * TAU + off;
    const rm = Math.max(r0, r1) + 0.05, ym = (y0 + y1) / 2;
    const seg = (ra, ya, rb, yb) => {
      const L = Math.hypot(rb - ra, yb - ya), tilt = Math.atan2(rb - ra, yb - ya);
      const rc = (ra + rb) / 2, yc = (ya + yb) / 2;
      b.boxC(w, L + w * 0.6, w, col, { p: [Math.sin(a) * rc, yc, Math.cos(a) * rc], r: [tilt * Math.cos(a), 0, -tilt * Math.sin(a)], o: 'XYZ' }, { shine: 0.8, top: C.gold });
    };
    seg(r0, y0, rm, ym); seg(rm, ym, r1, y1);
    b.cone(w * 0.7, 0.06, 4, C.gold, { p: [Math.sin(a) * r1, y1, Math.cos(a) * r1] }, { shine: 1 });
  }
}

const PRISM = {
  1: { top: 0.86, cy: 1.35, cr: 0.11 },
  2: { top: 0.98, cy: 1.5, cr: 0.12 },
  3: { top: 1.1, cy: 1.65, cr: 0.135 },
  a: { top: 1.22, cy: 1.8, cr: 0.13 },
  b: { top: 1.24, cy: 1.8, cr: 0.1 },
};

function prismTower(v) {
  const g = new THREE.Group();
  const k = `tw:prism:${v}`;
  const cfg = PRISM[v];
  const split = v === 'a', focus = v === 'b';
  const ST = C.stoneBlue, STL = '#d6deea', STD = '#7f8aa0';
  const glows = [];

  g.add(part(k + ':base', (b) => {
    const top = cfg.top;
    if (!split) {
      const rb = v === 1 ? 0.34 : v === 2 ? 0.37 : 0.4;
      const rt = focus ? 0.22 : v === 1 ? 0.16 : 0.18;
      b.lathe([[0, 0], [rb, 0], [rb, 0.08], [rb - 0.05, 0.14], [rt + 0.05, top * 0.45], [rt, top - 0.1], [rt + 0.07, top - 0.05], [rt + 0.07, top], [0, top]], 8, ST, {}, { top: STL, jit: 0.06, wob: 0.006 });
      b.cylC(rt + 0.085, rt + 0.085, 0.025, 8, v === 3 || focus ? C.gold : C.brass, { p: [0, top - 0.035, 0], r: [0, PI / 8, 0] }, { shine: 0.9 });
      if (v !== 1) b.cylC(rb - 0.035, rb - 0.02, 0.03, 8, STD, { p: [0, 0.155, 0], r: [0, PI / 8, 0] });
      // 前方的小門與光窗（光窗不發光：塔本身靠水晶發光）
      b.box(0.11, 0.15, 0.04, C.woodDark, { p: [0, 0.06, rb - 0.06] });
      b.cylC(0.055, 0.055, 0.04, 6, C.woodDark, { p: [0, 0.21, rb - 0.06], r: [H2, 0, 0] });
      if (v === 3 || focus) {
        b.cylC(rb + 0.005, rb + 0.005, 0.025, 8, C.gold, { p: [0, 0.09, 0], r: [0, PI / 8, 0] }, { shine: 1 });
        const yb = top * 0.45, rbb = rt + 0.05 + (rb - 0.05 - rt - 0.05) * 0.0 + 0.012;
        b.cylC(rbb + 0.01, rbb + 0.02, 0.035, 8, C.gold, { p: [0, yb, 0], r: [0, PI / 8, 0] }, { shine: 1 });
      }
      if (!focus) prongs(b, v === 1 ? 3 : 4, rt + 0.03, top, cfg.cr * 0.75, cfg.cy - cfg.cr * 0.9, v === 1 ? 0.032 : 0.036, v === 3 ? C.gold : C.brass, PI / 4);
      else {
        // 聚焦：頂上的轉盤（會轉的部分在 head）
        b.cyl(rt + 0.1, rt + 0.1, 0.05, 8, C.brassDark, { p: [0, top, 0], r: [0, PI / 8, 0] }, { shine: 0.8, top: C.brass });
      }
    } else {
      // 分光：三根石柱圍成三角形的底座
      b.cyl(0.4, 0.42, 0.1, 6, STD, {}, { top: ST, wob: 0.008 });
      b.cyl(0.33, 0.35, 0.06, 6, ST, { p: [0, 0.1, 0] }, { top: STL });
      for (let i = 0; i < 3; i++) {
        const a = i / 3 * TAU + PI;
        b.cyl(0.075, 0.1, top - 0.16, 6, ST, { p: [Math.sin(a) * 0.22, 0.16, Math.cos(a) * 0.22] }, { top: STL, wob: 0.005 });
        b.cylC(0.105, 0.105, 0.03, 6, C.gold, { p: [Math.sin(a) * 0.22, 0.32, Math.cos(a) * 0.22] }, { shine: 1 });
        b.cone(0.09, 0.12, 6, C.gold, { p: [Math.sin(a) * 0.22, top, Math.cos(a) * 0.22] }, { shine: 0.9, top: '#fff0b0' });
      }
      b.cyl(0.12, 0.16, top - 0.2, 6, STD, { p: [0, 0.16, 0] }, { top: ST });
      b.cyl(0.2, 0.15, 0.06, 6, C.brass, { p: [0, top - 0.04, 0] }, { shine: 0.9 });
      prongs(b, 3, 0.14, top + 0.02, cfg.cr * 0.7, cfg.cy - cfg.cr * 1.4, 0.032, C.gold, 0);
    }
  }, { receive: true }));

  // ---- 水晶 ----
  const crystalG = pivot(0, cfg.cy, 0); g.add(crystalG);
  let head = null, ring = null, shards = null;
  const muzzle = new THREE.Object3D();
  if (focus) {
    // 聚焦：轉台＋黃銅叉架＋長水晶槍管（head 會轉向目標）
    head = pivot(0, cfg.top + 0.04, 0); g.add(head);
    head.add(part(k + ':yoke', (b) => {
      b.cyl(0.2, 0.22, 0.06, 8, C.brass, { r: [0, PI / 8, 0] }, { shine: 0.9, top: C.gold });
      const y = cfg.cy - cfg.top - 0.04;
      for (const sx of [-1, 1]) {
        b.box(0.07, y + 0.04, 0.12, C.brassDark, { p: [sx * 0.13, 0.02, 0] }, { shine: 0.8, top: C.brass });
        b.cylC(0.055, 0.055, 0.05, 6, C.gold, { p: [sx * 0.13, y, 0], r: [0, 0, H2] }, { shine: 1 });
      }
      b.cylC(0.025, 0.025, 0.24, 5, C.ironDark, { p: [0, y, 0], r: [0, 0, H2] }, { shine: 0.6 });
      // 槍管的金屬箍與後方配重
      for (const z of [-0.24, 0.24]) b.cylC(0.1, 0.1, 0.045, 6, C.gold, { p: [0, y, z], r: [H2, 0, 0] }, { shine: 1 });
      b.cylC(0.08, 0.11, 0.14, 6, C.brassDark, { p: [0, y, -0.44], r: [H2, 0, 0] }, { shine: 0.7, top: C.gold });
    }));
    const barrel = glowPart(k + ':barrel', (b) => {
      const y = cfg.cy - cfg.top - 0.04;
      // 長水晶槍管：六角水晶柱＋前端長尖
      b.cylC(0.085, 0.085, 0.72, 6, C.prismViolet, { p: [0, y, 0.0], r: [H2, 0, 0] }, { top: '#c8b8ff', glow: 0.6, shine: 1, jit: 0.09 });
      b.coneC(0.085, 0.32, 6, '#b8a8ff', { p: [0, y, 0.52], r: [H2, 0, 0] }, { top: C.prismVioletTop, glow: 0.85, shine: 1, jit: 0.06 });
    });
    head.add(barrel); glows.push(barrel);
    muzzle.position.set(0, cfg.cy - cfg.top - 0.04, 0); head.add(muzzle);
  } else {
    const col = split ? C.crystal : C.crystal, top = C.crystalTop;
    const crystal = glowPart(k + ':crystal', (b) => {
      if (split) {
        // 三稜柱水晶（中央）
        b.cylC(cfg.cr, cfg.cr, cfg.cr * 2.2, 3, col, {}, { top, glow: 0.75, shine: 1, jit: 0.07 });
        b.cone(cfg.cr, cfg.cr * 1.4, 3, C.crystal, { p: [0, cfg.cr * 1.1, 0] }, { top, glow: 0.85, shine: 1, jit: 0.05 });
        b.cone(cfg.cr, cfg.cr * 1.2, 3, col, { p: [0, -cfg.cr * 1.1, 0], r: [PI, 0, 0] }, { glow: 0.7, shine: 1, jit: 0.05 });
      } else bipyramid(b, 0, 0, 0, cfg.cr, cfg.cr * 2.1, cfg.cr * 1.6, col, top, 6, 0.8);
    });
    crystalG.add(crystal); glows.push(crystal);
    crystalG.add(muzzle);
    if (v === 2 || v === 3) {
      // 底座上嵌的小水晶
      const gems = glowPart(k + ':gems', (b) => {
        const rb = v === 2 ? 0.37 : 0.4;
        for (const a of [0.9, -0.9, PI]) b.oct(0.04, C.crystal, { p: [Math.sin(a) * (rb - 0.045), 0.3, Math.cos(a) * (rb - 0.045)], r: [0, a, 0], s: [0.8, 1.5, 0.6] }, { glow: 0.8, shine: 1, jit: 0 });
      });
      g.add(gems); glows.push(gems);
    }
    if (v === 3) {
      shards = pivot(); crystalG.add(shards);
      const sh = glowPart(k + ':shards', (b) => {
        for (let i = 0; i < 3; i++) { const a = i / 3 * TAU; b.oct(0.035, C.crystalTop, { p: [Math.sin(a) * 0.26, 0, Math.cos(a) * 0.26], s: [0.7, 1.6, 0.7] }, { glow: 1, shine: 1, jit: 0 }); }
      });
      shards.add(sh); glows.push(sh);
    }
    if (split) {
      // 三稜水晶環：黃銅環＋三顆分光色（青、粉、黃）的小稜鏡，繞著中央水晶轉
      ring = pivot(); crystalG.add(ring);
      ring.add(part(k + ':ring', (b) => b.torus(0.3, 0.014, 3, 12, TAU, C.gold, { r: [H2, 0, 0] }, { shine: 1 }), { cast: true }));
      const prisms = glowPart(k + ':ringPrisms', (b) => {
        ['#2fd0ff', '#ff5ad2', '#ffc61a'].forEach((c, i) => {
          const a = i / 3 * TAU;
          b.cylC(0.06, 0.06, 0.15, 3, c, { p: [Math.sin(a) * 0.3, 0, Math.cos(a) * 0.3], r: [0, a, 0] }, { glow: 0.75, shine: 1, jit: 0.05 });
          b.cone(0.06, 0.07, 3, c, { p: [Math.sin(a) * 0.3, 0.075, Math.cos(a) * 0.3], r: [0, a, 0] }, { glow: 0.85, shine: 1, jit: 0 });
        });
      });
      ring.add(prisms); glows.push(prisms);
    }
  }
  const haloA = haloOwn(focus ? C.prismViolet : C.crystal, focus ? 0.7 : cfg.cr * 6.5, focus ? 0.4 : 0.55);
  haloA.position.y = cfg.cy; g.add(haloA);

  const sw = glowSwitch(glows);
  let t = Math.random() * 10, pulse = 0, lit = true, litK = 1;
  g.userData = {
    kind: 'tower', type: 'prism', level: v,
    head, muzzle, height: cfg.cy + (focus ? 0.25 : cfg.cr * 2.4) + 0.05, crystalY: cfg.cy, lit: true,
    fire() { pulse = 1; },
    /** on＝false：沒有光，水晶變暗、停止轉動 */
    setLit(on) { on = !!on; if (on === lit) return; lit = on; g.userData.lit = on; sw(on); },
    update(dt) {
      t += dt;
      litK = damp(litK, lit ? 1 : 0, 6, dt);
      if (pulse > 0) pulse = Math.max(0, pulse - dt * 3);
      const spin = 0.25 + litK * 0.75;
      if (!focus) {
        crystalG.position.y = cfg.cy + Math.sin(t * 1.8) * 0.025 * litK;
        crystalG.rotation.y += dt * 0.9 * spin;
        crystalG.scale.setScalar(1 + pulse * 0.25);
      }
      if (ring) { ring.rotation.y = -t * 1.6 * spin * 0.6; ring.rotation.x = Math.sin(t * 0.8) * 0.08; }
      if (shards) shards.rotation.y = -t * 1.8;
      const fl = 1 + Math.sin(t * 3.1) * 0.06 + pulse * 0.4;
      const hs = (focus ? 0.7 : cfg.cr * 6.5) * fl;
      haloA.scale.set(hs, hs, 1);
      haloA.material.opacity = 0.55 * litK;
      haloA.visible = litK > 0.02;
    },
  };
  return g;
}

/** 第二章塔的建構表（towers.js 會併進 makeTower） */
export const TOWERS2 = { lantern: lanternTower, prism: prismTower };
