// 模擬核心的平衡常數（擁有者：A）。數值可調，README 有說明。

export const BAL = {
  FLY_Y: 1.3,               // 飛行敵人的 sim 高度
  DEFAULT_GAP: 15,          // 每波出完後自動叫下一波的秒數（waves[i].gap 省略時）
  SELL_RATIO: 0.7,          // 賣塔退款比例（天賦 sellRatio 可改）
  NIGHT_RANGE_MUL: 0.9,     // 夜晚非法師塔的射程倍率
  RAIN_SPEED_MUL: 0.9,      // 雨天敵人移速倍率
  RAIN_BURN_MUL: 0.5,       // 雨天燃燒／火焰地帶傷害倍率
  BOSS_CC_MUL: 0.5,         // 王受到凍結／暈眩／定身的時間倍率
  LANE_OFFSET: 0.22,        // 地面敵人側向偏移上限（格）
  TURN_RATE: 10,            // 敵人轉向平滑（每秒）
  TOWER_TURN: 12,           // 塔頭轉向速度（弧度／秒）

  // 提早叫波：earlyBonus = floor(nextWaveIn × (EARLY_BASE + EARLY_PER_WAVE × waveIndex) × 天賦 earlyBonusMul)
  EARLY_BASE: 0.6,
  EARLY_PER_WAVE: 0.08,

  // 英雄
  HERO_ENGAGE: 1.6,         // 守備點周圍多遠的地面敵人會被攔
  HERO_LEASH: 2.6,          // 離守備點超過這個距離就放掉目標回去
  HERO_REGEN_DELAY: 3,      // 脫戰幾秒後開始回血
  HERO_CHASE_GIVEUP: 2.5,   // 追不到目標幾秒後放棄
  ENEMY_CONTACT: 0.7,       // 被擋的敵人走到離英雄這麼近就停
  ENEMY_REACH: 1.0,         // 敵人能打到英雄的距離
  HERO_XP_RADIUS: 2.5,      // 英雄附近被塔打死的敵人也分到經驗
  HERO_XP_SHARE: 0.4,

  // 星等
  STAR3: 18,
  STAR2: 10,

  // 投射物：speed＝格/秒（直線類），或 T＝tBase + tPer×距離（拋物線類）；arc＝最高點高度（arcBase + arcPer×距離）
  PROJ: {
    arrow:    { speed: 14, arcBase: 0,   arcPer: 0.10 },
    bolt:     { speed: 16, arcBase: 0,   arcPer: 0.05 },
    rock:     { tBase: 0.55, tPer: 0.10, arcBase: 0.8, arcPer: 0.25 },
    boulder:  { tBase: 0.65, tPer: 0.10, arcBase: 1.0, arcPer: 0.25 },
    firebomb: { tBase: 0.60, tPer: 0.10, arcBase: 0.9, arcPer: 0.25 },
    orb:      { speed: 7,  arcBase: 0,   arcPer: 0 },
    frost:    { speed: 8,  arcBase: 0,   arcPer: 0 },
  },
  // 塔的發射點高度（依等級 1–4）
  MUZZLE_Y: [0, 0.9, 1.1, 1.3, 1.55],

  // ===== 第二章（v2.0） =====
  // 光照（只在 state.dark 的關卡生效）
  LAMP_LIGHT: 4.5,          // 守護燈照亮半徑
  MAGE_LIGHT: 1.2,          // 法師塔水晶球
  MUSHROOM_LIGHT: 1.5,      // 發光蘑菇 U
  CRYSTAL_LIGHT: 2.0,       // 水晶 C（被照到才亮）
  CRYSTAL_REACH: 0.35,      // 水晶格中心離光源邊緣多近就算被照到（水晶佔一格）
  FIRE_LIGHT_ADD: 0.5,      // 火焰地帶光半徑＝地帶半徑＋這個
  METEOR_LIGHT_SEC: 3,      // 流星雨落下後照亮全場幾秒
  LASER_LIGHT: 1.0,         // 稜鏡雷射照到的目標周圍
  SPELL_LIGHT_SEC: 1.2,     // 英雄技能閃光持續秒數
  FIREBALL_LIGHT: 1.0,      // 法師英雄火球爆開的短暫光
  FIREBALL_LIGHT_SEC: 0.4,
  LIGHT_EDGE: 0.75,         // lightAt 在光源半徑外漸暗到 0 的距離（給畫面用；lit 只看半徑內）

  // 稜鏡塔
  PRISM_HIT_EVERY: 0.25,    // 持續雷射每隔幾秒發一次 hit 事件（累積傷害）
  PRISM_PIERCE_WIDTH: 0.4,  // 聚焦貫穿：離雷射線多近算被打到
  PRISM_PIERCE_MUL: 0.6,    // 貫穿到的其他敵人吃幾成傷害

  // 敵人
  BURROW_CHECK: 0.2,        // 地鼠每隔幾秒檢查附近有沒有塔
  EAT_RETRY: 0.5,           // 巨蟲吞燈時間到但附近沒燈籠：每隔幾秒再找
  FAIRY_AIR_REACH: 1.0,     // 飛行敵人離妖精多近會順手攻擊她

  // 英雄
  HERO_RETARGET: 0.2,       // 遠程英雄重選目標間隔
  CHARGE_SPEED: 10,         // 聖燈衝鋒速度（格/秒）
  KNOCKBACK_BOSS_MUL: 0.5,  // 王被撞退距離倍率
  // 英雄投射物（追蹤，格/秒）；y＝發射高度
  HERO_PROJ: {
    fairyBolt: { speed: 11, y: 1.0 },
    fireball:  { speed: 8,  y: 1.0 },
    starBolt:  { speed: 9,  y: 1.0 },
  },
};
