// 守護燈、出生傳送門、投射物（擁有者：B）
import * as THREE from 'three';
import { C, MAT, halo, haloOwn, additive, markNoDark } from '../palette.js';
import { part, glowPart, pivot, cachedGeo, PI, TAU, clamp, damp } from './lib.js';
import { starPts } from './heroes2.js';

const H2 = PI / 2;

// ===========================================================================
// 守護燈
// ===========================================================================
export function makeLamp() {
  const g = new THREE.Group();
  g.name = 'lamp';
  g.add(part('prop:lamp:base', (b) => {
    // 三層八角石階
    b.cyl(0.45, 0.48, 0.1, 8, C.stoneDark, { r: [0, PI / 8, 0] }, { top: C.stone, wob: 0.008 });
    b.cyl(0.37, 0.39, 0.1, 8, C.stone, { p: [0, 0.1, 0], r: [0, PI / 8, 0] }, { top: C.stoneLight, wob: 0.006 });
    b.cyl(0.29, 0.3, 0.08, 8, C.stoneLight, { p: [0, 0.2, 0], r: [0, PI / 8, 0] }, { wob: 0.004 });
    b.cyl(0.305, 0.305, 0.025, 8, C.gold, { p: [0, 0.27, 0], r: [0, PI / 8, 0] }, { shine: 1 });
    // 第二層的四顆小光石
    for (let i = 0; i < 4; i++) {
      const a = i / 4 * TAU + PI / 4;
      b.cyl(0.05, 0.06, 0.04, 6, C.stoneDark, { p: [Math.sin(a) * 0.4, 0.1, Math.cos(a) * 0.4] });
      b.oct(0.04, C.lampGlow, { p: [Math.sin(a) * 0.4, 0.17, Math.cos(a) * 0.4], s: [1, 1.3, 1] }, { glow: 1, shine: 1, jit: 0 });
    }
    // 石柱（雕花）
    b.lathe([[0.16, 0], [0.13, 0.05], [0.1, 0.1], [0.095, 0.48], [0.12, 0.53], [0.17, 0.58], [0.21, 0.61], [0.21, 0.66], [0, 0.66]], 8, C.stoneLight, { p: [0, 0.28, 0] }, { top: C.white, jit: 0.05 });
    b.cylC(0.105, 0.105, 0.03, 8, C.gold, { p: [0, 0.42, 0] }, { shine: 1 });
    b.cylC(0.105, 0.105, 0.03, 8, C.gold, { p: [0, 0.7, 0] }, { shine: 1 });
    // 燈籠底座、框架、屋頂
    b.cyl(0.19, 0.17, 0.05, 8, C.ironDark, { p: [0, 0.94, 0], r: [0, PI / 8, 0] }, { shine: 0.5 });
    b.cyl(0.2, 0.2, 0.02, 8, C.gold, { p: [0, 0.985, 0], r: [0, PI / 8, 0] }, { shine: 1 });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      b.box(0.04, 0.36, 0.04, C.ironDark, { p: [sx * 0.15, 0.99, sz * 0.15] }, { shine: 0.5 });
      b.ico(0.03, 0, C.gold, { p: [sx * 0.15, 1.36, sz * 0.15] }, { shine: 1 });
    }
    for (const s of [-1, 1]) {
      b.box(0.32, 0.03, 0.03, C.ironDark, { p: [0, 1.17, s * 0.15] });
      b.box(0.03, 0.03, 0.32, C.ironDark, { p: [s * 0.15, 1.17, 0] });
    }
    b.box(0.38, 0.04, 0.38, C.ironDark, { p: [0, 1.35, 0] }, { shine: 0.5 });
    b.cone(0.3, 0.22, 4, C.iron, { p: [0, 1.39, 0], r: [0, PI / 4, 0] }, { top: C.ironDark, shine: 0.5 });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.cone(0.025, 0.08, 4, C.gold, { p: [sx * 0.2, 1.37, sz * 0.2], r: [sz * 0.5, 0, -sx * 0.5] }, { shine: 1 });
    b.cyl(0.03, 0.04, 0.05, 6, C.gold, { p: [0, 1.58, 0] }, { shine: 1 });
    b.ico(0.045, 0, C.gold, { p: [0, 1.66, 0] }, { shine: 1 });
    b.torus(0.04, 0.01, 3, 6, TAU, C.ironDark, { p: [0, 1.73, 0] });
  }, { receive: true }));

  // 燈罩玻璃與火焰：自己的材質，依燈光比例調亮度
  const glassMat = markNoDark(new THREE.MeshBasicMaterial({ color: new THREE.Color(C.lampGlow), toneMapped: false }));
  const glass = new THREE.Mesh(cachedGeo('prop:lamp:glassGeo', () => new THREE.BoxGeometry(0.25, 0.32, 0.25).translate(0, 1.16, 0)), glassMat);
  g.add(glass);
  const flameMat = markNoDark(new THREE.MeshBasicMaterial({ color: new THREE.Color(C.flameCore), toneMapped: false }));
  const flame = new THREE.Mesh(cachedGeo('prop:lamp:flameGeo', () => new THREE.OctahedronGeometry(0.07, 0).scale(1, 1.6, 1)), flameMat);
  flame.position.y = 1.15;
  g.add(flame);
  const glowA = haloOwn(C.lampGlow, 1.6, 0.6); glowA.position.y = 1.16; g.add(glowA);
  const glowB = haloOwn('#fff0c0', 0.6, 0.9); glowB.position.y = 1.16; g.add(glowB);
  // 繞著燈飛的光點
  const motes = [];
  const moteMat = glowB.material.clone(); moteMat.color.set(C.lampGlow);
  for (let i = 0; i < 4; i++) {
    const m = new THREE.Sprite(moteMat); m.scale.set(0.09, 0.09, 1); m.renderOrder = 2; g.add(m); motes.push(m);
  }

  const light = new THREE.PointLight('#ffc46b', 3, 7.5, 1.3);
  light.position.y = 1.16;
  light.castShadow = false;
  g.add(light);

  const dark = new THREE.Color('#3a2c22'), bright = new THREE.Color(C.lampGlow), tmp = new THREE.Color();
  const fcBright = new THREE.Color(C.flameCore);
  let t = 0, cur = 1, night = 0;
  g.userData = {
    kind: 'lamp', light, height: 1.75,
    update(dt, frac = 1, time = 'day') {
      t += dt;
      cur = damp(cur, clamp(frac, 0, 1), 4, dt);
      const tn = time === 'night' ? 1 : time === 'dusk' ? 0.55 : 0;
      night = damp(night, tn, 1.5, dt);
      const fl = 1 + Math.sin(t * 13) * 0.05 + Math.sin(t * 23.7) * 0.035 + Math.sin(t * 5.3) * 0.04;
      const k = cur > 0.001 ? Math.pow(cur, 0.6) * fl : 0;
      light.intensity = (1.6 + night * 5.2) * k;
      light.distance = 4 + 4 * cur + night * 1.5;
      glassMat.color.copy(tmp.copy(dark).lerp(bright, clamp(k, 0, 1)));
      flame.visible = cur > 0.02;
      const fs = 0.55 + 0.45 * cur;
      flame.scale.set(fs * (1 + Math.sin(t * 17) * 0.08), fs * (1 + Math.sin(t * 11) * 0.15), fs);
      flame.rotation.y = t * 2;
      flameMat.color.copy(tmp.copy(dark).lerp(fcBright, clamp(k, 0, 1)));
      const ga = (0.32 + night * 0.4) * k;
      glowA.material.opacity = ga;
      const gs = 1.2 + cur * 0.6 + night * 0.5;
      glowA.scale.set(gs * fl, gs * fl, 1);
      glowB.material.opacity = 0.85 * k;
      moteMat.opacity = (0.5 + night * 0.5) * clamp(cur * 1.3, 0, 1);
      for (let i = 0; i < motes.length; i++) {
        const a = t * (0.6 + i * 0.13) + i * 1.7;
        const r = 0.34 + Math.sin(t * 0.9 + i) * 0.08;
        motes[i].position.set(Math.sin(a) * r, 1.0 + ((t * 0.18 + i * 0.27) % 1) * 0.8, Math.cos(a) * r);
      }
    },
  };
  g.userData.update(0, 1, 'day');
  return g;
}

// ===========================================================================
// 出生傳送門：暗色石拱門＋紫色旋轉漩渦
// ===========================================================================
function swirlGeometry(arms, turns, rings, inner, outer) {
  return cachedGeo(`prop:swirl:${arms}:${turns}:${rings}`, () => {
    const pos = [], col = [];
    const cIn = new THREE.Color('#ffd0ff'), cMid = new THREE.Color(C.portal), cOut = new THREE.Color('#000000');
    const w = 0.42; // 每條旋臂的寬度（弧度比例）
    for (let a = 0; a < arms; a++) {
      const base = (a / arms) * TAU;
      for (let i = 0; i < rings; i++) {
        const f0 = i / rings, f1 = (i + 1) / rings;
        const r0 = inner + (outer - inner) * f0, r1 = inner + (outer - inner) * f1;
        const t0 = base + f0 * turns * TAU, t1 = base + f1 * turns * TAU;
        const wid0 = w * (1 - f0 * 0.4), wid1 = w * (1 - f1 * 0.4);
        const p = (r, th) => [Math.cos(th) * r, Math.sin(th) * r, 0];
        const A = p(r0, t0 - wid0), B = p(r0, t0 + wid0), Cc = p(r1, t1 - wid1), D = p(r1, t1 + wid1);
        const cc = (f) => { const c = new THREE.Color(); if (f < 0.5) c.copy(cIn).lerp(cMid, f * 2); else c.copy(cMid).lerp(cOut, (f - 0.5) * 2); return [c.r, c.g, c.b]; };
        const c0 = cc(f0), c1 = cc(f1);
        pos.push(...A, ...B, ...D, ...A, ...D, ...Cc);
        col.push(...c0, ...c0, ...c1, ...c0, ...c1, ...c1);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    return geo;
  });
}

let gateBackMat = null;
function getGateBackMat() {
  if (!gateBackMat) gateBackMat = markNoDark(new THREE.MeshBasicMaterial({ color: new THREE.Color(C.portalDeep), side: THREE.DoubleSide }));
  return gateBackMat;
}

/** makeSpawnGate(theme)：theme === 'cave' 時是岩縫（見 caveGate） */
export function makeSpawnGate(theme) {
  if (theme === 'cave') return caveGate();
  const g = new THREE.Group();
  g.name = 'spawnGate';
  g.add(part('prop:gate:stone', (b) => {
    b.box(1.02, 0.07, 0.46, C.stoneGateDark, {}, { wob: 0.01 });
    for (const sx of [-1, 1]) {
      // 粗石堆成的柱子
      let y = 0.06;
      const hs = [0.3, 0.28, 0.27];
      for (let i = 0; i < 3; i++) {
        b.box(0.26 - i * 0.015, hs[i], 0.3 - i * 0.01, i % 2 ? C.stoneGate : C.stoneGateDark, { p: [sx * (0.4 + (i % 2) * 0.012), y, 0], r: [0, (i - 1) * 0.08 * sx, 0] }, { top: C.stoneGateLight, wob: 0.018, seed: i + sx * 3 });
        y += hs[i];
      }
      // 柱子上的符文
      b.boxC(0.04, 0.12, 0.02, C.portal, { p: [sx * 0.4, 0.5, 0.155] }, { glow: 1.3, jit: 0 });
      b.boxC(0.08, 0.03, 0.02, C.portal, { p: [sx * 0.4, 0.5, 0.155] }, { glow: 1.3, jit: 0 });
      // 頂上的角
      b.cone(0.06, 0.3, 4, C.stoneGateDark, { p: [sx * 0.47, 1.15, 0], r: [0, 0, sx * -0.45] }, { top: '#8a7fa0' });
    }
    // 拱頂楔石
    const n = 7;
    for (let i = 0; i < n; i++) {
      const a = (i / (n - 1)) * PI;
      const x = Math.cos(a) * 0.4, y = 0.91 + Math.sin(a) * 0.36;
      b.boxC(i === 3 ? 0.2 : 0.17, 0.17, i === 3 ? 0.34 : 0.3, i % 2 ? C.stoneGate : C.stoneGateDark, { p: [x, y, 0], r: [0, 0, a - H2] }, { top: C.stoneGateLight, wob: 0.012, seed: 20 + i });
    }
    b.oct(0.05, C.portalPink, { p: [0, 1.27, 0.17], s: [1, 1.3, 0.4] }, { glow: 1.5, jit: 0 });
    // 地上的碎石
    for (const [x, z, r] of [[-0.52, 0.2, 0.06], [0.55, -0.15, 0.05], [0.3, 0.26, 0.04], [-0.3, -0.24, 0.045]]) b.dodec(r, C.stoneGateDark, { p: [x, 0.04, z] }, { wob: 0.01 });
  }, { receive: true }));

  // 漩渦
  const vortex = pivot(0, 0.62, 0); g.add(vortex);
  vortex.scale.set(0.3, 0.55, 1);
  const back = new THREE.Mesh(cachedGeo('prop:gate:back', () => new THREE.CircleGeometry(1, 20)), getGateBackMat());
  vortex.add(back);
  const s1 = new THREE.Mesh(swirlGeometry(3, 0.9, 10, 0.02, 1.0), additive('#ffffff', 0.95, true));
  const s2 = new THREE.Mesh(swirlGeometry(4, -0.7, 8, 0.0, 0.8), additive('#ff9bf2', 0.7, true));
  s1.position.z = 0.01; s2.position.z = 0.02;
  s1.renderOrder = 3; s2.renderOrder = 3;
  vortex.add(s1, s2);
  const core = halo('#ffb8ff', 0.45, 0.85); core.position.set(0, 0.62, 0.03); g.add(core);
  const glow = halo(C.portal, 1.5, 0.45); glow.position.set(0, 0.62, 0.0); g.add(glow);
  // 被吸進去的光點
  const motes = [];
  for (let i = 0; i < 6; i++) { const m = halo('#e0a0ff', 0.08, 0.9); g.add(m); motes.push(m); }

  let t = Math.random() * 10;
  g.userData = {
    kind: 'spawnGate', height: 1.4,
    update(dt) {
      t += dt;
      s1.rotation.z = -t * 2.2;
      s2.rotation.z = t * 1.4;
      const p = 1 + Math.sin(t * 2.3) * 0.05;
      vortex.scale.set(0.3 * p, 0.55 * p, 1);
      const gs = 1.4 + Math.sin(t * 1.7) * 0.15;
      glow.scale.set(gs, gs, 1);
      const cs = 0.45 + Math.sin(t * 3.1) * 0.08;
      core.scale.set(cs, cs, 1);
      for (let i = 0; i < motes.length; i++) {
        const f = ((t * 0.45 + i / motes.length) % 1);
        const a = i * 2.4 + f * 5;
        const r = (1 - f) * 0.55;
        motes[i].position.set(Math.cos(a) * r * 0.75, 0.62 + Math.sin(a) * r, 0.05 + (1 - f) * 0.25);
        const ms = 0.05 + (1 - f) * 0.06;
        motes[i].scale.set(ms, ms, 1);
      }
    },
  };
  g.userData.update(0);
  return g;
}

// ===========================================================================
// 洞窟出生點：兩塊傾斜的大岩石夾出一道岩縫，縫裡是紫色漩渦，底下長著發光的紫水晶
// ===========================================================================
function caveGate() {
  const g = new THREE.Group();
  g.name = 'spawnGate:cave';
  g.add(part('prop:caveGate:rock', (b) => {
    const R = C.caveStone, RD = C.caveStoneDark, RL = C.caveStoneLight;
    // 地上的碎石堆
    b.dodec(0.3, RD, { p: [0, 0.02, -0.12], s: [1.9, 0.35, 1.1] }, { top: R, wob: 0.03 });
    for (const sx of [-1, 1]) {
      // 兩側的大岩柱（往中間傾斜，頂端靠在一起形成三角形的縫）
      b.dodec(0.3, R, { p: [sx * 0.36, 0.42, -0.02], r: [0.2, sx * 0.4, sx * 0.32], s: [0.85, 1.65, 0.85] }, { top: RL, wob: 0.035, seed: sx + 3 });
      b.dodec(0.22, RD, { p: [sx * 0.5, 0.16, 0.1], r: [0.4, sx, 0.2], s: [1, 0.8, 1] }, { top: R, wob: 0.03, seed: sx + 7 });
      b.cone(0.1, 0.36, 5, RD, { p: [sx * 0.2, 0.92, -0.02], r: [0.1, 0, sx * 0.55] }, { top: RL, wob: 0.01 });
    }
    // 頂上的壓頂石
    b.dodec(0.2, RD, { p: [0, 1.06, -0.06], r: [0.5, 0.3, 0.1], s: [1.4, 0.7, 0.9] }, { top: RL, wob: 0.025 });
    // 後面堵住（看起來像洞口）
    b.dodec(0.35, C.caveStoneDeep, { p: [0, 0.45, -0.32], s: [1.1, 1.4, 0.6] }, { top: RD, wob: 0.03 });
    for (const [x, z, r] of [[-0.55, 0.3, 0.07], [0.6, 0.25, 0.06], [0.32, 0.42, 0.05], [-0.25, 0.45, 0.045]]) b.dodec(r, RD, { p: [x, 0.03, z] }, { top: R, wob: 0.01 });
  }, { receive: true }));
  // 發光的紫水晶與裂紋
  g.add(glowPart('prop:caveGate:glow', (b) => {
    for (const [x, z, h, rx, rz] of [[-0.42, 0.2, 0.3, 0.3, 0.4], [-0.32, 0.28, 0.18, -0.2, 0.6], [0.45, 0.18, 0.26, 0.3, -0.5], [0.36, 0.3, 0.15, -0.3, -0.3], [0.05, 0.36, 0.12, 0.6, 0.1]]) {
      b.cone(0.05, h, 5, C.glowViolet, { p: [x, 0.02, z], r: [rx, 0, rz] }, { top: C.glowVioletCore, glow: 1.1, jit: 0.05 });
    }
    for (const sx of [-1, 1]) b.boxC(0.025, 0.28, 0.02, C.portal, { p: [sx * 0.3, 0.55, 0.21], r: [0.2, sx * 0.4, sx * 0.32] }, { glow: 1.3, jit: 0 });
  }));
  // 岩縫裡的漩渦（窄長）
  const vortex = pivot(0, 0.5, 0.0); g.add(vortex);
  vortex.scale.set(0.2, 0.42, 1);
  const back = new THREE.Mesh(cachedGeo('prop:gate:back', () => new THREE.CircleGeometry(1, 20)), getGateBackMat());
  vortex.add(back);
  const s1 = new THREE.Mesh(swirlGeometry(3, 0.9, 10, 0.02, 1.0), additive('#ffffff', 0.95, true));
  const s2 = new THREE.Mesh(swirlGeometry(4, -0.7, 8, 0.0, 0.8), additive('#ff9bf2', 0.7, true));
  s1.position.z = 0.01; s2.position.z = 0.02; s1.renderOrder = 3; s2.renderOrder = 3;
  vortex.add(s1, s2);
  const core = halo('#ffb8ff', 0.4, 0.85); core.position.set(0, 0.5, 0.05); g.add(core);
  const glow = halo(C.portal, 1.4, 0.45); glow.position.set(0, 0.45, 0.1); g.add(glow);
  // 地上的紫色光圈
  const ring = new THREE.Mesh(cachedGeo('prop:caveGate:ring', () => new THREE.RingGeometry(0.15, 0.62, 18, 1).rotateX(-H2)), additive(C.portal, 0.22));
  ring.position.set(0, 0.03, 0.2); ring.renderOrder = 2; g.add(ring);
  const motes = [];
  for (let i = 0; i < 6; i++) { const m = halo('#e0a0ff', 0.08, 0.9); g.add(m); motes.push(m); }
  let t = Math.random() * 10;
  g.userData = {
    kind: 'spawnGate', theme: 'cave', height: 1.25,
    update(dt) {
      t += dt;
      s1.rotation.z = -t * 2.2;
      s2.rotation.z = t * 1.4;
      const p = 1 + Math.sin(t * 2.3) * 0.05;
      vortex.scale.set(0.2 * p, 0.42 * p, 1);
      const gs = 1.3 + Math.sin(t * 1.7) * 0.15;
      glow.scale.set(gs, gs, 1);
      const cs = 0.4 + Math.sin(t * 3.1) * 0.08;
      core.scale.set(cs, cs, 1);
      const rs = 1 + Math.sin(t * 2) * 0.06;
      ring.scale.set(rs, 1, rs);
      for (let i = 0; i < motes.length; i++) {
        // 光點從地上慢慢飄進岩縫
        const f = ((t * 0.4 + i / motes.length) % 1);
        const a = i * 2.4;
        const r = (1 - f) * 0.5;
        motes[i].position.set(Math.cos(a) * r, 0.08 + f * 0.45, 0.25 + Math.sin(a) * r * 0.6 - f * 0.2);
        const ms = 0.05 + (1 - f) * 0.05;
        motes[i].scale.set(ms, ms, 1);
      }
    },
  };
  g.userData.update(0);
  return g;
}

// ===========================================================================
// 投射物（正面朝 +Z；view 會用 lookAt 對準速度方向）
// ===========================================================================
const PROJ = {
  arrow: () => {
    const m = part('proj:arrow', (b) => {
      b.boxC(0.018, 0.018, 0.34, C.woodPale, {}, { jit: 0 });
      b.coneC(0.026, 0.07, 4, C.steel, { p: [0, 0, 0.2], r: [H2, 0, 0] }, { shine: 1 });
      b.boxC(0.06, 0.005, 0.08, C.red, { p: [0, 0, -0.14] }, { jit: 0 });
      b.boxC(0.005, 0.06, 0.08, C.white, { p: [0, 0, -0.14] }, { jit: 0 });
    });
    return { obj: m, spin: 0 };
  },
  bolt: () => {
    const m = part('proj:bolt', (b) => {
      b.boxC(0.028, 0.028, 0.24, C.wood, {}, { jit: 0 });
      b.coneC(0.04, 0.08, 4, C.steel, { p: [0, 0, 0.15], r: [H2, PI / 4, 0] }, { shine: 1 });
      b.boxC(0.07, 0.006, 0.06, C.gold, { p: [0, 0, -0.1] }, { jit: 0, shine: 0.6 });
      b.boxC(0.006, 0.07, 0.06, C.gold, { p: [0, 0, -0.1] }, { jit: 0, shine: 0.6 });
    });
    return { obj: m, spin: 0 };
  },
  rock: () => ({ obj: part('proj:rock', (b) => b.dodec(0.085, C.stoneDark, {}, { top: C.stone, wob: 0.01 })), spin: 6 }),
  boulder: () => ({
    obj: part('proj:boulder', (b) => {
      b.dodec(0.15, C.stoneDark, {}, { top: C.stone, wob: 0.018 });
      b.ico(0.07, 0, C.moss, { p: [0.05, 0.1, 0.02], s: [1.3, 0.4, 1] });
    }), spin: 4,
  }),
  firebomb: () => {
    const g = new THREE.Group();
    g.add(part('proj:firebomb', (b) => {
      b.ico(0.075, 1, C.ironDark, {}, { shine: 0.4 });
      b.cylC(0.078, 0.078, 0.025, 8, C.copper, { r: [H2, 0, 0] }, { shine: 0.6 });
      b.cyl(0.025, 0.03, 0.04, 5, C.woodDark, { p: [0, 0.06, 0] });
      b.ico(0.05, 0, C.fire, { p: [0, 0.07, -0.05], s: [1, 1, 1.8] }, { glow: 1.5, jit: 0 });
      b.coneC(0.04, 0.16, 5, C.flame, { p: [0, 0.03, -0.12], r: [-H2, 0, 0] }, { glow: 1.5, jit: 0, top: C.fire });
    }));
    const h = halo(C.flame, 0.45, 0.8); g.add(h);
    return { obj: g, spin: 0, halo: h, flicker: true };
  },
  orb: () => {
    const g = new THREE.Group();
    g.add(part('proj:orb', (b) => b.ico(0.07, 1, C.magic, {}, { glow: 1.2, shine: 1, top: C.magicPink, jit: 0.08 }), { cast: false }));
    const h = halo(C.magic, 0.5, 0.85); g.add(h);
    return { obj: g, spin: 5, halo: h, pulse: true };
  },
  frost: () => {
    const g = new THREE.Group();
    g.add(part('proj:frost', (b) => {
      b.oct(0.06, C.frostDeep, { s: [0.7, 0.7, 2.0] }, { glow: 0.9, shine: 1, top: C.ice, jit: 0.05 });
      b.oct(0.035, C.ice, { p: [0.05, 0, -0.04], s: [0.6, 0.6, 1.6], r: [0, 0.5, 0] }, { glow: 1, jit: 0 });
      b.oct(0.035, C.ice, { p: [-0.05, 0, -0.04], s: [0.6, 0.6, 1.6], r: [0, -0.5, 0] }, { glow: 1, jit: 0 });
    }, { cast: false }));
    const h = halo(C.frost, 0.45, 0.85); g.add(h);
    return { obj: g, spinZ: 6, halo: h };
  },
  lightning: () => {
    const g = new THREE.Group();
    g.add(part('proj:spark', (b) => b.oct(0.05, C.lightning, { s: [1, 1, 1.8] }, { glow: 1.6, jit: 0 }), { cast: false }));
    const h = halo(C.electric, 0.4, 0.9); g.add(h);
    return { obj: g, spinZ: 10, halo: h, pulse: true };
  },
  // ===== 第二章（英雄）：發光零件都用 glowPart（noDark） =====
  fairyBolt: () => {
    // 亮綠光彈＋往後拖的光尾＋兩片小葉子
    const g = new THREE.Group();
    g.add(glowPart('proj:fairyBolt', (b) => {
      b.ico(0.06, 1, C.fairyGlow, {}, { glow: 1.5, top: C.white, jit: 0 });
      b.coneC(0.05, 0.3, 6, '#5cf07a', { p: [0, 0, -0.17], r: [-H2, 0, 0] }, { glow: 1.3, top: C.fairyGlow, jit: 0 });
      for (const sx of [-1, 1]) b.oct(0.035, C.leafLight, { p: [sx * 0.07, 0, -0.05], s: [0.5, 0.25, 1.3], r: [0, sx * 0.4, 0] }, { glow: 1.1, jit: 0 });
    }));
    const h = halo(C.fairyGlow, 0.5, 0.9); g.add(h);
    return { obj: g, spinZ: 7, halo: h, pulse: true };
  },
  fireball: () => {
    // 火球核心＋三道往後竄的火焰（會跳動）
    const g = new THREE.Group();
    g.add(glowPart('proj:fireball', (b) => {
      b.ico(0.085, 1, C.fire, {}, { glow: 1.5, top: C.flameCore, jit: 0.08 });
      b.ico(0.05, 0, C.flameCore, { p: [0, 0, 0.03] }, { glow: 1.8, jit: 0 });
    }));
    const flames = pivot(); g.add(flames);
    flames.add(glowPart('proj:fireball:flames', (b) => {
      b.coneC(0.07, 0.26, 6, C.flame, { p: [0, 0, -0.15], r: [-H2, 0, 0] }, { glow: 1.4, top: C.fire, jit: 0.05 });
      for (let i = 0; i < 3; i++) {
        const a = i / 3 * TAU;
        b.coneC(0.035, 0.18, 4, C.fireLick || '#ffcf5a', { p: [Math.sin(a) * 0.06, Math.cos(a) * 0.06, -0.1], r: [-H2 + Math.cos(a) * 0.4, 0, 0], o: 'XYZ' }, { glow: 1.4, top: C.fire, jit: 0 });
      }
    }));
    const h = halo(C.flame, 0.6, 0.85); g.add(h);
    return { obj: g, halo: h, flicker: true, flames };
  },
  starBolt: () => {
    // 五角星光彈（繞前進方向自轉）
    const g = new THREE.Group();
    g.add(glowPart('proj:starBolt', (b) => {
      b.shape(starPts(0.085, 0.036), 0.03, C.starGold, {}, { glow: 1.5, top: C.starCore, jit: 0 });
      b.ico(0.03, 0, C.white, {}, { glow: 1.8, jit: 0 });
      b.coneC(0.03, 0.2, 5, '#c8b0ff', { p: [0, 0, -0.12], r: [-H2, 0, 0] }, { glow: 1.3, top: C.starGold, jit: 0 });
    }));
    const h = halo('#fff0a0', 0.45, 0.85); g.add(h);
    return { obj: g, spinZ: 9, halo: h, pulse: true };
  },
  laser: () => {
    // 佔位：細長的青色光棒（雷射由 C 畫）
    const g = new THREE.Group();
    g.add(glowPart('proj:laser', (b) => b.cylC(0.018, 0.018, 0.6, 5, C.glowCyan, { r: [H2, 0, 0] }, { glow: 1.8, top: C.white, jit: 0 })));
    const h = halo(C.glowCyan, 0.35, 0.8); g.add(h);
    return { obj: g, halo: h, pulse: true };
  },
};

/** makeProjectile(kind)：arrow bolt rock boulder firebomb orb frost、fairyBolt fireball starBolt laser（lightning 也有備用外觀） */
export function makeProjectile(kind) {
  const def = (PROJ[kind] || PROJ.orb)();
  const root = new THREE.Group();
  const spinner = new THREE.Group();
  root.add(spinner); spinner.add(def.obj);
  root.name = `projectile:${kind}`;
  root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  let t = Math.random() * 10;
  const hs = def.halo ? def.halo.scale.x : 0;
  root.userData = {
    kind: 'projectile', type: kind,
    update(dt) {
      t += dt;
      if (def.spin) { spinner.rotation.x += dt * def.spin; spinner.rotation.y += dt * def.spin * 0.6; }
      if (def.spinZ) spinner.rotation.z += dt * def.spinZ;
      if (def.halo && (def.flicker || def.pulse)) {
        const k = def.flicker ? 1 + Math.sin(t * 25) * 0.12 + Math.sin(t * 13) * 0.08 : 1 + Math.sin(t * 12) * 0.1;
        def.halo.scale.set(hs * k, hs * k, 1);
      }
      if (def.flames) {
        def.flames.rotation.z = t * 6;
        def.flames.scale.set(1 + Math.sin(t * 31) * 0.12, 1 + Math.sin(t * 27) * 0.12, 1 + Math.sin(t * 19) * 0.22);
      }
    },
  };
  return root;
}
