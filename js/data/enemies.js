// 敵人資料（擁有者：模擬核心 A。欄位格式見 架構.md §4，數值可調、id 與欄位名稱不可改）
// speed＝格/秒；atk＝被英雄擋住時每秒打英雄的傷害（物理，會被英雄護甲減免）；armor＝物理減傷比例；mres＝魔法減傷比例；lamp＝漏掉時扣的燈光；size＝模型縮放參考

export const ENEMY_ORDER = ['slime', 'splitter', 'goblin', 'skeleton', 'gargoyle', 'bat', 'golem', 'shaman', 'slimeKing', 'nightLord'];

export const ENEMIES = {
  slime:     { name: '史萊姆',     desc: '最常見的小怪，又軟又慢。', hp: 30, speed: 1.0, armor: 0, mres: 0, gold: 4, lamp: 1, atk: 5, flying: false, size: 0.6 },
  slimelet:  { name: '小史萊姆',   desc: '分裂出來的小史萊姆，跑得比較快。', hp: 18, speed: 1.3, armor: 0, mres: 0, gold: 1, lamp: 1, atk: 3, flying: false, size: 0.4, spawnOnly: true },
  splitter:  { name: '分裂史萊姆', desc: '被打倒時分裂成兩隻小史萊姆。', hp: 60, speed: 0.9, armor: 0, mres: 0, gold: 6, lamp: 1, atk: 8, flying: false, size: 0.75, special: { split: { into: 'slimelet', count: 2 } } },
  goblin:    { name: '哥布林盜賊', desc: '跑得很快，會從塔的縫隙溜過去。', hp: 40, speed: 1.8, armor: 0, mres: 0.1, gold: 6, lamp: 1, atk: 6, flying: false, size: 0.6 },
  skeleton:  { name: '骷髏兵',     desc: '穿著鏽盔甲，物理傷害只能打出一半。', hp: 90, speed: 0.9, armor: 0.5, mres: 0, gold: 9, lamp: 1, atk: 12, flying: false, size: 0.7 },
  gargoyle:  { name: '石像鬼',     desc: '會飛的石頭怪，無視道路直接飛向燈。', hp: 70, speed: 1.1, armor: 0.2, mres: 0.2, gold: 10, lamp: 2, atk: 10, flying: true, size: 0.75 },
  bat:       { name: '夜蝠',       desc: '成群出現的小蝙蝠，會飛。', hp: 18, speed: 1.6, armor: 0, mres: 0, gold: 2, lamp: 1, atk: 3, flying: true, size: 0.45 },
  golem:     { name: '石頭魔像',   desc: '又厚又慢，護甲很高。', hp: 400, speed: 0.55, armor: 0.6, mres: 0.2, gold: 25, lamp: 3, atk: 30, flying: false, size: 1.3 },
  shaman:    { name: '暗影巫師',   desc: '每隔幾秒替附近的怪物加上護盾。', hp: 110, speed: 0.8, armor: 0.1, mres: 0.5, gold: 14, lamp: 2, atk: 10, flying: false, size: 0.75, special: { shieldAura: { amount: 30, radius: 2, every: 5 } } },
  slimeKing: { name: '史萊姆王',   desc: '巨大的史萊姆，血量降到三分之二和三分之一時會分裂出手下。', hp: 2500, speed: 0.45, armor: 0.2, mres: 0.2, gold: 150, lamp: 5, atk: 60, flying: false, size: 2.0, boss: true, special: { splitAt: [0.66, 0.33], splitInto: 'splitter', splitCount: 4 } },
  nightLord: { name: '夜之君主',   desc: '最終的王，會召喚夜蝠，還會熄滅附近塔的光讓射程變短。', hp: 6000, speed: 0.4, armor: 0.4, mres: 0.4, gold: 300, lamp: 5, atk: 90, flying: false, size: 2.0, boss: true, special: { summon: { type: 'bat', count: 4, every: 12 }, dim: { radius: 4, rangeMul: 0.7, sec: 5, every: 20 } } },
};
