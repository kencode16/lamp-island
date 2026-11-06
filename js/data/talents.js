// 天賦資料（擁有者：模擬核心 A。欄位格式見 架構.md §4）
// 每條分支 4 層，必須先點上一層；全部 30 星。effect 由 sim 解讀（A 可調整 effect 內容，id 不可改）

export const TALENT_BRANCHES = [
  { id: 'ranged', name: '弓箭與投石', color: '#d9a441' },
  { id: 'arcane', name: '法師與樹靈', color: '#8b6fd6' },
  { id: 'hero',   name: '英雄與技能', color: '#d9604a' },
  { id: 'econ',   name: '經濟',       color: '#5fae5a' },
];

export const TALENTS = [
  { id: 'ranged1', branch: 'ranged', tier: 1, cost: 1, name: '鷹之眼',   desc: '弓箭塔射程 +10%。',               effect: { towers: ['archer'], rangeMul: 1.10 } },
  { id: 'ranged2', branch: 'ranged', tier: 2, cost: 2, name: '重型火藥', desc: '投石砲爆炸範圍 +15%。',           effect: { towers: ['catapult'], splashMul: 1.15 } },
  { id: 'ranged3', branch: 'ranged', tier: 3, cost: 2, name: '精良工藝', desc: '弓箭塔與投石砲傷害 +10%。',       effect: { towers: ['archer', 'catapult'], damageMul: 1.10 } },
  { id: 'ranged4', branch: 'ranged', tier: 4, cost: 3, name: '工匠公會', desc: '弓箭塔與投石砲第 4 級費用 -15%。', effect: { towers: ['archer', 'catapult'], branchCostMul: 0.85 } },

  { id: 'arcane1', branch: 'arcane', tier: 1, cost: 1, name: '奧術研習', desc: '法師塔傷害 +10%。',               effect: { towers: ['mage'], damageMul: 1.10 } },
  { id: 'arcane2', branch: 'arcane', tier: 2, cost: 2, name: '深根',     desc: '樹靈塔緩速效果多 10%。',           effect: { towers: ['treant'], slowAdd: 0.10 } },
  { id: 'arcane3', branch: 'arcane', tier: 3, cost: 2, name: '星辰視野', desc: '法師塔與樹靈塔射程 +10%。',       effect: { towers: ['mage', 'treant'], rangeMul: 1.10 } },
  { id: 'arcane4', branch: 'arcane', tier: 4, cost: 3, name: '破魔',     desc: '魔法傷害無視敵人 25% 魔抗。',       effect: { mresPierce: 0.25 } },

  { id: 'hero1', branch: 'hero', tier: 1, cost: 1, name: '堅毅',     desc: '英雄生命 +20%。',       effect: { heroHpMul: 1.20 } },
  { id: 'hero2', branch: 'hero', tier: 2, cost: 2, name: '燈火不滅', desc: '英雄復活時間 -5 秒。',   effect: { heroRespawnAdd: -5 } },
  { id: 'hero3', branch: 'hero', tier: 3, cost: 2, name: '星墜',     desc: '流星雨傷害 +25%。',     effect: { skills: ['meteor'], damageMul: 1.25 } },
  { id: 'hero4', branch: 'hero', tier: 4, cost: 2, name: '寒冬之心', desc: '主動技能冷卻 -15%。',   effect: { skillCdMul: 0.85 } },

  { id: 'econ1', branch: 'econ', tier: 1, cost: 1, name: '存糧',     desc: '開局金幣 +40。',             effect: { startGoldAdd: 40 } },
  { id: 'econ2', branch: 'econ', tier: 2, cost: 2, name: '舊料回收', desc: '賣塔退款從 70% 提高到 85%。', effect: { sellRatio: 0.85 } },
  { id: 'econ3', branch: 'econ', tier: 3, cost: 2, name: '戰利品',   desc: '擊殺金幣 +10%。',           effect: { killGoldMul: 1.10 } },
  { id: 'econ4', branch: 'econ', tier: 4, cost: 2, name: '搶先一步', desc: '提早叫下一波的獎勵 +50%。',   effect: { earlyBonusMul: 1.5 } },
];
