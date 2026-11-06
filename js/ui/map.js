// 關卡地圖：海圖風格 SVG（擁有者：D 介面）

import { STAR_POINTS } from './dom.js';

const NS = 'http://www.w3.org/2000/svg';
const VB_W = 1000, VB_H = 460;

// 10 個島的位置（viewBox 座標），由左下往右上蜿蜒
export const NODE_POS = [
  [92, 330], [196, 206], [308, 318], [404, 178], [508, 292],
  [612, 360], [694, 232], [780, 340], [858, 214], [926, 104],
];

const ENV_FILL = {
  day: '#8cc46c', dusk: '#d2a75c', night: '#7178ad', rain: '#6fa58c', fog: '#a3b6a8', final: '#6a5590',
};

function el(tag, attrs = {}, kids) {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) if (attrs[k] != null) e.setAttribute(k, attrs[k]);
  if (kids) for (const c of kids) if (c) e.append(c);
  return e;
}

function rng(seed) {
  let s = seed * 9301 + 49297;
  return () => { s = (s * 16807) % 2147483647; return (s & 0xffff) / 0x10000; };
}

// 平滑的不規則島嶼輪廓
function blobPath(cx, cy, R, seed, pts = 11, jitter = 0.18, squash = 0.78) {
  const r = rng(seed);
  const p = [];
  for (let i = 0; i < pts; i++) {
    const a = (i / pts) * Math.PI * 2 + r() * 0.3;
    const rr = R * (1 - jitter + r() * jitter * 2);
    p.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * squash]);
  }
  let d = '';
  for (let i = 0; i < pts; i++) {
    const a = p[i], b = p[(i + 1) % pts];
    const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
    d += i === 0 ? `M${mx.toFixed(1)} ${my.toFixed(1)}` : '';
    const n = p[(i + 1) % pts], m2 = p[(i + 2) % pts];
    d += ` Q${n[0].toFixed(1)} ${n[1].toFixed(1)} ${((n[0] + m2[0]) / 2).toFixed(1)} ${((n[1] + m2[1]) / 2).toFixed(1)}`;
  }
  return d + 'Z';
}

function segPath(pts, i) {
  const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
  const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
  const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
  return `M${p1[0]} ${p1[1]} C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0]} ${p2[1]}`;
}

function envKey(lv) {
  if (lv.id === 10) return 'final';
  const t = lv.env?.time, w = lv.env?.weather;
  if (w === 'rain' && t !== 'night') return 'rain';
  if (w === 'fog') return 'fog';
  if (t === 'night') return 'night';
  if (t === 'dusk') return 'dusk';
  return 'day';
}

function compass(cx, cy, r) {
  const g = el('g', { class: 'mp-compass', transform: `translate(${cx} ${cy})` });
  g.append(el('circle', { r: r, class: 'mp-cmp-ring' }), el('circle', { r: r * 0.78, class: 'mp-cmp-ring2' }));
  const pt = (a, len, w) => {
    const ax = Math.cos(a), ay = Math.sin(a), px = -ay, py = ax;
    return `M${(ax * len).toFixed(1)} ${(ay * len).toFixed(1)} L${(px * w).toFixed(1)} ${(py * w).toFixed(1)} L0 0 Z M${(ax * len).toFixed(1)} ${(ay * len).toFixed(1)} L${(-px * w).toFixed(1)} ${(-py * w).toFixed(1)} L0 0 Z`;
  };
  for (let i = 0; i < 8; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 4;
    g.append(el('path', { d: pt(a, i % 2 ? r * 0.55 : r * 0.95, i % 2 ? 4 : 7), class: i % 2 ? 'mp-cmp-minor' : 'mp-cmp-major' }));
  }
  const n = el('text', { y: -r - 6, class: 'mp-cmp-n' }); n.textContent = '北';
  g.append(el('circle', { r: 3.5, class: 'mp-cmp-dot' }), n);
  return g;
}

function waveMark(x, y, s = 1) {
  return el('path', { class: 'mp-wavemark', d: `M${x} ${y} q${6 * s} ${-6 * s} ${12 * s} 0 t${12 * s} 0 t${12 * s} 0`, });
}

/**
 * 畫出海圖。levels：關卡陣列；progress：存檔；onPick(levelId)
 * 回傳 <svg>
 */
export function renderChart(levels, progress, isUnlocked, onPick) {
  const svg = el('svg', { viewBox: `0 0 ${VB_W} ${VB_H}`, class: 'mp-svg', preserveAspectRatio: 'xMidYMid meet', role: 'list' });
  const defs = el('defs');
  defs.innerHTML = `
    <radialGradient id="mp-final" cx="50%" cy="50%" r="50%">
      <stop offset="0" stop-color="#6a3fa0" stop-opacity=".55"/><stop offset="1" stop-color="#6a3fa0" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="mp-glow" cx="50%" cy="50%" r="50%">
      <stop offset="0" stop-color="#ffe9a0" stop-opacity=".95"/><stop offset="1" stop-color="#ffd66a" stop-opacity="0"/>
    </radialGradient>`;
  svg.append(defs);

  // 海面、經緯線、暈影、邊框由 CSS（.map-chart）畫，SVG 只畫內容，任何長寬比都能填滿

  // 裝飾：波紋、羅盤
  const deco = el('g', { class: 'mp-deco' });
  [[60, 100, 1], [140, 420, .8], [262, 92, 1], [455, 410, .9], [560, 110, 1.1], [330, 214, .7],
   [700, 120, .8], [610, 238, .7], [880, 420, .8], [980 - 70, 300, .7], [40, 230, .7], [770, 60, .7]]
    .forEach(([x, y, s]) => deco.append(waveMark(x, y, s)));
  deco.append(compass(950 - 22, 392, 34));
  svg.append(deco);

  // 航線
  const pts = NODE_POS.slice(0, levels.length);
  const routes = el('g', { class: 'mp-routes' });
  for (let i = 0; i < pts.length - 1; i++) {
    const done = isUnlocked(levels[i + 1].id);
    routes.append(el('path', { d: segPath(pts, i), class: 'mp-route' + (done ? ' is-done' : '') }));
  }
  svg.append(routes);

  // 目前該挑戰的關卡：第一個已解鎖但還沒過的；都過了就沒有
  let current = null;
  for (const lv of levels) { if (isUnlocked(lv.id) && !(progress.stars[lv.id] > 0)) { current = lv.id; break; } }

  const nodes = el('g', { class: 'mp-nodes' });
  levels.forEach((lv, i) => {
    const [x, y] = pts[i] || [100 + i * 90, 230];
    const unlocked = isUnlocked(lv.id);
    const stars = progress.stars[lv.id] || 0;
    const key = envKey(lv);
    const big = lv.id === 10;
    const R = big ? 50 : 40;
    const g = el('g', {
      class: `mp-node env-${key}${unlocked ? '' : ' is-locked'}${current === lv.id ? ' is-current' : ''}${stars ? ' is-cleared' : ''}`,
      transform: `translate(${x} ${y})`, role: 'listitem button', tabindex: '0', 'data-level': lv.id,
      'aria-label': `第 ${lv.id} 關 ${lv.name}${unlocked ? `，${stars} 星` : '，未解鎖'}`,
    });
    if (big) g.append(el('circle', { r: R + 34, fill: 'url(#mp-final)', class: 'mp-aura' }));
    if (current === lv.id) g.append(el('circle', { r: R + 10, fill: 'url(#mp-glow)', class: 'mp-glow' }), el('circle', { r: R + 6, class: 'mp-pulse' }));
    g.append(
      el('path', { d: blobPath(3, 9, R * 1.04, lv.id * 7 + 1), class: 'mp-shadow' }),
      el('path', { d: blobPath(0, 0, R * 1.22, lv.id * 7 + 1, 11, 0.16), class: 'mp-shallow' }),
      el('path', { d: blobPath(0, 0, R, lv.id * 7 + 1), class: 'mp-sand' }),
      el('path', { d: blobPath(-2, -3, R * 0.8, lv.id * 13 + 5, 10, 0.2), class: 'mp-grass', fill: ENV_FILL[key] }));
    // 島上小樹
    const rr = rng(lv.id * 31);
    for (let k = 0; k < (big ? 4 : 3); k++) {
      const a = rr() * Math.PI * 2, d = R * (0.4 + rr() * 0.25);
      const tx = Math.cos(a) * d, ty = Math.sin(a) * d * 0.65 - 3;
      if (Math.abs(tx) < 16 && Math.abs(ty) < 14) continue;
      g.append(el('circle', { cx: tx.toFixed(1), cy: ty.toFixed(1), r: 4.5 + rr() * 2.5, class: 'mp-tree' }));
    }
    // 中央徽章
    const medal = el('g', { class: 'mp-medal' });
    medal.append(el('circle', { r: big ? 19 : 16, class: 'mp-medal-bg' }));
    if (unlocked) {
      const t = el('text', { class: 'mp-medal-num', y: 1 }); t.textContent = lv.id; medal.append(t);
    } else {
      medal.append(el('path', { class: 'mp-lock', d: 'M-5.5 -2.5v-3a5.5 5.5 0 0 1 11 0v3', fill: 'none' }),
        el('rect', { class: 'mp-lock-body', x: -8, y: -3, width: 16, height: 12, rx: 2.5 }));
    }
    g.append(medal);
    // 星星
    if (unlocked) {
      const sg = el('g', { class: 'mp-stars', transform: `translate(0 ${-(R * 0.78) - 18})` });
      for (let k = 0; k < 3; k++) {
        const sx = (k - 1) * 21, sy = k === 1 ? -5 : 0;
        sg.append(el('polygon', { points: STAR_POINTS, transform: `translate(${sx - 9.6} ${sy - 10}) scale(.8)`, class: k < stars ? 'mp-star on' : 'mp-star' }));
      }
      g.append(sg);
    }
    // 名稱緞帶
    const label = el('g', { class: 'mp-label', transform: `translate(0 ${R * 0.78 + 20})` });
    const w = Math.max(64, lv.name.length * 17 + 26);
    label.append(el('rect', { x: -w / 2, y: -13, width: w, height: 26, rx: 13, class: 'mp-label-bg' }));
    const tt = el('text', { class: 'mp-label-txt', y: 1 }); tt.textContent = lv.name;
    label.append(tt);
    g.append(label);
    // 船：標示目前關卡
    if (current === lv.id) {
      const ship = el('g', { class: 'mp-ship', transform: `translate(${-R - 26} ${-6})` });
      ship.innerHTML = '<g class="mp-ship-bob"><path d="M0 -26v24" stroke="#5a371d" stroke-width="2"/><path d="M1.5 -24c8 5 11 12 11 20H1.5z" fill="#fff6df" stroke="#5a371d" stroke-width="1.6"/><path d="M-1.5 -20c-6 4-8.5 9-9 16h9z" fill="#f1e2bd" stroke="#5a371d" stroke-width="1.6"/><path d="M-16 0h32l-5 8h-22z" fill="#8a5630" stroke="#3d2412" stroke-width="1.6"/><path d="M0 -26l7 2.5L0 -21z" fill="#c4473a"/></g>';
      g.append(ship);
    }
    // 點擊範圍（≥ 44px）
    g.append(el('circle', { r: R + 14, class: 'mp-hit' }));
    g.addEventListener('click', () => onPick(lv.id));
    g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(lv.id); } });
    nodes.append(g);
  });
  svg.append(nodes);
  return svg;
}
