// 英雄與主動技能資料（擁有者：模擬核心 A。欄位格式見 架構.md §4）

export const HEROES = {
  knight: {
    name: '守燈騎士', desc: '拿著提燈與長劍的騎士，會擋住地面敵人。',
    hp: 300, damage: 14, rate: 1.0, range: 0.9, speed: 1.6, armor: 0.3,
    respawn: 15, blocks: 2, regen: 5,
    // 關內升級：擊殺累積經驗（xp 取敵人 gold），levelXp[i] 為升到 i+2 級所需累計經驗；每級 +15% 生命與傷害
    levelXp: [30, 80, 160, 280], perLevel: 0.15,
  },
};

export const SKILL_ORDER = ['meteor', 'freeze'];

export const SKILLS = {
  meteor: { name: '流星雨', icon: '☄️', desc: '點選地面，1 秒後流星落下造成大範圍傷害。', cd: 60, unlock: 2, needsTarget: true, radius: 1.6, damage: 200, delay: 1.0 },
  freeze: { name: '冰封', icon: '❄️', desc: '全場敵人凍結 3 秒並受到少量傷害。', cd: 90, unlock: 4, needsTarget: false, duration: 3, damage: 20 },
};
