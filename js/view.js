// 把 sim 的 game.state 同步成 3D 物件（擁有者：整合者）
// 塔、敵人、英雄、投射物、地面效果圈、血條、英雄選取圈、移動標記。
import * as THREE from 'three';
import { makeTower, makeEnemy, makeHero, makeProjectile } from './render/models.js';

const TAU = Math.PI * 2;
const lerp = (a, b, t) => a + (b - a) * t;
function lerpAngle(a, b, t) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU; else if (d < -Math.PI) d += TAU;
  return a + d * t;
}

// ---- 血條（billboard，永遠面向鏡頭）----
const barGeo = new THREE.PlaneGeometry(1, 1);
barGeo.translate(0.5, 0, 0); // 從左邊長出來
const barMats = {
  bg: new THREE.MeshBasicMaterial({ color: 0x1b1410, transparent: true, opacity: 0.78, depthTest: false, depthWrite: false }),
  hp: new THREE.MeshBasicMaterial({ color: 0x7be06a, depthTest: false, depthWrite: false }),
  low: new THREE.MeshBasicMaterial({ color: 0xf0b13c, depthTest: false, depthWrite: false }),
  crit: new THREE.MeshBasicMaterial({ color: 0xe8513f, depthTest: false, depthWrite: false }),
  boss: new THREE.MeshBasicMaterial({ color: 0xd8453a, depthTest: false, depthWrite: false }),
  hero: new THREE.MeshBasicMaterial({ color: 0x5fb7ff, depthTest: false, depthWrite: false }),
  shield: new THREE.MeshBasicMaterial({ color: 0xbfe6ff, transparent: true, opacity: 0.9, depthTest: false, depthWrite: false }),
};
function makeBar(width, kind) {
  const g = new THREE.Group();
  const bg = new THREE.Mesh(barGeo, barMats.bg);
  const fg = new THREE.Mesh(barGeo, kind === 'boss' ? barMats.boss : kind === 'hero' ? barMats.hero : barMats.hp);
  const sh = new THREE.Mesh(barGeo, barMats.shield);
  const h = kind === 'boss' ? 0.11 : 0.07;
  bg.scale.set(width + 0.04, h + 0.035, 1); bg.position.x = -(width + 0.04) / 2;
  fg.scale.set(width, h, 1); fg.position.set(-width / 2, 0, 0.001);
  sh.scale.set(0, h * 0.45, 1); sh.position.set(-width / 2, h * 0.28, 0.002);
  for (const m of [bg, fg, sh]) { m.renderOrder = 1000; m.frustumCulled = false; }
  g.add(bg, fg, sh);
  return { g, fg, sh, width, kind };
}
function setBar(bar, frac, shieldFrac) {
  frac = Math.max(0, Math.min(1, frac));
  bar.fg.scale.x = Math.max(0.0001, bar.width * frac);
  if (bar.kind === 'enemy') bar.fg.material = frac > 0.5 ? barMats.hp : frac > 0.25 ? barMats.low : barMats.crit;
  bar.sh.scale.x = Math.max(0.0001, bar.width * Math.min(1, shieldFrac || 0));
  bar.sh.visible = shieldFrac > 0;
}

// ---- 地面效果圈 ----
const discGeo = new THREE.CircleGeometry(1, 32); discGeo.rotateX(-Math.PI / 2);
const ringGeo = new THREE.RingGeometry(0.86, 1, 40); ringGeo.rotateX(-Math.PI / 2);
const zoneMats = {
  fire: new THREE.MeshBasicMaterial({ color: 0xff7a2a, transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending }),
  thorns: new THREE.MeshBasicMaterial({ color: 0x67c94a, transparent: true, opacity: 0.35, depthWrite: false }),
  meteorMark: new THREE.MeshBasicMaterial({ color: 0xff4a3a, transparent: true, opacity: 0.6, depthWrite: false }),
};
const selMat = new THREE.MeshBasicMaterial({ color: 0xffd36b, transparent: true, opacity: 0.9, depthWrite: false });
const moveMat = new THREE.MeshBasicMaterial({ color: 0x9fe3ff, transparent: true, opacity: 0.9, depthWrite: false });

export function createView(world) {
  const root = world.entities;
  let W = 0, H = 0;
  const towers = new Map();      // id -> { obj, key }
  const enemies = new Map();     // id -> { obj, type, bar, px, py, pz, pyaw, yaw, seen }
  const projs = new Map();       // id -> { obj, kind, px, py, pz }
  const zones = new Map();       // id -> mesh
  const enemyPool = new Map();   // type -> [obj]
  const projPool = new Map();    // kind -> [obj]
  let hero = null;               // { obj, bar, px, pz, yaw, deadT }
  let lamp = null, gates = [];
  let frame = 0;

  const selRing = new THREE.Mesh(ringGeo, selMat); selRing.scale.setScalar(0.45); selRing.visible = false; selRing.renderOrder = 5;
  const moveMark = new THREE.Mesh(ringGeo, moveMat); moveMark.visible = false; moveMark.renderOrder = 5;
  let moveT = 0;

  const wx = (x) => x - W / 2, wz = (z) => z - H / 2;

  function reset(built, state) {
    clear();
    W = state.W; H = state.H;
    lamp = built?.lamp || null;
    gates = built?.gates || [];
    root.add(selRing, moveMark);
  }

  function clear() {
    for (const t of towers.values()) root.remove(t.obj);
    for (const e of enemies.values()) { root.remove(e.obj); root.remove(e.bar.g); }
    for (const p of projs.values()) root.remove(p.obj);
    for (const z of zones.values()) root.remove(z);
    towers.clear(); enemies.clear(); projs.clear(); zones.clear();
    if (hero) { root.remove(hero.obj); root.remove(hero.bar.g); hero = null; }
    root.remove(selRing, moveMark);
    selRing.visible = false; moveMark.visible = false;
  }

  // 每次 sim.step 之前呼叫，記下上一步的位置供插值
  function capturePrev(state) {
    for (const e of state.enemies) {
      const v = enemies.get(e.id);
      if (v) { v.px = e.x; v.py = e.y || 0; v.pz = e.z; }
    }
    for (const p of state.projectiles) {
      const v = projs.get(p.id);
      if (v) { v.px = p.x; v.py = p.y; v.pz = p.z; }
    }
    if (hero && state.hero) { hero.px = state.hero.x; hero.pz = state.hero.z; }
  }

  function towerKey(t) { return `${t.type}|${t.level}|${t.branch || ''}`; }

  function getEnemyObj(type) {
    const pool = enemyPool.get(type);
    const obj = pool && pool.length ? pool.pop() : makeEnemy(type);
    obj.visible = true; obj.scale.setScalar(1);
    return obj;
  }
  function getProjObj(kind) {
    const pool = projPool.get(kind);
    return pool && pool.length ? pool.pop() : makeProjectile(kind);
  }

  // alpha：插值比例；simDt：遊戲時間（暫停為 0）；realDt：真實時間
  function sync(state, alpha, simDt, realDt) {
    frame++;
    const cam = world.camera;

    // 塔
    for (const t of state.towers) {
      let v = towers.get(t.id);
      const key = towerKey(t);
      if (!v || v.key !== key) {
        const oldYaw = v ? v.headYaw : t.yaw;
        if (v) root.remove(v.obj);
        const obj = makeTower(t.type, Math.min(t.level, 3), t.branch || null);
        obj.position.set(wx(t.x), 0, wz(t.z));
        root.add(obj);
        v = { obj, key, headYaw: oldYaw || 0, pop: v ? 0.35 : 0.45, seen: 0 };
        towers.set(t.id, v);
      }
      v.seen = frame;
      const head = v.obj.userData.head;
      if (head) { v.headYaw = lerpAngle(v.headYaw, t.yaw || 0, Math.min(1, realDt * 14)); head.rotation.y = v.headYaw; }
      if (v.pop > 0) {
        v.pop = Math.max(0, v.pop - realDt);
        const k = v.pop / 0.45;
        v.obj.scale.set(1 + Math.sin(k * Math.PI) * 0.18, 1 - Math.sin(k * Math.PI) * 0.12 + (1 - k) * 0, 1 + Math.sin(k * Math.PI) * 0.18);
        if (v.pop === 0) v.obj.scale.setScalar(1);
      }
      v.obj.userData.update?.(simDt);
    }
    for (const [id, v] of towers) if (v.seen !== frame) { root.remove(v.obj); towers.delete(id); }

    // 敵人
    for (const e of state.enemies) {
      let v = enemies.get(e.id);
      if (!v) {
        const obj = getEnemyObj(e.type);
        const bar = makeBar(e.boss ? 1.6 : 0.6, e.boss ? 'boss' : 'enemy');
        root.add(obj); root.add(bar.g);
        v = { obj, type: e.type, bar, px: e.x, py: e.y || 0, pz: e.z, yaw: e.yaw || 0, seen: 0,
              height: obj.userData.height || 0.8 };
        enemies.set(e.id, v);
      }
      v.seen = frame;
      const x = lerp(v.px, e.x, alpha), y = lerp(v.py, e.y || 0, alpha), z = lerp(v.pz, e.z, alpha);
      v.obj.position.set(wx(x), y, wz(z));
      v.yaw = lerpAngle(v.yaw, e.yaw || 0, Math.min(1, realDt * 10));
      v.obj.rotation.y = v.yaw;
      v.obj.userData.update?.(simDt, {
        moving: !!e.moving && !(e.frozen > 0) && !(e.stunned > 0) && !(e.rooted > 0),
        speed: e.speed || 1, frozen: e.frozen > 0, slowed: e.slow > 0, attacking: !!e.blocked,
      });
      // 血條：受傷或有護盾或王才顯示
      const show = e.boss || e.hp < e.maxHp || e.shield > 0;
      v.bar.g.visible = show;
      if (show) {
        v.bar.g.position.set(wx(x), y + v.height + 0.18, wz(z));
        v.bar.g.quaternion.copy(cam.quaternion);
        setBar(v.bar, e.hp / e.maxHp, e.shield / e.maxHp);
      }
    }
    for (const [id, v] of enemies) if (v.seen !== frame) {
      root.remove(v.obj); root.remove(v.bar.g);
      if (!enemyPool.has(v.type)) enemyPool.set(v.type, []);
      enemyPool.get(v.type).push(v.obj);
      enemies.delete(id);
    }

    // 投射物
    for (const p of state.projectiles) {
      let v = projs.get(p.id);
      if (!v) {
        const obj = getProjObj(p.kind);
        root.add(obj);
        v = { obj, kind: p.kind, px: p.x, py: p.y, pz: p.z, seen: 0 };
        projs.set(p.id, v);
      }
      v.seen = frame;
      const x = lerp(v.px, p.x, alpha), y = lerp(v.py, p.y, alpha), z = lerp(v.pz, p.z, alpha);
      v.obj.position.set(wx(x), y, wz(z));
      const vx = p.vx || 0, vy = p.vy || 0, vz = p.vz || 0;
      if (vx * vx + vy * vy + vz * vz > 1e-6) {
        _tmp.set(wx(x) + vx, y + vy, wz(z) + vz);
        v.obj.lookAt(_tmp);
      }
      v.obj.userData.update?.(simDt);
    }
    for (const [id, v] of projs) if (v.seen !== frame) {
      root.remove(v.obj);
      if (!projPool.has(v.kind)) projPool.set(v.kind, []);
      projPool.get(v.kind).push(v.obj);
      projs.delete(id);
    }

    // 地面效果圈（火焰、荊棘、流星瞄準）由 effects.js 依 state.zones 畫，這裡不畫

    // 英雄
    const hs = state.hero;
    if (hs) {
      if (!hero) {
        const obj = makeHero(hs.type || 'knight');
        const bar = makeBar(0.7, 'hero');
        root.add(obj, bar.g);
        hero = { obj, bar, px: hs.x, pz: hs.z, yaw: hs.yaw || 0, deadT: 0, height: obj.userData.height || 1 };
      }
      const x = lerp(hero.px, hs.x, alpha), z = lerp(hero.pz, hs.z, alpha);
      const dead = hs.state === 'dead';
      hero.deadT = dead ? hero.deadT + realDt : 0;
      hero.obj.visible = !dead || hero.deadT < 1.2;
      hero.obj.position.set(wx(x), 0, wz(z));
      hero.yaw = lerpAngle(hero.yaw, hs.yaw || 0, Math.min(1, realDt * 12));
      hero.obj.rotation.y = hero.yaw;
      hero.obj.userData.update?.(simDt, { moving: hs.state === 'move', attacking: hs.state === 'attack', dead });
      hero.bar.g.visible = !dead;
      hero.bar.g.position.set(wx(x), hero.height + 0.22, wz(z));
      hero.bar.g.quaternion.copy(cam.quaternion);
      setBar(hero.bar, hs.hp / hs.maxHp, 0);
      selRing.position.set(wx(x), 0.04, wz(z));
      selRing.scale.setScalar(0.45 + Math.sin(performance.now() / 180) * 0.03);
    }
    if (moveT > 0) {
      moveT -= realDt;
      const k = Math.max(0, moveT / 0.8);
      moveMark.visible = moveT > 0;
      moveMark.scale.setScalar(0.2 + (1 - k) * 0.35);
      moveMat.opacity = k * 0.9;
    }

    // 燈與傳送門
    lamp?.userData.update?.(realDt, state.lamp / state.lampMax, state.env?.time || 'day');
    for (const g of gates) g.userData.update?.(realDt);
  }

  function handleEvent(ev) {
    switch (ev.type) {
      case 'shoot': { const t = towers.get(ev.towerId); t?.obj.userData.fire?.(); break; }
      case 'pulse': { const t = towers.get(ev.towerId); t?.obj.userData.fire?.(); break; }
      case 'hit': { const e = enemies.get(ev.targetId); e?.obj.userData.hit?.(); break; }
      case 'heroAttack': hero?.obj.userData.attack?.(); break;
      case 'upgrade': { const t = towers.get(ev.towerId); if (t) t.pop = 0.45; break; }
    }
  }

  function setHeroSelected(on) { selRing.visible = !!on && !!hero; }
  function showMoveMarker(x, z) { moveMark.position.set(wx(x), 0.04, wz(z)); moveMark.visible = true; moveT = 0.8; }
  function heroScreenHit(state, x, z, radius = 0.7) {
    const hs = state.hero; if (!hs || hs.state === 'dead') return false;
    return (hs.x - x) ** 2 + (hs.z - z) ** 2 < radius * radius;
  }
  function towerObject(id) { return towers.get(id)?.obj || null; }

  return { reset, clear, capturePrev, sync, handleEvent, setHeroSelected, showMoveMarker, heroScreenHit, towerObject };
}

const _tmp = new THREE.Vector3();
