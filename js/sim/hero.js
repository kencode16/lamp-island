// 英雄（守燈騎士／森林妖精／星詠法師）：移動、守備點、攔截、攻擊、死亡復活、升級、英雄技能（純邏輯）
// 騎士＝近戰（擋 blocks 隻、追打被擋的）；妖精＝飛行遠程（不擋人、地面敵人打不到她）；法師＝遠程火球（splash，擋 1 隻）。
import { HEROES, HERO_SKILLS } from '../data/heroes.js';
import { BAL } from './balance.js';
import { cellAt, dijkstra } from './map.js';
import { emit, damageEnemy, applyStun, applyFreeze, knockBack } from './combat.js';
import { launchHeroProjectile, addZone } from './towersim.js';
import { addTimedLight } from './light.js';
import { Q_VISIBLE } from './spatial.js';

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

function clampFly(G, x, z) {
  const M = G.map;
  return { x: Math.min(M.W - 0.3, Math.max(0.3, x)), z: Math.min(M.H - 0.3, Math.max(0.3, z)) };
}

export function createHero(G, levelDef, heroType) {
  const type = HEROES[heroType] ? heroType : 'knight';
  const def = HEROES[type];
  const M = G.map;
  const flying = !!def.flying;
  let x, z;
  const hs = levelDef.heroStart;
  const inMap = hs && hs.c >= 0 && hs.r >= 0 && hs.c < M.W && hs.r < M.H;
  if (inMap && (flying || G.heroWalk[hs.r * M.W + hs.c])) {
    x = hs.c + 0.5; z = hs.r + 0.5;
  } else if (flying) {
    x = M.lampX; z = M.lampZ;
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
    aimT: 0, rtarget: null, dash: null, castT: 0,
  };
  const skills = {};
  for (const id of def.skills || []) {
    const sk = HERO_SKILLS[id];
    if (!sk) continue;
    const unlocked = (sk.minLevel || 1) <= 1;
    skills[id] = { cd: 0, cdMax: sk.cd * G.mods.heroSkillCdMul, unlocked, ready: unlocked };
  }
  return {
    type, x, z, yaw: 0, hp: maxHp, maxHp, level: 1, xp: 0,
    xpNext: def.levelXp && def.levelXp.length ? def.levelXp[0] : null,
    state: 'idle', respawnIn: 0, target: null,
    // 新增欄位
    postX: x, postZ: z, damage: def.damage * G.mods.heroDamageMul, blocking: 0,
    // 第二章
    light: (def.light || 0) * G.mods.heroLightMul, flying, attack: def.attack || 'sword', range: def.range || 0.9,
    skills, casting: null, dashing: false,
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

// 玩家指令：走到 (x, z)，那裡就是新的守備點（妖精直線飛過去，哪裡都能停）
export function moveHero(G, x, z) {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return false;
  const h = G.state.hero, hi = G.hi;
  const dead = h.state === 'dead';
  let res;
  if (h.flying) {
    const p = clampFly(G, x, z);
    res = { pts: [p], gx: p.x, gz: p.z };
  } else {
    res = buildPath(G, dead ? h.postX : h.x, dead ? h.postZ : h.z, x, z);
  }
  if (!res) return false;
  heroReleaseAll(G);
  h.postX = res.gx; h.postZ = res.gz;
  h.target = null;
  hi.rtarget = null;
  if (dead) { hi.path = null; return true; }
  if (hi.dash) return true; // 衝鋒中：衝完再走回新的守備點
  hi.path = res.pts; hi.pathI = 0; hi.cmd = true;
  h.state = 'move';
  return true;
}

// 蓋塔後：守備點或英雄所在格不能再走時，換到最近的可走格（妖精不受影響）
export function heroOnBuild(G, cellIdx) {
  const h = G.state.hero, M = G.map;
  if (h.flying) return;
  if (cellAt(M, h.postX, h.postZ) === cellIdx) {
    const i = nearestHeroCell(G, h.postX, h.postZ);
    if (i >= 0) { const c = i % M.W, r = (i - c) / M.W; h.postX = c + 0.5; h.postZ = r + 0.5; }
  }
  if (h.state !== 'dead' && !G.hi.dash && cellAt(M, h.x, h.z) === cellIdx) {
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
    hi.path = null; hi.cmd = false; hi.rtarget = null;
    if (hi.dash) { hi.dash = null; h.dashing = false; }
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
  refreshSkills(G);
}

function refreshSkills(G) {
  const h = G.state.hero;
  for (const id in h.skills) {
    const st = h.skills[id], sk = HERO_SKILLS[id];
    st.unlocked = h.level >= (sk.minLevel || 1);
    st.ready = st.unlocked && st.cd <= 0 && h.state !== 'dead' && !G.hi.dash;
  }
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
  // 英雄技能冷卻（死亡時也倒數）
  for (const id in h.skills) { const st = h.skills[id]; if (st.cd > 0) { st.cd -= dt; if (st.cd < 0) st.cd = 0; } }
  if (hi.castT > 0) { hi.castT -= dt; if (hi.castT <= 0) { hi.castT = 0; h.casting = null; } }
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
    refreshSkills(G);
    return;
  }
  hi.combatT += dt;
  if (hi.atkCd > 0) hi.atkCd -= dt;
  if (hi.combatT > BAL.HERO_REGEN_DELAY && h.hp < h.maxHp) {
    h.hp = Math.min(h.maxHp, h.hp + (def.regen || 0) * lvlMul(def, h.level) * dt);
  }
  if (hi.dash) { updateDash(G, h, hi, dt); refreshSkills(G); return; }
  refreshSkills(G);
  const step = (def.speed || 1.5) * dt;
  // 玩家指令移動中：不理敵人
  if (hi.path && hi.cmd) {
    h.state = 'move';
    followPath(G, h, hi, step);
    if (!hi.path) h.state = 'idle';
    h.target = null;
    return;
  }
  if ((def.attack || 'sword') === 'sword') updateMelee(G, h, hi, def, dt, step);
  else updateRanged(G, h, hi, def, dt, step);
}

// 攔截：清掉跑遠／死掉的，再從守備點附近抓新的（最多 blocks 隻）
function updateBlocks(G, h, hi, def) {
  const block = hi.block;
  const lx = h.postX, lz = h.postZ;
  const leash2 = BAL.HERO_LEASH * BAL.HERO_LEASH;
  for (let i = block.length - 1; i >= 0; i--) {
    const e = block[i];
    const dx = e.x - lx, dz = e.z - lz;
    if (e.dead || !e.blocked || dx * dx + dz * dz > leash2) {
      if (!e.dead) releaseOne(G, e, 1.5);
      block.splice(i, 1);
    }
  }
  const cap = h.flying ? 0 : (def.blocks != null ? def.blocks : 1);
  if (block.length < cap) {
    const q = G.qB;
    const n = G.grid.query(lx, lz, BAL.HERO_ENGAGE, q, 1 | Q_VISIBLE);
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
}

// 守燈騎士（近戰）：第一章的行為
function updateMelee(G, h, hi, def, dt, step) {
  const block = hi.block;
  const lx = h.postX, lz = h.postZ;
  const leash2 = BAL.HERO_LEASH * BAL.HERO_LEASH;
  updateBlocks(G, h, hi, def);
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
        const dealt = damageEnemy(G, primary, h.damage, def.dmgType || 'phys', 'hero');
        emit(G, { type: 'heroAttack', targetId: primary.id, attack: 'sword', x: primary.x, y: primary.y + 0.4, z: primary.z, fromX: h.x, fromZ: h.z });
        emit(G, { type: 'hit', x: primary.x, y: primary.y + 0.4, z: primary.z, kind: 'sword', dmgType: def.dmgType || 'phys', damage: dealt, targetId: primary.id });
      }
    }
    return;
  }
  walkHome(G, h, hi, step);
}

// 沒有目標：回守備點
function walkHome(G, h, hi, step) {
  h.target = null;
  hi.chaseT = 0;
  const lx = h.postX, lz = h.postZ;
  const dx = lx - h.x, dz = lz - h.z, d2 = dx * dx + dz * dz;
  if (d2 > 0.0025) {
    h.state = 'move';
    if (!hi.path) {
      const res = h.flying ? null : buildPath(G, h.x, h.z, lx, lz);
      hi.path = res ? res.pts : [{ x: lx, z: lz }];
      hi.pathI = 0; hi.cmd = false;
    }
    if (followPath(G, h, hi, step)) h.state = 'idle';
  } else {
    hi.path = null;
    h.state = 'idle';
  }
}

function rangedOk(h, def, e, range) {
  if (!e || e.dead || e.burrowed || e.hidden) return false;
  if (e.flying && !def.air) return false;
  const dx = e.x - h.x, dz = e.z - h.z;
  return dx * dx + dz * dz <= range * range;
}

// 妖精／法師（遠程）：站在守備點，打射程內最前面的敵人（法師優先打擋住他的那隻）
function updateRanged(G, h, hi, def, dt, step) {
  updateBlocks(G, h, hi, def);
  const block = hi.block;
  if (block.length) hi.combatT = 0;
  const range = def.range || 2;
  hi.aimT -= dt;
  let tg = hi.rtarget;
  if (!rangedOk(h, def, tg, range + 0.3)) tg = null;
  if (!tg || hi.aimT <= 0) {
    hi.aimT = BAL.HERO_RETARGET;
    tg = null;
    if (block.length && rangedOk(h, def, block[0], range)) tg = block[0];
    else {
      const q = G.qB;
      const n = G.grid.query(h.x, h.z, range, q, (def.air ? 0 : 1) | Q_VISIBLE);
      let bv = Infinity;
      for (let k = 0; k < n; k++) { const e = q[k]; if (e.remain < bv) { bv = e.remain; tg = e; } }
    }
    hi.rtarget = tg;
  }
  if (tg) {
    hi.path = null;
    h.target = tg.id;
    h.state = 'attack';
    const dx = tg.x - h.x, dz = tg.z - h.z;
    if (dx * dx + dz * dz > 1e-8) h.yaw = Math.atan2(dx, dz);
    if (hi.atkCd <= 0) {
      hi.atkCd += 1 / (def.rate || 1);
      if (hi.atkCd < 0) hi.atkCd = 0;
      const kind = def.attack === 'fireball' ? 'fireball' : 'fairyBolt';
      const cfg = BAL.HERO_PROJ[kind];
      const p = launchHeroProjectile(G, kind, h.x, cfg.y, h.z, tg, h.damage, def.dmgType || 'magic', def.splash || 0);
      p.splashMode = def.air ? 0 : 1; // 不能打空中的英雄（法師）：火球爆開只炸地面
      emit(G, { type: 'heroAttack', targetId: tg.id, attack: def.attack, x: tg.x, y: tg.flying ? tg.y : 0.4, z: tg.z, fromX: h.x, fromZ: h.z });
    }
    return;
  }
  walkHome(G, h, hi, step);
}

// ---------- 英雄技能 ----------
function fail(reason) { return { ok: false, reason }; }

function selectFront(arr, n, k) {
  for (let i = 0; i < k; i++) {
    let bi = i, bv = arr[i].remain;
    for (let j = i + 1; j < n; j++) if (arr[j].remain < bv) { bv = arr[j].remain; bi = j; }
    if (bi !== i) { const tmp = arr[i]; arr[i] = arr[bi]; arr[bi] = tmp; }
  }
}

function hitAll(G, x, z, radius, mode, dmg, dmgType, kind, fn) {
  const q = G.qC;
  const n = G.grid.query(x, z, radius, q, mode);
  let cnt = 0;
  for (let i = 0; i < n; i++) {
    const e = q[i];
    if (e.dead) continue;
    const dealt = dmg > 0 ? damageEnemy(G, e, dmg, dmgType, 'hero') : 0;
    if (dmg > 0) emit(G, { type: 'hit', x: e.x, y: e.y + 0.4, z: e.z, kind, dmgType, damage: dealt, targetId: e.id });
    if (fn && !e.dead) fn(e);
    cnt++;
  }
  return cnt;
}

// castHeroSkill(G, id, x, z) → { ok, reason }。reason：locked | dead | cooldown | range | no-target（結束後 'over' 由 game.js 處理）
export function castHeroSkill(G, id, x, z) {
  const h = G.state.hero, hi = G.hi, def = hi.def;
  const sk = HERO_SKILLS[id];
  const st = h.skills[id];
  if (!sk || !st || sk.hero !== h.type) return fail('locked');
  if (h.level < (sk.minLevel || 1)) return fail('locked');
  if (h.state === 'dead') return fail('dead');
  if (st.cd > 0 || hi.dash) return fail('cooldown');
  let tx = h.x, tz = h.z;
  if (sk.needsTarget) {
    if (!Number.isFinite(x) || !Number.isFinite(z)) return fail('no-target');
    const dx = x - h.x, dz = z - h.z;
    if (dx * dx + dz * dz > (sk.castRange || 4) ** 2 + 1e-6) return fail('range');
    tx = x; tz = z;
  }
  const mul = lvlMul(def, h.level) * G.mods.heroDamageMul;
  const dmgType = def.dmgType || 'phys';
  const air = def.air ? 0 : 1; // 不能打空中的英雄（騎士、法師）：技能也只打地面
  let radius = sk.radius || 0;
  let ex = tx, ez = tz;
  if (id === 'starburst') {
    const q = G.qC;
    const n = G.grid.query(h.x, h.z, sk.range || 3.5, q, 0 | Q_VISIBLE);
    if (n === 0) return fail('no-target');
    const k = Math.min(sk.bolts || 5, n);
    selectFront(q, n, k);
    const cfg = BAL.HERO_PROJ.starBolt;
    for (let b = 0; b < (sk.bolts || 5); b++) {
      const p = launchHeroProjectile(G, 'starBolt', h.x, cfg.y, h.z, q[b % k], sk.damage * mul, 'magic', 0);
      p.t = -0.07 * b; // 依序射出
    }
    radius = sk.range || 3.5;
    addTimedLight(G, 'spell', h.x, h.z, 2.0, BAL.SPELL_LIGHT_SEC);
  } else if (id === 'whirl') {
    hitAll(G, h.x, h.z, radius, air, sk.damage * mul, dmgType, 'whirl', null);
    addTimedLight(G, 'spell', h.x, h.z, radius + 0.5, BAL.SPELL_LIGHT_SEC);
  } else if (id === 'charge') {
    // 終點：點到的格英雄能站就用該點，否則最近的可站格中心
    const M = G.map;
    const ci = cellAt(M, tx, tz);
    if (!G.heroWalk[ci]) {
      const j = nearestHeroCell(G, tx, tz);
      if (j < 0) return fail('no-target');
      const c = j % M.W, r = (j - c) / M.W;
      ex = c + 0.5; ez = r + 0.5;
    }
    heroReleaseAll(G);
    hi.path = null; hi.cmd = false; hi.rtarget = null;
    hi.dash = { tx: ex, tz: ez, hit: [], dmg: sk.damage * mul, dmgType, stun: sk.stun || 0, kb: sk.knockback || 0, radius };
    h.state = 'move'; h.dashing = true; h.target = null;
    emit(G, { type: 'heroSkill', skill: id, hero: h.type, x: h.x, z: h.z, radius, tx: ex, tz: ez });
    st.cd = st.cdMax;
    h.casting = id; hi.castT = 0.6;
    updateDash(G, h, hi, 0);
    refreshSkills(G);
    return { ok: true, reason: null };
  } else if (id === 'pollen') {
    addZone(G, 'pollen', tx, tz, radius, sk.duration || 4, { slow: sk.slow || 0.5, reverse: sk.reverse || 0, src: 'hero', skill: id });
    addTimedLight(G, 'spell', tx, tz, radius + 0.5, BAL.SPELL_LIGHT_SEC);
  } else if (id === 'firestorm') {
    hitAll(G, tx, tz, radius, air, sk.damage * mul, dmgType, 'firestorm', null);
    if (sk.burn) addZone(G, 'fire', tx, tz, radius, sk.burn.sec, { dps: sk.burn.dps * mul, src: 'hero', skill: id });
    addTimedLight(G, 'spell', tx, tz, radius + 0.5, BAL.SPELL_LIGHT_SEC);
  } else if (id === 'icefall') {
    const fr = sk.freeze || 0;
    hitAll(G, tx, tz, radius, air, sk.damage * mul, dmgType, 'icefall', (e) => applyFreeze(G, e, fr));
    addTimedLight(G, 'spell', tx, tz, radius + 0.5, BAL.SPELL_LIGHT_SEC);
  } else {
    return fail('locked');
  }
  st.cd = st.cdMax;
  h.casting = id; hi.castT = 0.6;
  if (sk.needsTarget) { const dx = tx - h.x, dz = tz - h.z; if (dx * dx + dz * dz > 1e-6) h.yaw = Math.atan2(dx, dz); }
  emit(G, { type: 'heroSkill', skill: id, hero: h.type, x: ex, z: ez, radius, tx: ex, tz: ez });
  refreshSkills(G);
  return { ok: true, reason: null };
}

// 聖燈衝鋒：以 CHARGE_SPEED 直線衝到終點（可越過障礙），沿路 radius 內的地面敵人各吃一次傷害＋暈眩＋撞退
function updateDash(G, h, hi, dt) {
  const d = hi.dash;
  const dx = d.tx - h.x, dz = d.tz - h.z, dist = Math.sqrt(dx * dx + dz * dz);
  const step = BAL.CHARGE_SPEED * dt;
  if (dist > 1e-6) {
    h.yaw = Math.atan2(dx, dz);
    const s = dist < step ? dist : step;
    h.x += (dx / dist) * s; h.z += (dz / dist) * s;
  }
  h.state = 'move';
  const q = G.qC;
  const n = G.grid.query(h.x, h.z, d.radius, q, 1);
  for (let i = 0; i < n; i++) {
    const e = q[i];
    if (e.dead || d.hit.includes(e.id)) continue;
    d.hit.push(e.id);
    const dealt = damageEnemy(G, e, d.dmg, d.dmgType, 'hero');
    emit(G, { type: 'hit', x: e.x, y: e.y + 0.4, z: e.z, kind: 'charge', dmgType: d.dmgType, damage: dealt, targetId: e.id });
    if (!e.dead) { knockBack(G, e, d.kb); applyStun(G, e, d.stun); }
  }
  if (dist <= step + 1e-6) {
    h.x = d.tx; h.z = d.tz;
    hi.dash = null; h.dashing = false;
    h.state = 'idle';
    hi.path = null; hi.cmd = false;
  }
}
