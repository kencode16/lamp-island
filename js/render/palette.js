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

function patchFx(mat) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uGlow = glowUniform;
    sh.uniforms.uLift = liftUniform;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec2 fx;\nvarying vec2 vFx;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFx = fx;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vFx;\nuniform float uGlow;\nuniform float uLift;')
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.32, vFx.y);')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * (vFx.x * uGlow + uLift);');
  };
  mat.customProgramCacheKey = () => 'shoudeng-vcfx-2';
  return mat;
}

function vcMaterial(opts = {}) {
  return patchFx(new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.82, metalness: 0, ...opts }));
}

export const MAT = {
  /** 主材質（所有模型的實心部分） */
  vc: vcMaterial(),
  /** 受擊閃白（hit() 時暫時換上） */
  flash: vcMaterial({ emissive: new THREE.Color('#ffffff'), emissiveIntensity: 0.62 }),
  /** 冰凍（frozen 時換上）：冰藍色調＋微光 */
  frozen: vcMaterial({ color: new THREE.Color('#a8dcff'), emissive: new THREE.Color('#2f6ea0'), emissiveIntensity: 0.55, roughness: 0.3 }),
};
MAT.vc.name = 'shoudeng-vc';
MAT.flash.name = 'shoudeng-flash';
MAT.frozen.name = 'shoudeng-frozen';

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
