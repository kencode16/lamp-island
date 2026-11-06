// 塔、投射物、地帶（純邏輯）
import { TOWERS } from '../data/towers.js';
import { BAL } from './balance.js';
import { emit, damageEnemy, applySlow, applyFreeze, applyStun, applyRoot, applyBurn } from './combat.js';

export function levelData(type, level, branch) {
  const T = TOWERS[type];
  if (!T) return null;
  if (level <= 3) return T.levels[level - 1];
  return T.branches[branch] || null;
}

// 套上天賦後的塔數值（不含夜晚、熄光；那些在 effectiveRange 處理）
export function computeStats(G, type, level, branch) {
  const T = TOWERS[type];
  const L = levelData(type, level, branch);
  const m = G.mods.tower[type];
  const sp = L.special || null;
  const fz = sp && sp.fireZone;
  return {
    type, level, branch: level === 4 ? branch : null,
    name: level === 4 ? L.name : T.name,
    desc: level === 4 ? L.desc : T.desc,
    damage: L.damage * m.damageMul,
    rate: L.rate * m.rateMul,
    baseRange: L.range * m.rangeMul,
    splash: (L.splash || 0) * m.splashMul,
    projectile: L.projectile !== undefined ? L.projectile : T.projectile,
    dmgType: T.dmgType, air: !!T.air, special: sp,
    slow: sp && sp.slow ? Math.min(0.9, sp.slow + m.slowAdd) : 0,
    fireRadius: fz ? fz.radius * m.splashMul : 0,
    muzzleY: BAL.MUZZLE_Y[level] || 1,
  };
}

export function effectiveRange(G, t) {
  let r = t.st.baseRange;
  if (G.state.env.time === 'night' && t.type !== 'mage') r *= BAL.NIGHT_RANGE_MUL;
  if (t.dimmed) r *= t.dimMul || 0.7;
  return r;
}

// arr[0..k) 依 remain 由小到大（部分選擇排序）
function selectTopK(arr, n, k) {
  for (let i = 0; i < k; i++) {
    let bi = i, bv = arr[i].remain;
    for (let j = i + 1; j < n; j++) if (arr[j].remain < bv) { bv = arr[j].remain; bi = j; }
    if (bi !== i) { const tmp = arr[i]; arr[i] = arr[bi]; arr[bi] = tmp; }
  }
}

function wrapAngle(a) {
  a = (a + Math.PI) % (Math.PI * 2);
  if (a < 0) a += Math.PI * 2;
  return a - Math.PI;
}

export function updateTowers(G, dt) {
  const towers = G.state.towers;
  const q = G.qA;
  for (let i = 0; i < towers.length; i++) {
    const t = towers[i];
    if (t.dimT > 0) { t.dimT -= dt; if (t.dimT <= 0) { t.dimT = 0; t.dimmed = false; } }
    t.range = effectiveRange(G, t);
    t.cd -= dt;
    if (t.type === 'treant') { updateTreant(G, t); continue; }
    t.aimT -= dt;
    let tg = t.target;
    if (tg && tg.dead) tg = t.target = null;
    if (t.aimT <= 0 || t.cd <= 0) {
      t.aimT = 0.1;
      const n = G.grid.query(t.x, t.z, t.range, q, t.st.air ? 0 : 1);
      tg = null;
      let best = Infinity;
      for (let k = 0; k < n; k++) { const e = q[k]; if (e.remain < best) { best = e.remain; tg = e; } }
      t.target = tg;
    }
    if (tg) {
      const want = Math.atan2(tg.x - t.x, tg.z - t.z);
      const diff = wrapAngle(want - t.yaw);
      const mt = BAL.TOWER_TURN * dt;
      t.yaw = wrapAngle(t.yaw + (diff > mt ? mt : diff < -mt ? -mt : diff));
      if (t.cd <= 0) fire(G, t, tg);
    } else if (t.cd < 0) t.cd = 0;
  }
}

function fire(G, t, tg) {
  const st = t.st, sp = st.special;
  const kind = st.projectile;
  t.yaw = Math.atan2(tg.x - t.x, tg.z - t.z);
  t.cd += 1 / st.rate;
  if (t.cd < 0) t.cd = 0;
  emit(G, { type: 'shoot', towerId: t.id, kind, x: t.x, y: st.muzzleY, z: t.z, targetId: tg.id });
  if (kind === 'lightning') { chainLightning(G, t, tg); return; }
  if (sp && sp.multishot > 1) {
    const q = G.qA;
    const n = G.grid.query(t.x, t.z, t.range, q, st.air ? 0 : 1);
    const k = Math.min(sp.multishot, n);
    if (k > 0) {
      selectTopK(q, n, k);
      for (let s = 0; s < sp.multishot; s++) launch(G, t, q[s % k]);
    } else launch(G, t, tg);
    return;
  }
  launch(G, t, tg);
}

function launch(G, t, tg) {
  const st = t.st, kind = st.projectile;
  const cfg = BAL.PROJ[kind] || BAL.PROJ.arrow;
  const sx = t.x, sy = st.muzzleY, sz = t.z;
  const ax = tg.x, ay = tg.flying ? tg.y : 0.35, az = tg.z;
  const dist = Math.hypot(ax - sx, az - sz);
  const T = cfg.speed ? Math.max(0.06, Math.hypot(dist, ay - sy) / cfg.speed) : cfg.tBase + cfg.tPer * dist;
  G.state.projectiles.push({
    id: G.nextId++, kind, x: sx, y: sy, z: sz, vx: 0, vy: 0, vz: 0,
    // 內部欄位
    sx, sy, sz, ax, ay, az, target: tg, targetId: tg.id, t: 0, T, arc: cfg.arcBase + cfg.arcPer * dist,
    tower: t, towerId: t.id, damage: st.damage, dmgType: st.dmgType, splash: st.splash, special: st.special, fireRadius: st.fireRadius,
  });
}

export function updateProjectiles(G, dt) {
  const list = G.state.projectiles;
  let w = 0;
  const n = list.length;
  for (let i = 0; i < n; i++) {
    const p = list[i];
    const tg = p.target;
    if (tg) {
      if (tg.dead) p.target = null;
      else { p.ax = tg.x; p.ay = tg.flying ? tg.y : 0.35; p.az = tg.z; }
    }
    p.t += dt;
    let u = p.t / p.T; if (u > 1) u = 1;
    const ox = p.x, oy = p.y, oz = p.z;
    p.x = p.sx + (p.ax - p.sx) * u;
    p.y = p.sy + (p.ay - p.sy) * u + p.arc * 4 * u * (1 - u);
    p.z = p.sz + (p.az - p.sz) * u;
    p.vx = (p.x - ox) / dt; p.vy = (p.y - oy) / dt; p.vz = (p.z - oz) / dt;
    if (u >= 1) { impact(G, p, p.target); continue; }
    list[w++] = p;
  }
  // impact 期間不會新增投射物，但保險起見保留之後加進來的
  for (let i = n; i < list.length; i++) list[w++] = list[i];
  list.length = w;
}

function impact(G, p, tg) {
  const sp = p.special;
  if (p.splash > 0) {
    const ek = p.kind === 'boulder' ? 'boulder' : p.kind === 'firebomb' ? 'fire' : 'rock';
    emit(G, { type: 'explode', x: p.ax, z: p.az, radius: p.splash, kind: ek, towerId: p.towerId });
    const q = G.qB;
    const n = G.grid.query(p.ax, p.az, p.splash, q, 1);
    for (let i = 0; i < n; i++) {
      const e = q[i];
      if (e.dead) continue;
      const dealt = damageEnemy(G, e, p.damage, p.dmgType, p.tower);
      emit(G, { type: 'hit', x: e.x, y: e.y + 0.35, z: e.z, kind: p.kind, dmgType: p.dmgType, damage: dealt, targetId: e.id });
      if (sp) {
        if (sp.stun) applyStun(G, e, sp.stun);
        if (sp.burn) applyBurn(G, e, sp.burn.dps, sp.burn.sec, p.towerId);
      }
    }
    if (sp && sp.fireZone) {
      addZone(G, 'fire', p.ax, p.az, p.fireRadius || sp.fireZone.radius, sp.fireZone.sec, { dps: sp.fireZone.dps, src: p.tower });
    }
    return;
  }
  if (!tg || tg.dead) return; // 目標已死：落在最後位置，沒有傷害
  let dmg = p.damage;
  if (sp && sp.airBonus && tg.flying) dmg *= sp.airBonus;
  const dealt = damageEnemy(G, tg, dmg, p.dmgType, p.tower);
  emit(G, { type: 'hit', x: p.x, y: p.y, z: p.z, kind: p.kind, dmgType: p.dmgType, damage: dealt, targetId: tg.id });
  if (sp) {
    if (sp.slow) applySlow(G, tg, sp.slow, sp.slowSec || 1);
    if (sp.freezeChance && G.rng() < sp.freezeChance) applyFreeze(G, tg, sp.freezeSec || 1);
  }
}

function chainLightning(G, t, first) {
  const st = t.st, sp = st.special || {};
  const maxN = sp.chain || 1, fall = sp.chainFalloff != null ? sp.chainFalloff : 0.8, cr = sp.chainRange || 1.8;
  const pts = [{ x: t.x, y: st.muzzleY, z: t.z }];
  const hitList = G.chainHit; hitList.length = 0;
  const q = G.qB;
  let cur = first, dmg = st.damage;
  for (let k = 0; k < maxN && cur; k++) {
    pts.push({ x: cur.x, y: cur.flying ? cur.y : 0.4, z: cur.z });
    hitList.push(cur);
    const dealt = damageEnemy(G, cur, dmg, st.dmgType, t);
    emit(G, { type: 'hit', x: cur.x, y: cur.flying ? cur.y : 0.4, z: cur.z, kind: 'lightning', dmgType: st.dmgType, damage: dealt, targetId: cur.id });
    const n = G.grid.query(cur.x, cur.z, cr, q, st.air ? 0 : 1);
    let best = null, bd = Infinity;
    for (let i = 0; i < n; i++) {
      const e = q[i];
      if (e.dead || hitList.includes(e)) continue;
      const dx = e.x - cur.x, dz = e.z - cur.z, d2 = dx * dx + dz * dz;
      if (d2 < bd) { bd = d2; best = e; }
    }
    cur = best; dmg *= fall;
  }
  emit(G, { type: 'beam', kind: 'lightning', points: pts, towerId: t.id });
}

function updateTreant(G, t) {
  if (t.cd > 0) return;
  const st = t.st, sp = st.special || {};
  const q = G.qA;
  const n = G.grid.query(t.x, t.z, t.range, q, 1);
  if (n === 0) { t.cd = 0; return; }
  t.cd += 1 / st.rate;
  if (t.cd < 0) t.cd = 0;
  const kind = t.branch === 'a' ? 'thorns' : t.branch === 'b' ? 'roots' : 'vines';
  emit(G, { type: 'pulse', towerId: t.id, kind, x: t.x, z: t.z, radius: t.range });
  if (sp.root) {
    const k = Math.min(sp.rootTargets || 1, n);
    selectTopK(q, n, k);
    for (let i = 0; i < k; i++) applyRoot(G, q[i], sp.root);
  }
  for (let i = 0; i < n; i++) {
    const e = q[i];
    if (e.dead) continue;
    damageEnemy(G, e, st.damage, st.dmgType, t);
    if (st.slow > 0) applySlow(G, e, st.slow, sp.slowSec || 1.5);
  }
  // 塔頭朝向最前面的敵人
  let best = null, bv = Infinity;
  for (let i = 0; i < n; i++) if (!q[i].dead && q[i].remain < bv) { bv = q[i].remain; best = q[i]; }
  if (best) t.yaw = Math.atan2(best.x - t.x, best.z - t.z);
}

// ---------- 地帶 ----------
export function addZone(G, kind, x, z, radius, ttl, extra) {
  const zn = { id: G.nextId++, kind, x, z, radius, ttl, dps: 0, src: null, damage: 0, towerId: 0, skill: null };
  if (extra) Object.assign(zn, extra);
  G.state.zones.push(zn);
  return zn;
}

export function updateZones(G, dt) {
  const list = G.state.zones;
  const rain = G.state.env.weather === 'rain';
  let w = 0;
  const n = list.length;
  for (let i = 0; i < n; i++) {
    const zn = list[i];
    if (zn.kind === 'thorns') {
      const t = G.towerById.get(zn.towerId);
      if (!t) continue; // 塔賣掉了
      zn.radius = t.range; zn.x = t.x; zn.z = t.z;
      list[w++] = zn;
      continue;
    }
    zn.ttl -= dt;
    if (zn.kind === 'fire') {
      const q = G.qB;
      const cnt = G.grid.query(zn.x, zn.z, zn.radius, q, 1);
      const dmg = zn.dps * dt * (rain ? BAL.RAIN_BURN_MUL : 1);
      for (let k = 0; k < cnt; k++) damageEnemy(G, q[k], dmg, 'magic', zn.src);
    } else if (zn.kind === 'meteorMark' && zn.ttl <= 0) {
      emit(G, { type: 'explode', x: zn.x, z: zn.z, radius: zn.radius, kind: 'meteor' });
      const q = G.qB;
      const cnt = G.grid.query(zn.x, zn.z, zn.radius, q, 0);
      for (let k = 0; k < cnt; k++) {
        const e = q[k];
        if (e.dead) continue;
        const dealt = damageEnemy(G, e, zn.damage, 'magic', null);
        emit(G, { type: 'hit', x: e.x, y: e.y + 0.35, z: e.z, kind: 'meteor', dmgType: 'magic', damage: dealt, targetId: e.id });
      }
    }
    if (zn.ttl > 0) list[w++] = zn;
  }
  for (let i = n; i < list.length; i++) list[w++] = list[i];
  list.length = w;
}
