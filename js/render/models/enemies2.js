// 第二章敵人：影子幽靈、挖洞地鼠、噴墨蝙蝠、地鼠王、深淵巨蟲（擁有者：B）
// 眼睛、頭燈、發光斑點等都是獨立的 glowPart（材質 MAT.glow，userData.noDark = true），暗處也看得到。
// 原點在腳底中心（噴墨蝙蝠飛行：原點在身體中心），正面朝 +Z。
import * as THREE from 'three';
import { C, MAT, halo } from '../palette.js';
import { part, glowPart, pivot, makeSkin, PI, TAU, clamp, damp } from './lib.js';

const H2 = PI / 2;

// ===========================================================================
// 影子幽靈：半透明紫黑的「布偶鬼」，發光的青白大眼，下擺是一圈飄動的尖角
// ===========================================================================
function ghost() {
  const g = new THREE.Group();
  const rig = pivot(0, 0.2, 0); g.add(rig);
  rig.add(part('en:ghost:body', (b) => {
    // 圓頂頭＋往下張開的身體（下緣開口，下擺尖角接在下面）
    b.lathe([[0.27, 0.0], [0.25, 0.14], [0.22, 0.32], [0.21, 0.46], [0.17, 0.6], [0.09, 0.69], [0, 0.71]], 8, C.ghost, {}, { top: C.ghostTop, jit: 0.05, wob: 0.005 });
    // 舉起的小手（嚇人姿勢）
    for (const sx of [-1, 1]) b.cone(0.065, 0.22, 4, C.ghost, { p: [sx * 0.19, 0.34, 0.06], r: [0.9, 0, -sx * 1.15] }, { top: C.ghostTop });
  }, { mat: MAT.ghost }));
  // 下擺尖角（另外一個 mesh，會飄）＋後面拖的煙尾
  const hem = pivot(0, 0.02, 0); rig.add(hem);
  hem.add(part('en:ghost:hem', (b) => {
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * TAU + 0.2;
      b.cone(0.085, 0.2, 4, C.ghost, { p: [Math.sin(a) * 0.22, 0.04, Math.cos(a) * 0.22], r: [PI - Math.cos(a) * 0.4, 0, -Math.sin(a) * 0.4] }, { top: '#2a2048', jit: 0.05 });
    }
    b.cone(0.11, 0.38, 5, C.ghost, { p: [0, 0.12, -0.16], r: [-H2 - 0.55, 0, 0] }, { top: '#2a2048' });
  }, { mat: MAT.ghost }));
  // 發光的眼睛和嘴
  rig.add(glowPart('en:ghost:eyes', (b) => {
    for (const sx of [-1, 1]) {
      b.ico(0.052, 0, C.ghostEye, { p: [sx * 0.085, 0.47, 0.19], r: [0, sx * 0.35, sx * 0.25], s: [0.8, 1.3, 0.45] }, { glow: 1.6, jit: 0 });
    }
    b.ico(0.045, 0, C.ghostEye, { p: [0, 0.33, 0.205], s: [1.1, 0.8, 0.4] }, { glow: 1.1, jit: 0 });
  }));
  const aura = halo(C.glowViolet, 0.9, 0.3); aura.position.y = 0.4; rig.add(aura);
  const skin = makeSkin(g);
  let t = Math.random() * 10, ph = Math.random() * TAU, lunge = 0;
  g.userData = {
    kind: 'enemy', type: 'ghost', height: 0.92,
    hit() { skin.hit(); },
    update(dt, s = {}) {
      skin.update(dt, s.frozen);
      if (s.frozen) return;
      t += dt;
      const k = s.slowed ? 0.55 : 1;
      ph += dt * (s.moving ? 4 : 2) * k;
      rig.position.y = 0.2 + Math.sin(t * 2.4 * k) * 0.05;
      rig.rotation.z = Math.sin(ph * 0.5) * 0.08;
      lunge = damp(lunge, s.attacking ? 1 + Math.sin(t * 9) * 0.5 : 0, 8, dt);
      rig.rotation.x = (s.moving ? 0.18 : 0.05) + lunge * 0.25;
      rig.position.z = lunge * 0.05;
      hem.rotation.y = Math.sin(ph) * 0.25;
      hem.scale.set(1, 1 + Math.sin(ph * 1.7) * 0.12, 1);
      const as = 0.85 + Math.sin(t * 3) * 0.07;
      aura.scale.set(as, as, 1);
    },
  };
  return g;
}

// ===========================================================================
// 挖洞地鼠：圓滾滾的棕色身體、粉紅鼻、白色大爪子、黃色礦工帽＋頭燈
// ===========================================================================
function moleBody(b, s = 1) {
  b.lathe([[0.2, 0.02], [0.25, 0.14], [0.225, 0.31], [0.14, 0.43], [0, 0.47]].map(([r, y]) => [r * s, y * s]), 7, C.mole, {}, { top: C.moleLight, jit: 0.06, wob: 0.006 * s });
  b.ico(0.17 * s, 0, C.moleBelly, { p: [0, 0.2 * s, 0.1 * s], s: [1, 1.15, 0.7] }, { jit: 0.04 });
  // 鼻吻
  b.cone(0.1 * s, 0.16 * s, 6, C.moleLight, { p: [0, 0.33 * s, 0.16 * s], r: [H2 - 0.15, 0, 0] }, { top: C.moleBelly });
  b.oct(0.05 * s, C.moleNose, { p: [0, 0.35 * s, 0.32 * s], s: [1, 0.85, 0.9] }, { shine: 0.6, jit: 0 });
  // 門牙
  b.boxC(0.05 * s, 0.04 * s, 0.015, C.white, { p: [0, 0.28 * s, 0.25 * s], r: [0.2, 0, 0] }, { jit: 0 });
  // 小耳朵
  for (const sx of [-1, 1]) b.tet(0.05 * s, C.moleDark, { p: [sx * 0.15 * s, 0.4 * s, -0.02 * s], s: [1, 1, 0.6] });
}
function moleClaw(b, s = 1) {
  // 手掌（樞紐在肩膀，往前下方伸）＋三根白爪
  b.box(0.08 * s, 0.13 * s, 0.07 * s, C.moleDark, { p: [0, -0.12 * s, 0.02 * s], r: [0.3, 0, 0] });
  b.oct(0.07 * s, C.moleNose, { p: [0, -0.15 * s, 0.07 * s], s: [1.2, 0.6, 1] });
  for (const x of [-0.035, 0, 0.035]) b.cone(0.02 * s, 0.09 * s, 3, C.claw, { p: [x * s, -0.17 * s, 0.11 * s], r: [H2 + 0.2, 0, 0] }, { jit: 0 });
}
function minerHat(b, s = 1, y = 0.44) {
  b.lathe([[0.13, 0], [0.11, 0.08], [0.06, 0.12], [0, 0.125]].map(([r, yy]) => [r * s, yy * s]), 6, C.minerHat, { p: [0, y * s, -0.01 * s] }, { top: '#ffe07a', shine: 0.5 });
  b.cylC(0.16 * s, 0.16 * s, 0.015 * s, 6, C.minerHatDark, { p: [0, (y + 0.005) * s, 0.01 * s] });
}

function mole() {
  const g = new THREE.Group();
  const rig = new THREE.Group(); g.add(rig);
  rig.add(part('en:mole:body', (b) => {
    moleBody(b);
    minerHat(b);
  }));
  rig.add(glowPart('en:mole:glow', (b) => {
    for (const sx of [-1, 1]) b.boxC(0.035, 0.03, 0.02, '#ffd45a', { p: [sx * 0.07, 0.38, 0.2], r: [0, sx * 0.35, 0] }, { glow: 1.5, jit: 0 });
    b.oct(0.035, C.glowWarmCore, { p: [0, 0.5, 0.13], s: [1, 1, 0.6] }, { glow: 1.6, jit: 0 });
  }));
  const lamp = halo(C.glowWarm, 0.26, 0.7); lamp.position.set(0, 0.5, 0.16); rig.add(lamp);
  const legs = [], arms = [];
  for (const sx of [-1, 1]) {
    const p = pivot(sx * 0.11, 0.08, 0.02); rig.add(p);
    p.add(part('en:mole:foot', (b) => b.box(0.08, 0.08, 0.12, C.moleNose, { p: [0, -0.08, 0.03] }, { top: '#f6b0bd' })));
    legs.push(p);
    const a = pivot(sx * 0.2, 0.28, 0.08); rig.add(a);
    a.add(part('en:mole:claw', (b) => moleClaw(b)));
    a.rotation.z = sx * 0.35;
    arms.push(a);
  }
  const skin = makeSkin(g);
  let ph = Math.random() * TAU, t = Math.random() * 5, atk = 0;
  g.userData = {
    kind: 'enemy', type: 'mole', height: 0.62,
    hit() { skin.hit(); },
    update(dt, s = {}) {
      skin.update(dt, s.frozen);
      if (s.frozen) return;
      t += dt;
      const k = (s.slowed ? 0.55 : 1) * clamp(s.speed || 1, 0.7, 1.5);
      const mv = !!s.moving;
      if (mv) ph += dt * 11 * k;
      const sw = mv ? Math.sin(ph) : 0;
      legs[0].rotation.x = sw * 0.7; legs[1].rotation.x = -sw * 0.7;
      rig.rotation.z = sw * 0.12;
      rig.position.y = mv ? Math.abs(Math.cos(ph)) * 0.03 : Math.sin(t * 2.6) * 0.006;
      rig.rotation.x = mv ? 0.12 : 0;
      if (s.attacking) {
        atk += dt * 9;
        arms[0].rotation.x = -0.4 - Math.max(0, Math.sin(atk)) * 1.3;
        arms[1].rotation.x = -0.4 - Math.max(0, Math.sin(atk + PI)) * 1.3;
      } else {
        // 走路時兩手像游泳一樣往前扒土
        arms[0].rotation.x = -0.5 + sw * 0.5; arms[1].rotation.x = -0.5 - sw * 0.5;
      }
      const ls = 0.26 + Math.sin(t * 7) * 0.02;
      lamp.scale.set(ls, ls, 1);
    },
  };
  return g;
}

// ===========================================================================
// 噴墨蝙蝠（飛行，原點在身體中心）：墨藍色、鼓起的大墨囊、青色眼睛、嘴角滴墨
// ===========================================================================
function inkBat() {
  const g = new THREE.Group();
  const rig = new THREE.Group(); g.add(rig);
  rig.add(part('en:inkBat:body', (b) => {
    // 頭
    b.dodec(0.1, C.ink, { p: [0, 0.1, 0.04], s: [1.05, 0.95, 0.95] }, { top: C.inkLight, jit: 0.05 });
    for (const sx of [-1, 1]) {
      b.cone(0.05, 0.15, 4, C.ink, { p: [sx * 0.06, 0.16, 0.02], r: [0, 0, sx * -0.4] }, { top: '#7d93ff' });
      b.coneC(0.012, 0.035, 3, C.white, { p: [sx * 0.02, 0.04, 0.12], r: [PI, 0, 0] }, { jit: 0 });
      b.boxC(0.025, 0.06, 0.025, C.inkDark, { p: [sx * 0.05, -0.2, -0.02] });
    }
    // 嘴角的墨滴
    b.cone(0.022, 0.05, 4, C.inkDark, { p: [0.03, 0.0, 0.12], r: [PI, 0, 0] }, { shine: 1, jit: 0 });
    b.oct(0.024, C.inkDark, { p: [0.03, -0.03, 0.12] }, { shine: 1, jit: 0 });
  }));
  // 墨囊（會鼓動）
  const sac = pivot(0, -0.09, 0.05); rig.add(sac); sac.scale.setScalar(1.18);
  sac.add(part('en:inkBat:sac', (b) => {
    b.lathe([[0.001, -0.13], [0.09, -0.1], [0.13, -0.02], [0.12, 0.06], [0.07, 0.12], [0, 0.135]], 7, C.inkSac, { s: [1, 1, 0.95] }, { top: C.inkSacTop, shine: 1, jit: 0.03 });
    b.oct(0.04, '#b8c8ff', { p: [-0.05, 0.06, 0.1], s: [1.3, 0.6, 0.6] }, { shine: 1, jit: 0 });
  }));
  rig.add(glowPart('en:inkBat:eyes', (b) => {
    for (const sx of [-1, 1]) b.boxC(0.04, 0.035, 0.02, C.glowCyan, { p: [sx * 0.04, 0.12, 0.13], r: [0, sx * 0.3, sx * -0.25] }, { glow: 1.6, jit: 0 });
  }));
  const shape = [[0, 0.05], [0.13, 0.12], [0.3, 0.13], [0.4, 0.03], [0.32, -0.02], [0.26, -0.1], [0.18, -0.04], [0.11, -0.11], [0.04, -0.05]];
  const wings = [];
  for (const sx of [1, -1]) {
    const p = pivot(sx * 0.08, 0.06, -0.02); rig.add(p);
    p.add(part('en:inkBat:wing', (b) => {
      b.shape(shape, 0.02, C.inkWing, { r: [H2, 0, 0] }, { jit: 0.05 });
      b.boxC(0.4, 0.028, 0.028, C.inkDark, { p: [0.19, 0.005, 0.085], r: [0, -0.15, 0] });
      b.boxC(0.24, 0.022, 0.022, C.inkDark, { p: [0.21, 0.005, 0.0], r: [0, 0.35, 0] });
    }));
    p.scale.x = sx;
    wings.push(p);
  }
  const skin = makeSkin(g);
  let t = Math.random() * 5, ph = Math.random() * TAU, squirt = 0;
  g.userData = {
    kind: 'enemy', type: 'inkBat', height: 0.28, flying: true,
    hit() { skin.hit(); },
    /** （額外）噴墨動作：墨囊擠扁再彈回 */
    ink() { squirt = 1; },
    update(dt, s = {}) {
      skin.update(dt, s.frozen);
      if (s.frozen) return;
      t += dt;
      ph += dt * 12 * (s.slowed ? 0.55 : 1);
      const f = Math.sin(ph);
      const a = 0.15 + f * 0.7;
      wings[0].rotation.z = a; wings[1].rotation.z = -a;
      rig.position.y = -f * 0.035 + Math.sin(t * 1.5) * 0.02;
      rig.rotation.x = 0.1 + Math.cos(ph) * 0.05;
      squirt = Math.max(0, squirt - dt * 2.5);
      const sq = Math.sin(squirt * PI);
      const br = 1.18 * (1 + Math.sin(t * 3.3) * 0.05);
      sac.scale.set(br * (1 + sq * 0.25), br * (1 - sq * 0.35), br * (1 + sq * 0.25));
    },
  };
  return g;
}

// ===========================================================================
// 地鼠王：巨大的地鼠，金王冠＋紅披風（白毛邊）＋扛著大十字鎬，紅色發光眼
// ===========================================================================
function moleKing() {
  const g = new THREE.Group();
  const rig = new THREE.Group(); g.add(rig);
  const S = 2.6;
  rig.add(part('en:moleKing:body', (b) => {
    b.lathe([[0.0, 0.02], [0.2, 0.03], [0.26, 0.12], [0.25, 0.27], [0.2, 0.39], [0.12, 0.46], [0, 0.48]].map(([r, y]) => [r * S, y * S]), 10, C.kingFur, {}, { top: C.kingFurLight, jit: 0.06, wob: 0.015 });
    b.ico(0.18 * S, 1, C.moleBelly, { p: [0, 0.21 * S, 0.1 * S], s: [1, 1.15, 0.7] }, { jit: 0.04 });
    // 鼻吻、大鼻子、門牙、鬍鬚
    b.cone(0.1 * S, 0.15 * S, 7, C.kingFurLight, { p: [0, 0.34 * S, 0.17 * S], r: [H2 - 0.15, 0, 0] }, { top: C.moleBelly });
    b.ico(0.05 * S, 1, C.moleNose, { p: [0, 0.36 * S, 0.32 * S] }, { shine: 0.6, jit: 0 });
    for (const sx of [-1, 1]) b.boxC(0.03 * S, 0.05 * S, 0.012 * S, C.white, { p: [sx * 0.016 * S, 0.285 * S, 0.255 * S], r: [0.25, 0, 0] }, { jit: 0 });
    for (const sx of [-1, 1]) for (const dy of [-0.02, 0.015]) b.boxC(0.2, 0.012, 0.012, C.dark, { p: [sx * 0.2, 0.34 * S + dy, 0.27 * S], r: [0, sx * 0.25, dy * 6 * sx] }, { jit: 0 });
    // 生氣的眉毛
    for (const sx of [-1, 1]) b.boxC(0.12, 0.035, 0.05, C.moleDark, { p: [sx * 0.11, 0.425 * S, 0.19 * S], r: [0, sx * 0.35, sx * -0.4] });
    // 耳朵
    for (const sx of [-1, 1]) b.ico(0.045 * S, 0, C.moleDark, { p: [sx * 0.16 * S, 0.42 * S, -0.02 * S], s: [1, 1, 0.5] });
    // 紅披風領口＋白毛邊
    b.torus(0.17 * S, 0.035 * S, 4, 10, PI * 1.3, C.ermine, { p: [0, 0.38 * S, -0.02 * S], r: [H2 + 0.15, 0, PI * 1.15] }, { jit: 0.04 });
    for (let i = 0; i < 4; i++) { const a = PI * 0.6 + i * 0.6; b.boxC(0.03, 0.05, 0.02, C.dark, { p: [Math.cos(a) * 0.17 * S, 0.385 * S, -0.02 * S - Math.sin(a) * 0.17 * S] }, { jit: 0 }); }
    // 尾巴
    b.cone(0.04, 0.3, 4, C.moleNose, { p: [0, 0.15, -0.55], r: [-H2 - 0.5, 0, 0] });
  }));
  // 王冠（金）
  const crownP = pivot(0, 0.47 * S - 0.03, -0.02); rig.add(crownP);
  crownP.rotation.z = -0.12;
  crownP.add(part('en:moleKing:crown', (b) => {
    b.cyl(0.2, 0.18, 0.12, 8, C.gold, { r: [0, PI / 8, 0] }, { shine: 1, top: '#ffe08a' });
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * TAU;
      b.cone(0.045, 0.14, 4, C.gold, { p: [Math.sin(a) * 0.19, 0.11, Math.cos(a) * 0.19] }, { shine: 1 });
    }
    b.ico(0.14, 0, C.kingCape, { p: [0, 0.08, 0], s: [1, 0.5, 1] });
  }));
  // 王冠寶石＋眼睛（發光）
  const glow = glowPart('en:moleKing:glow', (b) => {
    for (const sx of [-1, 1]) b.boxC(0.07, 0.05, 0.03, C.eyeRed, { p: [sx * 0.1, 0.4 * S, 0.215 * S], r: [0, sx * 0.35, sx * -0.2] }, { glow: 2, jit: 0 });
  });
  rig.add(glow);
  const gems = glowPart('en:moleKing:gems', (b) => {
    for (const [a, col] of [[0, '#ff4a6a'], [0.8, C.glowCyan], [-0.8, '#4aff9a']]) b.oct(0.035, col, { p: [Math.sin(a) * 0.2, 0.05, Math.cos(a) * 0.2], r: [0, a, 0], s: [1, 1.3, 0.5] }, { glow: 1.1, shine: 1, jit: 0 });
  });
  crownP.add(gems);
  // 披風
  const capeP = pivot(0, 0.37 * S, -0.3); rig.add(capeP);
  capeP.add(part('en:moleKing:cape', (b) => {
    const pts = [[-0.3, 0], [0.3, 0], [0.52, -0.82], [0.3, -0.9], [0, -0.85], [-0.3, -0.9], [-0.52, -0.82]];
    b.shape(pts, 0.04, C.kingCape, { r: [0.35, 0, 0] }, { top: '#e8505b', jit: 0.05 });
    b.shape(pts.map(([x, y]) => [x * 0.95, y * 0.97]), 0.02, C.kingCapeIn, { p: [0, -0.01, 0.025], r: [0.35, 0, 0] }, { jit: 0.03 });
    b.boxC(1.0, 0.06, 0.08, C.ermine, { p: [0, -0.86, -0.29], r: [0.35, 0, 0] }, { jit: 0.04 });
  }));
  // 腳
  const legs = [];
  for (const sx of [-1, 1]) {
    const p = pivot(sx * 0.3, 0.2, 0.05); rig.add(p);
    p.add(part('en:moleKing:foot', (b) => b.box(0.2, 0.2, 0.3, C.moleNose, { p: [0, -0.2, 0.05] }, { top: '#f6b0bd', wob: 0.01 })));
    legs.push(p);
  }
  // 左手爪
  const clawL = pivot(-0.6, 0.78, 0.2); rig.add(clawL);
  clawL.add(part('en:moleKing:claw', (b) => moleClaw(b, 2.3)));
  clawL.rotation.z = -0.4;
  // 右手扛大十字鎬
  const pickP = pivot(0.6, 0.85, 0.12); rig.add(pickP);
  pickP.add(part('en:moleKing:pick', (b) => {
    moleClaw(b, 2.3);
    b.cylC(0.035, 0.04, 1.3, 6, C.woodDark, { p: [0, 0.2, -0.04], r: [-0.5, 0, 0] }, { top: C.wood });
    // 鎬頭（彎曲的鐵）
    const hy = 0.2 + Math.cos(0.5) * 0.65, hz = -0.04 - Math.sin(0.5) * 0.65;
    b.boxC(0.13, 0.16, 0.16, C.ironDark, { p: [0, hy, hz], r: [-0.5, 0, 0] }, { shine: 0.5 });
    for (const s of [-1, 1]) {
      b.coneC(0.085, 0.55, 4, C.steel, { p: [0, hy + s * 0.13, hz + s * 0.24], r: [-0.5 + s * (H2 - 0.35), 0, 0], s: [1, 1, 0.6] }, { shine: 0.9, top: C.silver });
    }
  }));
  pickP.rotation.x = -0.2;
  const skin = makeSkin(g);
  let ph = Math.random() * TAU, t = Math.random() * 5, atk = 0;
  g.userData = {
    kind: 'enemy', type: 'moleKing', height: 1.6, boss: true,
    hit() { skin.hit(); },
    update(dt, s = {}) {
      skin.update(dt, s.frozen);
      if (s.frozen) return;
      t += dt;
      const k = s.slowed ? 0.55 : 1;
      const mv = !!s.moving;
      if (mv) ph += dt * 4 * k;
      const sw = mv ? Math.sin(ph) : 0;
      legs[0].rotation.x = sw * 0.5; legs[1].rotation.x = -sw * 0.5;
      rig.rotation.z = sw * 0.07;
      rig.position.y = mv ? Math.abs(Math.cos(ph)) * 0.05 : Math.sin(t * 1.8) * 0.01;
      capeP.rotation.x = 0.05 + (mv ? 0.1 + Math.sin(ph * 2) * 0.05 : Math.sin(t * 1.2) * 0.03);
      crownP.rotation.z = -0.12 + sw * 0.05;
      clawL.rotation.x = -0.3 + sw * 0.3;
      if (s.attacking) {
        atk += dt * 3.2;
        const a = Math.max(0, Math.sin(atk));
        pickP.rotation.x = -0.2 - a * 1.0 + (Math.sin(atk) < -0.2 ? 0.9 : 0);
      } else pickP.rotation.x = -0.2 - sw * 0.12;
    },
  };
  return g;
}

// ===========================================================================
// 深淵巨蟲：大嘴的頭（一圈尖牙＋發光喉嚨＋四顆眼），身體是一節節甲殼，沿著頭走過的路拖在後面
// userData.setSegments(n)：只顯示前 n 節（從尾巴開始消失）
// ===========================================================================
const WORM_SEGS = 6;
function abyssWorm() {
  const g = new THREE.Group();
  const rig = new THREE.Group(); g.add(rig);
  // 頭（朝 +Z，稍微抬起）
  const headP = pivot(0, 0.72, 0.1); rig.add(headP);
  headP.add(part('en:abyssWorm:head', (b) => {
    // 頸部（往後下方接到第一節）
    b.cylC(0.36, 0.42, 0.5, 8, C.wormBelly, { p: [0, -0.28, -0.22], r: [-0.9, 0, 0] }, { top: C.worm, jit: 0.06 });
    // 頭殼
    b.dodec(0.46, C.worm, { s: [1.05, 0.92, 1] }, { top: C.wormLight, wob: 0.02, jit: 0.06 });
    // 甲殼板（頭頂三片）
    for (let i = 0; i < 3; i++) {
      const z = -0.05 - i * 0.17;
      b.boxC(0.62 - i * 0.08, 0.1, 0.2, C.wormPlate, { p: [0, 0.38 - i * 0.05, z], r: [-0.25 - i * 0.25, 0, 0] }, { top: C.wormLight, shine: 0.4 });
    }
    // 頭頂尖角
    for (const sx of [-1, 1]) b.cone(0.07, 0.36, 4, C.wormPlate, { p: [sx * 0.24, 0.3, -0.06], r: [-0.6, 0, sx * -0.55] }, { top: '#c8b8e8', shine: 0.4 });
    // 嘴：外圈肉唇＋一圈尖牙（朝內）
    b.torus(0.27, 0.07, 4, 10, TAU, C.wormBelly, { p: [0, -0.04, 0.38] }, { jit: 0.05 });
    for (let i = 0; i < 10; i++) {
      const a = i / 10 * TAU;
      b.cone(0.045, 0.16, 3, C.bone, { p: [Math.cos(a) * 0.25, -0.04 + Math.sin(a) * 0.25, 0.42], r: [0, 0, a + H2], s: [1, 1, 0.7] }, { jit: 0 });
    }
    // 兩側大顎
    for (const sx of [-1, 1]) b.cone(0.07, 0.42, 4, C.wormPlate, { p: [sx * 0.36, -0.2, 0.3], r: [1.2, 0, sx * 0.5] }, { top: C.bone });
  }));
  // 發光：喉嚨＋四顆眼睛
  headP.add(glowPart('en:abyssWorm:glow', (b) => {
    b.cylC(0.2, 0.2, 0.04, 8, C.wormMaw, { p: [0, -0.04, 0.36], r: [H2, 0, 0] }, { glow: 1.4, jit: 0, top: C.wormMawCore });
    b.ico(0.1, 0, C.wormMawCore, { p: [0, -0.04, 0.34], s: [1, 1, 0.4] }, { glow: 1.8, jit: 0 });
    for (const [x, y] of [[-0.17, 0.27], [0.17, 0.27], [-0.3, 0.17], [0.3, 0.17]]) b.ico(0.05, 0, C.eyeGold, { p: [x, y, 0.34 - Math.abs(x) * 0.25], s: [1, 0.8, 0.6] }, { glow: 1.8, jit: 0 });
  }));
  const mawHalo = halo(C.wormMaw, 0.75, 0.5); mawHalo.position.set(0, -0.04, 0.5); headP.add(mawHalo);

  // 身體各節（放在 segRoot：它的 matrix ＝ g.matrix 的反矩陣，所以節的座標＝g 父物件的座標）
  const segRoot = new THREE.Group(); segRoot.matrixAutoUpdate = false; g.add(segRoot);
  const segs = [];
  for (let i = 0; i < WORM_SEGS; i++) {
    const sp = pivot(); segRoot.add(sp);
    const sc = 1 - i * 0.075;
    sp.add(part('en:abyssWorm:seg', (b) => {
      b.dodec(0.4, C.worm, { p: [0, 0.34, 0], s: [1.08, 0.82, 0.86] }, { top: C.wormLight, wob: 0.015, jit: 0.06 });
      b.cylC(0.36, 0.38, 0.14, 8, C.wormBelly, { p: [0, 0.22, -0.2], r: [H2, 0, 0] }, { jit: 0.05 });
      b.boxC(0.56, 0.1, 0.26, C.wormPlate, { p: [0, 0.62, 0.02], r: [-0.12, 0, 0] }, { top: C.wormLight, shine: 0.4 });
      b.cone(0.07, 0.26, 4, C.wormPlate, { p: [0, 0.66, -0.02], r: [-0.4, 0, 0] }, { top: '#c8b8e8', shine: 0.4 });
      for (const sx of [-1, 1]) b.cone(0.05, 0.22, 3, C.wormPlate, { p: [sx * 0.36, 0.14, 0.05], r: [0.4, 0, sx * 2.1] }, { top: C.bone });
    }));
    sp.add(glowPart('en:abyssWorm:segGlow', (b) => {
      for (const sx of [-1, 1]) for (const z of [-0.12, 0.12]) b.oct(0.05, C.glowCyan, { p: [sx * 0.41, 0.36, z], s: [0.5, 1, 1] }, { glow: 1.5, jit: 0 });
    }));
    sp.scale.setScalar(sc);
    segs.push({ obj: sp, scale: sc, dist: 0 });
  }
  // 各節沿路徑的距離（節越小靠越近）
  let dAcc = 0.5;
  for (let i = 0; i < WORM_SEGS; i++) { segs[i].dist = dAcc; dAcc += 0.5 * (segs[i].scale + (segs[i + 1]?.scale ?? segs[i].scale)) / 2 + 0.02; }
  // 尾巴
  const tail = pivot(); segRoot.add(tail);
  tail.add(part('en:abyssWorm:tail', (b) => {
    b.cone(0.24, 0.7, 6, C.worm, { p: [0, 0.22, 0.1], r: [-H2 + 0.12, 0, 0] }, { top: C.wormPlate, jit: 0.06 });
    b.cone(0.06, 0.22, 4, C.wormPlate, { p: [0, 0.4, -0.05], r: [-0.6, 0, 0] }, { top: '#c8b8e8' });
  }));
  tail.add(glowPart('en:abyssWorm:tailGlow', (b) => b.oct(0.06, C.glowCyan, { p: [0, 0.2, -0.55], s: [1, 1, 1.4] }, { glow: 1.6, jit: 0 })));

  // ---- 路徑記錄（父物件座標）----
  const STEP = 0.08, MAXP = 140;
  const hist = []; // [{x,y,z}]，hist[0] 最新
  let shown = WORM_SEGS;
  function resetPath() {
    hist.length = 0;
    const yaw = g.rotation.y, bx = -Math.sin(yaw), bz = -Math.cos(yaw);
    for (let i = 0; i < MAXP; i++) hist.push({ x: g.position.x + bx * i * STEP, y: g.position.y, z: g.position.z + bz * i * STEP });
  }
  function record() {
    const p = g.position;
    if (!hist.length) { resetPath(); return; }
    const h0 = hist[0];
    let dx = p.x - h0.x, dz = p.z - h0.z, d = Math.hypot(dx, dz);
    if (d > 2.5) { resetPath(); return; }   // 瞬移（物件池重用、鑽地後冒出）：重設成一直線
    while (d >= STEP) {
      const f = STEP / d;
      const last = hist[0];
      const np = hist.length >= MAXP ? hist.pop() : { x: 0, y: 0, z: 0 };
      np.x = last.x + dx * f; np.y = p.y; np.z = last.z + dz * f;
      hist.unshift(np);
      dx = p.x - np.x; dz = p.z - np.z; d = Math.hypot(dx, dz);
    }
  }
  const _o = { x: 0, z: 0, yaw: 0 };
  /** 從頭往後沿路徑走 dist，回傳位置與朝向 */
  function along(dist) {
    let px = g.position.x, pz = g.position.z, acc = 0;
    for (let i = 0; i < hist.length; i++) {
      const q = hist[i];
      const seg = Math.hypot(q.x - px, q.z - pz);
      if (seg > 1e-6 && acc + seg >= dist) {
        const f = (dist - acc) / seg;
        _o.x = px + (q.x - px) * f; _o.z = pz + (q.z - pz) * f;
        _o.yaw = Math.atan2(px - q.x, pz - q.z);
        return _o;
      }
      acc += seg; px = q.x; pz = q.z;
    }
    // 路徑不夠長：沿最後方向延伸
    const yaw = hist.length > 1 ? Math.atan2(hist[hist.length - 2].x - px, hist[hist.length - 2].z - pz) : g.rotation.y;
    _o.x = px - Math.sin(yaw) * (dist - acc); _o.z = pz - Math.cos(yaw) * (dist - acc); _o.yaw = yaw;
    return _o;
  }

  const skin = makeSkin(g);
  let t = Math.random() * 5, ph = 0, atk = 0;
  function setSegments(n) {
    shown = clamp(Math.round(n), 0, WORM_SEGS);
    for (let i = 0; i < WORM_SEGS; i++) segs[i].obj.visible = i < shown;
  }
  g.userData = {
    kind: 'enemy', type: 'abyssWorm', height: 1.5, boss: true, segMax: WORM_SEGS,
    hit() { skin.hit(); },
    setSegments,
    /** 物件池重用前可以呼叫：清掉路徑記錄 */
    resetPath() { hist.length = 0; },
    update(dt, s = {}) {
      skin.update(dt, s.frozen);
      g.updateMatrix();
      segRoot.matrix.copy(g.matrix).invert();
      segRoot.matrixWorldNeedsUpdate = true;
      record();
      const frozen = !!s.frozen;
      if (!frozen) {
        t += dt;
        const k = s.slowed ? 0.55 : 1;
        if (s.moving) ph += dt * 4 * k;
        atk = damp(atk, s.attacking ? 1 : 0, 6, dt);
        const chomp = s.attacking ? Math.max(0, Math.sin(t * 7)) : 0;
        headP.rotation.x = Math.sin(t * 1.6) * 0.06 + atk * (0.25 + chomp * 0.25);
        headP.position.y = 0.72 + Math.sin(ph) * 0.05 - atk * 0.08;
        headP.position.z = 0.1 + atk * chomp * 0.12;
        rig.rotation.z = Math.sin(ph * 0.5) * 0.05;
        const ms = 0.75 + Math.sin(t * 5) * 0.08 + chomp * 0.25;
        mawHalo.scale.set(ms, ms, 1);
      }
      // 各節沿路徑排列，上下起伏像在蠕動
      const by = g.position.y;
      let lastD = 0.3;
      for (let i = 0; i < WORM_SEGS; i++) {
        const sg = segs[i];
        if (i >= shown) continue;
        const o = along(sg.dist);
        sg.obj.position.set(o.x, by + Math.max(0, Math.sin(ph - i * 0.9)) * 0.06, o.z);
        sg.obj.rotation.set(Math.sin(ph - i * 0.9) * 0.05, o.yaw, 0);
        lastD = sg.dist;
      }
      const sc = shown > 0 ? segs[shown - 1].scale : 1;
      const o = along(lastD + (shown > 0 ? 0.45 * sc : 0.25));
      tail.position.set(o.x, by, o.z);
      tail.rotation.set(0, o.yaw, 0);
      tail.scale.setScalar(Math.max(0.55, sc * 0.95));
    },
  };
  setSegments(WORM_SEGS);
  return g;
}

/** 第二章敵人的建構表（enemies.js 會併進 makeEnemy） */
export const ENEMIES2 = { ghost, mole, inkBat, moleKing, abyssWorm };
