// 敵人：生成、傷害、死亡、漏怪、狀態、特殊能力、移動（純邏輯）
import { ENEMIES } from '../data/enemies.js';
import { BAL } from './balance.js';
import { cellAt } from './map.js';
import { heroGainXp, heroTakeDamage } from './hero.js';

const MAX_EVENTS = 20000;

export function emit(G, ev) {
  if (G.events.length < MAX_EVENTS) G.events.push(ev);
}

export function ccMul(e) { return e.boss ? BAL.BOSS_CC_MUL : 1; }

// ---------- 生成 ----------
export function spawnEnemy(G, type, x, z, wave, parent = null) {
  const d = ENEMIES[type];
  if (!d) return null;
  const M = G.map, P = G.path;
  // 血量＝基礎 × opts.enemyHpMul × 該波 hpMul（分裂／召喚的小怪沿用母體的 wave，所以也套用）
  const wInfo = G.waveInfo[wave];
  const hp = d.hp * G.hpMul * (wInfo && wInfo.hpMul > 0 ? wInfo.hpMul : 1);
  const flying = !!d.flying;
  const e = {
    id: G.nextId++, type, x, y: flying ? BAL.FLY_Y : 0, z, yaw: 0,
    hp, maxHp: hp, shield: 0, flying, boss: !!d.boss, moving: false, blocked: false,
    slow: 0, frozen: 0, rooted: 0, stunned: 0, burning: 0,
    // 以下為內部欄位（畫面可忽略）
    def: d, speed: d.speed, dead: false, leaked: false, wave,
    cell: -1, tc: -1, flowVer: -1, off: (G.rng() * 2 - 1) * BAL.LANE_OFFSET,
    dirX: 0, dirZ: 1, fx: x, fz: z, px: 0, pz: 0,
    slowT: 0, burnDps: 0, burnSrc: 0, atkCd: 0.6, remain: 0, waitT: 0, immuneT: 0,
    auraT: 0, summonT: 0, dimT: 0, splitStage: 0, heroEngaged: false, shieldMax: 0, _gi: -1,
  };
  if (flying) {
    const dx = M.lampX - x, dz = M.lampZ - z, l = Math.hypot(dx, dz) || 1;
    e.px = -dz / l; e.pz = dx / l;
    e.dirX = dx / l; e.dirZ = dz / l;
    const fade = Math.min(1, l / 2);
    e.x = x + e.px * e.off * fade; e.z = z + e.pz * e.off * fade;
    e.remain = l;
  } else if (parent && !parent.flying && parent.cell >= 0) {
    e.cell = parent.cell; e.tc = parent.tc; e.flowVer = parent.flowVer;
    e.dirX = parent.dirX; e.dirZ = parent.dirZ; e.remain = parent.remain;
  } else {
    e.cell = cellAt(M, x, z);
    e.flowVer = P.version;
    e.tc = e.cell === M.lamp ? M.lamp : (P.next[e.cell] >= 0 ? P.next[e.cell] : e.cell);
    const tcC = e.tc % M.W, tcR = (e.tc - tcC) / M.W;
    const dx = tcC + 0.5 - x, dz = tcR + 0.5 - z, l = Math.hypot(dx, dz);
    if (l > 1e-6) { e.dirX = dx / l; e.dirZ = dz / l; }
    e.remain = P.dist[e.cell];
  }
  e.yaw = Math.atan2(e.dirX, e.dirZ);
  const sp = d.special;
  if (sp) {
    if (sp.shieldAura) e.auraT = sp.shieldAura.every * 0.4;
    if (sp.summon) e.summonT = sp.summon.every * 0.6;
    if (sp.dim) e.dimT = sp.dim.every * 0.5;
  }
  const wi = G.waveInfo[wave];
  if (wi) wi.alive++;
  G.state.enemies.push(e);
  emit(G, { type: 'spawn', id: e.id, enemy: type, x: e.x, z: e.z, flying });
  return e;
}

// ---------- 傷害 ----------
// dmgType：'phys' 物理 × (1 − armor)；'magic' 魔法 × (1 − max(0, mres − mresPierce))；'true' 不減免。護盾先吸收（減免後）。
// src：塔物件、'hero' 或 null。回傳實際造成的傷害（含被護盾吸收的部分）。
export function damageEnemy(G, e, amount, dmgType, src) {
  if (e.dead || !(amount > 0)) return 0;
  const d = e.def;
  let dmg = amount;
  if (dmgType === 'phys') dmg *= 1 - (d.armor || 0);
  else if (dmgType === 'magic') dmg *= 1 - Math.max(0, (d.mres || 0) - G.mods.mresPierce);
  const total = dmg;
  if (e.shield > 0) {
    const a = dmg < e.shield ? dmg : e.shield;
    e.shield -= a; dmg -= a;
    if (e.shield <= 1e-6) { e.shield = 0; emit(G, { type: 'shieldBreak', id: e.id }); }
  }
  if (dmg > 0) {
    e.hp -= dmg;
    if (d.special && d.special.splitAt) checkKingSplit(G, e);
    if (e.hp <= 0) killEnemy(G, e, src);
  }
  return total;
}

export function killEnemy(G, e, src) {
  if (e.dead) return;
  e.dead = true; e.hp = 0; e.blocked = false;
  const S = G.state;
  const gold = Math.round((e.def.gold || 0) * G.mods.killGoldMul);
  S.gold += gold;
  S.stats.kills++;
  if (src && typeof src === 'object') src.kills++;
  const wi = G.waveInfo[e.wave];
  if (wi) wi.alive--;
  emit(G, { type: 'death', id: e.id, enemy: e.type, x: e.x, y: e.y, z: e.z, gold });
  if (gold > 0) emit(G, { type: 'gold', amount: gold, x: e.x, z: e.z });
  // 英雄經驗：自己打死或擋過的＝全額；英雄附近（HERO_XP_RADIUS 內）被別人打死的＝HERO_XP_SHARE 倍
  if (src === 'hero' || e.heroEngaged) heroGainXp(G, e.def.gold || 0);
  else {
    const h = S.hero;
    if (h && h.state !== 'dead' && (h.x - e.x) ** 2 + (h.z - e.z) ** 2 <= BAL.HERO_XP_RADIUS * BAL.HERO_XP_RADIUS) heroGainXp(G, (e.def.gold || 0) * BAL.HERO_XP_SHARE);
  }
  const sp = e.def.special;
  if (sp && sp.split) spawnChildren(G, e, sp.split.into, sp.split.count, 0.18);
}

function spawnChildren(G, e, type, count, wait) {
  emit(G, { type: 'split', id: e.id, x: e.x, z: e.z });
  for (let k = 0; k < count; k++) {
    const ch = spawnEnemy(G, type, e.x, e.z, e.wave, e);
    if (!ch) continue;
    ch.waitT = wait * k;
    const lane = count > 1 ? (k / (count - 1)) * 2 - 1 : 0;
    ch.off = lane * BAL.LANE_OFFSET;
  }
}

function checkKingSplit(G, e) {
  const sp = e.def.special, arr = sp.splitAt;
  while (e.splitStage < arr.length && e.hp <= e.maxHp * arr[e.splitStage]) {
    e.splitStage++;
    spawnChildren(G, e, sp.splitInto, sp.splitCount || 2, 0.35);
  }
}

export function leakEnemy(G, e) {
  if (e.dead) return;
  e.dead = true; e.leaked = true; e.blocked = false;
  const S = G.state;
  const dmg = e.def.lamp || 1;
  S.lamp = Math.max(0, S.lamp - dmg);
  S.stats.leaked++;
  const wi = G.waveInfo[e.wave];
  if (wi) wi.alive--;
  emit(G, { type: 'leak', id: e.id, enemy: e.type, damage: dmg, x: e.x, z: e.z });
  if (S.lamp <= 0 && S.phase !== 'lost' && S.phase !== 'won') {
    S.phase = 'lost';
    emit(G, { type: 'lost' });
  }
}

// ---------- 狀態 ----------
export function applySlow(G, e, amt, sec) {
  if (e.dead || !(amt > 0) || !(sec > 0)) return;
  if (amt > 0.9) amt = 0.9;
  if (e.slow <= 0) emit(G, { type: 'status', id: e.id, kind: 'slow' });
  if (amt > e.slow + 1e-6) { e.slow = amt; e.slowT = sec; }
  else if (amt >= e.slow - 1e-6) { if (sec > e.slowT) e.slowT = sec; }
  // 比目前弱的緩速：忽略（取最大值，不疊加）
}
export function applyFreeze(G, e, sec) {
  if (e.dead || !(sec > 0)) return;
  sec *= ccMul(e);
  if (e.frozen <= 0) emit(G, { type: 'status', id: e.id, kind: 'freeze' });
  if (sec > e.frozen) e.frozen = sec;
}
export function applyStun(G, e, sec) {
  if (e.dead || !(sec > 0)) return;
  sec *= ccMul(e);
  if (e.stunned <= 0) emit(G, { type: 'status', id: e.id, kind: 'stun' });
  if (sec > e.stunned) e.stunned = sec;
}
export function applyRoot(G, e, sec) {
  if (e.dead || e.flying || !(sec > 0)) return;
  sec *= ccMul(e);
  if (e.rooted <= 0) emit(G, { type: 'status', id: e.id, kind: 'root' });
  if (sec > e.rooted) e.rooted = sec;
}
export function applyBurn(G, e, dps, sec, towerId) {
  if (e.dead || !(dps > 0) || !(sec > 0)) return;
  if (e.burning <= 0) { emit(G, { type: 'status', id: e.id, kind: 'burn' }); e.burnDps = dps; }
  else if (dps > e.burnDps) e.burnDps = dps;
  if (sec > e.burning) e.burning = sec;
  e.burnSrc = towerId || 0;
}
export function applyShield(G, e, amount) {
  if (e.dead || !(amount > 0)) return;
  if (amount > e.shield) {
    e.shield = amount; e.shieldMax = amount;
    emit(G, { type: 'status', id: e.id, kind: 'shield' });
  }
}

// ---------- 每幀更新 ----------
export function updateEnemies(G, dt) {
  const S = G.state, list = S.enemies;
  const rain = S.env.weather === 'rain';
  const weatherMul = rain ? BAL.RAIN_SPEED_MUL : 1;
  const burnMul = rain ? BAL.RAIN_BURN_MUL : 1;
  const n = list.length;
  for (let k = 0; k < n; k++) {
    const e = list[k];
    if (e.dead) continue;
    // 狀態計時
    if (e.slowT > 0) { e.slowT -= dt; if (e.slowT <= 0) { e.slowT = 0; e.slow = 0; } }
    if (e.frozen > 0) { e.frozen -= dt; if (e.frozen < 0) e.frozen = 0; }
    if (e.stunned > 0) { e.stunned -= dt; if (e.stunned < 0) e.stunned = 0; }
    if (e.rooted > 0) { e.rooted -= dt; if (e.rooted < 0) e.rooted = 0; }
    if (e.immuneT > 0) e.immuneT -= dt;
    if (e.waitT > 0) e.waitT -= dt;
    if (e.burning > 0) {
      const dmg = e.burnDps * dt * burnMul;
      e.burning -= dt;
      if (e.burning <= 0) { e.burning = 0; }
      damageEnemy(G, e, dmg, 'magic', G.towerById.get(e.burnSrc) || null);
      if (e.burning <= 0) e.burnDps = 0;
      if (e.dead) continue;
    }
    const disabled = e.frozen > 0 || e.stunned > 0;
    if (!disabled && e.def.special) enemySpecials(G, e, dt);
    const canMove = !disabled && e.rooted <= 0 && e.waitT <= 0;
    const spd = e.speed * (1 - e.slow) * weatherMul;
    e.moving = false;
    if (e.blocked) {
      moveBlocked(G, e, dt, spd, canMove, !disabled);
    } else if (!canMove) {
      // 原地不動
    } else if (e.flying) {
      moveFlying(G, e, dt, spd);
    } else {
      moveGround(G, e, dt, spd);
    }
  }
}

function moveGround(G, e, dt, spd) {
  const M = G.map, P = G.path, W = M.W, lamp = M.lamp;
  if (e.flowVer !== P.version) {
    e.flowVer = P.version;
    if (e.cell === lamp) e.tc = lamp;
    else { const nx = P.next[e.cell]; if (nx >= 0) e.tc = nx; }
  }
  let tc = e.tc, tx = M.lampX, tz = M.lampZ;
  for (let g = 0; g < 4; g++) {
    if (tc === lamp) { tx = M.lampX; tz = M.lampZ; break; }
    const c = tc % W, r = (tc - c) / W;
    tx = c + 0.5 + P.perpX[tc] * e.off; tz = r + 0.5 + P.perpZ[tc] * e.off;
    const ddx = tx - e.x, ddz = tz - e.z;
    const nn = P.next[tc];
    if (ddx * ddx + ddz * ddz < 0.25 && nn >= 0) tc = nn; else break;
  }
  e.tc = tc;
  const dx = tx - e.x, dz = tz - e.z;
  const len = Math.sqrt(dx * dx + dz * dz);
  const step = spd * dt;
  if (tc === lamp && len <= step + 0.03) { e.x = tx; e.z = tz; e.moving = true; leakEnemy(G, e); return; }
  if (len < 1e-6) return;
  const ux = dx / len, uz = dz / len;
  const kk = dt * BAL.TURN_RATE < 1 ? dt * BAL.TURN_RATE : 1;
  let vx = e.dirX + (ux - e.dirX) * kk, vz = e.dirZ + (uz - e.dirZ) * kk;
  const vl = Math.sqrt(vx * vx + vz * vz);
  if (vl < 1e-4) { vx = ux; vz = uz; } else { vx /= vl; vz /= vl; }
  const mv = step < len ? step : len;
  let nx = e.x + vx * mv, nz = e.z + vz * mv;
  let ci = cellAt(M, nx, nz);
  if (!P.walk[ci]) {
    // 平滑轉向會切到牆角：改走直線
    vx = ux; vz = uz; nx = e.x + ux * mv; nz = e.z + uz * mv; ci = cellAt(M, nx, nz);
    if (!P.walk[ci] && e.cell >= 0) {
      // 還是會切角：先走向目前格的下一格中心（必定在可走格內）
      const n1 = P.next[e.cell] >= 0 ? P.next[e.cell] : e.cell;
      const c1 = n1 % W, r1 = (n1 - c1) / W;
      const ddx = c1 + 0.5 - e.x, ddz = r1 + 0.5 - e.z, dl = Math.sqrt(ddx * ddx + ddz * ddz) || 1;
      vx = ddx / dl; vz = ddz / dl;
      const m2 = mv < dl ? mv : dl;
      nx = e.x + vx * m2; nz = e.z + vz * m2; ci = cellAt(M, nx, nz);
      e.tc = tc = n1;
    }
  }
  e.x = nx; e.z = nz; e.dirX = vx; e.dirZ = vz;
  e.yaw = Math.atan2(vx, vz);
  e.moving = mv > 0;
  if (ci !== e.cell && P.walk[ci] && P.dist[ci] < Infinity) e.cell = ci;
  e.remain = (tc === lamp ? 0 : P.dist[tc]) + (len - mv);
}

function moveFlying(G, e, dt, spd) {
  const M = G.map;
  const dx = M.lampX - e.fx, dz = M.lampZ - e.fz;
  const d = Math.sqrt(dx * dx + dz * dz);
  const step = spd * dt;
  if (d <= step + 0.05) { e.x = M.lampX; e.z = M.lampZ; leakEnemy(G, e); return; }
  e.fx += (dx / d) * step; e.fz += (dz / d) * step;
  const rem = d - step;
  const fade = rem < 2 ? rem / 2 : 1;
  e.x = e.fx + e.px * e.off * fade; e.z = e.fz + e.pz * e.off * fade;
  e.dirX = dx / d; e.dirZ = dz / d;
  e.yaw = Math.atan2(e.dirX, e.dirZ);
  e.moving = true;
  e.remain = rem;
}

function moveBlocked(G, e, dt, spd, canMove, canAct) {
  const h = G.state.hero;
  if (h.state === 'dead') return;
  const M = G.map, P = G.path;
  const dx = h.x - e.x, dz = h.z - e.z, d = Math.sqrt(dx * dx + dz * dz);
  if (d > 1e-4) e.yaw = Math.atan2(dx, dz);
  if (canMove && d > BAL.ENEMY_CONTACT) {
    const mv = Math.min(spd * dt, d - BAL.ENEMY_CONTACT);
    const nx = e.x + (dx / d) * mv, nz = e.z + (dz / d) * mv;
    const ci = cellAt(M, nx, nz);
    if (P.walk[ci]) {
      e.x = nx; e.z = nz; e.moving = true;
      if (P.dist[ci] < Infinity) e.cell = ci;
    }
  }
  if (canAct && d <= BAL.ENEMY_REACH) {
    e.atkCd -= dt;
    if (e.atkCd <= 0) {
      e.atkCd += 1 / (e.def.atkRate || 1);
      if (e.def.atk > 0) heroTakeDamage(G, e.def.atk, e);
    }
  }
}

function enemySpecials(G, e, dt) {
  const sp = e.def.special;
  if (sp.shieldAura) {
    e.auraT -= dt;
    if (e.auraT <= 0) {
      const a = sp.shieldAura;
      e.auraT += a.every;
      const q = G.qC;
      const cnt = G.grid.query(e.x, e.z, a.radius, q, 0);
      let any = false;
      for (let i = 0; i < cnt; i++) {
        const o = q[i];
        if (o === e || o.dead) continue;
        applyShield(G, o, a.amount);
        any = true;
      }
      emit(G, { type: 'aura', id: e.id, x: e.x, z: e.z, radius: a.radius, any });
    }
  }
  if (sp.summon) {
    e.summonT -= dt;
    if (e.summonT <= 0) {
      const s = sp.summon;
      e.summonT += s.every;
      emit(G, { type: 'summon', id: e.id, x: e.x, z: e.z, enemy: s.type, count: s.count });
      for (let i = 0; i < s.count; i++) {
        const ang = (i / s.count) * Math.PI * 2 + G.rng();
        const r = 0.35;
        const ox = e.x + Math.cos(ang) * r, oz = e.z + Math.sin(ang) * r;
        spawnEnemy(G, s.type, ox, oz, e.wave, null);
      }
    }
  }
  if (sp.dim) {
    e.dimT -= dt;
    if (e.dimT <= 0) {
      const dm = sp.dim;
      e.dimT += dm.every;
      const r2 = dm.radius * dm.radius;
      const towers = G.state.towers;
      for (let i = 0; i < towers.length; i++) {
        const t = towers[i];
        const ddx = t.x - e.x, ddz = t.z - e.z;
        if (ddx * ddx + ddz * ddz <= r2) {
          if (dm.sec > t.dimT) t.dimT = dm.sec;
          t.dimMul = dm.rangeMul;
          t.dimmed = true;
        }
      }
      emit(G, { type: 'dim', id: e.id, x: e.x, z: e.z, radius: dm.radius });
    }
  }
}
