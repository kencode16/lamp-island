// 第二章英雄：森林妖精（fairy）、星詠法師（mage）（擁有者：B）
// 共通 userData：update(dt, { moving, attacking, dead, casting })、attack()、cast(skillId)、hit()、height、hover、flying
// 妖精的原點在「腳底」：view 要把根節點放在 y = userData.hover（≈0.6）；陣亡時模型自己往下掉 hover 的距離落到地面。
import * as THREE from 'three';
import { C, MAT, halo, haloOwn, markNoDark } from '../palette.js';
import { part, partG, glowPart, pivot, makeSkin, PI, TAU, damp, clamp } from './lib.js';

const H2 = PI / 2;
const ease = (x) => 1 - (1 - x) * (1 - x) * (1 - x);

// 妖精翅膀：不受光照影響的半透明材質（像在發光），noDark
let wingMat = null;
function getWingMat() {
  if (!wingMat) {
    wingMat = markNoDark(new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.62, side: THREE.DoubleSide, depthWrite: false, toneMapped: false }));
    wingMat.name = 'shoudeng-fairyWing';
  }
  return wingMat;
}

/** 共用的陣亡（往後倒）＋受擊；回傳 deadK */
function deathFall(state, dt, dead) {
  state.deadK = damp(state.deadK, dead ? 1 : 0, dead ? 6 : 10, dt);
  if (!dead && state.deadK < 0.02) state.deadK = 0;
  return state.deadK;
}

// ===========================================================================
// 森林妖精：金色短髮＋尖耳、綠葉洋裝配粉紅花瓣裙、兩對半透明發光翅膀、花朵魔杖，全身微光
// ===========================================================================
function fairy() {
  const g = new THREE.Group();
  const HOVER = 0.6;
  const rig = new THREE.Group(); g.add(rig);
  rig.add(...partG('hero:fairy:body', (b) => {
    // 洋裝＋花瓣裙
    b.lathe([[0.0, 0.17], [0.12, 0.17], [0.11, 0.22], [0.08, 0.3], [0.06, 0.38], [0.07, 0.42], [0, 0.44]], 8, C.fairyDress, {}, { top: C.fairyDressTop, glow: 0.12, jit: 0.05 });
    for (let i = 0; i < 7; i++) {
      const a = i / 7 * TAU + 0.2;
      b.cone(0.055, 0.12, 4, C.fairyPetal, { p: [Math.sin(a) * 0.1, 0.22, Math.cos(a) * 0.1], r: [PI - Math.cos(a) * 0.55, 0, -Math.sin(a) * 0.55] }, { top: '#ffe3f1', glow: 0.15 });
    }
    b.cylC(0.075, 0.075, 0.025, 8, C.leafDark, { p: [0, 0.3, 0] }, { jit: 0 });
    // 頭、臉
    b.ico(0.105, 1, C.skin, { p: [0, 0.545, 0.005] }, { glow: 0.08 });
    for (const sx of [-1, 1]) {
      b.ico(0.024, 0, C.pupil, { p: [sx * 0.04, 0.54, 0.096], s: [0.8, 1.15, 0.5] }, { jit: 0, shine: 1 });
      b.boxC(0.01, 0.01, 0.01, C.white, { p: [sx * 0.04 + 0.006, 0.552, 0.108] }, { glow: 0.8, jit: 0 });
      b.ico(0.018, 0, C.petalPink, { p: [sx * 0.065, 0.515, 0.085], s: [1, 0.6, 0.4] }, { jit: 0 });
      // 尖耳
      b.cone(0.03, 0.11, 4, C.skin, { p: [sx * 0.095, 0.55, -0.005], r: [0.2, 0, -sx * 1.15] }, { top: '#ffd8c0' });
    }
    b.boxC(0.03, 0.008, 0.01, C.mouth, { p: [0, 0.5, 0.1] }, { jit: 0 });
    // 金色短髮（後腦＋瀏海＋兩撮翹髮）＋頭上的粉紅花
    b.dodec(0.115, C.fairyHair, { p: [0, 0.585, -0.03], s: [1.08, 0.95, 1.0] }, { top: C.fairyHairTop, glow: 0.18, jit: 0.05 });
    for (const x of [-0.055, 0, 0.055]) b.cone(0.04, 0.08, 4, C.fairyHair, { p: [x, 0.64, 0.06], r: [PI - 0.9, 0, x * 3] }, { top: C.fairyHairTop, glow: 0.18 });
    for (const sx of [-1, 1]) b.cone(0.035, 0.13, 4, C.fairyHair, { p: [sx * 0.07, 0.6, -0.08], r: [-0.9, 0, -sx * 0.9] }, { top: C.fairyHairTop, glow: 0.18 });
    for (let i = 0; i < 5; i++) {
      const a = i / 5 * TAU;
      b.ico(0.028, 0, C.fairyPetal, { p: [0.06 + Math.sin(a) * 0.03, 0.665, 0.02 + Math.cos(a) * 0.03], s: [1, 0.5, 1] }, { glow: 0.3, jit: 0 });
    }
    b.ico(0.018, 0, C.petalYellow, { p: [0.06, 0.675, 0.02] }, { glow: 0.6, jit: 0, nd: true });
  }));
  // 腿（懸在空中，微微擺動）
  const legs = pivot(0, 0.18, 0); rig.add(legs);
  legs.add(part('hero:fairy:legs', (b) => {
    for (const sx of [-1, 1]) {
      b.cyl(0.018, 0.022, 0.15, 5, C.skin, { p: [sx * 0.035, -0.16, 0] });
      b.cone(0.03, 0.07, 5, C.leafDark, { p: [sx * 0.035, -0.17, 0.02], r: [H2 + 0.4, 0, 0] }, { top: C.fairyDress });
    }
  }));
  // 手臂（右手拿花朵魔杖）
  const arms = [];
  for (const sx of [-1, 1]) {
    const p = pivot(sx * 0.075, 0.43, 0); rig.add(p);
    p.add(part('hero:fairy:arm', (b) => {
      b.box(0.035, 0.15, 0.035, C.skin, { p: [0, -0.15, 0] });
      b.cone(0.03, 0.05, 5, C.fairyDress, { p: [0, -0.02, 0], r: [PI, 0, 0] }, { top: C.fairyDressTop });
    }));
    p.rotation.z = sx * 0.25;
    arms.push(p);
  }
  const wand = pivot(0, -0.15, 0.01); arms[1].add(wand);
  wand.add(part('hero:fairy:wand', (b) => b.cylC(0.008, 0.008, 0.2, 4, C.woodLight, { p: [0, 0.0, 0.08], r: [H2, 0, 0] })));
  const wandTip = glowPart('hero:fairy:wandTip', (b) => {
    for (let i = 0; i < 5; i++) { const a = i / 5 * TAU; b.oct(0.025, C.fairyGlow, { p: [Math.sin(a) * 0.025, Math.cos(a) * 0.025, 0.19], s: [0.7, 1, 0.5], r: [0, 0, -a] }, { glow: 1.3, jit: 0 }); }
    b.ico(0.02, 0, C.white, { p: [0, 0, 0.19] }, { glow: 1.6, jit: 0 });
  });
  wand.add(wandTip);
  const tipHalo = haloOwn(C.fairyGlow, 0.3, 0.8); tipHalo.position.set(0, 0, 0.19); wand.add(tipHalo);
  // 翅膀：兩對（上大下小），從背後長出來，繞 y 軸拍動
  const wings = [];
  const wingGeoKey = 'hero:fairy:wing';
  for (const sx of [1, -1]) {
    const p = pivot(sx * 0.02, 0.42, -0.06); rig.add(p);
    const m = part(wingGeoKey, (b) => {
      const up = [[0, 0], [0.08, 0.1], [0.17, 0.22], [0.27, 0.27], [0.33, 0.22], [0.31, 0.12], [0.22, 0.05], [0.1, 0.0]];
      const lo = [[0, -0.01], [0.1, -0.02], [0.2, -0.08], [0.22, -0.16], [0.16, -0.2], [0.08, -0.14], [0.02, -0.06]];
      b.shape(up, 0.006, C.fairyWing, {}, { top: '#ffffff', jit: 0 });
      b.shape(lo, 0.006, '#9ff0d0', {}, { top: C.fairyWing, jit: 0 });
    }, { cast: false, mat: getWingMat() });
    m.scale.x = sx;
    m.renderOrder = 1;
    p.add(m);
    wings.push(p);
  }
  // 全身微光＋繞身體的光點
  const aura = haloOwn(C.fairyGlow, 0.95, 0.32); aura.position.y = 0.4; rig.add(aura);
  const motes = [];
  for (let i = 0; i < 3; i++) { const m = halo('#e8ffd0', 0.07, 0.95); rig.add(m); motes.push(m); }

  const skin = makeSkin(g);
  const st = { deadK: 0 };
  let t = Math.random() * 5, ph = 0, atk = -1, castK = -1, castId = null, spread = 0, bloom = 0;
  g.userData = {
    kind: 'hero', type: 'fairy', height: 0.7, hover: HOVER, flying: true,
    attack() { if (castK < 0) atk = 0; },
    cast(skillId) { castId = skillId; castK = 0; atk = -1; },
    hit() { skin.hit(); },
    update(dt, s = {}) {
      skin.update(dt, false);
      t += dt;
      const dead = !!s.dead;
      const dk = deathFall(st, dt, dead);
      const mv = !!s.moving && !dead;
      // 施法：張開翅膀、雙手往上、光暈變大
      if (castK >= 0) { castK += dt; if (castK > 0.8 && !s.casting) castK = -1; }
      const casting = castK >= 0;
      spread = damp(spread, casting ? 1 : 0, casting ? 14 : 5, dt);
      bloom = Math.max(0, bloom - dt * 2);
      if (casting && castK < 0.12) bloom = 1;
      // 拍翅
      ph += dt * (dead ? 0 : mv ? 15 : 10) * (1 - spread * 0.7);
      const f = Math.sin(ph);
      const fold = dead ? 1.3 : 0.75 + f * 0.5;
      const wy = fold * (1 - spread) + 0.05 * spread;
      wings[0].rotation.set(0, wy, -spread * 0.25 + dk * 0.4);
      wings[1].rotation.set(0, -wy, spread * 0.25 - dk * 0.4);
      // 漂浮與前傾
      const bob = Math.sin(t * 2.6) * 0.04 * (1 - dk);
      rig.position.y = bob - dk * (HOVER - 0.04) + spread * 0.04;
      rig.rotation.x = (mv ? 0.3 : 0.06) * (1 - dk) - dk * 1.35;
      rig.rotation.z = (mv ? Math.sin(t * 3) * 0.05 : 0) * (1 - dk);
      legs.rotation.x = 0.3 + Math.sin(t * 2.6 + 1) * 0.12 + (mv ? 0.35 : 0);
      // 手臂：普攻把魔杖往前刺
      let ar = 0.1, twist = 0;
      if (atk >= 0) {
        atk += dt;
        const fw = 0.09, back = 0.24;
        if (atk < fw) { const e = ease(atk / fw); ar = 0.1 - 1.55 * e; twist = 0.3 * e; }
        else if (atk < fw + back) { const e = (atk - fw) / back; ar = -1.45 + 1.55 * e; twist = 0.3 * (1 - e); }
        else atk = -1;
      } else if (s.attacking) ar = -0.3 + Math.sin(t * 4) * 0.05;
      arms[1].rotation.set(ar * (1 - spread) - spread * 0.5, 0, 0.25 + spread * 1.6);
      wand.rotation.x = -arms[1].rotation.x * 0.85 - 0.35 * (1 - spread);
      arms[0].rotation.set(-0.15 + Math.sin(t * 2.6) * 0.08 - spread * 0.5, 0, -0.25 - spread * 1.6);
      rig.rotation.y = twist;
      // 光
      const glowK = 1 - dk * 0.85;
      aura.material.opacity = (0.3 + bloom * 0.35 + spread * 0.12) * glowK * (0.92 + Math.sin(t * 4) * 0.08);
      const as = 0.95 + bloom * 0.9 + spread * 0.3;
      aura.scale.set(as, as, 1);
      tipHalo.material.opacity = (0.75 + (atk >= 0 ? 0.25 : 0)) * glowK;
      const ts = 0.3 + (atk >= 0 && atk < 0.15 ? 0.3 : 0);
      tipHalo.scale.set(ts, ts, 1);
      for (let i = 0; i < motes.length; i++) {
        const a = t * (1.3 + i * 0.25) + i * 2.1;
        const r = 0.22 + spread * 0.18 + Math.sin(t * 1.7 + i) * 0.03;
        motes[i].position.set(Math.sin(a) * r, 0.3 + Math.sin(t * 2 + i * 1.3) * 0.12, Math.cos(a) * r);
        motes[i].visible = dk < 0.5;
      }
    },
  };
  return g;
}

// ===========================================================================
// 星詠法師：深藍長袍（金邊、星星）、白鬍子、彎尖的星星帽、頂端有發光星晶的法杖
// ===========================================================================
function mage() {
  const g = new THREE.Group();
  const rig = new THREE.Group(); g.add(rig);
  rig.add(...partG('hero:mage:body', (b) => {
    // 長袍
    b.lathe([[0, 0.005], [0.19, 0], [0.19, 0.03], [0.165, 0.14], [0.13, 0.3], [0.11, 0.42], [0.085, 0.49], [0, 0.5]], 8, C.mageRobe, {}, { top: C.mageRobeTop, jit: 0.05 });
    b.cylC(0.195, 0.2, 0.035, 8, C.gold, { p: [0, 0.025, 0] }, { shine: 0.8 });
    b.boxC(0.035, 0.42, 0.02, C.gold, { p: [0, 0.23, 0.15], r: [-0.13, 0, 0] }, { shine: 0.7 });
    b.cylC(0.125, 0.13, 0.035, 8, C.leather, { p: [0, 0.32, 0] });
    b.boxC(0.045, 0.04, 0.02, C.gold, { p: [0, 0.32, 0.13] }, { shine: 1 });
    // 袍子上的星星
    for (const [a, y, s] of [[0.9, 0.12, 1], [-1.2, 0.2, 0.8], [2.4, 0.1, 0.9], [-2.6, 0.26, 0.7], [0.4, 0.4, 0.6]]) {
      const r = 0.19 - y * 0.16;
      b.oct(0.025 * s, C.starGold, { p: [Math.sin(a) * r, y, Math.cos(a) * r], r: [0, a, PI / 4], s: [1, 1, 0.4] }, { glow: 0.35, jit: 0 });
    }
    // 披肩
    b.cyl(0.13, 0.15, 0.08, 8, C.mageRobeDark, { p: [0, 0.44, 0], r: [0, PI / 8, 0] }, { top: C.mageRobe });
    // 頭、臉、鬍子
    b.ico(0.09, 1, C.skin, { p: [0, 0.6, 0.01] });
    b.ico(0.025, 0, '#f0a888', { p: [0, 0.585, 0.098] }, { jit: 0 });
    for (const sx of [-1, 1]) {
      b.boxC(0.022, 0.026, 0.01, C.pupil, { p: [sx * 0.035, 0.615, 0.088] }, { jit: 0 });
      b.boxC(0.045, 0.014, 0.02, C.beard, { p: [sx * 0.037, 0.643, 0.085], r: [0, 0, sx * -0.2] }, { jit: 0 });
      b.boxC(0.05, 0.02, 0.025, C.beard, { p: [sx * 0.03, 0.565, 0.095], r: [0, 0, sx * 0.35] }, { jit: 0 });
    }
    b.cone(0.075, 0.24, 6, C.beard, { p: [0, 0.58, 0.07], r: [PI + 0.25, 0, 0] }, { top: '#ffffff', jit: 0.04 });
    // 星星帽：寬帽簷＋往後彎的尖帽＋金帶＋星星
    b.cylC(0.175, 0.175, 0.02, 10, C.mageHat, { p: [0, 0.665, 0], r: [-0.08, 0, 0] }, { top: C.mageHatTop });
    b.cone(0.105, 0.2, 7, C.mageHat, { p: [0, 0.665, -0.01], r: [-0.12, 0, 0] }, { top: C.mageHatTop });
    b.cylC(0.1, 0.105, 0.03, 7, C.gold, { p: [0, 0.69, -0.012], r: [-0.12, 0, 0] }, { shine: 0.8 });
    b.cone(0.06, 0.17, 6, C.mageHatTop, { p: [0, 0.83, -0.04], r: [-0.85, 0, 0] }, { top: '#6a78c8' });
    for (const [x, y, z] of [[0.05, 0.75, 0.06], [-0.06, 0.78, 0.03], [0.02, 0.81, 0.02]]) b.oct(0.02, C.starGold, { p: [x, y, z], s: [1, 1, 0.4], r: [-0.4, 0, PI / 4] }, { glow: 0.5, jit: 0 });
    b.oct(0.035, C.starGold, { p: [0, 0.9, -0.17], s: [1, 1, 0.5] }, { glow: 0.9, jit: 0, nd: true });
  }));
  // 腳（袍子下露出的靴尖）
  const legs = [];
  for (const sx of [-1, 1]) {
    const p = pivot(sx * 0.06, 0.1, 0); rig.add(p);
    p.add(part('hero:mage:foot', (b) => b.box(0.06, 0.05, 0.11, '#5a3a2a', { p: [0, -0.1, 0.06] }, { top: C.leather })));
    legs.push(p);
  }
  // 左手（施法手勢）
  const armL = pivot(-0.13, 0.46, 0.0); rig.add(armL);
  armL.add(part('hero:mage:arm', (b) => {
    b.cone(0.055, 0.2, 6, C.mageRobe, { p: [0, -0.2, 0], r: [0, 0, 0] }, { top: C.mageRobeDark });
    b.ico(0.03, 0, C.skin, { p: [0, -0.21, 0.0] });
  }));
  armL.rotation.z = -0.25;
  // 右手拿法杖
  const staffP = pivot(0.13, 0.46, 0.02); rig.add(staffP);
  staffP.add(part('hero:mage:staffArm', (b) => {
    b.cone(0.055, 0.2, 6, C.mageRobe, { p: [0, -0.2, 0] }, { top: C.mageRobeDark });
    b.ico(0.03, 0, C.skin, { p: [0, -0.21, 0.03] });
  }));
  // 法杖掛在手上的樞紐：手臂怎麼轉，法杖都維持想要的角度（不會倒過來）
  const handP = pivot(0, -0.21, 0.03); staffP.add(handP);
  handP.add(part('hero:mage:staff', (b) => {
    b.cylC(0.014, 0.016, 0.78, 5, C.woodDark, { p: [0, 0.14, 0.01] }, { top: C.wood });
    b.torus(0.05, 0.012, 3, 7, PI * 1.5, C.gold, { p: [0, 0.59, 0.01], r: [0, H2, PI * 0.25] }, { shine: 1 });
  }));
  const star = glowPart('hero:mage:star', (b) => {
    b.shape(starPts(0.075, 0.032), 0.04, C.starGold, {}, { glow: 1.4, top: C.starCore, jit: 0 });
    b.ico(0.03, 0, C.starCore, {}, { glow: 1.8, jit: 0 });
  });
  const starP = pivot(0, 0.61, 0.01); handP.add(starP); starP.add(star);
  const starHalo = haloOwn(C.starGold, 0.42, 0.75); starP.add(starHalo);
  staffP.rotation.x = -0.15;

  const skin = makeSkin(g);
  const st = { deadK: 0 };
  let t = Math.random() * 5, ph = 0, atk = -1, castK = -1, raise = 0, pulse = 0;
  g.userData = {
    kind: 'hero', type: 'mage', height: 0.95, hover: 0, flying: false,
    attack() { if (castK < 0) { atk = 0; pulse = 1; } },
    cast(skillId) { castK = 0; atk = -1; pulse = 1; },
    hit() { skin.hit(); },
    update(dt, s = {}) {
      skin.update(dt, false);
      t += dt;
      const dead = !!s.dead;
      const dk = deathFall(st, dt, dead);
      if (dead) {
        castK = -1; atk = -1; raise = 0;
        rig.rotation.set(-dk * 1.45, 0, 0);
        rig.position.set(0, dk * 0.06, -dk * 0.12);
        starHalo.material.opacity = 0.75 * (1 - dk * 0.85);
        return;
      }
      const mv = !!s.moving;
      if (castK >= 0) { castK += dt; if (castK > 0.85 && !s.casting) castK = -1; }
      raise = damp(raise, castK >= 0 ? 1 : 0, castK >= 0 ? 12 : 6, dt);
      pulse = Math.max(0, pulse - dt * 2.5);
      if (mv) ph += dt * 8;
      const sw = mv ? Math.sin(ph) : 0;
      legs[0].rotation.x = sw * 0.5; legs[1].rotation.x = -sw * 0.5;
      rig.position.set(0, mv ? Math.abs(Math.cos(ph)) * 0.02 : Math.sin(t * 2) * 0.005, 0);
      rig.rotation.set(mv ? 0.06 : 0, 0, mv ? sw * 0.05 : Math.sin(t * 1.3) * 0.01);
      // 法杖：平常拄著、普攻往前指（杖頭朝目標）、施法高舉過頭（杖身直立）
      let a = -0.15 + (mv ? -sw * 0.15 : Math.sin(t * 1.6) * 0.03), tilt = 0;
      if (atk >= 0) {
        atk += dt;
        const fw = 0.12, hold = 0.06, back = 0.25;
        let e = 0;
        if (atk < fw) e = ease(atk / fw);
        else if (atk < fw + hold) e = 1;
        else if (atk < fw + hold + back) e = 1 - (atk - fw - hold) / back;
        else atk = -1;
        a = a + (-1.2 - a) * e; tilt = 1.15 * e;
      } else if (s.attacking) { a = -0.5 + Math.sin(t * 3) * 0.06; tilt = 0.35; }
      a = a + (-2.6 - a) * raise; tilt = tilt * (1 - raise) + 0.15 * raise;
      staffP.rotation.set(a, 0, raise * -0.15);
      staffP.position.y = 0.46 + raise * 0.05;
      handP.rotation.x = -a + tilt;
      armL.rotation.set(-0.1 - raise * 2.2 + (mv ? sw * 0.25 : 0), 0, -0.25 + raise * 0.35);
      star.rotation.z = t * 1.5;
      const hs = 0.42 + pulse * 0.55 + raise * 0.4 + Math.sin(t * 5) * 0.03;
      starHalo.scale.set(hs, hs, 1);
      starHalo.material.opacity = 0.75;
    },
  };
  return g;
}

/** 五角星外形（xy 平面） */
export function starPts(R, r) {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const a = i / 10 * TAU, rr = i % 2 ? r : R;
    pts.push([Math.sin(a) * rr, Math.cos(a) * rr]);
  }
  return pts;
}

export const HEROES2 = { fairy, mage };
