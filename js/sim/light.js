// 光照系統（第二章，純邏輯）：state.lights、lightAt、敵人 lit／hidden、塔 lit／active。
// 只有 state.dark 的關卡會計算；不暗的關卡 state.lights 是空陣列、所有敵人與塔都算在光裡（第一章行為不變）。
// 光源 { id, kind, x, z, r, on }：kind 見 架構_第二章.md §2。id 用自己的計數器（不影響敵人／塔的 id）。
import { BAL } from './balance.js';
import { emit } from './combat.js';

function mkLight(G, kind, x, z, r, on = true) {
  return { id: G.lightId++, kind, x, z, r, on };
}

export function initLights(G) {
  const M = G.map, S = G.state;
  G.lightId = 1;
  G.L = {
    lamp: mkLight(G, 'lamp', M.lampX, M.lampZ, BAL.LAMP_LIGHT),
    mush: M.mushrooms.map((m) => mkLight(G, 'mushroom', m.x, m.z, BAL.MUSHROOM_LIGHT)),
    crys: M.crystals.map((m) => mkLight(G, 'crystal', m.x, m.z, BAL.CRYSTAL_LIGHT, false)),
    hero: mkLight(G, 'hero', S.hero.x, S.hero.z, S.hero.light, true),
    timed: [], // { light, ttl }：流星雨、英雄技能閃光、火球爆光
  };
}

// 短暫光源（meteor／spell）。不暗的關卡不需要。
export function addTimedLight(G, kind, x, z, r, ttl) {
  if (!G.state.dark || !(ttl > 0)) return;
  G.L.timed.push({ light: mkLight(G, kind, x, z, r, true), ttl });
}

// (x, z) 是否在 list[0..n) 任一個 on 光源半徑（＋extra）內
function covered(list, n, x, z, extra) {
  for (let i = 0; i < n; i++) {
    const l = list[i];
    if (!l.on) continue;
    const dx = l.x - x, dz = l.z - z, rr = l.r + extra;
    if (dx * dx + dz * dz <= rr * rr) return true;
  }
  return false;
}

// 每 step 呼叫一次（敵人移動後、塔攻擊前）。dt 只用來倒數短暫光源。
export function updateLights(G, dt) {
  const S = G.state;
  if (!S.dark) return;
  const L = G.L, out = S.lights;
  out.length = 0;
  out.push(L.lamp);
  for (let i = 0; i < L.mush.length; i++) out.push(L.mush[i]);
  // 英雄
  const h = S.hero, hl = L.hero;
  hl.x = h.x; hl.z = h.z; hl.r = h.light; hl.on = h.state !== 'dead';
  out.push(hl);
  // 塔：燈籠、法師塔水晶球（稜鏡雷射照到的目標放在最後，見下面）
  const towers = S.towers;
  for (let i = 0; i < towers.length; i++) {
    const t = towers[i];
    if (t.kind === 'light') {
      const l = t._light || (t._light = mkLight(G, 'lantern', t.x, t.z, t.light));
      l.r = t.light; l.on = !(t.out > 0);
      out.push(l);
    } else if (t.type === 'mage') {
      out.push(t._light || (t._light = mkLight(G, 'mage', t.x, t.z, BAL.MAGE_LIGHT)));
    }
  }
  // 火焰地帶（燃燒彈、火焰風暴）
  const zones = S.zones;
  for (let i = 0; i < zones.length; i++) {
    const zn = zones[i];
    if (zn.kind !== 'fire') continue;
    out.push(zn._light || (zn._light = mkLight(G, 'fire', zn.x, zn.z, zn.radius + BAL.FIRE_LIGHT_ADD)));
  }
  // 短暫光源
  let w = 0;
  for (let i = 0; i < L.timed.length; i++) {
    const tl = L.timed[i];
    tl.ttl -= dt;
    if (tl.ttl > 0) { L.timed[w++] = tl; out.push(tl.light); }
  }
  L.timed.length = w;
  // 水晶中繼：每 step 從頭算（不會互相點亮後自己維持），可以一顆接一顆傳下去
  const nBase = out.length, crys = L.crys;
  for (let i = 0; i < crys.length; i++) crys[i].on = false;
  for (let pass = 0; pass < crys.length; pass++) {
    let changed = false;
    for (let i = 0; i < crys.length; i++) {
      const c = crys[i];
      if (c.on) continue;
      if (covered(out, nBase, c.x, c.z, BAL.CRYSTAL_REACH) || covered(crys, crys.length, c.x, c.z, BAL.CRYSTAL_REACH)) { c.on = true; changed = true; }
    }
    if (!changed) break;
  }
  for (let i = 0; i < crys.length; i++) out.push(crys[i]);
  // 稜鏡雷射照到的目標：只照亮敵人（不算塔的 lit、不點亮水晶），避免稜鏡塔靠自己的雷射維持運作
  const nTower = out.length;
  for (let i = 0; i < towers.length; i++) {
    const ls = towers[i].lasers;
    if (!ls || !ls.length) continue;
    for (let k = 0; k < ls.length; k++) {
      const b = ls[k];
      const l = b._light || (b._light = mkLight(G, 'laser', b.x, b.z, BAL.LASER_LIGHT));
      l.x = b.x; l.z = b.z;
      out.push(l);
    }
  }
  const n = out.length;
  // 敵人：lit、hidden（幽靈在暗處、潛地中）
  const list = S.enemies;
  for (let i = 0; i < list.length; i++) {
    const e = list[i];
    if (e.dead) continue;
    const lit = covered(out, n, e.x, e.z, 0);
    e.lit = lit;
    const hid = e.burrowed || (e.shadow && !lit);
    if (e.shadow && e.hidden && !hid) emit(G, { type: 'reveal', id: e.id, x: e.x, z: e.z });
    e.hidden = hid;
  }
  // 塔：所在格是否在光裡；稜鏡塔要光才運作
  for (let i = 0; i < towers.length; i++) {
    const t = towers[i];
    t.lit = covered(out, nTower, t.x, t.z, 0);
    t.active = t.st.needsLight ? t.lit : true;
  }
}

// 0–1：1＝在任一 on 光源半徑內；半徑外 LIGHT_EDGE 格內漸暗到 0（給畫面）。不暗的關卡永遠 1。
export function lightAt(G, x, z) {
  const S = G.state;
  if (!S.dark) return 1;
  let best = 0;
  const out = S.lights;
  for (let i = 0; i < out.length; i++) {
    const l = out[i];
    if (!l.on) continue;
    const dx = l.x - x, dz = l.z - z, d = Math.sqrt(dx * dx + dz * dz);
    if (d <= l.r) return 1;
    const v = 1 - (d - l.r) / BAL.LIGHT_EDGE;
    if (v > best) best = v;
  }
  return best;
}
