// 共用顏色與材質（擁有者：B 模型美術）。介面見 架構.md §6、js/render/models/README.md。
//
// 所有程式生成的模型都用「頂點色」上色，因此幾乎整個遊戲只用一個主材質 MAT.vc：
//   - 顏色寫在 geometry 的 color 屬性（線性色彩空間）
//   - 另外有 vec2 屬性 fx：x = 自發光強度（窗、眼睛、火焰、水晶），y = 光澤（金屬、水晶、史萊姆）
// 好處：同材質的 mesh 可以合併成一個 draw call（場景代理可把裝飾合併），夜晚發光也不用另開材質。
import * as THREE from 'three';

// ---------------------------------------------------------------------------
// 顏色（sRGB 十六進位字串；THREE.Color 會自動轉線性）
// ---------------------------------------------------------------------------
export const COLORS = {
  // 木頭
  wood: '#b9804f', woodDark: '#8a583a', woodLight: '#d9a56c', woodPale: '#ead0a4', woodRed: '#9c5a3c',
  // 石頭
  stone: '#cbc4b7', stoneDark: '#9c958a', stoneLight: '#e7e2d7', stoneBlue: '#aab5c4', stoneWarm: '#d8c8ac',
  stoneDeep: '#7d776f', cobble: '#b5ada0',
  stoneMage: '#bdb6d8', stoneMageDark: '#8e86b2', stoneMageLight: '#dcd6f0', slate: '#6f7a9c', slateDark: '#4d5674',
  stoneIce: '#d3e6f2', stoneIceDark: '#9fbfd6', snow: '#f7fbff', stoneGate: '#4b4458', stoneGateDark: '#342f40', stoneGateLight: '#655c76',
  // 屋頂
  roofRed: '#e2645a', roofRedDark: '#b9473f', roofBlue: '#5b8fd8', roofTeal: '#3ea89f', roofPurple: '#8a63cc',
  roofOrange: '#ee9a48', roofGreen: '#5caa5a',
  // 金屬
  iron: '#5e6270', ironDark: '#3d404b', steel: '#cdd6e1', silver: '#e3e8ef', gold: '#f4c24c', goldDark: '#c8912c',
  copper: '#d98a48', bronze: '#b8823e',
  // 布料與點綴
  red: '#e8505b', redDark: '#b53a48', blue: '#4f7fd8', blueDark: '#34589f', green: '#58b45a', purple: '#8b5cd6',
  cream: '#f5ead0', white: '#f8f6f0', rope: '#d9c08a', black: '#25212b', dark: '#2c2633',
  // 植物
  leaf: '#6dc24c', leafDark: '#4b9d40', leafLight: '#a6e06c', leafYellow: '#cddf5c', leafGold: '#e9c757',
  leafOrange: '#eb9f4c', pine: '#3e9a6e', pineDark: '#2c7a58', pineLight: '#62b884', trunk: '#8f6142',
  trunkDark: '#6d4a33', moss: '#7fba4c', grass: '#8fd16a', grassDark: '#6cb04e', grassLight: '#b7e57f',
  petalPink: '#f59ac0', petalYellow: '#ffd95a', petalWhite: '#fbf6ee', petalPurple: '#b996f0', petalRed: '#f0675e',
  petalBlue: '#82b6f5',
  // 光
  lampGlow: '#ffd27a', flame: '#ffaa3f', flameCore: '#fff1b0', windowGlow: '#ffd27d', fire: '#ff7a2a',
  portal: '#b45cff', portalPink: '#ff78e6', portalDeep: '#3a0f68', magic: '#c58bff', magicPink: '#ff8fe0',
  frost: '#9fe8ff', frostDeep: '#5cc4f0', ice: '#d6f4ff', lightning: '#fff07a', electric: '#7ff6ff',
  // 敵人
  slime: '#74dc52', slimeTop: '#c2f585', slimelet: '#9be35a', slimeletTop: '#dcf98e',
  splitter: '#33bfe8', splitterTop: '#a6ecff',
  goblin: '#8f9c3a', goblinLight: '#adb954', goblinHat: '#dc3b3b', goblinHatDark: '#a8282f', leather: '#8a5b3a',
  bone: '#f1ead6', boneDark: '#cfc5aa', rust: '#c0683a', rustDark: '#8d4a2e', rustLight: '#d98a52',
  gargoyle: '#8d939e', gargoyleDark: '#656b77', gargoyleLight: '#aab0b9',
  bat: '#8a50d6', batDark: '#5b2f9a', batWing: '#a978ea',
  golem: '#958470', golemDark: '#6d604f', golemLight: '#b3a28a',
  shaman: '#5c2c8e', shamanDark: '#3a1b60', shamanTrim: '#e2a43c',
  king: '#6fd44c', kingTop: '#bdf27e',
  nightArmor: '#2f2b46', nightArmorLight: '#4a4466', nightTrim: '#9b6cff', nightCape: '#8e1f43', nightCapeIn: '#4a0f2a',
  eyeRed: '#ff4a5a', eyeGold: '#ffd24a', eyeGreen: '#c6ff5a', eyeCyan: '#7ff6ff', eyeOrange: '#ff9a3a',
  eyeWhite: '#ffffff', pupil: '#1d1922', mouth: '#5a1f2c',
  // 英雄
  heroArmor: '#7fa6ea', heroArmorDark: '#4d73c4', heroSilver: '#dfe6f0', heroCape: '#3557c4', heroCapeIn: '#24408f',
  heroPlume: '#ffd04a', skin: '#f2c8a0',
  // ===== 第二章（洞窟）＝偏冷的深藍灰、紫；發光重點色：暖黃、青、紫 =====
  caveStone: '#5f6884', caveStoneDark: '#434a62', caveStoneLight: '#8b96b2', caveStoneDeep: '#30364a', caveStoneWarm: '#716a80',
  caveMoss: '#3f7a72', caveMossLight: '#79b8a4', caveWood: '#7a5a44', caveWoodDark: '#553e30',
  glowCyan: '#5ff2ff', glowCyanCore: '#d8fdff', glowTeal: '#4ff0c0', glowViolet: '#b07cff', glowVioletCore: '#ecdcff',
  glowWarm: '#ffd27a', glowWarmCore: '#fff3c4', glowPink: '#ff8ee8',
  crystal: '#55d6f5', crystalTop: '#c4f6ff', crystalDeep: '#2a9ed0', prismViolet: '#8a6cff', prismVioletTop: '#f0eaff',
  brass: '#d9a54a', brassDark: '#a8782c',
  lanternPaper: '#ffae48', lanternRed: '#d9483f', lanternRedDark: '#a8302c',
  // 第二章敵人
  ghost: '#46377a', ghostTop: '#a08ce0', ghostEye: '#9ff8ff',
  mole: '#7c6352', moleDark: '#5c4738', moleLight: '#9c8270', moleBelly: '#d6b796', moleNose: '#f08aa0', claw: '#f3ecdc',
  minerHat: '#f2c23c', minerHatDark: '#c08f22',
  ink: '#2a3c8c', inkLight: '#5a78d8', inkDark: '#141c44', inkWing: '#3a55b0', inkSac: '#1c2a6a', inkSacTop: '#6a8cff',
  kingFur: '#6c5444', kingFurLight: '#8f735e', kingCape: '#c8303e', kingCapeIn: '#7a1a28', ermine: '#f6f2ea',
  worm: '#3e3458', wormLight: '#6c5c92', wormPlate: '#54467a', wormBelly: '#a27a86', wormMaw: '#ff6a3a', wormMawCore: '#ffd27a',
  // 第二章英雄
  fairyDress: '#6fd27a', fairyDressTop: '#b6f29a', fairyPetal: '#ffb3d9', fairyHair: '#ffe27a', fairyHairTop: '#fff4c0',
  fairyWing: '#bff9e8', fairyGlow: '#a8ffb0',
  mageRobe: '#3554c0', mageRobeTop: '#5a7ae0', mageRobeDark: '#24398a', mageHat: '#2a347e', mageHatTop: '#4552a8', beard: '#f4f1ea',
  starGold: '#ffe27a', starCore: '#fffbe0',
};
export const C = COLORS;

// ---------------------------------------------------------------------------
// 主材質：頂點色 + fx（自發光／光澤）。所有 vc 材質共用同一份 shader 程式。
// ---------------------------------------------------------------------------
// 全域發光倍率：夜晚可以調高（setGlowStrength(1.4)），白天 1.0。
const glowUniform = { value: 1.0 };
export function setGlowStrength(v) { glowUniform.value = v; }
export function getGlowStrength() { return glowUniform.value; }
// 全域「提亮」：夜晚環境很暗時，讓模型本身微微自亮（0＝關閉，建議夜晚 0.08–0.15），敵人才看得清楚。
const liftUniform = { value: 0.0 };
export function setModelLift(v) { liftUniform.value = v; }
export function getModelLift() { return liftUniform.value; }

// 每個材質自己的發光倍率（uGlowMul，預設 1）：用在「熄滅」「變暗」的共用材質（MAT.glowDim、MAT.glowOff）。
const glowMulU = new WeakMap();
export function setMaterialGlow(mat, v) { const u = glowMulU.get(mat); if (u) u.value = v; }

// 給場景代理（C）的黑暗效果掛勾（選用）：registerDarkPatch(fn, key) 之後，所有「不是 noDark」的 vc 材質
// 編譯時都會呼叫 fn(shader, material)，program 快取鍵加上 key。noDark 材質（MAT.glow 系列）不會套用。
const darkPatches = [];
export function registerDarkPatch(fn, key = 'dark') {
  darkPatches.push({ fn, key });
  for (const m of VC_MATS) m.needsUpdate = true;
}
const VC_MATS = [];

function patchFx(mat, glowMul = 1) {
  const mul = { value: glowMul };
  glowMulU.set(mat, mul);
  VC_MATS.push(mat);
  mat.onBeforeCompile = (sh, renderer) => {
    sh.uniforms.uGlow = glowUniform;
    sh.uniforms.uLift = liftUniform;
    sh.uniforms.uGlowMul = mul;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec2 fx;\nvarying vec2 vFx;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFx = fx;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vFx;\nuniform float uGlow;\nuniform float uLift;\nuniform float uGlowMul;')
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.32, vFx.y);')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * (vFx.x * uGlow * uGlowMul + uLift);');
    if (!mat.userData.noDark) for (const p of darkPatches) p.fn(sh, mat, renderer);
  };
  // 同一組（一般／noDark）共用同一份 shader 程式；noDark 另一組，避免和被 C 改過的一般材質混用。
  mat.customProgramCacheKey = () => 'shoudeng-vcfx-3' + (mat.userData.noDark ? '-nd' : darkPatches.map((p) => '-' + p.key).join('')) + (mat.userData.shaderKey || '');
  return mat;
}

function vcMaterial(opts = {}, glowMul = 1, noDark = false) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.82, metalness: 0, ...opts });
  if (noDark) m.userData.noDark = true;
  return patchFx(m, glowMul);
}

export const MAT = {
  /** 主材質（所有模型的實心部分） */
  vc: vcMaterial(),
  /** 受擊閃白（hit() 時暫時換上） */
  flash: vcMaterial({ emissive: new THREE.Color('#ffffff'), emissiveIntensity: 0.62 }),
  /** 冰凍（frozen 時換上）：冰藍色調＋微光 */
  frozen: vcMaterial({ color: new THREE.Color('#a8dcff'), emissive: new THREE.Color('#2f6ea0'), emissiveIntensity: 0.55, roughness: 0.3 }),
  // ===== 第二章：自發光部分（眼睛、燈、水晶、蘑菇、法杖、投射物）用這組，userData.noDark = true，C 的黑暗效果會排除 =====
  /** 自發光（亮） */
  glow: vcMaterial({}, 1, true),
  /** 自發光（微弱）：還沒被照到的洞窟水晶 */
  glowDim: vcMaterial({ color: new THREE.Color('#9aa6c0') }, 0.28, true),
  /** 自發光（熄滅）：燈籠被噴墨、稜鏡塔沒有光 */
  glowOff: vcMaterial({ color: new THREE.Color('#6a6f80') }, 0.04, true),
  // ===== 第二章：半透明（影子幽靈），會被黑暗效果影響 =====
  ghost: vcMaterial({ transparent: true, opacity: 0.8 }),
  ghostFlash: vcMaterial({ transparent: true, opacity: 0.9, emissive: new THREE.Color('#ffffff'), emissiveIntensity: 0.62 }),
  ghostFrozen: vcMaterial({ transparent: true, opacity: 0.85, color: new THREE.Color('#a8dcff'), emissive: new THREE.Color('#2f6ea0'), emissiveIntensity: 0.55, roughness: 0.3 }),
};
for (const [k, m] of Object.entries(MAT)) m.name = 'shoudeng-' + k;
/** 會被黑暗效果影響的 vc 材質（給 C 參考） */
export const DARKABLE_MATS = [MAT.vc, MAT.flash, MAT.frozen, MAT.ghost, MAT.ghostFlash, MAT.ghostFrozen];
/** 不受黑暗影響的 vc 材質 */
export const NODARK_MATS = [MAT.glow, MAT.glowDim, MAT.glowOff];
/** 自己 new 的發光材質（MeshBasicMaterial 等）用這個標記成不受黑暗影響 */
export function markNoDark(mat) { mat.userData.noDark = true; return mat; }

// ---------------------------------------------------------------------------
// 加色（透明）材質：光暈、傳送門漩渦。快取共用。
// ---------------------------------------------------------------------------
const addCache = new Map();
/** 加色混合的 MeshBasicMaterial（不寫深度），用於漩渦、光環 */
export function additive(color, opacity = 1, vertexColors = false) {
  const key = `${color}|${opacity}|${vertexColors}`;
  let m = addCache.get(key);
  if (!m) {
    m = new THREE.MeshBasicMaterial({ color: new THREE.Color(color), transparent: true, opacity, vertexColors,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
    m.userData.noDark = true;
    addCache.set(key, m);
  }
  return m;
}

let haloTex = null;
function getHaloTexture() {
  if (haloTex) return haloTex;
  const s = 64;
  const cv = document.createElement('canvas'); cv.width = cv.height = s;
  const g = cv.getContext('2d');
  const grd = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.22, 'rgba(255,255,255,0.75)');
  grd.addColorStop(0.5, 'rgba(255,255,255,0.22)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, s, s);
  haloTex = new THREE.CanvasTexture(cv);
  haloTex.colorSpace = THREE.SRGBColorSpace;
  return haloTex;
}
const haloCache = new Map();
/** 光暈用的 SpriteMaterial（加色、柔邊圓形）；同色同透明度共用 */
export function haloMaterial(color, opacity = 0.8) {
  const key = `${color}|${opacity}`;
  let m = haloCache.get(key);
  if (!m) {
    m = new THREE.SpriteMaterial({ map: getHaloTexture(), color: new THREE.Color(color), transparent: true, opacity,
      blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    m.userData.noDark = true;
    haloCache.set(key, m);
  }
  return m;
}
/** 產生一個光暈 Sprite（size＝世界單位直徑） */
export function halo(color, size = 0.5, opacity = 0.8) {
  const s = new THREE.Sprite(haloMaterial(color, opacity));
  s.scale.set(size, size, 1);
  s.renderOrder = 2;
  return s;
}
/** 需要單獨調亮度的光暈（例如守護燈），會複製一份材質 */
export function haloOwn(color, size = 0.5, opacity = 0.8) {
  const s = halo(color, size, opacity);
  s.material = s.material.clone();
  return s;
}
