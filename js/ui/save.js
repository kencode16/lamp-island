// 存檔（擁有者：D 介面）。格式見 架構.md §8。
// localStorage 讀寫一律 try/catch；不能用時（無痕模式、被封鎖）改存在記憶體，遊戲照樣能玩。
// loadProgress() 在同一次執行中回傳「同一個物件」，main 與 UI 共用，避免兩份進度互相覆蓋。

import { TALENTS } from '../data/talents.js';
import { HEROES } from '../data/heroes.js';
import { CHAPTERS, chapterOf, lastLevelOf, isChapterUnlocked } from './chapters.js';

const KEY = 'shoudeng-island.progress.v1';
export const DEFAULT_SETTINGS = Object.freeze({ music: 0.6, sfx: 0.8, quality: 'high' });

let memoryCopy = null;   // localStorage 失敗時的備援
let cached = null;

function defaults() {
  return { stars: {}, best: {}, talents: [], hero: 'knight', settings: { ...DEFAULT_SETTINGS } };
}

const clamp01 = (v, d) => (typeof v === 'number' && isFinite(v) ? Math.min(1, Math.max(0, v)) : d);

function normalize(raw) {
  const p = defaults();
  if (!raw || typeof raw !== 'object') return p;
  if (raw.stars && typeof raw.stars === 'object') {
    for (const k in raw.stars) {
      const n = Math.round(Number(raw.stars[k]));
      if (n > 0) p.stars[k] = Math.min(3, n);
    }
  }
  if (raw.best && typeof raw.best === 'object') {
    for (const k in raw.best) {
      const n = Number(raw.best[k]);
      if (isFinite(n) && n >= 0) p.best[k] = n;
    }
  }
  if (Array.isArray(raw.talents)) {
    const ok = new Set(TALENTS.map(t => t.id));
    p.talents = [...new Set(raw.talents.filter(id => ok.has(id)))];
  }
  // v2.0：上次選的英雄（舊存檔沒有這欄＝騎士）
  if (typeof raw.hero === 'string' && HEROES[raw.hero]) p.hero = raw.hero;
  const s = raw.settings || {};
  p.settings = {
    music: clamp01(s.music, DEFAULT_SETTINGS.music),
    sfx: clamp01(s.sfx, DEFAULT_SETTINGS.sfx),
    quality: s.quality === 'low' ? 'low' : 'high',
  };
  return p;
}

function readRaw() {
  try {
    const s = window.localStorage.getItem(KEY);
    if (s != null) return s;
  } catch (e) { /* 讀不到就用記憶體 */ }
  return memoryCopy;
}

/** 讀取進度。回傳 { stars, best, talents, hero, settings }，同一次執行中是同一個物件。 */
export function loadProgress() {
  if (cached) return cached;
  let raw = null;
  try { raw = JSON.parse(readRaw() || 'null'); } catch (e) { raw = null; }
  cached = normalize(raw);
  return cached;
}

/** 寫入進度。localStorage 成功回傳 true；失敗時只存在記憶體，回傳 false。 */
export function saveProgress(p) {
  if (p && typeof p === 'object') cached = p;
  let s;
  try { s = JSON.stringify(cached || defaults()); } catch (e) { return false; }
  memoryCopy = s;
  try { window.localStorage.setItem(KEY, s); return true; } catch (e) { return false; }
}

/** 已拿到的總星數 */
export function starsEarned(p) {
  let n = 0;
  for (const k in (p?.stars || {})) n += Math.max(0, Math.min(3, p.stars[k] | 0));
  return n;
}

/** 天賦已花掉的星數 */
export function starsSpent(p) {
  const set = new Set(p?.talents || []);
  let n = 0;
  for (const t of TALENTS) if (set.has(t.id)) n += t.cost;
  return n;
}

// ---- 以下為新增的輔助函式（合約以外，main 可選用） ----

/** 還能花的星數 */
export function starsAvailable(p) { return Math.max(0, starsEarned(p) - starsSpent(p)); }

/** 第 n 關是否開放：第 1 關永遠開放；第 n-1 關過關（≥1 星）才開放第 n 關 */
export function isLevelUnlocked(p, levelId) {
  const id = Number(levelId);
  return id <= 1 || (p?.stars?.[id - 1] || 0) >= 1;
}

export { isChapterUnlocked };

/** 英雄是否可選：unlockAfter＝通過第幾關後解鎖（0＝一開始就能選） */
export function isHeroUnlocked(p, heroId) {
  const def = HEROES[heroId];
  if (!def) return false;
  const after = def.unlockAfter | 0;
  return after <= 0 || (p?.stars?.[after] || 0) >= 1;
}

/** 出發要用的英雄：上次選的（progress.hero）還沒解鎖就退回騎士 */
export function chosenHero(p) {
  const id = p?.hero;
  return id && isHeroUnlocked(p, id) ? id : 'knight';
}

/**
 * 過關「之前」呼叫：這一關第一次過關會解鎖什麼（給結算畫面的 unlocks）。
 * 回傳 [{ kind: 'hero', id }, { kind: 'chapter', id }]；已經過過這關就回傳 []。
 * levels 可省略（省略時每章當 10 關算，第二章一定列出）。
 */
export function unlocksForClear(p, levelId, levels) {
  const id = Number(levelId);
  if (!p || (p.stars?.[id] || 0) >= 1) return [];
  const out = [];
  for (const k in HEROES) if ((HEROES[k].unlockAfter | 0) === id) out.push({ kind: 'hero', id: k });
  for (const ch of CHAPTERS) {
    if (ch.id <= 1) continue;
    const hasLevels = !levels || levels.some(l => chapterOf(l) === ch.id);
    if (hasLevels && lastLevelOf(levels, ch.id - 1) === id) out.push({ kind: 'chapter', id: ch.id });
  }
  return out;
}

/** 把一場結果寫進進度（星數、最佳燈光都取最大值）並存檔。回傳是否有更新。 */
export function recordResult(p, levelId, { won, stars, lamp } = {}) {
  if (!p || !won) return false;
  let changed = false;
  const s = Math.max(0, Math.min(3, stars | 0));
  if (s > (p.stars[levelId] || 0)) { p.stars[levelId] = s; changed = true; }
  if (typeof lamp === 'number' && lamp > (p.best[levelId] ?? -1)) { p.best[levelId] = lamp; changed = true; }
  if (changed) saveProgress(p);
  return changed;
}

/** 清空全部進度（測試用） */
export function resetProgress() {
  cached = defaults();
  saveProgress(cached);
  return cached;
}
