// 風格化海面（擁有者：C）：shader 波紋、岸邊白色泡沫（靠海岸距離場）、淺灘半透明、太陽反光、融入霧。
import * as THREE from 'three';
import { SEA_Y, BOTTOM_Y } from './terrain.js';
import { DK_GLSL_SAMPLE } from './darkness.js';

const VERT = /* glsl */`
#include <fog_pars_vertex>
uniform vec4 uShoreRect;
varying vec3 vWorld;
varying vec2 vShoreUV;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  vShoreUV = (wp.xz - uShoreRect.xy) * uShoreRect.zw;
  vec4 mvPosition = viewMatrix * wp;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;

const FRAG = /* glsl */`
uniform float uTime;
uniform sampler2D uShore;
uniform float uHasShore;
uniform vec3 uDeep, uShallow, uFoam, uSky, uSunDir, uSunColor;
uniform float uRain, uSpec;
varying vec3 vWorld;
varying vec2 vShoreUV;
#include <fog_pars_fragment>
${DK_GLSL_SAMPLE}
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
void main() {
  vec2 suv = vShoreUV;
  float inside = uHasShore * step(0.0, suv.x) * step(suv.x, 1.0) * step(0.0, suv.y) * step(suv.y, 1.0);
  float d = mix(4.0, texture2D(uShore, clamp(suv, 0.0, 1.0)).r * 4.0, inside);
  vec2 p = vWorld.xz;
  float t = uTime;
  float n1 = noise(p * 0.8 + vec2(t * 0.16, t * 0.11));
  float n2 = noise(p * 1.9 - vec2(t * 0.21, -t * 0.14));
  float n3 = noise(p * 4.3 + vec2(t * 0.35, t * 0.05));
  float wav = n1 * 0.55 + n2 * 0.3 + n3 * 0.15;
  float depth = smoothstep(0.0, 3.2, d + (wav - 0.5) * 0.7);
  vec3 col = mix(uShallow, uDeep, depth);
  // 卡通波紋亮帶
  float band = smoothstep(0.60, 0.63, wav) * (1.0 - smoothstep(0.67, 0.72, wav));
  band *= smoothstep(0.3, 0.6, n2) * (1.0 - depth * 0.45);   // 斷斷續續、深海淡一點，避免滿海白線
  col = mix(col, mix(uShallow, uFoam, 0.45), band * 0.22);
  // 反射天空（菲涅耳）＋太陽閃光
  vec3 nrm = normalize(vec3((n1 - 0.5) * 0.5 + (n3 - 0.5) * 0.25, 1.0, (n2 - 0.5) * 0.5));
  vec3 V = normalize(cameraPosition - vWorld);
  float fres = pow(1.0 - max(dot(nrm, V), 0.0), 3.0);
  col = mix(col, uSky, clamp(fres * 1.1, 0.0, 0.75));
  vec3 Hh = normalize(V + uSunDir);
  float spec = pow(max(dot(nrm, Hh), 0.0), 140.0);
  col += uSunColor * spec * uSpec * (1.0 - uRain * 0.85);
  // 岸邊泡沫：貼岸的實心一圈＋往岸邊推進的波紋線
  float fn = noise(p * 3.1 + vec2(t * 0.3, -t * 0.1));
  float rim = 1.0 - smoothstep(0.1, 0.2 + fn * 0.14, d);
  float ring = fract(d * 1.3 + t * 0.26 + fn * 0.22);
  float ringMask = smoothstep(0.0, 0.05, ring) * (1.0 - smoothstep(0.09, 0.16, ring));
  ringMask *= (1.0 - smoothstep(0.3, 1.25, d)) * step(0.14, d) * smoothstep(0.35, 0.6, fn + 0.3);
  float foam = max(rim, ringMask * 0.85) * inside;
  col = mix(col, uFoam, foam);
  // 第二章黑暗：光外的湖面幾乎全黑，光裡的湖面映出燈光（暖色／冷色波光）。第一章 uDkOn = 0 不會進來。
  if (uDkOn > 0.0) {
    vec4 L = dkLit(vWorld.xz);
    vec3 tint = vec3(1.0) + uDkWarm * L.g + uDkCool * L.b;
    // 湖面映出光源：稀疏、會閃的波光（暖光偏橘、冷光偏青）
    float glint = smoothstep(0.64, 0.86, n2 * 0.55 + n3 * 0.6) * (0.55 + 0.45 * sin(t * 1.7 + p.x * 2.3 + p.y * 1.9));
    vec3 reflCol = vec3(1.0, 0.72, 0.4) * L.g + vec3(0.45, 0.8, 1.0) * L.b + vec3(0.5, 0.55, 0.6) * max(0.0, 1.0 - L.g - L.b);
    vec3 refl = reflCol * (glint * 0.1 + 0.012) * L.r;
    vec3 litCol = col * tint * uDkBoost + refl;
    vec3 darkCol = col * uDkAmb * 1.2 + uDkRim * band * 0.4;
    col = mix(col, mix(darkCol, litCol, L.r), uDkOn);
  }
  float alpha = mix(0.58, 1.0, smoothstep(0.1, 1.7, d));
  alpha = max(alpha, foam);
  gl_FragColor = vec4(col, alpha);
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;

export function createWater(scene, dk = null) {
  const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
    uTime: { value: 0 },
    uShore: { value: null },
    uHasShore: { value: 0 },
    uShoreRect: { value: new THREE.Vector4(0, 0, 1, 1) },
    uDeep: { value: new THREE.Color('#1f7fb0') },
    uShallow: { value: new THREE.Color('#4fd1c5') },
    uFoam: { value: new THREE.Color('#ffffff') },
    uSky: { value: new THREE.Color('#bfe6ff') },
    uSunDir: { value: new THREE.Vector3(0, 1, 0) },
    uSunColor: { value: new THREE.Color('#ffffff') },
    uRain: { value: 0 },
    uSpec: { value: 1 },
  }]);
  // 黑暗效果的 uniform（與 darkness.js 共用同一份物件）；沒給就用關閉的預設值
  const dkU = dk || {
    uDkOn: { value: 0 }, uDkMap: { value: null }, uDkRect: { value: new THREE.Vector4(0, 0, 1, 1) }, uDkGlobal: { value: 0 }, uDkBoost: { value: 1 },
    uDkAmb: { value: new THREE.Vector3() }, uDkRim: { value: new THREE.Vector3() }, uDkWarm: { value: new THREE.Vector3() }, uDkCool: { value: new THREE.Vector3() },
  };
  for (const k of Object.keys(dkU)) uniforms[k] = dkU[k];
  const mat = new THREE.ShaderMaterial({
    uniforms, vertexShader: VERT, fragmentShader: FRAG,
    transparent: true, fog: true, toneMapped: false, depthWrite: true,
  });
  const geo = new THREE.PlaneGeometry(700, 700, 1, 1).rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = SEA_Y;
  mesh.renderOrder = -1;
  mesh.name = 'sea';
  mesh.frustumCulled = false;
  scene.add(mesh);

  // 淺灘下面的海床（透過半透明海水看得到）
  const floorMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#1b5f78'), fog: true });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), floorMat);
  floor.position.y = BOTTOM_Y + 0.02;
  floor.name = 'sea-floor';
  scene.add(floor);

  return {
    mesh, floor, uniforms,
    setShore(shore) {
      if (!shore) { uniforms.uHasShore.value = 0; return; }
      uniforms.uShore.value = shore.tex;
      uniforms.uShoreRect.value.copy(shore.rect);
      uniforms.uHasShore.value = 1;
      floor.scale.set(shore.sizeX, 1, shore.sizeZ);
      floor.position.x = shore.minX + shore.sizeX / 2;
      floor.position.z = shore.minZ + shore.sizeZ / 2;
    },
    /** p：環境參數（lighting.js） */
    applyEnv(p) {
      uniforms.uDeep.value.copy(p.seaDeep);
      uniforms.uShallow.value.copy(p.seaShallow);
      uniforms.uFoam.value.copy(p.foam);
      uniforms.uSky.value.copy(p.skyHorizon).lerp(p.skyTop, 0.35);
      uniforms.uSunDir.value.copy(p.sunDir);
      uniforms.uSunColor.value.copy(p.sunColor);
      uniforms.uRain.value = p.rain;
      uniforms.uSpec.value = p.spec;
      floorMat.color.copy(p.seaDeep).lerp(p.seaShallow, 0.35).multiplyScalar(0.55);
    },
    update(dt) { uniforms.uTime.value = (uniforms.uTime.value + dt) % 1200; },
  };
}
