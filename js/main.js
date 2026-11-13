// 《守燈小島》主程式（擁有者：整合者）：啟動、畫面流程、遊戲迴圈、點擊流程、事件分派
import { createWorld } from './render/world.js';
import { createEffects } from './render/effects.js';
import { createView } from './view.js';
import { createUI } from './ui/ui.js';
import { loadProgress, saveProgress } from './ui/save.js';
import { audio } from './audio/audio.js';
import { createGame } from './sim/game.js';
import { LEVELS } from './data/levels.js';
import { TOWERS, TOWER_ORDER } from './data/towers.js';
import { SKILLS, HEROES, HERO_ORDER, HERO_SKILLS } from './data/heroes.js';
import { setModelLift } from './render/models.js';

const STEP = 1 / 60;
const params = new URLSearchParams(location.search);
const DEBUG = params.has('debug');

let world, fx, view, ui, progress;
let game = null, level = null;
let mode = 'title';            // title | map | game | result
let paused = false, speed = 1, acc = 0;
let heroSelected = false, targeting = null, menu = null; // targeting: { kind:'skill'|'hero', id }；menu: { kind:'build'|'tower', c, r, towerId }
let currentHero = 'knight';   // v2.0：這一關用的英雄
let resultShown = false, pathsShownUntil = 0;
const tutorialShown = new Set();
let tutorialTimer = 0;

const cellChar = (c, r) => (level && level.grid[r] ? level.grid[r][c] : '~');

let gestured = false;
const introActive = () => !!(window.__intro && window.__intro.active);

function boot() {
  // 開場動畫結束後：使用者已經點過畫面（音效已解鎖）就接上標題音樂
  window.__intro?.done.then(() => { if (gestured && mode !== 'game') audio.music?.('menu'); });
  progress = loadProgress();
  world = createWorld(document.getElementById('scene'));
  fx = createEffects(world);
  view = createView(world);
  // v1.3：開場動畫播放中先不下載音效（約 5 MB），把網路讓給影片；動畫結束才開始預載
  if (introActive()) audio.holdPreload?.(window.__intro.done);
  audio.init?.();
  audio.setSpatial?.((x, z) => {
    const s = world.toScreen(x, 0, z);
    const pan = Math.max(-1, Math.min(1, (s.x / innerWidth) * 2 - 1)) * 0.6;
    return { pan, gain: s.visible ? 1 : 0.55 };
  });
  applySettings(progress.settings || {});

  ui = createUI(document.getElementById('ui'), {
    onStartLevel: (id, heroId) => startLevel(id, heroId),
    onBuild: (c, r, type) => doBuild(c, r, type),
    onUpgrade: (id, branch) => doUpgrade(id, branch),
    onSell: (id) => doSell(id),
    onCallWave: () => { closeMenus(); doCallWave(); },
    onSkill: (id) => { closeMenus(); doSkill(id); },
    onHeroSkill: (id) => { closeMenus(); doHeroSkill(id); },
    onCancelTargeting: () => setTargeting(null),
    onPause: (p) => { closeMenus(); setPaused(p); },
    onSpeed: (s) => { speed = s === 2 ? 2 : 1; },
    onRetry: () => startLevel(level.id, currentHero),
    onQuitToMap: () => goMap(),
    onNextLevel: () => {
      const i = LEVELS.findIndex((l) => l.id === level.id);
      if (i >= 0 && i + 1 < LEVELS.length) startLevel(LEVELS[i + 1].id, currentHero); else goMap();
    },
    onSettings: (s) => { progress = loadProgress(); progress.settings = { ...(progress.settings || {}), ...s }; saveProgress(progress); applySettings(progress.settings); },
    // 開場動畫播放中先只解鎖音效，不放標題音樂（避免蓋過影片聲音），等動畫結束再放
    onUserGesture: () => { audio.unlock?.(); gestured = true; if (mode !== 'game' && !introActive()) audio.music?.('menu'); },
    onMenuClosed: () => { menu = null; world.hideRange?.(); world.highlightCell?.(0, 0, null); },
    onScreen: (name) => { if (name === 'map' || name === 'title' || name === 'talents') enterMenuMode(name); },
    onHeroSelect: () => { closeMenus(); selectHero(!heroSelected); },
  });

  world.onTap = onTap;
  world.onHover = onHover;

  // 標題畫面背景：第 1 關的小島
  showBackdrop();
  ui.showTitle();

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && mode === 'game' && !paused && game && !isOver()) { setPaused(true); }
  });

  const boot = document.getElementById('boot');
  if (boot) { boot.style.opacity = '0'; setTimeout(() => boot.remove(), 650); }

  if (DEBUG) {
    window.__SD = { get game() { return game; }, get level() { return level; }, world, view, ui, fx, audio,
      startLevel, goMap, setPaused, setSpeed: (s) => { speed = s; }, onTap, progress: () => progress,
      tapCell: (c, r) => { const s = world.toScreen(c + 0.5, 0, r + 0.5); onTap({ clientX: s.x, clientY: s.y, c, r, x: c + 0.5, z: r + 0.5 }); },
      mode: () => mode };
    if (params.get('level')) startLevel(Number(params.get('level')));
  }
  requestAnimationFrame(loop);
}

function applySettings(s) {
  audio.setVolume?.({ music: s.music ?? 0.6, sfx: s.sfx ?? 0.8 });
  world.setQuality?.(s.quality || 'high');
}

function showBackdrop() {
  const lv = LEVELS[0];
  world.clearLevel();
  view.clear();
  fx.clear?.();
  const built = world.buildLevel(lv);
  level = null; game = null;
  setEnvAll(lv.env || { time: 'day', weather: 'clear' }, 0);
  world.cam?.reset?.();
  world.cam && (world.cam.enabled = false);
  world.cam?.setAutoRotate?.(true);
  backdropBuilt = built;
}
let backdropBuilt = null;

function enterMenuMode(name) {
  if (mode === 'game') return;
  mode = name;
}

function goMap() {
  closeMenus();
  setTargeting(null); selectHero(false);
  paused = false; ui.showPause?.(false);
  mode = 'map';
  showBackdrop();
  ui.showMap(progress);
  audio.music?.('menu');
}

function startLevel(id, heroId) {
  const lv = LEVELS.find((l) => l.id === id);
  if (!lv) return;
  progress = loadProgress();
  level = lv;
  // v2.0：英雄＝介面傳來的 → 存檔記住的 → 上一關用的；沒解鎖就退回騎士
  const want = heroId || progress.hero || currentHero || 'knight';
  currentHero = HEROES[want] && (DEBUG || heroUnlocked(want, progress)) ? want : 'knight';   // 除錯模式可選任何英雄
  closeMenus(); setTargeting(null); selectHero(false);
  tutorialShown.clear(); ui.tutorial?.(null);
  world.cam?.setAutoRotate?.(false);
  world.clearLevel();
  fx.clear?.();
  const built = world.buildLevel(lv);
  game = createGame(lv, { talents: progress.talents || [], seed: (Date.now() & 0xffff) + id, hero: currentHero });
  view.reset(built, game.state);
  fx.setState?.(game.state);
  world.bindGame?.(game.state);   // v2.0：洞窟的黑暗與光照、雷射
  setEnvAll(game.state.env || lv.env, 0);
  if (world.cam) {
    world.cam.enabled = true; world.cam.reset?.();
    // 預設比「整島入鏡」再拉近一點，敵人才看得清楚（玩家可以再縮放）
    const zoomIn = innerHeight < 520 ? 1.08 : 1.2; // 手機橫向畫面扁，拉太近會切到燈
    world.cam.setView?.({ ...(lv.camera || {}), zoom: (lv.camera?.zoom ?? 1) * zoomIn });
  }
  paused = false; speed = 1; acc = 0; resultShown = false;
  mode = 'game';
  ui.showGame(lv);
  ui.showPause?.(false);
  audio.music?.(musicFor(game.state.env));
  audio.setEnv?.(game.state.env);
  audio.setHero?.(currentHero);   // v2.0：英雄受傷／倒下用各自的聲音
  audio.setPaused?.(false);
  showPathsFor(9999);
  tutorial('start');
}

function setEnvAll(env, sec) {
  world.setEnv(env, sec);
  setModelLift?.(env && env.time === 'night' ? 0.12 : 0);
}

function musicFor(env) {
  if (env && env.time === 'cave') return 'cave';
  return env && env.time === 'night' ? 'night' : 'day';
}
const bossMusic = () => (level && level.theme === 'cave' ? 'caveBoss' : 'boss');
const heroName = () => (HEROES[currentHero] || HEROES.knight).name;

function heroUnlocked(id, p) {
  const after = HEROES[id]?.unlockAfter || 0;
  return !after || ((p.stars || {})[after] || 0) > 0;
}
function unlockSnapshot(p) {
  const heroes = HERO_ORDER.filter((h) => heroUnlocked(h, p));
  const ch2 = LEVELS.some((l) => l.chapter === 2) && (((p.stars || {})[10]) || 0) > 0;
  return { heroes, ch2 };
}
function isOver() { return game && (game.state.phase === 'won' || game.state.phase === 'lost'); }

function setPaused(p) {
  if (mode !== 'game') return;
  paused = !!p;
  ui.showPause?.(paused);
  audio.setPaused?.(paused);   // v2.0：暫停時停掉雷射嗡鳴等持續音
}

function showPathsFor(sec) {
  if (!game) return;
  world.showPaths?.(game.getPaths());
  pathsShownUntil = game.state.time + sec;
}

// ---------- 點擊流程 ----------
function onTap(info) {
  audio.unlock?.();
  if (mode !== 'game' || !game || isOver()) return;
  if (menu) { closeMenus(); return; }
  const { c, r, x, z } = info;

  if (targeting) {
    if (targeting.kind === 'skill') {
      if (game.castSkill(targeting.id, x, z)) setTargeting(null);
      else ui.toast?.('還在冷卻中');
    } else {
      const r = game.castHeroSkill(targeting.id, x, z);
      if (r && r.ok) setTargeting(null);
      else {
        ui.toast?.(heroReason(r && r.reason, targeting.id)); audio.play?.('error');
        if (!r || r.reason !== 'range') setTargeting(null);   // 太遠就讓玩家再點一次
      }
    }
    return;
  }
  // 用螢幕距離判定點到英雄或塔（點在塔身上時，地面射線會落到後面那格）
  const hit = screenPick(info.clientX, info.clientY);
  if (hit === 'hero' || view.heroScreenHit(game.state, x, z, 0.75)) { selectHero(!heroSelected); return; }

  const tower = (hit && hit !== 'hero' ? hit : null) || game.towerAt(c, r);
  if (tower) { openTowerMenu(tower); return; }

  if (heroSelected) {
    if (game.moveHero(x, z)) { view.showMoveMarker(x, z); audio.play?.('click'); }
    selectHero(false);
    return;
  }

  openBuildMenu(c, r);   // 這格能蓋什麼由 sim 判斷（洞窟地面只能放燈籠）
}

// 這格可以放的東西（排除「不能蓋」與「未解鎖」）
function placeOptions(c, r) {
  if (!game) return [];
  return game.buildOptions(c, r).filter((o) => o.reason !== 'not-buildable' && o.reason !== 'locked');
}

// 螢幕空間點選：塔取塔身中段、英雄取身體中段，半徑隨鏡頭遠近縮放
function screenPick(cx, cy) {
  if (cx == null || !game) return null;
  const s = game.state;
  const a = world.toScreen(0, 0, 0), b = world.toScreen(1, 0, 0);
  const cell = Math.max(18, Math.hypot(a.x - b.x, a.y - b.y)); // 一格在螢幕上的像素
  let best = null, bestD = Infinity;
  const hs = s.hero;
  if (hs && hs.state !== 'dead') {
    const p = world.toScreen(hs.x, hs.flying ? 1.0 : 0.45, hs.z);
    const d = Math.hypot(p.x - cx, p.y - cy);
    if (d < cell * 0.55 && d < bestD) { best = 'hero'; bestD = d; }
  }
  for (const t of s.towers) {
    for (const y of [0.35, 0.9]) {
      const p = world.toScreen(t.x, y, t.z);
      const d = Math.hypot(p.x - cx, p.y - cy);
      if (d < cell * 0.5 && d < bestD) { best = t; bestD = d; }
    }
  }
  return best;
}

function onHover(info) {
  if (mode !== 'game' || !game) return;
  if (targeting && info) {
    const sk = targeting.kind === 'skill' ? SKILLS[targeting.id] : HERO_SKILLS[targeting.id];
    world.showTargetCircle?.(info.x, info.z, (sk && sk.radius) || 1.5);
    return;
  }
  if (menu) return;
  if (info && !game.towerAt(info.c, info.r) && placeOptions(info.c, info.r).length) world.highlightCell?.(info.c, info.r, '#ffe7a0');
  else world.highlightCell?.(0, 0, null);
}

function selectHero(on) {
  heroSelected = !!on && !!game && game.state.hero && game.state.hero.state !== 'dead';
  view.setHeroSelected(heroSelected);
  ui?.setHeroSelected?.(heroSelected);
  if (heroSelected) ui.toast?.(`點地面，讓${heroName()}移動到那裡`);
}

function screenOf(x, z, y = 0.6) { const s = world.toScreen(x, y, z); return [s.x, s.y]; }

function openBuildMenu(c, r) {
  const options = placeOptions(c, r).map((o) => ({ ...o, reason: o.ok ? '' : reasonText(o.reason) }));
  if (!options.length) return false;
  const [sx, sy] = screenOf(c + 0.5, r + 0.5, 0.2);
  menu = { kind: 'build', c, r };
  world.highlightCell?.(c, r, '#ffe7a0');
  world.showRange?.(c + 0.5, r + 0.5, game.typeStats(options[0].type).range, true);
  ui.openBuildMenu(sx, sy, { c, r, options });
  audio.play?.('open');
  return true;
}

function openTowerMenu(tower) {
  const [sx, sy] = screenOf(tower.x, tower.z, 1.0);
  menu = { kind: 'tower', towerId: tower.id };
  world.showRange?.(tower.x, tower.z, tower.range, true);
  world.highlightCell?.(tower.c, tower.r, '#ffe7a0');
  ui.openTowerMenu(sx, sy, { tower, stats: game.towerStats(tower.id), upgradeInfo: game.upgradeInfo(tower.id), sellValue: game.sellValue(tower.id) });
  audio.play?.('open');
}

function closeMenus() {
  menu = null;
  ui?.closeMenus?.();
  world?.hideRange?.();
  world?.highlightCell?.(0, 0, null);
}

function reasonText(r) {
  return { 'not-buildable': '這裡不能蓋', occupied: '已經有塔了', 'blocks-path': '會把路完全擋死', 'no-gold': '金幣不夠', locked: '尚未解鎖' }[r] || '';
}

function doBuild(c, r, type) {
  if (!game) return;
  const chk = game.canBuild(c, r, type);
  if (!chk.ok) { ui.toast?.(reasonText(chk.reason)); audio.play?.('error'); return; }
  const id = game.build(c, r, type);
  closeMenus();
  if (id != null) {
    tutorial('build');
    if (level.grid.some((row) => row.includes('o'))) showPathsFor(3);
  }
}

function doUpgrade(id, branch) {
  if (!game) return;
  const info = game.upgradeInfo(id);
  if (info.kind === 'max') { closeMenus(); return; }
  const ok = game.upgrade(id, branch);
  if (!ok) { ui.toast?.('金幣不夠'); audio.play?.('error'); return; }
  tutorial('upgrade');
  const t = game.getTower(id);
  if (t) openTowerMenu(t); else closeMenus();
}

function doSell(id) {
  if (!game) return;
  game.sell(id);
  closeMenus();
  if (level.grid.some((row) => row.includes('o'))) showPathsFor(3);
}

function doCallWave() {
  if (!game || isOver()) return;
  const wasPrep = game.state.phase === 'prep';
  game.callNextWave();
  if (wasPrep) pathsShownUntil = game.state.time + 2;
}

function doSkill(id) {
  if (!game) return;
  const sk = SKILLS[id], st = game.state.skills?.[id];
  if (!st || !st.unlocked) return;
  if (st.cd > 0) { ui.toast?.('還在冷卻中'); audio.play?.('error'); return; }
  if (sk.needsTarget) setTargeting(targeting && targeting.id === id ? null : { kind: 'skill', id });
  else game.castSkill(id);
}

// v2.0：英雄技能（手動按鈕／鍵盤 C、V）
function doHeroSkill(id) {
  if (!game || isOver()) return;
  const def = HERO_SKILLS[id], hs = game.state.hero, st = hs && hs.skills && hs.skills[id];
  if (!def || !st) return;
  if (hs.state === 'dead') { ui.toast?.(`${heroName()}倒下了，復活後才能用`); audio.play?.('error'); return; }
  if (!st.unlocked) { ui.toast?.(`${def.name}要英雄升到 Lv${def.minLevel} 才能用`); audio.play?.('error'); return; }
  if (st.cd > 0) { ui.toast?.('技能冷卻中'); audio.play?.('error'); return; }
  if (def.needsTarget) { setTargeting(targeting && targeting.id === id ? null : { kind: 'hero', id }); return; }
  const r = game.castHeroSkill(id);
  if (!r || !r.ok) { ui.toast?.(heroReason(r && r.reason, id)); audio.play?.('error'); }
}

function heroReason(reason, id) {
  const def = HERO_SKILLS[id] || {};
  return {
    locked: `${def.name || '技能'}要英雄升到 Lv${def.minLevel || 3} 才能用`,
    cooldown: '技能冷卻中',
    dead: `${heroName()}倒下了，復活後才能用`,
    range: '太遠了，要點在英雄身邊的光圈裡',
    'no-target': '附近沒有怪物',
  }[reason] || '現在不能施放';
}

function setTargeting(t) {
  targeting = t || null;
  ui?.setTargeting?.(targeting ? targeting.id : null);
  if (!targeting) { world?.hideTargetCircle?.(); world?.hideCastRange?.(); }
  else { closeMenus(); selectHero(false); }
}

// ---------- 教學 ----------
function tutorial(key) {
  if (!level || !level.tutorial || tutorialShown.has(key)) return;
  const items = level.tutorial.filter((t) => t.at === key);
  if (!items.length) return;
  tutorialShown.add(key);
  ui.tutorial?.(items.map((t) => t.text).join('\n'));
  tutorialTimer = 9;
}

// ---------- 事件 ----------
function processEvents() {
  const evs = game.drainEvents();
  for (const ev of evs) {
    fx.handle(ev);
    audio.handleEvent?.(ev);
    view.handleEvent(ev);
    switch (ev.type) {
      case 'waveStart': {
        const n = ev.index + 1;
        ui.banner?.(`第 ${n} 波`, ev.boss ? '王來了！' : (n === game.state.waveCount ? '最後一波' : ''));
        if (ev.boss) audio.music?.(bossMusic());
        tutorial(`wave:${n}`);
        if (ev.boss) tutorial('boss');
        break;
      }
      case 'env': {
        setEnvAll({ time: ev.time, weather: ev.weather }, 3);
        const t = { day: '天亮了', dusk: '黃昏降臨', night: '夜幕降臨' }[ev.time];
        const w = { rain: '下起雨了', fog: '起霧了', mist: '瘴氣瀰漫' }[ev.weather];
        ui.banner?.(t || '', w || '');
        if (!game.state.enemies.some((e) => e.boss)) audio.music?.(musicFor(ev));
        break;
      }
      case 'leak': world.cam?.shake?.(0.15); break;
      case 'heroDeath':
        if (heroSelected) selectHero(false);
        if (targeting && targeting.kind === 'hero') setTargeting(null);
        ui.toast?.(`${heroName()}倒下了，稍後會復活`);
        break;
      case 'won': case 'lost': onGameOver(ev.type === 'won'); break;
    }
  }
}

function onGameOver(won) {
  if (resultShown) return;
  resultShown = true;
  closeMenus(); setTargeting(null); selectHero(false);
  const res = game.result();
  let unlocks = [];
  if (won) {
    progress = loadProgress();
    const before = unlockSnapshot(progress);
    progress.stars = progress.stars || {}; progress.best = progress.best || {};
    progress.stars[level.id] = Math.max(progress.stars[level.id] || 0, res.stars);
    progress.best[level.id] = Math.max(progress.best[level.id] || 0, res.lamp);
    saveProgress(progress);
    const after = unlockSnapshot(progress);
    for (const h of after.heroes) if (!before.heroes.includes(h)) unlocks.push({ kind: 'hero', id: h });
    if (after.ch2 && !before.ch2) unlocks.push({ kind: 'chapter', id: 2 });
  }
  const isLast = LEVELS[LEVELS.length - 1].id === level.id;
  setTimeout(() => {
    mode = 'result';
    ui.showResult({ won, stars: res.stars, lamp: res.lamp, levelId: level.id, isLast, unlocks });
    audio.music?.(null);
    if (won) audio.playStars?.(res.stars, { delay: 0.5 });
  }, won ? 1400 : 1000);
}

// ---------- 迴圈 ----------
let last = performance.now();
function loop(now) {
  const dt = Math.min(0.1, Math.max(0, (now - last) / 1000)); last = now;
  let simDt = 0;
  if (game && (mode === 'game' || mode === 'result')) {
    if (!paused && !(mode === 'result')) {
      acc += dt * speed;
      let n = 0;
      while (acc >= STEP && n < 10) { view.capturePrev(game.state); game.step(STEP); acc -= STEP; n++; }
      if (n >= 10) acc = 0;
      simDt = dt * speed;
      processEvents();
    }
    view.sync(game.state, Math.min(1, acc / STEP), simDt, dt);
    if (targeting && targeting.kind === 'hero' && game.state.hero) {
      const hs = game.state.hero, def = HERO_SKILLS[targeting.id];
      world.showCastRange?.(hs.x, hs.z, (def && def.castRange) || 4);
    }
    if (mode === 'game') ui.updateHUD(game.state);
    if (pathsShownUntil && game.state.phase !== 'prep' && game.state.time > pathsShownUntil) { world.showPaths?.(null); pathsShownUntil = 0; }
    if (tutorialTimer > 0) { tutorialTimer -= dt; if (tutorialTimer <= 0) ui.tutorial?.(null); }
  } else if (backdropBuilt) {
    backdropBuilt.lamp?.userData.update?.(dt, 1, 'day');
    for (const g of backdropBuilt.gates || []) g.userData.update?.(dt);
  }
  fx.update(paused ? 0 : dt * (game ? speed : 1));
  world.update(dt);
  world.render();
  requestAnimationFrame(loop);
}

try { boot(); }
catch (e) {
  console.error(e);
  const m = document.getElementById('bootMsg'); if (m) m.textContent = '載入失敗：' + e.message;
}
