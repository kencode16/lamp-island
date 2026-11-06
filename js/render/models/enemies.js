// 敵人模型（擁有者：B）。id 見 js/data/enemies.js。
// 所有敵人：原點在腳底中心（飛行敵人原點在身體中心，view 會把它放在 y = 1.3），正面朝 +Z。
// userData.update(dt, { moving, speed, frozen, slowed, attacking })、userData.hit()、userData.height
import * as THREE from 'three';
import { C, halo } from '../palette.js';
import { part, pivot, makeSkin, PI, TAU } from './lib.js';

const H2 = PI / 2;

// ---------------------------------------------------------------------------
// 史萊姆系
// ---------------------------------------------------------------------------
function slimeProfile(R, H, closed = false) {
  return [...(closed ? [[0, 0]] : []), [R * 0.74, 0], [R * 0.94, H * 0.09], [R, H * 0.26], [R * 0.93, H * 0.47], [R * 0.74, H * 0.68], [R * 0.43, H * 0.88], [0, H]];
}
/** 史萊姆臉：大黑眼＋高光＋腮紅＋小嘴（z0 = 臉前緣） */
function slimeFace(b, s, y, z0, ex, blush = C.petalPink) {
  for (const sx of [-1, 1]) {
    b.ico(0.05 * s, 0, C.pupil, { p: [sx * ex * s, y, z0], r: [0, sx * 0.4, 0], s: [0.85, 1.2, 0.5] }, { jit: 0, shine: 1 });
    b.boxC(0.022 * s, 0.022 * s, 0.01, C.white, { p: [sx * ex * s + 0.012 * s, y + 0.025 * s, z0 + 0.024 * s], r: [0, sx * 0.4, 0] }, { glow: 0.6, jit: 0 });
    b.ico(0.032 * s, 0, blush, { p: [sx * (ex + 0.075) * s, y - 0.05 * s, z0 - 0.025 * s], r: [0, sx * 0.7, 0], s: [1, 0.6, 0.4] }, { jit: 0 });
  }
  b.boxC(0.05 * s, 0.016 * s, 0.01, C.mouth, { p: [0, y - 0.06 * s, z0 + 0.005] }, { jit: 0 });
}
function slimeMesh(key, R, H, col, top, glossY) {
  return part(key, (b) => {
    b.lathe(slimeProfile(R, H), 9, col, {}, { top, shine: 0.85, jit: 0.04, wob: R * 0.02 });
    slimeFace(b, R / 0.3, H * 0.5, R * 0.86, 0.09);
    b.ico(0.055 * R / 0.3, 0, C.white, { p: [-R * 0.38, glossY ?? H * 0.82, R * 0.3], r: [0.4, 0, 0.4], s: [1.3, 0.45, 0.8] }, { glow: 0.45, jit: 0 });
  });
}

function slimeLike(type) {
  const g = new THREE.Group();
  const rig = new THREE.Group(); g.add(rig);
  let height, hopH, freq;
  if (type === 'slimelet') {
    rig.add(slimeMesh('en:slimelet', 0.19, 0.27, C.slimelet, C.slimeletTop));
    height = 0.3; hopH = 0.09; freq = 3.0;
  } else {
    rig.add(slimeMesh('en:slime', 0.29, 0.42, C.slime, C.slimeTop));
    // 頭頂小芽
    rig.add(part('en:slime:sprout', (b) => {
      b.cyl(0.008, 0.012, 0.06, 4, C.leafDark, { p: [0, 0.4, 0] });
      b.ico(0.03, 0, C.leaf, { p: [0.025, 0.465, 0], s: [1.2, 0.5, 0.8], r: [0, 0, -0.5] });
    }));
    height = 0.48; hopH = 0.1; freq = 2.4;
  }
  const skin = makeSkin(g);
  let ph = Math.random(), t = Math.random() * 5;
  g.userData = {
    kind: 'enemy', type, height,
    hit() { skin.hit(); },
    update(dt, s = {}) {
      skin.update(dt, s.frozen);
      if (s.frozen) return;
      t += dt;
      const k = s.slowed ? 0.55 : 1;
      if (s.moving || s.attacking) {
        ph += dt * freq * k * (s.attacking ? 1.5 : 1) * Math.min(1.6, Math.max(0.7, s.speed || 1));
        const c = ph % 1, air = Math.sin(c * PI);
        rig.position.y = air * hopH * (s.attacking ? 0.6 : 1);
        const sy = 0.84 + 0.3 * air;
        const sxz = 1 / Math.sqrt(sy);
        rig.scale.set(sxz, sy, sxz);
        rig.rotation.x = (air - 0.5) * 0.12;
      } else {
        rig.position.y = 0; rig.rotation.x = 0;
        const sy = 1 + Math.sin(t * 3.2) * 0.045;
        rig.scale.set(1 / Math.sqrt(sy), sy, 1 / Math.sqrt(sy));
      }
    },
  };
  return g;
}

function splitter() {
  const g = new THREE.Group();
  const rig = new THREE.Group(); g.add(rig);
  const lobes = [];
  for (const sx of [-1, 1]) {
    const p = pivot(sx * 0.13, 0, 0); rig.add(p);
    const m = part('en:splitter:lobe', (b) => {
      b.lathe(slimeProfile(0.22, 0.4), 7, C.splitter, {}, { top: C.splitterTop, shine: 0.85, jit: 0.04, wob: 0.005 });
      for (const sx of [-1, 1]) {
        b.ico(0.038, 0, C.pupil, { p: [sx * 0.055, 0.23, 0.195], r: [0, sx * 0.4, 0], s: [0.85, 1.2, 0.5] }, { jit: 0, shine: 1 });
        b.boxC(0.016, 0.016, 0.01, C.white, { p: [sx * 0.055 + 0.009, 0.25, 0.213], r: [0, sx * 0.4, 0] }, { glow: 0.6, jit: 0 });
      }
    });
    p.add(m); p.rotation.y = -sx * 0.22; p.rotation.z = -sx * 0.06;
    lobes.push(p);
  }
  const skin = makeSkin(g);
  let ph = Math.random(), t = Math.random() * 5;
  g.userData = {
    kind: 'enemy', type: 'splitter', height: 0.5,
    hit() { skin.hit(); },
    update(dt, s = {}) {
      skin.update(dt, s.frozen);
      if (s.frozen) return;
      t += dt;
      const k = s.slowed ? 0.55 : 1;
      if (s.moving || s.attacking) {
        ph += dt * 2.2 * k;
        const c = ph % 1, air = Math.sin(c * PI);
        rig.position.y = air * 0.09;
        for (let i = 0; i < 2; i++) {
          const a = Math.sin((c + i * 0.25) * PI);
          const sy = 0.84 + 0.3 * a;
          lobes[i].scale.set(1 / Math.sqrt(sy), sy, 1 / Math.sqrt(sy));
        }
      } else {
        rig.position.y = 0;
        for (let i = 0; i < 2; i++) {
          const sy = 1 + Math.sin(t * 3 + i * 1.6) * 0.05;
          lobes[i].scale.set(1 / Math.sqrt(sy), sy, 1 / Math.sqrt(sy));
        }
      }
      const sep = 0.13 + Math.sin(t * 2.3) * 0.012;
      lobes[0].position.x = -sep; lobes[1].position.x = sep;
    },
  };
  return g;
}

function slimeKing() {
  const g = new THREE.Group();
  const rig = new THREE.Group(); g.add(rig);
  const R = 0.74, H = 1.12;
  rig.add(part('en:slimeKing:body', (b) => {
    b.lathe(slimeProfile(R, H), 12, C.king, {}, { top: C.kingTop, shine: 0.85, jit: 0.04, wob: 0.012 });
    // 底部黏液小團
    for (let i = 0; i < 7; i++) {
      const a = i / 7 * TAU + 0.3;
      b.ico(0.09 + (i % 3) * 0.02, 0, C.king, { p: [Math.sin(a) * R * 0.92, 0.03, Math.cos(a) * R * 0.92], s: [1.3, 0.55, 1.3] }, { top: C.kingTop, shine: 0.8 });
    }
    // 大黑眼＋高光、生氣的眉毛、腮紅
    for (const sx of [-1, 1]) {
      const ex = sx * 0.21, ey = 0.6, ez = 0.66;
      b.ico(0.12, 1, C.pupil, { p: [ex, ey, ez], r: [0, sx * 0.32, 0], s: [0.85, 1.15, 0.42] }, { jit: 0, shine: 1 });
      b.boxC(0.05, 0.05, 0.02, C.white, { p: [ex + 0.035, ey + 0.045, ez + 0.05], r: [0, sx * 0.32, 0] }, { glow: 0.7, jit: 0 });
      b.boxC(0.022, 0.022, 0.02, C.white, { p: [ex - 0.03, ey - 0.04, ez + 0.05], r: [0, sx * 0.32, 0] }, { glow: 0.7, jit: 0 });
      b.boxC(0.2, 0.045, 0.06, '#2f7a2a', { p: [ex - sx * 0.01, ey + 0.17, ez - 0.03], r: [0, sx * 0.32, sx * -0.42] });
      b.ico(0.07, 0, C.petalPink, { p: [sx * 0.42, 0.42, 0.56], r: [0, sx * 0.7, 0], s: [1, 0.6, 0.4] }, { jit: 0 });
    }
    // 壞笑的嘴＋小尖牙
    b.shape([[-0.19, 0.03], [0.19, 0.03], [0.13, -0.06], [0, -0.09], [-0.13, -0.06]], 0.05, C.mouth, { p: [0, 0.37, 0.71], r: [-0.12, 0, 0] }, { jit: 0 });
    for (const sx of [-1, 1]) b.coneC(0.025, 0.06, 4, C.white, { p: [sx * 0.1, 0.38, 0.74], r: [PI, 0, 0] }, { jit: 0 });
    // 高光
    b.ico(0.1, 0, '#f2ffe0', { p: [-0.34, 0.92, 0.36], r: [0.5, 0, 0.5], s: [1.4, 0.35, 0.8] }, { glow: 0.25, jit: 0 });
  }));
  const crownP = pivot(0, H - 0.08, -0.02); rig.add(crownP);
  crownP.add(part('en:slimeKing:crown', (b) => {
    b.cyl(0.3, 0.27, 0.17, 8, C.gold, { r: [0, PI / 8, 0] }, { shine: 1, top: '#ffe08a' });
    b.ico(0.24, 1, C.red, { p: [0, 0.13, 0], s: [1, 0.55, 1] }, { jit: 0.05 });
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * TAU;
      b.cone(0.055, 0.15, 4, C.gold, { p: [Math.sin(a) * 0.29, 0.15, Math.cos(a) * 0.29] }, { shine: 1 });
      b.ico(0.025, 0, '#fff2b8', { p: [Math.sin(a) * 0.29, 0.31, Math.cos(a) * 0.29] }, { shine: 1, glow: 0.3 });
    }
    for (const [a, col] of [[0, '#ff4a6a'], [0.8, '#4aa8ff'], [-0.8, '#4aff9a']]) {
      b.oct(0.045, col, { p: [Math.sin(a) * 0.3, 0.085, Math.cos(a) * 0.3], r: [0, a, 0], s: [1, 1.3, 0.5] }, { shine: 1, glow: 0.5 });
    }
  }));
  crownP.rotation.z = 0.12;
  const skin = makeSkin(g);
  let ph = Math.random(), t = Math.random() * 5, wob = 0;
  g.userData = {
    kind: 'enemy', type: 'slimeKing', height: 1.45, boss: true,
    hit() { skin.hit(); wob = Math.min(1, wob + 0.25); },
    update(dt, s = {}) {
      skin.update(dt, s.frozen);
      if (s.frozen) return;
      t += dt;
      const k = s.slowed ? 0.55 : 1;
      wob = Math.max(0, wob - dt * 2);
      let sy;
      if (s.moving || s.attacking) {
        ph += dt * 1.1 * k;
        const c = ph % 1, air = Math.sin(c * PI);
        rig.position.y = air * 0.12;
        sy = 0.86 + 0.24 * air;
        crownP.position.y = H - 0.08 + (0.5 - air) * 0.08;
        crownP.rotation.z = 0.12 + Math.cos(c * TAU) * 0.08;
      } else {
        rig.position.y = 0;
        sy = 1 + Math.sin(t * 2) * 0.04;
        crownP.position.y = H - 0.08 + Math.sin(t * 2 - 0.6) * 0.02;
        crownP.rotation.z = 0.12 + Math.sin(t * 1.3) * 0.03;
      }
      sy += Math.sin(t * 25) * wob * 0.05;
      rig.scale.set(1 / Math.sqrt(sy), sy, 1 / Math.sqrt(sy));
    },
  };
  return g;
}

// ---------------------------------------------------------------------------
// 兩足步行（哥布林、骷髏、魔像、夜之君主共用的腿與擺動）
// ---------------------------------------------------------------------------
function walker(g, rig, legs, arms, opt) {
  const skin = makeSkin(g);
  let ph = Math.random() * TAU, t = Math.random() * 5, atk = 0;
  const swing = opt.swing ?? 0.7, bob = opt.bob ?? 0.03, freq = opt.freq ?? 9, sway = opt.sway ?? 0.06;
  return {
    hit() { skin.hit(); },
    update(dt, s = {}) {
      skin.update(dt, s.frozen);
      if (s.frozen) return;
      t += dt;
      const k = (s.slowed ? 0.55 : 1) * Math.min(1.5, Math.max(0.7, s.speed || 1));
      const mv = !!s.moving;
      if (mv) ph += dt * freq * k;
      const amt = mv ? 1 : 0;
      const sw = Math.sin(ph) * swing * amt;
      legs[0].rotation.x = sw; legs[1].rotation.x = -sw;
      if (arms) {
        if (s.attacking) {
          atk += dt * (opt.atkFreq ?? 6);
          arms[0].rotation.x = -0.6 - Math.max(0, Math.sin(atk)) * 1.4;
          arms[1].rotation.x = Math.sin(ph) * 0.3 * amt;
        } else {
          arms[0].rotation.x = -sw * 0.8; arms[1].rotation.x = sw * 0.8;
        }
      }
      rig.position.y = mv ? Math.abs(Math.cos(ph)) * bob : Math.sin(t * 2.4) * bob * 0.2;
      rig.rotation.z = mv ? Math.sin(ph) * sway : 0;
      rig.rotation.x = s.attacking ? 0.1 : (mv ? opt.lean ?? 0.08 : 0);
      opt.extra?.(dt, s, t, ph, mv);
    },
  };
}

function goblin() {
  const g = new THREE.Group();
  const rig = new THREE.Group(); g.add(rig);
  rig.add(part('en:goblin:body', (b) => {
    // 身體與腰帶
    b.cyl(0.1, 0.13, 0.19, 6, C.leather, { p: [0, 0.15, 0] }, { top: '#a8744c' });
    b.boxC(0.26, 0.03, 0.22, C.woodDark, { p: [0, 0.18, 0] });
    b.boxC(0.04, 0.035, 0.02, C.gold, { p: [0, 0.18, 0.13] }, { shine: 0.8 });
    // 頭
    b.dodec(0.13, C.goblin, { p: [0, 0.42, 0.01], s: [1.12, 0.95, 1] }, { top: C.goblinLight, jit: 0.05 });
    for (const sx of [-1, 1]) {
      b.coneC(0.045, 0.19, 4, C.goblin, { p: [sx * 0.19, 0.45, -0.01], r: [0.25, 0, sx * -(H2 - 0.35)] }, { top: '#c56a5a' });
      b.boxC(0.04, 0.034, 0.02, '#ffe14a', { p: [sx * 0.05, 0.44, 0.12] }, { glow: 0.9, jit: 0 });
      // 手臂
      b.boxC(0.05, 0.15, 0.055, C.goblin, { p: [sx * 0.15, 0.24, 0.02], r: [-0.4, 0, sx * 0.25] });
    }
    b.coneC(0.03, 0.09, 4, C.goblinLight, { p: [0, 0.4, 0.15], r: [H2 - 0.3, 0, 0] });
    // 紅色尖帽
    b.cyl(0.155, 0.155, 0.03, 6, C.goblinHatDark, { p: [0, 0.48, 0] });
    b.cone(0.13, 0.27, 6, C.goblinHat, { p: [0, 0.5, -0.02], r: [-0.3, 0, 0.1] }, { top: '#f26060' });
    b.oct(0.035, C.white, { p: [0.025, 0.73, -0.11] });
    // 匕首
    b.boxC(0.022, 0.13, 0.012, C.steel, { p: [0.18, 0.18, 0.13], r: [0.9, 0, 0] }, { shine: 1 });
    b.boxC(0.06, 0.018, 0.025, C.woodDark, { p: [0.18, 0.15, 0.08], r: [0.9, 0, 0] });
    // 背上的贓物袋
    b.ico(0.1, 0, C.woodPale, { p: [-0.02, 0.27, -0.14], s: [1, 1.1, 0.8] }, { top: C.cream });
  }));
  const legs = [];
  for (const sx of [-1, 1]) {
    const p = pivot(sx * 0.06, 0.17, 0); rig.add(p);
    p.add(part('en:goblin:leg', (b) => {
      b.box(0.07, 0.17, 0.09, '#5c4630', { p: [0, -0.17, 0.01] }, { top: C.leather });
    }));
    legs.push(p);
  }
  const w = walker(g, rig, legs, null, { swing: 0.85, bob: 0.04, freq: 13, sway: 0.08, lean: 0.18 });
  g.userData = { kind: 'enemy', type: 'goblin', height: 0.74, hit: w.hit, update: w.update };
  return g;
}

function skeleton() {
  const g = new THREE.Group();
  const rig = new THREE.Group(); g.add(rig);
  rig.add(part('en:skeleton:body', (b) => {
    b.boxC(0.15, 0.05, 0.08, C.bone, { p: [0, 0.28, 0] });
    // 白骨胸腔（中間兩條肋骨縫）＋生鏽腰帶與單邊肩甲
    b.cyl(0.13, 0.1, 0.2, 6, C.bone, { p: [0, 0.31, 0], r: [0, PI / 6, 0] }, { top: C.white });
    for (const y of [0.38, 0.44]) b.boxC(0.16, 0.018, 0.02, '#4a4038', { p: [0, y, 0.1] }, { jit: 0 });
    b.boxC(0.2, 0.06, 0.15, C.rust, { p: [0, 0.29, 0] }, { jit: 0.18 });
    b.box(0.12, 0.07, 0.13, C.rust, { p: [-0.15, 0.45, 0], r: [0, 0, 0.4] }, { jit: 0.18, top: C.rustLight });
    for (const sx of [-1, 1]) b.boxC(0.035, 0.2, 0.035, C.bone, { p: [sx * 0.17, 0.35, 0.03], r: [-0.3, 0, sx * 0.12] });
    // 大頭骨＋下巴＋發光眼
    b.boxC(0.2, 0.16, 0.18, C.bone, { p: [0, 0.62, 0.01] }, { top: C.white });
    b.boxC(0.15, 0.05, 0.13, C.boneDark, { p: [0, 0.525, 0.03] });
    b.boxC(0.16, 0.05, 0.02, C.black, { p: [0, 0.625, 0.1] }, { jit: 0 });
    for (const sx of [-1, 1]) b.boxC(0.035, 0.03, 0.02, C.eyeOrange, { p: [sx * 0.042, 0.625, 0.106] }, { glow: 1.6, jit: 0 });
    // 生鏽圓盾（左手）＋生鏽的劍（右手）
    b.cylC(0.14, 0.14, 0.03, 8, C.rust, { p: [-0.21, 0.32, 0.08], r: [H2, 0, 0.25], o: 'ZXY' }, { jit: 0.2, top: C.rustLight });
    b.boxC(0.05, 0.05, 0.03, C.iron, { p: [-0.205, 0.32, 0.1] }, { shine: 0.6 });
    b.boxC(0.03, 0.26, 0.012, C.rustLight, { p: [0.21, 0.32, 0.17], r: [0.75, 0, 0] }, { jit: 0.2, shine: 0.3 });
    b.boxC(0.09, 0.02, 0.03, C.rustDark, { p: [0.21, 0.24, 0.09], r: [0.75, 0, 0] });
  }));
  const legs = [];
  for (const sx of [-1, 1]) {
    const p = pivot(sx * 0.06, 0.27, 0); rig.add(p);
    p.add(part('en:skeleton:leg', (b) => {
      b.box(0.04, 0.25, 0.04, C.bone, { p: [0, -0.25, 0] });
      b.box(0.055, 0.03, 0.09, C.bone, { p: [0, -0.27, 0.02] });
    }));
    legs.push(p);
  }
  const w = walker(g, rig, legs, null, { swing: 0.6, bob: 0.025, freq: 8, sway: 0.07, lean: 0.05 });
  g.userData = { kind: 'enemy', type: 'skeleton', height: 0.76, hit: w.hit, update: w.update };
  return g;
}

function golem() {
  const g = new THREE.Group();
  const rig = new THREE.Group(); g.add(rig);
  rig.add(part('en:golem:body', (b) => {
    b.dodec(0.38, C.golem, { p: [0, 0.7, 0], s: [1.18, 0.95, 0.85] }, { top: C.golemLight, wob: 0.02, jit: 0.08 });
    b.box(0.4, 0.2, 0.3, C.golemDark, { p: [0, 0.3, -0.02] }, { wob: 0.015 });
    // 苔蘚
    b.ico(0.17, 0, C.moss, { p: [-0.2, 0.98, -0.03], s: [1.3, 0.35, 1.1] }, { top: C.leafLight, wob: 0.02 });
    // 胸口熔岩裂紋
    b.boxC(0.035, 0.24, 0.02, C.eyeOrange, { p: [-0.05, 0.72, 0.32], r: [0, 0, 0.35] }, { glow: 1.3, jit: 0 });
    b.boxC(0.035, 0.15, 0.02, C.eyeOrange, { p: [0.07, 0.66, 0.32], r: [0, 0, -0.6] }, { glow: 1.3, jit: 0 });
    // 頭（陷在肩膀裡）＋發光眼帶
    b.ico(0.16, 0, C.golemLight, { p: [0, 1.06, 0.12], s: [1.15, 0.85, 1] }, { wob: 0.012 });
    b.boxC(0.17, 0.035, 0.03, C.eyeOrange, { p: [0, 1.06, 0.255] }, { glow: 1.6, jit: 0 });
  }));
  const legs = [];
  for (const sx of [-1, 1]) {
    const p = pivot(sx * 0.2, 0.34, 0); rig.add(p);
    p.add(part('en:golem:leg', (b) => {
      b.box(0.2, 0.26, 0.22, C.golemDark, { p: [0, -0.28, 0] }, { wob: 0.015 });
      b.box(0.24, 0.1, 0.28, C.golem, { p: [0, -0.34, 0.03] }, { top: C.golemLight, wob: 0.012 });
    }));
    legs.push(p);
  }
  const arms = [];
  for (const sx of [-1, 1]) {
    const p = pivot(sx * 0.44, 0.9, 0); rig.add(p);
    p.add(part('en:golem:arm', (b) => {
      b.ico(0.18, 0, C.golem, { p: [0.02, 0, 0] }, { top: C.golemLight, wob: 0.02 });
      b.ico(0.13, 0, C.golemDark, { p: [0.05, -0.28, 0.04] }, { wob: 0.015 });
      b.ico(0.17, 0, C.golem, { p: [0.06, -0.52, 0.07], r: [0.5, 0.3, 0] }, { top: C.golemLight, wob: 0.02 });
    }));
    p.scale.x = sx;
    arms.push(p);
  }
  const w = walker(g, rig, legs, arms, { swing: 0.35, bob: 0.05, freq: 4.2, sway: 0.07, lean: 0.03, atkFreq: 3.5 });
  g.userData = { kind: 'enemy', type: 'golem', height: 1.25, hit: w.hit, update: w.update };
  return g;
}

function shaman() {
  const g = new THREE.Group();
  const rig = new THREE.Group(); g.add(rig);
  rig.add(part('en:shaman:body', (b) => {
    b.lathe([[0.21, 0], [0.22, 0.04], [0.17, 0.2], [0.12, 0.38], [0.1, 0.48], [0, 0.52]], 8, C.shaman, {}, { top: '#7a44b0', jit: 0.05 });
    b.cyl(0.215, 0.225, 0.04, 7, C.shamanTrim, { p: [0, 0.015, 0] }, { shine: 0.8 });
    b.boxC(0.04, 0.2, 0.02, C.shamanTrim, { p: [0, 0.2, 0.17], r: [-0.22, 0, 0] }, { shine: 0.6 });
    // 兜帽與黑臉、發光眼
    b.cone(0.14, 0.34, 7, C.shamanDark, { p: [0, 0.44, -0.03], r: [-0.4, 0, 0] }, { top: C.shaman });
    b.oct(0.085, C.black, { p: [0, 0.55, 0.06], s: [1, 1, 0.8] }, { jit: 0 });
    for (const sx of [-1, 1]) b.boxC(0.03, 0.022, 0.02, '#ff6cf0', { p: [sx * 0.032, 0.56, 0.125] }, { glow: 1.6, jit: 0 });
    // 袖子與手
    for (const sx of [-1, 1]) {
      b.cone(0.06, 0.2, 4, C.shaman, { p: [sx * 0.13, 0.42, 0.04], r: [-0.6, 0, sx * 2.6] }, { top: C.shamanDark });
      b.oct(0.035, '#3d3448', { p: [sx * 0.19, 0.29, 0.14] });
    }
    // 符文腰飾
    b.oct(0.035, '#ff6cf0', { p: [0, 0.32, 0.15] }, { glow: 1, shine: 1 });
  }));
  // 法杖
  const staffP = pivot(0.19, 0.29, 0.14); rig.add(staffP);
  staffP.add(part('en:shaman:staff', (b) => {
    b.cylC(0.014, 0.016, 0.9, 5, C.woodDark, { p: [0, 0.12, 0] });
    b.torus(0.07, 0.014, 3, 6, PI * 1.4, C.shamanTrim, { p: [0, 0.6, 0], r: [0, 0, -PI * 0.2] }, { shine: 0.8 });
    b.ico(0.06, 0, '#ff8ff4', { p: [0, 0.62, 0] }, { glow: 1.2, shine: 1, top: C.white, jit: 0 });
  }));
  const orbHalo = halo('#e070ff', 0.42, 0.7); orbHalo.position.y = 0.62; staffP.add(orbHalo);
  const skin = makeSkin(g);
  let t = Math.random() * 5, ph = Math.random() * TAU, cast = 0;
  g.userData = {
    kind: 'enemy', type: 'shaman', height: 0.86,
    hit() { skin.hit(); },
    update(dt, s = {}) {
      skin.update(dt, s.frozen);
      if (s.frozen) return;
      t += dt;
      const k = s.slowed ? 0.55 : 1;
      if (s.moving) ph += dt * 5 * k;
      rig.position.y = 0.03 + Math.sin(t * 2.2) * 0.02;
      rig.rotation.z = s.moving ? Math.sin(ph) * 0.05 : 0;
      cast = s.attacking ? Math.min(1, cast + dt * 3) : Math.max(0, cast - dt * 3);
      staffP.rotation.x = -0.1 + Math.sin(t * 1.7) * 0.06 - cast * 0.5;
      staffP.position.y = 0.29 + cast * 0.08;
      const hs = 0.42 + Math.sin(t * 4) * 0.06;
      orbHalo.scale.set(hs, hs, 1);
    },
  };
  return g;
}

function nightLord() {
  const g = new THREE.Group();
  const rig = new THREE.Group(); g.add(rig);
  const A = C.nightArmor, AL = C.nightArmorLight, T = C.nightTrim;
  rig.add(part('en:nightLord:body', (b) => {
    // 腰甲裙
    b.cyl(0.2, 0.28, 0.24, 8, AL, { p: [0, 0.5, 0], r: [0, PI / 8, 0] }, { top: A });
    b.cylC(0.21, 0.21, 0.04, 8, T, { p: [0, 0.72, 0], r: [0, PI / 8, 0] }, { glow: 0.7 });
    // 胸甲
    b.lathe([[0.17, 0], [0.21, 0.1], [0.27, 0.32], [0.29, 0.44], [0.18, 0.5], [0, 0.52]], 8, A, { p: [0, 0.7, 0], s: [1.1, 1, 0.78] }, { top: AL, shine: 0.5 });
    b.boxC(0.04, 0.3, 0.02, T, { p: [0, 0.92, 0.2] }, { glow: 0.9, jit: 0 });
    b.boxC(0.2, 0.035, 0.02, T, { p: [0, 1.0, 0.19], r: [0, 0, 0] }, { glow: 0.9, jit: 0 });
    // 尖刺肩甲
    for (const sx of [-1, 1]) {
      b.dodec(0.15, A, { p: [sx * 0.3, 1.13, 0], s: [1.1, 0.8, 1] }, { top: AL, shine: 0.5 });
      b.cone(0.045, 0.2, 4, AL, { p: [sx * 0.34, 1.2, 0.02], r: [0, 0, sx * -0.4] }, { top: T, shine: 0.5 });
      b.cone(0.035, 0.14, 4, AL, { p: [sx * 0.36, 1.15, -0.08], r: [-0.4, 0, sx * -0.8] }, { top: T, shine: 0.5 });
    }
    // 高領
    for (const sx of [-1, 1]) b.box(0.08, 0.22, 0.05, C.nightCape, { p: [sx * 0.13, 1.1, -0.1], r: [-0.25, sx * -0.4, sx * -0.2] });
    // 頭盔＋角＋眼
    b.boxC(0.19, 0.22, 0.2, A, { p: [0, 1.32, 0.01] }, { top: AL, shine: 0.5 });
    b.coneC(0.11, 0.08, 4, A, { p: [0, 1.25, 0.11], r: [-H2 - 0.2, PI / 4, 0] });
    for (const sx of [-1, 1]) {
      b.cone(0.045, 0.22, 5, AL, { p: [sx * 0.1, 1.38, 0], r: [0, 0, sx * -0.9] }, { top: '#8f86b0' });
      b.cone(0.03, 0.2, 5, '#8f86b0', { p: [sx * 0.27, 1.49, 0], r: [-0.15, 0, sx * -0.15] }, { top: C.white });
      b.boxC(0.06, 0.025, 0.03, C.eyeRed, { p: [sx * 0.045, 1.33, 0.115], r: [0, 0, sx * -0.25] }, { glow: 2, jit: 0 });
    }
    b.boxC(0.02, 0.1, 0.02, T, { p: [0, 1.4, 0.112] }, { glow: 0.8, jit: 0 });
    // 左手舉著暗紫法球
    b.boxC(0.09, 0.28, 0.1, A, { p: [-0.33, 0.95, 0.1], r: [-0.9, 0, 0.2] }, { shine: 0.4 });
    b.ico(0.06, 0, AL, { p: [-0.36, 0.86, 0.24] });
    b.ico(0.1, 1, '#b04cff', { p: [-0.36, 0.96, 0.3] }, { glow: 1.3, shine: 1, top: '#ffb0ff', jit: 0 });
  }));
  // 披風
  const capeP = pivot(0, 1.14, -0.13); rig.add(capeP);
  capeP.add(part('en:nightLord:cape', (b) => {
    const pts = [[-0.24, 0], [0.24, 0], [0.42, -0.9], [0.32, -1.04], [0.2, -0.96], [0.08, -1.08], [-0.06, -0.96], [-0.18, -1.07], [-0.3, -0.95], [-0.42, -0.9]];
    b.shape(pts, 0.04, C.nightCape, { p: [0, 0, -0.02], r: [0.18, 0, 0] }, { top: '#b02a55', jit: 0.05 });
    b.shape(pts.map(([x, y]) => [x * 0.94, y * 0.97]), 0.02, C.nightCapeIn, { p: [0, -0.01, 0.02], r: [0.18, 0, 0] }, { jit: 0.03 });
  }));
  // 右手大劍
  const swordP = pivot(0.33, 1.05, 0.02); rig.add(swordP);
  swordP.add(part('en:nightLord:sword', (b) => {
    b.boxC(0.1, 0.3, 0.11, A, { p: [0, -0.12, 0.02] }, { top: AL, shine: 0.4 });
    b.ico(0.06, 0, AL, { p: [0, -0.28, 0.04] });
    b.boxC(0.03, 0.12, 0.03, C.leather, { p: [0, -0.3, 0.1], r: [H2, 0, 0] });
    b.boxC(0.2, 0.035, 0.04, AL, { p: [0, -0.3, 0.17] }, { shine: 0.5 });
    b.boxC(0.075, 0.016, 0.66, '#3a3650', { p: [0, -0.3, 0.52] }, { shine: 0.8, top: '#5a5478' });
    b.boxC(0.02, 0.018, 0.56, T, { p: [0, -0.29, 0.5] }, { glow: 1.1, jit: 0 });
    b.coneC(0.038, 0.1, 4, '#3a3650', { p: [0, -0.3, 0.9], r: [H2, PI / 4, 0], s: [1, 1, 0.25] }, { shine: 0.8 });
  }));
  swordP.rotation.x = 0.55;
  const legs = [];
  for (const sx of [-1, 1]) {
    const p = pivot(sx * 0.12, 0.6, 0); rig.add(p);
    p.add(part('en:nightLord:leg', (b) => {
      b.box(0.14, 0.3, 0.16, AL, { p: [0, -0.3, 0] }, { top: A });
      b.boxC(0.15, 0.08, 0.06, AL, { p: [0, -0.3, 0.08] }, { shine: 0.5 });
      b.cone(0.03, 0.08, 4, T, { p: [0, -0.32, 0.1], r: [H2, 0, 0] }, { glow: 0.5 });
      b.box(0.13, 0.28, 0.15, A, { p: [0, -0.58, 0] }, { shine: 0.4 });
      b.box(0.15, 0.06, 0.24, AL, { p: [0, -0.6, 0.04] }, { shine: 0.4 });
    }));
    legs.push(p);
  }
  const orbHalo = halo('#b04cff', 0.7, 0.75); orbHalo.position.set(-0.36, 0.96, 0.3); rig.add(orbHalo);
  const eyeHalo = halo(C.eyeRed, 0.28, 0.65); eyeHalo.position.set(0, 1.33, 0.16); rig.add(eyeHalo);
  const skin = makeSkin(g);
  let ph = Math.random() * TAU, t = Math.random() * 5, atk = 0;
  g.userData = {
    kind: 'enemy', type: 'nightLord', height: 1.75, boss: true,
    hit() { skin.hit(); },
    update(dt, s = {}) {
      skin.update(dt, s.frozen);
      if (s.frozen) return;
      t += dt;
      const k = s.slowed ? 0.55 : 1;
      const mv = !!s.moving;
      if (mv) ph += dt * 3.6 * k;
      const sw = mv ? Math.sin(ph) * 0.42 : 0;
      legs[0].rotation.x = sw; legs[1].rotation.x = -sw;
      rig.position.y = mv ? Math.abs(Math.cos(ph)) * 0.035 : Math.sin(t * 1.6) * 0.008;
      rig.rotation.z = mv ? Math.sin(ph) * 0.03 : 0;
      capeP.rotation.x = 0.12 + (mv ? 0.12 + Math.sin(ph * 2) * 0.05 : 0) + Math.sin(t * 1.3) * 0.04;
      capeP.rotation.z = Math.sin(t * 0.9) * 0.03;
      if (s.attacking) { atk += dt * 3.2; swordP.rotation.x = 0.55 - Math.max(0, Math.sin(atk)) * 1.6; }
      else swordP.rotation.x = 0.55 + sw * 0.2;
      const hs = 0.7 + Math.sin(t * 3) * 0.1;
      orbHalo.scale.set(hs, hs, 1);
    },
  };
  return g;
}

// ---------------------------------------------------------------------------
// 飛行敵人（原點在身體中心）
// ---------------------------------------------------------------------------
function flyer(g, rig, wings, opt) {
  const skin = makeSkin(g);
  let t = Math.random() * 5, ph = Math.random() * TAU;
  return {
    hit() { skin.hit(); },
    update(dt, s = {}) {
      skin.update(dt, s.frozen);
      if (s.frozen) return;
      t += dt;
      ph += dt * opt.freq * (s.slowed ? 0.55 : 1);
      const f = Math.sin(ph);
      const a = opt.base + f * opt.amp;
      wings[0].rotation.z = a; wings[1].rotation.z = -a;
      rig.position.y = -f * opt.bob + Math.sin(t * 1.7) * opt.bob * 0.5;
      rig.rotation.x = opt.pitch + Math.cos(ph) * 0.05;
    },
  };
}

function gargoyle() {
  const g = new THREE.Group();
  const rig = new THREE.Group(); g.add(rig);
  rig.add(part('en:gargoyle:body', (b) => {
    b.dodec(0.15, C.gargoyle, { p: [0, 0, 0], r: [0.4, 0, 0], s: [1, 1.15, 1.1] }, { top: C.gargoyleLight, wob: 0.01 });
    b.ico(0.1, 0, C.gargoyle, { p: [0, 0.12, 0.15], s: [1.05, 0.9, 1] }, { top: C.gargoyleLight, wob: 0.008 });
    b.boxC(0.1, 0.06, 0.08, C.gargoyleDark, { p: [0, 0.09, 0.24] });
    for (const sx of [-1, 1]) {
      b.cone(0.03, 0.15, 3, C.gargoyleDark, { p: [sx * 0.05, 0.19, 0.13], r: [-0.9, 0, sx * -0.3] }, { top: '#c8ccd4' });
      b.boxC(0.035, 0.022, 0.02, C.eyeOrange, { p: [sx * 0.04, 0.13, 0.245] }, { glow: 1.6, jit: 0 });
      // 爪子與腳
      b.boxC(0.04, 0.12, 0.04, C.gargoyleDark, { p: [sx * 0.08, -0.08, 0.12], r: [0.5, 0, 0] });
      b.boxC(0.05, 0.1, 0.06, C.gargoyleDark, { p: [sx * 0.07, -0.13, -0.05], r: [-0.4, 0, 0] });
    }
    // 尾巴
    b.coneC(0.04, 0.26, 4, C.gargoyleDark, { p: [0, -0.1, -0.22], r: [-H2 - 0.5, 0, 0] });
    b.tet(0.045, C.gargoyleDark, { p: [0, -0.2, -0.34] });
  }));
  const wingShape = [[0, 0.06], [0.16, 0.16], [0.36, 0.2], [0.46, 0.1], [0.4, 0.0], [0.33, -0.1], [0.24, -0.04], [0.16, -0.14], [0.08, -0.05], [0.02, -0.06]];
  const wings = [];
  for (const sx of [1, -1]) {
    const p = pivot(sx * 0.1, 0.06, -0.02); rig.add(p);
    p.add(part('en:gargoyle:wing', (b) => {
      b.shape(wingShape, 0.025, C.gargoyleDark, { r: [H2, 0, 0], s: [1.05, 1.1, 1] }, { jit: 0.06 });
      b.boxC(0.5, 0.035, 0.035, C.gargoyle, { p: [0.22, 0.01, 0.11], r: [0, -0.35, 0] }, { top: C.gargoyleLight });
      b.cone(0.02, 0.08, 3, C.gargoyleLight, { p: [0.4, 0.01, 0.2], r: [H2, 0, 0] });
    }));
    p.scale.x = sx;
    wings.push(p);
  }
  const w = flyer(g, rig, wings, { freq: 7, amp: 0.55, base: 0.2, bob: 0.05, pitch: 0.05 });
  g.userData = { kind: 'enemy', type: 'gargoyle', height: 0.35, flying: true, hit: w.hit, update: w.update };
  return g;
}

function bat() {
  const g = new THREE.Group();
  const rig = new THREE.Group(); g.add(rig);
  rig.add(part('en:bat:body', (b) => {
    b.dodec(0.1, C.bat, { s: [1, 1.1, 0.95] }, { top: '#a774ee', jit: 0.05 });
    b.ico(0.055, 0, '#c9a6ff', { p: [0, -0.035, 0.06], s: [1, 1, 0.6] });
    for (const sx of [-1, 1]) {
      b.cone(0.045, 0.13, 4, C.bat, { p: [sx * 0.05, 0.06, 0], r: [0, 0, sx * -0.35] }, { top: '#f0a0d8' });
      b.boxC(0.035, 0.035, 0.02, '#ffe94a', { p: [sx * 0.035, 0.02, 0.09] }, { glow: 1.6, jit: 0 });
      b.coneC(0.01, 0.03, 3, C.white, { p: [sx * 0.018, -0.03, 0.088], r: [PI, 0, 0] }, { jit: 0 });
      b.boxC(0.02, 0.05, 0.02, C.batDark, { p: [sx * 0.03, -0.1, -0.01] });
    }
  }));
  const shape = [[0, 0.04], [0.12, 0.1], [0.28, 0.1], [0.34, 0.01], [0.27, -0.02], [0.22, -0.09], [0.15, -0.03], [0.09, -0.09], [0.03, -0.04]];
  const wings = [];
  for (const sx of [1, -1]) {
    const p = pivot(sx * 0.07, 0.01, -0.01); rig.add(p);
    p.add(part('en:bat:wing', (b) => {
      b.shape(shape, 0.02, C.batWing, { r: [H2, 0, 0] }, { jit: 0.05 });
      b.boxC(0.34, 0.025, 0.025, C.batDark, { p: [0.16, 0.005, 0.07], r: [0, -0.15, 0] });
      b.boxC(0.2, 0.02, 0.02, C.batDark, { p: [0.18, 0.005, -0.0], r: [0, 0.35, 0] });
    }));
    p.scale.x = sx;
    wings.push(p);
  }
  const w = flyer(g, rig, wings, { freq: 15, amp: 0.75, base: 0.15, bob: 0.03, pitch: 0 });
  g.userData = { kind: 'enemy', type: 'bat', height: 0.2, flying: true, hit: w.hit, update: w.update };
  return g;
}

// ---------------------------------------------------------------------------
const BUILD = {
  slime: () => slimeLike('slime'), slimelet: () => slimeLike('slimelet'), splitter, goblin, skeleton,
  gargoyle, bat, golem, shaman, slimeKing, nightLord,
};

/** makeEnemy(type) */
export function makeEnemy(type) {
  const fn = BUILD[type] || BUILD.slime;
  const g = fn();
  g.name = `enemy:${type}`;
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}
export const ENEMY_TYPES = Object.keys(BUILD);
