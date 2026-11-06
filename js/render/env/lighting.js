// 白天／黃昏／夜晚 × 晴／雨／霧 的環境參數與平滑過渡（擁有者：C）
import * as THREE from 'three';

const C = (h) => new THREE.Color(h);
const V = (x, y, z) => new THREE.Vector3(x, y, z).normalize();

// 顏色欄位（lerp 用）
const COLOR_KEYS = ['sunColor', 'hemiSky', 'hemiGround', 'fogColor', 'skyTop', 'skyHorizon', 'seaDeep', 'seaShallow', 'foam'];
const NUM_KEYS = ['sunInt', 'hemiInt', 'fogNear', 'fogFar', 'stars', 'night', 'rain', 'exposure', 'sunVis', 'spec', 'glow', 'shadow'];

export const TIME_PRESETS = {
  day: {
    sunDir: V(-0.5, 0.82, 0.42), sunColor: C('#fff1dc'), sunInt: 2.7,
    hemiSky: C('#cfe8ff'), hemiGround: C('#6f8a4a'), hemiInt: 1.15,
    fogColor: C('#b9e0f2'), fogNear: 1.35, fogFar: 3.6,
    skyTop: C('#4f97de'), skyHorizon: C('#c4e7f7'),
    seaDeep: C('#1c86b8'), seaShallow: C('#53d6c8'), foam: C('#ffffff'),
    stars: 0, night: 0, rain: 0, exposure: 1.0, sunVis: 1, spec: 1.0, glow: 1.0, shadow: 1,
  },
  dusk: {
    sunDir: V(-0.85, 0.32, 0.25), sunColor: C('#ffb27a'), sunInt: 2.3,
    hemiSky: C('#e6b2c4'), hemiGround: C('#5a4650'), hemiInt: 0.95,
    fogColor: C('#f0a787'), fogNear: 1.3, fogFar: 3.4,
    skyTop: C('#4a4c8c'), skyHorizon: C('#ffae7a'),
    seaDeep: C('#2c5a8c'), seaShallow: C('#5aa8b0'), foam: C('#ffe6d6'),
    stars: 0.15, night: 0.45, rain: 0, exposure: 1.02, sunVis: 1, spec: 1.3, glow: 1.25, shadow: 1,
  },
  night: {
    sunDir: V(0.42, 0.78, 0.35), sunColor: C('#a9c2ff'), sunInt: 1.0,
    hemiSky: C('#5a78c0'), hemiGround: C('#28324a'), hemiInt: 0.82,
    fogColor: C('#142344'), fogNear: 1.25, fogFar: 3.2,
    skyTop: C('#060b20'), skyHorizon: C('#1d3263'),
    seaDeep: C('#0c2a52'), seaShallow: C('#2a6a8c'), foam: C('#a8c8ec'),
    stars: 1, night: 1, rain: 0, exposure: 1.08, sunVis: 0.5, spec: 0.8, glow: 1.6, shadow: 0.85,
  },
};

const GREY = C('#8a949c');
/** 依時段＋天氣算出目標參數（只在 setEnv 時呼叫，會 new 物件） */
export function envTarget(time = 'day', weather = 'clear') {
  const base = TIME_PRESETS[time] || TIME_PRESETS.day;
  const p = cloneParams(base);
  p.time = TIME_PRESETS[time] ? time : 'day';
  p.weather = weather;
  if (weather === 'rain') {
    const grey = time === 'night' ? C('#1a2233') : time === 'dusk' ? C('#6a6070') : C('#8c98a4');
    for (const k of ['fogColor', 'skyTop', 'skyHorizon']) p[k].lerp(grey, 0.6);
    p.sunColor.lerp(GREY, 0.4);
    p.hemiSky.lerp(GREY, 0.35);
    p.seaDeep.lerp(grey, 0.35).multiplyScalar(0.8);
    p.seaShallow.lerp(grey, 0.4).multiplyScalar(0.85);
    p.sunInt *= 0.42; p.hemiInt *= 0.86;
    p.fogNear *= 0.85; p.fogFar *= 0.8;
    p.rain = 1; p.sunVis = 0; p.stars = 0; p.spec *= 0.3; p.shadow *= 0.55;
    p.exposure *= 0.96;
  } else if (weather === 'fog') {
    const haze = time === 'night' ? C('#33405e') : time === 'dusk' ? C('#d8a898') : C('#dfe7ea');
    p.fogColor.lerp(haze, 0.8);
    p.skyHorizon.lerp(haze, 0.85);
    p.skyTop.lerp(haze, 0.6);
    p.seaDeep.lerp(haze, 0.25);
    p.sunInt *= 0.62; p.hemiInt *= 1.0;
    p.fogNear = 0.62; p.fogFar = 1.9;
    p.sunVis = 0.15; p.stars = 0; p.spec *= 0.4; p.shadow *= 0.6;
  }
  return p;
}

export function cloneParams(s) {
  const p = { sunDir: s.sunDir.clone(), time: s.time, weather: s.weather };
  for (const k of COLOR_KEYS) p[k] = s[k].clone();
  for (const k of NUM_KEYS) p[k] = s[k];
  return p;
}

/** out = a → b 的 t 插值（不 new） */
export function lerpParams(out, a, b, t) {
  out.sunDir.copy(a.sunDir).lerp(b.sunDir, t).normalize();
  for (const k of COLOR_KEYS) out[k].copy(a[k]).lerp(b[k], t);
  for (const k of NUM_KEYS) out[k] = a[k] + (b[k] - a[k]) * t;
  out.time = t < 0.5 ? a.time : b.time;
  out.weather = t < 0.5 ? a.weather : b.weather;
  return out;
}
