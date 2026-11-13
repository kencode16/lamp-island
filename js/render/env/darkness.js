// 第二章黑暗效果（擁有者：C）：光照貼圖（DataTexture）＋材質著色器補丁。
//
// 作法：
// 1. 每幀依 state.lights（＋特效的暫時光）在 CPU 算一張「光照貼圖」：每格 RES×RES 個像素，涵蓋整張地圖外加 MARGIN 格。
//    R＝亮度（0–1，柔邊）、G＝暖色比例（燈、燈籠、火）、B＝冷色比例（蘑菇、水晶、法術）。半徑 ≥ 40 的光（流星雨）改成全場亮度。
// 2. 場景裡的受光材質（MeshStandard/Lambert/Phong/Toon）用 onBeforeCompile 補一段：依世界座標 xz 取樣光照貼圖，
//    光外＝原色 × 約 12% 冷色＋冷色輪廓光；光內＝原色 ×（暖／冷色調）；自發光（totalEmissiveRadiance）原封不動加回去，
//    所以發光的眼睛、水晶、燈火在暗處仍然亮。material.userData.noDark === true 的材質、加色混合的材質、
//    MeshBasic／Sprite／Points／ShaderMaterial 一律不補丁。
// 3. 只有第一次真的需要黑暗時才補丁（第一章從頭到尾不會碰任何材質）；補丁後 uDkOn = 0 時走 if 分支跳過，畫面與原本完全相同。
// 4. 不加任何燈光、不加 draw call。新加入的模型：world.render() 前會走一遍 entities，遇到沒看過的材質就補丁。
import * as THREE from 'three';

export const DK_RES = 3;       // 每格幾個像素（3 就夠柔：光圈邊緣約 0.9 格＝近 3 個像素，再加線性插值）
export const DK_MARGIN = 3;    // 地圖外多涵蓋幾格

// 各種光源的暖／冷色比例
const KIND_TINT = {
  lamp: [0.9, 0], lantern: [1, 0], fire: [1, 0], meteor: [0.6, 0],
  hero: [0.55, 0.05], mage: [0.05, 0.85], mushroom: [0, 1], crystal: [0.05, 0.9],
  laser: [0.1, 0.75], spell: [0.45, 0.35],
};
const HERO_TINT = { knight: [0.6, 0], fairy: [0.15, 0.55], mage: [0.5, 0.2] };

// ---------------------------------------------------------------- 著色器片段
const FRAG_HEAD = /* glsl */`
uniform sampler2D uDkMap;
uniform vec4 uDkRect;
uniform float uDkOn, uDkGlobal, uDkBoost;
uniform vec3 uDkAmb, uDkRim, uDkWarm, uDkCool;
varying vec2 vDkXZ;
vec3 dkShade(vec3 c, vec3 n, vec3 v) {
  vec4 L = texture2D(uDkMap, (vDkXZ - uDkRect.xy) * uDkRect.zw);
  float lit = max(L.r, uDkGlobal);
  vec3 tint = vec3(1.0) + uDkWarm * L.g + uDkCool * L.b;
  float rim = pow(1.0 - clamp(abs(dot(n, v)), 0.0, 1.0), 3.0);
  vec3 dark = c * uDkAmb + uDkRim * rim * (1.0 - lit);
  return mix(dark, c * tint * uDkBoost, lit);
}
`;
const FRAG_APPLY = /* glsl */`
if (uDkOn > 0.0) {
  vec3 dkE = totalEmissiveRadiance;
  vec3 dkV = normalize(vViewPosition);
  outgoingLight = mix(outgoingLight, dkShade(max(outgoingLight - dkE, vec3(0.0)), normal, dkV) + dkE, uDkOn);
}
`;
const VERT_HEAD = /* glsl */`
varying vec2 vDkXZ;
`;
const VERT_APPLY = /* glsl */`
{
  vec4 dkP = vec4(transformed, 1.0);
  #ifdef USE_BATCHING
    dkP = batchingMatrix * dkP;
  #endif
  #ifdef USE_INSTANCING
    dkP = instanceMatrix * dkP;
  #endif
  vDkXZ = (modelMatrix * dkP).xz;
}
`;

/** 給自己的 ShaderMaterial（水面、粒子）用的取樣函式：dkLit(xz) → vec4(亮度, 暖, 冷, 0) */
export const DK_GLSL_SAMPLE = /* glsl */`
uniform sampler2D uDkMap;
uniform vec4 uDkRect;
uniform float uDkOn, uDkGlobal, uDkBoost;
uniform vec3 uDkAmb, uDkRim, uDkWarm, uDkCool;
vec4 dkLit(vec2 xz) {
  vec4 L = texture2D(uDkMap, (xz - uDkRect.xy) * uDkRect.zw);
  L.r = max(L.r, uDkGlobal);
  return L;
}
`;

const PROTO_KEY = THREE.Material.prototype.customProgramCacheKey;

export function createDarkness() {
  // 1×1 的預設貼圖（還沒建關時）
  let NX = 1, NZ = 1;
  let data = new Uint8Array(4);
  let tex = new THREE.DataTexture(data, 1, 1, THREE.RGBAFormat, THREE.UnsignedByteType);
  tex.needsUpdate = true;
  let lum = new Float32Array(1), warm = new Float32Array(1), cool = new Float32Array(1);
  let W = 0, H = 0;

  const uniforms = {
    uDkOn: { value: 0 },
    uDkMap: { value: tex },
    uDkRect: { value: new THREE.Vector4(0, 0, 1, 1) },
    uDkGlobal: { value: 0 },
    uDkBoost: { value: 1.08 },
    uDkAmb: { value: new THREE.Vector3(0.105, 0.125, 0.185) },  // 光外：原色 × 約 13% 冷色
    uDkRim: { value: new THREE.Vector3(0.022, 0.04, 0.08) },    // 光外：冷色輪廓光
    uDkWarm: { value: new THREE.Vector3(0.46, 0.13, -0.27) },   // 暖光：偏橘
    uDkCool: { value: new THREE.Vector3(-0.12, 0.08, 0.3) },    // 冷光：偏青紫
  };

  // ---------------------------------------------------------------- 材質補丁
  const seen = new WeakSet();
  let patchedCount = 0;
  function eligible(m) {
    if (!m || (m.userData && m.userData.noDark === true)) return false;
    if (m.blending === THREE.AdditiveBlending) return false;
    return !!(m.isMeshStandardMaterial || m.isMeshLambertMaterial || m.isMeshPhongMaterial || m.isMeshToonMaterial);
  }
  function patch(m) {
    if (seen.has(m)) return;
    seen.add(m);
    if (!eligible(m)) return;
    const prev = m.onBeforeCompile;
    const customKey = m.customProgramCacheKey !== PROTO_KEY;
    const prevKey = m.customProgramCacheKey;
    const baseKey = customKey ? null : String(prev);
    m.onBeforeCompile = function (sh, r) {
      if (prev) prev.call(this, sh, r);
      if (!sh.vertexShader.includes('#include <project_vertex>') || !sh.fragmentShader.includes('#include <opaque_fragment>')) return;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\n' + VERT_HEAD)
        .replace('#include <project_vertex>', '#include <project_vertex>\n' + VERT_APPLY);
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\n' + FRAG_HEAD)
        .replace('#include <opaque_fragment>', FRAG_APPLY + '\n#include <opaque_fragment>');
      for (const k of Object.keys(uniforms)) sh.uniforms[k] = uniforms[k];
    };
    m.customProgramCacheKey = function () { return (customKey ? prevKey.call(this) : baseKey) + '|dark1'; };
    m.needsUpdate = true;
    patchedCount++;
  }
  function visit(o) {
    const m = o.material;
    if (!m) return;
    if (Array.isArray(m)) { for (let i = 0; i < m.length; i++) patch(m[i]); } else patch(m);
  }

  // ---------------------------------------------------------------- 光照貼圖
  let rectMinX = 0, rectMinZ = 0;
  function setMap(w, h) {
    W = w; H = h;
    NX = Math.max(1, (W + 2 * DK_MARGIN) * DK_RES);
    NZ = Math.max(1, (H + 2 * DK_MARGIN) * DK_RES);
    data = new Uint8Array(NX * NZ * 4);
    for (let i = 3; i < data.length; i += 4) data[i] = 255;
    lum = new Float32Array(NX * NZ); warm = new Float32Array(NX * NZ); cool = new Float32Array(NX * NZ);
    const old = tex;
    tex = new THREE.DataTexture(data, NX, NZ, THREE.RGBAFormat, THREE.UnsignedByteType);
    tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearFilter;
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.generateMipmaps = false;
    tex.needsUpdate = true;
    uniforms.uDkMap.value = tex;
    old.dispose();
    // 世界座標：格子 x → x - W/2
    rectMinX = -W / 2 - DK_MARGIN; rectMinZ = -H / 2 - DK_MARGIN;
    uniforms.uDkRect.value.set(rectMinX, rectMinZ, 1 / (W + 2 * DK_MARGIN), 1 / (H + 2 * DK_MARGIN));
    tracked.clear();
  }

  /** 在貼圖上畫一個柔邊光圈（格子座標） */
  function splat(gx, gz, r, wk, ck, inten) {
    if (!(r > 0.05) || !(inten > 0.003)) return;
    const soft = Math.min(0.45, r * 0.35);
    const r0 = Math.max(0, r - soft) * DK_RES, r1 = (r + soft) * DK_RES, rr = r * DK_RES;
    const cx = (gx + DK_MARGIN) * DK_RES - 0.5, cz = (gz + DK_MARGIN) * DK_RES - 0.5;
    const i0 = Math.max(0, Math.ceil(cx - r1)), i1 = Math.min(NX - 1, Math.floor(cx + r1));
    const j0 = Math.max(0, Math.ceil(cz - r1)), j1 = Math.min(NZ - 1, Math.floor(cz + r1));
    if (i0 > i1 || j0 > j1) return;
    const r1s = r1 * r1, r0s = r0 * r0, inv = 1 / Math.max(1e-3, r1 - r0), invR2 = 1 / (rr * rr);
    for (let j = j0; j <= j1; j++) {
      const dz = j - cz, dz2 = dz * dz;
      if (dz2 >= r1s) continue;
      const row = j * NX;
      for (let i = i0; i <= i1; i++) {
        const dx = i - cx, d2 = dx * dx + dz2;
        if (d2 >= r1s) continue;
        let f = 1;
        if (d2 > r0s) { const t = (Math.sqrt(d2) - r0) * inv; f = 1 - t * t * (3 - 2 * t); }
        const q = d2 * invR2;                      // 0（中心）→ 1（半徑）
        const core = q < 1 ? 1 - 0.14 * q : 0.86;  // 中心稍亮，像真的光圈
        const v = f * core * inten;
        const k = row + i;
        lum[k] = lum[k] + v - lum[k] * v;
        if (wk > 0) { const w = v * wk * (1.15 - 0.45 * Math.min(1, q)); if (w > warm[k]) warm[k] = w; }
        if (ck > 0) { const c = v * ck * (1.1 - 0.3 * Math.min(1, q)); if (c > cool[k]) cool[k] = c; }
      }
    }
  }

  // 光源的淡入淡出：id → 目前強度（燈籠熄滅／點亮、雷射目標消失時不會突然跳）
  const tracked = new Map();
  let frameNo = 0;
  // 特效加的暫時光（爆炸、技能閃光）
  const transients = [];
  for (let i = 0; i < 24; i++) transients.push({ x: 0, z: 0, r: 1, life: 0, max: 1, wk: 0, ck: 0, inten: 1 });
  let tCursor = 0;
  let globalCur = 0;
  let lastMs = 0;
  // 特效每幀推進來的跟隨光（投射物、持續中的技能）；下一次算貼圖後清空
  const fxLights = [];
  for (let i = 0; i < 32; i++) fxLights.push({ x: 0, z: 0, r: 1, wk: 0, ck: 0, inten: 1 });
  let nFx = 0;
  function pushLight(x, z, r, wk = 0.8, ck = 0, inten = 1) {
    if (nFx >= fxLights.length) return;
    const f = fxLights[nFx++];
    f.x = x; f.z = z; f.r = r; f.wk = wk; f.ck = ck; f.inten = inten;
  }

  function addTransient(x, z, r, life = 0.5, wk = 0.8, ck = 0, inten = 1) {
    const t = transients[tCursor]; tCursor = (tCursor + 1) % transients.length;
    t.x = x; t.z = z; t.r = r; t.life = life; t.max = life; t.wk = wk; t.ck = ck; t.inten = inten;
  }

  let time = 0;
  function computeMap(state, dt) {
    const t0 = performance.now();
    frameNo++;
    lum.fill(0); warm.fill(0); cool.fill(0);
    let globalTarget = 0;
    const lights = state && state.lights;
    const heroType = state && state.hero && state.hero.type;
    if (lights) {
      for (let i = 0; i < lights.length; i++) {
        const L = lights[i];
        if (!L) continue;
        if (L.r >= 40) { if (L.on !== false) globalTarget = 1; continue; }
        const key = L.id != null ? L.id : `${L.kind}#${i}`;
        let s = tracked.get(key);
        if (!s) { s = { x: L.x, z: L.z, r: L.r, kind: L.kind, cur: L.on === false ? 0 : 0.0001, seen: 0 }; tracked.set(key, s); }
        s.x = L.x; s.z = L.z; s.r = L.r; s.kind = L.kind; s.seen = frameNo;
        s.target = L.on === false ? 0 : 1;
      }
    }
    for (const [key, s] of tracked) {
      if (s.seen !== frameNo) s.target = 0;
      const sp = s.target > s.cur ? 7 : 3.2;
      s.cur += (s.target - s.cur) * Math.min(1, dt * sp);
      if (s.target > 0 && s.cur > 0.995) s.cur = 1;
      if (s.target === 0 && s.cur < 0.01) { if (s.seen !== frameNo) tracked.delete(key); else s.cur = 0; continue; }
      let tint = KIND_TINT[s.kind] || KIND_TINT.spell;
      if (s.kind === 'hero' && HERO_TINT[heroType]) tint = HERO_TINT[heroType];
      // 火光微微閃動
      let r = s.r;
      if (s.kind === 'fire' || s.kind === 'lantern' || s.kind === 'lamp') r *= 1 + 0.018 * Math.sin(time * 11 + (s.x * 3.1 + s.z * 1.7)) * (s.kind === 'fire' ? 2.2 : 1);
      // 熄滅時半徑一起縮，看起來像燈慢慢暗下去
      splat(s.x, s.z, r * (0.55 + 0.45 * s.cur), tint[0], tint[1], s.cur);
    }
    for (const t of transients) {
      if (t.life <= 0) continue;
      t.life -= dt;
      if (t.life <= 0) continue;
      const k = t.life / t.max;
      const a = Math.min(1, (1 - k) * 10) * Math.pow(k, 0.6);
      if (t.r >= 40) { globalTarget = Math.max(globalTarget, a * t.inten); continue; }
      splat(t.x, t.z, t.r * (0.7 + 0.3 * a), t.wk, t.ck, a * t.inten);
    }
    for (let i = 0; i < nFx; i++) { const f = fxLights[i]; splat(f.x, f.z, f.r, f.wk, f.ck, f.inten); }
    nFx = 0;
    globalCur += (globalTarget - globalCur) * Math.min(1, dt * (globalTarget > globalCur ? 9 : 2.2));
    uniforms.uDkGlobal.value = globalCur < 0.003 ? 0 : globalCur;
    const n = NX * NZ;
    for (let k = 0, o = 0; k < n; k++, o += 4) {
      data[o] = lum[k] * 255 + 0.5;
      data[o + 1] = (warm[k] > 1 ? 1 : warm[k]) * 255 + 0.5;
      data[o + 2] = (cool[k] > 1 ? 1 : cool[k]) * 255 + 0.5;
    }
    tex.needsUpdate = true;
    lastMs = lastMs * 0.9 + (performance.now() - t0) * 0.1;
  }

  // ---------------------------------------------------------------- 對外
  let state = null;
  let wantOn = 0, forced = null, levelDefault = false;
  let acc = 0;
  const MIN_STEP = 1 / 45;   // 貼圖最多約每 1/45 秒重算一次（60fps 時隔幀算、120Hz 螢幕每 3 幀算一次）
  const api = {
    uniforms,
    /** 建關時呼叫：地圖大小 */
    setMap,
    bind(st) { state = st || null; },
    unbind() { state = null; },
    /** 測試用：強制開關（null＝依 state.dark） */
    force(v) { forced = v; },
    /** 還沒 bind 時的預設（levelDef.dark） */
    setDefault(v) { levelDefault = !!v; },
    get active() { return uniforms.uDkOn.value > 0; },
    get wanted() { return wantOn > 0; },
    addTransient,
    pushLight,
    /** 黑暗開啟時，對這些根節點的材質補丁（每幀呼叫很便宜：WeakSet 查表） */
    prepare(roots) {
      if (!(wantOn > 0 || uniforms.uDkOn.value > 0)) return;
      for (const r of roots) if (r) r.traverse(visit);
    },
    /** 預先補丁（避免第一次出現時才編譯造成卡頓） */
    patchMaterial(m) { if (m) patch(m); },
    update(dt, instant = false) {
      time += dt;
      const on = forced != null ? forced : state ? !!state.dark : levelDefault;
      wantOn = on ? 1 : 0;
      const cur = uniforms.uDkOn.value;
      if (instant) uniforms.uDkOn.value = wantOn;
      else if (cur !== wantOn) {
        const v = cur + Math.sign(wantOn - cur) * dt / 0.8;
        uniforms.uDkOn.value = Math.min(1, Math.max(0, v));
      }
      acc += dt;
      if ((uniforms.uDkOn.value > 0 || wantOn > 0) && (instant || acc >= MIN_STEP)) { computeMap(state, acc); acc = 0; }
      nFx = 0;
      if (acc > 1) acc = 1;
    },
    /** 格子座標的亮度（0–1，取自最近一次算好的貼圖；測試頁用） */
    lightAt(x, z) {
      const i = Math.floor((x + DK_MARGIN) * DK_RES), j = Math.floor((z + DK_MARGIN) * DK_RES);
      if (i < 0 || j < 0 || i >= NX || j >= NZ) return globalCur;
      return Math.max(globalCur, lum[j * NX + i]);
    },
    clear() {
      tracked.clear();
      for (const t of transients) t.life = 0;
      globalCur = 0; uniforms.uDkGlobal.value = 0;
      lum.fill(0); warm.fill(0); cool.fill(0);
      for (let o = 0; o < data.length; o += 4) { data[o] = 0; data[o + 1] = 0; data[o + 2] = 0; }
      tex.needsUpdate = true;
    },
    stats() { return { ms: +lastMs.toFixed(3), texels: NX * NZ, size: `${NX}x${NZ}`, lights: tracked.size, patched: patchedCount }; },
  };
  return api;
}
