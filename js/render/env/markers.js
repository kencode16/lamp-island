// 地面標示（擁有者：C）：格子高亮、射程圈、流星雨瞄準圈、敵人路線流動箭頭
import * as THREE from 'three';

const DISC_VERT = /* glsl */`
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

// uStyle 0＝射程圈、1＝流星雨瞄準
const DISC_FRAG = /* glsl */`
uniform vec3 uColor;
uniform float uTime, uOpacity, uStyle, uRadius;
varying vec2 vUv;
void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float r = length(p);
  if (r > 1.0) discard;
  float px = 0.035 / max(uRadius, 0.5);
  float edge = smoothstep(1.0 - px * 3.0, 1.0 - px * 1.2, r) * (1.0 - smoothstep(1.0 - px * 0.5, 1.0, r));
  float ang = atan(p.y, p.x);
  float a;
  if (uStyle < 0.5) {
    float dash = step(0.45, fract(ang * 18.0 / 6.2831853 + uTime * 0.12));
    float fill = 0.12 + 0.12 * smoothstep(0.55, 1.0, r);
    a = fill + edge * (0.55 + 0.45 * dash);
  } else {
    float pulse = 0.5 + 0.5 * sin(uTime * 6.0);
    float inner = smoothstep(0.02, 0.0, abs(r - (0.35 + 0.05 * pulse)));
    float cross = (smoothstep(0.03, 0.0, abs(p.x)) + smoothstep(0.03, 0.0, abs(p.y))) * step(r, 0.24) * step(0.08, r);
    float sweep = smoothstep(0.0, 1.0, fract(ang / 6.2831853 - uTime * 0.5));
    float fill = 0.16 + 0.14 * sweep * smoothstep(0.3, 1.0, r);
    float ticks = step(0.85, fract(ang * 8.0 / 6.2831853 + uTime * 0.2)) * smoothstep(0.82, 0.86, r) * (1.0 - smoothstep(0.92, 0.95, r));
    a = fill + edge * (0.8 + 0.2 * pulse) + inner * 0.7 + cross * 0.8 + ticks * 0.8;
  }
  gl_FragColor = vec4(uColor, clamp(a, 0.0, 1.0) * uOpacity);
  #include <colorspace_fragment>
}`;

const CELL_FRAG = /* glsl */`
uniform vec3 uColor;
uniform float uTime, uOpacity;
varying vec2 vUv;
void main() {
  vec2 p = abs(vUv * 2.0 - 1.0);
  vec2 q = max(p - 0.78, 0.0);
  float m = length(q) + min(max(p.x, p.y) - 0.78, 0.0);   // 圓角方形距離
  float border = smoothstep(0.05, 0.1, m) * (1.0 - smoothstep(0.16, 0.2, m));
  float pulse = 0.75 + 0.25 * sin(uTime * 5.0);
  float fill = (1.0 - smoothstep(0.1, 0.2, m)) * 0.22;
  float a = (fill + border * 0.95) * pulse;
  if (a < 0.003) discard;
  gl_FragColor = vec4(uColor, a * uOpacity);
  #include <colorspace_fragment>
}`;

const PATH_VERT = /* glsl */`
attribute float aU;
attribute float aV;
attribute float aT;
varying float vU, vV, vT;
void main() { vU = aU; vV = aV; vT = aT; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const PATH_FRAG = /* glsl */`
uniform vec3 uColor, uCore;
uniform float uTime, uOpacity;
varying float vU, vV, vT;
void main() {
  float across = abs(vV * 2.0 - 1.0);
  float s = fract(vU * 1.25 - uTime * 0.9 - across * 0.32);
  float chev = smoothstep(0.0, 0.06, s) * (1.0 - smoothstep(0.2, 0.3, s)) * (1.0 - smoothstep(0.75, 1.0, across));
  float line = (1.0 - smoothstep(0.0, 0.9, across)) * 0.28;
  float ends = smoothstep(0.0, 0.08, vT) * (1.0 - smoothstep(0.9, 1.0, vT));
  float a = max(chev * 0.9, line) * ends * uOpacity;
  if (a < 0.003) discard;
  gl_FragColor = vec4(mix(uColor, uCore, chev * 0.6), a);
  #include <colorspace_fragment>
}`;

export function createMarkers(scene) {
  const group = new THREE.Group();
  group.name = 'markers';
  scene.add(group);
  const plane = new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2);

  const makeDisc = (style, color) => {
    const m = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(color) }, uTime: { value: 0 }, uOpacity: { value: 1 }, uStyle: { value: style }, uRadius: { value: 1 } },
      vertexShader: DISC_VERT, fragmentShader: DISC_FRAG, transparent: true, depthWrite: false, toneMapped: false,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4,
    });
    const mesh = new THREE.Mesh(plane, m);
    mesh.visible = false;
    mesh.renderOrder = 3;
    group.add(mesh);
    return mesh;
  };
  const range = makeDisc(0, '#8fe3ff');
  const target = makeDisc(1, '#ff7a3a');
  const OK = new THREE.Color('#8fe3ff'), BAD = new THREE.Color('#ff4b4b');

  const cellMat = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color('#ffffff') }, uTime: { value: 0 }, uOpacity: { value: 1 } },
    vertexShader: DISC_VERT, fragmentShader: CELL_FRAG, transparent: true, depthWrite: false, toneMapped: false,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4,
  });
  const cell = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), cellMat);
  cell.visible = false;
  cell.renderOrder = 3;
  group.add(cell);

  const pathMat = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color('#ff6a3d') }, uCore: { value: new THREE.Color('#fff0c8') }, uTime: { value: 0 }, uOpacity: { value: 0 } },
    vertexShader: PATH_VERT, fragmentShader: PATH_FRAG, transparent: true, depthWrite: false, toneMapped: false, side: THREE.DoubleSide,
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2,
  });
  const pathGroup = new THREE.Group();
  group.add(pathGroup);
  let pathFade = 0, pathGoal = 0;

  let time = 0;
  const api = {
    group,
    /** world 提供：toWorld(x,z,y,out)、groundHeight(x,z) */
    world: null,
    highlight(c, r, color) {
      if (c == null || color == null) { cell.visible = false; return; }
      const w = api.world;
      const y = w.groundHeight(c + 0.5, r + 0.5) + 0.02;
      w.toWorld(c + 0.5, r + 0.5, y, cell.position);
      cellMat.uniforms.uColor.value.set(color);
      cell.visible = true;
    },
    showRange(x, z, radius, ok = true) {
      const w = api.world;
      w.toWorld(x, z, 0.13, range.position);
      range.scale.set(radius, 1, radius);
      range.material.uniforms.uRadius.value = radius;
      range.material.uniforms.uColor.value.copy(ok ? OK : BAD);
      range.visible = true;
    },
    hideRange() { range.visible = false; },
    showTarget(x, z, radius) {
      const w = api.world;
      w.toWorld(x, z, 0.14, target.position);
      target.scale.set(radius, 1, radius);
      target.material.uniforms.uRadius.value = radius;
      target.visible = true;
    },
    hideTarget() { target.visible = false; },
    showPaths(paths) {
      for (const m of pathGroup.children) m.geometry.dispose();
      pathGroup.clear();
      if (!paths || !paths.length) { pathGoal = 0; return; }
      const w = api.world;
      for (const path of paths) {
        if (!path || path.length < 2) continue;
        const geo = ribbon(path, w);
        if (!geo) continue;
        const mesh = new THREE.Mesh(geo, pathMat);
        mesh.renderOrder = 2;
        mesh.frustumCulled = false;
        pathGroup.add(mesh);
      }
      pathGoal = 1;
    },
    update(dt) {
      time = (time + dt) % 1000;
      range.material.uniforms.uTime.value = time;
      target.material.uniforms.uTime.value = time;
      cellMat.uniforms.uTime.value = time;
      pathMat.uniforms.uTime.value = time;
      pathFade += (pathGoal - pathFade) * Math.min(1, dt * 6);
      pathMat.uniforms.uOpacity.value = pathFade;
      pathGroup.visible = pathFade > 0.01;
    },
    clear() {
      cell.visible = false; range.visible = false; target.visible = false;
      api.showPaths(null); pathFade = 0;
    },
  };
  return api;
}

// 路線 → 平滑的帶狀幾何（世界座標），u＝弧長、v＝橫向 0–1、t＝0–1
const _v = new THREE.Vector3();
function ribbon(path, w) {
  const pts = [];
  for (const p of path) pts.push(new THREE.Vector3(p.x, 0, p.z));
  // 去掉重複點
  const clean = [pts[0]];
  for (let i = 1; i < pts.length; i++) if (pts[i].distanceToSquared(clean[clean.length - 1]) > 1e-6) clean.push(pts[i]);
  if (clean.length < 2) return null;
  const curve = clean.length > 2 ? new THREE.CatmullRomCurve3(clean, false, 'centripetal', 0.5) : new THREE.LineCurve3(clean[0], clean[1]);
  let len = 0;
  for (let i = 1; i < clean.length; i++) len += clean[i].distanceTo(clean[i - 1]);
  const n = Math.max(2, Math.ceil(len / 0.1));
  const sp = curve.getSpacedPoints(n);
  const half = 0.2;
  const pos = new Float32Array((n + 1) * 2 * 3), aU = new Float32Array((n + 1) * 2), aV = new Float32Array((n + 1) * 2), aT = new Float32Array((n + 1) * 2);
  let u = 0;
  for (let i = 0; i <= n; i++) {
    const p = sp[i];
    if (i > 0) u += p.distanceTo(sp[i - 1]);
    const a = sp[Math.max(0, i - 1)], b = sp[Math.min(n, i + 1)];
    let tx = b.x - a.x, tz = b.z - a.z;
    const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
    const nx = -tz, nz = tx;
    const y = Math.max(0, w.groundHeight(p.x, p.z)) + 0.035;
    for (let s = 0; s < 2; s++) {
      const sg = s === 0 ? -1 : 1;
      w.toWorld(p.x + nx * half * sg, p.z + nz * half * sg, y, _v);
      const k = i * 2 + s;
      pos[k * 3] = _v.x; pos[k * 3 + 1] = _v.y; pos[k * 3 + 2] = _v.z;
      aU[k] = u; aV[k] = s; aT[k] = 0;
    }
  }
  for (let i = 0; i < aU.length; i++) aT[i] = aU[i] / Math.max(u, 1e-4);
  const idx = [];
  for (let i = 0; i < n; i++) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aU', new THREE.BufferAttribute(aU, 1));
  g.setAttribute('aV', new THREE.BufferAttribute(aV, 1));
  g.setAttribute('aT', new THREE.BufferAttribute(aT, 1));
  g.setIndex(idx);
  return g;
}
