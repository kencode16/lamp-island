// DOM 小工具與內嵌 SVG 圖示（擁有者：D 介面）

/** h('div', { class, text, html, style, onclick, dataset, ...attrs }, ...children) */
export function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  if (props) {
    for (const k in props) {
      const v = props[k];
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'style') { if (typeof v === 'string') el.style.cssText = v; else Object.assign(el.style, v); }
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    }
  }
  for (const c of kids.flat()) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

/** 內嵌 SVG 圖示的 span */
export function icon(name, cls = '') {
  return h('span', { class: `ui-ico ${cls}`.trim(), 'aria-hidden': 'true', html: ICON[name] || '' });
}

/** 數字格式：整數或一位小數 */
export function fmt(n, digits = 1) {
  if (n == null || !isFinite(n)) return '–';
  const r = Math.round(n * 10 ** digits) / 10 ** digits;
  return Number.isInteger(r) ? String(r) : r.toFixed(digits);
}

// ---------- SVG 圖示（全部用 currentColor 或共用漸層 #ui-g-*） ----------
function starPoints(cx, cy, R, r, n = 5) {
  const pts = [];
  for (let i = 0; i < n * 2; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / n;
    const rr = i % 2 ? r : R;
    pts.push(`${(cx + Math.cos(a) * rr).toFixed(2)},${(cy + Math.sin(a) * rr).toFixed(2)}`);
  }
  return pts.join(' ');
}

function gearPath(cx, cy, R, r, teeth = 8) {
  let d = '';
  const step = (Math.PI * 2) / teeth;
  for (let i = 0; i < teeth; i++) {
    const a0 = i * step - step * 0.25, a1 = i * step - step * 0.12, a2 = i * step + step * 0.12, a3 = i * step + step * 0.25;
    const p = (a, rad) => `${(cx + Math.cos(a) * rad).toFixed(2)} ${(cy + Math.sin(a) * rad).toFixed(2)}`;
    d += `${i ? 'L' : 'M'}${p(a0, r)} L${p(a1, R)} L${p(a2, R)} L${p(a3, r)} `;
    const a4 = (i + 1) * step - step * 0.25;
    d += `A${r} ${r} 0 0 1 ${p(a4, r)} `;
  }
  return d + 'Z';
}

export const STAR_POINTS = starPoints(12, 12.6, 11, 4.6);

export const ICON = {
  pause: '<svg viewBox="0 0 24 24"><rect x="5.5" y="4" width="4.6" height="16" rx="1.6" fill="currentColor"/><rect x="13.9" y="4" width="4.6" height="16" rx="1.6" fill="currentColor"/></svg>',
  play: '<svg viewBox="0 0 24 24"><path d="M7 4.6v14.8c0 .9 1 1.5 1.8 1l11.6-7.4c.7-.5.7-1.5 0-2L8.8 3.6C8 3.1 7 3.7 7 4.6z" fill="currentColor"/></svg>',
  ff: '<svg viewBox="0 0 24 24"><path d="M2.5 6.2v11.6c0 .8.9 1.3 1.6.8l8-5.8c.6-.4.6-1.2 0-1.6l-8-5.8c-.7-.5-1.6 0-1.6.8zM12 6.2v11.6c0 .8.9 1.3 1.6.8l8-5.8c.6-.4.6-1.2 0-1.6l-8-5.8c-.7-.5-1.6 0-1.6.8z" fill="currentColor"/></svg>',
  close: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" fill="none"/></svg>',
  back: '<svg viewBox="0 0 24 24"><path d="M15 4.5L7.5 12l7.5 7.5" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>',
  next: '<svg viewBox="0 0 24 24"><path d="M9 4.5l7.5 7.5L9 19.5" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>',
  retry: '<svg viewBox="0 0 24 24"><path d="M19 12a7 7 0 1 1-2.1-5" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" fill="none"/><path d="M18.8 2.8v5h-5" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>',
  map: '<svg viewBox="0 0 24 24"><path d="M3 6.2l5.5-2.2 7 2.4L21 4.2v13.6l-5.5 2.2-7-2.4L3 19.8z" stroke="currentColor" stroke-width="2" stroke-linejoin="round" fill="none"/><path d="M8.5 4v13.6M15.5 6.4V20" stroke="currentColor" stroke-width="2" fill="none"/></svg>',
  gear: `<svg viewBox="0 0 24 24"><path d="${gearPath(12, 12, 10.6, 7.6, 8)}" fill="currentColor"/><circle cx="12" cy="12" r="3.3" fill="var(--ico-hole, #2a1b0e)"/></svg>`,
  star: `<svg viewBox="0 0 24 24"><polygon points="${STAR_POINTS}" fill="currentColor" stroke="rgba(90,55,10,.55)" stroke-width="1" stroke-linejoin="round"/></svg>`,
  lock: '<svg viewBox="0 0 24 24"><path d="M7.5 10.5V8a4.5 4.5 0 0 1 9 0v2.5" stroke="currentColor" stroke-width="2.6" fill="none"/><rect x="4.5" y="10" width="15" height="11" rx="2.6" fill="currentColor"/><circle cx="12" cy="15.2" r="1.7" fill="var(--ico-hole, #2a1b0e)"/></svg>',
  check: '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>',
  coin: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#c98f22"/><circle cx="12" cy="11.2" r="9.2" fill="#f6c94a"/><circle cx="12" cy="11.2" r="6.4" fill="none" stroke="#c98f22" stroke-width="1.5"/><path d="M12 7.6l1.1 2.4 2.5.3-1.9 1.7.5 2.5-2.2-1.3-2.2 1.3.5-2.5-1.9-1.7 2.5-.3z" fill="#c98f22"/><path d="M6.4 8.4a6.5 6.5 0 0 1 3.4-3.2" stroke="#fff6cf" stroke-width="1.4" stroke-linecap="round" fill="none"/></svg>',
  lamp: '<svg viewBox="0 0 24 24"><circle cx="12" cy="3.6" r="2" fill="none" stroke="#e8c26a" stroke-width="1.5"/><path d="M7.5 7.2h9l-1.2-1.8H8.7z" fill="#e8c26a"/><rect x="7.6" y="7.2" width="8.8" height="10.2" rx="1.6" fill="#ffd36a"/><rect x="9" y="8.4" width="6" height="7.8" rx="1.2" fill="#fff0b8"/><path d="M12 9.4c1.3 1.6 1.8 2.6 1.8 3.5a1.8 1.8 0 0 1-3.6 0c0-.9.5-1.9 1.8-3.5z" fill="#ff8a2a"/><path d="M6.6 17.4h10.8l-1.3 2.4H7.9z" fill="#e8c26a"/></svg>',
  wave: '<svg viewBox="0 0 24 24"><path d="M2 9.5c2.5 0 2.5-2.2 5-2.2s2.5 2.2 5 2.2 2.5-2.2 5-2.2 2.5 2.2 5 2.2M2 15.5c2.5 0 2.5-2.2 5-2.2s2.5 2.2 5 2.2 2.5-2.2 5-2.2 2.5 2.2 5 2.2" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" fill="none"/></svg>',
  tree: '<svg viewBox="0 0 24 24"><circle cx="12" cy="9" r="6.2" fill="currentColor"/><circle cx="7.2" cy="12.2" r="3.6" fill="currentColor"/><circle cx="16.8" cy="12.2" r="3.6" fill="currentColor"/><rect x="10.6" y="13" width="2.8" height="8.5" rx="1" fill="currentColor"/></svg>',
  sword: '<svg viewBox="0 0 24 24"><path d="M14.5 3.5H20.5V9.5L10.5 19.5L4.5 13.5Z" fill="currentColor" opacity=".9"/><path d="M3.5 16.5l4 4M2.5 21.5l2-2" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
  clock: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5" stroke="currentColor" stroke-width="2.4" fill="none"/><path d="M12 7.5V12l3 2" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" fill="none"/></svg>',
  target: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5" stroke="currentColor" stroke-width="2.2" fill="none"/><circle cx="12" cy="12" r="4" stroke="currentColor" stroke-width="2.2" fill="none"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/></svg>',
  sound: '<svg viewBox="0 0 24 24"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" fill="none"/></svg>',
  music: '<svg viewBox="0 0 24 24"><path d="M9 17.5V5.5l11-2v12" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round" fill="none"/><ellipse cx="6.5" cy="17.8" rx="3" ry="2.4" fill="currentColor"/><ellipse cx="17.5" cy="15.8" rx="3" ry="2.4" fill="currentColor"/></svg>',
  sparkle: '<svg viewBox="0 0 24 24"><path d="M12 2.5l2.2 6.9 7.3.1-5.9 4.3 2.2 7-5.8-4.3-5.8 4.3 2.2-7L2.5 9.5l7.3-.1z" fill="currentColor"/></svg>',
  ship: '<svg viewBox="0 0 24 24"><path d="M12 2.5v13" stroke="#5a371d" stroke-width="1.6"/><path d="M12.8 3.5c3.5 2.5 5.2 6.2 5.2 10.5h-5.2z" fill="#fff6df" stroke="#5a371d" stroke-width="1"/><path d="M11.2 5.5c-2.6 2.2-4 5-4.2 8.5h4.2z" fill="#f1e2bd" stroke="#5a371d" stroke-width="1"/><path d="M3.5 16h17l-2.6 4.2H6.1z" fill="#8a5630" stroke="#3d2412" stroke-width="1"/><path d="M12 2.5l3.4 1.2L12 5" fill="#c4473a"/></svg>',
  // 守燈騎士頭像：頭盔＋紅羽
  knight: `<svg viewBox="0 0 64 64"><path d="M33 20c-1-8 6-14 15-12-6 2-9 6-10 13z" fill="#c4473a"/><path d="M33 20c0-5 3-9 8-10-3 2-5 5-5 10z" fill="#e2685a"/>
    <path d="M15 42c0-15 7.5-23 17-23s17 8 17 23v8c0 4-3.5 7-7.5 7h-19C18.5 57 15 54 15 50z" fill="url(#ui-g-silver)" stroke="#3b3f4a" stroke-width="2"/>
    <path d="M32 19.5V57" stroke="#7c8494" stroke-width="2"/>
    <rect x="19" y="36" width="26" height="5.5" rx="2.5" fill="#1d2330"/>
    <path d="M24 46h16M26 50.5h12" stroke="#5b6271" stroke-width="2" stroke-linecap="round"/>
    <path d="M21 29c2-4 5-6 8-6.6" stroke="#fff" stroke-opacity=".7" stroke-width="2.4" stroke-linecap="round" fill="none"/></svg>`,
  // 森林妖精頭像：葉子頭髮、尖耳、發光翅膀
  fairy: `<svg viewBox="0 0 64 64">
    <path d="M28 35C19 19 6 17 6.5 28.5c.4 7.5 10 11 21.5 8.5z" fill="#c9f6ff" fill-opacity=".82" stroke="#62c6dc" stroke-width="1.6"/>
    <path d="M36 35C45 19 58 17 57.5 28.5c-.4 7.5-10 11-21.5 8.5z" fill="#c9f6ff" fill-opacity=".82" stroke="#62c6dc" stroke-width="1.6"/>
    <path d="M12 26c3-3 8-3 12 2M52 26c-3-3-8-3-12 2" stroke="#fff" stroke-opacity=".8" stroke-width="1.6" stroke-linecap="round" fill="none"/>
    <path d="M20.5 38.5l-8.5-5 9.5 .2z" fill="#ffdcbc" stroke="#a8673d" stroke-width="1.4" stroke-linejoin="round"/>
    <path d="M43.5 38.5l8.5-5-9.5 .2z" fill="#ffdcbc" stroke="#a8673d" stroke-width="1.4" stroke-linejoin="round"/>
    <circle cx="32" cy="41" r="12.5" fill="#ffe3c8" stroke="#a8673d" stroke-width="1.8"/>
    <path d="M19 41c-1.5-11 5.5-19 13-19s14.5 8 13 19c-2.5-5-6-7.5-9.5-7.8L32 37l-3.5-3.8C25 33.5 21.5 36 19 41z" fill="#5cc46a" stroke="#2c7a38" stroke-width="1.8" stroke-linejoin="round"/>
    <path d="M32 22.5c1-6.5 6.5-10 12-9-2 5-6.5 8.5-12 9z" fill="#9be37f" stroke="#2c7a38" stroke-width="1.5" stroke-linejoin="round"/>
    <ellipse cx="27.3" cy="42.6" rx="1.9" ry="2.5" fill="#24394a"/><ellipse cx="36.7" cy="42.6" rx="1.9" ry="2.5" fill="#24394a"/>
    <circle cx="27.9" cy="41.8" r=".75" fill="#fff"/><circle cx="37.3" cy="41.8" r=".75" fill="#fff"/>
    <circle cx="24" cy="46.5" r="2.2" fill="#ff8fa6" opacity=".45"/><circle cx="40" cy="46.5" r="2.2" fill="#ff8fa6" opacity=".45"/>
    <path d="M29.5 47.5c1.6 1.4 3.4 1.4 5 0" stroke="#a8673d" stroke-width="1.5" fill="none" stroke-linecap="round"/>
    <path d="M51 8.5l1.3 3.2 3.2 1.3-3.2 1.3-1.3 3.2-1.3-3.2-3.2-1.3 3.2-1.3z" fill="#fff4a8"/>
    <path d="M11 49l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9z" fill="#fff4a8"/></svg>`,
  // 星詠法師頭像：星星尖帽、白鬍子
  mage: `<svg viewBox="0 0 64 64">
    <circle cx="32" cy="38" r="11.5" fill="#ffe3c8" stroke="#8a5a3a" stroke-width="1.8"/>
    <path d="M20.5 38.5c0 10.5 5.5 18 11.5 21.5 6-3.5 11.5-11 11.5-21.5-3 3.2-6.8 4.6-11.5 4.6s-8.5-1.4-11.5-4.6z" fill="#f4f2ff" stroke="#9893ba" stroke-width="1.6" stroke-linejoin="round"/>
    <path d="M25.5 43.5c2.5-2.2 4.5-2.4 6.5-.6 2-1.8 4-1.6 6.5.6" stroke="#bdb8da" stroke-width="2.4" fill="none" stroke-linecap="round"/>
    <path d="M26 37.5c1-1 2.6-1 3.6 0M34.4 37.5c1-1 2.6-1 3.6 0" stroke="#3a2a22" stroke-width="1.8" fill="none" stroke-linecap="round"/>
    <path d="M14 31.5C20.5 22 25 12 32.5 4.5c1.8 4 1.5 7 5 8.8 3 1.5 6.5.8 9 3-4.2-.2-6.6 1.2-6.4 4.4L45 31z" fill="#4c3aa6" stroke="#22185a" stroke-width="2" stroke-linejoin="round"/>
    <path d="M23 24.5c5 1.6 11 1.6 17.5-.2l1.2 3.4c-6.8 2-13.6 2-20.2.2z" fill="#f1c75c" stroke="#8a6118" stroke-width="1"/>
    <ellipse cx="31" cy="31.6" rx="19.5" ry="4.6" fill="#5c49c0" stroke="#22185a" stroke-width="2"/>
    <path d="M30 13.2l1 2.4 2.5.2-1.9 1.7.6 2.5-2.2-1.4-2.2 1.4.6-2.5-1.9-1.7 2.5-.2z" fill="#ffe27a"/>
    <circle cx="36.5" cy="20" r="1.1" fill="#fff4b8"/><circle cx="24.5" cy="21.5" r=".9" fill="#fff4b8"/>
    <path d="M51 41l1.2 2.8 2.8 1.2-2.8 1.2-1.2 2.8-1.2-2.8-2.8-1.2 2.8-1.2z" fill="#bfe6ff"/></svg>`,
  // 第二章：洞窟入口與燈籠
  cave: `<svg viewBox="0 0 24 24"><path d="M1.5 21.5C1.5 11.5 6 4 12 4s10.5 7.5 10.5 17.5z" fill="#5a5470" stroke="#2a2638" stroke-width="1.2" stroke-linejoin="round"/>
    <path d="M5.5 7.6l1.4 2.6 1.1-3.4M15.8 6.4l1.3 3 1.3-2.4" stroke="#2a2638" stroke-width="1" fill="none" stroke-linejoin="round"/>
    <path d="M5.8 21.5c0-6.4 2.8-11 6.2-11s6.2 4.6 6.2 11z" fill="#14121f"/>
    <circle cx="12" cy="17.2" r="4" fill="#ffcf6a" opacity=".32"/><path d="M10.5 15.4h3l.3 3.8h-3.6z" fill="#ffd36a"/><path d="M11 15.4l.4-1h1.2l.4 1" fill="#e8a43a"/></svg>`,
};

/** 英雄頭像圖示名稱（沒有專屬圖時用騎士） */
export const heroIcon = type => (ICON[type] ? type : 'knight');
