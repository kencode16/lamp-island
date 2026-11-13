// 特效（擁有者：C）：吃 架構.md §5 的事件（座標是格子空間），全部用物件池／InstancedMesh／Points，事件發生時不 new 物件。
// 介面：createEffects(world) → fx；fx.handle(event)、fx.update(dt, state?)、fx.setState(state)、fx.clear()。
// 傳 state（game.state，原地更新的那個物件）後，fx 會自己畫持續狀態：護盾泡泡、冰凍、定身、暈眩星星、緩速圈、
// 燃燒火苗、被熄光的塔、火焰／荊棘／流星標記地帶。詳見 js/render/README.md。
import * as THREE from 'three';
import * as ENEMY_DATA from '../data/enemies.js';
import * as HERO_DATA from '../data/heroes.js';
import { DK_GLSL_SAMPLE } from './env/darkness.js';

const TAU = Math.PI * 2;
const C = (h) => new THREE.Color(h);
const COL = {
  white: C('#ffffff'), warm: C('#fff1c8'),
  spark: C('#ffe0a0'), sparkEnd: C('#ff7a2a'),
  magic: C('#e0a8ff'), magicEnd: C('#6a6cff'),
  frost: C('#d8f8ff'), frostEnd: C('#4aa8ff'),
  fire: C('#ffd25a'), fireEnd: C('#ff3a10'), ember: C('#ff8a2a'),
  smoke: C('#9c948c'), smokeEnd: C('#5a5652'), smokeDark: C('#3a3438'),
  dust: C('#d6c09a'), dustEnd: C('#a89070'),
  gold: C('#ffe066'), goldEnd: C('#ffa020'),
  leaf: C('#9ae86a'), leafEnd: C('#3a8a30'), thorn: C('#2f6a2a'), root: C('#8a5a32'), rootEnd: C('#5a3a20'),
  purple: C('#c07aff'), purpleEnd: C('#4a1880'), dark: C('#2a1638'), darkEnd: C('#120818'),
  red: C('#ff5a4a'), redEnd: C('#a01010'),
  bolt: C('#7ff6ff'), boltCore: C('#ffffff'), lightning: C('#fff07a'),
  goo: C('#9ae860'), gooEnd: C('#3a9a30'),
  heal: C('#b0ffd0'), holy: C('#fff2b0'), holyEnd: C('#ffb84a'),
  ice: C('#bfefff'), orange: C('#ff9a3a'), blue: C('#7fc8ff'),
  // v2.0 第二章＋英雄
  fairy: C('#a8ffc8'), fairyEnd: C('#2fbf9a'), fairyPink: C('#ffb6f2'), fairyCore: C('#f4fff0'),
  star: C('#fff4b8'), starEnd: C('#ffbe3a'),
  pink: C('#ffb3dc'), pinkEnd: C('#d0609e'), pollen: C('#fff07a'),
  fireCore: C('#fff0b0'), lava: C('#ff6a1a'),
  ink: C('#2c1a3c'), inkEnd: C('#0c0612'), inkSplat: C('#1a0e24'),
  dirt: C('#8a6a48'), dirtEnd: C('#4c3826'), dirtDark: C('#3a2a1c'),
  ghost: C('#d6f8ff'), ghostEnd: C('#4aa6d0'),
  worm: C('#a050c8'), wormEnd: C('#2a0c3a'), wormGoo: C('#7ae05a'),
  prism: C('#9fe8ff'), prismA: C('#7ff6ff'), prismB: C('#ff86ea'), prismC: C('#ffe27a'), focus: C('#c8fbff'),
  lantern: C('#ffc46a'), lanternEnd: C('#ff7a2a'), crystalGlow: C('#a88cff'),
};
const rand = Math.random;
const BIG_BURROWERS = new Set(['abyssWorm', 'moleKing']);
const _c = new THREE.Color();
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3();
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);

// ============================================================================ 貼圖
function makeAtlas() {
  // 4 格：0 圓環、1 柔光圓盤、2 焦痕、3 法陣環
  const T = 128, cv = document.createElement('canvas');
  cv.width = T * 4; cv.height = T;
  const g = cv.getContext('2d');
  const cx = T / 2, R = T / 2 - 4;
  // 0 圓環
  let grd = g.createRadialGradient(cx, cx, 0, cx, cx, R);
  grd.addColorStop(0, 'rgba(255,255,255,0.0)'); grd.addColorStop(0.55, 'rgba(255,255,255,0.06)');
  grd.addColorStop(0.82, 'rgba(255,255,255,0.55)'); grd.addColorStop(0.92, 'rgba(255,255,255,1)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, T, T);
  // 1 柔光
  grd = g.createRadialGradient(T + cx, cx, 0, T + cx, cx, R);
  grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.35, 'rgba(255,255,255,0.5)');
  grd.addColorStop(0.7, 'rgba(255,255,255,0.12)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(T, 0, T, T);
  // 2 焦痕（深色、邊緣不規則）
  for (let i = 0; i < 26; i++) {
    const a = rand() * TAU, d = rand() * R * 0.55, r = R * (0.22 + rand() * 0.3);
    const x = 2 * T + cx + Math.cos(a) * d, y = cx + Math.sin(a) * d;
    grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, 'rgba(28,20,16,0.35)'); grd.addColorStop(1, 'rgba(28,20,16,0)');
    g.fillStyle = grd; g.fillRect(2 * T, 0, T, T);
  }
  // 3 法陣環
  g.save(); g.translate(3 * T + cx, cx);
  g.strokeStyle = 'rgba(255,255,255,1)';
  g.lineWidth = 5; g.beginPath(); g.arc(0, 0, R - 4, 0, TAU); g.stroke();
  g.lineWidth = 2.5; g.beginPath(); g.arc(0, 0, R * 0.72, 0, TAU); g.stroke();
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * TAU;
    g.beginPath(); g.moveTo(Math.cos(a) * R * 0.74, Math.sin(a) * R * 0.74); g.lineTo(Math.cos(a) * (R - 6), Math.sin(a) * (R - 6)); g.stroke();
  }
  g.restore();
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.generateMipmaps = false;
  tex.minFilter = THREE.LinearFilter;
  return tex;
}

// ============================================================================ 平面貼片（地面圓環、光盤、焦痕）
const QUAD_VERT = /* glsl */`
attribute float aAlpha;
attribute float aTile;
varying vec2 vUv;
varying vec3 vCol;
varying float vA;
void main() {
  vUv = vec2((uv.x + aTile) * 0.25, uv.y);
  #ifdef USE_INSTANCING_COLOR
  vCol = instanceColor;
  #else
  vCol = vec3(1.0);
  #endif
  vA = aAlpha;
  gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0);
}`;
const QUAD_FRAG = /* glsl */`
uniform sampler2D uMap;
varying vec2 vUv;
varying vec3 vCol;
varying float vA;
void main() {
  vec4 t = texture2D(uMap, vUv);
  float a = t.a * vA;
  if (a < 0.004) discard;
  gl_FragColor = vec4(vCol * t.rgb, a);
  #include <colorspace_fragment>
}`;

function makeQuadMesh(root, max, additive, tex, renderOrder) {
  const geo = new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2);
  const aAlpha = new THREE.InstancedBufferAttribute(new Float32Array(max), 1);
  const aTile = new THREE.InstancedBufferAttribute(new Float32Array(max), 1);
  aAlpha.setUsage(THREE.DynamicDrawUsage); aTile.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('aAlpha', aAlpha);
  geo.setAttribute('aTile', aTile);
  const mat = new THREE.ShaderMaterial({
    uniforms: { uMap: { value: tex } }, vertexShader: QUAD_VERT, fragmentShader: QUAD_FRAG,
    transparent: true, depthWrite: false, toneMapped: false, side: THREE.DoubleSide,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4,
  });
  const mesh = new THREE.InstancedMesh(geo, mat, max);
  mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false;
  mesh.renderOrder = renderOrder;
  mesh.count = 0;
  root.add(mesh);
  return { mesh, aAlpha, aTile, max };
}

/** 有壽命的地面貼片 */
class EventQuads {
  constructor(root, max, additive, tex, renderOrder = 4) {
    Object.assign(this, makeQuadMesh(root, max, additive, tex, renderOrder));
    this.d = new Float32Array(max * 16); // x y z r0 r1 life max tile a0 spin rot ease fade delay r g b → 用 16 欄
    this.cr = new Float32Array(max * 3);
    this.cursor = 0;
    this.live = 0;
  }
  /** ease：0 線性、1 先快後慢；fade：0 漸隱、1 維持到最後 25% 才淡出、2 淡入淡出 */
  emit(x, y, z, r0, r1, life, color, alpha = 1, tile = 0, ease = 1, fade = 0, spin = 0, delay = 0) {
    const i = this.cursor; this.cursor = (i + 1) % this.max;
    const o = i * 16, d = this.d;
    d[o] = x; d[o + 1] = y; d[o + 2] = z; d[o + 3] = r0; d[o + 4] = r1; d[o + 5] = life; d[o + 6] = life;
    d[o + 7] = tile; d[o + 8] = alpha; d[o + 9] = spin; d[o + 10] = rand() * TAU; d[o + 11] = ease; d[o + 12] = fade; d[o + 13] = delay;
    this.cr[i * 3] = color.r; this.cr[i * 3 + 1] = color.g; this.cr[i * 3 + 2] = color.b;
    this.live = Math.max(this.live, 1);
  }
  update(dt) {
    if (!this.live) { this.mesh.count = 0; this.mesh.visible = false; return; }
    this.mesh.visible = true;
    const d = this.d;
    let top = 0, live = 0;
    for (let i = 0; i < this.max; i++) {
      const o = i * 16;
      if (d[o + 5] <= 0) { this.aAlpha.array[i] = 0; continue; }
      if (d[o + 13] > 0) { d[o + 13] -= dt; this.aAlpha.array[i] = 0; top = i + 1; live++; continue; }
      d[o + 5] -= dt;
      const t = Math.min(1, 1 - d[o + 5] / d[o + 6]);
      const e = d[o + 11] > 0.5 ? 1 - Math.pow(1 - t, 3) : t;
      const r = d[o + 3] + (d[o + 4] - d[o + 3]) * e;
      d[o + 10] += d[o + 9] * dt;
      let a;
      const f = d[o + 12];
      if (f < 0.5) a = Math.pow(1 - t, 1.4);
      else if (f < 1.5) a = t < 0.75 ? 1 : (1 - t) / 0.25;
      else a = Math.sin(t * Math.PI);
      this.aAlpha.array[i] = d[o + 5] > 0 ? a * d[o + 8] : 0;
      this.aTile.array[i] = d[o + 7];
      _q.setFromAxisAngle(_up, d[o + 10]);
      _m.compose(_v.set(d[o], d[o + 1], d[o + 2]), _q, _s.set(r, 1, r));
      this.mesh.setMatrixAt(i, _m);
      _c.setRGB(this.cr[i * 3], this.cr[i * 3 + 1], this.cr[i * 3 + 2]);
      this.mesh.setColorAt(i, _c);
      top = i + 1; live++;
    }
    this.live = live;
    this.mesh.count = top;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.instanceColor.needsUpdate = true;
    this.aAlpha.needsUpdate = true; this.aTile.needsUpdate = true;
  }
  clear() { for (let i = 0; i < this.max; i++) this.d[i * 16 + 5] = 0; this.live = 0; this.mesh.count = 0; }
}

/** 每幀重畫的地面貼片（持續狀態、地帶） */
class FrameQuads {
  constructor(root, max, additive, tex, renderOrder = 4) {
    Object.assign(this, makeQuadMesh(root, max, additive, tex, renderOrder));
    this.n = 0;
  }
  begin() { this.n = 0; }
  add(x, y, z, r, rot, color, alpha, tile) {
    if (this.n >= this.max) return;
    const i = this.n++;
    _q.setFromAxisAngle(_up, rot);
    _m.compose(_v.set(x, y, z), _q, _s.set(r, 1, r));
    this.mesh.setMatrixAt(i, _m);
    this.mesh.setColorAt(i, color);
    this.aAlpha.array[i] = alpha;
    this.aTile.array[i] = tile;
  }
  end() {
    this.mesh.count = this.n;
    this.mesh.visible = this.n > 0;
    if (this.n) {
      this.mesh.instanceMatrix.needsUpdate = true;
      this.mesh.instanceColor.needsUpdate = true;
      this.aAlpha.needsUpdate = true; this.aTile.needsUpdate = true;
    }
  }
}

// ============================================================================ 粒子（Points，CPU 更新）
const PART_VERT = /* glsl */`
attribute float aSize;
attribute vec4 aColor;
uniform float uScale;
varying vec4 vColor;
#ifdef DK_DIM
${DK_GLSL_SAMPLE}
#endif
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * uScale / max(0.1, -mv.z);
  vColor = aColor;
  #ifdef DK_DIM
  // 第二章黑暗：一般混合的粒子（煙、碎屑）在暗處跟著變暗；第一章 uDkOn = 0 不變
  if (uDkOn > 0.0) {
    vec4 L = dkLit((modelMatrix * vec4(position, 1.0)).xz);
    vColor.rgb *= mix(1.0, 0.16 + 0.84 * L.r, uDkOn);
  }
  #endif
  gl_Position = projectionMatrix * mv;
}`;
const PART_FRAG = /* glsl */`
varying vec4 vColor;
uniform float uHard;
void main() {
  vec2 p = gl_PointCoord * 2.0 - 1.0;
  float d = dot(p, p);
  if (d > 1.0) discard;
  float a;
  if (uHard > 1.5) {
    // 四角星芒（星塵、妖精光點、聖光）
    vec2 q = abs(p);
    float cross = max(0.0, 1.0 - q.x * 7.0) * max(0.0, 1.0 - q.y) + max(0.0, 1.0 - q.y * 7.0) * max(0.0, 1.0 - q.x);
    a = clamp(cross * 1.2 + pow(max(0.0, 1.0 - d * 3.5), 2.0), 0.0, 1.0);
  } else a = mix(pow(1.0 - d, 1.6), smoothstep(1.0, 0.55, d), uHard);
  gl_FragColor = vec4(vColor.rgb, vColor.a * a);
  #include <colorspace_fragment>
}`;

class Particles {
  constructor(root, max, additive, renderOrder, hard = 0, dk = null) {
    this.max = max; this.cursor = 0; this.live = 0;
    this.pos = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max).fill(1);
    this.s0 = new Float32Array(max); this.s1 = new Float32Array(max);
    this.c0 = new Float32Array(max * 3); this.c1 = new Float32Array(max * 3);
    this.a0 = new Float32Array(max);
    this.grav = new Float32Array(max); this.drag = new Float32Array(max);
    this.floor = new Float32Array(max).fill(-99);
    this.size = new Float32Array(max);
    this.rgba = new Float32Array(max * 4);
    const g = new THREE.BufferGeometry();
    this.aPos = new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
    this.aSize = new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage);
    this.aCol = new THREE.BufferAttribute(this.rgba, 4).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.aPos);
    g.setAttribute('aSize', this.aSize);
    g.setAttribute('aColor', this.aCol);
    this.uniforms = { uScale: { value: 800 }, uHard: { value: hard } };
    if (dk) for (const k of Object.keys(dk)) this.uniforms[k] = dk[k];
    this.points = new THREE.Points(g, new THREE.ShaderMaterial({
      uniforms: this.uniforms, vertexShader: PART_VERT, fragmentShader: PART_FRAG, defines: dk ? { DK_DIM: '' } : {},
      transparent: true, depthWrite: false, toneMapped: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    }));
    this.points.frustumCulled = false;
    this.points.renderOrder = renderOrder;
    root.add(this.points);
    this.dirty = false;
  }
  emit(x, y, z, vx, vy, vz, life, s0, s1, c0, c1, a0 = 1, grav = 0, drag = 0, floorY = -99) {
    const i = this.cursor; this.cursor = (i + 1) % this.max;
    const i3 = i * 3;
    this.pos[i3] = x; this.pos[i3 + 1] = y; this.pos[i3 + 2] = z;
    this.vel[i3] = vx; this.vel[i3 + 1] = vy; this.vel[i3 + 2] = vz;
    this.life[i] = life; this.maxLife[i] = life;
    this.s0[i] = s0; this.s1[i] = s1;
    this.c0[i3] = c0.r; this.c0[i3 + 1] = c0.g; this.c0[i3 + 2] = c0.b;
    this.c1[i3] = c1.r; this.c1[i3 + 1] = c1.g; this.c1[i3 + 2] = c1.b;
    this.a0[i] = a0; this.grav[i] = grav; this.drag[i] = drag; this.floor[i] = floorY;
    this.live++;
  }
  update(dt) {
    if (this.live <= 0 && !this.dirty) { this.points.visible = false; return; }
    let live = 0;
    const P = this.pos, V = this.vel;
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      const i3 = i * 3, i4 = i * 4;
      if (this.life[i] <= 0) { this.size[i] = 0; this.rgba[i4 + 3] = 0; continue; }
      live++;
      const t = 1 - this.life[i] / this.maxLife[i];
      const f = Math.max(0, 1 - this.drag[i] * dt);
      V[i3] *= f; V[i3 + 1] = V[i3 + 1] * f - this.grav[i] * dt; V[i3 + 2] *= f;
      P[i3] += V[i3] * dt; P[i3 + 1] += V[i3 + 1] * dt; P[i3 + 2] += V[i3 + 2] * dt;
      if (P[i3 + 1] < this.floor[i]) { P[i3 + 1] = this.floor[i]; V[i3 + 1] *= -0.3; V[i3] *= 0.6; V[i3 + 2] *= 0.6; }
      this.size[i] = this.s0[i] + (this.s1[i] - this.s0[i]) * t;
      this.rgba[i4] = this.c0[i3] + (this.c1[i3] - this.c0[i3]) * t;
      this.rgba[i4 + 1] = this.c0[i3 + 1] + (this.c1[i3 + 1] - this.c0[i3 + 1]) * t;
      this.rgba[i4 + 2] = this.c0[i3 + 2] + (this.c1[i3 + 2] - this.c0[i3 + 2]) * t;
      this.rgba[i4 + 3] = this.a0[i] * Math.min(1, t * 12) * (1 - t);
    }
    this.dirty = live > 0 || this.live > 0;
    this.live = live;
    this.points.visible = live > 0;   // 沒有粒子時不畫（省 draw call）
    this.aPos.needsUpdate = true; this.aSize.needsUpdate = true; this.aCol.needsUpdate = true;
  }
  clear() { this.life.fill(0); this.size.fill(0); this.live = 0; this.dirty = true; }
}

/** 隨機方向的一團粒子。up：0＝球狀、1＝往上 */
function burst(P, x, y, z, n, spd, up, life, s0, s1, c0, c1, a0, grav = 0, drag = 0, floorY = -99, jit = 0) {
  for (let i = 0; i < n; i++) {
    const th = rand() * TAU;
    let dy = 1 - 2 * rand();
    dy = dy * (1 - up) + Math.abs(dy) * up + up * 0.35;
    const rr = Math.sqrt(Math.max(0, 1 - Math.min(1, dy * dy)));
    const s = spd * (0.45 + 0.55 * rand());
    P.emit(x + (rand() - 0.5) * jit, y + (rand() - 0.5) * jit * 0.5, z + (rand() - 0.5) * jit,
      Math.cos(th) * rr * s, dy * s, Math.sin(th) * rr * s,
      life * (0.7 + 0.6 * rand()), s0 * (0.8 + 0.4 * rand()), s1, c0, c1, a0, grav, drag, floorY);
  }
}
/** 水平一圈往外的粒子 */
function ringBurst(P, x, y, z, n, r, spd, life, s0, s1, c0, c1, a0, grav = 0, drag = 0, vy = 0) {
  for (let i = 0; i < n; i++) {
    const th = (i / n) * TAU + rand() * 0.3;
    const cx = Math.cos(th), cz = Math.sin(th);
    const s = spd * (0.7 + 0.5 * rand());
    P.emit(x + cx * r, y, z + cz * r, cx * s, vy * (0.6 + 0.8 * rand()), cz * s, life * (0.75 + 0.5 * rand()), s0, s1, c0, c1, a0, grav, drag, y - 0.05);
  }
}

// ============================================================================ 碎石
class Debris {
  constructor(root, max) {
    this.max = max; this.cursor = 0; this.live = 0;
    this.mesh = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), new THREE.MeshLambertMaterial({ flatShading: true }), max);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    root.add(this.mesh);
    this.d = new Float32Array(max * 14); // px py pz vx vy vz rx ry rz wx wy wz life size
    this.maxLife = new Float32Array(max);
    this.floorY = new Float32Array(max);
  }
  emit(x, y, z, vx, vy, vz, size, color, life = 1.4, floorY = 0) {
    const i = this.cursor; this.cursor = (i + 1) % this.max;
    const o = i * 14, d = this.d;
    d[o] = x; d[o + 1] = y; d[o + 2] = z; d[o + 3] = vx; d[o + 4] = vy; d[o + 5] = vz;
    d[o + 6] = rand() * TAU; d[o + 7] = rand() * TAU; d[o + 8] = rand() * TAU;
    d[o + 9] = (rand() - 0.5) * 14; d[o + 10] = (rand() - 0.5) * 14; d[o + 11] = (rand() - 0.5) * 14;
    d[o + 12] = life; d[o + 13] = size;
    this.maxLife[i] = life; this.floorY[i] = floorY;
    _c.copy(color).multiplyScalar(0.85 + rand() * 0.3);
    this.mesh.setColorAt(i, _c);
    this.mesh.instanceColor.needsUpdate = true;
    this.live = 1;
  }
  update(dt) {
    if (!this.live) { this.mesh.count = 0; this.mesh.visible = false; return; }
    this.mesh.visible = true;
    const d = this.d;
    let top = 0, live = 0;
    for (let i = 0; i < this.max; i++) {
      const o = i * 14;
      if (d[o + 12] <= 0) { _m.makeScale(0, 0, 0); this.mesh.setMatrixAt(i, _m); continue; }
      d[o + 12] -= dt;
      d[o + 4] -= 9.8 * dt;
      d[o] += d[o + 3] * dt; d[o + 1] += d[o + 4] * dt; d[o + 2] += d[o + 5] * dt;
      const fy = this.floorY[i] + d[o + 13] * 0.6;
      if (d[o + 1] < fy) {
        d[o + 1] = fy; d[o + 4] = Math.abs(d[o + 4]) * 0.32; d[o + 3] *= 0.55; d[o + 5] *= 0.55;
        d[o + 9] *= 0.5; d[o + 10] *= 0.5; d[o + 11] *= 0.5;
      }
      d[o + 6] += d[o + 9] * dt; d[o + 7] += d[o + 10] * dt; d[o + 8] += d[o + 11] * dt;
      const t = 1 - d[o + 12] / this.maxLife[i];
      const s = d[o + 13] * (t > 0.7 ? (1 - t) / 0.3 : 1);
      _e.set(d[o + 6], d[o + 7], d[o + 8]); _q.setFromEuler(_e);
      _m.compose(_v.set(d[o], d[o + 1], d[o + 2]), _q, _s.set(s, s * 0.8, s));
      this.mesh.setMatrixAt(i, _m);
      top = i + 1; live++;
    }
    this.live = live;
    this.mesh.count = top;
    this.mesh.instanceMatrix.needsUpdate = true;
  }
  clear() { for (let i = 0; i < this.max; i++) this.d[i * 14 + 12] = 0; this.live = 0; this.mesh.count = 0; }
}

// ============================================================================ 從地面冒出的尖刺（藤蔓／荊棘／樹根）
class Spikes {
  constructor(root, max) {
    this.max = max; this.cursor = 0; this.live = 0;
    const geo = new THREE.ConeGeometry(1, 1, 5).translate(0, 0.5, 0);
    this.mesh = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ flatShading: true }), max);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = false;
    this.mesh.count = 0;
    root.add(this.mesh);
    this.d = new Float32Array(max * 10); // x y z h r tx tz ry life delay
    this.maxLife = new Float32Array(max);
  }
  emit(x, y, z, h, r, color, life = 0.8, delay = 0, tilt = 0.35) {
    const i = this.cursor; this.cursor = (i + 1) % this.max;
    const o = i * 10, d = this.d;
    d[o] = x; d[o + 1] = y; d[o + 2] = z; d[o + 3] = h; d[o + 4] = r;
    d[o + 5] = (rand() - 0.5) * tilt * 2; d[o + 6] = (rand() - 0.5) * tilt * 2; d[o + 7] = rand() * TAU;
    d[o + 8] = life; d[o + 9] = delay; this.maxLife[i] = life;
    _c.copy(color).multiplyScalar(0.85 + rand() * 0.3);
    this.mesh.setColorAt(i, _c);
    this.mesh.instanceColor.needsUpdate = true;
    this.live = 1;
  }
  update(dt) {
    if (!this.live) { this.mesh.count = 0; this.mesh.visible = false; return; }
    this.mesh.visible = true;
    const d = this.d;
    let top = 0, live = 0;
    for (let i = 0; i < this.max; i++) {
      const o = i * 10;
      if (d[o + 8] <= 0) { _m.makeScale(0, 0, 0); this.mesh.setMatrixAt(i, _m); continue; }
      top = i + 1; live++;
      if (d[o + 9] > 0) { d[o + 9] -= dt; _m.makeScale(0, 0, 0); this.mesh.setMatrixAt(i, _m); continue; }
      d[o + 8] -= dt;
      const age = this.maxLife[i] - d[o + 8];
      let k = Math.min(1, age / 0.13);
      k = 1 + 1.7 * Math.pow(k - 1, 3) + 0.7 * Math.pow(k - 1, 2); // ease-out-back
      if (d[o + 8] < 0.25) k *= Math.max(0, d[o + 8] / 0.25);
      _e.set(d[o + 5], d[o + 7], d[o + 6]); _q.setFromEuler(_e);
      _m.compose(_v.set(d[o], d[o + 1], d[o + 2]), _q, _s.set(d[o + 4], d[o + 3] * Math.max(0, k), d[o + 4]));
      this.mesh.setMatrixAt(i, _m);
    }
    this.live = live;
    this.mesh.count = top;
    this.mesh.instanceMatrix.needsUpdate = true;
  }
  clear() { for (let i = 0; i < this.max; i++) this.d[i * 10 + 8] = 0; this.live = 0; this.mesh.count = 0; }
}

// ============================================================================ 閃電鏈（面向鏡頭的帶狀）
const BOLT_VERT = /* glsl */`
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0); }`;
const BOLT_FRAG = /* glsl */`
uniform vec3 uColor, uCore;
uniform float uAlpha;
varying vec2 vUv;
void main() {
  float a = 1.0 - abs(vUv.y * 2.0 - 1.0);
  float core = smoothstep(0.55, 0.95, a);
  vec3 c = mix(uColor, uCore, core) * (a * a * 1.6) * uAlpha;
  gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>
}`;
class Bolts {
  constructor(root, n = 6, maxPts = 48) {
    this.maxPts = maxPts;
    this.slots = [];
    const idx = [];
    for (let i = 0; i < maxPts - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    for (let k = 0; k < n; k++) {
      const g = new THREE.BufferGeometry();
      const pos = new THREE.BufferAttribute(new Float32Array(maxPts * 2 * 3), 3).setUsage(THREE.DynamicDrawUsage);
      const uv = new Float32Array(maxPts * 2 * 2);
      for (let i = 0; i < maxPts; i++) { uv[i * 4] = i / (maxPts - 1); uv[i * 4 + 1] = 0; uv[i * 4 + 2] = i / (maxPts - 1); uv[i * 4 + 3] = 1; }
      g.setAttribute('position', pos);
      g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      g.setIndex(idx);
      const mat = new THREE.ShaderMaterial({
        uniforms: { uColor: { value: COL.bolt.clone() }, uCore: { value: COL.boltCore.clone() }, uAlpha: { value: 1 } },
        vertexShader: BOLT_VERT, fragmentShader: BOLT_FRAG, transparent: true, depthWrite: false,
        blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false,
      });
      const mesh = new THREE.Mesh(g, mat);
      mesh.frustumCulled = false; mesh.visible = false; mesh.renderOrder = 8;
      root.add(mesh);
      this.slots.push({ mesh, pos, base: new Float32Array(16 * 3), nBase: 0, pts: new Float32Array(maxPts * 3), nPts: 0, life: 0, max: 1, rejit: 0, width: 0.14 });
    }
    this.cursor = 0;
  }
  emit(points, color, life = 0.28, width = 0.14) {
    const s = this.slots[this.cursor]; this.cursor = (this.cursor + 1) % this.slots.length;
    const n = Math.min(points.length, 16, Math.floor((this.maxPts - 1) / 4) + 1);
    for (let i = 0; i < n; i++) { s.base[i * 3] = points[i].x; s.base[i * 3 + 1] = points[i].y; s.base[i * 3 + 2] = points[i].z; }
    s.nBase = n; s.life = life; s.max = life; s.rejit = 0; s.width = width;
    s.mesh.material.uniforms.uColor.value.copy(color || COL.bolt);
    s.mesh.visible = n >= 2;
  }
  jitter(s) {
    const SUB = 4;
    let k = 0;
    const b = s.base;
    for (let i = 0; i < s.nBase - 1; i++) {
      const ax = b[i * 3], ay = b[i * 3 + 1], az = b[i * 3 + 2], bx = b[i * 3 + 3], by = b[i * 3 + 4], bz = b[i * 3 + 5];
      const len = Math.hypot(bx - ax, by - ay, bz - az);
      const amp = Math.min(0.28, 0.1 + len * 0.06);
      for (let j = 0; j < SUB; j++) {
        const t = j / SUB;
        const off = j === 0 ? 0 : amp;
        s.pts[k * 3] = ax + (bx - ax) * t + (rand() - 0.5) * off;
        s.pts[k * 3 + 1] = ay + (by - ay) * t + (rand() - 0.5) * off;
        s.pts[k * 3 + 2] = az + (bz - az) * t + (rand() - 0.5) * off;
        k++;
      }
    }
    const l = s.nBase - 1;
    s.pts[k * 3] = b[l * 3]; s.pts[k * 3 + 1] = b[l * 3 + 1]; s.pts[k * 3 + 2] = b[l * 3 + 2];
    s.nPts = k + 1;
  }
  update(dt, camera) {
    for (const s of this.slots) {
      if (s.life <= 0) { s.mesh.visible = false; continue; }
      s.life -= dt; s.rejit -= dt;
      if (s.life <= 0) { s.mesh.visible = false; continue; }
      if (s.rejit <= 0) { this.jitter(s); s.rejit = 0.05; }
      const t = 1 - s.life / s.max;
      s.mesh.material.uniforms.uAlpha.value = (1 - t) * (0.75 + 0.25 * rand());
      const P = s.pts, arr = s.pos.array, n = s.nPts;
      for (let i = 0; i < this.maxPts; i++) {
        const j = Math.min(i, n - 1);
        const a = Math.max(0, j - 1), b = Math.min(n - 1, j + 1);
        _v.set(P[b * 3] - P[a * 3], P[b * 3 + 1] - P[a * 3 + 1], P[b * 3 + 2] - P[a * 3 + 2]);
        _v2.set(camera.position.x - P[j * 3], camera.position.y - P[j * 3 + 1], camera.position.z - P[j * 3 + 2]);
        _v3.crossVectors(_v, _v2).normalize().multiplyScalar(s.width * 0.5);
        arr[i * 6] = P[j * 3] - _v3.x; arr[i * 6 + 1] = P[j * 3 + 1] - _v3.y; arr[i * 6 + 2] = P[j * 3 + 2] - _v3.z;
        arr[i * 6 + 3] = P[j * 3] + _v3.x; arr[i * 6 + 4] = P[j * 3 + 1] + _v3.y; arr[i * 6 + 5] = P[j * 3 + 2] + _v3.z;
      }
      s.pos.needsUpdate = true;
      s.mesh.geometry.setDrawRange(0, (n - 1) * 6);
    }
  }
  clear() { for (const s of this.slots) { s.life = 0; s.mesh.visible = false; } }
}

// ============================================================================ 飄字（canvas 貼圖的 Sprite）
class Texts {
  constructor(root, n = 24) {
    this.slots = [];
    for (let i = 0; i < n; i++) {
      const cv = document.createElement('canvas'); cv.width = 256; cv.height = 96;
      const tex = new THREE.CanvasTexture(cv);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.generateMipmaps = false; tex.minFilter = THREE.LinearFilter;
      const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false, toneMapped: false });
      const sp = new THREE.Sprite(mat);
      sp.visible = false; sp.renderOrder = 40;
      sp.center.set(0.5, 0.2);
      root.add(sp);
      this.slots.push({ sp, cv, ctx: cv.getContext('2d'), tex, life: 0, max: 1, x: 0, y: 0, z: 0, px: 30, w: 2.6 });
    }
    this.cursor = 0;
  }
  /** style：'gold'（金幣圖示＋黃字）、'level'（金色大字）、'red'、'plain' */
  emit(text, x, y, z, style = 'gold', life = 1.15) {
    const s = this.slots[this.cursor]; this.cursor = (this.cursor + 1) % this.slots.length;
    const g = s.ctx;
    g.clearRect(0, 0, 256, 96);
    g.font = 'bold 60px -apple-system, "PingFang TC", "Heiti TC", "Microsoft JhengHei", "Noto Sans TC", sans-serif';
    g.textBaseline = 'middle';
    g.lineJoin = 'round';
    const fill = style === 'red' ? '#ff6a5a' : style === 'plain' ? '#ffffff' : '#ffe15a';
    const tw = g.measureText(text).width;
    const icon = style === 'gold';
    const total = tw + (icon ? 58 : 0);
    let x0 = Math.max(4, (256 - total) / 2);
    if (icon) {
      const cx = x0 + 24, cy = 48;
      g.fillStyle = '#7a4a10'; g.beginPath(); g.arc(cx, cy + 2, 23, 0, TAU); g.fill();
      g.fillStyle = '#ffc93a'; g.beginPath(); g.arc(cx, cy, 21, 0, TAU); g.fill();
      g.fillStyle = '#ffe98a'; g.beginPath(); g.arc(cx - 2, cy - 2, 13, 0, TAU); g.fill();
      g.fillStyle = '#e8a020'; g.font = 'bold 26px sans-serif'; g.textAlign = 'center'; g.fillText('$', cx, cy + 1);
      g.font = 'bold 60px -apple-system, "PingFang TC", "Heiti TC", "Microsoft JhengHei", "Noto Sans TC", sans-serif';
      x0 += 58;
    }
    g.textAlign = 'left';
    g.lineWidth = 10; g.strokeStyle = 'rgba(40,22,8,0.92)'; g.strokeText(text, x0, 50);
    g.fillStyle = fill; g.fillText(text, x0, 50);
    s.tex.needsUpdate = true;
    s.life = life; s.max = life; s.x = x; s.y = y; s.z = z;
    s.px = style === 'level' ? 40 : 30;
    s.sp.visible = true;
  }
  update(dt, camera, viewH) {
    const tanH = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    for (const s of this.slots) {
      if (s.life <= 0) continue;
      s.life -= dt;
      if (s.life <= 0) { s.sp.visible = false; continue; }
      const t = 1 - s.life / s.max;
      const rise = 1 - Math.pow(1 - t, 2.2);
      s.sp.position.set(s.x, s.y + rise * 0.85, s.z);
      const dist = camera.position.distanceTo(s.sp.position);
      const h = s.px / Math.max(200, viewH) * 2 * dist * tanH * (t < 0.12 ? 0.6 + t / 0.12 * 0.4 : 1);
      s.sp.scale.set(h * 256 / 96, h, 1);
      s.sp.material.opacity = t > 0.65 ? (1 - t) / 0.35 : 1;
    }
  }
  clear() { for (const s of this.slots) { s.life = 0; s.sp.visible = false; } }
}

// ============================================================================ 光柱
const PILLAR_FRAG = /* glsl */`
uniform vec3 uColor;
uniform float uAlpha, uTime;
varying vec2 vUv;
void main() {
  float fade = pow(1.0 - vUv.y, 1.6);
  float stripes = 0.65 + 0.35 * sin(vUv.y * 22.0 - uTime * 9.0 + vUv.x * 6.2831 * 4.0);
  gl_FragColor = vec4(uColor * fade * stripes * uAlpha, 1.0);
  #include <colorspace_fragment>
}`;
class Pillars {
  constructor(root, n = 4) {
    const geo = new THREE.CylinderGeometry(1, 1, 1, 24, 1, true).translate(0, 0.5, 0);
    this.slots = [];
    for (let i = 0; i < n; i++) {
      const mat = new THREE.ShaderMaterial({
        uniforms: { uColor: { value: new THREE.Color() }, uAlpha: { value: 0 }, uTime: { value: 0 } },
        vertexShader: BOLT_VERT.replace('viewMatrix * vec4', 'modelViewMatrix * vec4'), fragmentShader: PILLAR_FRAG,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.visible = false; mesh.renderOrder = 7; mesh.frustumCulled = false;
      root.add(mesh);
      this.slots.push({ mesh, life: 0, max: 1, r: 0.5, h: 2 });
    }
    this.cursor = 0;
  }
  emit(x, y, z, r, h, color, life = 1.1) {
    const s = this.slots[this.cursor]; this.cursor = (this.cursor + 1) % this.slots.length;
    s.mesh.position.set(x, y, z);
    s.mesh.material.uniforms.uColor.value.copy(color);
    s.life = life; s.max = life; s.r = r; s.h = h;
    s.mesh.visible = true;
  }
  update(dt) {
    for (const s of this.slots) {
      if (s.life <= 0) continue;
      s.life -= dt;
      if (s.life <= 0) { s.mesh.visible = false; continue; }
      const t = 1 - s.life / s.max;
      const u = s.mesh.material.uniforms;
      u.uTime.value += dt;
      u.uAlpha.value = Math.min(1, t * 8) * (t > 0.6 ? (1 - t) / 0.4 : 1);
      const rr = s.r * (t < 0.15 ? 0.4 + t / 0.15 * 0.6 : 1 - (t - 0.15) * 0.35);
      s.mesh.scale.set(rr, s.h * Math.min(1, t * 5), rr);
    }
  }
  clear() { for (const s of this.slots) { s.life = 0; s.mesh.visible = false; } }
}

// ============================================================================ 揮砍弧
class Slashes {
  constructor(root, n = 4) {
    const geo = new THREE.RingGeometry(0.42, 0.62, 20, 1, -1.15, 2.3).rotateX(-Math.PI / 2);
    this.slots = [];
    for (let i = 0; i < n; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: COL.warm.clone(), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.visible = false; mesh.renderOrder = 7;
      root.add(mesh);
      this.slots.push({ mesh, life: 0, max: 0.24, yaw: 0, tilt: 0, size: 1, sweep: 1.2, alpha: 0.95 });
    }
    this.cursor = 0;
  }
  /** v2.0：可指定顏色、大小、揮動幅度、傾斜、壽命（第一章的呼叫方式不變） */
  emit(x, y, z, yaw, color = null, size = 1, sweep = 1.2, tilt = null, life = 0.24, alpha = 0.95) {
    const s = this.slots[this.cursor]; this.cursor = (this.cursor + 1) % this.slots.length;
    s.mesh.position.set(x, y, z);
    s.yaw = yaw; s.tilt = tilt == null ? (rand() - 0.5) * 0.9 : tilt;
    s.size = size; s.sweep = sweep; s.max = life; s.alpha = alpha;
    s.mesh.material.color.copy(color || COL.warm);
    s.life = s.max; s.mesh.visible = true;
  }
  update(dt) {
    for (const s of this.slots) {
      if (s.life <= 0) continue;
      s.life -= dt;
      if (s.life <= 0) { s.mesh.visible = false; continue; }
      const t = 1 - s.life / s.max;
      s.mesh.rotation.set(s.tilt, s.yaw + (t - 0.5) * s.sweep, 0, 'YXZ');
      const k = (0.85 + t * 0.35) * s.size;
      s.mesh.scale.set(k, k, k);
      s.mesh.material.opacity = Math.sin(t * Math.PI) * s.alpha;
    }
  }
  clear() { for (const s of this.slots) { s.life = 0; s.mesh.visible = false; } }
}

// ============================================================================ 流星
class Meteors {
  constructor(root, n = 10) {
    const geo = new THREE.IcosahedronGeometry(1, 0);
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd9a0'), toneMapped: false });
    this.slots = [];
    for (let i = 0; i < n; i++) {
      const mesh = new THREE.Mesh(geo, mat);
      mesh.visible = false; mesh.renderOrder = 6;
      root.add(mesh);
      this.slots.push({ mesh, delay: 0, t: 0, dur: 1, sx: 0, sy: 0, sz: 0, ex: 0, ey: 0, ez: 0, size: 0.2, active: false });
    }
    this.cursor = 0;
  }
  emit(sx, sy, sz, ex, ey, ez, dur, delay, size) {
    const s = this.slots[this.cursor]; this.cursor = (this.cursor + 1) % this.slots.length;
    Object.assign(s, { sx, sy, sz, ex, ey, ez, dur, delay, size, t: 0, active: true });
    s.mesh.visible = false;
  }
  clear() { for (const s of this.slots) { s.active = false; s.mesh.visible = false; } }
}

const FIRE_DROP_MAT = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffe08a'), toneMapped: false });

// ============================================================================ 第二章：稜鏡雷射（全部光束在同一個 mesh，一個 draw call）
const BEAM_VERT = /* glsl */`
attribute vec2 aUV;      // x：沿光束的距離（世界單位）、y：橫向 -1～1
attribute vec4 aP;       // x：power、y：光束長度、z：亂數種子、w：樣式（0 一般、1 分光、2 聚焦）
attribute vec3 aCol;
varying vec2 vUV;
varying vec4 vP;
varying vec3 vCol;
void main() { vUV = aUV; vP = aP; vCol = aCol; gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0); }`;
const BEAM_FRAG = /* glsl */`
uniform float uTime;
varying vec2 vUV;
varying vec4 vP;
varying vec3 vCol;
void main() {
  float power = vP.x, len = vP.y, seed = vP.z;
  float v = abs(vUV.y);
  float core = exp(-v * v * 70.0);
  float mid = exp(-v * v * 14.0);
  float halo = exp(-v * v * 3.5) * (1.0 - smoothstep(0.75, 1.0, v));
  // 沿光束往前流動的光脈衝＋螺旋光絲
  float flow = 0.6 + 0.4 * sin(vUV.x * 7.0 - uTime * 16.0 + seed * 6.0);
  float pulse = smoothstep(0.72, 1.0, fract(vUV.x * 0.9 - uTime * 2.6 + seed));
  float strand = smoothstep(0.12, 0.0, abs(vUV.y - 0.42 * sin(vUV.x * 9.0 - uTime * 11.0 + seed * 3.0))) * (0.35 + 0.65 * power);
  float ends = smoothstep(0.0, 0.18, vUV.x);
  float tail = vP.w > 1.5 ? 1.0 - smoothstep(len * 0.72, len, vUV.x) * 0.9 : 1.0;
  float bright = 0.65 + 0.55 * power;
  vec3 col = vCol * (halo * 0.32 + mid * (0.65 + 0.35 * flow) + strand * 0.7 + pulse * mid * 0.6) + vec3(1.0) * core * (0.55 + 0.45 * pulse);
  gl_FragColor = vec4(col * bright * ends * tail, 1.0);
  #include <colorspace_fragment>
}`;
class Beams {
  constructor(root, max = 24) {
    this.max = max; this.n = 0;
    const g = new THREE.BufferGeometry();
    this.pos = new THREE.BufferAttribute(new Float32Array(max * 4 * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.uv = new THREE.BufferAttribute(new Float32Array(max * 4 * 2), 2).setUsage(THREE.DynamicDrawUsage);
    this.p = new THREE.BufferAttribute(new Float32Array(max * 4 * 4), 4).setUsage(THREE.DynamicDrawUsage);
    this.col = new THREE.BufferAttribute(new Float32Array(max * 4 * 3), 3).setUsage(THREE.DynamicDrawUsage);
    const idx = [];
    for (let i = 0; i < max; i++) { const a = i * 4; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    g.setIndex(idx);
    g.setAttribute('position', this.pos); g.setAttribute('aUV', this.uv); g.setAttribute('aP', this.p); g.setAttribute('aCol', this.col);
    this.uniforms = { uTime: { value: 0 } };
    this.mesh = new THREE.Mesh(g, new THREE.ShaderMaterial({
      uniforms: this.uniforms, vertexShader: BEAM_VERT, fragmentShader: BEAM_FRAG,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false,
    }));
    this.mesh.frustumCulled = false; this.mesh.renderOrder = 8; this.mesh.visible = false;
    g.setDrawRange(0, 0);
    root.add(this.mesh);
  }
  begin() { this.n = 0; }
  /** 一道光束：起點 a、終點 b（世界座標）、寬度、顏色、power、樣式、延伸（貫穿）長度 */
  add(ax, ay, az, bx, by, bz, width, color, power, style, seed, camera, extend = 0) {
    if (this.n >= this.max) return;
    let dx = bx - ax, dy = by - ay, dz = bz - az;
    const len0 = Math.hypot(dx, dy, dz) || 1e-3;
    dx /= len0; dy /= len0; dz /= len0;
    const len = len0 + extend;
    const ex = ax + dx * len, ey = ay + dy * len, ez = az + dz * len;
    // 面向鏡頭的側向量
    const mx = (ax + ex) / 2, my = (ay + ey) / 2, mz = (az + ez) / 2;
    _v2.set(camera.position.x - mx, camera.position.y - my, camera.position.z - mz);
    _v.set(dx, dy, dz);
    _v3.crossVectors(_v, _v2).normalize().multiplyScalar(width * 0.5);
    const i = this.n++;
    const P = this.pos.array, U = this.uv.array, Q = this.p.array, C = this.col.array;
    const pts = [[ax - _v3.x, ay - _v3.y, az - _v3.z, 0, -1], [ax + _v3.x, ay + _v3.y, az + _v3.z, 0, 1],
      [ex - _v3.x, ey - _v3.y, ez - _v3.z, len, -1], [ex + _v3.x, ey + _v3.y, ez + _v3.z, len, 1]];
    for (let k = 0; k < 4; k++) {
      const o = i * 4 + k;
      P[o * 3] = pts[k][0]; P[o * 3 + 1] = pts[k][1]; P[o * 3 + 2] = pts[k][2];
      U[o * 2] = pts[k][3]; U[o * 2 + 1] = pts[k][4];
      Q[o * 4] = power; Q[o * 4 + 1] = len; Q[o * 4 + 2] = seed; Q[o * 4 + 3] = style;
      C[o * 3] = color.r; C[o * 3 + 1] = color.g; C[o * 3 + 2] = color.b;
    }
  }
  end(dt) {
    this.uniforms.uTime.value = (this.uniforms.uTime.value + dt) % 1000;
    this.mesh.visible = this.n > 0;
    this.mesh.geometry.setDrawRange(0, this.n * 6);
    if (this.n) { this.pos.needsUpdate = true; this.uv.needsUpdate = true; this.p.needsUpdate = true; this.col.needsUpdate = true; }
  }
}

// ============================================================================ 第二章：旋風斬劍光環
const SWIRL_FRAG = /* glsl */`
uniform vec3 uColor, uCore;
uniform float uAlpha, uRot, uInner;
varying vec2 vUv;
void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float r = length(p);
  if (r > 1.0 || r < uInner) discard;
  float ang = atan(p.y, p.x) / 6.2831853 + 0.5;
  // 兩道刀光：前緣最亮、往後拖出漸淡的尾巴
  float a1 = fract(ang + uRot), a2 = fract(ang + uRot + 0.5);
  float trail = pow(a1, 5.0) + pow(a2, 5.0) * 0.8;
  float edge = smoothstep(uInner, uInner + 0.12, r) * (1.0 - smoothstep(0.9, 1.0, r));
  float tip = smoothstep(0.72, 0.97, r);
  vec3 col = mix(uColor, uCore, tip * trail);
  gl_FragColor = vec4(col * trail * edge * uAlpha * (0.5 + tip), 1.0);
  #include <colorspace_fragment>
}`;
class Swirls {
  constructor(root, n = 3) {
    const geo = new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2);
    this.slots = [];
    for (let i = 0; i < n; i++) {
      const mat = new THREE.ShaderMaterial({
        uniforms: { uColor: { value: new THREE.Color() }, uCore: { value: new THREE.Color('#ffffff') }, uAlpha: { value: 0 }, uRot: { value: 0 }, uInner: { value: 0.5 } },
        vertexShader: BOLT_VERT.replace('viewMatrix * vec4', 'modelViewMatrix * vec4'), fragmentShader: SWIRL_FRAG,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.visible = false; mesh.renderOrder = 8; mesh.frustumCulled = false;
      root.add(mesh);
      this.slots.push({ mesh, life: 0, max: 1, r: 1, turns: 2, follow: null, tilt: 0 });
    }
    this.cursor = 0;
  }
  emit(x, y, z, r, color, life = 0.55, turns = 2.2, follow = null, inner = 0.5, tilt = 0) {
    const s = this.slots[this.cursor]; this.cursor = (this.cursor + 1) % this.slots.length;
    s.mesh.position.set(x, y, z);
    s.mesh.material.uniforms.uColor.value.copy(color);
    s.mesh.material.uniforms.uInner.value = inner;
    s.life = life; s.max = life; s.r = r; s.turns = turns; s.follow = follow; s.tilt = tilt;
    s.mesh.visible = true;
  }
  update(dt) {
    for (const s of this.slots) {
      if (s.life <= 0) continue;
      s.life -= dt;
      if (s.life <= 0) { s.mesh.visible = false; continue; }
      const t = 1 - s.life / s.max;
      const u = s.mesh.material.uniforms;
      u.uRot.value = -t * s.turns;
      u.uAlpha.value = Math.min(1, t * 9) * (t > 0.6 ? (1 - t) / 0.4 : 1) * 1.4;
      const k = s.r * (0.55 + 0.45 * (1 - Math.pow(1 - t, 3)));
      s.mesh.scale.set(k, 1, k);
      s.mesh.rotation.set(s.tilt * Math.sin(t * 6), 0, s.tilt * Math.cos(t * 6));
      if (typeof s.follow === 'function') { const p = s.follow(); if (p) { s.mesh.position.x = p.x; s.mesh.position.z = p.z; } }
    }
  }
  clear() { for (const s of this.slots) { s.life = 0; s.mesh.visible = false; } }
}

// ============================================================================ 第二章：地面光痕（聖燈衝鋒）
const STREAK_FRAG = /* glsl */`
uniform vec3 uColor, uCore;
uniform float uAlpha, uTime, uHead;
varying vec2 vUv;
void main() {
  float across = abs(vUv.y * 2.0 - 1.0);
  float along = vUv.x;                       // 0 起點 → 1 終點
  if (along > uHead) discard;
  float body = (1.0 - smoothstep(0.25, 1.0, across)) * smoothstep(0.0, 0.25, along);
  float core = 1.0 - smoothstep(0.0, 0.35, across);
  float runes = 0.75 + 0.25 * sin(along * 40.0 - uTime * 18.0);
  float head = smoothstep(uHead - 0.25, uHead, along);
  vec3 col = mix(uColor, uCore, core * 0.7 + head * 0.5) * (body * runes + head * core * 1.5);
  gl_FragColor = vec4(col * uAlpha, 1.0);
  #include <colorspace_fragment>
}`;
class Streaks {
  constructor(root, n = 3) {
    const geo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2).translate(0.5, 0, 0);
    this.slots = [];
    for (let i = 0; i < n; i++) {
      const mat = new THREE.ShaderMaterial({
        uniforms: { uColor: { value: new THREE.Color() }, uCore: { value: new THREE.Color('#ffffff') }, uAlpha: { value: 0 }, uTime: { value: 0 }, uHead: { value: 1 } },
        vertexShader: BOLT_VERT.replace('viewMatrix * vec4', 'modelViewMatrix * vec4'), fragmentShader: STREAK_FRAG,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false,
        polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.visible = false; mesh.renderOrder = 6; mesh.frustumCulled = false;
      root.add(mesh);
      this.slots.push({ mesh, life: 0, max: 1, grow: 0.3, age: 0 });
    }
    this.cursor = 0;
  }
  emit(ax, ay, az, bx, bz, width, color, life = 1.0, grow = 0.3) {
    const s = this.slots[this.cursor]; this.cursor = (this.cursor + 1) % this.slots.length;
    const len = Math.hypot(bx - ax, bz - az) || 0.01;
    s.mesh.position.set(ax, ay, az);
    s.mesh.rotation.set(0, Math.atan2(-(bz - az), bx - ax), 0);
    s.mesh.scale.set(len, 1, width);
    s.mesh.material.uniforms.uColor.value.copy(color);
    s.life = life; s.max = life; s.grow = grow; s.age = 0;
    s.mesh.visible = true;
  }
  update(dt) {
    for (const s of this.slots) {
      if (s.life <= 0) continue;
      s.life -= dt; s.age += dt;
      if (s.life <= 0) { s.mesh.visible = false; continue; }
      const u = s.mesh.material.uniforms;
      u.uTime.value += dt;
      u.uHead.value = Math.min(1, s.age / Math.max(0.01, s.grow));
      const t = 1 - s.life / s.max;
      u.uAlpha.value = t > 0.45 ? Math.max(0, (1 - t) / 0.55) : 1;
    }
  }
  clear() { for (const s of this.slots) { s.life = 0; s.mesh.visible = false; } }
}

// ============================================================================ 第二章：從天而降的冰柱
class Shards {
  constructor(root, n = 12) {
    const geo = new THREE.ConeGeometry(1, 1, 6).rotateX(Math.PI).translate(0, 0.5, 0);   // 尖端朝下、底部在上
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#cdf4ff'), toneMapped: false });
    this.mesh = new THREE.InstancedMesh(geo, mat, n);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false; this.mesh.count = 0; this.mesh.renderOrder = 6;
    root.add(this.mesh);
    this.slots = [];
    for (let i = 0; i < n; i++) this.slots.push({ active: false, delay: 0, t: 0, dur: 0.4, x: 0, y0: 6, y1: 0, z: 0, size: 0.2, onLand: null });
    this.cursor = 0;
  }
  emit(x, y0, y1, z, dur, delay, size, onLand) {
    const s = this.slots[this.cursor]; this.cursor = (this.cursor + 1) % this.slots.length;
    Object.assign(s, { active: true, delay, t: 0, dur, x, y0, y1, z, size, onLand });
  }
  update(dt, emitTrail) {
    let n = 0;
    for (const s of this.slots) {
      if (!s.active) continue;
      if (s.delay > 0) { s.delay -= dt; continue; }
      s.t += dt / s.dur;
      const k = Math.min(1, s.t);
      const y = s.y0 + (s.y1 - s.y0) * k * k;
      _q.identity();
      _m.compose(_v.set(s.x, y, s.z), _q, _s.set(s.size * 0.38, s.size * 2.6, s.size * 0.38));
      this.mesh.setMatrixAt(n++, _m);
      if (emitTrail) emitTrail(s.x, y + s.size * 1.6, s.z, s.size);
      if (k >= 1) { s.active = false; if (s.onLand) s.onLand(s.x, s.y1, s.z, s.size); }
    }
    this.mesh.count = n;
    this.mesh.visible = n > 0;
    if (n) this.mesh.instanceMatrix.needsUpdate = true;
  }
  clear() { for (const s of this.slots) s.active = false; this.mesh.count = 0; }
}

// ============================================================================ 第二章：地鼠的土堆（事件土堆＋潛地中跟著走的隆起）
class Mounds {
  constructor(root, max = 48) {
    const geo = new THREE.SphereGeometry(1, 9, 4, 0, TAU, 0, Math.PI / 2);
    const a = geo.attributes.position.array;
    for (let i = 0; i < a.length; i += 3) {
      if (a[i + 1] < 0.02) continue;
      const k = 0.82 + 0.36 * Math.abs(Math.sin(a[i] * 13.1 + a[i + 2] * 7.7 + a[i + 1] * 5.3));
      a[i] *= k; a[i + 2] *= k; a[i + 1] *= 0.8 + 0.4 * Math.abs(Math.sin(a[i] * 9.1 - a[i + 2] * 4.3));
    }
    geo.computeVertexNormals();
    this.max = max;
    this.mesh = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ flatShading: true }), max);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false; this.mesh.count = 0; this.mesh.visible = false; this.mesh.receiveShadow = true;
    root.add(this.mesh);
    this.ev = [];
    for (let i = 0; i < 16; i++) this.ev.push({ life: 0, max: 1, x: 0, y: 0, z: 0, r: 0.3, h: 0.15, rot: 0, c: new THREE.Color() });
    this.cursor = 0;
    this.fr = []; this.nf = 0;
    for (let i = 0; i < max - 16; i++) this.fr.push({ x: 0, y: 0, z: 0, r: 0.3, h: 0.1, rot: 0, c: new THREE.Color() });
  }
  emit(x, y, z, r, h, life, color) {
    const e = this.ev[this.cursor]; this.cursor = (this.cursor + 1) % this.ev.length;
    Object.assign(e, { life, max: life, x, y, z, r, h, rot: rand() * TAU }); e.c.copy(color);
  }
  begin() { this.nf = 0; }
  add(x, y, z, r, h, rot, color) {
    if (this.nf >= this.fr.length) return;
    const f = this.fr[this.nf++];
    f.x = x; f.y = y; f.z = z; f.r = r; f.h = h; f.rot = rot; f.c.copy(color);
  }
  update(dt) {
    let n = 0;
    for (const e of this.ev) {
      if (e.life <= 0) continue;
      e.life -= dt;
      if (e.life <= 0) continue;
      const t = 1 - e.life / e.max;
      const k = t < 0.08 ? t / 0.08 : t > 0.7 ? (1 - t) / 0.3 : 1;   // 冒起 → 停留 → 沉下去
      _q.setFromAxisAngle(_up, e.rot);
      _m.compose(_v.set(e.x, e.y, e.z), _q, _s.set(e.r * (0.7 + 0.3 * k), e.h * k + 0.001, e.r * (0.7 + 0.3 * k)));
      this.mesh.setMatrixAt(n, _m); this.mesh.setColorAt(n, e.c); n++;
    }
    for (let i = 0; i < this.nf; i++) {
      const f = this.fr[i];
      _q.setFromAxisAngle(_up, f.rot);
      _m.compose(_v.set(f.x, f.y, f.z), _q, _s.set(f.r, f.h, f.r));
      this.mesh.setMatrixAt(n, _m); this.mesh.setColorAt(n, f.c); n++;
    }
    this.mesh.count = n;
    this.mesh.visible = n > 0;
    if (n) { this.mesh.instanceMatrix.needsUpdate = true; this.mesh.instanceColor.needsUpdate = true; }
  }
  clear() { for (const e of this.ev) e.life = 0; this.nf = 0; this.mesh.count = 0; this.mesh.visible = false; }
}

// ============================================================================ 持續狀態用的 shader（護盾泡泡）
const BUBBLE_VERT = /* glsl */`
varying vec3 vN;
varying vec3 vV;
void main() {
  mat4 im = modelMatrix * instanceMatrix;
  vec4 wp = im * vec4(position, 1.0);
  vN = normalize(mat3(im) * normal);
  vV = normalize(cameraPosition - wp.xyz);
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;
const BUBBLE_FRAG = /* glsl */`
uniform vec3 uColor;
uniform float uTime;
varying vec3 vN;
varying vec3 vV;
void main() {
  float f = 1.0 - abs(dot(normalize(vN), normalize(vV)));
  float band = 0.75 + 0.25 * sin(vN.y * 10.0 + uTime * 3.0);
  float a = (0.08 + pow(f, 2.4) * 0.95) * band;
  gl_FragColor = vec4(uColor * a, 1.0);
  #include <colorspace_fragment>
}`;

function instanced(root, geo, mat, max, order = 5) {
  const m = new THREE.InstancedMesh(geo, mat, max);
  m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  m.frustumCulled = false;
  m.count = 0;
  m.renderOrder = order;
  root.add(m);
  return m;
}

// ============================================================================ 主體
export function createEffects(world) {
  const root = new THREE.Group();
  root.name = 'effects';
  world.scene.add(root);
  const atlas = makeAtlas();

  const add = new Particles(root, 1600, true, 9, 0);
  const smoke = new Particles(root, 600, false, 8, 0, world.darkUniforms || null);
  const hard = new Particles(root, 400, false, 8, 1, world.darkUniforms || null);   // 實心小顆粒（金幣、黏液、葉子、雪）
  const rings = new EventQuads(root, 48, true, atlas, 5);
  const darkRings = new EventQuads(root, 16, false, atlas, 4);
  const decalA = new FrameQuads(root, 96, true, atlas, 5);
  const decalN = new FrameQuads(root, 24, false, atlas, 3);
  const debris = new Debris(root, 96);
  const spikes = new Spikes(root, 96);
  const bolts = new Bolts(root, 8);
  const texts = new Texts(root, 24);
  const pillars = new Pillars(root, 10);
  const slashes = new Slashes(root, 6);
  const meteors = new Meteors(root, 12);
  // v2.0（第二章＋三位英雄）
  const sparkle = new Particles(root, 600, true, 9, 2);          // 四角星芒（星塵、妖精、聖光、幽靈）
  const trailQ = new EventQuads(root, 80, false, atlas, 3);      // 地鼠潛地留下的土痕
  const beams = new Beams(root, 24);                             // 稜鏡雷射
  const swirls = new Swirls(root, 3);                            // 旋風斬劍光環
  const streaks = new Streaks(root, 3);                          // 聖燈衝鋒地面光痕
  const shards = new Shards(root, 16);                           // 冰隕冰柱
  const fireDrops = new Meteors(root, 10);                       // 火焰風暴落下的火球
  fireDrops.slots.forEach((s) => { s.mesh.material = FIRE_DROP_MAT; });
  const mounds = new Mounds(root, 48);                           // 地鼠土堆
  // 碎石、尖刺、土堆是受光材質：洞窟黑暗時跟著變暗（第一章不會補丁）
  if (world.addDarkRoot) for (const o of [debris.mesh, spikes.mesh, mounds.mesh]) world.addDarkRoot(o);

  // 全螢幕閃光（冰封、流星、受傷、漏怪）
  const overlayU = { uColor: { value: new THREE.Color() }, uAlpha: { value: 0 }, uVig: { value: 0 } };
  const overlay = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    uniforms: overlayU,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: 'uniform vec3 uColor; uniform float uAlpha, uVig; varying vec2 vUv; void main(){ float r = length(vUv * 2.0 - 1.0); float v = mix(1.0, smoothstep(0.3, 1.35, r), uVig); gl_FragColor = vec4(uColor, uAlpha * v);\n#include <colorspace_fragment>\n}',
    transparent: true, depthTest: false, depthWrite: false, toneMapped: false,
  }));
  overlay.frustumCulled = false; overlay.renderOrder = 1000; overlay.visible = false;
  root.add(overlay);
  const ov = { a: 0, life: 0, max: 1 };
  function screenFlash(color, alpha, dur, vig = 0) {
    if (ov.life > 0 && ov.a * (ov.life / ov.max) > alpha) return;
    overlayU.uColor.value.copy(color); overlayU.uVig.value = vig;
    ov.a = alpha; ov.life = dur; ov.max = dur;
  }

  // 一盞共用的閃光點光源（數量固定，不會造成 shader 重編）
  const flash = new THREE.PointLight(0xffa050, 0, 4.5, 2);   // r160 物理單位：太陽約 2.7，這盞只當點綴，強度上限 3
  flash.position.set(0, -50, 0);
  root.add(flash);
  let flashI = 0;
  function lightFlash(x, y, z, color, intensity) {
    flash.position.set(x, y, z); flash.color.copy(color);
    flashI = Math.min(3, Math.max(flashI, intensity));
  }

  // 持續狀態
  const bubbleMat = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color('#9fb8ff') }, uTime: { value: 0 } },
    vertexShader: BUBBLE_VERT, fragmentShader: BUBBLE_FRAG,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
  });
  const bubbles = instanced(root, new THREE.IcosahedronGeometry(1, 2), bubbleMat, 64, 6);
  const ice = instanced(root, new THREE.IcosahedronGeometry(1, 0), new THREE.MeshLambertMaterial({
    color: '#d4f4ff', emissive: '#3c8cc4', emissiveIntensity: 0.55, transparent: true, opacity: 0.6, flatShading: true, depthWrite: false,
  }), 64, 6);
  const roots = instanced(root, new THREE.TorusGeometry(1, 0.14, 4, 12).rotateX(Math.PI / 2), new THREE.MeshLambertMaterial({ color: '#7a6a34', flatShading: true }), 64, 2);
  const stars = instanced(root, new THREE.OctahedronGeometry(1, 0), new THREE.MeshBasicMaterial({ color: '#ffe066', toneMapped: false }), 192, 7);

  let state = null;
  const towerPos = new Map();   // id → {x, z}（賣塔時塔已經不在 state 裡）
  let zonesManaged = false;     // 有 state.zones 就由 state 畫地帶
  const fakeZones = [];         // 沒有 state 時，燃燒彈／流星標記的暫時地帶
  for (let i = 0; i < 12; i++) fakeZones.push({ kind: '', x: 0, z: 0, radius: 1, ttl: 0, id: i });
  const timers = [];
  const recentGold = [];        // 去重：同一位置同一時間的金幣飄字
  let time = 0;
  let lastEnemyMap = null;

  const W = () => world.W, H = () => world.H;
  const wx = (x) => x - world.W / 2, wz = (z) => z - world.H / 2;
  const ok = (v) => typeof v === 'number' && Number.isFinite(v);
  const sizeOf = (type) => (ENEMY_DATA.ENEMIES && ENEMY_DATA.ENEMIES[type] && ENEMY_DATA.ENEMIES[type].size) || 0.7;
  const skill = (id) => (HERO_DATA.SKILLS && HERO_DATA.SKILLS[id]) || {};

  function findEnemy(id) {
    if (!state || !state.enemies) return null;
    for (const e of state.enemies) if (e.id === id) return e;
    return null;
  }
  function findTower(id) {
    if (state && state.towers) for (const t of state.towers) if (t.id === id) return t;
    return towerPos.get(id) || null;
  }
  function after(sec, fn) { timers.push({ t: sec, fn }); }
  /** 塔事件的位置：優先用事件自帶的 x,z（A 的 build/upgrade/sell 都有），否則查 state／快取 */
  function towerXZ(ev) {
    if (ok(ev.x) && ok(ev.z)) return { x: ev.x, z: ev.z };
    return findTower(ev.towerId);
  }
  /** 英雄事件的位置：heroDeath/heroRespawn/heroLevel 自帶 x,z；其他用 state.hero */
  function heroXZ(ev) {
    if (ok(ev.x) && ok(ev.z)) return { x: ev.x, z: ev.z };
    return state && state.hero ? state.hero : null;
  }

  // ------------------------------------------------------------------ 各種效果
  function hitFx(x, y, z, kind, dmgType) {
    if (kind === 'frost') {
      burst(add, x, y, z, 8, 1.8, 0.2, 0.4, 0.12, 0.03, COL.frost, COL.frostEnd, 1, 2, 2);
      add.emit(x, y, z, 0, 0, 0, 0.16, 0.25, 0.7, COL.frost, COL.frostEnd, 0.9);
      rings.emit(x, Math.max(0.03, y - 0.3), z, 0.1, 0.5, 0.35, COL.frost, 0.7, 0);
      return;
    }
    if (dmgType === 'magic' || kind === 'orb') {
      burst(add, x, y, z, 9, 1.4, 0.3, 0.45, 0.12, 0.03, COL.magic, COL.magicEnd, 1, -0.5, 2);
      add.emit(x, y, z, 0, 0, 0, 0.16, 0.25, 0.75, COL.magic, COL.magicEnd, 0.9);
      return;
    }
    burst(add, x, y, z, 7, 3.2, 0.35, 0.32, 0.08, 0.02, COL.spark, COL.sparkEnd, 1, 8, 1.2, 0.02);
    add.emit(x, y, z, 0, 0, 0, 0.1, 0.18, 0.5, COL.white, COL.spark, 0.9);
  }

  function explodeFx(x, z, radius, kind) {
    const gy = Math.max(0, world.groundHeight(x + world.W / 2, z + world.H / 2));
    const r = radius || 1;
    if (kind === 'meteor') { meteorImpact(x, gy, z, r); return; }
    if (kind === 'fire') {
      burst(add, x, gy + 0.15, z, 22, 2.4, 0.75, 0.6, 0.28, 0.08, COL.fire, COL.fireEnd, 1, -1.5, 2.2, -99, r * 0.5);
      burst(smoke, x, gy + 0.3, z, 8, 0.9, 0.9, 1.1, 0.35, 0.8, COL.smokeDark, COL.smokeEnd, 0.55, -0.6, 1.5, -99, r * 0.4);
      rings.emit(x, gy + 0.03, z, 0.2, r * 1.1, 0.45, COL.orange, 0.9, 0);
      rings.emit(x, gy + 0.03, z, r * 0.4, r * 0.9, 0.35, COL.fire, 0.8, 1, 1, 0);
      lightFlash(x, gy + 0.8, z, COL.orange, 1.2);
      if (!zonesManaged) addFakeZone('fire', x + world.W / 2, z + world.H / 2, r * 0.9, 3);
      return;
    }
    const big = kind === 'boulder';
    const k = big ? 1.5 : 1;
    ringBurst(smoke, x, gy + 0.08, z, big ? 14 : 10, r * 0.3, 1.6 * k, 0.8, 0.3 * k, 0.75 * k, COL.dust, COL.dustEnd, 0.75, 0, 2.5, 0.4);
    burst(add, x, gy + 0.2, z, big ? 10 : 6, 3, 0.5, 0.3, 0.09, 0.02, COL.spark, COL.sparkEnd, 1, 8, 1, gy);
    for (let i = 0; i < (big ? 12 : 6); i++) {
      const th = rand() * TAU, s = 1.2 + rand() * 2.2;
      debris.emit(x, gy + 0.2, z, Math.cos(th) * s, 2.5 + rand() * 3, Math.sin(th) * s, 0.04 + rand() * 0.05 * k, rand() < 0.5 ? COL.dustEnd : COL.smoke, 1.2, gy);
    }
    darkRings.emit(x, gy + 0.02, z, 0.2, r * 1.1, 0.6, COL.dustEnd, 0.6, 0);
    rings.emit(x, gy + 0.03, z, 0.15, r * 1.05, 0.35, COL.warm, 0.55, 0);
    if (big) world.cam && world.cam.shake(0.1, 0.3);
  }

  function meteorImpact(x, gy, z, r) {
    lightFlash(x, gy + 1.2, z, COL.orange, 3);
    screenFlash(COL.holyEnd, 0.32, 0.35, 0.4);
    rings.emit(x, gy + 0.04, z, 0.2, r * 1.7, 0.55, COL.orange, 1, 0);
    rings.emit(x, gy + 0.05, z, 0.3, r * 2.4, 0.85, COL.warm, 0.8, 0);
    rings.emit(x, gy + 0.03, z, r * 0.2, r * 1.2, 0.5, COL.fire, 0.9, 1, 1, 0);
    darkRings.emit(x, gy + 0.02, z, 0.3, r * 1.9, 1.0, COL.dustEnd, 0.7, 0);
    darkRings.emit(x, gy + 0.015, z, r * 0.9, r * 1.1, 4, COL.white, 0.9, 2, 0, 1);
    burst(add, x, gy + 0.2, z, 46, 4.5, 0.6, 0.7, 0.3, 0.06, COL.fire, COL.fireEnd, 1, 2.5, 2.2, gy, r * 0.6);
    burst(smoke, x, gy + 0.3, z, 22, 1.8, 0.8, 1.6, 0.5, 1.3, COL.smokeDark, COL.smokeEnd, 0.6, -0.4, 1.6, -99, r * 0.8);
    ringBurst(smoke, x, gy + 0.1, z, 18, r * 0.5, 3, 1.0, 0.4, 1.0, COL.dust, COL.dustEnd, 0.7, 0, 2.5, 0.3);
    for (let i = 0; i < 22; i++) {
      const th = rand() * TAU, s = 1.5 + rand() * 3.5;
      debris.emit(x + Math.cos(th) * r * 0.3, gy + 0.2, z + Math.sin(th) * r * 0.3, Math.cos(th) * s, 3 + rand() * 4.5, Math.sin(th) * s,
        0.05 + rand() * 0.08, rand() < 0.4 ? COL.smokeDark : COL.dustEnd, 1.6, gy);
    }
    if (world.cam) world.cam.shake(0.45, 0.75);
  }

  function addFakeZone(kind, x, z, radius, ttl) {
    let best = fakeZones[0];
    for (const f of fakeZones) { if (f.ttl <= 0) { best = f; break; } if (f.ttl < best.ttl) best = f; }
    best.kind = kind; best.x = x; best.z = z; best.radius = radius; best.ttl = ttl;
  }

  function goldText(amount, x, y, z) {
    if (!(amount > 0)) return;
    for (const g of recentGold) {
      if (time - g.t < 0.12 && g.amount === amount && Math.abs(g.x - x) < 0.4 && Math.abs(g.z - z) < 0.4) return;
    }
    recentGold.push({ t: time, amount, x, z });
    if (recentGold.length > 12) recentGold.shift();
    texts.emit(`+${amount}`, x, y, z, 'gold');
  }

  function meteorCast(x, z, radius, delayArg) {
    const sk = skill('meteor');
    const delay = ok(delayArg) ? delayArg : Number.isFinite(sk.delay) ? sk.delay : 1;
    const R = ok(radius) ? radius : Number.isFinite(sk.radius) ? sk.radius : 1.6;
    const gx = x, gz = z;
    const X = wx(x), Z = wz(z);
    const gy = Math.max(0, world.groundHeight(gx, gz));
    const n = 7;
    for (let i = 0; i < n; i++) {
      const main = i === 0;
      const a = rand() * TAU, d = main ? 0 : R * (0.35 + rand() * 0.6);
      const ex = X + Math.cos(a) * d, ez = Z + Math.sin(a) * d;
      const dur = main ? delay * 0.62 : delay * (0.4 + rand() * 0.35);
      const arrive = main ? delay : delay * (0.72 + rand() * 0.45);
      meteors.emit(ex - 3.2 - rand(), gy + 9 + rand() * 2, ez - 2.4 - rand(), ex, gy, ez, dur, Math.max(0, arrive - dur), main ? 0.3 : 0.12 + rand() * 0.1);
    }
    if (!zonesManaged) addFakeZone('meteorMark', gx, gz, R, delay);
  }

  function freezeCast() {
    screenFlash(COL.frost, 0.5, 1.0, 0.65);
    const cx = world.lampPos ? wx(world.lampPos.x) : 0, cz = world.lampPos ? wz(world.lampPos.z) : 0;
    const big = Math.max(world.W, world.H) * 0.75;
    rings.emit(cx, 0.06, cz, 0.5, big, 1.1, COL.frost, 0.9, 0);
    rings.emit(cx, 0.05, cz, 0.3, big * 0.7, 0.9, COL.white, 0.6, 3, 1, 0, 0.8);
    for (let i = 0; i < 160; i++) {
      const x = (rand() - 0.5) * world.W * 0.9, z = (rand() - 0.5) * world.H * 0.9;
      hard.emit(x, 1.5 + rand() * 2.5, z, (rand() - 0.5) * 0.3, -0.6 - rand() * 0.5, (rand() - 0.5) * 0.3, 1.6 + rand() * 1.2, 0.05, 0.04, COL.white, COL.ice, 0.9, 0, 0.2, 0);
    }
    if (state && state.enemies) for (const e of state.enemies) {
      const y = (e.y || 0) + sizeOf(e.type) * 0.4;
      burst(add, wx(e.x), y, wz(e.z), 10, 1.6, 0.4, 0.6, 0.14, 0.04, COL.frost, COL.frostEnd, 1, 1, 2);
      rings.emit(wx(e.x), 0.04, wz(e.z), 0.1, 0.7, 0.6, COL.frost, 0.8, 0);
    }
    lightFlash(cx, 2.5, cz, COL.blue, 2);
  }

  function fireworks() {
    const lp = world.lampPos || { x: world.W / 2, z: world.H / 2 };
    const cols = [COL.gold, COL.magic, COL.frost, COL.red, COL.leaf];
    for (let i = 0; i < 7; i++) {
      after(i * 0.32 + rand() * 0.15, () => {
        const x = wx(lp.x) + (rand() - 0.5) * 4, z = wz(lp.z) + (rand() - 0.5) * 3, y = 2.5 + rand() * 1.5;
        const c = cols[Math.floor(rand() * cols.length)];
        burst(add, x, y, z, 36, 2.6, 0, 1.1, 0.14, 0.04, c, COL.white, 1, 1.6, 1.6);
        add.emit(x, y, z, 0, 0, 0, 0.25, 0.4, 1.4, COL.white, c, 0.9);
      });
    }
  }

  // ================================================================== v2.0：第二章＋英雄
  const heroDef = (type) => (HERO_DATA.HEROES && HERO_DATA.HEROES[type]) || null;
  const heroSkillDef = (id) => (HERO_DATA.HERO_SKILLS && HERO_DATA.HERO_SKILLS[id]) || {};
  /** 暫時光（格子座標）：讓黑暗中的特效照亮周圍；沒開黑暗時 world 會忽略 */
  function addLight(x, z, r, life, warm = 0.8, cool = 0, inten = 1) { if (world.addLight) world.addLight(x, z, r, life, warm, cool, inten); }
  function pushLight(x, z, r, warm = 0.8, cool = 0, inten = 1) { if (world.pushLight) world.pushLight(x, z, r, warm, cool, inten); }
  const gyOf = (x, z) => Math.max(0, world.groundHeight(x, z));   // 格子座標
  function heroHeight(h) {
    if (!h) return 0.55;
    const d = heroDef(h.type);
    return (h.flying || (d && d.flying)) ? 0.95 : 0.55;
  }
  /** 事件目標位置（世界座標＋身體中段高度） */
  function targetOf(ev) {
    const e = ev.targetId != null ? findEnemy(ev.targetId) : null;
    let x, y, z, s = 0.7;
    if (ok(ev.x) && ok(ev.z)) { x = ev.x; z = ev.z; y = ok(ev.y) ? ev.y : (e ? e.y || 0 : 0); }
    else if (e) { x = e.x; z = e.z; y = e.y || 0; }
    else return null;
    if (e) s = sizeOf(e.type);
    if (y < 0.1) y += 0.3 + s * 0.15;
    return { gx: x, gz: z, x: wx(x), y, z: wz(z) };
  }

  // ---- 英雄普攻
  let lastBlast = { t: -9, x: 0, z: 0 };
  function heroAttackFx(ev) {
    const h = state && state.hero;
    if (!h) return;
    const tp = targetOf(ev);
    const kind = ev.attack || (heroDef(h.type) && heroDef(h.type).attack) || 'sword';
    const hx = wx(h.x), hz = wz(h.z);
    let dx = tp ? tp.x - hx : Math.sin(h.yaw || 0), dz = tp ? tp.z - hz : Math.cos(h.yaw || 0);
    const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
    if (kind === 'bolt') {
      // 妖精出手：綠白光點從手上綻開
      const y = heroHeight(h) + 0.05;
      const mx = hx + dx * 0.25, mz = hz + dz * 0.25;
      burst(sparkle, mx, y, mz, 7, 1.5, 0.2, 0.35, 0.22, 0.05, COL.fairyCore, COL.fairy, 1, 0, 3);
      add.emit(mx, y, mz, 0, 0, 0, 0.16, 0.25, 0.7, COL.fairyCore, COL.fairy, 0.9);
      addLight(h.x, h.z, 1.4, 0.25, 0.1, 0.6, 0.6);
      return;
    }
    if (kind === 'fireball') {
      // 法師出手：法杖頂端噴出火光
      const y = 1.05;
      const mx = hx + dx * 0.3, mz = hz + dz * 0.3;
      burst(add, mx, y, mz, 10, 1.3, 0.4, 0.35, 0.18, 0.04, COL.fire, COL.fireEnd, 1, -1, 2);
      add.emit(mx, y, mz, 0, 0, 0, 0.18, 0.3, 0.9, COL.fireCore, COL.fire, 0.95);
      burst(sparkle, mx, y, mz, 4, 1.0, 0.3, 0.3, 0.2, 0.04, COL.fireCore, COL.orange, 1, 0, 3);
      addLight(h.x, h.z, 1.7, 0.3, 1, 0, 0.8);
      lightFlash(mx, y, mz, COL.orange, 0.9);
      return;
    }
    // 騎士：兩層刀光（金＋白）＋命中火花＋星芒
    const yaw = Math.atan2(-dz, dx);
    const tilt = (rand() - 0.5) * 0.9;
    slashes.emit(hx + dx * 0.2, 0.48, hz + dz * 0.2, yaw, COL.holyEnd, 1.5, 2.2, tilt, 0.3, 1);
    slashes.emit(hx + dx * 0.24, 0.5, hz + dz * 0.24, yaw, COL.white, 1.2, 1.9, tilt, 0.22, 0.95);
    if (tp) {
      burst(add, tp.x, tp.y, tp.z, 12, 3.4, 0.35, 0.3, 0.09, 0.02, COL.spark, COL.sparkEnd, 1, 7, 1.4, tp.y - 0.4, 0.05);
      add.emit(tp.x, tp.y, tp.z, 0, 0, 0, 0.12, 0.2, 0.75, COL.white, COL.holy, 1);
      burst(sparkle, tp.x, tp.y, tp.z, 4, 1.8, 0.3, 0.3, 0.26, 0.05, COL.white, COL.holy, 1, 0, 2.5);
    }
    addLight(h.x + dx * 0.3, h.z + dz * 0.3, 1.2, 0.22, 0.8, 0, 0.6);
  }

  // ---- 英雄投射物：拖尾＋消失時的命中特效（不靠事件也能畫，命中事件只補小火花）
  const projSeen = new Map();   // id → { kind, x, y, z, f, acc }
  let projFrame = 0;
  const HERO_PROJ = { fairyBolt: 1, starBolt: 1, fireball: 1 };
  function projectileFx(dt) {
    projFrame++;
    const list = state && state.projectiles;
    if (list) for (const p of list) {
      if (!HERO_PROJ[p.kind] || !ok(p.x) || !ok(p.z)) continue;
      let r = projSeen.get(p.id);
      if (!r) { r = { kind: p.kind, x: p.x, y: 0.8, z: p.z, f: 0, acc: 0 }; projSeen.set(p.id, r); }
      r.x = p.x; r.y = ok(p.y) ? p.y : 0.8; r.z = p.z; r.f = projFrame;
      const x = wx(p.x), y = r.y, z = wz(p.z);
      if (dt <= 0) continue;
      if (p.kind === 'fireball') {
        add.emit(x, y, z, 0, 0, 0, 0.07, 0.62, 0.3, COL.fireCore, COL.fire, 0.85);
        for (let i = 0; i < 2; i++) add.emit(x + (rand() - 0.5) * 0.12, y + (rand() - 0.5) * 0.12, z + (rand() - 0.5) * 0.12, (rand() - 0.5) * 0.4, 0.4 + rand() * 0.5, (rand() - 0.5) * 0.4, 0.32, 0.26, 0.05, COL.fire, COL.fireEnd, 0.9, -0.5, 1.5);
        if (rand() < dt * 30) smoke.emit(x, y, z, 0, 0.35, 0, 0.7, 0.14, 0.36, COL.smokeDark, COL.smokeEnd, 0.4, -0.2, 1);
        pushLight(p.x, p.z, 1.5, 1, 0, 0.9);
      } else if (p.kind === 'fairyBolt') {
        add.emit(x, y, z, 0, 0, 0, 0.06, 0.42, 0.22, COL.fairyCore, COL.fairy, 0.9);
        add.emit(x, y, z, (rand() - 0.5) * 0.3, (rand() - 0.5) * 0.3, (rand() - 0.5) * 0.3, 0.28, 0.16, 0.03, COL.fairy, COL.fairyEnd, 0.8, 0, 2);
        if (rand() < dt * 30) sparkle.emit(x + (rand() - 0.5) * 0.15, y + (rand() - 0.5) * 0.15, z + (rand() - 0.5) * 0.15, 0, 0.2, 0, 0.4, 0.18, 0.04, rand() < 0.5 ? COL.fairyPink : COL.fairyCore, COL.fairy, 1);
        pushLight(p.x, p.z, 1.0, 0.1, 0.6, 0.8);
      } else {
        add.emit(x, y, z, 0, 0, 0, 0.06, 0.4, 0.2, COL.white, COL.star, 0.9);
        add.emit(x, y, z, (rand() - 0.5) * 0.3, (rand() - 0.5) * 0.3, (rand() - 0.5) * 0.3, 0.3, 0.14, 0.03, COL.star, COL.starEnd, 0.85, 0, 2);
        if (rand() < dt * 40) sparkle.emit(x, y, z, (rand() - 0.5) * 0.4, (rand() - 0.5) * 0.4, (rand() - 0.5) * 0.4, 0.45, 0.2, 0.04, COL.white, COL.starEnd, 1, 0, 2);
        pushLight(p.x, p.z, 1.0, 0.5, 0.3, 0.8);
      }
    }
    for (const [id, r] of projSeen) {
      if (r.f === projFrame) continue;
      projSeen.delete(id);
      projectileImpact(r);
    }
  }
  function projectileImpact(r) {
    const x = wx(r.x), y = r.y, z = wz(r.z);
    if (r.kind === 'fireball') { fireballBlast(r.x, r.z, y, 0.9); return; }
    if (r.kind === 'fairyBolt') {
      burst(sparkle, x, y, z, 10, 2.0, 0.3, 0.4, 0.24, 0.05, COL.fairyCore, COL.fairy, 1, 0, 2.5);
      burst(add, x, y, z, 8, 1.6, 0.3, 0.3, 0.12, 0.03, COL.fairyPink, COL.fairyEnd, 1, 0, 2);
      add.emit(x, y, z, 0, 0, 0, 0.16, 0.2, 0.8, COL.fairyCore, COL.fairy, 0.95);
      rings.emit(x, Math.max(0.04, y - 0.4), z, 0.1, 0.55, 0.35, COL.fairy, 0.7, 0);
      addLight(r.x, r.z, 1.1, 0.25, 0.1, 0.6, 0.7);
      return;
    }
    burst(sparkle, x, y, z, 12, 2.4, 0.3, 0.45, 0.26, 0.05, COL.white, COL.starEnd, 1, 0, 2.5);
    add.emit(x, y, z, 0, 0, 0, 0.18, 0.2, 0.9, COL.white, COL.star, 1);
    rings.emit(x, Math.max(0.04, y - 0.4), z, 0.1, 0.6, 0.35, COL.star, 0.8, 0);
    addLight(r.x, r.z, 1.2, 0.3, 0.5, 0.3, 0.8);
  }
  /** 法師火球爆炸（格子座標 gx, gz） */
  function fireballBlast(gx, gz, y, radius) {
    if (time - lastBlast.t < 0.25 && Math.abs(lastBlast.x - gx) < 0.8 && Math.abs(lastBlast.z - gz) < 0.8) return;
    lastBlast = { t: time, x: gx, z: gz };
    const x = wx(gx), z = wz(gz), gy = gyOf(gx, gz), r = radius || 0.9;
    const cy = Math.max(gy + 0.25, Math.min(y, gy + 0.6));
    burst(add, x, cy, z, 34, 3.4, 0.45, 0.6, 0.3, 0.06, COL.fire, COL.fireEnd, 1, 1, 2.2, gy, r * 0.3);
    burst(add, x, cy, z, 10, 1.2, 0.6, 0.7, 0.36, 0.1, COL.fireCore, COL.lava, 0.9, -1.2, 1.5, -99, r * 0.25);
    add.emit(x, cy, z, 0, 0, 0, 0.28, 0.4, r * 2.4, COL.fireCore, COL.lava, 1);
    burst(sparkle, x, cy, z, 6, 2.2, 0.4, 0.4, 0.24, 0.05, COL.fireCore, COL.orange, 1, 0, 2);
    burst(smoke, x, cy, z, 10, 1.0, 0.8, 1.1, 0.28, 0.75, COL.smokeDark, COL.smokeEnd, 0.55, -0.5, 1.6, -99, r * 0.4);
    rings.emit(x, gy + 0.04, z, 0.15, r * 1.25, 0.4, COL.orange, 1, 0);
    rings.emit(x, gy + 0.035, z, r * 0.3, r, 0.35, COL.fire, 0.8, 1, 1, 0);
    darkRings.emit(x, gy + 0.02, z, 0.2, r * 0.9, 1.6, COL.dustEnd, 0.5, 2, 1, 1);
    for (let i = 0; i < 5; i++) {
      const th = rand() * TAU, sp = 1 + rand() * 1.8;
      debris.emit(x, gy + 0.2, z, Math.cos(th) * sp, 2 + rand() * 2, Math.sin(th) * sp, 0.03 + rand() * 0.03, COL.smokeDark, 1, gy);
    }
    lightFlash(x, cy + 0.4, z, COL.orange, 2);
    addLight(gx, gz, r + 1.1, 0.5, 1, 0, 1);
    if (world.cam) world.cam.shake(0.05, 0.18);
  }

  // ---- 英雄技能
  const clouds = [];   // 花粉迷霧（持續）
  for (let i = 0; i < 4; i++) clouds.push({ ttl: 0, max: 1, x: 0, z: 0, r: 1 });
  const charge = { active: false, t: 0, travel: 0.3, sx: 0, sz: 0, tx: 0, tz: 0, hit: false };

  function heroSkillFx(ev) {
    const h = state && state.hero;
    const id = ev.skill || ev.id;
    const def = heroSkillDef(id);
    const R = ok(ev.radius) ? ev.radius : (def.radius || 1.5);
    const hx = ok(ev.x) ? ev.x : h ? h.x : null, hz = ok(ev.z) ? ev.z : h ? h.z : null;
    const tx = ok(ev.tx) ? ev.tx : hx, tz = ok(ev.tz) ? ev.tz : hz;
    if (!ok(hx) || !ok(hz)) return;
    switch (id) {
      case 'whirl': whirlFx(h ? h.x : hx, h ? h.z : hz, R); break;
      case 'charge': chargeFx(h && ok(ev.tx) ? h.x : hx, h && ok(ev.tz) ? h.z : hz, tx, tz, R); break;
      case 'starburst': starburstFx(h ? h.x : hx, h ? h.z : hz, h); break;
      case 'pollen': pollenFx(tx, tz, R, def.duration || 4); break;
      case 'firestorm': firestormFx(tx, tz, R); break;
      case 'icefall': icefallFx(tx, tz, R); break;
      default:
        rings.emit(wx(tx), 0.05, wz(tz), 0.2, R, 0.5, COL.holy, 0.8, 0);
        addLight(tx, tz, R + 0.5, 0.5, 0.5, 0.3);
    }
  }

  function whirlFx(gx, gz, R) {
    const x = wx(gx), z = wz(gz), gy = gyOf(gx, gz);
    const follow = () => (state && state.hero ? { x: wx(state.hero.x), z: wz(state.hero.z) } : null);
    swirls.emit(x, gy + 0.42, z, R * 1.08, COL.holyEnd, 0.6, 2.6, follow, 0.5, 0.12);
    swirls.emit(x, gy + 0.3, z, R * 0.82, COL.holy, 0.5, 2.2, follow, 0.6, -0.1);
    rings.emit(x, gy + 0.05, z, 0.3, R * 1.3, 0.5, COL.warm, 0.95, 0);
    rings.emit(x, gy + 0.06, z, R * 0.55, R * 1.05, 0.65, COL.gold, 0.7, 3, 1, 0, 7);
    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * TAU, rr = R * (0.55 + rand() * 0.45), sp = 3 + rand() * 2;
      add.emit(x + Math.cos(a) * rr, gy + 0.25 + rand() * 0.4, z + Math.sin(a) * rr, -Math.sin(a) * sp, 0.4 + rand() * 0.6, Math.cos(a) * sp, 0.32, 0.12, 0.03, COL.white, COL.holyEnd, 0.9, 0, 3);
    }
    burst(sparkle, x, gy + 0.5, z, 14, 2.6, 0.3, 0.5, 0.26, 0.05, COL.white, COL.holy, 1, 0, 2, -99, R * 0.6);
    ringBurst(smoke, x, gy + 0.08, z, 16, R * 0.4, 2.2, 0.7, 0.25, 0.6, COL.dust, COL.dustEnd, 0.6, 0, 2.6, 0.2);
    lightFlash(x, gy + 0.8, z, COL.holy, 1.8);
    addLight(gx, gz, R + 0.9, 0.7, 0.75, 0.05, 1);
    if (world.cam) world.cam.shake(0.12, 0.3);
  }

  function chargeFx(sx, sz, tx, tz, R) {
    const d = Math.hypot(tx - sx, tz - sz);
    Object.assign(charge, { active: true, t: 0, travel: Math.min(0.6, Math.max(0.18, d / 8)), sx, sz, tx, tz, hit: false, R: R || 1, seenDash: false });
    const gy = gyOf(sx, sz);
    streaks.emit(wx(sx), gy + 0.03, wz(sz), wx(tx), wz(tz), 0.8, COL.holyEnd, charge.travel + 0.9, charge.travel);
    burst(sparkle, wx(sx), gy + 0.4, wz(sz), 10, 2, 0.4, 0.4, 0.24, 0.05, COL.white, COL.holy, 1, 0, 2.5);
    rings.emit(wx(sx), gy + 0.05, wz(sz), 0.2, 0.9, 0.35, COL.gold, 0.9, 0);
  }
  function chargeUpdate(dt) {
    if (!charge.active) return;
    charge.t += dt;
    let k = Math.min(1, charge.t / charge.travel);
    const h = state && state.hero;
    let gx = charge.sx + (charge.tx - charge.sx) * k, gz = charge.sz + (charge.tz - charge.sz) * k;
    // sim 的衝鋒：hero.dashing（或 state 'charge'）期間跟著英雄，衝完才撞擊；最多等 1.5 秒
    const dashing = !!(h && (h.dashing || h.state === 'charge'));
    if (dashing) { gx = h.x; gz = h.z; charge.seenDash = true; if (charge.t < 1.5) k = Math.min(k, 0.99); }
    else if (charge.seenDash) k = 1;
    const x = wx(gx), z = wz(gz), gy = gyOf(gx, gz);
    if (!charge.hit && dt > 0) {
      for (let i = 0; i < 3; i++) add.emit(x + (rand() - 0.5) * 0.3, gy + 0.2 + rand() * 0.5, z + (rand() - 0.5) * 0.3, (rand() - 0.5) * 0.6, 0.5 + rand(), (rand() - 0.5) * 0.6, 0.4, 0.16, 0.03, COL.holy, COL.holyEnd, 1, 0, 2);
      if (rand() < 0.6) sparkle.emit(x, gy + 0.4 + rand() * 0.3, z, 0, 0.6, 0, 0.5, 0.22, 0.04, COL.white, COL.holy, 1);
      pushLight(gx, gz, 1.8, 0.8, 0, 1);
    }
    if (!charge.hit && k >= 1) {
      charge.hit = true;
      const X = wx(charge.tx), Z = wz(charge.tz), g2 = gyOf(charge.tx, charge.tz), R = charge.R || 1;
      pillars.emit(X, g2, Z, 0.62, 2.8, COL.holy, 0.8);
      rings.emit(X, g2 + 0.05, Z, 0.3, R * 2.0, 0.55, COL.warm, 1, 0);
      rings.emit(X, g2 + 0.06, Z, 0.2, R * 1.3, 0.4, COL.gold, 0.9, 0);
      darkRings.emit(X, g2 + 0.02, Z, 0.3, R * 1.4, 1.0, COL.dustEnd, 0.55, 0);
      burst(sparkle, X, g2 + 0.5, Z, 22, 3, 0.4, 0.6, 0.3, 0.05, COL.white, COL.holy, 1, 1, 2);
      burst(add, X, g2 + 0.3, Z, 20, 3.4, 0.4, 0.45, 0.16, 0.03, COL.holy, COL.holyEnd, 1, 4, 1.5, g2);
      ringBurst(smoke, X, g2 + 0.08, Z, 18, 0.4, 2.6, 0.8, 0.3, 0.75, COL.dust, COL.dustEnd, 0.7, 0, 2.5, 0.3);
      for (let i = 0; i < 10; i++) {
        const th = rand() * TAU, sp = 1.5 + rand() * 2.5;
        debris.emit(X, g2 + 0.2, Z, Math.cos(th) * sp, 2.5 + rand() * 3, Math.sin(th) * sp, 0.04 + rand() * 0.05, COL.dustEnd, 1.3, g2);
      }
      screenFlash(COL.holy, 0.16, 0.3, 0.6);
      lightFlash(X, g2 + 1, Z, COL.holy, 2.5);
      addLight(charge.tx, charge.tz, R + 1.8, 0.8, 0.85, 0, 1);
      if (world.cam) world.cam.shake(0.22, 0.4);
    }
    if (charge.hit && charge.t > charge.travel + 0.2) charge.active = false;
  }

  function starburstFx(gx, gz, h) {
    const x = wx(gx), z = wz(gz), y = heroHeight(h) + 0.1;
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * TAU, sp = 1.8 + rand() * 1.6;
      sparkle.emit(x, y, z, Math.cos(a) * sp, 0.6 + rand() * 1.4, Math.sin(a) * sp, 0.6 + rand() * 0.3, 0.3, 0.05, i % 3 ? COL.white : COL.fairyPink, COL.starEnd, 1, 0, 2.2);
    }
    add.emit(x, y, z, 0, 0, 0, 0.3, 0.4, 1.8, COL.white, COL.star, 1);
    rings.emit(x, gyOf(gx, gz) + 0.05, z, 0.2, 1.8, 0.5, COL.star, 0.9, 0);
    rings.emit(x, gyOf(gx, gz) + 0.06, z, 0.4, 1.3, 0.7, COL.fairy, 0.6, 3, 1, 0, -5);
    lightFlash(x, y + 0.3, z, COL.star, 1.6);
    addLight(gx, gz, 2.4, 0.5, 0.35, 0.4, 1);
    if (world.cam) world.cam.shake(0.05, 0.2);
  }

  function pollenFx(gx, gz, R, dur) {
    let c = clouds[0];
    for (const k of clouds) { if (k.ttl <= 0) { c = k; break; } if (k.ttl < c.ttl) c = k; }
    Object.assign(c, { ttl: dur, max: dur, x: gx, z: gz, r: R });
    const x = wx(gx), z = wz(gz), gy = gyOf(gx, gz);
    for (let i = 0; i < 26; i++) {
      const a = rand() * TAU, d = Math.sqrt(rand()) * R * 0.6, sp = 0.8 + rand() * 1.4;
      smoke.emit(x + Math.cos(a) * d, gy + 0.25 + rand() * 0.3, z + Math.sin(a) * d, Math.cos(a) * sp, 0.3 + rand() * 0.3, Math.sin(a) * sp, 1.2 + rand() * 0.6, 0.35, 1.0, COL.pink, COL.pinkEnd, 0.55, -0.1, 1.8);
    }
    burst(sparkle, x, gy + 0.5, z, 20, 1.8, 0.5, 0.9, 0.22, 0.04, COL.pollen, COL.pink, 1, -0.2, 1.2, -99, R * 0.6);
    for (let i = 0; i < 14; i++) {
      const a = rand() * TAU, d = Math.sqrt(rand()) * R * 0.7;
      add.emit(x + Math.cos(a) * d, gy + 0.3 + rand() * 0.3, z + Math.sin(a) * d, Math.cos(a) * 0.8, 0.2, Math.sin(a) * 0.8, 1.1 + rand() * 0.4, 0.5, 1.2, COL.pink, COL.pinkEnd, 0.3, 0, 1.5);
    }
    rings.emit(x, gy + 0.05, z, 0.3, R * 1.15, 0.6, COL.pink, 0.9, 0);
    addLight(gx, gz, R + 0.8, 0.5, 0.2, 0.6, 0.9);
  }
  function cloudsUpdate(dt) {
    for (const c of clouds) {
      if (c.ttl <= 0) continue;
      c.ttl -= dt;
      const k = Math.min(1, c.ttl / 0.6, (c.max - c.ttl) / 0.3 + 0.3);
      const x = wx(c.x), z = wz(c.z), gy = gyOf(c.x, c.z);
      decalA.add(x, gy + 0.03, z, c.r * 1.08, 0, COL.pinkEnd, 0.32 * k, 1);
      decalA.add(x, gy + 0.035, z, c.r, time * 0.4, COL.pink, 0.45 * k, 3);
      if (dt > 0 && rand() < dt * 14 * c.r) {
        const a = rand() * TAU, d = Math.sqrt(rand()) * c.r * 0.85;
        smoke.emit(x + Math.cos(a) * d, gy + 0.15 + rand() * 0.35, z + Math.sin(a) * d, (rand() - 0.5) * 0.2, 0.1 + rand() * 0.15, (rand() - 0.5) * 0.2, 1.6, 0.45, 1.0, COL.pink, COL.pinkEnd, 0.4 * k, 0, 0.5);
      }
      if (dt > 0 && rand() < dt * 7 * c.r) {
        const a = rand() * TAU, d = Math.sqrt(rand()) * c.r * 0.8;
        add.emit(x + Math.cos(a) * d, gy + 0.2 + rand() * 0.4, z + Math.sin(a) * d, (rand() - 0.5) * 0.15, 0.06, (rand() - 0.5) * 0.15, 1.6, 0.6, 1.1, COL.pink, COL.pinkEnd, 0.2 * k, 0, 0.3);
      }
      if (dt > 0 && rand() < dt * 12 * c.r) {
        const a = rand() * TAU, d = Math.sqrt(rand()) * c.r;
        sparkle.emit(x + Math.cos(a) * d, gy + 0.1 + rand() * 0.6, z + Math.sin(a) * d, (rand() - 0.5) * 0.2, 0.25 + rand() * 0.3, (rand() - 0.5) * 0.2, 1.2, 0.14, 0.04, rand() < 0.5 ? COL.pollen : COL.white, COL.pink, 1);
      }
      pushLight(c.x, c.z, c.r + 0.3, 0.3, 0.5, 0.75 * k);
    }
  }

  function firestormFx(gx, gz, R) {
    const x = wx(gx), z = wz(gz), gy = gyOf(gx, gz);
    rings.emit(x, gy + 0.05, z, R * 0.9, R * 1.12, 1.0, COL.orange, 1, 3, 1, 1, 3);
    rings.emit(x, gy + 0.04, z, 0.2, R * 1.5, 0.55, COL.fire, 1, 0);
    // 火圈：一圈往上竄的火焰
    for (let i = 0; i < 40; i++) {
      const a = (i / 40) * TAU + rand() * 0.1;
      add.emit(x + Math.cos(a) * R, gy + 0.08, z + Math.sin(a) * R, Math.cos(a) * 0.3, 1.6 + rand() * 1.6, Math.sin(a) * 0.3, 0.7 + rand() * 0.3, 0.34, 0.06, COL.fire, COL.fireEnd, 1, -0.5, 1.6);
    }
    // 火柱：中間與周圍輪流噴發
    const n = 5;
    for (let i = 0; i < n; i++) {
      after(0.08 + i * 0.09, () => {
        const a = rand() * TAU, d = i === 0 ? 0 : R * (0.35 + rand() * 0.45);
        const px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d;
        pillars.emit(px, gy, pz, i === 0 ? 0.42 : 0.28, i === 0 ? 3.2 : 2.2, COL.fire, 0.75);
        burst(add, px, gy + 0.2, pz, 14, 2.4, 0.8, 0.5, 0.26, 0.05, COL.fireCore, COL.fireEnd, 1, -1, 1.8, -99, 0.15);
        burst(smoke, px, gy + 0.6, pz, 4, 0.7, 0.9, 1.1, 0.3, 0.8, COL.smokeDark, COL.smokeEnd, 0.5, -0.4, 1.4);
        rings.emit(px, gy + 0.05, pz, 0.1, 0.8, 0.35, COL.orange, 0.9, 0);
        lightFlash(px, gy + 1, pz, COL.orange, 2.2);
      });
    }
    // 天上落下的小火球
    for (let i = 0; i < 6; i++) {
      const a = rand() * TAU, d = R * (0.2 + rand() * 0.75);
      const ex = x + Math.cos(a) * d, ez = z + Math.sin(a) * d;
      fireDrops.emit(ex - 1.6, gy + 5 + rand(), ez - 1.2, ex, gy, ez, 0.35 + rand() * 0.15, 0.05 + i * 0.07, 0.1 + rand() * 0.06);
    }
    screenFlash(COL.orange, 0.14, 0.35, 0.6);
    addLight(gx, gz, R + 1.4, 1.4, 1, 0, 1);
    if (world.cam) world.cam.shake(0.22, 0.5);
  }

  function icefallFx(gx, gz, R) {
    const x = wx(gx), z = wz(gz), gy = gyOf(gx, gz);
    rings.emit(x, gy + 0.05, z, R, R * 0.95, 0.5, COL.frost, 0.7, 3, 1, 2, -2);
    const land = (main) => (sx, sy, sz, size) => {
      burst(hard, sx, sy + 0.15, sz, main ? 26 : 10, main ? 3 : 2.2, 0.6, 0.6, 0.07, 0.04, COL.white, COL.ice, 1, 8, 0.6, sy + 0.03, size);
      burst(add, sx, sy + 0.2, sz, main ? 16 : 8, 2.2, 0.4, 0.4, 0.16, 0.03, COL.frost, COL.frostEnd, 1, 2, 2);
      rings.emit(sx, sy + 0.05, sz, 0.1, main ? R * 1.6 : 0.8, main ? 0.6 : 0.35, COL.frost, 1, 0);
      for (let i = 0; i < (main ? 7 : 3); i++) {
        const a = rand() * TAU, d = rand() * (main ? R * 0.7 : 0.3);
        spikes.emit(sx + Math.cos(a) * d, sy, sz + Math.sin(a) * d, (main ? 0.35 : 0.22) + rand() * 0.25, 0.06 + rand() * 0.04, COL.ice, 1.4 + rand() * 0.6, rand() * 0.06, 0.5);
      }
      for (let i = 0; i < (main ? 10 : 4); i++) {
        const th = rand() * TAU, sp = 1 + rand() * 2;
        debris.emit(sx, sy + 0.2, sz, Math.cos(th) * sp, 2 + rand() * 2.5, Math.sin(th) * sp, 0.03 + rand() * 0.04, COL.ice, 1.1, sy);
      }
      if (main) {
        ringBurst(smoke, sx, sy + 0.1, sz, 18, R * 0.4, 2.2, 1.0, 0.3, 0.8, COL.white, COL.ice, 0.5, 0, 2.2, 0.2);
        screenFlash(COL.frost, 0.22, 0.4, 0.6);
        lightFlash(sx, sy + 1, sz, COL.blue, 2.5);
        addLight(sx + world.W / 2, sz + world.H / 2, R + 1.2, 0.9, 0, 1, 1);
        if (world.cam) world.cam.shake(0.25, 0.45);
      } else if (world.cam) world.cam.shake(0.06, 0.15);
    };
    shards.emit(x, gy + 7, gy, z, 0.42, 0.12, 0.55, land(true));
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU + rand() * 0.5, d = R * (0.45 + rand() * 0.4);
      shards.emit(x + Math.cos(a) * d, gy + 6 + rand(), gy, z + Math.sin(a) * d, 0.32 + rand() * 0.1, rand() * 0.35, 0.22 + rand() * 0.12, land(false));
    }
    addLight(gx, gz, R + 0.6, 0.6, 0, 0.9, 0.6);
  }

  // ---- 第二章事件
  function lanternOnFx(gx, gz) {
    const x = wx(gx), z = wz(gz), gy = gyOf(gx, gz), y = gy + 0.85;
    add.emit(x, y, z, 0, 0, 0, 0.35, 0.3, 1.5, COL.fireCore, COL.lantern, 1);
    rings.emit(x, gy + 0.05, z, 0.2, 2.6, 0.75, COL.lantern, 0.85, 0);
    rings.emit(x, gy + 0.06, z, 0.3, 1.2, 0.6, COL.gold, 0.7, 3, 1, 0, 2);
    burst(sparkle, x, y, z, 12, 1.4, 0.6, 0.7, 0.22, 0.04, COL.fireCore, COL.lantern, 1, -0.3, 1.5);
    for (let i = 0; i < 10; i++) add.emit(x + (rand() - 0.5) * 0.3, y, z + (rand() - 0.5) * 0.3, (rand() - 0.5) * 0.4, 0.6 + rand() * 0.8, (rand() - 0.5) * 0.4, 0.9, 0.08, 0.02, COL.lantern, COL.lanternEnd, 1, -0.2, 0.8);
    lightFlash(x, y, z, COL.lantern, 1.6);
    addLight(gx, gz, 3, 0.5, 1, 0, 0.7);
  }
  function lanternOutFx(gx, gz) {
    const x = wx(gx), z = wz(gz), gy = gyOf(gx, gz), y = gy + 0.85;
    burst(smoke, x, y, z, 10, 0.6, 0.85, 1.2, 0.18, 0.55, COL.smokeDark, COL.darkEnd, 0.75, -0.6, 1.6, -99, 0.15);
    for (let i = 0; i < 8; i++) add.emit(x + (rand() - 0.5) * 0.2, y, z + (rand() - 0.5) * 0.2, (rand() - 0.5) * 1.2, 0.5 + rand(), (rand() - 0.5) * 1.2, 0.6, 0.07, 0.02, COL.lantern, COL.redEnd, 1, 5, 0.5, gy + 0.03);
    darkRings.emit(x, gy + 0.025, z, 0.3, 1.8, 0.8, COL.darkEnd, 0.6, 1, 1, 0);
    rings.emit(x, gy + 0.05, z, 1.4, 0.2, 0.45, COL.purple, 0.6, 0, 1);
  }
  function inkFx(gx, gz, y0) {
    const x = wx(gx), z = wz(gz), gy = gyOf(gx, gz), y = ok(y0) && y0 > 0.3 ? y0 : 1.3;
    for (let i = 0; i < 22; i++) {
      const th = rand() * TAU, sp = 0.4 + rand() * 1.3;
      hard.emit(x, y, z, Math.cos(th) * sp, -0.3 - rand() * 1.2, Math.sin(th) * sp, 0.8 + rand() * 0.3, 0.08 + rand() * 0.06, 0.05, COL.ink, COL.inkEnd, 1, 6, 0.3, gy + 0.02);
    }
    burst(smoke, x, y, z, 8, 0.7, 0.2, 0.9, 0.2, 0.55, COL.ink, COL.inkEnd, 0.8, 0.4, 1.8);
    for (let i = 0; i < 10; i++) {
      const th = rand() * TAU, sp = 0.4 + rand() * 1.2;
      add.emit(x, y, z, Math.cos(th) * sp, -0.3 - rand(), Math.sin(th) * sp, 0.7, 0.09, 0.03, COL.purple, COL.purpleEnd, 0.8, 6, 0.3, gy + 0.02);
    }
    after(0.35, () => {
      darkRings.emit(x, gy + 0.02, z, 0.3, 1.25, 3.2, COL.inkSplat, 0.95, 2, 1, 1);
      darkRings.emit(x, gy + 0.025, z, 0.1, 0.7, 2.8, COL.inkEnd, 0.85, 1, 1, 1);
      rings.emit(x, gy + 0.03, z, 0.3, 1.3, 0.8, COL.purple, 0.5, 0);
    });
    burst(add, x, y, z, 6, 1, 0.2, 0.4, 0.12, 0.03, COL.purple, COL.purpleEnd, 0.8, 0, 2);
  }
  function burrowFx(gx, gz, big) {
    const x = wx(gx), z = wz(gz), gy = gyOf(gx, gz), k = big ? 1.8 : 1;
    ringBurst(smoke, x, gy + 0.08, z, big ? 18 : 10, 0.25 * k, 1.4 * k, 0.8, 0.22 * k, 0.6 * k, COL.dirt, COL.dirtEnd, 0.75, 0, 2.6, 0.3);
    burst(hard, x, gy + 0.15, z, big ? 24 : 12, 2.4 * k, 0.75, 0.7, 0.06 * k, 0.04, COL.dirt, COL.dirtEnd, 1, 8, 0.5, gy + 0.03, 0.2 * k);
    for (let i = 0; i < (big ? 14 : 6); i++) {
      const th = rand() * TAU, sp = 0.8 + rand() * 1.4 * k;
      debris.emit(x, gy + 0.15, z, Math.cos(th) * sp, 2 + rand() * 2 * k, Math.sin(th) * sp, (0.035 + rand() * 0.04) * k, rand() < 0.5 ? COL.dirtEnd : COL.dirt, 1.1, gy);
    }
    darkRings.emit(x, gy + 0.02, z, 0.2 * k, 0.7 * k, 2.2, COL.dirtDark, 0.85, 2, 1, 1);
    mounds.emit(x, gy, z, 0.34 * k, 0.17 * k, 2.4, COL.dirt);
    if (big && world.cam) world.cam.shake(0.18, 0.4);
  }
  function emergeFx(gx, gz, big) {
    const x = wx(gx), z = wz(gz), gy = gyOf(gx, gz), k = big ? 2.4 : 1.2;
    burst(hard, x, gy + 0.2, z, big ? 40 : 16, 3.2 * k * 0.8, 0.85, 0.9, 0.07 * k * 0.8, 0.04, COL.dirt, COL.dirtEnd, 1, 8, 0.4, gy + 0.03, 0.3 * k);
    ringBurst(smoke, x, gy + 0.08, z, big ? 26 : 12, 0.3 * k, 1.8 * k, 1.0, 0.3 * k, 0.8 * k, COL.dirt, COL.dirtEnd, 0.8, 0, 2.2, 0.5);
    burst(smoke, x, gy + 0.3, z, big ? 12 : 5, 0.8, 0.9, 1.1, 0.3 * k, 0.8 * k, COL.dirtEnd, COL.smokeEnd, 0.6, -0.3, 1.5, -99, 0.3 * k);
    for (let i = 0; i < (big ? 30 : 10); i++) {
      const th = rand() * TAU, sp = 1 + rand() * 2 * k;
      debris.emit(x + Math.cos(th) * 0.2 * k, gy + 0.2, z + Math.sin(th) * 0.2 * k, Math.cos(th) * sp, 3 + rand() * 3 * k, Math.sin(th) * sp, (0.04 + rand() * 0.05) * (big ? 1.6 : 1), rand() < 0.5 ? COL.dirtEnd : COL.smokeDark, 1.4, gy);
    }
    darkRings.emit(x, gy + 0.02, z, 0.3 * k, 0.9 * k, 3.0, COL.dirtDark, 0.9, 2, 1, 1);
    rings.emit(x, gy + 0.04, z, 0.2, 1.3 * k, 0.5, COL.dust, 0.6, 0);
    // 冒出後留下一圈土堆
    for (let i = 0; i < (big ? 7 : 4); i++) {
      const a = (i / (big ? 7 : 4)) * TAU + rand() * 0.5, d = 0.32 * k;
      mounds.emit(x + Math.cos(a) * d, gy, z + Math.sin(a) * d, (0.13 + rand() * 0.06) * k, (0.08 + rand() * 0.05) * k, 3 + rand(), rand() < 0.5 ? COL.dirt : COL.dirtEnd);
    }
    if (big) {
      darkRings.emit(x, gy + 0.03, z, 0.5, 3.2, 0.9, COL.dustEnd, 0.7, 0);
      screenFlash(COL.wormEnd, 0.25, 0.6, 0.85);
      if (world.cam) world.cam.shake(0.4, 0.8);
    } else if (world.cam) world.cam.shake(0.05, 0.18);
  }
  function revealFx(gx, gz) {
    const x = wx(gx), z = wz(gz), gy = gyOf(gx, gz);
    rings.emit(x, gy + 0.05, z, 0.1, 1.1, 0.55, COL.ghost, 0.9, 0);
    rings.emit(x, gy + 0.06, z, 0.8, 0.2, 0.5, COL.ghostEnd, 0.7, 0, 1);
    burst(sparkle, x, gy + 0.5, z, 12, 1.4, 0.4, 0.6, 0.22, 0.04, COL.white, COL.ghost, 1, -0.3, 2);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU;
      add.emit(x + Math.cos(a) * 0.35, gy + 0.2, z + Math.sin(a) * 0.35, -Math.sin(a) * 0.8, 0.9 + rand() * 0.6, Math.cos(a) * 0.8, 0.7, 0.16, 0.03, COL.ghost, COL.ghostEnd, 0.9, -0.3, 1.5);
    }
    add.emit(x, gy + 0.45, z, 0, 0, 0, 0.25, 0.3, 1.1, COL.white, COL.ghost, 0.8);
  }
  function segmentFx(gx, gz) {
    const x = wx(gx), z = wz(gz), gy = gyOf(gx, gz), y = gy + 0.6;
    burst(hard, x, y, z, 22, 2.8, 0.6, 0.7, 0.09, 0.05, COL.worm, COL.wormEnd, 1, 8, 0.6, gy + 0.03, 0.3);
    burst(hard, x, y, z, 10, 2.2, 0.6, 0.6, 0.07, 0.04, COL.wormGoo, COL.gooEnd, 1, 8, 0.6, gy + 0.03, 0.2);
    burst(add, x, y, z, 14, 2, 0.4, 0.45, 0.2, 0.04, COL.purple, COL.purpleEnd, 1, 1, 2);
    burst(smoke, x, y, z, 8, 0.9, 0.6, 1.0, 0.3, 0.8, COL.wormEnd, COL.darkEnd, 0.7, -0.3, 1.5, -99, 0.3);
    rings.emit(x, gy + 0.05, z, 0.2, 1.6, 0.5, COL.worm, 0.9, 0);
    darkRings.emit(x, gy + 0.02, z, 0.2, 1.0, 2.5, COL.wormEnd, 0.8, 2, 1, 1);
    for (let i = 0; i < 8; i++) {
      const th = rand() * TAU, sp = 1 + rand() * 2.4;
      debris.emit(x, y, z, Math.cos(th) * sp, 2 + rand() * 3, Math.sin(th) * sp, 0.05 + rand() * 0.06, rand() < 0.5 ? COL.worm : COL.wormEnd, 1.4, gy);
    }
    lightFlash(x, y + 0.4, z, COL.purple, 1.6);
    if (world.cam) world.cam.shake(0.16, 0.35);
  }
  function eatFx(gx, gz) {
    const x = wx(gx), z = wz(gz), gy = gyOf(gx, gz);
    // 光被吸進去：從外圈往中心收的暖光粒子＋往內縮的黑環
    for (let i = 0; i < 30; i++) {
      const a = rand() * TAU, d = 1.0 + rand() * 0.8, y = gy + 0.2 + rand() * 1.0;
      add.emit(x + Math.cos(a) * d, y, z + Math.sin(a) * d, -Math.cos(a) * d * 3.2, (gy + 0.6 - y) * 3, -Math.sin(a) * d * 3.2, 0.3, 0.16, 0.04, COL.lantern, COL.lanternEnd, 1, 0, 0);
    }
    darkRings.emit(x, gy + 0.03, z, 2.0, 0.2, 0.55, COL.darkEnd, 0.9, 1, 1, 0);
    rings.emit(x, gy + 0.05, z, 1.8, 0.1, 0.5, COL.worm, 0.8, 0, 1);
    after(0.3, () => {
      burst(smoke, x, gy + 0.6, z, 14, 1.2, 0.7, 1.3, 0.35, 1.0, COL.wormEnd, COL.darkEnd, 0.8, -0.3, 1.4, -99, 0.4);
      burst(hard, x, gy + 0.4, z, 14, 2.4, 0.7, 0.7, 0.07, 0.04, COL.dirt, COL.dirtEnd, 1, 8, 0.5, gy + 0.03, 0.3);
      for (let i = 0; i < 8; i++) {
        const th = rand() * TAU, sp = 1 + rand() * 2;
        debris.emit(x, gy + 0.3, z, Math.cos(th) * sp, 2 + rand() * 2.5, Math.sin(th) * sp, 0.04 + rand() * 0.04, COL.smoke, 1.2, gy);
      }
      screenFlash(COL.wormEnd, 0.2, 0.5, 0.85);
      if (world.cam) world.cam.shake(0.25, 0.45);
    });
  }

  // ---- 每幀：雷射、潛地土痕、光源光暈
  const laserCols = [COL.prismA, COL.prismB, COL.prismC];
  const burrowTrack = new Map();   // 敵人 id → { x, z }（上一次留下土痕的位置）
  function laserHeight(t) { return t.branch ? 1.8 : 1.2 + 0.15 * Math.min(3, t.level || 1); }
  function chapter2Update(dt) {
    beams.begin();
    mounds.begin();
    if (!state) { beams.end(dt); mounds.update(dt); return; }
    const cam = world.camera;
    if (state.towers) for (const t of state.towers) {
      const L = t.lasers;
      if (!L || !L.length) continue;
      const ax = wx(t.x), az = wz(t.z), ay = laserHeight(t);
      const style = t.branch === 'a' ? 1 : t.branch === 'b' ? 2 : 0;
      let maxP = 0;
      for (let i = 0; i < L.length; i++) {
        const b = L[i];
        if (!ok(b.x) || !ok(b.z)) continue;
        const p = Math.max(0, Math.min(1, ok(b.power) ? b.power : 1));
        maxP = Math.max(maxP, p);
        let by = ok(b.y) ? b.y : 0;
        if (by < 0.1) by += 0.38;
        const bx = wx(b.x), bz = wz(b.z);
        const col = style === 1 ? laserCols[i % 3] : style === 2 ? COL.focus : COL.prism;
        const w = (0.2 + 0.28 * p) * (style === 2 ? 1.7 : style === 1 ? 0.8 : 1);   // 帶狀寬度（含外圍光暈）
        beams.add(ax, ay, az, bx, by, bz, w, col, p, style, (t.id * 0.37 + i * 0.21) % 1, cam, style === 2 ? 0.9 + p : 0);
        if (dt > 0) {
          add.emit(bx, by, bz, 0, 0, 0, 0.07, 0.2 + 0.35 * p, 0.12, COL.white, col, 0.8);
          if (rand() < dt * (6 + 22 * p)) add.emit(bx, by, bz, (rand() - 0.5) * 2.4, rand() * 1.8, (rand() - 0.5) * 2.4, 0.3, 0.08, 0.02, COL.white, col, 1, 6, 1);
          if (rand() < dt * 8 * p) sparkle.emit(bx + (rand() - 0.5) * 0.2, by + (rand() - 0.5) * 0.2, bz + (rand() - 0.5) * 0.2, 0, 0.4, 0, 0.3, 0.2, 0.04, COL.white, col, 1);
        }
      }
      if (dt > 0 && maxP > 0) add.emit(ax, ay, az, 0, 0, 0, 0.07, 0.3 + 0.35 * maxP, 0.15, COL.white, COL.prism, 0.8);
    }
    beams.end(dt);
    // 潛地中的敵人：地面隆起＋一路留下土痕＋偶爾翻出土塊
    if (state.enemies) {
      for (const e of state.enemies) {
        if (!e.burrowed) { if (burrowTrack.size) burrowTrack.delete(e.id); continue; }
        const big = BIG_BURROWERS.has(e.type);
        const x = wx(e.x), z = wz(e.z), gy = gyOf(e.x, e.z), k = big ? 2 : 1;
        decalN.add(x, gy + 0.018, z, 0.36 * k, 0, COL.dirtDark, 0.85, 1);
        mounds.add(x, gy, z, 0.24 * k, (0.1 + 0.025 * Math.sin(time * 14 + e.id)) * k, e.id + time * 0.5, COL.dirt);
        let tr = burrowTrack.get(e.id);
        if (!tr) { tr = { x: e.x, z: e.z }; burrowTrack.set(e.id, tr); }
        if (Math.hypot(e.x - tr.x, e.z - tr.z) > 0.22) {
          trailQ.emit(x, gy + 0.012, z, 0.2 * k, 0.26 * k, 2.6, COL.dirtDark, 0.7, 1, 0, 1);
          tr.x = e.x; tr.z = e.z;
        }
        if (dt > 0 && rand() < dt * 10 * k) hard.emit(x + (rand() - 0.5) * 0.2 * k, gy + 0.06, z + (rand() - 0.5) * 0.2 * k, (rand() - 0.5) * 1.2, 1 + rand() * 1.2, (rand() - 0.5) * 1.2, 0.45, 0.05 * k, 0.03, COL.dirt, COL.dirtEnd, 1, 8, 0.3, gy + 0.02);
        if (dt > 0 && rand() < dt * 3 * k) smoke.emit(x, gy + 0.1, z, 0, 0.25, 0, 0.8, 0.15 * k, 0.4 * k, COL.dirt, COL.dirtEnd, 0.5, 0, 1);
      }
      if (burrowTrack.size > 64) burrowTrack.clear();
    }
    mounds.update(dt);
    // 黑暗中的光源光暈：燈籠暖光圈、被照亮的水晶
    if (state.lights && world.isDark && world.isDark()) {
      for (const L of state.lights) {
        if (L.on === false || !ok(L.x) || !ok(L.z)) continue;
        if (L.kind === 'lantern') {
          const x = wx(L.x), z = wz(L.z), gy = gyOf(L.x, L.z);
          decalA.add(x, gy + 0.02, z, Math.min(1.6, (L.r || 2) * 0.55), 0, COL.lanternEnd, 0.2 + 0.04 * Math.sin(time * 7 + L.x), 1);
        } else if (L.kind === 'crystal') {
          const x = wx(L.x), z = wz(L.z), gy = gyOf(L.x, L.z);
          decalA.add(x, gy + 0.02, z, 1.1, time * 0.5, COL.crystalGlow, 0.28 + 0.08 * Math.sin(time * 3 + L.z), 1);
          if (dt > 0) add.emit(x, gy + 0.5, z, 0, 0, 0, 0.06, 0.9 + 0.1 * Math.sin(time * 4 + L.x), 0.12, COL.crystalGlow, COL.crystalGlow, 0.35);
          if (dt > 0 && rand() < dt * 2.5) sparkle.emit(x + (rand() - 0.5) * 0.4, gy + 0.3 + rand() * 0.5, z + (rand() - 0.5) * 0.4, 0, 0.25, 0, 0.8, 0.2, 0.04, COL.white, COL.crystalGlow, 1);
        }
      }
    }
  }

  // ------------------------------------------------------------------ 事件
  function handle(ev) {
    if (!ev || !ev.type || !world.level) return;
    switch (ev.type) {
      case 'spawn': {
        const e = findEnemy(ev.id);
        const px = ok(ev.x) ? ev.x : e && e.x, pz = ok(ev.z) ? ev.z : e && e.z;
        if (!ok(px) || !ok(pz)) return;
        const x = wx(px), z = wz(pz), y = (ev.flying || (e && e.flying) ? 1.3 : 0) + 0.4;
        burst(add, x, y, z, 10, 1.2, 0.5, 0.6, 0.16, 0.04, COL.purple, COL.purpleEnd, 0.9, -0.4, 2);
        rings.emit(x, 0.04, z, 0.1, 0.65, 0.45, COL.purple, 0.8, 0);
        if (BIG_BURROWERS.has(ev.enemy || (e && e.type))) emergeFx(px, pz, true);   // v2.0：巨蟲／地鼠王竄出
        break;
      }
      case 'death': {
        if (!ok(ev.x) || !ok(ev.z)) return;
        const s = sizeOf(ev.enemy);
        const x = wx(ev.x), z = wz(ev.z), y = (ev.y || 0) + s * 0.35;
        burst(smoke, x, y, z, 7 + Math.round(s * 4), 0.9 * (0.6 + s * 0.4), 0.7, 0.85, 0.28 * s + 0.12, 0.6 * s + 0.25, COL.smoke, COL.smokeEnd, 0.7, -0.5, 2.2, -99, s * 0.3);
        burst(add, x, y, z, 6, 1.6, 0.6, 0.4, 0.1, 0.02, COL.warm, COL.spark, 0.9, 0, 2);
        if (ev.gold > 0) {
          for (let i = 0; i < Math.min(5, 1 + Math.floor(ev.gold / 4)); i++) {
            const th = rand() * TAU;
            hard.emit(x, y, z, Math.cos(th) * 0.8, 2.4 + rand(), Math.sin(th) * 0.8, 0.7, 0.07, 0.05, COL.gold, COL.goldEnd, 1, 8, 0.5, 0.05);
          }
          goldText(ev.gold, x, y + 0.35, z);
        }
        if (ENEMY_DATA.ENEMIES && ENEMY_DATA.ENEMIES[ev.enemy] && ENEMY_DATA.ENEMIES[ev.enemy].boss) {
          if (world.cam) world.cam.shake(0.25, 0.6);
          rings.emit(x, 0.05, z, 0.3, 3.5, 0.9, COL.warm, 0.9, 0);
          burst(add, x, y, z, 40, 3, 0.5, 1.0, 0.2, 0.04, COL.gold, COL.goldEnd, 1, 1, 1.5);
        }
        break;
      }
      case 'leak': {
        const lp = world.lampPos;
        if (!lp) return;
        const x = wx(lp.x), z = wz(lp.z);
        world.flashLamp && world.flashLamp(0.7);
        rings.emit(x, 0.05, z, 0.3, 2.4, 0.7, COL.red, 1, 0);
        rings.emit(x, 0.06, z, 0.2, 1.4, 0.5, COL.redEnd, 0.8, 3, 1, 0, 1.5);
        burst(add, x, 0.9, z, 16, 1.8, 0.6, 0.7, 0.16, 0.03, COL.red, COL.redEnd, 1, -0.5, 1.5, -99, 0.4);
        screenFlash(COL.redEnd, (ev.damage || 1) > 1 ? 0.35 : 0.22, 0.5, 0.85);
        if (world.cam) world.cam.shake(0.07 + Math.min(0.2, (ev.damage || 1) * 0.03), 0.3);
        break;
      }
      case 'shoot': {
        if (!ok(ev.x) || !ok(ev.z)) return;
        const x = wx(ev.x), z = wz(ev.z), y = ev.y || 1;
        if (ev.kind === 'rock' || ev.kind === 'boulder' || ev.kind === 'firebomb') {
          burst(smoke, x, y, z, 3, 0.6, 0.6, 0.5, 0.15, 0.35, COL.dust, COL.dustEnd, 0.6, -0.3, 2);
          if (ev.kind === 'firebomb') burst(add, x, y, z, 4, 0.8, 0.6, 0.3, 0.12, 0.03, COL.fire, COL.fireEnd, 1);
        } else if (ev.kind === 'orb') {
          burst(add, x, y, z, 5, 0.9, 0.3, 0.35, 0.12, 0.03, COL.magic, COL.magicEnd, 1);
        } else if (ev.kind === 'frost') {
          burst(add, x, y, z, 5, 0.9, 0.3, 0.35, 0.12, 0.03, COL.frost, COL.frostEnd, 1);
        } else {
          add.emit(x, y, z, 0, 0, 0, 0.08, 0.14, 0.3, COL.white, COL.warm, 0.6);
        }
        break;
      }
      case 'hit': {
        if (!ok(ev.x) || !ok(ev.z)) return;
        if (ev.kind === 'lightning') return;              // 閃電的命中光由 beam 事件畫
        let y = ok(ev.y) ? ev.y : 0;
        if (y < 0.1) y += 0.35;                           // 沒給高度時補到身體中段
        if (ev.kind === 'meteor') { burst(add, wx(ev.x), y, wz(ev.z), 5, 1.8, 0.5, 0.35, 0.12, 0.03, COL.fire, COL.fireEnd, 1, 2, 2); return; }
        // v2.0：英雄投射物的命中大特效由「投射物消失」畫，這裡只補一點火花
        if (ev.kind === 'fairyBolt' || ev.kind === 'starBolt') { burst(sparkle, wx(ev.x), y, wz(ev.z), 3, 1.2, 0.3, 0.3, 0.18, 0.04, COL.white, ev.kind === 'starBolt' ? COL.star : COL.fairy, 1); return; }
        if (ev.kind === 'fireball') { burst(add, wx(ev.x), y, wz(ev.z), 5, 1.8, 0.4, 0.3, 0.12, 0.03, COL.fire, COL.fireEnd, 1, 2, 2); return; }
        if (ev.kind === 'laser') { if (rand() < 0.3) burst(add, wx(ev.x), y, wz(ev.z), 2, 1.2, 0.3, 0.2, 0.08, 0.02, COL.white, COL.prism, 1); return; }
        if (ev.kind === 'whirl' || ev.kind === 'charge' || ev.kind === 'sword') { burst(add, wx(ev.x), y, wz(ev.z), 6, 2.6, 0.35, 0.28, 0.09, 0.02, COL.spark, COL.sparkEnd, 1, 7, 1.4); return; }
        hitFx(wx(ev.x), y, wz(ev.z), ev.kind, ev.dmgType);
        break;
      }
      case 'explode':
        if (!ok(ev.x) || !ok(ev.z)) return;
        if (ev.kind === 'fireball') { fireballBlast(ev.x, ev.z, ok(ev.y) ? ev.y : 0.5, ev.radius || 0.9); return; }   // v2.0 法師火球
        if (ev.kind === 'firestorm' || ev.kind === 'icefall' || ev.kind === 'whirl' || ev.kind === 'charge') return;   // 技能大特效由 heroSkill 畫
        explodeFx(wx(ev.x), wz(ev.z), ev.radius, ev.kind);
        if (ev.kind === 'fire' || ev.kind === 'boulder') addLight(ev.x, ev.z, (ev.radius || 1) + 1, 0.5, 1, 0, 0.8);
        break;
      case 'beam': {
        const pts = ev.points;
        if (!pts || pts.length < 2) return;
        const tmp = [];
        for (const p of pts) {
          let y = ok(p.y) ? p.y : 0; if (y < 0.1) y += 0.4;
          tmp.push({ x: wx(p.x), y, z: wz(p.z) });
        }
        bolts.emit(tmp, COL.bolt, 0.3, 0.16);
        bolts.emit(tmp, COL.lightning, 0.22, 0.07);
        for (let i = 1; i < tmp.length; i++) {
          burst(add, tmp[i].x, tmp[i].y, tmp[i].z, 5, 1.8, 0.2, 0.3, 0.1, 0.02, COL.boltCore, COL.bolt, 1, 3, 2);
          add.emit(tmp[i].x, tmp[i].y, tmp[i].z, 0, 0, 0, 0.14, 0.2, 0.6, COL.white, COL.bolt, 1);
        }
        break;
      }
      case 'pulse': {
        if (!ok(ev.x) || !ok(ev.z)) return;
        const x = wx(ev.x), z = wz(ev.z), r = ev.radius || 1.5;
        const kind = ev.kind || 'vines';
        const col = kind === 'roots' ? COL.root : kind === 'thorns' ? COL.thorn : COL.leaf;
        rings.emit(x, 0.05, z, 0.3, r, 0.55, kind === 'roots' ? COL.dust : COL.leaf, 0.75, 0);
        rings.emit(x, 0.04, z, r * 0.6, r * 0.95, 0.7, kind === 'roots' ? COL.root : COL.leafEnd, 0.5, 3, 1, 2, 0.6);
        const n = kind === 'thorns' ? 14 : kind === 'roots' ? 9 : 7;
        for (let i = 0; i < n; i++) {
          const a = rand() * TAU, d = Math.sqrt(rand()) * r * 0.9;
          const h = kind === 'thorns' ? 0.25 + rand() * 0.25 : kind === 'roots' ? 0.18 + rand() * 0.2 : 0.2 + rand() * 0.18;
          spikes.emit(x + Math.cos(a) * d, 0, z + Math.sin(a) * d, h, kind === 'roots' ? 0.06 : 0.045, col, 0.65 + rand() * 0.25, rand() * 0.18, kind === 'roots' ? 0.6 : 0.3);
        }
        burst(hard, x, 0.1, z, kind === 'roots' ? 6 : 12, 1.2, 0.8, 0.8, 0.06, 0.04, kind === 'roots' ? COL.dust : COL.leaf, kind === 'roots' ? COL.dustEnd : COL.leafEnd, 1, 2.5, 1.5, 0.03, r);
        break;
      }
      case 'status': {
        const e = findEnemy(ev.id);
        if (!e) return;
        const s = sizeOf(e.type);
        const x = wx(e.x), z = wz(e.z), y = (e.y || 0) + s * 0.45;
        switch (ev.kind) {
          case 'slow': burst(add, x, y, z, 5, 0.6, 0.1, 0.5, 0.1, 0.03, COL.blue, COL.frostEnd, 0.9, 1.5); break;
          case 'freeze':
            burst(add, x, y, z, 12, 1.5, 0.3, 0.5, 0.13, 0.03, COL.frost, COL.frostEnd, 1, 1, 2);
            rings.emit(x, 0.05, z, 0.1, 0.6 + s * 0.3, 0.45, COL.frost, 0.8, 0);
            break;
          case 'root':
            for (let i = 0; i < 5; i++) {
              const a = (i / 5) * TAU + rand();
              spikes.emit(x + Math.cos(a) * s * 0.35, 0, z + Math.sin(a) * s * 0.35, 0.2 + rand() * 0.12, 0.04, COL.root, 0.55, i * 0.03, 0.6);
            }
            break;
          case 'stun': burst(add, x, y + s * 0.4, z, 8, 1.2, 0.5, 0.45, 0.12, 0.03, COL.gold, COL.goldEnd, 1, 2, 2); break;
          case 'burn': burst(add, x, y, z, 10, 1.2, 0.8, 0.5, 0.18, 0.05, COL.fire, COL.fireEnd, 1, -1.5, 2); break;
          case 'shield':
            burst(add, x, y, z, 12, 1.2, 0.3, 0.55, 0.12, 0.03, COL.purple, COL.blue, 1, -0.5, 2);
            rings.emit(x, 0.05, z, 0.1, 0.5 + s * 0.4, 0.5, COL.purple, 0.8, 3, 1, 3);
            break;
          default: break;
        }
        break;
      }
      case 'split': case 'summon': {
        if (!ok(ev.x) || !ok(ev.z)) return;
        const x = wx(ev.x), z = wz(ev.z);
        if (ev.type === 'split') {
          burst(hard, x, 0.35, z, 14, 2.4, 0.6, 0.7, 0.07, 0.04, COL.goo, COL.gooEnd, 1, 8, 0.8, 0.03);
          rings.emit(x, 0.04, z, 0.1, 0.9, 0.4, COL.goo, 0.8, 0);
        } else {
          burst(add, x, 0.4, z, 16, 1.4, 0.5, 0.6, 0.15, 0.03, COL.purple, COL.purpleEnd, 1, -0.5, 2);
          burst(smoke, x, 0.3, z, 6, 0.6, 0.6, 0.8, 0.25, 0.5, COL.dark, COL.darkEnd, 0.6, -0.3, 2);
          rings.emit(x, 0.05, z, 0.1, 0.9, 0.5, COL.purple, 0.9, 3, 1, 3);
        }
        break;
      }
      case 'dim': {
        if (!ok(ev.x) || !ok(ev.z)) return;
        const x = wx(ev.x), z = wz(ev.z), r = ev.radius || 4;
        darkRings.emit(x, 0.03, z, 0.4, r, 0.9, COL.darkEnd, 0.85, 1);
        darkRings.emit(x, 0.025, z, r * 0.3, r * 0.9, 1.4, COL.dark, 0.5, 1, 1, 2);
        rings.emit(x, 0.05, z, 0.3, r * 1.05, 0.8, COL.purple, 0.7, 3, 1, 0, -1.2);
        ringBurst(smoke, x, 0.25, z, 26, 0.4, r * 0.9, 1.1, 0.35, 0.8, COL.dark, COL.darkEnd, 0.75, -0.4, 1.4, 0.4);
        burst(add, x, 0.8, z, 18, 1.5, 0.4, 0.8, 0.14, 0.03, COL.purple, COL.purpleEnd, 1, -0.4, 1.5, -99, r * 0.5);
        screenFlash(COL.darkEnd, 0.28, 0.9, 0.9);
        break;
      }
      case 'build': {
        const t = towerXZ(ev);
        if (!t) return;
        const x = wx(t.x), z = wz(t.z), gy = Math.max(0, world.groundHeight(t.x, t.z));
        ringBurst(smoke, x, gy + 0.08, z, 14, 0.35, 1.5, 0.75, 0.22, 0.55, COL.dust, COL.dustEnd, 0.8, 0, 2.8, 0.25);
        for (let i = 0; i < 5; i++) {
          const th = rand() * TAU;
          debris.emit(x, gy + 0.3, z, Math.cos(th) * 1.3, 2 + rand() * 1.5, Math.sin(th) * 1.3, 0.035 + rand() * 0.03, COL.dustEnd, 0.9, gy);
        }
        darkRings.emit(x, gy + 0.02, z, 0.2, 0.9, 0.6, COL.dustEnd, 0.5, 0);
        burst(add, x, gy + 0.6, z, 8, 1.2, 0.6, 0.5, 0.1, 0.02, COL.warm, COL.spark, 0.9, 0, 2, -99, 0.4);
        break;
      }
      case 'upgrade': {
        const t = towerXZ(ev);
        if (!t) return;
        const x = wx(t.x), z = wz(t.z), gy = Math.max(0, world.groundHeight(t.x, t.z));
        const branch = !!ev.branch || ev.level >= 4;
        pillars.emit(x, gy, z, 0.48, branch ? 2.6 : 1.9, branch ? COL.holy : COL.gold, 0.9);
        rings.emit(x, gy + 0.05, z, 0.2, 0.9, 0.6, COL.gold, 0.9, 3, 1, 2.5);
        for (let i = 0; i < (branch ? 26 : 16); i++) {
          const a = rand() * TAU, d = 0.25 + rand() * 0.3;
          add.emit(x + Math.cos(a) * d, gy + 0.1 + rand() * 0.4, z + Math.sin(a) * d, 0, 1.2 + rand() * 1.6, 0, 0.8 + rand() * 0.4, 0.11, 0.03, COL.holy, COL.goldEnd, 1, -0.3, 1);
        }
        break;
      }
      case 'sell': {
        const t = towerXZ(ev);
        if (!t) return;
        const x = wx(t.x), z = wz(t.z), gy = Math.max(0, world.groundHeight(t.x, t.z));
        for (let i = 0; i < 14; i++) {
          const th = rand() * TAU, s = 0.5 + rand() * 1.2;
          hard.emit(x, gy + 0.5, z, Math.cos(th) * s, 2.6 + rand() * 1.6, Math.sin(th) * s, 0.9, 0.08, 0.06, COL.gold, COL.goldEnd, 1, 8, 0.4, gy + 0.04);
        }
        ringBurst(smoke, x, gy + 0.08, z, 10, 0.3, 1.2, 0.6, 0.2, 0.45, COL.dust, COL.dustEnd, 0.7, 0, 2.8, 0.2);
        goldText(ev.gold, x, gy + 1.0, z);
        break;
      }
      case 'gold': {
        if (!ok(ev.x) || !ok(ev.z)) return;
        const x = wx(ev.x), z = wz(ev.z);
        goldText(ev.amount, x, Math.max(0, world.groundHeight(ev.x, ev.z)) + 0.8, z);
        break;
      }
      case 'waveStart':
        if (ev.boss) { if (world.cam) world.cam.shake(0.18, 0.9); screenFlash(COL.redEnd, 0.22, 1.2, 0.9); }
        break;
      case 'waveCleared': {
        const lp = world.lampPos;
        if (!lp) return;
        rings.emit(wx(lp.x), 0.05, wz(lp.z), 0.4, 2.2, 0.8, COL.gold, 0.7, 3, 1, 1.5);
        burst(add, wx(lp.x), 1.3, wz(lp.z), 14, 1.2, 0.3, 0.8, 0.12, 0.03, COL.holy, COL.goldEnd, 1, -0.2, 1.5);
        break;
      }
      case 'heroAttack': heroAttackFx(ev); break;      // v2.0：sword／bolt／fireball 各有特效
      case 'heroSkill': heroSkillFx(ev); break;
      // ---- v2.0 第二章
      case 'lanternOn': { const t = towerXZ(ev); if (t) lanternOnFx(t.x, t.z); break; }
      case 'lanternOut': { const t = towerXZ(ev); if (t) lanternOutFx(t.x, t.z); break; }
      case 'ink': {
        const e = findEnemy(ev.id);
        const px = ok(ev.x) ? ev.x : e && e.x, pz = ok(ev.z) ? ev.z : e && e.z;
        if (ok(px) && ok(pz)) inkFx(px, pz, ok(ev.y) ? ev.y : e ? e.y : 1.3);
        break;
      }
      case 'burrow': case 'emerge': {
        const e = findEnemy(ev.id);
        const px = ok(ev.x) ? ev.x : e && e.x, pz = ok(ev.z) ? ev.z : e && e.z;
        if (!ok(px) || !ok(pz)) return;
        const big = BIG_BURROWERS.has(ev.enemy || (e && e.type));
        if (ev.type === 'burrow') burrowFx(px, pz, big); else emergeFx(px, pz, big);
        break;
      }
      case 'reveal': {
        const e = findEnemy(ev.id);
        const px = ok(ev.x) ? ev.x : e && e.x, pz = ok(ev.z) ? ev.z : e && e.z;
        if (ok(px) && ok(pz)) revealFx(px, pz);
        break;
      }
      case 'segment': {
        const e = findEnemy(ev.id);
        const px = ok(ev.x) ? ev.x : e && e.x, pz = ok(ev.z) ? ev.z : e && e.z;
        if (ok(px) && ok(pz)) segmentFx(px, pz);
        break;
      }
      case 'eat': { const t = towerXZ(ev); if (t) eatFx(t.x, t.z); break; }
      case 'laserOn': {
        const t = findTower(ev.towerId);
        if (!t || !ok(t.x)) return;
        const y = t.type ? laserHeight(t) : 1.4;
        burst(sparkle, wx(t.x), y, wz(t.z), 8, 1.4, 0.3, 0.35, 0.24, 0.05, COL.white, COL.prism, 1, 0, 2.5);
        add.emit(wx(t.x), y, wz(t.z), 0, 0, 0, 0.2, 0.2, 0.8, COL.white, COL.prism, 0.9);
        break;
      }
      case 'heroHurt': {
        const h = heroXZ(ev);
        if (!h) return;
        burst(add, wx(h.x), 0.5, wz(h.z), 6, 1.6, 0.4, 0.3, 0.09, 0.02, COL.red, COL.redEnd, 1, 5, 1.5);
        break;
      }
      case 'heroDeath': {
        const h = heroXZ(ev);
        if (!h) return;
        const x = wx(h.x), z = wz(h.z);
        burst(smoke, x, 0.4, z, 14, 1, 0.7, 1.0, 0.3, 0.7, COL.smoke, COL.smokeEnd, 0.7, -0.4, 2, -99, 0.4);
        for (let i = 0; i < 12; i++) add.emit(x + (rand() - 0.5) * 0.4, 0.4 + rand() * 0.4, z + (rand() - 0.5) * 0.4, 0, 0.8 + rand(), 0, 1.4, 0.14, 0.04, COL.holy, COL.blue, 1, -0.2, 0.5);
        rings.emit(x, 0.05, z, 0.1, 1.0, 0.6, COL.warm, 0.7, 0);
        break;
      }
      case 'heroRespawn': {
        const h = heroXZ(ev);
        if (!h) return;
        const x = wx(h.x), z = wz(h.z);
        pillars.emit(x, 0, z, 0.5, 3.2, COL.blue, 1.1);
        rings.emit(x, 0.05, z, 0.2, 1.3, 0.8, COL.frost, 0.9, 3, 1, 2);
        burst(add, x, 0.5, z, 18, 1.4, 0.7, 0.8, 0.12, 0.03, COL.white, COL.blue, 1, -0.4, 1.5, -99, 0.4);
        break;
      }
      case 'heroLevel': {
        const h = heroXZ(ev);
        if (!h) return;
        const x = wx(h.x), z = wz(h.z);
        pillars.emit(x, 0, z, 0.55, 3.4, COL.holy, 1.3);
        rings.emit(x, 0.05, z, 0.2, 1.4, 0.7, COL.gold, 1, 0);
        rings.emit(x, 0.06, z, 0.5, 1.0, 1.1, COL.gold, 0.8, 3, 1, 2, 3);
        for (let i = 0; i < 26; i++) {
          const a = rand() * TAU, d = 0.2 + rand() * 0.4;
          add.emit(x + Math.cos(a) * d, 0.1 + rand() * 0.6, z + Math.sin(a) * d, Math.cos(a) * 0.3, 1.5 + rand() * 2, Math.sin(a) * 0.3, 1 + rand() * 0.5, 0.13, 0.03, COL.holy, COL.goldEnd, 1, -0.2, 1);
        }
        texts.emit(ev.level ? `Lv ${ev.level}` : 'Lv↑', x, 1.5, z, 'level', 1.5);
        break;
      }
      case 'skill':
        if (ev.id === 'meteor' && ok(ev.x) && ok(ev.z)) meteorCast(ev.x, ev.z, ev.radius, ev.delay);
        else if (ev.id === 'freeze') freezeCast();
        break;
      case 'shieldBreak': {                               // A 新增：護盾被打破 → 碎片四散
        const e = findEnemy(ev.id);
        if (!e) return;
        const s = sizeOf(e.type);
        const x = wx(e.x), z = wz(e.z), y = (e.y || 0) + s * 0.42;
        burst(hard, x, y, z, 14, 2.6, 0.3, 0.55, 0.07, 0.04, COL.blue, COL.purple, 1, 6, 1, (e.y || 0) + 0.03, s * 0.5);
        burst(add, x, y, z, 10, 1.8, 0.2, 0.35, 0.14, 0.03, COL.white, COL.purple, 1, 0, 2);
        add.emit(x, y, z, 0, 0, 0, 0.18, s * 1.2, s * 1.8, COL.purple, COL.magicEnd, 0.7);
        break;
      }
      case 'aura': {                                      // A 新增：暗影巫師施放護盾光環
        if (!ok(ev.x) || !ok(ev.z)) return;
        const x = wx(ev.x), z = wz(ev.z), r = ev.radius || 2;
        rings.emit(x, 0.05, z, 0.2, r, 0.7, COL.purple, 0.85, 0);
        rings.emit(x, 0.045, z, r * 0.5, r * 0.95, 0.9, COL.blue, 0.55, 3, 1, 2, 1.6);
        burst(add, x, 0.6, z, 12, 0.9, 0.8, 0.8, 0.13, 0.03, COL.purple, COL.blue, 1, -0.6, 1.5, -99, 0.4);
        break;
      }
      case 'won': fireworks(); break;
      case 'lost': {
        const lp = world.lampPos;
        if (!lp) return;
        burst(smoke, wx(lp.x), 1.0, wz(lp.z), 30, 1.2, 0.8, 2, 0.4, 1.2, COL.dark, COL.darkEnd, 0.8, -0.5, 1.2, -99, 0.6);
        screenFlash(COL.darkEnd, 0.4, 1.6, 0.8);
        break;
      }
      default: break;
    }
  }

  // ------------------------------------------------------------------ 每幀
  const tmpCol = new THREE.Color();
  const lastFire = { v: 0 };
  function update(dt, st) {
    if (st) state = st;
    dt = Math.min(Math.max(dt || 0, 0), 0.1);
    time += dt;
    const cam = world.camera;
    const viewH = world.renderer.domElement.clientHeight || window.innerHeight;
    const ps = world.pixelScale ? world.pixelScale() : 800;
    add.uniforms.uScale.value = ps; smoke.uniforms.uScale.value = ps; hard.uniforms.uScale.value = ps;

    // 計時器
    for (let i = timers.length - 1; i >= 0; i--) {
      timers[i].t -= dt;
      if (timers[i].t <= 0) { const fn = timers[i].fn; timers.splice(i, 1); fn(); }
    }

    // 流星（＋v2.0 火焰風暴的小火球）
    updateMeteors(meteors, dt, false);
    updateMeteors(fireDrops, dt, true);

    // v2.0：第二章＋英雄
    decalA.begin(); decalN.begin();
    chapter2Update(dt);
    projectileFx(dt);
    chargeUpdate(dt);
    cloudsUpdate(dt);
    swirls.update(dt);
    streaks.update(dt);
    shards.update(dt, dt > 0 ? (x, y, z, sz) => {
      add.emit(x, y, z, 0, 0, 0, 0.08, sz * 2.2, sz * 0.8, COL.frost, COL.frostEnd, 0.5);
      if (rand() < 0.5) smoke.emit(x, y + sz, z, 0, 0.2, 0, 0.6, sz * 1.2, sz * 2.4, COL.white, COL.ice, 0.35, 0, 1);
    } : null);

    // 持續狀態（需要 state）

    let nb = 0, ni = 0, nr = 0, ns = 0;
    if (state) {
      if (state.towers) for (const t of state.towers) {
        let p = towerPos.get(t.id);
        if (!p) { p = { x: t.x, z: t.z }; towerPos.set(t.id, p); }
        p.x = t.x; p.z = t.z;
        if (t.dimmed && rand() < dt * 9) {
          const gy = Math.max(0, world.groundHeight(t.x, t.z));
          smoke.emit(wx(t.x) + (rand() - 0.5) * 0.4, gy + 0.8 + rand() * 0.6, wz(t.z) + (rand() - 0.5) * 0.4, 0, 0.35, 0, 1.1, 0.2, 0.45, COL.dark, COL.darkEnd, 0.65, -0.1, 0.8);
        }
      }
      if (towerPos.size > 200) towerPos.clear();
      if (state.enemies) for (const e of state.enemies) {
        const s = sizeOf(e.type);
        const x = wx(e.x), z = wz(e.z), y = e.y || 0;
        const seed = (e.id * 0.618) % 1;
        if (e.shield > 0 && nb < 64) {
          _q.identity();
          const r = s * 0.62 + 0.12;
          _m.compose(_v.set(x, y + s * 0.42, z), _q, _s.set(r, r * (1 + 0.04 * Math.sin(time * 4 + seed * 9)), r));
          bubbles.setMatrixAt(nb++, _m);
        }
        if (e.frozen > 0 && ni < 64) {
          _e.set(0.3 * seed, seed * 6.28, 0.2); _q.setFromEuler(_e);
          _m.compose(_v.set(x, y + s * 0.3, z), _q, _s.set(s * 0.55, s * 0.62, s * 0.55));
          ice.setMatrixAt(ni++, _m);
        }
        if (e.rooted && nr < 64) {
          _q.setFromAxisAngle(_up, time * 0.8 + seed * 6);
          _m.compose(_v.set(x, y + 0.05, z), _q, _s.set(s * 0.45, s * 0.6, s * 0.45));
          roots.setMatrixAt(nr++, _m);
        }
        if (e.stunned && ns < 189) {
          for (let k = 0; k < 3; k++) {
            const a = time * 4 + k * TAU / 3;
            _q.setFromAxisAngle(_up, a * 2);
            _m.compose(_v.set(x + Math.cos(a) * s * 0.32, y + s * 0.85 + 0.18, z + Math.sin(a) * s * 0.32), _q, _s.set(0.055, 0.055, 0.055));
            stars.setMatrixAt(ns++, _m);
          }
        }
        if (e.slow > 0.01 && !(e.frozen > 0)) decalA.add(x, y + 0.04, z, s * 0.55 + 0.1, time * 1.5, COL.blue, 0.35 + 0.45 * Math.min(1, e.slow * 2), 0);
        if (e.burning && rand() < dt * 16) {
          add.emit(x + (rand() - 0.5) * s * 0.5, y + s * (0.2 + rand() * 0.5), z + (rand() - 0.5) * s * 0.5, 0, 0.9 + rand() * 0.6, 0, 0.45, 0.16, 0.04, COL.fire, COL.fireEnd, 1, -0.5, 1);
        }
      }
      if (state.zones) { zonesManaged = true; for (const zn of state.zones) drawZone(zn, dt); }
    }
    for (const f of fakeZones) if (f.ttl > 0) { f.ttl -= dt; drawZone(f, dt); }
    bubbles.count = nb; ice.count = ni; roots.count = nr; stars.count = ns;
    bubbles.visible = nb > 0; ice.visible = ni > 0; roots.visible = nr > 0; stars.visible = ns > 0;
    if (nb) bubbles.instanceMatrix.needsUpdate = true;
    if (ni) ice.instanceMatrix.needsUpdate = true;
    if (nr) roots.instanceMatrix.needsUpdate = true;
    if (ns) stars.instanceMatrix.needsUpdate = true;
    bubbleMat.uniforms.uTime.value = time % 1000;
    decalA.end(); decalN.end();

    add.update(dt); smoke.update(dt); hard.update(dt); sparkle.update(dt);
    rings.update(dt); darkRings.update(dt); trailQ.update(dt);
    debris.update(dt); spikes.update(dt);
    bolts.update(dt, cam);
    texts.update(dt, cam, viewH);
    pillars.update(dt); slashes.update(dt);

    if (ov.life > 0) {
      ov.life -= dt;
      overlay.visible = ov.life > 0;
      overlayU.uAlpha.value = ov.a * Math.max(0, ov.life / ov.max);
    } else overlay.visible = false;
    if (flashI > 0.01) { flash.intensity = flashI; flashI *= Math.exp(-dt * 9); } else { flash.intensity = 0; flashI = 0; }
  }

  function updateMeteors(pool, dt, small) {
    for (const s of pool.slots) {
      if (!s.active) continue;
      if (s.delay > 0) { s.delay -= dt; continue; }
      s.t += dt / s.dur;
      const k = Math.min(1, s.t);
      const e = k * k;
      const x = s.sx + (s.ex - s.sx) * e, y = s.sy + (s.ey - s.sy) * e, z = s.sz + (s.ez - s.sz) * e;
      s.mesh.visible = true;
      s.mesh.position.set(x, y, z);
      s.mesh.scale.setScalar(s.size);
      s.mesh.rotation.x += dt * 9; s.mesh.rotation.y += dt * 7;
      add.emit(x, y, z, 0, 0, 0, 0.1, s.size * 2.6, s.size * 1.2, COL.fire, COL.fireEnd, 0.55);
      if (rand() < 0.6) add.emit(x + (rand() - 0.5) * s.size, y + (rand() - 0.5) * s.size, z + (rand() - 0.5) * s.size,
        (rand() - 0.5) * 0.5, 0.4 + rand() * 0.4, (rand() - 0.5) * 0.5, 0.4, s.size * 1.8, s.size * 0.4, COL.ember, COL.fireEnd, 0.6);
      if (rand() < 0.5) smoke.emit(x, y, z, 0, 0.3, 0, 0.9, s.size * 1.8, s.size * 4, COL.smokeDark, COL.smokeEnd, 0.45, -0.2, 1);
      if (k >= 1) {
        s.active = false; s.mesh.visible = false;
        const r = s.size * 3;
        rings.emit(s.ex, s.ey + 0.04, s.ez, 0.1, r * 1.6, 0.4, COL.orange, 0.9, 0);
        burst(add, s.ex, s.ey + 0.1, s.ez, 12, 2.8, 0.6, 0.45, 0.14, 0.03, COL.fire, COL.fireEnd, 1, 4, 1.5, s.ey);
        burst(smoke, s.ex, s.ey + 0.1, s.ez, 4, 0.8, 0.8, 0.8, 0.25, 0.55, COL.dust, COL.dustEnd, 0.6, -0.2, 2);
        for (let i = 0; i < 3; i++) debris.emit(s.ex, s.ey + 0.1, s.ez, (rand() - 0.5) * 3, 2 + rand() * 2, (rand() - 0.5) * 3, 0.04 + rand() * 0.04, COL.smokeDark, 1, s.ey);
        lightFlash(s.ex, s.ey + 0.8, s.ez, COL.orange, 1.2);
        if (small) { rings.emit(s.ex, s.ey + 0.045, s.ez, 0.1, 0.7, 0.3, COL.fire, 0.8, 1, 1, 0); addLight(s.ex + world.W / 2, s.ez + world.H / 2, 1.2, 0.35, 1, 0, 0.8); }
        else if (world.cam) world.cam.shake(0.06 + s.size * 0.2, 0.25);
      }
    }

  }

  function drawZone(zn, dt) {
    const x = wx(zn.x), z = wz(zn.z), r = zn.radius || 1;
    const gy = Math.max(0, world.groundHeight(zn.x, zn.z));
    const seed = ((zn.id || 0) * 0.618) % 1;
    if (zn.kind === 'fire') {
      decalN.add(x, gy + 0.015, z, r * 1.05, seed * 6, COL.white, 0.9, 2);
      decalA.add(x, gy + 0.03, z, r * 1.1, 0, COL.ember, 0.4 + 0.15 * Math.sin(time * 9 + seed * 20), 1);
      const n = dt * r * r * 34;
      for (let i = 0; i < 3; i++) {
        if (rand() > n / 3) continue;
        const a = rand() * TAU, d = Math.sqrt(rand()) * r * 0.85;
        add.emit(x + Math.cos(a) * d, gy + 0.05, z + Math.sin(a) * d, (rand() - 0.5) * 0.2, 0.8 + rand() * 0.8, (rand() - 0.5) * 0.2, 0.5 + rand() * 0.3, 0.2 + rand() * 0.12, 0.05, COL.fire, COL.fireEnd, 1, -0.6, 0.6);
      }
      if (rand() < dt * 3 * r) smoke.emit(x + (rand() - 0.5) * r, gy + 0.6, z + (rand() - 0.5) * r, 0, 0.5, 0, 1.2, 0.3, 0.7, COL.smokeDark, COL.smokeEnd, 0.35, -0.2, 1);
    } else if (zn.kind === 'thorns') {
      decalA.add(x, gy + 0.03, z, r, time * 0.3, COL.leafEnd, 0.55, 3);
      decalA.add(x, gy + 0.025, z, r * 1.05, 0, COL.leaf, 0.25, 1);
      if (rand() < dt * 5 * r) {
        const a = rand() * TAU, d = Math.sqrt(rand()) * r * 0.85;
        spikes.emit(x + Math.cos(a) * d, gy, z + Math.sin(a) * d, 0.22 + rand() * 0.2, 0.045, COL.thorn, 0.7, 0, 0.35);
      }
      if (rand() < dt * 6) hard.emit(x + (rand() - 0.5) * r, gy + 0.1, z + (rand() - 0.5) * r, 0, 0.8, 0, 0.8, 0.05, 0.03, COL.leaf, COL.leafEnd, 1, 1, 1, gy);
    } else if (zn.kind === 'meteorMark') {
      const pulse = 0.65 + 0.35 * Math.sin(time * 10);
      decalA.add(x, gy + 0.05, z, r, time * 1.2, COL.red, 0.85 * pulse, 3);
      decalA.add(x, gy + 0.04, z, r * (1 - ((time * 1.5) % 1) * 0.8), 0, COL.orange, 0.7, 0);
      decalA.add(x, gy + 0.035, z, r, 0, COL.redEnd, 0.35, 1);
    }
  }

  function clear() {
    for (const p of [add, smoke, hard, rings, darkRings, debris, spikes, bolts, texts, pillars, slashes, meteors,
      sparkle, trailQ, swirls, streaks, shards, fireDrops, mounds]) p.clear();
    projSeen.clear(); burrowTrack.clear(); charge.active = false;
    for (const c of clouds) c.ttl = 0;
    beams.begin(); beams.end(0);
    for (const f of fakeZones) f.ttl = 0;
    timers.length = 0; recentGold.length = 0; towerPos.clear();
    ov.life = 0; overlay.visible = false; flashI = 0; flash.intensity = 0;
    bubbles.count = ice.count = roots.count = stars.count = 0;
    zonesManaged = false;
  }

  return {
    root, handle, update, clear,
    setState(st) { state = st || null; zonesManaged = false; projSeen.clear(); burrowTrack.clear(); },
    /** 鏡頭震動的捷徑 */
    shake(amp, dur) { if (world.cam) world.cam.shake(amp, dur); },
    /** 除錯用：目前作用中的粒子數 */
    stats() { return { add: add.live, smoke: smoke.live, hard: hard.live, sparkle: sparkle.live, rings: rings.live, debris: debris.live, beams: beams.n }; },
  };
}
