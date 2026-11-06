// 輪盤蓋塔選單與塔選單（擁有者：D 介面）
// 選單開著時，畫面上鋪一層透明 scrim：點外面＝關閉選單，而且這次點擊不會穿透到 3D 畫面。

import { h, icon, fmt } from './dom.js';
import { TOWERS, TOWER_ORDER } from '../data/towers.js';

export const REASON_TEXT = {
  'no-gold': '金幣不足',
  'blocks-path': '會擋住路',
  'occupied': '已有東西',
  'not-buildable': '不能蓋',
  'locked': '尚未解鎖',
};

// reason 可以是 A 的代碼（'no-gold'…），也可以是呼叫端先翻好的中文（例如「金幣不夠」）：一律轉回代碼，
// 這樣「尚未解鎖的塔不顯示」與「金幣變多時自動變可蓋」都照常運作；認不得的中文就原樣顯示。
const REASON_ALIASES = [[/解鎖/, 'locked'], [/金幣|錢/, 'no-gold'], [/擋/, 'blocks-path'], [/已經有|已有|佔用/, 'occupied'], [/不能蓋|不可蓋/, 'not-buildable']];
export function normReason(r) {
  if (!r) return undefined;
  if (REASON_TEXT[r]) return r;
  for (const [re, code] of REASON_ALIASES) if (re.test(r)) return code;
  return String(r);
}
const reasonText = r => REASON_TEXT[r] || r || '不能蓋';

const DMG_TEXT = { phys: '物理', magic: '魔法' };

export function createMenus(ui) {
  // ui：{ call(name, ...args), sound(name), toast(text), safe() → {t,r,b,l}, compact() → bool, layerRect() }
  const scrim = h('div', { class: 'menu-scrim' });
  const layer = h('div', { class: 'menus' }, scrim);
  let open = null;          // { kind, el, anchor, data, items }
  let swallow = false, swallowTimer = 0;

  const refreshScrim = () => scrim.classList.toggle('is-on', !!open || swallow);

  scrim.addEventListener('pointerdown', e => {
    e.preventDefault(); e.stopPropagation();
    swallow = true; refreshScrim();
    clearTimeout(swallowTimer);
    swallowTimer = setTimeout(endSwallow, 600);
    if (open) close('outside');
  });
  const endSwallow = () => { clearTimeout(swallowTimer); swallow = false; refreshScrim(); };
  scrim.addEventListener('pointerup', () => { clearTimeout(swallowTimer); swallowTimer = setTimeout(endSwallow, 250); });
  scrim.addEventListener('pointercancel', () => { clearTimeout(swallowTimer); swallowTimer = setTimeout(endSwallow, 250); });
  scrim.addEventListener('click', e => { e.stopPropagation(); endSwallow(); });
  scrim.addEventListener('wheel', e => { e.preventDefault(); if (open) close('outside'); }, { passive: false });
  scrim.addEventListener('contextmenu', e => { e.preventDefault(); if (open) close('outside'); });

  function close(reason = 'api', silent = false) {
    if (!open) return false;
    const o = open;
    open = null;
    clearTimeout(o.sellTimer);
    o.el.classList.remove('is-open');
    o.el.classList.add('is-closing');
    o.anchor?.remove();
    setTimeout(() => o.el.remove(), 180);
    refreshScrim();
    if (!silent && reason !== 'api') ui.call('onMenuClosed', reason);
    return true;
  }

  function viewport() {
    const r = ui.layerRect();
    const s = ui.safe();
    const m = 6;
    // yHud：上方 HUD 列（金幣、燈、波數、叫波）的下緣；選單放得下就不要蓋住它，放不下才退回 y0
    const yHud = s.t + (ui.compact() ? 56 : 66);
    return { w: r.width, h: r.height, x0: s.l + m, y0: s.t + m, yHud, x1: r.width - s.r - m, y1: r.height - s.b - m, ox: r.left, oy: r.top };
  }
  const topLimit = (vp, height) => (height <= vp.y1 - vp.yHud ? vp.yHud : vp.y0);

  function makeAnchor(x, y) {
    const a = h('div', { class: 'menu-anchor' });
    a.style.transform = `translate(${x}px, ${y}px)`;
    layer.append(a);
    return a;
  }

  // ---------------- 輪盤蓋塔選單 ----------------
  function openBuild(sx, sy, data = {}) {
    close('api', true);
    const opts = (data.options || []).filter(Boolean).map(o => ({ ...o, reason: o.ok ? undefined : normReason(o.reason) })).filter(o => o.reason !== 'locked');
    if (!opts.length) { ui.toast('這裡不能蓋塔'); ui.sound('error'); return; }
    const vp = viewport();
    const px = sx - vp.ox, py = sy - vp.oy;
    const compact = ui.compact();
    const B = compact ? 58 : 66;          // 圓鈕直徑
    const LW = compact ? 84 : 96, LH = compact ? 40 : 44;   // 標籤（寬、含上方間距的高；兩行字）
    const n = opts.length;
    const R = compact ? (n >= 3 ? 84 : 76) : (n >= 3 ? 100 : 90);
    // 標籤掛在圓鈕下方：避免有選項正好在中心正上方（標籤會蓋住中間的 ×）
    const ANGLES = { 1: [180], 2: [180, 0], 3: [-150, -30, 90], 4: [-135, -45, 45, 135] };
    const angleOf = i => (ANGLES[n] ? ANGLES[n][i] : -90 + (360 / n) * i);

    const wheel = h('div', { class: 'bm', role: 'menu', 'aria-label': '蓋塔' });
    const centerBtn = h('button', { type: 'button', class: 'bm-center', 'aria-label': '關閉', onclick: () => { ui.sound('click'); close('cancel'); } }, icon('close'));
    wheel.append(h('div', { class: 'bm-ring' }), centerBtn);

    let box = { x0: -26, y0: -26, x1: 26, y1: 26 };
    const items = [];
    opts.forEach((o, i) => {
      const a = (angleOf(i) * Math.PI) / 180;
      const dx = Math.round(Math.cos(a) * R), dy = Math.round(Math.sin(a) * R);
      const def = TOWERS[o.type] || {};
      const keyNo = TOWER_ORDER.indexOf(o.type) + 1 || i + 1;
      const why = h('span', { class: 'bm-why' }, '');
      const btn = h('button', {
        type: 'button', class: 'bm-opt', role: 'menuitem', dataset: { type: o.type },
        style: `--dx:${dx}px; --dy:${dy}px; --d:${i * 30}ms`,
        onclick: () => pickBuild(item),
      },
        h('span', { class: 'bm-disc' }, h('span', { class: 'bm-ico' }, o.icon || def.icon || '🏰'), h('kbd', { class: 'ui-key' }, String(keyNo))),
        h('span', { class: 'bm-label' },
          h('span', { class: 'bm-name' }, o.name || def.name || o.type),
          h('span', { class: 'bm-cost' }, icon('coin'), String(o.cost ?? def.levels?.[0]?.cost ?? '?'))),
        why);
      const item = { o: { ...o }, btn, why, keyNo };
      items.push(item);
      paintBuild(item);
      wheel.append(btn);
      const hw = Math.max(B, LW) / 2;
      box = { x0: Math.min(box.x0, dx - hw), y0: Math.min(box.y0, dy - B / 2 - 4), x1: Math.max(box.x1, dx + hw), y1: Math.max(box.y1, dy + B / 2 + LH + 4) };
    });

    // 不能超出畫面：必要時把輪盤中心往內推，原點用小圈標示
    let cx = px, cy = py;
    if (cx + box.x0 < vp.x0) cx = vp.x0 - box.x0;
    if (cx + box.x1 > vp.x1) cx = vp.x1 - box.x1;
    const yTop = topLimit(vp, box.y1 - box.y0);
    if (cy + box.y0 < yTop) cy = yTop - box.y0;
    if (cy + box.y1 > vp.y1) cy = vp.y1 - box.y1;
    wheel.style.left = cx + 'px';
    wheel.style.top = cy + 'px';
    wheel.style.setProperty('--b', B + 'px');
    wheel.style.setProperty('--lw', LW + 'px');
    layer.append(wheel);
    const anchor = (Math.abs(cx - px) > 4 || Math.abs(cy - py) > 4) ? makeAnchor(px, py) : null;
    open = { kind: 'build', el: wheel, anchor, data, items };
    refreshScrim();
    requestAnimationFrame(() => requestAnimationFrame(() => wheel.classList.add('is-open')));
  }

  function paintBuild(item) {
    const { o, btn, why } = item;
    btn.classList.toggle('is-disabled', !o.ok);
    btn.setAttribute('aria-disabled', o.ok ? 'false' : 'true');
    why.textContent = o.ok ? '' : reasonText(o.reason);
    btn.classList.toggle('no-gold', !o.ok && o.reason === 'no-gold');
  }

  function pickBuild(item) {
    if (!open || open.kind !== 'build') return;
    if (!item.o.ok) {
      ui.sound('error');
      ui.toast(`${item.o.name || TOWERS[item.o.type]?.name || ''}：${reasonText(item.o.reason)}`);
      shake(item.btn);
      return;
    }
    const { c, r } = open.data;
    ui.sound('click');
    close('action');
    ui.call('onBuild', c, r, item.o.type);
  }

  // ---------------- 塔選單 ----------------
  function openTower(sx, sy, data = {}) {
    close('api', true);
    const { tower = {}, stats = {}, upgradeInfo = { kind: 'max' }, sellValue = 0 } = data;
    const def = TOWERS[tower.type] || {};
    const vp = viewport();
    const px = sx - vp.ox, py = sy - vp.oy;
    const level = tower.level || 1;
    const branchDef = tower.branch ? def.branches?.[tower.branch] : null;

    // 標頭
    const pips = h('span', { class: 'tm-pips' });
    for (let i = 1; i <= 3; i++) pips.append(h('i', { class: i <= Math.min(level, 3) ? 'on' : '' }));
    const lvText = branchDef ? h('span', { class: 'tm-branch' }, icon('sparkle'), branchDef.name) : h('span', { class: 'tm-lvtxt' }, `第 ${level} 級`);
    const head = h('div', { class: 'tm-head' },
      h('span', { class: 'tm-ico' }, def.icon || '🏰'),
      h('div', { class: 'tm-title' }, h('b', { class: 'tm-name' }, def.name || stats.name || '塔'), h('div', { class: 'tm-level' }, pips, lvText)),
      h('button', { type: 'button', class: 'tm-close', 'aria-label': '關閉', onclick: () => { ui.sound('click'); close('cancel'); } }, icon('close')));

    // 數值
    const dmgType = stats.dmgType || def.dmgType;
    const air = stats.air ?? def.air;
    const chips = h('div', { class: 'tm-stats' },
      chip('sword', '傷害', fmt(stats.damage), dmgType === 'magic' ? 'is-magic' : ''),
      chip('clock', '攻速', fmt(stats.rate, 2) + '/秒'),
      chip('target', '射程', fmt(stats.range ?? tower.range)),
      h('span', { class: 'tm-tag ' + (dmgType === 'magic' ? 'is-magic' : 'is-phys') }, DMG_TEXT[dmgType] || '物理'),
      h('span', { class: 'tm-tag ' + (air ? 'is-air' : 'is-noair') }, air ? '可對空' : '不對空'),
      tower.kills != null ? h('span', { class: 'tm-tag is-kills' }, `擊殺 ${tower.kills}`) : null);

    const body = h('div', { class: 'tm-body' });
    const actions = {};
    if (upgradeInfo.kind === 'level') {
      const next = upgradeInfo.next || {};
      const diff = h('div', { class: 'tm-diff' });
      const rows = [['damage', '傷害', 1], ['rate', '攻速', 2], ['range', '射程', 1], ['splash', '範圍', 1]];
      for (const [k, label, d] of rows) {
        if (next[k] == null) continue;
        const cur = stats[k] ?? def.levels?.[level - 1]?.[k];
        if (cur != null && Math.abs(cur - next[k]) < 1e-6) continue;
        diff.append(h('span', { class: 'tm-drow' }, h('em', null, label), cur != null ? h('s', null, fmt(cur, d)) : null, icon('next'), h('b', null, fmt(next[k], d))));
      }
      const costEl = h('span', { class: 'tm-cost' }, icon('coin'), String(upgradeInfo.cost ?? '?'));
      const why = h('span', { class: 'tm-why' }, '');
      const btn = h('button', { type: 'button', class: 'ui-btn gold tm-up', onclick: () => doUpgrade() },
        h('span', { class: 'tm-up-txt' }, `升到 ${level + 1} 級`), costEl, h('kbd', { class: 'ui-key' }, 'U'), why);
      actions.up = { btn, why, cost: upgradeInfo.cost, ok: !!upgradeInfo.affordable };
      body.append(diff, btn);
    } else if (upgradeInfo.kind === 'branch') {
      const brs = upgradeInfo.branches || {};
      const wrap = h('div', { class: 'tm-brs' });
      ['a', 'b'].forEach((k, i) => {
        const b = brs[k];
        if (!b) return;
        const bd = def.branches?.[k] || {};
        const facts = [];
        if (bd.damage != null) facts.push(`傷害 ${fmt(bd.damage)}`);
        if (bd.range != null) facts.push(`射程 ${fmt(bd.range)}`);
        const why = h('span', { class: 'tm-why' }, '');
        const card = h('button', { type: 'button', class: 'tm-br', dataset: { branch: k }, onclick: () => doBranch(k) },
          h('span', { class: 'tm-br-top' }, h('b', { class: 'tm-br-name' }, b.name || bd.name || k.toUpperCase()), h('kbd', { class: 'ui-key' }, String(i + 1))),
          h('span', { class: 'tm-br-desc' }, b.desc || bd.desc || ''),
          facts.length ? h('span', { class: 'tm-br-facts' }, facts.join('・')) : null,
          h('span', { class: 'tm-br-cost' }, icon('coin'), String(b.cost ?? bd.cost ?? '?'), why));
        actions[k] = { btn: card, why, cost: b.cost ?? bd.cost, ok: !!b.affordable };
        wrap.append(card);
      });
      body.append(h('div', { class: 'tm-pick' }, '選一條進化路線'), wrap);
    } else {
      body.append(h('div', { class: 'tm-max' }, icon('sparkle'), '已達最高等級'));
    }

    const sellTxt = h('span', { class: 'tm-sell-txt' }, '賣出');
    const sellBtn = h('button', { type: 'button', class: 'ui-btn wood tm-sell', onclick: () => doSell(false) },
      sellTxt, h('span', { class: 'tm-cost' }, '+', icon('coin'), String(sellValue)), h('kbd', { class: 'ui-key' }, 'Del'));
    const foot = h('div', { class: 'tm-foot' }, sellBtn);

    const panel = h('div', { class: 'tm ui-panel' + (upgradeInfo.kind === 'branch' ? ' is-branch' : ''), role: 'dialog', 'aria-label': def.name || '塔' },
      h('i', { class: 'tm-arrow' }), head, chips, body, foot);
    layer.append(panel);

    open = { kind: 'tower', el: panel, data, actions, sellBtn, sellTxt, sellArmed: false, sellTimer: 0 };
    for (const k in actions) paintAction(actions[k]);

    // 位置：優先放在塔的右邊，放不下就左邊；垂直方向夾在畫面內
    const pw = panel.offsetWidth, ph = panel.offsetHeight, gap = 34;
    let side = 'right', left = px + gap;
    if (left + pw > vp.x1) { side = 'left'; left = px - gap - pw; }
    if (left < vp.x0) { // 兩邊都放不下：放在上方或下方
      left = Math.min(Math.max(vp.x0, px - pw / 2), vp.x1 - pw);
      side = py > (vp.y0 + vp.y1) / 2 ? 'top' : 'bottom';
    }
    const yTop = topLimit(vp, ph);
    let top;
    if (side === 'top') top = Math.max(yTop, py - gap - ph);
    else if (side === 'bottom') top = Math.min(vp.y1 - ph, py + gap);
    else top = py - ph / 2;
    top = Math.min(Math.max(yTop, top), Math.max(yTop, vp.y1 - ph));
    panel.style.left = left + 'px';
    panel.style.top = top + 'px';
    panel.classList.add('side-' + side);
    const ay = Math.min(Math.max(py - top, 22), ph - 22);
    const ax = Math.min(Math.max(px - left, 22), pw - 22);
    panel.style.setProperty('--ay', ay + 'px');
    panel.style.setProperty('--ax', ax + 'px');
    open.anchor = makeAnchor(px, py);
    refreshScrim();
    requestAnimationFrame(() => requestAnimationFrame(() => panel.classList.add('is-open')));
  }

  function paintAction(a) {
    a.btn.classList.toggle('is-disabled', !a.ok);
    a.btn.setAttribute('aria-disabled', a.ok ? 'false' : 'true');
    a.why.textContent = a.ok ? '' : '金幣不足';
  }

  function doUpgrade() {
    if (!open || open.kind !== 'tower') return false;
    const a = open.actions.up;
    if (!a) { ui.sound('error'); ui.toast(open.actions.a ? '請選擇一條進化路線（1 或 2）' : '已達最高等級'); return false; }
    if (!a.ok) { ui.sound('error'); ui.toast('金幣不足'); shake(a.btn); return false; }
    const id = open.data.tower?.id;
    ui.sound('click'); close('action');
    ui.call('onUpgrade', id);
    return true;
  }

  function doBranch(k) {
    if (!open || open.kind !== 'tower') return false;
    const a = open.actions[k];
    if (!a) return false;
    if (!a.ok) { ui.sound('error'); ui.toast('金幣不足'); shake(a.btn); return false; }
    const id = open.data.tower?.id;
    ui.sound('click'); close('action');
    ui.call('onUpgrade', id, k);
    return true;
  }

  // 觸控／滑鼠：第一下變成「確定賣出？」，再按一次才賣；鍵盤 Del 直接賣
  function doSell(direct) {
    if (!open || open.kind !== 'tower') return false;
    if (!direct && !open.sellArmed) {
      open.sellArmed = true;
      open.sellBtn.classList.add('is-armed');
      open.sellTxt.textContent = '確定賣出？';
      ui.sound('click');
      const o = open;
      o.sellTimer = setTimeout(() => { if (open === o) { o.sellArmed = false; o.sellBtn.classList.remove('is-armed'); o.sellTxt.textContent = '賣出'; } }, 2600);
      return true;
    }
    const id = open.data.tower?.id;
    ui.sound('click'); close('action');
    ui.call('onSell', id);
    return true;
  }

  // 金幣變化時即時更新「買得起／買不起」
  function updateGold(gold) {
    if (!open || gold == null) return;
    if (open.kind === 'build') {
      for (const it of open.items) {
        const o = it.o;
        if (!(o.ok || o.reason === 'no-gold') || o.cost == null) continue;
        const ok = gold >= o.cost;
        if (ok !== !!o.ok) { o.ok = ok; o.reason = ok ? undefined : 'no-gold'; paintBuild(it); }
      }
    } else {
      for (const k in open.actions) {
        const a = open.actions[k];
        if (a.cost == null) continue;
        const ok = gold >= a.cost;
        if (ok !== a.ok) { a.ok = ok; paintAction(a); }
      }
    }
  }

  // 鍵盤：回傳 true 代表有處理
  function key(code) {
    if (!open) return false;
    const digit = /^(Digit|Numpad)([1-9])$/.exec(code);
    if (open.kind === 'build') {
      if (digit) {
        const n = +digit[2];
        const it = open.items.find(x => x.keyNo === n);
        if (it) pickBuild(it); else { ui.sound('error'); }
        return true;
      }
      return false;
    }
    if (code === 'KeyU') { doUpgrade(); return true; }
    if (digit && (digit[2] === '1' || digit[2] === '2')) {
      const k = digit[2] === '1' ? 'a' : 'b';
      if (open.actions[k]) doBranch(k); else if (digit[2] === '1' && open.actions.up) doUpgrade();
      return true;
    }
    if (code === 'Delete' || code === 'Backspace') { doSell(true); return true; }
    return false;
  }

  return {
    el: layer,
    openBuild, openTower,
    close: (reason = 'api') => close(reason),
    isOpen: () => !!open,
    kind: () => open?.kind || null,
    updateGold, key,
  };
}

function chip(ico, label, value, cls = '') {
  return h('span', { class: 'tm-chip ' + cls, title: label }, icon(ico), h('em', null, label), h('b', null, value));
}

function shake(el) {
  if (el.animate) el.animate([{ translate: '0 0' }, { translate: '-5px 0' }, { translate: '5px 0' }, { translate: '-3px 0' }, { translate: '0 0' }], { duration: 300, easing: 'ease-out' });
}
