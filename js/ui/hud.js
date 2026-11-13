// 遊戲中 HUD（擁有者：D 介面）
// update(state) 每幀呼叫：只有數值改變時才碰 DOM（不重建、不 new 元素）。

import { h, icon, ICON, heroIcon } from './dom.js';
import { SKILLS, SKILL_ORDER, HEROES, HERO_SKILLS } from '../data/heroes.js';

const HP_C = 2 * Math.PI * 28;     // 英雄血量圈周長（viewBox 64，r=28）
const WAVE_C = 2 * Math.PI * 16;   // 叫波倒數圈周長（viewBox 40，r=16）
const HS_C = 2 * Math.PI * 27;     // 英雄技能冷卻環周長（viewBox 60，r=27）
const SKILL_KEYS = { meteor: 'Z', freeze: 'X' };
export const HERO_SKILL_KEYS = ['C', 'V'];

export function createHUD(act) {
  // act：ui.js 提供的動作 { pauseToggle, speedToggle, callWave, skill(id), heroSkill(id), hero() }
  const prev = Object.create(null);
  const changed = (k, v) => (prev[k] === v ? false : ((prev[k] = v), true));

  // ---- 上方：資源 ----
  const goldNum = h('b', { class: 'hud-num' }, '0');
  const gold = h('div', { class: 'hud-pill hud-gold', title: '金幣' }, icon('coin'), goldNum);

  const lampNum = h('b', { class: 'hud-num' }, '20');
  const lampMax = h('small', { class: 'hud-max' }, '/20');
  const lampBar = h('div', { class: 'hud-lampbar' });
  const lamp = h('div', { class: 'hud-pill hud-lamp', title: '守護燈的光' },
    icon('lamp'), h('div', { class: 'hud-lampcol' }, h('div', { class: 'hud-lamprow' }, lampNum, lampMax), lampBar));
  let segs = [];

  const waveNum = h('b', { class: 'hud-num' }, '0');
  const waveMax = h('small', { class: 'hud-max' }, '/0');
  const wave = h('div', { class: 'hud-pill hud-wave', title: '波數' }, icon('wave'), h('span', { class: 'hud-lbl' }, '波'), waveNum, waveMax);

  // ---- 上方中間：叫波 ----
  const ringArc = svgEl('circle', { cx: 20, cy: 20, r: 16, class: 'hc-arc', 'stroke-dasharray': WAVE_C.toFixed(2), 'stroke-dashoffset': '0' });
  const ring = svgEl('svg', { viewBox: '0 0 40 40', class: 'hc-svg' }, [svgEl('circle', { cx: 20, cy: 20, r: 16, class: 'hc-track' }), ringArc]);
  const ringNum = h('b', { class: 'hc-num' }, '');
  const callMain = h('span', { class: 'hc-main' }, '開始第 1 波');
  const callSub = h('span', { class: 'hc-sub' }, '');
  const call = h('button', { type: 'button', class: 'hud-call is-hidden', onclick: () => act.callWave() },
    h('span', { class: 'hc-ring' }, ring, ringNum),
    h('span', { class: 'hc-play' }, icon('play')),
    h('span', { class: 'hc-text' }, callMain, callSub),
    h('kbd', { class: 'ui-key' }, 'N'));
  let waveTotal = 1;

  // ---- 上方右：速度、暫停 ----
  const speedTxt = h('b', null, '1×');
  const speed = h('button', { type: 'button', class: 'hud-btn hud-speed', 'aria-label': '切換速度', onclick: () => act.speedToggle() },
    icon('ff'), speedTxt, h('kbd', { class: 'ui-key' }, 'F'));
  const pause = h('button', { type: 'button', class: 'hud-btn hud-pause', 'aria-label': '暫停', onclick: () => act.pauseToggle() },
    icon('pause'), h('kbd', { class: 'ui-key' }, '空白'));

  const top = h('div', { class: 'hud-top' },
    h('div', { class: 'hud-res' }, gold, lamp, wave),
    h('div', { class: 'hud-mid' }, call),
    h('div', { class: 'hud-ctrl' }, speed, pause));

  // ---- 左下：英雄（頭像依 state.hero.type）＋兩顆英雄技能 ----
  const hpArc = svgEl('circle', { cx: 32, cy: 32, r: 28, class: 'hero-arc', 'stroke-dasharray': HP_C.toFixed(2), 'stroke-dashoffset': '0' });
  const heroRing = svgEl('svg', { viewBox: '0 0 64 64', class: 'hero-ring' }, [svgEl('circle', { cx: 32, cy: 32, r: 28, class: 'hero-track' }), hpArc]);
  const heroLv = h('b', { class: 'hero-lv' }, '1');
  const heroDead = h('span', { class: 'hero-dead' }, '');
  const heroHp = h('span', { class: 'hero-hp' }, '');
  const heroXp = h('i');
  const heroFace = h('span', { class: 'ui-ico hero-face', 'aria-hidden': 'true' });
  const heroName = h('b', { class: 'hero-name' }, '');
  const heroBtn = h('button', { type: 'button', class: 'hero-btn', onclick: () => act.hero() },
    heroRing, heroFace, heroLv, heroDead);
  const hsBox = h('div', { class: 'hero-skills' });
  const hero = h('div', { class: 'hud-hero' }, heroBtn, hsBox,
    h('div', { class: 'hero-info' }, heroName, heroHp, h('span', { class: 'hero-xp' }, heroXp)));
  let heroType = null;
  let hsEls = {};          // skillId → { btn, num, arc, order }
  let hsOrder = [];

  function setHeroType(type) {
    const def = HEROES[type] || HEROES.knight || { name: '守燈騎士', skills: [] };
    heroType = HEROES[type] ? type : 'knight';
    heroFace.innerHTML = ICON[heroIcon(heroType)];
    heroName.textContent = def.name;
    heroBtn.setAttribute('aria-label', def.name);
    hero.dataset.hero = heroType;
    hsBox.textContent = '';
    hsEls = {}; hsOrder = [];
    (def.skills || []).forEach((id, i) => {
      const sd = HERO_SKILLS[id];
      if (!sd) return;
      const arc = svgEl('circle', { cx: 30, cy: 30, r: 27, class: 'hs-arc', 'stroke-dasharray': HS_C.toFixed(2), 'stroke-dashoffset': '0' });
      const ring = svgEl('svg', { viewBox: '0 0 60 60', class: 'hs-ring' }, [svgEl('circle', { cx: 30, cy: 30, r: 27, class: 'hs-track' }), arc]);
      const num = h('b', { class: 'hs-num' }, '');
      const btn = h('button', {
        type: 'button', class: 'hskill is-hidden', dataset: { skill: id }, 'aria-label': sd.name, title: `${sd.name}：${sd.desc || ''}`,
        onclick: () => act.heroSkill(id),
      },
        h('span', { class: 'hs-ico' }, sd.icon || '✦'), ring, num,
        h('span', { class: 'hs-lock' }, icon('lock'), h('small', null, `Lv${sd.minLevel || 1}`)),
        h('kbd', { class: 'ui-key' }, HERO_SKILL_KEYS[i] || ''),
        h('span', { class: 'sk-name hs-name' }, sd.name));
      hsEls[id] = { btn, num, arc, order: i };
      hsOrder.push(id);
      hsBox.append(btn);
    });
    for (const k in prev) if (k.startsWith('hs')) delete prev[k];
  }
  setHeroType('knight');

  // ---- 右下：技能 ----
  const skillEls = {};
  const skillsBox = h('div', { class: 'hud-skills' });
  for (const id of SKILL_ORDER) {
    const def = SKILLS[id];
    const num = h('b', { class: 'sk-num' }, '');
    const btn = h('button', { type: 'button', class: 'skill is-hidden', dataset: { skill: id }, 'aria-label': def.name, onclick: () => act.skill(id) },
      h('span', { class: 'sk-ico' }, def.icon || '✦'),
      h('span', { class: 'sk-cd' }), num,
      h('kbd', { class: 'ui-key' }, SKILL_KEYS[id] || ''),
      h('span', { class: 'sk-name' }, def.name));
    skillEls[id] = { btn, num };
    skillsBox.append(btn);
  }

  const el = h('div', { class: 'hud' }, top, hero, skillsBox);

  function buildSegments(max) {
    lampBar.textContent = '';
    segs = [];
    const n = Math.max(1, Math.min(40, max | 0));
    for (let i = 0; i < n; i++) { const s = h('i'); segs.push(s); lampBar.append(s); }
    lampBar.style.setProperty('--n', n);
  }

  function reset(levelDef) {
    for (const k in prev) delete prev[k];
    const max = levelDef?.lamp || 20;
    buildSegments(max);
    lampMax.textContent = '/' + max;
    prev.lampMax = max;
    setSpeed(1);
    setTargeting(null);
    setHeroSelected(false);
    waveTotal = 1;
  }

  function setSpeed(n) {
    speedTxt.textContent = n === 2 ? '2×' : '1×';
    speed.classList.toggle('is-on', n === 2);
  }
  function setPaused(p) { pause.classList.toggle('is-on', !!p); }
  function setTargeting(id) {
    for (const k in skillEls) skillEls[k].btn.classList.toggle('is-targeting', k === id);
    for (const k in hsEls) hsEls[k].btn.classList.toggle('is-targeting', k === id);
  }
  function setHeroSelected(on) { heroBtn.classList.toggle('is-selected', !!on); }

  function update(s) {
    if (!s) return;
    // 金幣
    const g = Math.floor(s.gold ?? 0);
    if (prev.gold !== g) {
      const up = prev.gold != null && g > prev.gold;
      const down = prev.gold != null && g < prev.gold;
      prev.gold = g;
      goldNum.textContent = g;
      if (up || down) bump(gold, up ? 'is-up' : 'is-down');
    }
    // 燈光
    const lm = s.lampMax ?? prev.lampMax ?? 20;
    if (changed('lampMax', lm)) { buildSegments(lm); lampMax.textContent = '/' + lm; prev.lamp = undefined; }
    const l = Math.max(0, Math.ceil(s.lamp ?? lm));
    if (prev.lamp !== l) {
      const hurt = prev.lamp != null && l < prev.lamp;
      prev.lamp = l;
      lampNum.textContent = l;
      const lit = Math.round((l / lm) * segs.length);
      for (let i = 0; i < segs.length; i++) segs[i].className = i < lit ? 'on' : '';
      const frac = l / lm;
      lamp.classList.toggle('is-low', frac <= 0.25);
      lamp.classList.toggle('is-mid', frac > 0.25 && frac < 0.5);
      if (hurt) bump(lamp, 'is-hurt');
    }
    // 波數
    const wc = s.waveCount ?? 0, wi = s.waveIndex ?? 0;
    if (changed('wave', wi + '/' + wc)) { waveNum.textContent = wi; waveMax.textContent = '/' + wc; }

    // 叫波按鈕
    let mode = 'hide';
    if (s.phase === 'prep') mode = 'start';
    else if (s.phase === 'running' && s.nextWaveIn != null && wi < wc) mode = 'early';
    if (changed('callMode', mode)) {
      call.classList.toggle('is-hidden', mode === 'hide');
      call.classList.toggle('is-start', mode === 'start');
      call.classList.toggle('is-early', mode === 'early');
      if (mode === 'start') { callMain.textContent = wi > 0 ? `開始第 ${wi + 1} 波` : '開始第 1 波'; callSub.textContent = ''; }
      if (mode === 'early') { callMain.textContent = '提早叫波'; prev.callSub = undefined; waveTotal = Math.max(1, s.nextWaveIn); }
    }
    if (mode === 'early') {
      const t = Math.max(0, s.nextWaveIn);
      if (t > waveTotal + 0.5) waveTotal = t;      // 新的一輪倒數
      const sec = Math.ceil(t);
      if (changed('callSec', sec)) ringNum.textContent = sec;
      const off = (WAVE_C * (1 - Math.min(1, t / waveTotal))).toFixed(1);
      if (changed('callOff', off)) ringArc.setAttribute('stroke-dashoffset', off);
      const bonus = Math.floor(s.earlyBonus ?? 0);
      const sub = bonus > 0 ? `+${bonus} 金` : '下一波';
      if (changed('callSub', sub)) { callSub.textContent = sub; call.classList.toggle('has-bonus', bonus > 0); }
    }

    // 技能
    const sk = s.skills || {};
    for (const id in skillEls) {
      const st = sk[id];
      const e = skillEls[id];
      const unlocked = !!st?.unlocked;
      if (changed('skU_' + id, unlocked)) e.btn.classList.toggle('is-hidden', !unlocked);
      if (!unlocked) continue;
      const cd = Math.max(0, st.cd || 0);
      const ready = cd <= 0;
      if (changed('skR_' + id, ready)) { e.btn.classList.toggle('is-ready', ready); if (ready) { e.num.textContent = ''; prev['skS_' + id] = undefined; } }
      if (!ready) {
        const p = Math.min(1, cd / Math.max(0.001, st.cdMax || cd)).toFixed(3);
        if (changed('skP_' + id, p)) e.btn.style.setProperty('--p', p);
        const sec = Math.ceil(cd);
        if (changed('skS_' + id, sec)) e.num.textContent = sec;
      } else if (changed('skP_' + id, '0')) e.btn.style.setProperty('--p', 0);
    }

    // 英雄
    const hr = s.hero;
    if (hr) {
      const type = hr.type || 'knight';
      if (type !== heroType) setHeroType(type);
      const dead = hr.state === 'dead';
      if (changed('hDead', dead)) { heroBtn.classList.toggle('is-dead', dead); hero.classList.toggle('is-dead', dead); }
      const frac = dead ? 0 : Math.max(0, Math.min(1, (hr.hp ?? 0) / (hr.maxHp || 1)));
      const off = (HP_C * (1 - frac)).toFixed(1);
      if (changed('hOff', off)) {
        hpArc.setAttribute('stroke-dashoffset', off);
        const band = frac > 0.5 ? 'ok' : frac > 0.25 ? 'mid' : 'low';
        if (changed('hBand', band)) heroBtn.dataset.hp = band;
      }
      const hpTxt = dead ? '倒下了' : `${Math.ceil(hr.hp ?? 0)} / ${Math.ceil(hr.maxHp ?? 0)}`;
      if (changed('hHp', hpTxt)) heroHp.textContent = hpTxt;
      if (changed('hLv', hr.level ?? 1)) heroLv.textContent = hr.level ?? 1;
      const rs = dead ? Math.ceil(hr.respawnIn ?? 0) : 0;
      if (changed('hRs', rs)) heroDead.textContent = dead ? String(Math.max(0, rs)) : '';
      const xpF = hr.xpNext ? Math.max(0, Math.min(1, (hr.xp ?? 0) / hr.xpNext)) : 1;
      const xpW = (xpF * 100).toFixed(0) + '%';
      if (changed('hXp', xpW)) heroXp.style.width = xpW;

      // 英雄技能：hero.skills = { [id]: { cd, cdMax, unlocked /*等級夠*/, ready } }（sim 還沒給就不顯示）
      const hs = hr.skills;
      for (const id in hsEls) {
        const st = hs && hs[id];
        const e = hsEls[id];
        if (changed('hsH_' + id, !!st)) e.btn.classList.toggle('is-hidden', !st);
        if (!st) continue;
        const unlocked = !!st.unlocked;
        if (changed('hsU_' + id, unlocked)) e.btn.classList.toggle('is-locked', !unlocked);
        const cd = Math.max(0, st.cd || 0);
        const cooling = unlocked && cd > 0;
        const ready = unlocked && !cooling && !dead && st.ready !== false;
        if (changed('hsR_' + id, ready)) e.btn.classList.toggle('is-ready', ready);
        if (changed('hsC_' + id, cooling)) e.btn.classList.toggle('is-cooling', cooling);
        const frac = cooling ? Math.min(1, cd / Math.max(0.001, st.cdMax || cd)) : 0;
        const off = (HS_C * frac).toFixed(1);
        if (changed('hsO_' + id, off)) e.arc.setAttribute('stroke-dashoffset', off);
        const sec = cooling ? String(Math.ceil(cd)) : '';
        if (changed('hsS_' + id, sec)) e.num.textContent = sec;
      }
    }
  }

  return {
    el, update, reset, setSpeed, setPaused, setTargeting, setHeroSelected,
    skillButton: id => skillEls[id]?.btn, callButton: call,
    heroSkillButton: id => hsEls[id]?.btn,
    heroSkillIds: () => hsOrder.slice(),
    get heroType() { return heroType; },
  };
}

// 數值變化時的小動畫（Web Animations，不觸發版面重算）
const BUMPS = {
  'is-up': [{ transform: 'scale(1)' }, { transform: 'scale(1.1)', filter: 'brightness(1.35)' }, { transform: 'scale(1)' }],
  'is-down': [{ transform: 'translateY(0)' }, { transform: 'translateY(2px)', filter: 'saturate(.6)' }, { transform: 'translateY(0)' }],
  'is-hurt': [{ transform: 'translateX(0)' }, { transform: 'translateX(-4px)', filter: 'drop-shadow(0 0 8px rgba(255,70,50,.9))' },
    { transform: 'translateX(4px)' }, { transform: 'translateX(-2px)' }, { transform: 'translateX(0)' }],
};
function bump(el, kind) {
  if (el.animate) el.animate(BUMPS[kind], { duration: kind === 'is-hurt' ? 420 : 300, easing: 'ease-out' });
}

const SVGNS = 'http://www.w3.org/2000/svg';
function svgEl(tag, attrs, kids) {
  const el = document.createElementNS(SVGNS, tag);
  for (const k in attrs) el.setAttribute(k, attrs[k]);
  if (kids) for (const c of kids) el.append(c);
  return el;
}
