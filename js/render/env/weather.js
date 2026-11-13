// 雨（擁有者：C）：GPU 動畫的雨絲（instanced 細長面片）＋地面水花。整片雨固定在世界座標，循環包覆在鏡頭附近。
import * as THREE from 'three';

const RAIN_VERT = /* glsl */`
uniform float uTime, uSpeed, uLen, uWidth, uAmount;
uniform vec3 uCenter, uBox, uRight;
attribute vec3 aOffset;
attribute float aSeed;
varying float vA, vY;
void main() {
  vec3 c;
  c.xz = uCenter.xz + (fract(aOffset.xz - uCenter.xz / uBox.xz) - 0.5) * uBox.xz;
  float fall = fract(aOffset.y - uTime * uSpeed * (0.85 + aSeed * 0.3) / uBox.y);
  c.y = -0.4 + fall * uBox.y;
  vec3 dir = normalize(vec3(0.16, 1.0, 0.06));
  vec3 pos = c + uRight * position.x * uWidth + dir * position.y * uLen;
  vY = position.y;
  vA = step(aSeed, uAmount) * smoothstep(0.0, 0.6, c.y + 0.4);
  gl_Position = projectionMatrix * viewMatrix * vec4(pos, 1.0);
}`;
const RAIN_FRAG = /* glsl */`
uniform vec3 uColor;
uniform float uOpacity;
varying float vA, vY;
void main() {
  float a = vA * uOpacity * vY * (1.0 - smoothstep(0.85, 1.0, vY));
  if (a < 0.003) discard;
  gl_FragColor = vec4(uColor, a);
  #include <colorspace_fragment>
}`;

const SPLASH_VERT = /* glsl */`
uniform float uTime, uScale, uAmount;
uniform vec3 uCenter, uBox;
attribute vec3 aOffset;
attribute float aSeed;
varying float vPhase, vA;
void main() {
  float ph = fract(uTime * (1.2 + aSeed * 0.8) + aSeed * 7.0);
  // 每一輪換一個位置
  float cyc = floor(uTime * (1.2 + aSeed * 0.8) + aSeed * 7.0);
  vec2 jit = fract(vec2(sin(cyc * 12.9898 + aSeed * 78.233), sin(cyc * 39.346 + aSeed * 11.135)) * 43758.5453);
  vec3 c;
  c.xz = uCenter.xz + (fract(aOffset.xz + jit * 0.37 - uCenter.xz / uBox.xz) - 0.5) * uBox.xz;
  c.y = 0.02;
  vPhase = ph;
  vA = step(aSeed, uAmount);
  vec4 mv = viewMatrix * vec4(c, 1.0);
  gl_PointSize = (0.08 + ph * 0.22) * uScale / max(0.1, -mv.z);
  gl_Position = projectionMatrix * mv;
}`;
const SPLASH_FRAG = /* glsl */`
uniform vec3 uColor;
uniform float uOpacity;
varying float vPhase, vA;
void main() {
  vec2 p = gl_PointCoord * 2.0 - 1.0;
  p.y *= 1.9;
  float r = length(p);
  float ring = smoothstep(0.62, 0.8, r) * (1.0 - smoothstep(0.8, 1.0, r));
  float a = ring * (1.0 - vPhase) * vA * uOpacity;
  if (a < 0.003) discard;
  gl_FragColor = vec4(uColor, a);
  #include <colorspace_fragment>
}`;

export function createRain(scene, count = 1600) {
  const quad = new THREE.InstancedBufferGeometry();
  quad.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, 0, 0, 0.5, 0, 0, 0.5, 1, 0, -0.5, 1, 0], 3));
  quad.setIndex([0, 1, 2, 0, 2, 3]);
  const off = new Float32Array(count * 3), seed = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    off[i * 3] = Math.random(); off[i * 3 + 1] = Math.random(); off[i * 3 + 2] = Math.random();
    seed[i] = Math.random();
  }
  quad.setAttribute('aOffset', new THREE.InstancedBufferAttribute(off, 3));
  quad.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seed, 1));
  quad.instanceCount = count;
  const uniforms = {
    uTime: { value: 0 }, uSpeed: { value: 11 }, uLen: { value: 0.55 }, uWidth: { value: 0.022 }, uAmount: { value: 0 },
    uCenter: { value: new THREE.Vector3() }, uBox: { value: new THREE.Vector3(26, 12, 26) }, uRight: { value: new THREE.Vector3(1, 0, 0) },
    uColor: { value: new THREE.Color('#cfe0f0') }, uOpacity: { value: 0.5 },
  };
  const mat = new THREE.ShaderMaterial({ uniforms, vertexShader: RAIN_VERT, fragmentShader: RAIN_FRAG, transparent: true, depthWrite: false, toneMapped: false });
  const mesh = new THREE.Mesh(quad, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 5;
  mesh.visible = false;
  mesh.name = 'rain';
  scene.add(mesh);

  const sc = 260;
  const sg = new THREE.BufferGeometry();
  const sOff = new Float32Array(sc * 3), sSeed = new Float32Array(sc);
  for (let i = 0; i < sc; i++) { sOff[i * 3] = Math.random(); sOff[i * 3 + 2] = Math.random(); sSeed[i] = Math.random(); }
  sg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(sc * 3), 3));
  sg.setAttribute('aOffset', new THREE.BufferAttribute(sOff, 3));
  sg.setAttribute('aSeed', new THREE.BufferAttribute(sSeed, 1));
  const sUniforms = {
    uTime: { value: 0 }, uScale: { value: 800 }, uAmount: { value: 0 },
    uCenter: uniforms.uCenter, uBox: { value: new THREE.Vector3(22, 1, 22) },
    uColor: { value: new THREE.Color('#e4f0ff') }, uOpacity: { value: 0.55 },
  };
  const sMat = new THREE.ShaderMaterial({ uniforms: sUniforms, vertexShader: SPLASH_VERT, fragmentShader: SPLASH_FRAG, transparent: true, depthWrite: false, toneMapped: false });
  const splash = new THREE.Points(sg, sMat);
  splash.frustumCulled = false;
  splash.renderOrder = 4;
  splash.visible = false;
  scene.add(splash);

  const right = new THREE.Vector3();
  let amount = 0;
  return {
    mesh, splash,
    setAmount(a) { amount = a; },
    /** night：0–1，雨絲在夜晚稍微暗一點 */
    update(dt, camera, target, dist, pixelScale, night = 0) {
      const on = amount > 0.01;
      mesh.visible = splash.visible = on;
      if (!on) return;
      uniforms.uTime.value = (uniforms.uTime.value + dt) % 1000;
      sUniforms.uTime.value = uniforms.uTime.value;
      uniforms.uAmount.value = amount;
      sUniforms.uAmount.value = amount;
      uniforms.uCenter.value.copy(target);
      const span = Math.max(18, dist * 1.5);
      uniforms.uBox.value.set(span, Math.max(10, dist * 0.65), span);
      sUniforms.uBox.value.set(span * 0.9, 1, span * 0.9);
      right.setFromMatrixColumn(camera.matrixWorld, 0);
      right.y = 0; right.normalize();
      uniforms.uRight.value.copy(right);
      uniforms.uWidth.value = 0.018 + dist * 0.0012;
      uniforms.uOpacity.value = 0.5 - night * 0.18;
      sUniforms.uScale.value = pixelScale;
    },
  };
}

// ---------------------------------------------------------------------------
// 瘴氣（第二章 weather 'mist'）：貼地漂浮的紫綠色霧團。用黑暗貼圖決定亮度：光裡的霧被照亮、暗處的霧只剩淡淡輪廓。
const MIST_VERT = /* glsl */`
uniform float uTime, uScale;
uniform vec4 uArea;   // minX, minZ, sizeX, sizeZ（世界座標）
attribute vec4 aSeed; // x,z（0–1）、大小、相位
varying float vA;
varying vec3 vTint;
__DK__
void main() {
  vec2 drift = vec2(uTime * (0.05 + aSeed.w * 0.05), sin(uTime * 0.13 + aSeed.w * 20.0) * 0.6);
  vec2 xz = uArea.xy + fract(aSeed.xy + drift / uArea.zw) * uArea.zw;
  vec3 p = vec3(xz.x, 0.25 + aSeed.w * 0.45 + 0.08 * sin(uTime * 0.7 + aSeed.w * 9.0), xz.y);
  vec4 mv = viewMatrix * vec4(p, 1.0);
  gl_PointSize = (1.4 + aSeed.z * 2.2) * uScale / max(0.1, -mv.z);
  // 邊緣（循環接縫）淡出
  vec2 e = min(fract(aSeed.xy + drift / uArea.zw), 1.0 - fract(aSeed.xy + drift / uArea.zw));
  vA = smoothstep(0.0, 0.08, min(e.x, e.y));
  vTint = vec3(1.0);
  if (uDkOn > 0.0) {
    vec4 L = dkLit(xz);
    vTint = mix(vec3(1.0), vec3(0.14) + (vec3(1.0) + uDkWarm * L.g + uDkCool * L.b) * L.r, uDkOn);
  }
  gl_Position = projectionMatrix * mv;
}`;
const MIST_FRAG = /* glsl */`
uniform vec3 uColor;
uniform float uOpacity;
varying float vA;
varying vec3 vTint;
void main() {
  vec2 p = gl_PointCoord * 2.0 - 1.0;
  float d = dot(p, p);
  if (d > 1.0) discard;
  float a = pow(1.0 - d, 2.0) * vA * uOpacity;
  if (a < 0.003) discard;
  gl_FragColor = vec4(uColor * vTint, a);
  #include <colorspace_fragment>
}`;

export function createMist(scene, dkUniforms, dkGlsl, count = 90) {
  const g = new THREE.BufferGeometry();
  const seed = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) { seed[i * 4] = Math.random(); seed[i * 4 + 1] = Math.random(); seed[i * 4 + 2] = Math.random(); seed[i * 4 + 3] = Math.random(); }
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
  const uniforms = {
    uTime: { value: 0 }, uScale: { value: 800 }, uArea: { value: new THREE.Vector4(-10, -8, 20, 16) },
    uColor: { value: new THREE.Color('#7a6a9c') }, uOpacity: { value: 0 },
  };
  for (const k of Object.keys(dkUniforms)) uniforms[k] = dkUniforms[k];
  const mat = new THREE.ShaderMaterial({
    uniforms, vertexShader: MIST_VERT.replace('__DK__', dkGlsl), fragmentShader: MIST_FRAG,
    transparent: true, depthWrite: false, toneMapped: false,
  });
  const points = new THREE.Points(g, mat);
  points.frustumCulled = false;
  points.renderOrder = 4;
  points.visible = false;
  points.name = 'mist';
  scene.add(points);
  let amount = 0;
  return {
    points,
    setArea(minX, minZ, sizeX, sizeZ) { uniforms.uArea.value.set(minX, minZ, sizeX, sizeZ); },
    setAmount(a) { amount = a; },
    update(dt, pixelScale) {
      points.visible = amount > 0.01;
      if (!points.visible) return;
      uniforms.uTime.value = (uniforms.uTime.value + dt) % 2000;
      uniforms.uScale.value = pixelScale;
      uniforms.uOpacity.value = 0.27 * amount;
    },
  };
}
