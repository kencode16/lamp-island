// 把天賦 id 清單轉成修正值（mods）。effect 格式見 js/data/talents.js。
// 規則：有 towers 陣列 → 套到那些塔；有 skills 陣列 → 套到那些技能；其他 → 全域。
//      欄位名稱以 Mul 結尾＝相乘、Add 結尾或 mresPierce＝相加、sellRatio＝取較大值，其他未知欄位直接覆寫。
import { TALENTS } from '../data/talents.js';
import { TOWERS } from '../data/towers.js';
import { SKILLS } from '../data/heroes.js';
import { BAL } from './balance.js';

function towerMods() {
  return { rangeMul: 1, damageMul: 1, rateMul: 1, splashMul: 1, branchCostMul: 1, costMul: 1, slowAdd: 0 };
}
function skillMods() {
  return { damageMul: 1, cdMul: 1, radiusMul: 1, durationMul: 1 };
}

function applyKey(target, key, val) {
  if (typeof val !== 'number') return;
  if (key === 'sellRatio') target[key] = Math.max(target[key] ?? 0, val);
  else if (key.endsWith('Mul')) target[key] = (target[key] ?? 1) * val;
  else if (key.endsWith('Add') || key === 'mresPierce') target[key] = (target[key] ?? 0) + val;
  else target[key] = val;
}

export function buildMods(talentIds = []) {
  const mods = {
    tower: {}, skill: {},
    mresPierce: 0, heroHpMul: 1, heroDamageMul: 1, heroRespawnAdd: 0,
    skillCdMul: 1, startGoldAdd: 0, sellRatio: BAL.SELL_RATIO, killGoldMul: 1, earlyBonusMul: 1,
    applied: [],
  };
  for (const t of Object.keys(TOWERS)) mods.tower[t] = towerMods();
  for (const s of Object.keys(SKILLS)) mods.skill[s] = skillMods();
  const seen = new Set();
  for (const id of talentIds || []) {
    if (seen.has(id)) continue;
    seen.add(id);
    const tal = TALENTS.find((t) => t.id === id);
    if (!tal || !tal.effect) continue;
    mods.applied.push(id);
    const eff = tal.effect;
    if (Array.isArray(eff.towers)) {
      for (const tt of eff.towers) {
        const tm = mods.tower[tt]; if (!tm) continue;
        for (const k of Object.keys(eff)) if (k !== 'towers') applyKey(tm, k, eff[k]);
      }
    } else if (Array.isArray(eff.skills)) {
      for (const sk of eff.skills) {
        const sm = mods.skill[sk]; if (!sm) continue;
        for (const k of Object.keys(eff)) if (k !== 'skills') applyKey(sm, k, eff[k]);
      }
    } else {
      for (const k of Object.keys(eff)) applyKey(mods, k, eff[k]);
    }
  }
  return mods;
}
