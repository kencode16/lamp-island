// 《守燈小島》介面入口（擁有者：D 介面）。合約見 架構.md §8，詳細說明見 js/ui/README.md。
// UI 是蓋在 canvas 上的 DOM：根層 pointer-events:none，只有可互動元素吃事件，3D 畫面照樣能拖曳。

import { h, icon } from './dom.js';
import { SKILLS, HEROES, HERO_SKILLS } from '../data/heroes.js';
import { loadProgress, recordResult } from './save.js';
import { FALLBACK_LEVELS } from './levels_fallback.js';
import { createHUD } from './hud.js';
import { createMenus } from './menus.js';
import { TOWERS } from '../data/towers.js';
import { createTitle, createMap, createTalents, createPause, createResult, createSettings, createRotate } from './screens.js';

const SHARED_DEFS = `<svg class="ui-defs" width="0" height="0" aria-hidden="true" focusable="false"><defs>
  <linearGradient id="ui-g-silver" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f4f6fa"/><stop offset=".5" stop-color="#b9c0cc"/><stop offset="1" stop-color="#7d8696"/></linearGradient>
</defs></svg>`;

export function createUI(rootElement, handlers = {}) {
  const root = rootElement || document.body;
  root.classList.add('ui-root');
  root.insertAdjacentHTML('afterbegin', SHARED_DEFS);

  // ---------- 狀態 ----------
  let progress = loadProgress();
  let levels = FALLBACK_LEVELS;
  let screen = 'none';
  let paused = false, resultOpen = false, speed = 1;
  let targeting = null, tipText = null;
  let currentLevel = null, lastState = null;
  let levelsExplicit = false;   // 呼叫端用 ui.setLevels 給過資料，就不再被自動載入的 levels.js 蓋掉

  const call = (name, ...args) => {
    const f = handlers && handlers[name];
    if (typeof f !== 'function') return undefined;
    try { return f(...args); } catch (e) { console.error(`[ui] handlers.${name} 發生錯誤`, e); return undefined; }
  };
  // 介面音效：main 有給 onSound 就交給它；沒有就直接用 E 的 audio.play（同一個模組實例，音量設定一致）
  let audioMod = null;
  if (typeof handlers.onSound !== 'function') {
    import('../audio/audio.js').then(m => { audioMod = m.audio || m.default || null; }).catch(() => {});
  }
  const sound = name => {
    if (typeof handlers.onSound === 'function') return call('onSound', name);
    try { audioMod?.play?.(name); } catch (e) { /* 音效失敗不影響操作 */ }
  };
  const compactMQ = window.matchMedia('(max-height: 520px), (max-width: 760px)');

  // ---------- 安全區域（瀏海、Home 條） ----------
  const probe = h('div', { class: 'ui-safe-probe', 'aria-hidden': 'true' });
  const safe = () => {
    const cs = getComputedStyle(probe);
    return { t: parseFloat(cs.paddingTop) || 0, r: parseFloat(cs.paddingRight) || 0, b: parseFloat(cs.paddingBottom) || 0, l: parseFloat(cs.paddingLeft) || 0 };
  };

  // ---------- 內部共用介面（給各畫面模組） ----------
  const ctx = {
    call, sound,
    toast: t => toast(t),
    progress: () => progress,
    levels: () => levels,
    go: name => (name === 'map' ? api.showMap() : name === 'talents' ? api.showTalents() : name === 'title' ? api.showTitle() : null),
    openSettings: () => settings.open(),
    settingsClosed: () => {},
    resume: () => setPaused(false, true),
    leaveGame: name => { setPaused(false, true); call(name); },
    leaveResult: name => { hideResult(); call(name); },
    safe, compact: () => compactMQ.matches,
    layerRect: () => root.getBoundingClientRect(),
    lastLevel: () => currentLevel,
  };

  // ---------- 元件 ----------
  const hud = createHUD({
    pauseToggle: () => togglePause(),
    speedToggle: () => toggleSpeed(),
    callWave: () => callWave(),
    skill: id => useSkill(id),
    heroSkill: id => useHeroSkill(id),
    hero: () => heroTap(),
  });
  const menus = createMenus(ctx);
  const title = createTitle(ctx);
  const map = createMap(ctx);
  const talents = createTalents(ctx);
  const pause = createPause(ctx);
  const result = createResult(ctx);
  const settings = createSettings(ctx);
  const rotate = createRotate();

  // 教學泡泡
  const tipTxt = h('span', { class: 'tip-txt' }, '');
  const tip = h('div', { class: 'ui-tip', role: 'status' },
    h('span', { class: 'tip-ico' }, icon('lamp')), tipTxt,
    h('button', { type: 'button', class: 'ui-btn teal small tip-ok', onclick: () => { sound('click'); tip.classList.remove('is-open'); } }, '知道了'));

  // 技能瞄準提示
  const tgtTxt = h('span', { class: 'tgt-txt' }, '');
  const tgtIco = h('span', { class: 'tgt-ico' }, '');
  const tgt = h('div', { class: 'ui-target', role: 'status' }, tgtIco, tgtTxt,
    h('button', { type: 'button', class: 'ui-btn wood small tgt-cancel', onclick: () => cancelTargeting() }, icon('close'), h('span', null, '取消'), h('kbd', { class: 'ui-key' }, 'Esc')));

  // 橫幅、Toast
  const bText = h('b', { class: 'bn-text' }, '');
  const bSub = h('span', { class: 'bn-sub' }, '');
  const bannerEl = h('div', { class: 'ui-banner', 'aria-live': 'polite' }, h('i', { class: 'bn-line' }), bText, bSub, h('i', { class: 'bn-line' }));
  const toasts = h('div', { class: 'ui-toasts', 'aria-live': 'polite' });

  const gameLayer = h('div', { class: 'ui-gamefx' }, tgt, tip);
  root.append(probe, hud.el, gameLayer, menus.el, title.el, map.el, talents.el, pause.el, result.el, settings.el, bannerEl, toasts, rotate);

  // ---------- 正式關卡資料（F 的 levels.js；不存在就用備用資料） ----------
  import('../data/levels.js').then(m => {
    if (!levelsExplicit && Array.isArray(m.LEVELS) && m.LEVELS.length) setLevelsInner(m.LEVELS);
  }).catch(() => { /* 還沒有 levels.js：用備用資料 */ });

  // ---------- 畫面切換 ----------
  function setScreen(name) {
    const changed = name !== screen;
    screen = name;
    root.dataset.screen = name;
    title.el.classList.toggle('is-open', name === 'title');
    map.el.classList.toggle('is-open', name === 'map');
    talents.el.classList.toggle('is-open', name === 'talents');
    hud.el.classList.toggle('is-open', name === 'game');
    gameLayer.classList.toggle('is-open', name === 'game');
    if (name !== 'game') {
      clearBanners();
      menus.close('api');
      setTargetingInner(null);
      setTip(null);
      paused = false; pause.el.classList.remove('is-open');
      hideResult();
    }
    if (name !== 'map') map.closeInfo();
    if (changed) call('onScreen', name);
    return changed;
  }

  function setPaused(p, notify) {
    p = !!p;
    if (p && (screen !== 'game' || resultOpen)) p = false;
    const was = paused;
    paused = p;
    pause.el.classList.toggle('is-open', p);
    root.classList.toggle('is-paused', p);
    hud.setPaused(p);
    if (p) { menus.close('api'); pause.focus(); }
    if (notify && was !== p) call('onPause', p);
  }

  function hideResult() {
    resultOpen = false;
    result.hide();
    result.el.classList.remove('is-open');
  }

  // ---------- HUD 動作（按鈕與鍵盤共用） ----------
  function togglePause() { if (screen === 'game' && !resultOpen) { sound('click'); setPaused(!paused, true); } }

  function toggleSpeed() {
    if (screen !== 'game' || resultOpen) return;
    speed = speed === 2 ? 1 : 2;
    hud.setSpeed(speed);
    sound('click');
    call('onSpeed', speed);
  }

  function callWave() {
    if (screen !== 'game' || paused || resultOpen) return;
    if (hud.callButton.classList.contains('is-hidden')) { sound('error'); return; }
    sound('click');
    call('onCallWave');
  }

  function useSkill(id) {
    if (screen !== 'game' || paused || resultOpen) return;
    const def = SKILLS[id];
    const st = lastState?.skills?.[id];
    if (!def || !st?.unlocked) { sound('error'); toast(`${def?.name || '技能'}尚未解鎖`); return; }
    if (targeting === id) { cancelTargeting(); return; }
    if ((st.cd || 0) > 0) { sound('error'); toast(`${def.name}冷卻中（${Math.ceil(st.cd)} 秒）`); return; }
    menus.close('api');
    sound('click');
    call('onSkill', id);
  }

  const heroName = () => (HEROES[lastState?.hero?.type] || HEROES.knight)?.name || '英雄';

  function heroTap() {
    if (screen !== 'game' || paused) return;
    const hr = lastState?.hero;
    sound('click');
    if (hr?.state === 'dead') { toast(`${heroName()} ${Math.ceil(hr.respawnIn || 0)} 秒後復活`); return; }
    menus.close('cancel');
    if (targeting) { setTargetingInner(null); call('onCancelTargeting'); }
    // 有 onHeroSelect：選取／取消與提示文字都由 main 負責（main 再呼叫 ui.setHeroSelected 同步外框）
    if (typeof handlers.onHeroSelect === 'function') call('onHeroSelect');
    else toast(`點畫面上的${heroName()}，再點地面就能移動`);
  }

  // 英雄技能（頭像旁兩顆按鈕、鍵盤 C／V）：檢查完才呼叫 handlers.onHeroSkill(skillId)；
  // 要指定地點的技能由 main 呼叫 ui.setTargeting(skillId) 進入瞄準（和流星雨一樣）
  function useHeroSkill(id) {
    if (screen !== 'game' || paused || resultOpen) return;
    const def = HERO_SKILLS[id];
    const hr = lastState?.hero;
    const st = hr?.skills?.[id];
    if (!def || !st) { sound('error'); return; }
    if (targeting === id) { cancelTargeting(); return; }
    if (hr.state === 'dead') { sound('error'); toast(`${heroName()}倒下了，${Math.ceil(hr.respawnIn || 0)} 秒後復活`); return; }
    if (!st.unlocked) { sound('error'); toast(`英雄升到 Lv${def.minLevel || 1} 才能用${def.name}`); return; }
    if ((st.cd || 0) > 0) { sound('error'); toast(`${def.name}冷卻中（${Math.ceil(st.cd)} 秒）`); return; }
    menus.close('api');
    sound('click');
    call('onHeroSkill', id);
  }
  const heroSkillKey = i => { const id = hud.heroSkillIds()[i]; if (id) useHeroSkill(id); };

  function cancelTargeting() {
    if (!targeting) return;
    sound('click');
    setTargetingInner(null);
    call('onCancelTargeting');
  }

  function setTargetingInner(id) {
    targeting = id && (SKILLS[id] || HERO_SKILLS[id]) ? id : null;
    hud.setTargeting(targeting);
    root.classList.toggle('is-hero-targeting', !!(targeting && HERO_SKILLS[targeting]));
    if (targeting) {
      const d = SKILLS[targeting] || HERO_SKILLS[targeting];
      tgtIco.textContent = d.icon || '✦';
      tgtTxt.textContent = d.needsTarget === false ? `${d.name}：點一下施放` : `點地面施放${d.name}`;
      menus.close('api');
    }
    tgt.classList.toggle('is-open', !!targeting);
    root.classList.toggle('is-targeting', !!targeting);
  }

  function setTip(text) {
    if (text === tipText && (text == null || tip.classList.contains('is-open'))) return;
    tipText = text || null;
    if (tipText) { tipTxt.textContent = tipText; tip.classList.add('is-open'); }
    else tip.classList.remove('is-open');
  }

  // ---------- Toast 與橫幅 ----------
  function toast(text) {
    if (!text) return;
    const last = toasts.lastElementChild;
    if (last && last.dataset.text === text && !last.classList.contains('is-out')) {
      clearTimeout(last._t); last._t = setTimeout(() => dropToast(last), 2200);
      if (last.animate) last.animate([{ transform: 'scale(1.06)' }, { transform: 'scale(1)' }], { duration: 200 });
      return;
    }
    const t = h('div', { class: 'ui-toast', dataset: { text } }, text);
    toasts.append(t);
    while (toasts.children.length > 3) toasts.firstElementChild.remove();
    requestAnimationFrame(() => t.classList.add('is-in'));
    t._t = setTimeout(() => dropToast(t), 2200);
  }
  function dropToast(t) { t.classList.add('is-out'); setTimeout(() => t.remove(), 300); }

  const bannerQ = [];
  let bannerBusy = false, bannerT1 = 0, bannerT2 = 0, bannerTok = 0;
  // 換畫面、出結算時清掉還沒播完的橫幅，免得「第 N 波」蓋在結算卡上
  function clearBanners() {
    bannerQ.length = 0;
    bannerTok++;
    clearTimeout(bannerT1); clearTimeout(bannerT2);
    bannerBusy = false;
    bannerEl.classList.remove('is-show');
  }
  function banner(text, sub) {
    if (!text) return;
    bannerQ.push([String(text), sub ? String(sub) : '']);
    if (bannerQ.length > 3) bannerQ.shift();
    if (!bannerBusy) nextBanner();
  }
  function nextBanner() {
    const it = bannerQ.shift();
    if (!it) { bannerBusy = false; return; }
    bannerBusy = true;
    bText.textContent = it[0];
    bSub.textContent = it[1];
    bannerEl.classList.toggle('has-sub', !!it[1]);
    const tok = bannerTok;
    requestAnimationFrame(() => { if (tok === bannerTok) bannerEl.classList.add('is-show'); });
    const dur = bannerQ.length ? 1400 : 2200;
    bannerT1 = setTimeout(() => { bannerEl.classList.remove('is-show'); bannerT2 = setTimeout(nextBanner, 420); }, dur);
  }

  // ---------- 鍵盤 ----------
  function onKey(e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const tag = e.target && e.target.tagName;
    const typing = tag === 'TEXTAREA' || (tag === 'INPUT' && e.target.type !== 'range') || e.target?.isContentEditable;
    const code = e.code || '';
    const k = e.key;

    if (k === 'Escape' || code === 'Escape') {
      if (settings.isOpen()) settings.escape();
      else if (screen === 'map' && map.isInfoOpen()) map.closeInfo();
      else if (screen === 'talents') api.showMap();
      else if (menus.isOpen()) menus.close('esc');
      else if (targeting) cancelTargeting();
      else if (screen === 'game' && !resultOpen) setPaused(!paused, true);
      else return;
      e.preventDefault();
      return;
    }
    if (typing) return;
    if (settings.isOpen()) return;

    if (k === 'Enter') {
      if (screen === 'title') { e.preventDefault(); sound('click'); api.showMap(); }
      else if (screen === 'map' && map.isInfoOpen()) { e.preventDefault(); map.startInfo(); }
      else if (resultOpen) { const b = result.el.querySelector('.res-btns .ui-btn:last-child'); if (b) { e.preventDefault(); b.click(); } }
      return;
    }
    if (screen === 'map' && !e.repeat && map.key(code)) { e.preventDefault(); return; }
    if (screen !== 'game' || resultOpen) return;

    if (code === 'Space' || k === ' ') { e.preventDefault(); if (!e.repeat) togglePause(); return; }
    if (paused) return;
    if (menus.isOpen() && menus.key(code)) { e.preventDefault(); return; }
    if (e.repeat) return;
    switch (code) {
      case 'KeyF': e.preventDefault(); toggleSpeed(); break;
      case 'KeyN': e.preventDefault(); callWave(); break;
      case 'KeyZ': e.preventDefault(); useSkill('meteor'); break;
      case 'KeyX': e.preventDefault(); useSkill('freeze'); break;
      case 'KeyC': e.preventDefault(); heroSkillKey(0); break;
      case 'KeyV': e.preventDefault(); heroSkillKey(1); break;
      default: break;   // WASD、Q/E、方向鍵、+/- 留給鏡頭
    }
  }
  window.addEventListener('keydown', onKey);
  // 防止空白鍵在放開時「按下」剛點過的按鈕
  window.addEventListener('keyup', e => { if ((e.code === 'Space') && screen === 'game' && e.target?.tagName === 'BUTTON') e.preventDefault(); });

  // ---------- 指標事件不要傳到 canvas ----------
  const stop = e => { if (e.target !== root) e.stopPropagation(); };
  for (const t of ['pointerdown', 'mousedown', 'touchstart', 'wheel', 'click', 'dblclick']) root.addEventListener(t, stop, { passive: true });
  root.addEventListener('contextmenu', e => { if (e.target !== root) { e.preventDefault(); e.stopPropagation(); } });
  // 點過的按鈕取消焦點，避免空白鍵重複觸發
  root.addEventListener('click', e => { const b = e.target.closest && e.target.closest('button'); if (b && e.detail > 0) b.blur(); }, true);

  // ---------- 第一次使用者手勢（解鎖音效） ----------
  let gestured = false;
  const gestureTypes = ['pointerdown', 'pointerup', 'touchend', 'keydown', 'click'];
  const onGesture = e => {
    if (gestured) return;
    if (e.type === 'pointerdown' && e.pointerType !== 'mouse') return;   // 觸控要等 pointerup／touchend 才算
    if (e.type === 'keydown' && (e.key === 'Escape' || e.metaKey || e.ctrlKey)) return;
    gestured = true;
    for (const t of gestureTypes) window.removeEventListener(t, onGesture, true);
    call('onUserGesture');
  };
  for (const t of gestureTypes) window.addEventListener(t, onGesture, true);

  function setLevelsInner(list) {
    levels = list;
    if (screen === 'map') map.render();
  }

  // ---------- 對外 API ----------
  const api = {
    showTitle() { setScreen('title'); title.focus(); },

    showMap(p) {
      if (p) progress = p;
      const entering = screen !== 'map' && screen !== 'talents';   // 從天賦頁回來時保留原本看的章
      setScreen('map');
      map.render(entering);
    },

    showTalents(p) {
      if (p) progress = p;
      setScreen('talents');
      talents.render();
    },

    showGame(levelDef) {
      currentLevel = levelDef || null;
      hideResult();
      clearBanners();
      paused = false; pause.el.classList.remove('is-open'); root.classList.remove('is-paused');
      speed = 1;
      hud.reset(levelDef);
      lastState = null;
      tipText = null;
      setScreen('game');
      setTargetingInner(null);
      setTip(null);
      menus.close('api');
      const lv = levelDef || {};
      pause.setLevel(lv.id != null ? `第 ${lv.id} 關．${lv.name || ''}` : (lv.name || ''));
    },

    showResult(r = {}) {
      const levelId = r.levelId ?? currentLevel?.id;
      if (r.won) recordResult(progress, levelId, r);
      menus.close('api');
      setTargetingInner(null);
      setTip(null);
      clearBanners();
      paused = false; pause.el.classList.remove('is-open'); root.classList.remove('is-paused'); hud.setPaused(false);
      resultOpen = true;
      const lv = (currentLevel && currentLevel.id === levelId ? currentLevel : null) || levels.find(l => l.id === levelId) || null;
      result.show({ ...r, levelId }, lv);
      result.el.classList.add('is-open');
    },

    showPause(on) { setPaused(!!on, false); },

    updateHUD(state) {
      if (!state) return;
      lastState = state;
      if (screen !== 'game') return;
      hud.update(state);
      menus.updateGold(state.gold);
    },

    openBuildMenu(screenX, screenY, data) {
      if (screen !== 'game' || paused || resultOpen) return;
      setTargetingInner(null);
      const lvId = currentLevel?.id;
      const opts = (data?.options || []).filter(o => o && !(lvId != null && (TOWERS[o.type]?.unlock || 0) > lvId));
      menus.openBuild(screenX, screenY, { ...data, options: opts });
    },

    openTowerMenu(screenX, screenY, data) {
      if (screen !== 'game' || paused || resultOpen) return;
      setTargetingInner(null);
      menus.openTower(screenX, screenY, data);
    },

    closeMenus() { menus.close('api'); },
    toast,
    banner,
    tutorial(text) { setTip(text || null); },
    setTargeting(skillId) { setTargetingInner(skillId || null); },

    // ---- 以下為新增（合約以外） ----
    /** 換成正式關卡資料（ui 也會自己動態 import js/data/levels.js） */
    setLevels(list) {
      if (!Array.isArray(list) || !list.length) return;
      levelsExplicit = true;
      setLevelsInner(list);
    },
    /** 打開設定視窗（credits = true 直接顯示製作名單） */
    showSettings(credits) { settings.open(!!credits); },
    /** 同步速度顯示（不會呼叫 onSpeed） */
    setSpeed(n) { speed = n === 2 ? 2 : 1; hud.setSpeed(speed); },
    /** 英雄頭像的「已選取」外框 */
    setHeroSelected(on) { hud.setHeroSelected(on); },
    isMenuOpen() { return menus.isOpen(); },
    /** 'build' | 'tower' | null */
    menuKind() { return menus.kind(); },
    /** 航海圖目前顯示的章節；setMapChapter(n) 切換 */
    get mapChapter() { return map.chapter; },
    setMapChapter(n) { map.setChapter(n); },
    /** 目前關卡（showGame 給的 levelDef） */
    get level() { return currentLevel; },
    get screen() { return screen; },
    get paused() { return paused; },
    get speed() { return speed; },
    get targeting() { return targeting; },
    get progress() { return progress; },
  };
  return api;
}

export { loadProgress, saveProgress, starsEarned, starsSpent, isHeroUnlocked, chosenHero, unlocksForClear, isChapterUnlocked } from './save.js';
