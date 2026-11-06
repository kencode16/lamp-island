// 漸層天空（擁有者：C）：天頂→地平線→下方的漸層、太陽光暈、夜晚星星。跟著鏡頭移動。
import * as THREE from 'three';

const VERT = /* glsl */`
varying vec3 vDir;
void main() {
  vDir = normalize((modelMatrix * vec4(position, 1.0)).xyz - cameraPosition);
  vec4 p = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
  gl_Position = p.xyww;
}`;
const FRAG = /* glsl */`
uniform vec3 uTop, uHorizon, uBottom, uSunDir, uSunColor;
uniform float uStars, uSunVis, uTime;
varying vec3 vDir;
float hash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
void main() {
  vec3 d = normalize(vDir);
  float h = d.y;
  vec3 col = h > 0.0 ? mix(uHorizon, uTop, pow(clamp(h, 0.0, 1.0), 0.55)) : mix(uHorizon, uBottom, pow(clamp(-h, 0.0, 1.0), 0.4));
  float s = max(dot(d, normalize(uSunDir)), 0.0);
  col += uSunColor * (pow(s, 900.0) * 2.5 + pow(s, 14.0) * 0.28) * uSunVis;
  if (uStars > 0.001 && h > 0.0) {
    vec3 q = d * 160.0;
    vec3 cell = floor(q);
    float r = hash(cell);
    if (r > 0.992) {
      vec3 f = fract(q) - 0.5;
      float tw = 0.6 + 0.4 * sin(uTime * (1.5 + r * 3.0) + r * 40.0);
      float star = smoothstep(0.18, 0.0, length(f)) * tw;
      col += vec3(star) * uStars * smoothstep(0.0, 0.25, h);
    }
  }
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

export function createSky(scene) {
  const uniforms = {
    uTop: { value: new THREE.Color('#4a90d9') },
    uHorizon: { value: new THREE.Color('#bfe6ff') },
    uBottom: { value: new THREE.Color('#7fb8d8') },
    uSunDir: { value: new THREE.Vector3(0, 1, 0) },
    uSunColor: { value: new THREE.Color('#ffffff') },
    uStars: { value: 0 },
    uSunVis: { value: 1 },
    uTime: { value: 0 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms, vertexShader: VERT, fragmentShader: FRAG,
    side: THREE.BackSide, depthWrite: false, depthTest: true, fog: false, toneMapped: false,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(300, 24, 12), mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -10;
  mesh.name = 'sky';
  scene.add(mesh);
  return {
    mesh, uniforms,
    applyEnv(p) {
      uniforms.uTop.value.copy(p.skyTop);
      uniforms.uHorizon.value.copy(p.skyHorizon);
      uniforms.uBottom.value.copy(p.fogColor);
      uniforms.uSunDir.value.copy(p.sunDir);
      uniforms.uSunColor.value.copy(p.sunColor);
      uniforms.uStars.value = p.stars;
      uniforms.uSunVis.value = p.sunVis;
    },
    update(dt, camera) {
      mesh.position.copy(camera.position);
      uniforms.uTime.value = (uniforms.uTime.value + dt) % 1000;
    },
  };
}
