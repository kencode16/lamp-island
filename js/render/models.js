// 模型對外入口（擁有者：B 模型美術）。介面見 架構.md §6、架構_第二章.md §3；詳細說明見 js/render/models/README.md。
// 全部模型都是程式生成的 low-poly（頂點色 + 共用材質），實作在 js/render/models/ 底下。
//
// 合約函式：makeTower、makeEnemy、makeHero、makeLamp、makeSpawnGate、makeProjectile、makeDecor
// 額外（選用）：setGlowStrength（夜晚發光倍率）、setModelLift（夜晚模型提亮）、countTris、ENEMY_TYPES、HERO_TYPES、DECOR_KINDS、MAT、COLORS
// 第二章（黑暗效果用）：自發光材質有 material.userData.noDark = true；NODARK_MATS / DARKABLE_MATS、registerDarkPatch（選用掛勾）
export {
  makeTower, makeEnemy, makeHero, makeLamp, makeSpawnGate, makeProjectile, makeDecor,
  ENEMY_TYPES, HERO_TYPES, DECOR_KINDS, DECOR_VARIANTS, countTris,
  setGlowStrength, getGlowStrength, setModelLift, getModelLift, MAT, COLORS,
  registerDarkPatch, DARKABLE_MATS, NODARK_MATS, markNoDark, setMaterialGlow,
} from './models/index.js';
