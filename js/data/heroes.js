// 英雄與主動技能資料（擁有者：模擬核心 A。欄位格式見 架構.md §4、架構_第二章.md §4）
// v2.0：三位英雄可選（騎士／妖精／法師）、每位兩個手動施放的英雄技能。id 與欄位名稱不可改。
// 2026-11-14 A 調過數值：第一章用 autoplay（balanced、6 個 seed、第 7–10 關）比 v1 騎士，三位都約 +15–20%（v1 騎士沒有技能）。
// 取捨：騎士擋 3 隻、血多；妖精會飛、打空中、照亮最大，但不擋人、傷害低；法師範圍火球，但打不到空中（技能也只打地面）。

export const HERO_ORDER = ['knight', 'fairy', 'mage'];

export const HEROES = {
  knight: {
    name: '守燈騎士', role: '坦克・近戰', icon: '🛡️',
    desc: '拿著提燈與長劍的騎士。血最多、攻擊力高，一次能擋住 3 隻地面怪物。',
    unlockAfter: 0,          // 通過第幾關後可選（0＝一開始就能選）
    hp: 320, damage: 13, rate: 1.0, range: 0.9, speed: 1.6, armor: 0.3,
    respawn: 15, blocks: 3, regen: 5,
    flying: false, air: false, dmgType: 'phys', attack: 'sword',   // attack：普通攻擊的樣式（給特效與音效）
    light: 1.8,              // 第二章：身上的照亮半徑（格）
    skills: ['whirl', 'charge'],
    // 關內升級：擊殺累積經驗（xp 取敵人 gold），levelXp[i] 為升到 i+2 級所需累計經驗；每級 +15% 生命與傷害
    levelXp: [30, 80, 160, 280], perLevel: 0.15,
  },
  fairy: {
    name: '森林妖精', role: '遠程・靈活', icon: '🧚',
    desc: '飛在空中的妖精，地面怪物擋不住她；射程遠，連飛行敵人也能打。全身發光，照亮範圍最大。',
    unlockAfter: 2,
    hp: 160, damage: 7, rate: 1.2, range: 2.4, speed: 2.0, armor: 0.1,
    respawn: 12, blocks: 0, regen: 4,
    flying: true, air: true, dmgType: 'magic', attack: 'bolt',
    light: 2.6,
    skills: ['starburst', 'pollen'],
    levelXp: [30, 80, 160, 280], perLevel: 0.15,
  },
  mage: {
    name: '星詠法師', role: '範圍法術', icon: '🔮',
    desc: '專精法術的法師，普通攻擊就是會爆開的火球，擅長一次對付一大群地面怪物（打不到空中的敵人）。',
    unlockAfter: 4,
    hp: 200, damage: 9, rate: 0.55, range: 2.1, splash: 0.6, speed: 1.4, armor: 0.15,
    respawn: 14, blocks: 1, regen: 4,
    flying: false, air: false, dmgType: 'magic', attack: 'fireball',
    light: 2.0,
    skills: ['firestorm', 'icefall'],
    levelXp: [30, 80, 160, 280], perLevel: 0.15,
  },
};

// 英雄技能（手動按鈕施放）。minLevel＝英雄關內等級達到幾級才能用；needsTarget＝要點地面；castRange＝離英雄多遠內可以施放
export const HERO_SKILLS = {
  whirl:     { hero: 'knight', name: '旋風斬',   icon: '🌀', minLevel: 1, cd: 16, needsTarget: false, radius: 1.6, damage: 30,
               desc: '轉身一圈劍光，砍中周圍所有怪物。' },
  charge:    { hero: 'knight', name: '聖燈衝鋒', icon: '⚔️', minLevel: 3, cd: 26, needsTarget: true, castRange: 4, radius: 1.0, damage: 40, stun: 1.0, knockback: 1.0,
               desc: '衝向指定地點，撞退沿路的怪物並讓牠們暈眩。' },
  starburst: { hero: 'fairy',  name: '星塵連射', icon: '✨', minLevel: 1, cd: 15, needsTarget: false, bolts: 5, damage: 16, range: 3.5,
               desc: '一口氣射出 5 顆追蹤光彈，打附近不同的怪物。' },
  pollen:    { hero: 'fairy',  name: '花粉迷霧', icon: '🌸', minLevel: 3, cd: 28, needsTarget: true, castRange: 4.5, radius: 1.6, slow: 0.4, reverse: 1.2, duration: 4,
               desc: '在指定地點灑下迷霧，範圍裡的怪物緩速，還會暫時倒著走。' },
  firestorm: { hero: 'mage',   name: '火焰風暴', icon: '🔥', minLevel: 1, cd: 22, needsTarget: true, castRange: 4.5, radius: 1.5, damage: 35, burn: { dps: 5, sec: 3 },
               desc: '在指定地點落下一大圈火焰，之後持續燃燒。' },
  icefall:   { hero: 'mage',   name: '冰隕',     icon: '🧊', minLevel: 3, cd: 30, needsTarget: true, castRange: 4.5, radius: 1.3, damage: 25, freeze: 1.3,
               desc: '召喚冰柱從天而降，凍住一整塊區域。' },
};

export const SKILL_ORDER = ['meteor', 'freeze'];

export const SKILLS = {
  meteor: { name: '流星雨', icon: '☄️', desc: '點選地面，1 秒後流星落下造成大範圍傷害。', cd: 60, unlock: 2, needsTarget: true, radius: 1.6, damage: 200, delay: 1.0 },
  freeze: { name: '冰封', icon: '❄️', desc: '全場敵人凍結 3 秒並受到少量傷害。', cd: 90, unlock: 4, needsTarget: false, duration: 3, damage: 20 },
};
