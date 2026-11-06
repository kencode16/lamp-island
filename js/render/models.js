// 模型對外入口（擁有者：B 模型美術）。介面見 架構.md §6；詳細說明見 js/render/models/README.md。
// 全部模型都是程式生成的 low-poly（頂點色 + 共用材質），實作在 js/render/models/ 底下。
//
// 合約函式：makeTower、makeEnemy、makeHero、makeLamp、makeSpawnGate、makeProjectile、makeDecor
// 額外（選用）：setGlowStrength（夜晚發光倍率）、setModelLift（夜晚模型提亮）、countTris、ENEMY_TYPES、DECOR_KINDS、MAT、COLORS
export {
  makeTower, makeEnemy, makeHero, makeLamp, makeSpawnGate, makeProjectile, makeDecor,
  ENEMY_TYPES, DECOR_KINDS, DECOR_VARIANTS, countTris,
  setGlowStrength, getGlowStrength, setModelLift, getModelLift, MAT, COLORS,
} from './models/index.js';
