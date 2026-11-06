// 塔的資料（擁有者：模擬核心 A。欄位格式見 架構.md §4，數值可調、欄位名稱不可改）
// 距離單位＝格；rate＝每秒攻擊次數；damage＝每發傷害（treant 為每次脈衝傷害）

export const TOWER_ORDER = ['archer', 'catapult', 'mage', 'treant'];

export const TOWERS = {
  archer: {
    name: '弓箭塔', icon: '🏹', unlock: 1, air: true, dmgType: 'phys', projectile: 'arrow',
    desc: '射速快的單體攻擊，可以打空中敵人。',
    levels: [
      { cost: 70, damage: 6, rate: 1.5, range: 3.0 },
      { cost: 60, damage: 10, rate: 1.6, range: 3.2 },
      { cost: 90, damage: 15, rate: 1.8, range: 3.4 },
    ],
    branches: {
      a: { name: '連弩', desc: '一次射出 3 支箭，分給不同目標。', cost: 160, damage: 12, rate: 2.0, range: 3.4, projectile: 'bolt', special: { multishot: 3 } },
      b: { name: '鷹眼', desc: '超遠射程的重擊，對飛行敵人傷害 1.5 倍。', cost: 180, damage: 70, rate: 0.6, range: 5.0, projectile: 'arrow', special: { airBonus: 1.5 } },
    },
  },
  catapult: {
    name: '投石砲', icon: '🪨', unlock: 1, air: false, dmgType: 'phys', projectile: 'rock',
    desc: '慢速範圍爆炸，打不到空中敵人。',
    levels: [
      { cost: 100, damage: 14, rate: 0.45, range: 3.2, splash: 0.9 },
      { cost: 80, damage: 22, rate: 0.5, range: 3.3, splash: 1.0 },
      { cost: 120, damage: 34, rate: 0.55, range: 3.5, splash: 1.1 },
    ],
    branches: {
      a: { name: '巨石', desc: '更大的爆炸範圍，命中時暈眩 0.5 秒。', cost: 220, damage: 60, rate: 0.45, range: 3.8, splash: 1.6, projectile: 'boulder', special: { stun: 0.5 } },
      b: { name: '燃燒彈', desc: '命中處留下火焰，持續灼燒。', cost: 200, damage: 30, rate: 0.6, range: 3.6, splash: 1.2, projectile: 'firebomb', special: { fireZone: { dps: 10, sec: 3, radius: 1.0 }, burn: { dps: 12, sec: 3 } } },
    },
  },
  mage: {
    name: '法師塔', icon: '🔮', unlock: 3, air: true, dmgType: 'magic', projectile: 'orb',
    desc: '魔法傷害，無視護甲，剋骷髏和魔像。',
    levels: [
      { cost: 100, damage: 16, rate: 0.8, range: 2.8 },
      { cost: 90, damage: 26, rate: 0.85, range: 3.0 },
      { cost: 130, damage: 40, rate: 0.9, range: 3.2 },
    ],
    branches: {
      a: { name: '連鎖閃電', desc: '閃電在最多 4 個敵人之間跳躍。', cost: 220, damage: 45, rate: 0.8, range: 3.3, projectile: 'lightning', special: { chain: 4, chainFalloff: 0.8, chainRange: 1.8 } },
      b: { name: '冰霜', desc: '命中緩速 50%，有機會凍結敵人。', cost: 200, damage: 30, rate: 1.0, range: 3.3, projectile: 'frost', special: { slow: 0.5, slowSec: 2, freezeChance: 0.15, freezeSec: 1.2 } },
    },
  },
  treant: {
    name: '樹靈塔', icon: '🌳', unlock: 5, air: false, dmgType: 'magic', projectile: null,
    desc: '定期放出藤蔓脈衝，傷害並緩速範圍內所有地面敵人。',
    levels: [
      { cost: 90, damage: 4, rate: 0.5, range: 2.2, special: { slow: 0.35, slowSec: 1.5 } },
      { cost: 80, damage: 7, rate: 0.5, range: 2.3, special: { slow: 0.45, slowSec: 1.5 } },
      { cost: 110, damage: 11, rate: 0.5, range: 2.4, special: { slow: 0.55, slowSec: 1.5 } },
    ],
    branches: {
      a: { name: '荊棘林', desc: '更大範圍的荊棘，持續造成傷害。', cost: 200, damage: 18, rate: 1.0, range: 2.6, special: { slow: 0.55, slowSec: 1.2 } },
      b: { name: '古樹', desc: '每 4 秒定身最多 3 個敵人 1.5 秒。', cost: 220, damage: 30, rate: 0.25, range: 2.6, special: { root: 1.5, rootTargets: 3, slow: 0.4, slowSec: 1.5 } },
    },
  },
};
