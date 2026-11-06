// 英雄（守燈騎士）：移動、守備點、攔截、攻擊、死亡復活、升級（純邏輯）
import { HEROES } from '../data/heroes.js';
import { BAL } from './balance.js';
import { cellAt, dijkstra } from './map.js';
import { emit, damageEnemy } from './combat.js';

function lvlMul(def, level) { return 1 + (def.perLevel || 0) * (level - 1); }

export function heroWalkable(G, i) { return G.heroWalk[i] === 1; }

// 離 (x, z) 最近的英雄可走格（不管連通）
export function nearestHeroCell(G, x, z) {
  const { W, N } = G.map;
  let best = -1, bd = Infinity;
  for (let i = 0; i < N; i++) {
    if (!G.heroWalk[i]) continue;
    const c = i % W, r = (i - c) / W;
    const dx = c + 0.5 - x, dz = r + 0.5 - z, d2 = dx * dx + dz * dz;
    if (d2 < bd) { bd = d2; best = i; }
  }
  return best;
}

export function createHero(G, levelDef) {
  const def = HEROES.knight;
  const M = G.map;
  let x, z;
  const hs = levelDef.heroStart;
  if (hs && hs.c >= 0 && hs.r >= 0 && hs.c < M.W && hs.r < M.H && G.heroWalk[hs.r * M.W + hs.c]) {
    x = hs.c + 0.5; z = hs.r + 0.5;
  } else {
    const ref = hs ? { x: hs.c + 0.5, z: hs.r + 0.5 } : { x: M.lampX, z: M.lampZ };
    const i = nearestHeroCell(G, ref.x, ref.z);
    const c = i % M.W, r = (i - c) / M.W;
    x = c + 0.5; z = r + 0.5;
  }
  const maxHp = def.hp * G.mods.heroHpMul;
  G.hi = {
    def, path: null, pathI: 0, cmd: false, block: [], atkCd: 0, combatT: 99, chaseT: 0,
    dist: new Float32Array(M.N), parent: new Int32Array(M.N),
  };
  return {
    type: 'knight', x, z, yaw: 0, hp: maxHp, maxHp, level: 1, xp: 0,
    xpNext: def.levelXp && def.levelXp.length ? def.levelXp[0] : null,
    state: 'idle', respawnIn: 0, target: null,
    // 新增欄位
    postX: x, postZ: z, damage: def.damage * G.mods.heroDamageMul, blocking: 0,
  };
}

function releaseOne(G, e, immune) {
  e.blocked = false;
  e.flowVer = -1; // 重新對準流場
  if (immune) e.immuneT = immune;
}

export function heroReleaseAll(G, immune = 0) {
  const hi = G.hi;
  for (const e of hi.block) if (!e.dead) releaseOne(G, e, immune);
  hi.block.length = 0;
  G.state.hero.blocking = 0;
}

// 英雄可走格上的路徑（格子中心點），從 (sx, sz) 到 goal 格；終點換成 (gx, gz)
function buildPath(G, sx, sz, gx, gz) {
  const M = G.map, hi = G.hi;
  let start = cellAt(M, sx, sz);
  dijkstra(M.W, M.H, G.heroWalk, start, hi.dist, G.path.heap, hi.parent);
  let goal = cellAt(M, gx, gz);
  if (!G.heroWalk[goal] || !(hi.dist[goal] < Infinity)) {
    // 走到最近的可到達格
    let best = -1, bd = Infinity;
    for (let i = 0; i < M.N; i++) {
      if (!G.heroWalk[i] || !(hi.dist[i] < Infinity)) continue;
      const c = i % M.W, r = (i - c) / M.W;
      const dx = c + 0.5 - gx, dz = r + 0.5 - gz, d2 = dx * dx + dz * dz;
      if (d2 < bd) { bd = d2; best = i; }
    }
    if (best < 0) return null;
    goal = best;
    const c = goal % M.W, r = (goal - c) / M.W;
    gx = c + 0.5; gz = r + 0.5;
  } else {
    const c = goal % M.W, r = (goal - c) / M.W;
    gx = Math.min(c + 0.95, Math.max(c + 0.05, gx));
    gz = Math.min(r + 0.95, Math.max(r + 0.05, gz));
  }
  const cells = [];
  let i = goal, guard = M.N + 2;
  while (i >= 0 && i !== start && guard-- > 0) { cells.push(i); i = hi.parent[i]; }
  cells.reverse();
  const pts = [];
  for (let k = 0; k < cells.length - 1; k++) {
    const c = cells[k] % M.W, r = (cells[k] - c) / M.W;
    pts.push({ x: c + 0.5, z: r + 0.5 });
  }
  pts.push({ x: gx, z: gz });
  return { pts, gx, gz };
}

// 玩家指令：走到 (x, z)，那裡就是新的守備點
export function moveHero(G, x, z) {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return false;
  const h = G.state.hero, hi = G.hi;
  const dead = h.state === 'dead';
  const res = buildPath(G, dead ? h.postX : h.x, dead ? h.postZ : h.z, x, z);
  if (!res) return false;
  heroReleaseAll(G);
  h.postX = res.gx; h.postZ = res.gz;
  h.target = null;
  if (dead) { hi.path = null; return true; }
  hi.path = res.pts; hi.pathI = 0; hi.cmd = true;
  h.state = 'move';
  return true;
}

// 蓋塔後：守備點或英雄所在格不能再走時，換到最近的可走格
export function heroOnBuild(G, cellIdx) {
  const h = G.state.hero, M = G.map;
  if (cellAt(M, h.postX, h.postZ) === cellIdx) {
    const i = nearestHeroCell(G, h.postX, h.postZ);
    if (i >= 0) { const c = i % M.W, r = (i - c) / M.W; h.postX = c + 0.5; h.postZ = r + 0.5; }
  }
  if (h.state !== 'dead' && cellAt(M, h.x, h.z) === cellIdx) {
    const i = nearestHeroCell(G, h.x, h.z);
    if (i >= 0) { const c = i % M.W, r = (i - c) / M.W; h.x = c + 0.5; h.z = r + 0.5; }
  }
  if (G.hi.path) G.hi.path = null; // 路徑可能失效，下一幀重算回守備點
}

export function heroTakeDamage(G, amount, src) {
  const h = G.state.hero, hi = G.hi;
  if (h.state === 'dead' || !(amount > 0)) return;
  const dmg = amount * (1 - (hi.def.armor || 0));
  h.hp -= dmg;
  hi.combatT = 0;
  emit(G, { type: 'heroHurt', damage: dmg, by: src ? src.id : null });
  if (h.hp <= 0) {
    h.hp = 0;
    h.state = 'dead';
    h.respawnIn = Math.max(3, (hi.def.respawn || 15) + G.mods.heroRespawnAdd);
    h.target = null;
    hi.path = null; hi.cmd = false;
    heroReleaseAll(G);
    emit(G, { type: 'heroDeath', x: h.x, z: h.z });
  }
}

export function heroGainXp(G, amount) {
  const h = G.state.hero, def = G.hi.def;
  const lx = def.levelXp || [];
  if (!(amount > 0) || h.level > lx.length) return;
  h.xp += amount;
  while (h.level <= lx.length && h.xp >= lx[h.level - 1]) {
    h.level++;
    const newMax = def.hp * G.mods.heroHpMul * lvlMul(def, h.level);
    if (h.state !== 'dead') h.hp += newMax - h.maxHp;
    h.maxHp = newMax;
    h.damage = def.damage * G.mods.heroDamageMul * lvlMul(def, h.level);
    emit(G, { type: 'heroLevel', level: h.level, x: h.x, z: h.z });
  }
  h.xpNext = h.level <= lx.length ? lx[h.level - 1] : null;
}

// 直線走向 (tx, tz)，碰到不可走格就沿牆滑；回傳是否已到達
function stepToward(G, h, tx, tz, step) {
  const dx = tx - h.x, dz = tz - h.z, d = Math.sqrt(dx * dx + dz * dz);
  if (d < 1e-6) return true;
  h.yaw = Math.atan2(dx, dz);
  const s = d < step ? d : step;
  const nx = h.x + (dx / d) * s, nz = h.z + (dz / d) * s;
  const M = G.map;
  if (G.heroWalk[cellAt(M, nx, nz)]) { h.x = nx; h.z = nz; }
  else if (G.heroWalk[cellAt(M, nx, h.z)]) h.x = nx;
  else if (G.heroWalk[cellAt(M, h.x, nz)]) h.z = nz;
  return d <= step;
}

function followPath(G, h, hi, step) {
  const pts = hi.path;
  let tgt = pts[hi.pathI];
  const last = hi.pathI >= pts.length - 1;
  let dx = tgt.x - h.x, dz = tgt.z - h.z;
  if (!last && dx * dx + dz * dz < 0.35 * 0.35) {
    hi.pathI++;
    tgt = pts[hi.pathI];
    dx = tgt.x - h.x; dz = tgt.z - h.z;
  }
  const d = Math.sqrt(dx * dx + dz * dz);
  if (d > 1e-6) h.yaw = Math.atan2(dx, dz);
  if (hi.pathI >= pts.length - 1 && d <= step) {
    h.x = tgt.x; h.z = tgt.z;
    hi.path = null; hi.cmd = false;
    return true;
  }
  const s = d < step ? d : step;
  if (d > 1e-6) { h.x += (dx / d) * s; h.z += (dz / d) * s; }
  return false;
}

export function updateHero(G, dt) {
  const h = G.state.hero, hi = G.hi, def = hi.def;
  if (h.state === 'dead') {
    h.respawnIn -= dt;
    if (h.respawnIn <= 0) {
      h.respawnIn = 0;
      h.x = h.postX; h.z = h.postZ;
      h.hp = h.maxHp;
      h.state = 'idle';
      hi.combatT = 99; hi.atkCd = 0.3;
      emit(G, { type: 'heroRespawn', x: h.x, z: h.z });
    }
    return;
  }
  hi.combatT += dt;
  if (hi.atkCd > 0) hi.atkCd -= dt;
  if (hi.combatT > BAL.HERO_REGEN_DELAY && h.hp < h.maxHp) {
    h.hp = Math.min(h.maxHp, h.hp + (def.regen || 0) * lvlMul(def, h.level) * dt);
  }
  const step = (def.speed || 1.5) * dt;
  // 玩家指令移動中：不理敵人
  if (hi.path && hi.cmd) {
    h.state = 'move';
    followPath(G, h, hi, step);
    if (!hi.path) h.state = 'idle';
    h.target = null;
    return;
  }
  const block = hi.block;
  const lx = h.postX, lz = h.postZ;
  const leash2 = BAL.HERO_LEASH * BAL.HERO_LEASH;
  // 清理
  for (let i = block.length - 1; i >= 0; i--) {
    const e = block[i];
    const dx = e.x - lx, dz = e.z - lz;
    if (e.dead || !e.blocked || dx * dx + dz * dz > leash2) {
      if (!e.dead) releaseOne(G, e, 1.5);
      block.splice(i, 1);
    }
  }
  // 攔截新的
  const cap = def.blocks || 1;
  if (block.length < cap) {
    const q = G.qB;
    const n = G.grid.query(lx, lz, BAL.HERO_ENGAGE, q, 1);
    while (block.length < cap) {
      let best = null, bd = Infinity;
      for (let k = 0; k < n; k++) {
        const e = q[k];
        if (e.dead || e.blocked || e.immuneT > 0 || e.flying) continue;
        const dx = e.x - h.x, dz = e.z - h.z, d2 = dx * dx + dz * dz;
        if (d2 < bd) { bd = d2; best = e; }
      }
      if (!best) break;
      best.blocked = true; best.heroEngaged = true;
      block.push(best);
    }
  }
  h.blocking = block.length;
  const primary = block.length ? block[0] : null;
  if (primary) {
    hi.path = null;
    h.target = primary.id;
    hi.combatT = 0;
    const dx = primary.x - h.x, dz = primary.z - h.z, d = Math.sqrt(dx * dx + dz * dz);
    const range = def.range || 0.9;
    if (d > range) {
      h.state = 'move';
      stepToward(G, h, primary.x, primary.z, step);
      hi.chaseT += dt;
      const pdx = h.x - lx, pdz = h.z - lz;
      if (hi.chaseT > BAL.HERO_CHASE_GIVEUP || pdx * pdx + pdz * pdz > leash2) {
        releaseOne(G, primary, 4);
        block.shift();
        hi.chaseT = 0;
        h.blocking = block.length;
      }
    } else {
      hi.chaseT = 0;
      h.state = 'attack';
      if (d > 1e-6) h.yaw = Math.atan2(dx, dz);
      if (hi.atkCd <= 0) {
        hi.atkCd += 1 / (def.rate || 1);
        if (hi.atkCd < 0) hi.atkCd = 0;
        const dealt = damageEnemy(G, primary, h.damage, 'phys', 'hero');
        emit(G, { type: 'heroAttack', targetId: primary.id });
        emit(G, { type: 'hit', x: primary.x, y: primary.y + 0.4, z: primary.z, kind: 'sword', dmgType: 'phys', damage: dealt, targetId: primary.id });
      }
    }
    return;
  }
  h.target = null;
  hi.chaseT = 0;
  // 沒有目標：回守備點
  const dx = lx - h.x, dz = lz - h.z, d2 = dx * dx + dz * dz;
  if (d2 > 0.0025) {
    h.state = 'move';
    if (!hi.path) {
      const res = buildPath(G, h.x, h.z, lx, lz);
      hi.path = res ? res.pts : [{ x: lx, z: lz }];
      hi.pathI = 0; hi.cmd = false;
    }
    if (followPath(G, h, hi, step)) h.state = 'idle';
  } else {
    hi.path = null;
    h.state = 'idle';
  }
}
