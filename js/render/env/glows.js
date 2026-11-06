// 夜晚光暈（擁有者：C）：燈、路燈、房屋窗戶、傳送門在黃昏與夜晚的地面光池＋空中光暈。
// 用一個 InstancedMesh（地面光池）＋一個 Points（光暈），亮度跟著 night（0–1）走，不額外增加真的燈光。
import * as THREE from 'three';

let poolTex = null;
function getPoolTexture() {
  if (poolTex) return poolTex;
  const s = 128;
  const cv = document.createElement('canvas'); cv.width = cv.height = s;
  const g = cv.getContext('2d');
  const grd = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.3, 'rgba(255,255,255,0.55)');
  grd.addColorStop(0.65, 'rgba(255,255,255,0.16)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, s, s);
  poolTex = new THREE.CanvasTexture(cv);
  poolTex.colorSpace = THREE.SRGBColorSpace;
  return poolTex;
}

const HALO_VERT = /* glsl */`
attribute float aSize;
attribute vec3 aColor;
attribute float aSeed;
uniform float uScale, uNight, uTime;
varying vec3 vColor;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  float fl = 0.9 + 0.1 * sin(uTime * (5.0 + aSeed * 4.0) + aSeed * 30.0);
  gl_PointSize = aSize * uScale / max(0.1, -mv.z);
  vColor = aColor * uNight * fl;
  gl_Position = projectionMatrix * mv;
}`;
const HALO_FRAG = /* glsl */`
varying vec3 vColor;
void main() {
  vec2 p = gl_PointCoord * 2.0 - 1.0;
  float d = dot(p, p);
  if (d > 1.0) discard;
  float a = pow(1.0 - d, 2.2);
  gl_FragColor = vec4(vColor * a, 1.0);
  #include <colorspace_fragment>
}`;

const MAX_POOLS = 64, MAX_HALOS = 96;

export function createGlows(scene) {
  const group = new THREE.Group();
  group.name = 'glows';
  scene.add(group);
  const poolMat = new THREE.MeshBasicMaterial({
    map: getPoolTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, fog: true,
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2,
  });
  const pools = new THREE.InstancedMesh(new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2), poolMat, MAX_POOLS);
  pools.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_POOLS * 3), 3);
  pools.count = 0;
  pools.frustumCulled = false;
  pools.renderOrder = 1;
  group.add(pools);
  const poolBase = new Float32Array(MAX_POOLS * 3);

  const hg = new THREE.BufferGeometry();
  hg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX_HALOS * 3), 3));
  hg.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(MAX_HALOS), 1));
  hg.setAttribute('aColor', new THREE.BufferAttribute(new Float32Array(MAX_HALOS * 3), 3));
  hg.setAttribute('aSeed', new THREE.BufferAttribute(new Float32Array(MAX_HALOS), 1));
  hg.setDrawRange(0, 0);
  const hUniforms = { uScale: { value: 800 }, uNight: { value: 0 }, uTime: { value: 0 } };
  const halos = new THREE.Points(hg, new THREE.ShaderMaterial({
    uniforms: hUniforms, vertexShader: HALO_VERT, fragmentShader: HALO_FRAG,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
  }));
  halos.frustumCulled = false;
  halos.renderOrder = 6;
  group.add(halos);

  const m4 = new THREE.Matrix4(), col = new THREE.Color();
  let nPools = 0, nHalos = 0, night = -1;
  const api = {
    group,
    clear() { nPools = 0; nHalos = 0; pools.count = 0; hg.setDrawRange(0, 0); night = -1; },
    /** 地面光池：世界座標、半徑、顏色、強度 */
    addPool(x, y, z, radius, color, strength = 1) {
      if (nPools >= MAX_POOLS) return;
      m4.makeScale(radius, 1, radius).setPosition(x, y + 0.03, z);
      pools.setMatrixAt(nPools, m4);
      col.set(color).multiplyScalar(strength);
      poolBase[nPools * 3] = col.r; poolBase[nPools * 3 + 1] = col.g; poolBase[nPools * 3 + 2] = col.b;
      nPools++;
      pools.count = nPools;
      pools.instanceMatrix.needsUpdate = true;
      night = -1;
    },
    /** 空中光暈：世界座標、直徑（世界單位） */
    addHalo(x, y, z, size, color, strength = 1) {
      if (nHalos >= MAX_HALOS) return;
      const p = hg.attributes.position.array, s = hg.attributes.aSize.array, c = hg.attributes.aColor.array, sd = hg.attributes.aSeed.array;
      p[nHalos * 3] = x; p[nHalos * 3 + 1] = y; p[nHalos * 3 + 2] = z;
      s[nHalos] = size;
      col.set(color).multiplyScalar(strength);
      c[nHalos * 3] = col.r; c[nHalos * 3 + 1] = col.g; c[nHalos * 3 + 2] = col.b;
      sd[nHalos] = (nHalos * 0.6180339) % 1;
      nHalos++;
      for (const k of ['position', 'aSize', 'aColor', 'aSeed']) hg.attributes[k].needsUpdate = true;
      hg.setDrawRange(0, nHalos);
    },
    update(dt, nightF, pixelScale) {
      hUniforms.uTime.value = (hUniforms.uTime.value + dt) % 1000;
      hUniforms.uScale.value = pixelScale;
      hUniforms.uNight.value = nightF;
      if (Math.abs(nightF - night) > 0.002) {
        night = nightF;
        const arr = pools.instanceColor.array;
        for (let i = 0; i < nPools * 3; i++) arr[i] = poolBase[i] * nightF;
        pools.instanceColor.needsUpdate = true;
      }
      group.visible = nightF > 0.01;
    },
  };
  return api;
}
