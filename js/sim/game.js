// 《守燈小島》模擬核心（擁有者：A）。純邏輯：不可 import three、不碰 DOM/window，能在 Node 跑。
// API 見 架構.md §5 與 js/sim/README.md。
import { TOWERS, TOWER_ORDER } from '../data/towers.js';
import { ENEMIES } from '../data/enemies.js';
import { SKILLS, SKILL_ORDER } from '../data/heroes.js';
import { BAL } from './balance.js';
import { makeRng } from './rng.js';
import { parseMap, Pathing, cellAt } from './map.js';
import { SpatialGrid } from './spatial.js';
import { buildMods } from './mods.js';
import { emit, spawnEnemy, updateEnemies, damageEnemy, applyFreeze } from './combat.js';
import { computeStats, effectiveRange, updateTowers, updateProjectiles, updateZones, addZone, levelData } from './towersim.js';
import { createHero, updateHero, moveHero as heroMove, heroOnBuild } from './hero.js';

export { BAL };

export function createGame(levelDef, opts = {}) {
  const map = parseMap(levelDef);
  const levelId = Number.isFinite(levelDef.id) ? levelDef.id : Infinity;
  const mods = buildMods(opts.talents || []);
  const G = {
    def: levelDef, levelId, map, mods,
    rng: makeRng(opts.seed != null ? opts.seed : 1),
    hpMul: opts.enemyHpMul > 0 ? opts.enemyHpMul : 1,
    path: null, grid: new SpatialGrid(map.W, map.H),
    events: [], nextId: 1,
    towerCell: new Array(map.N).fill(null), towerById: new Map(),
    heroWalk: new Uint8Array(map.heroBase),
    qA: [], qB: [], qC: [], chainHit: [],
    waveDefs: Array.isArray(levelDef.waves) ? levelDef.waves : [],
    spawners: [], waveInfo: [null], latest: null, gapLeft: null,
    hi: null,
  };
  G.path = new Pathing(map);
  const env0 = levelDef.env || {};
  const lamp0 = levelDef.lamp > 0 ? levelDef.lamp : 20;
  const S = {
    time: 0, phase: 'prep',
    W: map.W, H: map.H, grid: map.grid,
    gold: (levelDef.startGold != null ? levelDef.startGold : 200) + mods.startGoldAdd,
    lamp: lamp0, lampMax: lamp0,
    waveIndex: 0, waveCount: G.waveDefs.length, nextWaveIn: null, earlyBonus: 0,
    env: { time: env0.time || 'day', weather: env0.weather || 'clear' },
    towers: [], enemies: [], projectiles: [], zones: [],
    hero: null,
    skills: {},
    stats: { kills: 0, leaked: 0 },
    // 新增欄位
    levelId: Number.isFinite(levelDef.id) ? levelDef.id : null,
    spawns: map.spawns.map((s) => ({ index: s.index, c: s.c, r: s.r, x: s.x, z: s.z })),
    lampPos: { c: map.lampC, r: map.lampR, x: map.lampX, z: map.lampZ },
    waveSpawning: false,
  };
  G.state = S;
  S.hero = createHero(G, levelDef);
  for (const id of SKILL_ORDER) {
    const sk = SKILLS[id];
    if (!sk) continue;
    const sm = mods.skill[id] || { cdMul: 1 };
    S.skills[id] = { unlocked: (sk.unlock || 1) <= levelId, cd: 0, cdMax: sk.cd * mods.skillCdMul * sm.cdMul };
  }

  // ---------- 波次 ----------
  function startWave() {
    const di = S.waveIndex;
    const w = G.waveDefs[di];
    if (!w) return false;
    S.waveIndex++;
    S.phase = 'running';
    if (w.env) {
      S.env = { time: w.env.time || S.env.time, weather: w.env.weather || S.env.weather };
      emit(G, { type: 'env', time: S.env.time, weather: S.env.weather });
    }
    const groups = Array.isArray(w.groups) ? w.groups : [];
    let end = 0, pending = 0, boss = false;
    for (const g of groups) {
      const cnt = g.count > 0 ? g.count : 0;
      if (cnt <= 0 || !ENEMIES[g.enemy]) continue;
      const interval = g.interval > 0 ? g.interval : 1;
      const delay = g.delay > 0 ? g.delay : 0;
      G.spawners.push({ wave: di, enemy: g.enemy, left: cnt, interval, timer: delay, spawn: g.spawn | 0 });
      pending++;
      end = Math.max(end, delay + (cnt - 1) * interval);
      if (ENEMIES[g.enemy].boss) boss = true;
    }
    const info = { index: di, alive: 0, pending, cleared: false, gap: w.gap != null && w.gap >= 0 ? w.gap : BAL.DEFAULT_GAP, spawnEnd: S.time + end, reward: w.reward > 0 ? w.reward : 0, hpMul: w.hpMul > 0 ? w.hpMul : 1 };
    G.waveInfo[di] = info;
    G.latest = info;
    G.gapLeft = null;
    emit(G, { type: 'waveStart', index: di, number: S.waveIndex, boss });
    return true;
  }

  function updateWaves(dt) {
    const sp = G.spawners;
    let w = 0;
    for (let i = 0; i < sp.length; i++) {
      const s = sp[i];
      s.timer -= dt;
      while (s.left > 0 && s.timer <= 0) {
        const pt = map.spawns[s.spawn] || map.spawns[s.spawn % map.spawns.length] || map.spawns[0];
        spawnEnemy(G, s.enemy, pt.x, pt.z, s.wave, null);
        s.left--;
        s.timer += s.interval;
      }
      if (s.left > 0) sp[w++] = s;
      else { const info = G.waveInfo[s.wave]; if (info) info.pending--; }
    }
    sp.length = w;
    // 波次清除
    for (let i = 0; i < G.waveInfo.length; i++) {
      const info = G.waveInfo[i];
      if (!info || info.cleared) continue;
      if (info.pending <= 0 && info.alive <= 0) {
        info.cleared = true;
        if (info.reward > 0) { S.gold += info.reward; emit(G, { type: 'gold', amount: info.reward, x: map.lampX, z: map.lampZ }); }
        emit(G, { type: 'waveCleared', index: info.index, number: info.index + 1 });
      }
    }
    // 下一波倒數
    if (S.phase === 'running' && S.waveIndex < S.waveCount && G.latest && G.latest.pending <= 0) {
      if (G.gapLeft == null) G.gapLeft = G.latest.gap;
      G.gapLeft -= dt;
      if (G.gapLeft <= 0) startWave();
    }
  }

  function refreshWaveHud() {
    S.waveSpawning = G.spawners.length > 0;
    if (S.phase !== 'running' || S.waveIndex >= S.waveCount || !G.latest) { S.nextWaveIn = null; S.earlyBonus = 0; return; }
    const L = G.latest;
    S.nextWaveIn = L.pending > 0 ? Math.max(0, L.spawnEnd - S.time) + L.gap : Math.max(0, G.gapLeft != null ? G.gapLeft : L.gap);
    S.earlyBonus = Math.floor(S.nextWaveIn * (BAL.EARLY_BASE + BAL.EARLY_PER_WAVE * S.waveIndex) * mods.earlyBonusMul);
  }

  // ---------- 一步 ----------
  function tick(dt) {
    S.time += dt;
    if (S.phase === 'running') updateWaves(dt);
    updateEnemies(G, dt);
    G.grid.rebuild(S.enemies);
    updateTowers(G, dt);
    updateProjectiles(G, dt);
    updateZones(G, dt);
    updateHero(G, dt);
    for (const id in S.skills) { const s = S.skills[id]; if (s.cd > 0) { s.cd -= dt; if (s.cd < 0) s.cd = 0; } }
    // 移除死亡／漏掉的敵人（原地壓縮）
    const list = S.enemies;
    let w = 0;
    for (let i = 0; i < list.length; i++) if (!list[i].dead) list[w++] = list[i];
    list.length = w;
    // 勝負
    if (S.phase === 'running' && S.lamp > 0 && S.waveIndex >= S.waveCount && G.spawners.length === 0 && list.length === 0) {
      S.phase = 'won';
      emit(G, { type: 'won', stars: stars() });
    }
    refreshWaveHud();
  }

  function step(dt) {
    if (!(dt > 0)) return;
    if (S.phase === 'won' || S.phase === 'lost') return;
    let left = Math.min(dt, 1);
    while (left > 1e-9) {
      const h = left > 1 / 30 ? 1 / 30 : left;
      tick(h);
      left -= h;
      if (S.phase === 'won' || S.phase === 'lost') break;
    }
  }

  function stars() {
    if (S.lamp >= BAL.STAR3) return 3;
    if (S.lamp >= BAL.STAR2) return 2;
    return 1;
  }

  // ---------- 塔 ----------
  function inBounds(c, r) { return Number.isInteger(c) && Number.isInteger(r) && c >= 0 && r >= 0 && c < map.W && r < map.H; }
  function isOver() { return S.phase === 'won' || S.phase === 'lost'; }

  function canBuild(c, r, type) {
    const T = TOWERS[type];
    if (!T) return { ok: false, reason: 'locked' };
    if ((T.unlock || 1) > levelId) return { ok: false, reason: 'locked' };
    if (!inBounds(c, r) || isOver()) return { ok: false, reason: 'not-buildable' };
    const i = r * map.W + c;
    if (!map.buildable[i]) return { ok: false, reason: 'not-buildable' };
    if (G.towerCell[i]) return { ok: false, reason: 'occupied' };
    if (map.chars[i] === 'o') {
      const cells = [];
      for (const e of S.enemies) {
        if (e.dead || e.flying) continue;
        if (e.cell === i || cellAt(map, e.x, e.z) === i) return { ok: false, reason: 'occupied' };
        if (e.cell >= 0) cells.push(e.cell);
      }
      for (const s of map.spawns) cells.push(s.i);
      if (!G.path.reachableAll(i, cells)) return { ok: false, reason: 'blocks-path' };
    }
    if (S.gold < T.levels[0].cost * mods.tower[type].costMul) return { ok: false, reason: 'no-gold' };
    return { ok: true, reason: null };
  }

  function build(c, r, type) {
    if (!canBuild(c, r, type).ok) return null;
    const T = TOWERS[type];
    const cost = Math.round(T.levels[0].cost * mods.tower[type].costMul);
    S.gold -= cost;
    const i = r * map.W + c;
    const t = {
      id: G.nextId++, type, level: 1, branch: null, c, r, x: c + 0.5, z: r + 0.5,
      yaw: Math.atan2(map.lampX - (c + 0.5), map.lampZ - (r + 0.5)),
      range: 0, invested: cost, kills: 0, dimmed: false,
      // 內部
      st: null, cd: 0.2, aimT: G.rng() * 0.1, target: null, dimT: 0, dimMul: 0.7, cell: i,
    };
    t.st = computeStats(G, type, 1, null);
    t.range = effectiveRange(G, t);
    S.towers.push(t);
    G.towerCell[i] = t;
    G.towerById.set(t.id, t);
    if (map.chars[i] === 'o') {
      G.path.setBlocked(i, true);
      G.heroWalk[i] = 0;
      G.path.recompute();
      heroOnBuild(G, i);
    }
    // 事件的 type 欄位已是事件名稱，所以塔種放在 towerType（同時給 tower 別名）
    emit(G, { type: 'build', towerId: t.id, towerType: type, tower: type, c, r, x: t.x, z: t.z });
    return t.id;
  }

  function getTower(id) { return G.towerById.get(id) || null; }
  function towerAt(c, r) { return inBounds(c, r) ? G.towerCell[r * map.W + c] : null; }

  function branchCost(type, b) {
    const B = TOWERS[type].branches[b];
    return Math.round(B.cost * mods.tower[type].branchCostMul);
  }
  function statSummary(st) {
    return { damage: st.damage, rate: st.rate, range: st.baseRange, splash: st.splash || 0, special: st.special, dmgType: st.dmgType, air: st.air, name: st.name, desc: st.desc };
  }

  function upgradeInfo(id) {
    const t = getTower(id);
    if (!t) return null;
    const T = TOWERS[t.type];
    if (t.level < 3) {
      const cost = T.levels[t.level].cost;
      return { kind: 'level', cost, affordable: S.gold >= cost, next: statSummary(computeStats(G, t.type, t.level + 1, null)) };
    }
    if (t.level === 3) {
      const branches = {};
      for (const b of ['a', 'b']) {
        const B = T.branches[b];
        if (!B) continue;
        const cost = branchCost(t.type, b);
        const st = computeStats(G, t.type, 4, b);
        branches[b] = { name: B.name, desc: B.desc, cost, affordable: S.gold >= cost, damage: st.damage, rate: st.rate, range: st.baseRange, splash: st.splash || 0, special: st.special };
      }
      return { kind: 'branch', branches };
    }
    return { kind: 'max' };
  }

  function upgrade(id, branch) {
    if (isOver()) return false;
    const t = getTower(id);
    if (!t) return false;
    const T = TOWERS[t.type];
    let cost;
    if (t.level < 3) {
      cost = T.levels[t.level].cost;
      if (S.gold < cost) return false;
      t.level++;
    } else if (t.level === 3) {
      if (branch !== 'a' && branch !== 'b') return false;
      if (!T.branches[branch]) return false;
      cost = branchCost(t.type, branch);
      if (S.gold < cost) return false;
      t.level = 4; t.branch = branch;
    } else return false;
    S.gold -= cost;
    t.invested += cost;
    t.st = computeStats(G, t.type, t.level, t.branch);
    t.range = effectiveRange(G, t);
    if (t.cd > 1 / t.st.rate) t.cd = 1 / t.st.rate;
    if (t.type === 'treant' && t.branch === 'a' && !S.zones.some((z) => z.kind === 'thorns' && z.towerId === t.id)) {
      addZone(G, 'thorns', t.x, t.z, t.range, 9999, { towerId: t.id });
    }
    emit(G, { type: 'upgrade', towerId: t.id, level: t.level, branch: t.branch, x: t.x, z: t.z });
    return true;
  }

  function sellValue(id) {
    const t = getTower(id);
    return t ? Math.floor(t.invested * mods.sellRatio) : 0;
  }

  function sell(id) {
    if (isOver()) return 0;
    const t = getTower(id);
    if (!t) return 0;
    const value = sellValue(id);
    S.gold += value;
    const k = S.towers.indexOf(t);
    if (k >= 0) S.towers.splice(k, 1);
    G.towerCell[t.cell] = null;
    G.towerById.delete(t.id);
    if (map.chars[t.cell] === 'o') {
      G.path.setBlocked(t.cell, false);
      G.heroWalk[t.cell] = map.heroBase[t.cell];
      G.path.recompute();
    }
    for (let z = S.zones.length - 1; z >= 0; z--) if (S.zones[z].kind === 'thorns' && S.zones[z].towerId === t.id) S.zones.splice(z, 1);
    emit(G, { type: 'sell', towerId: t.id, gold: value, x: t.x, z: t.z });
    if (value > 0) emit(G, { type: 'gold', amount: value, x: t.x, z: t.z });
    return value;
  }

  function towerStats(id) {
    const t = getTower(id);
    if (!t) return null;
    const st = t.st;
    return {
      name: st.name, damage: st.damage, rate: st.rate, range: t.range, dmgType: st.dmgType, air: st.air, desc: st.desc,
      splash: st.splash || 0, special: st.special, level: t.level, branch: t.branch, kills: t.kills, baseRange: st.baseRange, dimmed: t.dimmed,
      dps: t.type === 'treant' ? st.damage * st.rate : st.damage * st.rate * ((st.special && st.special.multishot) || 1),
    };
  }

  // 蓋塔前預覽某種塔（含天賦與目前夜晚效果）
  function typeStats(type, level = 1, branch = null) {
    if (!TOWERS[type]) return null;
    const st = computeStats(G, type, level, branch);
    let range = st.baseRange;
    if (S.env.time === 'night' && type !== 'mage') range *= BAL.NIGHT_RANGE_MUL;
    return { name: st.name, damage: st.damage, rate: st.rate, range, dmgType: st.dmgType, air: st.air, desc: st.desc, splash: st.splash || 0, special: st.special, cost: level === 1 ? Math.round(TOWERS[type].levels[0].cost * mods.tower[type].costMul) : null };
  }

  function buildOptions(c, r) {
    return TOWER_ORDER.map((type) => {
      const T = TOWERS[type];
      const chk = canBuild(c, r, type);
      return { type, name: T.name, icon: T.icon, cost: Math.round(T.levels[0].cost * mods.tower[type].costMul), ok: chk.ok, reason: chk.reason };
    });
  }

  // ---------- 波次指令 ----------
  function callNextWave() {
    if (isOver()) return false;
    if (S.phase === 'prep') {
      if (S.waveCount === 0) { S.phase = 'running'; return 0; }
      startWave();
      refreshWaveHud();
      return 0;
    }
    if (S.waveIndex >= S.waveCount) return false;
    refreshWaveHud();
    const bonus = S.earlyBonus;
    if (bonus > 0) {
      S.gold += bonus;
      emit(G, { type: 'gold', amount: bonus, x: map.lampX, z: map.lampZ, early: true });
    }
    startWave();
    refreshWaveHud();
    return bonus;
  }

  // ---------- 技能 ----------
  function castSkill(id, x, z) {
    if (isOver()) return false;
    const s = S.skills[id], def = SKILLS[id];
    if (!s || !def || !s.unlocked || s.cd > 0) return false;
    const sm = mods.skill[id] || { damageMul: 1, radiusMul: 1, durationMul: 1 };
    if (id === 'meteor') {
      if (!Number.isFinite(x) || !Number.isFinite(z)) return false;
      x = Math.min(map.W, Math.max(0, x)); z = Math.min(map.H, Math.max(0, z));
      s.cd = s.cdMax;
      addZone(G, 'meteorMark', x, z, def.radius * sm.radiusMul, def.delay || 1, { damage: def.damage * sm.damageMul, skill: 'meteor' });
      emit(G, { type: 'skill', id, x, z, radius: def.radius * sm.radiusMul, delay: def.delay || 1 });
      return true;
    }
    if (id === 'freeze') {
      s.cd = s.cdMax;
      emit(G, { type: 'skill', id, x: map.lampX, z: map.lampZ });
      const dur = (def.duration || 3) * sm.durationMul, dmg = (def.damage || 0) * sm.damageMul;
      const list = S.enemies;
      const n = list.length;
      for (let i = 0; i < n; i++) {
        const e = list[i];
        if (e.dead) continue;
        applyFreeze(G, e, dur);
        if (dmg > 0) damageEnemy(G, e, dmg, 'magic', null);
      }
      return true;
    }
    return false;
  }

  function result() {
    const won = S.phase === 'won';
    return { won, stars: won ? stars() : 0, lamp: S.lamp };
  }

  function drainEvents() {
    const ev = G.events;
    G.events = [];
    return ev;
  }

  function getPaths() { return G.path.paths(); }

  function pickEnemy(x, z, radius = 0.6) {
    let best = null, bd = radius * radius;
    for (const e of S.enemies) {
      if (e.dead) continue;
      const dx = e.x - x, dz = e.z - z, d2 = dx * dx + dz * dz;
      if (d2 <= bd) { bd = d2; best = e; }
    }
    return best;
  }

  return {
    state: S,
    levelDef,
    step, canBuild, build, towerAt, getTower, upgradeInfo, upgrade, sell, sellValue, towerStats,
    callNextWave, moveHero: (x, z) => (isOver() ? false : heroMove(G, x, z)), castSkill, getPaths, drainEvents, result,
    // 新增
    typeStats, buildOptions, pickEnemy,
    heroCanStand: (c, r) => inBounds(c, r) && G.heroWalk[r * map.W + c] === 1,
    _G: G, // 測試／除錯用，畫面請勿依賴
  };
}

// 檢查關卡資料（給 F 的 test_levels.mjs 用）：回傳問題字串陣列，空陣列＝沒問題
export function validateLevel(levelDef) {
  const problems = [];
  let map;
  try { map = parseMap(levelDef); } catch (err) { return [String(err.message || err)]; }
  const P = new Pathing(map);
  for (const s of map.spawns) if (!P.reachable(s.i)) problems.push(`出生點 ${s.index}（${s.c},${s.r}）走不到燈`);
  const hs = levelDef.heroStart;
  if (hs) {
    const ok = hs.c >= 0 && hs.r >= 0 && hs.c < map.W && hs.r < map.H && map.heroBase[hs.r * map.W + hs.c];
    if (!ok) problems.push(`heroStart (${hs.c},${hs.r}) 不是英雄可走的陸地`);
  }
  (levelDef.waves || []).forEach((w, wi) => {
    if (w.hpMul != null && !(typeof w.hpMul === 'number' && w.hpMul > 0 && Number.isFinite(w.hpMul))) problems.push(`第 ${wi + 1} 波：hpMul 要是正數（目前 ${JSON.stringify(w.hpMul)}）`);
    for (const g of (w.groups || [])) {
      if (!ENEMIES[g.enemy]) problems.push(`第 ${wi + 1} 波：未知敵人 ${g.enemy}`);
      if ((g.spawn | 0) >= map.spawns.length) problems.push(`第 ${wi + 1} 波：spawn ${g.spawn} 超過出生點數量 ${map.spawns.length}`);
      if (!(g.count > 0)) problems.push(`第 ${wi + 1} 波：count 要 > 0`);
    }
  });
  return problems;
}
