// 標題、地圖、天賦、暫停、結算、設定、轉向提示（擁有者：D 介面）

import { h, icon, ICON, STAR_POINTS as STAR_SVG } from './dom.js';
import { renderChart } from './map.js';
import { TOWERS, TOWER_ORDER } from '../data/towers.js';
import { SKILLS, SKILL_ORDER } from '../data/heroes.js';
import { TALENTS, TALENT_BRANCHES } from '../data/talents.js';
import { starsEarned, starsSpent, starsAvailable, isLevelUnlocked, saveProgress } from './save.js';

const TIME_TEXT = { day: ['☀️', '白天'], dusk: ['🌇', '黃昏'], night: ['🌙', '夜晚'] };
const WEATHER_TEXT = { rain: ['🌧️', '雨天'], fog: ['🌫️', '起霧'] };
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V'];

const LANTERN_BIG = `<svg viewBox="0 0 120 150" aria-hidden="true">
  <defs>
    <radialGradient id="tt-glow" cx="50%" cy="56%" r="50%"><stop offset="0" stop-color="#ffe6a0" stop-opacity=".9"/><stop offset=".45" stop-color="#ffc35a" stop-opacity=".35"/><stop offset="1" stop-color="#ffb347" stop-opacity="0"/></radialGradient>
    <linearGradient id="tt-glass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff4c2"/><stop offset=".6" stop-color="#ffd067"/><stop offset="1" stop-color="#ff9d3c"/></linearGradient>
    <linearGradient id="tt-gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fbe7a6"/><stop offset=".5" stop-color="#e5b752"/><stop offset="1" stop-color="#9b6d22"/></linearGradient>
  </defs>
  <circle cx="60" cy="84" r="58" fill="url(#tt-glow)" class="tt-halo"/>
  <circle cx="60" cy="16" r="9" fill="none" stroke="url(#tt-gold)" stroke-width="5"/>
  <path d="M34 42h52l-8-14H42z" fill="url(#tt-gold)" stroke="#6b4518" stroke-width="2.5" stroke-linejoin="round"/>
  <rect x="36" y="42" width="48" height="64" rx="8" fill="url(#tt-glass)" stroke="#6b4518" stroke-width="3"/>
  <path d="M52 44v60M68 44v60" stroke="#b4842e" stroke-width="3" opacity=".75"/>
  <path class="tt-flame" d="M60 58c9 11 12 18 12 24a12 12 0 0 1-24 0c0-6 3-13 12-24z" fill="#ff7a22"/>
  <path class="tt-flame" d="M60 70c4 5 6 8.5 6 11.5a6 6 0 0 1-12 0c0-3 2-6.5 6-11.5z" fill="#fff1b0"/>
  <path d="M30 106h60l-9 14H39z" fill="url(#tt-gold)" stroke="#6b4518" stroke-width="2.5" stroke-linejoin="round"/>
  <path d="M42 48c-1 10-1 30 0 50" stroke="#fff" stroke-opacity=".55" stroke-width="3" stroke-linecap="round" fill="none"/>
</svg>`;

const PHONE_SVG = `<svg viewBox="0 0 120 120" aria-hidden="true"><g class="rot-phone"><rect x="38" y="14" width="44" height="86" rx="9" fill="#123f45" stroke="#e5b752" stroke-width="4"/><rect x="44" y="24" width="32" height="64" rx="3" fill="#2a6d72"/><circle cx="60" cy="94" r="2.6" fill="#e5b752"/></g><path class="rot-arrow" d="M96 46a40 40 0 0 1-8 44" stroke="#fbe7a6" stroke-width="5" fill="none" stroke-linecap="round"/><path class="rot-arrow" d="M80 88l9 3 1-10" stroke="#fbe7a6" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

function btn(label, cls, onclick, ico) {
  return h('button', { type: 'button', class: 'ui-btn ' + (cls || ''), onclick }, ico ? icon(ico) : null, label ? h('span', null, label) : null);
}

// ================= 標題 =================
export function createTitle(ui) {
  const start = btn('開始', 'gold big title-start', () => { ui.sound('click'); ui.go('map'); }, 'play');
  const el = h('section', { class: 'ui-screen scr-title', 'aria-label': '標題畫面' },
    h('div', { class: 'title-veil' }),
    h('div', { class: 'title-top' },
      h('div', { class: 'title-emblem', html: LANTERN_BIG }),
      h('div', { class: 'title-words' },
        h('h1', { class: 'title-name' }, '守燈小島'),
        h('p', { class: 'title-sub' }, '點亮燈火，守護小島直到天明'))),
    h('div', { class: 'title-bottom' }, start,
      h('p', { class: 'title-hint' }, h('span', { class: 'only-fine' }, '滑鼠點選．鍵盤快捷鍵'), h('span', { class: 'only-coarse' }, '橫向遊玩．點一下就能蓋塔'))));
  return { el, focus: () => start.focus({ preventScroll: true }) };
}

// ================= 關卡地圖 =================
export function createMap(ui) {
  const starNum = h('b', null, '0');
  const starMax = h('small', null, '/30');
  const badge = h('span', { class: 'ui-badge is-hidden' }, '0');
  const chart = h('div', { class: 'map-chart' });
  const head = h('header', { class: 'map-head' },
    h('div', { class: 'map-title' }, h('span', { class: 'map-title-ico', html: ICON.ship }), h('h2', null, '航海圖'), h('small', { class: 'map-tip' }, '選一座小島出航')),
    h('div', { class: 'map-tools' },
      h('div', { class: 'ui-chip map-stars', title: '總星數' }, icon('star', 'is-gold'), starNum, starMax),
      h('button', { type: 'button', class: 'ui-btn teal map-talent', onclick: () => { ui.sound('click'); ui.go('talents'); } }, icon('tree'), h('span', null, '天賦'), badge),
      h('button', { type: 'button', class: 'ui-btn wood icon-only', 'aria-label': '設定', onclick: () => { ui.sound('click'); ui.openSettings(); } }, icon('gear'))));
  const frame = h('div', { class: 'map-frame ui-panel' }, head, chart);

  // 關卡介紹卡
  const card = h('div', { class: 'lvl-card ui-panel', role: 'dialog' });
  const modal = h('div', { class: 'lvl-modal', onclick: e => { if (e.target === modal) closeInfo(); } }, card);
  const el = h('section', { class: 'ui-screen scr-map', 'aria-label': '關卡地圖' }, frame, modal);
  let infoId = null;

  function render() {
    const p = ui.progress();
    const levels = ui.levels();
    const maxStars = levels.length * 3;
    starNum.textContent = starsEarned(p);
    starMax.textContent = '/' + maxStars;
    const avail = starsAvailable(p);
    badge.textContent = avail;
    badge.classList.toggle('is-hidden', avail <= 0);
    chart.textContent = '';
    chart.append(renderChart(levels, p, id => isLevelUnlocked(p, id), pick));
    if (infoId != null) openInfo(infoId, true);
  }

  function pick(id) {
    const p = ui.progress();
    if (!isLevelUnlocked(p, id)) {
      ui.sound('error');
      ui.toast(`先通過第 ${id - 1} 關才能前往這座島`);
      return;
    }
    ui.sound('open');
    openInfo(id);
  }

  function openInfo(id, keep = false) {
    const lv = ui.levels().find(l => l.id === id);
    if (!lv) return;
    infoId = id;
    const p = ui.progress();
    const stars = p.stars[id] || 0;
    const best = p.best[id];
    const lampMax = lv.lamp || 20;
    const tags = [];
    const t = TIME_TEXT[lv.env?.time] || TIME_TEXT.day;
    const times = [lv.env?.time || 'day'];
    for (const w of lv.waves || []) if (w.env?.time && w.env.time !== times[times.length - 1]) times.push(w.env.time);
    tags.push(h('span', { class: 'ui-tag' }, t[0] + ' ' + times.map(x => (TIME_TEXT[x] || t)[1]).join('→')));
    const wt = WEATHER_TEXT[lv.env?.weather];
    if (wt) tags.push(h('span', { class: 'ui-tag' }, wt[0] + ' ' + wt[1]));
    if (lv.waves?.length) tags.push(h('span', { class: 'ui-tag' }, icon('wave'), ` ${lv.waves.length} 波`));
    const news = [];
    for (const k of TOWER_ORDER) if (TOWERS[k].unlock === id && id > 1) news.push(`${TOWERS[k].icon} ${TOWERS[k].name}`);
    for (const k of SKILL_ORDER) if (SKILLS[k].unlock === id) news.push(`${SKILLS[k].icon} ${SKILLS[k].name}`);
    const starRow = h('div', { class: 'lvl-stars' });
    for (let i = 0; i < 3; i++) starRow.append(icon('star', i < stars ? 'is-gold' : 'is-empty'));
    card.textContent = '';
    card.append(...[
      h('button', { type: 'button', class: 'ui-x', 'aria-label': '關閉', onclick: () => { ui.sound('click'); closeInfo(); } }, icon('close')),
      h('div', { class: 'lvl-num' }, `第 ${id} 關`),
      h('h2', { class: 'lvl-name' }, lv.name),
      h('div', { class: 'lvl-tags' }, tags),
      h('p', { class: 'lvl-desc' }, lv.desc || ''),
      news.length ? h('div', { class: 'lvl-new' }, h('b', null, '新登場'), news.join('　')) : null,
      h('div', { class: 'lvl-rec' }, starRow, h('span', null, best != null ? `最佳燈光 ${best} / ${lampMax}` : '尚未挑戰')),
      h('div', { class: 'lvl-btns' },
        btn('返回', 'wood', () => { ui.sound('click'); closeInfo(); }, 'back'),
        btn('出發', 'gold go', () => { ui.sound('click'); closeInfo(); ui.call('onStartLevel', id); }, 'ship'))].filter(Boolean));
    modal.classList.add('is-open');
    if (!keep) card.querySelector('.go')?.focus({ preventScroll: true });
  }
  function closeInfo() { infoId = null; modal.classList.remove('is-open'); }

  return { el, render, closeInfo, isInfoOpen: () => infoId != null, startInfo: () => { const b = card.querySelector('.go'); if (b && infoId != null) b.click(); } };
}

// ================= 天賦 =================
export function createTalents(ui) {
  const availNum = h('b', null, '0');
  const earnedTxt = h('small', null, '');
  const resetBtn = btn('全部重置', 'ghost tal-reset', () => onReset(), 'retry');
  const cols = h('div', { class: 'tal-cols' });
  const head = h('header', { class: 'tal-head' },
    h('button', { type: 'button', class: 'ui-btn wood icon-only', 'aria-label': '返回地圖', onclick: () => { ui.sound('click'); ui.go('map'); } }, icon('back')),
    h('h2', null, '天賦'),
    h('div', { class: 'ui-chip tal-avail', title: '可用星數' }, icon('star', 'is-gold'), h('span', { class: 'tal-avail-lbl' }, '可用'), availNum, earnedTxt),
    resetBtn);
  const el = h('section', { class: 'ui-screen scr-talents', 'aria-label': '天賦' },
    h('div', { class: 'tal-frame ui-panel' }, head, cols));
  let armed = 0;

  function owned() { return new Set(ui.progress().talents); }

  function stateOf(t, own, avail) {
    if (own.has(t.id)) return 'owned';
    const prev = TALENTS.find(x => x.branch === t.branch && x.tier === t.tier - 1);
    if (prev && !own.has(prev.id)) return 'need-prev';
    if (avail < t.cost) return 'need-stars';
    return 'available';
  }

  function render() {
    const p = ui.progress();
    const own = owned();
    const avail = starsAvailable(p);
    availNum.textContent = avail;
    earnedTxt.textContent = `／共 ${starsEarned(p)}`;
    resetBtn.disabled = own.size === 0;
    cols.textContent = '';
    for (const br of TALENT_BRANCHES) {
      const list = h('div', { class: 'tal-list' });
      const items = TALENTS.filter(t => t.branch === br.id).sort((a, b) => a.tier - b.tier);
      let ownedCount = 0;
      for (const t of items) {
        const st = stateOf(t, own, avail);
        if (st === 'owned') ownedCount++;
        list.append(h('button', {
          type: 'button', class: 'tal-node is-' + st, dataset: { id: t.id },
          'aria-label': `${t.name}：${t.desc}（${t.cost} 星）`, onclick: () => onPick(t),
        },
          h('span', { class: 'tal-tier' }, ROMAN[t.tier] || t.tier),
          h('span', { class: 'tal-main' }, h('b', { class: 'tal-name' }, t.name), h('span', { class: 'tal-desc' }, t.desc)),
          h('span', { class: 'tal-cost' }, st === 'owned' ? icon('check') : [icon('star'), h('b', null, String(t.cost))])));
      }
      cols.append(h('div', { class: 'tal-col', style: `--bc:${br.color}` },
        h('div', { class: 'tal-col-head' }, h('b', null, br.name), h('small', null, `${ownedCount}/${items.length}`)), list));
    }
  }

  function onPick(t) {
    const p = ui.progress();
    const own = owned();
    const st = stateOf(t, own, starsAvailable(p));
    if (st === 'owned') { ui.toast(`已經學會「${t.name}」`); return; }
    if (st === 'need-prev') {
      const prev = TALENTS.find(x => x.branch === t.branch && x.tier === t.tier - 1);
      ui.sound('error'); ui.toast(`要先點亮上一層「${prev?.name || ''}」`); return;
    }
    if (st === 'need-stars') { ui.sound('error'); ui.toast(`星星不夠：還差 ${t.cost - starsAvailable(p)} 顆`); return; }
    p.talents.push(t.id);
    saveProgress(p);
    ui.sound('star');
    render();
    const node = cols.querySelector(`[data-id="${t.id}"]`);
    if (node?.animate) node.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.06)', filter: 'brightness(1.25)' }, { transform: 'scale(1)' }], { duration: 380, easing: 'ease-out' });
  }

  function onReset() {
    const p = ui.progress();
    if (!p.talents.length) return;
    if (!armed) {
      armed = setTimeout(() => { armed = 0; resetBtn.classList.remove('is-armed'); resetBtn.lastChild.textContent = '全部重置'; }, 2600);
      resetBtn.classList.add('is-armed');
      resetBtn.lastChild.textContent = '再按一次確認';
      ui.sound('click');
      return;
    }
    clearTimeout(armed); armed = 0;
    resetBtn.classList.remove('is-armed'); resetBtn.lastChild.textContent = '全部重置';
    p.talents.length = 0;
    saveProgress(p);
    ui.sound('click');
    ui.toast('天賦已重置，星星全數退回');
    render();
  }

  return { el, render };
}

// ================= 暫停 =================
export function createPause(ui) {
  const sub = h('div', { class: 'pause-level' }, '');
  const resume = btn('繼續', 'gold', () => { ui.sound('click'); ui.resume(); }, 'play');
  const el = h('section', { class: 'ui-screen scr-pause', 'aria-label': '暫停' },
    h('div', { class: 'pause-card ui-panel' },
      h('h2', null, '暫停'), sub,
      h('div', { class: 'pause-btns' },
        resume,
        btn('重來', 'teal', () => { ui.sound('click'); ui.leaveGame('onRetry'); }, 'retry'),
        btn('回地圖', 'wood', () => { ui.sound('click'); ui.leaveGame('onQuitToMap'); }, 'map'),
        btn('設定', 'wood', () => { ui.sound('click'); ui.openSettings(); }, 'gear'))));
  return { el, setLevel: txt => { sub.textContent = txt; }, focus: () => resume.focus({ preventScroll: true }) };
}

// ================= 結算 =================
export function createResult(ui) {
  const card = h('div', { class: 'res-card ui-panel' });
  const el = h('section', { class: 'ui-screen scr-result', 'aria-label': '結算' }, h('div', { class: 'res-rays' }), card);
  let timers = [];

  function show({ won, stars = 0, lamp = 0, levelId, isLast }, lv) {
    timers.forEach(clearTimeout); timers = [];
    el.classList.toggle('is-won', !!won);
    el.classList.toggle('is-lost', !won);
    const lampMax = lv?.lamp || 20;
    const starEls = [0, 1, 2].map(i => h('div', { class: 'res-star' + (i === 1 ? ' mid' : ''), html: `<svg viewBox="0 0 24 24"><polygon points="${STAR_SVG}"/></svg>` }));
    const primary = won && !isLast
      ? btn('下一關', 'gold', () => { ui.sound('click'); ui.leaveResult('onNextLevel'); }, 'next')
      : btn('重來', won ? 'teal' : 'gold', () => { ui.sound('click'); ui.leaveResult('onRetry'); }, 'retry');
    const btns = [btn('回地圖', 'wood', () => { ui.sound('click'); ui.leaveResult('onQuitToMap'); }, 'map')];
    if (won && !isLast) btns.push(btn('重來', 'teal', () => { ui.sound('click'); ui.leaveResult('onRetry'); }, 'retry'));
    btns.push(primary);
    card.textContent = '';
    card.append(...[
      h('div', { class: 'res-ribbon' }, h('span', null, won ? '勝利！' : '燈熄滅了…')),
      h('div', { class: 'res-sub' }, lv ? `第 ${levelId} 關．${lv.name}` : `第 ${levelId} 關`),
      h('div', { class: 'res-stars' }, starEls),
      h('div', { class: 'res-lamp' }, icon('lamp'), h('span', null, '燈光剩餘'), h('b', null, String(Math.max(0, Math.ceil(lamp)))), h('small', null, `/ ${lampMax}`)),
      won && isLast ? h('div', { class: 'res-final' }, '恭喜！十座小島的燈都守住了') : null,
      !won ? h('div', { class: 'res-tip' }, '試試先升級靠近燈的塔，或提早放技能') : h('div', { class: 'res-rule' }, '★ 過關　★★ 燈光 ≥ 10　★★★ 燈光 ≥ 18'),
      h('div', { class: 'res-btns' }, btns)].filter(Boolean));
    if (won) {
      for (let i = 0; i < Math.min(3, stars); i++) {
        timers.push(setTimeout(() => starEls[i].classList.add('is-lit'), 650 + i * 480));   // 星星音效由 main 的 audio.playStars 負責
      }
    }
    return primary;
  }
  return { el, show, hide: () => { timers.forEach(clearTimeout); timers = []; } };
}

// ================= 設定 =================
export function createSettings(ui) {
  const mk = (key, label, ico) => {
    const out = h('output', { class: 'set-val' }, '0');
    const input = h('input', { type: 'range', min: 0, max: 100, step: 5, value: 50, class: 'ui-range', 'aria-label': label });
    input.addEventListener('input', () => {
      const v = +input.value / 100;
      out.textContent = input.value;
      input.style.setProperty('--v', input.value + '%');
      ui.progress().settings[key] = v;
      ui.call('onSettings', { ...ui.progress().settings });
    });
    input.addEventListener('change', () => saveProgress(ui.progress()));
    const row = h('div', { class: 'set-row' }, h('label', { class: 'set-lbl' }, icon(ico), label), input, out);
    return { row, input, out };
  };
  const music = mk('music', '音樂', 'music');
  const sfx = mk('sfx', '音效', 'sound');
  const qHigh = h('button', { type: 'button', class: 'seg', onclick: () => setQ('high') }, '高');
  const qLow = h('button', { type: 'button', class: 'seg', onclick: () => setQ('low') }, '低');
  const qRow = h('div', { class: 'set-row' }, h('span', { class: 'set-lbl' }, icon('sparkle'), '畫質'),
    h('div', { class: 'ui-seg', role: 'group' }, qHigh, qLow), h('small', { class: 'set-note' }, '低＝較省電'));
  const keys = h('div', { class: 'set-keys only-fine' },
    ...[['空白', '暫停'], ['F', '速度'], ['N', '叫下一波'], ['Z', '流星雨'], ['X', '冰封'], ['1–4', '蓋塔'], ['U', '升級'], ['Del', '賣出'], ['Esc', '取消'], ['WASD', '移動鏡頭'], ['Q / E', '旋轉'], ['滾輪', '縮放']]
      .map(([k, t]) => h('span', null, h('kbd', null, k), t)));
  const done = btn('完成', 'gold', () => { ui.sound('click'); close(); }, 'check');
  const creditsBtn = btn('製作名單', 'wood', () => { ui.sound('click'); showCredits(true); }, 'sparkle');
  const setView = h('div', { class: 'set-view' },
    h('h2', null, '設定'), music.row, sfx.row, qRow, keys, h('div', { class: 'set-btns' }, creditsBtn, done));

  // 製作名單：讀專案根目錄的 CREDITS.txt（CC BY 4.0 素材要標示出處）
  const crText = h('pre', { class: 'cr-text', tabindex: '0' }, '');
  const crView = h('div', { class: 'cr-view', hidden: true },
    h('h2', null, '製作名單'),
    h('p', { class: 'cr-intro' }, '遊戲由 Claude 與子代理團隊以程式製作；3D 模型與部分音效為程式生成。'),
    crText,
    h('div', { class: 'set-btns' }, btn('返回', 'wood', () => { ui.sound('click'); showCredits(false); }, 'back')));
  let creditsLoaded = false, creditsLoading = null;
  function loadCredits() {
    if (creditsLoaded || creditsLoading) return creditsLoading;
    crText.classList.remove('is-error');
    crText.textContent = '讀取中…';
    creditsLoading = fetch(new URL('../../CREDITS.txt', import.meta.url), { cache: 'no-cache' })
      .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
      .then(t => { crText.textContent = t.trim() || '（製作名單是空的）'; creditsLoaded = true; })
      .catch(() => { crText.classList.add('is-error'); crText.textContent = '讀不到製作名單（CREDITS.txt）。請用本機伺服器開啟遊戲，或稍後再試。'; })
      .finally(() => { creditsLoading = null; });
    return creditsLoading;
  }
  function showCredits(on) {
    setView.hidden = !!on;
    crView.hidden = !on;
    card.classList.toggle('is-credits', !!on);
    card.setAttribute('aria-label', on ? '製作名單' : '設定');
    if (on) { loadCredits(); crText.scrollTop = 0; }
  }

  const card = h('div', { class: 'set-card ui-panel', role: 'dialog', 'aria-label': '設定' },
    h('button', { type: 'button', class: 'ui-x', 'aria-label': '關閉', onclick: () => { ui.sound('click'); close(); } }, icon('close')),
    setView, crView);
  const el = h('section', { class: 'ui-modal scr-settings', onclick: e => { if (e.target === el) close(); } }, card);

  function setQ(q) {
    ui.sound('click');
    ui.progress().settings.quality = q;
    paint();
    saveProgress(ui.progress());
    ui.call('onSettings', { ...ui.progress().settings });
  }
  function paint() {
    const s = ui.progress().settings;
    for (const [m, k] of [[music, 'music'], [sfx, 'sfx']]) {
      const v = Math.round((s[k] ?? 0) * 100);
      m.input.value = v; m.out.textContent = v; m.input.style.setProperty('--v', v + '%');
    }
    qHigh.classList.toggle('is-on', s.quality !== 'low');
    qLow.classList.toggle('is-on', s.quality === 'low');
  }
  function open(credits = false) { paint(); showCredits(!!credits); el.classList.add('is-open'); }
  function close() { if (!el.classList.contains('is-open')) return; el.classList.remove('is-open'); saveProgress(ui.progress()); ui.settingsClosed(); }
  // Esc：在製作名單時先回到設定，否則關閉
  function escape() { if (!crView.hidden) showCredits(false); else close(); }
  return { el, open, close, escape, isOpen: () => el.classList.contains('is-open') };
}

// ================= 直向提示 =================
export function createRotate() {
  return h('div', { class: 'ui-rotate', 'aria-live': 'polite' },
    h('div', { class: 'rot-box' }, h('div', { class: 'rot-ico', html: PHONE_SVG }), h('b', null, '請把手機轉成橫向'), h('span', null, '《守燈小島》需要寬一點的畫面')));
}
