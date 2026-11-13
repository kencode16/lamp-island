// 場景（擁有者：C）：島嶼地形、海、天空、日夜天氣、鏡頭、點選、地面標示。介面見 架構.md §7 與 js/render/README.md。
import * as THREE from 'three';
import * as MODELS from './models.js';
import * as PALETTE from './palette.js';
import { createCameraRig } from './camera.js';
import { makeRng, hashString } from './env/rng.js';
import { buildTerrain, makeGridInfo, surfaceOf, isLand, DECOR_KIND, CAVE_DECOR_KIND, WALKABLE, SEA_Y } from './env/terrain.js';
import { createWater } from './env/water.js';
import { createSky } from './env/sky.js';
import { envTarget, cloneParams, lerpParams } from './env/lighting.js';
import { createRain, createMist } from './env/weather.js';
import { createMarkers } from './env/markers.js';
import { createGlows } from './env/glows.js';
import { mergeStatic } from './env/merge.js';
import { createDarkness, DK_GLSL_SAMPLE } from './env/darkness.js';
import { buildCaveWalls, makeCaveDecorFallback } from './env/cave.js';

const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _box = new THREE.Box3();

function safe(fn, label) {
  try { return fn(); } catch (e) { console.warn(`[world] ${label} 失敗：`, e && e.message); return null; }
}

export function createWorld(container, opts = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const canvas = renderer.domElement;
  canvas.style.display = 'block';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.outline = 'none';
  container.appendChild(canvas);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xb9e0f2, 30, 80);
  const camera = new THREE.PerspectiveCamera(opts.fov || 36, 1, 0.3, 500);
  scene.add(camera);

  const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x6f8a4a, 1.1);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 2.6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  scene.add(sun);
  scene.add(sun.target);

  const sky = createSky(scene);
  const darkness = createDarkness();            // 第二章黑暗（光照貼圖＋材質補丁）
  const water = createWater(scene, darkness.uniforms);
  const rain = createRain(scene, opts.rainCount || 1600);
  const mist = createMist(scene, darkness.uniforms, DK_GLSL_SAMPLE);
  const markers = createMarkers(scene);
  const glows = createGlows(scene);
  const levelRoot = new THREE.Group();
  levelRoot.name = 'level';
  scene.add(levelRoot);
  const entities = new THREE.Group();
  entities.name = 'entities';
  scene.add(entities);

  const world = {
    renderer, scene, camera, entities, levelRoot,
    sun, hemi, sky, water, rain, markers, glows, mist, darkness,
    darkUniforms: darkness.uniforms,
    theme: 'island',
    cam: null,
    onTap: null, onHover: null,
    W: 0, H: 0, level: null,
    lamp: null, gates: [],
    env: { time: 'day', weather: 'clear' },
    quality: 'high',
  };
  markers.world = world;

  // ---------------------------------------------------------------- 座標
  world.toWorld = function (x, z, y = 0, out) {
    return (out || new THREE.Vector3()).set(x - world.W / 2, y, z - world.H / 2);
  };
  world.toScreen = function (x, y, z) {
    _v.set(x - world.W / 2, y, z - world.H / 2).project(camera);
    const r = canvas.getBoundingClientRect();
    return {
      x: r.left + (_v.x + 1) / 2 * r.width,
      y: r.top + (1 - _v.y) / 2 * r.height,
      visible: _v.z < 1 && _v.x >= -1 && _v.x <= 1 && _v.y >= -1 && _v.y <= 1,
    };
  };
  world.pick = function (clientX, clientY) {
    if (!world.level) return null;
    cam.refreshRect();
    if (!cam.groundAt(clientX, clientY, _v)) return null;
    const x = _v.x + world.W / 2, z = _v.z + world.H / 2;
    if (x < 0 || z < 0 || x >= world.W || z >= world.H) return null;
    return { c: Math.floor(x), r: Math.floor(z), x, z };
  };
  /** 格子座標 (x,z) 的地面高度（塔基座頂 0.12、沙灘 -0.1、碼頭 -0.03、海 -0.35） */
  world.groundHeight = function (x, z) {
    if (!world.level) return 0;
    return surfaceOf(world.level.at(Math.floor(x), Math.floor(z)));
  };
  world.cellAt = (c, r) => (world.level ? world.level.at(c, r) : '~');

  // ---------------------------------------------------------------- 鏡頭
  const cam = createCameraRig(camera, canvas, {
    onTap(cx, cy, pointerType) {
      if (!world.onTap) return;
      const p = world.pick(cx, cy);
      world.onTap({ clientX: cx, clientY: cy, pointerType, c: p ? p.c : null, r: p ? p.r : null, x: p ? p.x : null, z: p ? p.z : null });
    },
    onHover(cx, cy) {
      if (!world.onHover) return;
      const p = world.pick(cx, cy);
      world.onHover(p ? { clientX: cx, clientY: cy, c: p.c, r: p.r, x: p.x, z: p.z, pointerType: 'mouse' } : null);
    },
    onHoverEnd() { if (world.onHover) world.onHover(null); },
  });
  world.cam = cam;

  // ---------------------------------------------------------------- 環境（時段／天氣）
  let envCur = envTarget('day', 'clear');
  let envFrom = cloneParams(envCur), envTo = cloneParams(envCur);
  let envT = 1, envDur = 1;
  const center = new THREE.Vector3();
  let shadowR = 14;

  function applyEnv(p) {
    sun.color.copy(p.sunColor);
    sun.intensity = p.sunInt;
    sun.position.copy(center).addScaledVector(p.sunDir, 40);
    sun.target.position.copy(center);
    hemi.color.copy(p.hemiSky);
    hemi.groundColor.copy(p.hemiGround);
    hemi.intensity = p.hemiInt;
    scene.fog.color.copy(p.fogColor);
    renderer.setClearColor(p.fogColor);
    renderer.toneMappingExposure = p.exposure;
    sky.applyEnv(p);
    water.applyEnv(p);
    rain.setAmount(p.rain);
    mist.setAmount(p.mist || 0);
    if (typeof PALETTE.setGlowStrength === 'function') PALETTE.setGlowStrength(p.glow);
  }
  applyEnv(envCur);

  world.setEnv = function (env = {}, seconds = 2) {
    const time = env.time || world.env.time || 'day';
    const weather = env.weather || world.env.weather || 'clear';
    world.env = { time, weather };
    envFrom = cloneParams(envCur);
    envTo = envTarget(time, weather);
    if (!(seconds > 0)) { envCur = cloneParams(envTo); envT = 1; applyEnv(envCur); return; }
    envT = 0; envDur = seconds;
  };
  /** 目前（插值中的）環境參數，effects 會讀 night */
  world.envParams = () => envCur;

  // ---------------------------------------------------------------- 標示
  world.highlightCell = (c, r, color = '#ffffff') => markers.highlight(c, r, color);
  world.showRange = (x, z, radius, ok = true) => markers.showRange(x, z, radius, ok);
  world.hideRange = () => markers.hideRange();
  world.showPaths = (paths) => markers.showPaths(paths);
  world.showTargetCircle = (x, z, radius) => markers.showTarget(x, z, radius);
  world.hideTargetCircle = () => markers.hideTarget();
  /** 英雄技能瞄準時，英雄周圍的可施放範圍（每幀呼叫也沒關係） */
  world.showCastRange = (x, z, radius) => markers.showCast(x, z, radius);
  world.hideCastRange = () => markers.hideCast();

  // ---------------------------------------------------------------- 關卡
  let terrain = null;
  let caveWalls = null;
  let dynamicObjs = [];   // 需要每幀 update 的裝飾
  let crystalObjs = new Map();   // 第二章：格子 key → 洞窟水晶（userData.setLit 依 state.lights 的 crystal 光源）
  let decorLights = [];   // { light, base }
  let lampFlicker = 0, lampFlickerK = 1;
  let boundState = null;  // world.bindGame(state)
  let levelDark = false;  // levelDef.dark（還沒 bindGame 前用它）
  const darkRoots = [levelRoot, entities];

  world.clearLevel = function () {
    levelRoot.traverse((o) => { if (o.isMesh && o.userData.mergedGeometry) o.geometry.dispose(); });
    levelRoot.clear();
    if (terrain) { terrain.dispose(); terrain = null; }
    if (caveWalls) { caveWalls.dispose(); caveWalls = null; }
    glows.clear();
    markers.clear();
    water.setShore(null);
    world.lamp = null; world.gates = []; world.level = null;
    dynamicObjs = []; decorLights = []; crystalObjs = new Map();
    // 自動解除 bindGame
    boundState = null; levelDark = false;
    darkness.unbind(); darkness.clear(); darkness.update(0, true);
    world.theme = 'island';
  };

  function yawToward(G, c, r, pred) {
    const dirs = [[0, 1], [1, 0], [-1, 0], [0, -1]];
    for (const [dc, dr] of dirs) if (pred(G.at(c + dc, r + dr))) return Math.atan2(dc, dr);
    return null;
  }

  world.buildLevel = function (levelDef) {
    world.clearLevel();
    const G = makeGridInfo(levelDef);
    const { W, H, at } = G;
    world.W = W; world.H = H;
    world.level = { W, H, at, grid: G.rows, def: levelDef };
    const seed = hashString(String(levelDef.id ?? '') + '|' + G.rows.join('\n'));
    const cave = levelDef.theme === 'cave';
    world.theme = cave ? 'cave' : 'island';

    terrain = buildTerrain(G, seed, { anisotropy: Math.min(8, renderer.capabilities.getMaxAnisotropy()), theme: world.theme });
    levelRoot.add(terrain.group);
    water.setShore(terrain.shore);
    if (cave) {
      caveWalls = safe(() => buildCaveWalls(G, seed), 'buildCaveWalls');
      if (caveWalls) levelRoot.add(caveWalls.group);
    }
    darkness.setMap(W, H);
    mist.setArea(-W / 2 - 1, -H / 2 - 1, W + 2, H + 2);

    // ---- 模型
    const rng = makeRng(seed ^ 0x9e3779b9);
    const decorGroup = new THREE.Group();
    decorGroup.name = 'decor';
    decorGroup.position.set(-W / 2, 0, -H / 2);
    levelRoot.add(decorGroup);
    const decor = [], small = [];
    let lamp = null;
    const gates = [];
    for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
      const ch = at(c, r);
      const x = c + 0.5, z = r + 0.5;
      if (ch === 'L') {
        lamp = safe(() => MODELS.makeLamp(), 'makeLamp');
        if (lamp) { lamp.position.set(x, 0, z); decorGroup.add(lamp); }
      } else if (ch === 'S') {
        const gate = safe(() => (cave ? MODELS.makeSpawnGate('cave') : MODELS.makeSpawnGate()), 'makeSpawnGate');
        if (gate) {
          const yaw = yawToward(G, c, r, (n) => n === '=' || n === 'B' || n === 'o' || n === 'L')
            ?? yawToward(G, c, r, (n) => isLand(n)) ?? 0;
          gate.position.set(x, 0, z);
          gate.rotation.y = yaw;
          decorGroup.add(gate);
          gates.push(gate);
        }
      } else if (DECOR_KIND[ch]) {
        const kind = (cave && CAVE_DECOR_KIND[ch]) || DECOR_KIND[ch];
        const obj = safe(() => makeDecorFor(kind, rng, cave), `makeDecor(${kind})`);
        if (!obj) continue;
        let yaw = rng() * Math.PI * 2, jx = (rng() - 0.5) * 0.14, jz = (rng() - 0.5) * 0.14;
        if (kind === 'house') { yaw = yawToward(G, c, r, (n) => WALKABLE.has(n)) ?? 0; jx = jz = 0; }
        else if (kind === 'fence') {
          const lr = at(c - 1, r) === 'F' || at(c + 1, r) === 'F', ud = at(c, r - 1) === 'F' || at(c, r + 1) === 'F';
          yaw = (ud && !lr) ? Math.PI / 2 : 0; jx = jz = 0;
        } else if (kind === 'dock') { yaw = yawToward(G, c, r, (n) => n === '~') ?? 0; jx = jz = 0; }
        else if (kind === 'windmill') { yaw = (rng() - 0.5) * 0.7; jx = jz = 0; }
        else if (kind === 'grave') { yaw = (rng() - 0.5) * 0.5; }
        else if (kind === 'lamppost') { jx *= 0.5; jz *= 0.5; }
        else if (kind === 'minecart') {
          const vert = (at(c, r - 1) === 'Q' || at(c, r + 1) === 'Q') && !(at(c - 1, r) === 'Q' || at(c + 1, r) === 'Q');
          yaw = vert ? Math.PI / 2 : 0; jx = jz = 0;
        }
        obj.position.set(x + jx, surfaceOf(ch), z + jz);
        obj.rotation.y = yaw;
        decorGroup.add(obj);
        decor.push({ obj, ch, kind, c, r });
      } else if (ch === '.' && cave) {
        // 洞窟地面：B 的碎石（grassTuft 的洞窟版）與小白菇芽（flower 的洞窟版），比草地稀疏
        const roll = rng();
        if (roll < 0.45) {
          const o = safe(() => MODELS.makeDecor(roll < 0.36 ? 'grassTuft' : 'flower', rng, 'cave'), 'makeDecor(cave small)');
          if (o) {
            o.position.set(x + (rng() - 0.5) * 0.7, 0, z + (rng() - 0.5) * 0.7);
            o.rotation.y = rng() * Math.PI * 2;
            decorGroup.add(o); small.push(o);
          }
        }
      } else if (ch === '.' && !cave) {
        // 草地隨機長小草叢與花
        const coast = !isLand(at(c - 1, r)) || !isLand(at(c + 1, r)) || !isLand(at(c, r - 1)) || !isLand(at(c, r + 1));
        const spread = coast ? 0.55 : 0.78;
        const roll = rng();
        const nTuft = roll < 0.3 ? 0 : roll < 0.72 ? 1 : 2;
        for (let i = 0; i < nTuft; i++) {
          const o = safe(() => MODELS.makeDecor('grassTuft', rng), 'makeDecor(grassTuft)');
          if (!o) break;
          o.position.set(x + (rng() - 0.5) * spread, 0, z + (rng() - 0.5) * spread);
          o.rotation.y = rng() * Math.PI * 2;
          decorGroup.add(o); small.push(o);
        }
        if (rng() < 0.24) {
          const o = safe(() => MODELS.makeDecor('flower', rng), 'makeDecor(flower)');
          if (o) {
            o.position.set(x + (rng() - 0.5) * spread, 0, z + (rng() - 0.5) * spread);
            o.rotation.y = rng() * Math.PI * 2;
            decorGroup.add(o); small.push(o);
          }
        }
      }
    }
    decorGroup.updateMatrixWorld(true);

    // ---- 夜晚光暈（要在合併前找，合併後就分不出是哪個物件）
    buildGlows(lamp, gates, decor, decorGroup);
    if (caveWalls) for (const m of caveWalls.minerals) glows.addHalo(m.x, m.y, m.z, 0.5, m.color, 0.45);

    // ---- 合併靜態裝飾
    const big = mergeStatic(decor.map((d) => d.obj), decorGroup, { shadows: true });
    const tiny = mergeStatic(small, decorGroup, { shadows: false });
    dynamicObjs = [...big.kept, ...tiny.kept];
    // 洞窟水晶（光的中繼）：記下每格的物件，之後依 state.lights 的 crystal 光源 on 呼叫 setLit
    crystalObjs = new Map();
    if (cave) for (const d of decor) {
      if (d.obj.parent && d.obj.userData && typeof d.obj.userData.setLit === 'function') crystalObjs.set(d.c * 4096 + d.r, d.obj);
    }

    // ---- 燈光數量上限（每多一盞點光源，所有材質都會變慢）：保留守護燈的，其他最多 3 盞
    decorLights = [];
    const others = [];
    for (const o of dynamicObjs) o.traverse((ch) => { if (ch.isPointLight || ch.isSpotLight) others.push(ch); });
    others.forEach((l, i) => {
      if (i < 3) decorLights.push({ light: l, base: l.intensity });
      else l.visible = false;
    });

    // ---- 陰影範圍只蓋住島
    const b = terrain.bounds;
    const cx = (b.minC + b.maxC + 1) / 2 - W / 2, cz = (b.minR + b.maxR + 1) / 2 - H / 2;
    center.set(cx, 0, cz);
    shadowR = Math.hypot((b.maxC - b.minC + 1) / 2, (b.maxR - b.minR + 1) / 2) + 1.2;
    const sc = sun.shadow.camera;
    sc.left = -shadowR; sc.right = shadowR; sc.top = shadowR; sc.bottom = -shadowR;
    sc.near = 40 - shadowR - 6; sc.far = 40 + shadowR + 6;
    sc.updateProjectionMatrix();
    applyEnv(envCur);

    // 漏怪閃爍：燈的 update 由 view.js 每幀呼叫（world 不重複呼叫），這裡包一層，閃爍期間把亮度乘上抖動係數
    if (lamp && lamp.userData && typeof lamp.userData.update === 'function') {
      const orig = lamp.userData.update;
      lamp.userData.update = function (dt, frac = 1, t) {
        return orig.call(this, dt, lampFlicker > 0 ? frac * lampFlickerK : frac, t);
      };
    }
    world.lamp = lamp;
    world.gates = gates;
    world.lampPos = null;
    for (let r = 0; r < H && !world.lampPos; r++) for (let c = 0; c < W; c++) if (at(c, r) === 'L') { world.lampPos = { x: c + 0.5, z: r + 0.5 }; break; }
    cam.setLevel(W, H, terrain.bounds, levelDef.camera || {});
    if (levelDef.env) world.setEnv(levelDef.env, 0);
    // 黑暗：bindGame 之前先依關卡設定（避免第一幀先亮再暗）
    levelDark = !!levelDef.dark;
    darkness.setDefault(levelDark);
    if (levelDark) prewarmDark();
    darkness.update(0, true);
    return { lamp, gates };
  };

  /** 洞窟水晶：state.lights 裡 kind 'crystal' 的光源（同一格）on → setLit(true)；沒有黑暗時一律亮 */
  const crystalOn = new Map();
  function updateCrystals() {
    if (!crystalObjs.size) return;
    crystalOn.clear();
    const lights = boundState && boundState.dark ? boundState.lights : null;
    if (lights) for (const L of lights) if (L && L.kind === 'crystal') crystalOn.set(Math.floor(L.x) * 4096 + Math.floor(L.z), L.on !== false);
    for (const [k, o] of crystalObjs) o.userData.setLit(lights ? crystalOn.get(k) === true : true);
  }
  world.crystals = () => crystalObjs;

  /** 洞窟裝飾：B 的 makeDecor 認得就用（第三個參數傳 'cave'），不認得就用備用模型 */
  function makeDecorFor(kind, rng, cave) {
    const known = !Array.isArray(MODELS.DECOR_KINDS) || MODELS.DECOR_KINDS.includes(kind);
    if (!known) {
      const fb = makeCaveDecorFallback(kind, rng);
      if (fb) return fb;
    }
    return cave ? MODELS.makeDecor(kind, rng, 'cave') : MODELS.makeDecor(kind, rng);
  }

  /** 先把共用材質補丁好（第一次進洞窟時編譯，之後不會在遊戲中卡一下） */
  function prewarmDark() {
    const M = MODELS.MAT;
    if (M) for (const k of Object.keys(M)) darkness.patchMaterial(M[k]);
    darkness.prepare(darkRoots);
  }

  // ---------------------------------------------------------------- 第二章：黑暗與光
  /** 整合者建立 game 之後呼叫；clearLevel 時自動解除。state.dark 為 true 時才有黑暗效果。 */
  world.bindGame = function (state) {
    boundState = state || null;
    darkness.bind(boundState);
    if (boundState && boundState.dark) prewarmDark();
    darkness.update(0, true);
  };
  /** 特效用：加一個短暫的光（格子座標、半徑、秒數、暖色 0–1、冷色 0–1、強度） */
  world.addLight = (x, z, r, life = 0.5, warm = 0.8, cool = 0, inten = 1) => darkness.addTransient(x, z, r, life, warm, cool, inten);
  /** 特效用：只亮這一幀的跟隨光（飛行中的火球、持續中的技能）；每幀都要再推一次 */
  world.pushLight = (x, z, r, warm = 0.8, cool = 0, inten = 1) => darkness.pushLight(x, z, r, warm, cool, inten);
  /** 格子座標的亮度 0–1（只在黑暗開啟時有意義；測試頁用） */
  world.lightAt = (x, z) => (darkness.active ? darkness.lightAt(x, z) : 1);
  /** 黑暗是否開啟中 */
  world.isDark = () => darkness.active;
  /** 其他模組的物件也要變暗（例如特效的碎石）：加入補丁範圍 */
  world.addDarkRoot = (obj) => { if (obj && !darkRoots.includes(obj)) darkRoots.push(obj); };
  /** 測試用：強制黑暗開關（null＝依 state.dark） */
  world.forceDark = (v) => { darkness.force(v); if (v) prewarmDark(); };

  function buildGlows(lamp, gates, decor, decorGroup) {
    const ox = -world.W / 2, oz = -world.H / 2;
    if (lamp) {
      let found = false;
      lamp.updateMatrixWorld(true);
      lamp.traverse((o) => {
        if (found || !o.isPointLight) return;
        o.getWorldPosition(_v);
        glows.addHalo(_v.x, _v.y, _v.z, 1.9, '#ffd27a', 0.75);
        found = true;
      });
      if (!found) glows.addHalo(lamp.position.x + ox, 1.3, lamp.position.z + oz, 1.9, '#ffd27a', 0.75);
      glows.addPool(lamp.position.x + ox, 0, lamp.position.z + oz, 3.4, '#ffb45a', 0.55);
    }
    for (const g of gates) {
      glows.addPool(g.position.x + ox, 0, g.position.z + oz, 1.7, '#b45cff', 0.55);
      glows.addHalo(g.position.x + ox, 0.7, g.position.z + oz, 1.6, '#b45cff', 0.35);
    }
    for (const d of decor) {
      const wx = d.obj.position.x + ox, wz = d.obj.position.z + oz;
      const clusters = glowClusters(d.obj);
      if (d.kind === 'house') {
        glows.addPool(wx, 0, wz, 1.5, '#ffc070', 0.38);
        for (const k of clusters.slice(0, 4)) glows.addHalo(k.x, k.y, k.z, 0.55, '#ffd27d', 0.55);
      } else if (d.kind === 'lamppost') {
        glows.addPool(wx, 0, wz, 1.9, '#ffc070', 0.5);
        let lp = null;
        d.obj.traverse((o) => { if (!lp && o.isPointLight) { o.getWorldPosition(_v2); lp = _v2.clone(); } });
        if (lp) glows.addHalo(lp.x, lp.y, lp.z, 1.0, '#ffd27a', 0.6);
        else if (clusters.length) glows.addHalo(clusters[0].x, clusters[0].y, clusters[0].z, 1.0, '#ffd27a', 0.6);
        else glows.addHalo(wx, 1.15, wz, 1.0, '#ffd27a', 0.6);
      } else if (d.kind === 'crystal') {
        glows.addPool(wx, 0, wz, 1.1, '#9a7dff', 0.4);
        glows.addHalo(wx, 0.45, wz, 0.9, '#b9a0ff', 0.4);
      } else if (d.kind === 'glowshroom') {
        glows.addPool(wx, 0, wz, 1.5, '#3fe0c8', 0.22);
        glows.addHalo(wx, 0.4, wz, 0.8, '#7ff5e0', 0.28);
      } else if (d.kind === 'cavecrystal') {
        // 水晶的「中繼發光」是動態的（effects 依 state.lights 畫），這裡只留很淡的底光
        glows.addHalo(wx, 0.5, wz, 0.6, '#a58cff', 0.22);
      } else if (d.kind === 'stalagmite' || d.kind === 'minecart') {
        // 不發光
      } else {
        for (const k of clusters.slice(0, 2)) glows.addHalo(k.x, k.y, k.z, 0.45, '#ffd9a0', 0.35);
      }
    }
  }

  // 找模型裡自發光的頂點（B 的 vc 材質用 fx.x 表示發光強度；或材質本身有 emissive），分群回傳世界座標
  function glowClusters(obj) {
    const cells = new Map();
    obj.updateMatrixWorld(true);
    obj.traverse((m) => {
      if (!m.isMesh) return;
      const g = m.geometry, pos = g.attributes.position, fx = g.attributes.fx;
      const mat = m.material;
      const matGlow = mat && mat.emissive && !Array.isArray(mat) && (mat.emissive.r + mat.emissive.g + mat.emissive.b) * (mat.emissiveIntensity ?? 1) > 0.3;
      if (!pos || (!fx && !matGlow)) return;
      if (matGlow && !fx) {
        _box.setFromObject(m); _box.getCenter(_v);
        cells.set(`m${m.id}`, { x: _v.x, y: _v.y, z: _v.z, n: 1 });
        return;
      }
      for (let i = 0; i < pos.count; i++) {
        if (fx.getX(i) < 0.4) continue;
        _v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld);
        const key = `${Math.round(_v.x / 0.35)},${Math.round(_v.y / 0.35)},${Math.round(_v.z / 0.35)}`;
        let c = cells.get(key);
        if (!c) { c = { x: 0, y: 0, z: 0, n: 0 }; cells.set(key, c); }
        c.x += _v.x; c.y += _v.y; c.z += _v.z; c.n++;
      }
    });
    const out = [];
    for (const c of cells.values()) out.push({ x: c.x / c.n, y: c.y / c.n, z: c.z / c.n, n: c.n });
    out.sort((a, b) => b.n - a.n);
    return out;
  }

  /** 漏怪時讓守護燈閃爍（effects 會呼叫） */
  world.flashLamp = function (sec = 0.6) { lampFlicker = Math.max(lampFlicker, sec); };

  // ---------------------------------------------------------------- 畫質
  world.setQuality = function (q = 'high') {
    world.quality = q;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q === 'low' ? 1.25 : 2));
    const size = q === 'low' ? 1024 : 2048;
    if (sun.shadow.mapSize.x !== size) {
      sun.shadow.mapSize.set(size, size);
      if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
    }
    world.resize();
  };

  // ---------------------------------------------------------------- 迴圈
  let time = 0;
  world.pixelScale = function () {
    return renderer.domElement.height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
  };
  world.update = function (dt) {
    dt = Math.min(Math.max(dt || 0, 0), 0.1);
    time += dt;
    cam.update(dt);
    if (envT < 1) {
      envT = Math.min(1, envT + dt / envDur);
      const s = envT * envT * (3 - 2 * envT);
      lerpParams(envCur, envFrom, envTo, s);
      applyEnv(envCur);
    }
    const p = envCur;
    scene.fog.near = cam.dist * p.fogNear;
    scene.fog.far = cam.dist * p.fogFar;
    const ps = world.pixelScale();
    sky.update(dt, camera);
    water.update(dt);
    markers.update(dt);
    rain.update(dt, camera, cam.target, cam.dist, ps, p.night);
    mist.update(dt, ps);
    glows.update(dt, p.night, ps);
    darkness.update(dt);
    // 燈與傳送門的動畫由 view.js 更新；這裡只算漏怪閃爍係數
    if (lampFlicker > 0) {
      lampFlicker -= dt;
      lampFlickerK = 0.25 + 0.75 * Math.abs(Math.sin(time * 23)) * (0.5 + 0.5 * Math.sin(time * 7.3));
    } else lampFlickerK = 1;
    updateCrystals();
    for (const o of dynamicObjs) if (o.userData && o.userData.update) o.userData.update(dt, world.env.time);
    for (const d of decorLights) d.light.intensity = d.base * (0.2 + 0.8 * p.night);
  };
  world.render = function () {
    darkness.prepare(darkRoots);   // 黑暗開啟時：新加入的模型材質補丁（WeakSet 查表，很便宜）
    renderer.render(scene, camera);
  };

  // ---------------------------------------------------------------- 尺寸
  world.resize = function () {
    const w = container.clientWidth || window.innerWidth;
    const h = container.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / Math.max(1, h);
    camera.updateProjectionMatrix();
    cam.onResize();
  };
  window.addEventListener('resize', world.resize);
  window.addEventListener('orientationchange', () => setTimeout(world.resize, 120));
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(() => world.resize()).observe(container);
  world.resize();

  return world;
}

export { SEA_Y };
