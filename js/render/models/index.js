// 模型正式版入口（擁有者：B）。js/render/models.js 會轉出這裡的全部函式。
export { makeTower } from './towers.js';
export { makeEnemy, ENEMY_TYPES } from './enemies.js';
export { makeHero } from './hero.js';
export { makeLamp, makeSpawnGate, makeProjectile } from './props.js';
export { makeDecor, DECOR_KINDS, DECOR_VARIANTS } from './decor.js';
export { countTris } from './lib.js';
export { setGlowStrength, getGlowStrength, setModelLift, getModelLift, MAT, COLORS } from '../palette.js';
