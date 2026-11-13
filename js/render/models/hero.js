// 英雄（擁有者：B）：守燈騎士（本檔）、森林妖精與星詠法師（heroes2.js）。
// 守燈騎士：藍銀盔甲、披風、左手提燈、右手長劍。
// userData：update(dt, { moving, attacking, dead, casting })、attack()、cast(skillId)、hit()、height、hover（飛行高度，騎士 0）
import * as THREE from 'three';
import { C, haloOwn } from '../palette.js';
import { part, partG, pivot, makeSkin, PI, TAU, damp, clamp } from './lib.js';
import { HEROES2 } from './heroes2.js';

const H2 = PI / 2;

function knight() {
  const g = new THREE.Group();
  const rig = new THREE.Group(); g.add(rig);
  const AR = C.heroArmor, AD = C.heroArmorDark, S = C.heroSilver;
  rig.add(part('hero:knight:body', (b) => {
    // 腰裙與腰帶
    b.cyl(0.12, 0.15, 0.1, 8, AD, { p: [0, 0.22, 0], r: [0, PI / 8, 0] });
    b.cylC(0.125, 0.125, 0.03, 8, C.leather, { p: [0, 0.31, 0], r: [0, PI / 8, 0] });
    b.boxC(0.045, 0.04, 0.02, C.gold, { p: [0, 0.31, 0.12] }, { shine: 1 });
    // 胸甲
    b.lathe([[0.11, 0], [0.13, 0.06], [0.145, 0.15], [0.12, 0.2], [0, 0.22]], 8, AR, { p: [0, 0.31, 0], s: [1.05, 1, 0.82] }, { top: '#a9c4f5', shine: 0.6 });
    b.boxC(0.03, 0.16, 0.02, S, { p: [0, 0.41, 0.108] }, { shine: 1 });
    b.boxC(0.11, 0.025, 0.02, S, { p: [0, 0.44, 0.104] }, { shine: 1 });
    // 肩甲
    for (const sx of [-1, 1]) b.ico(0.065, 0, S, { p: [sx * 0.15, 0.48, 0], s: [1.1, 0.75, 1] }, { shine: 1 });
    // 頭盔
    b.lathe([[0.095, 0], [0.1, 0.07], [0.095, 0.12], [0.065, 0.17], [0, 0.19]], 8, S, { p: [0, 0.5, 0] }, { top: C.white, shine: 1 });
    b.boxC(0.12, 0.022, 0.03, C.black, { p: [0, 0.6, 0.088] }, { jit: 0 });
    b.boxC(0.022, 0.06, 0.03, C.black, { p: [0, 0.57, 0.09] }, { jit: 0 });
    b.boxC(0.02, 0.05, 0.19, AD, { p: [0, 0.69, 0] });
    // 羽飾
    b.boxC(0.035, 0.07, 0.07, C.heroPlume, { p: [0, 0.72, 0.04] });
    b.boxC(0.035, 0.08, 0.08, C.heroPlume, { p: [0, 0.73, -0.03], r: [0.4, 0, 0] });
    b.boxC(0.035, 0.06, 0.08, '#ffb83a', { p: [0, 0.7, -0.1], r: [0.9, 0, 0] });
  }));
  // 腿
  const legs = [];
  for (const sx of [-1, 1]) {
    const p = pivot(sx * 0.06, 0.24, 0); rig.add(p);
    p.add(part('hero:knight:leg', (b) => {
      b.box(0.075, 0.2, 0.085, S, { p: [0, -0.2, 0] }, { shine: 0.8 });
      b.boxC(0.08, 0.04, 0.05, AR, { p: [0, -0.1, 0.03] }, { shine: 0.6 });
      b.box(0.085, 0.05, 0.12, AD, { p: [0, -0.24, 0.02] });
    }));
    legs.push(p);
  }
  // 披風
  const capeP = pivot(0, 0.48, -0.09); rig.add(capeP);
  capeP.add(part('hero:knight:cape', (b) => {
    const pts = [[-0.13, 0], [0.13, 0], [0.2, -0.38], [0.1, -0.43], [0, -0.39], [-0.1, -0.43], [-0.2, -0.38]];
    b.shape(pts, 0.025, C.heroCape, { r: [0.12, 0, 0] }, { top: '#5a7fe0', jit: 0.04 });
    b.boxC(0.28, 0.03, 0.04, C.gold, { p: [0, -0.005, 0.01] }, { shine: 1 });
  }));
  // 右手長劍
  const swordP = pivot(0.17, 0.44, 0.0); rig.add(swordP);
  swordP.add(part('hero:knight:swordArm', (b) => {
    b.box(0.06, 0.17, 0.065, AR, { p: [0, -0.17, 0] }, { shine: 0.6 });
    b.ico(0.035, 0, S, { p: [0, -0.18, 0.01] }, { shine: 1 });
    b.boxC(0.025, 0.025, 0.08, C.leather, { p: [0, -0.18, 0.04] });
    b.boxC(0.12, 0.025, 0.03, C.gold, { p: [0, -0.18, 0.085] }, { shine: 1 });
    b.boxC(0.035, 0.012, 0.36, S, { p: [0, -0.18, 0.27] }, { shine: 1, top: C.white });
    b.coneC(0.018, 0.06, 4, S, { p: [0, -0.18, 0.48], r: [H2, PI / 4, 0], s: [1, 1, 0.35] }, { shine: 1 });
    b.ico(0.02, 0, C.gold, { p: [0, -0.18, -0.01] }, { shine: 1 });
  }));
  // 左手提燈
  const lampP = pivot(-0.17, 0.44, 0.0); rig.add(lampP);
  lampP.add(...partG('hero:knight:lampArm', (b) => {
    b.box(0.06, 0.17, 0.065, AR, { p: [0, -0.17, 0] }, { shine: 0.6 });
    b.ico(0.035, 0, S, { p: [0, -0.18, 0.02] }, { shine: 1 });
    b.cylC(0.006, 0.006, 0.08, 4, C.ironDark, { p: [0, -0.2, 0.06] });
    // 燈
    b.cyl(0.04, 0.05, 0.02, 6, C.ironDark, { p: [0, -0.33, 0.06] }, { shine: 0.5 });
    b.cyl(0.04, 0.04, 0.08, 6, C.lampGlow, { p: [0, -0.31, 0.06] }, { glow: 1.6, jit: 0, nd: true });
    for (let i = 0; i < 3; i++) { const a = i / 3 * TAU; b.boxC(0.01, 0.09, 0.01, C.ironDark, { p: [Math.sin(a) * 0.042, -0.27, 0.06 + Math.cos(a) * 0.042] }); }
    b.cone(0.05, 0.04, 6, C.gold, { p: [0, -0.23, 0.06] }, { shine: 1 });
    b.torus(0.015, 0.005, 3, 6, TAU, C.ironDark, { p: [0, -0.18, 0.06] });
  }));
  const lampHalo = haloOwn(C.lampGlow, 0.55, 0.75); lampHalo.position.set(0, -0.27, 0.06); lampP.add(lampHalo);

  const skin = makeSkin(g);
  let ph = 0, t = 0, atk = -1, deadK = 0;
  // 技能動作：whirl（旋風斬：原地轉一圈、劍平舉）、charge（聖燈衝鋒：前傾、劍往前刺）
  let castK = -1, castId = null, chargeK = 0;
  const ease = (x) => 1 - (1 - x) * (1 - x) * (1 - x);
  g.userData = {
    kind: 'hero', type: 'knight', height: 0.82, hover: 0, flying: false,
    attack() { if (castK < 0) atk = 0; },
    cast(skillId) { castId = skillId === 'charge' ? 'charge' : 'whirl'; castK = 0; atk = -1; },
    hit() { skin.hit(); },
    update(dt, s = {}) {
      skin.update(dt, false);
      t += dt;
      const dead = !!s.dead;
      deadK = damp(deadK, dead ? 1 : 0, dead ? 6 : 10, dt);
      if (!dead && deadK < 0.02) deadK = 0;
      lampHalo.material.opacity = 0.75 * (1 - deadK * 0.85) * (0.9 + Math.sin(t * 11) * 0.06 + Math.sin(t * 17.3) * 0.04);
      if (dead) {
        castK = -1; atk = -1; chargeK = 0;
        rig.rotation.set(-deadK * 1.45, 0, 0);
        rig.position.set(0, deadK * 0.06, -deadK * 0.12);
        legs[0].rotation.x = legs[1].rotation.x = 0;
        return;
      }
      const mv = !!s.moving;
      // ---- 技能計時 ----
      let spin = 0, whirlK = 0;
      if (castK >= 0) {
        castK += dt;
        if (castId === 'whirl') {
          const D = 0.55;
          const f = clamp(castK / D, 0, 1);
          spin = ease(f) * TAU;
          whirlK = f < 0.15 ? f / 0.15 : f > 0.85 ? (1 - f) / 0.15 : 1;
          if (castK >= D) castK = -1;
        } else if (castK >= 0.7 && !s.casting) castK = -1;
      }
      const charging = castK >= 0 && castId === 'charge';
      chargeK = damp(chargeK, charging ? 1 : 0, charging ? 16 : 8, dt);
      const run = mv || chargeK > 0.3;
      if (run) ph += dt * (10 + chargeK * 8);
      const sw = run ? Math.sin(ph) * (0.65 + chargeK * 0.25) : 0;
      legs[0].rotation.x = sw; legs[1].rotation.x = -sw;
      // ---- 揮劍：蓄力（舉劍、身體後轉）→ 斬下（跨步、身體前轉）→ 收劍 ----
      let a, twist = 0, lunge = 0, lean = 0;
      if (atk >= 0) {
        atk += dt;
        const up = 0.1, down = 0.09, hold = 0.06, back = 0.2;
        if (atk < up) { const e = atk / up; a = -0.35 + (-2.5 + 0.35) * e; twist = -0.45 * e; lean = -0.08 * e; }
        else if (atk < up + down) { const e = ease((atk - up) / down); a = -2.5 + (0.8 + 2.5) * e; twist = -0.45 + 0.85 * e; lunge = 0.08 * e; lean = -0.08 + 0.26 * e; }
        else if (atk < up + down + hold) { a = 0.8; twist = 0.4; lunge = 0.08; lean = 0.18; }
        else if (atk < up + down + hold + back) { const e = (atk - up - down - hold) / back; a = 0.8 + (-0.35 - 0.8) * e; twist = 0.4 * (1 - e); lunge = 0.08 * (1 - e); lean = 0.18 * (1 - e); }
        else { a = -0.35; atk = -1; }
      } else a = s.attacking ? -0.5 + Math.sin(t * 3) * 0.05 : -0.35 + (mv ? sw * 0.3 : 0);
      // 旋風斬：劍平舉往外、整個人轉一圈
      let swordY = 0;
      if (whirlK > 0) { a = a + (-0.15 - a) * whirlK; swordY = -1.25 * whirlK; }
      // 聖燈衝鋒：前傾、劍往前刺
      a = a + (-0.8 - a) * chargeK;
      swordP.rotation.set(a, swordY, 0.08 + whirlK * 0.25);
      rig.rotation.set(lean + chargeK * 0.38, twist + spin, run ? Math.sin(ph) * 0.04 * (1 - chargeK) : 0);
      rig.position.set(0, run ? Math.abs(Math.cos(ph)) * 0.03 : Math.sin(t * 2.2) * 0.006, lunge + chargeK * 0.05);
      capeP.rotation.x = 0.1 + (run ? 0.3 + Math.sin(ph * 2) * 0.06 : Math.sin(t * 1.4) * 0.04) + chargeK * 0.55 + whirlK * 0.7;
      lampP.rotation.x = -0.35 + (run ? -sw * 0.35 : Math.sin(t * 1.8) * 0.05) + chargeK * 0.5;
      lampP.rotation.z = -0.1 - whirlK * 0.7;
    },
  };
  return g;
}

const BUILD = { knight, ...HEROES2 };

/** makeHero('knight' | 'fairy' | 'mage')；未知 id 用騎士 */
export function makeHero(type = 'knight') {
  const fn = BUILD[type] || knight;
  const g = fn();
  g.name = `hero:${BUILD[type] ? type : 'knight'}`;
  return g;
}
export const HERO_TYPES = Object.keys(BUILD);
