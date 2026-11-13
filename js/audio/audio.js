// 《守燈小島》音效與配樂（E 模組）
// API（架構.md §9）：audio.init() / unlock() / play(name, opts) / music(mood|null) / setVolume({music, sfx}) / handleEvent(ev)
// 另外新增：setEnv(env)、ambience(kinds)、playStars(n)、setSpatial(fn)、auto、stats()、loadAll()（說明見 js/audio/README.md）
// v2.0（第二章）：music('cave'|'caveBoss')、setEnv({time:'cave'}) 洞窟環境音、稜鏡雷射迴圈（laserOn/Off）、
//   setHero(type)、setPaused(bool)、stopLoops()、第二章與三位英雄的事件對應
// 原則：任何錯誤都安靜略過，不丟例外、不讓遊戲壞掉。
import { SFX, MUSIC, AMB } from './manifest.js';

const BASE = new URL('../../assets/audio/', import.meta.url).href;

// ---------- 每個音效的混音設定 ----------
// vol：音量；rv：音高隨機幅度（±比例）；gv：音量隨機幅度；cd：同名最短間隔（毫秒）；max：同名同時最多幾個；
// group：共用限頻群組；pri：載入優先（0 先載、1 次之、2 最後／用到才載）；imp：重要（不被總聲部上限擠掉）
const DEF = {
  // 介面
  click:      { vol: 0.55, rv: 0.03, cd: 35, max: 3, pri: 0, imp: 1 },
  open:       { vol: 0.50, rv: 0.03, cd: 60, max: 2, pri: 0, imp: 1 },
  error:      { vol: 0.60, cd: 180, max: 1, pri: 0, imp: 1 },
  coin:       { vol: 0.40, rv: 0.07, cd: 90, max: 3, pri: 0 },
  star:       { vol: 0.80, cd: 80, max: 3, pri: 1, imp: 1 },
  victory:    { vol: 0.90, max: 1, pri: 2, imp: 1 },
  defeat:     { vol: 0.90, max: 1, pri: 2, imp: 1 },
  // 經濟
  build:      { vol: 0.75, rv: 0.04, cd: 80, max: 2, pri: 0, imp: 1 },
  upgrade:    { vol: 0.75, rv: 0.02, cd: 80, max: 2, pri: 1, imp: 1 },
  sell:       { vol: 0.70, rv: 0.03, cd: 100, max: 2, pri: 1, imp: 1 },
  // 塔：發射
  arrow:      { vol: 0.40, rv: 0.08, cd: 55, max: 4, group: 'shoot', pri: 0 },
  bolt:       { vol: 0.45, rv: 0.06, cd: 60, max: 3, group: 'shoot', pri: 1 },
  catapult:   { vol: 0.50, rv: 0.06, cd: 90, max: 3, group: 'shoot', pri: 0 },
  orb:        { vol: 0.40, rv: 0.07, cd: 60, max: 3, group: 'shoot', pri: 1 },
  frostShot:  { vol: 0.40, rv: 0.07, cd: 60, max: 3, group: 'shoot', pri: 1 },
  // 塔：命中與範圍
  explosion:  { vol: 0.60, rv: 0.07, cd: 70, max: 3, group: 'boom', pri: 0 },
  fire:       { vol: 0.55, rv: 0.07, cd: 80, max: 3, group: 'boom', pri: 1 },
  lightning:  { vol: 0.50, rv: 0.06, cd: 90, max: 2, pri: 1 },
  frost:      { vol: 0.50, rv: 0.06, cd: 80, max: 2, pri: 1 },
  vines:      { vol: 0.50, rv: 0.08, cd: 120, max: 2, pri: 1 },
  hitFlesh:   { vol: 0.40, rv: 0.12, cd: 45, max: 3, group: 'hit', pri: 0 },
  hitArmor:   { vol: 0.36, rv: 0.10, cd: 50, max: 3, group: 'hit', pri: 0 },
  hitMagic:   { vol: 0.32, rv: 0.10, cd: 45, max: 3, group: 'hit', pri: 1 },
  iceCrack:   { vol: 0.40, rv: 0.10, cd: 110, max: 2, pri: 1 },
  ignite:     { vol: 0.35, rv: 0.10, cd: 150, max: 2, pri: 1 },
  // 敵人
  slimePop:   { vol: 0.50, rv: 0.10, cd: 45, max: 3, group: 'death', pri: 0 },
  death:      { vol: 0.45, rv: 0.08, cd: 45, max: 3, group: 'death', pri: 0 },
  bones:      { vol: 0.50, rv: 0.08, cd: 60, max: 2, group: 'death', pri: 1 },
  bat:        { vol: 0.40, rv: 0.10, cd: 70, max: 3, group: 'death', pri: 1 },
  crumble:    { vol: 0.55, rv: 0.07, cd: 80, max: 2, group: 'death', pri: 1 },
  golemStep:  { vol: 0.55, rv: 0.06, cd: 250, max: 2, pri: 1 },
  golemDeath: { vol: 0.75, rv: 0.04, cd: 200, max: 1, pri: 1, imp: 1 },
  spawn:      { vol: 0.22, rv: 0.08, cd: 300, max: 2, pri: 1 },
  shield:     { vol: 0.40, rv: 0.05, cd: 250, max: 2, pri: 1 },
  shieldBreak:{ vol: 0.42, rv: 0.08, cd: 90, max: 2, pri: 1 },
  summon:     { vol: 0.65, rv: 0.04, cd: 300, max: 1, pri: 2, imp: 1 },
  dim:        { vol: 0.60, rv: 0.04, cd: 300, max: 1, pri: 2, imp: 1 },
  bossRoar:   { vol: 0.85, max: 1, cd: 1500, pri: 2, imp: 1 },
  bossDeath:  { vol: 0.85, max: 1, cd: 1500, pri: 2, imp: 1 },
  leak:       { vol: 0.70, rv: 0.03, cd: 180, max: 2, pri: 0, imp: 1 },
  // 波次
  waveStart:  { vol: 0.75, max: 1, cd: 800, pri: 0, imp: 1 },
  waveCleared:{ vol: 0.65, max: 1, cd: 800, pri: 1, imp: 1 },
  // 技能
  meteorFall: { vol: 0.65, rv: 0.05, cd: 120, max: 3, pri: 1, imp: 1 },
  meteorImpact:{ vol: 0.80, rv: 0.08, cd: 90, max: 3, group: 'boom', pri: 1, imp: 1 },
  freeze:     { vol: 0.80, max: 1, cd: 500, pri: 1, imp: 1 },
  // 英雄
  swordSwing: { vol: 0.42, rv: 0.08, cd: 120, max: 2, pri: 0 },
  heroHurt:   { vol: 0.50, rv: 0.06, cd: 450, max: 1, pri: 1, imp: 1 },
  heroDeath:  { vol: 0.75, max: 1, cd: 1000, pri: 1, imp: 1 },
  heroRespawn:{ vol: 0.70, max: 1, cd: 1000, pri: 1, imp: 1 },
  levelUp:    { vol: 0.70, max: 1, cd: 500, pri: 1, imp: 1 },
  // 天氣
  thunder:    { vol: 0.45, rv: 0.06, cd: 4000, max: 1, pri: 2 },
  // ===== 第二章（v2.0）=====
  // 燈籠與稜鏡塔
  lanternLight:{ vol: 0.70, rv: 0.03, cd: 120, max: 2, pri: 0, imp: 1 },
  lanternOn:  { vol: 0.50, rv: 0.04, cd: 150, max: 2, pri: 1 },
  lanternOut: { vol: 0.60, rv: 0.05, cd: 150, max: 2, pri: 1, imp: 1 },
  ink:        { vol: 0.55, rv: 0.08, cd: 150, max: 2, pri: 1 },
  crystal:    { vol: 0.55, rv: 0.03, cd: 120, max: 2, pri: 1 },
  laserStart: { vol: 0.45, rv: 0.05, cd: 90, max: 3, pri: 0 },
  laserLoop:  { vol: 0.55, pri: 0 },             // 迴圈：由 laserOn／laserOff 控制（vol＝單一雷射的音量）
  // 洞窟敵人與王
  burrow:     { vol: 0.55, rv: 0.08, cd: 120, max: 3, pri: 1 },
  emerge:     { vol: 0.60, rv: 0.08, cd: 120, max: 3, pri: 1 },
  quake:      { vol: 0.70, rv: 0.04, cd: 600, max: 1, pri: 2, imp: 1 },
  reveal:     { vol: 0.50, rv: 0.06, cd: 220, max: 2, pri: 1 },
  ghostDeath: { vol: 0.50, rv: 0.06, cd: 80, max: 3, group: 'death', pri: 1 },
  moleDeath:  { vol: 0.50, rv: 0.10, cd: 60, max: 3, group: 'death', pri: 1 },
  segment:    { vol: 0.75, rv: 0.04, cd: 250, max: 2, pri: 2, imp: 1 },
  eat:        { vol: 0.85, cd: 400, max: 1, pri: 2, imp: 1 },
  moleKingRoar:{ vol: 0.85, max: 1, cd: 1500, pri: 2, imp: 1 },
  wormRoar:   { vol: 0.90, max: 1, cd: 1500, pri: 2, imp: 1 },
  // 英雄普攻
  fairyBolt:  { vol: 0.40, rv: 0.06, cd: 90, max: 3, pri: 0 },
  sparkHit:   { vol: 0.32, rv: 0.10, cd: 45, max: 3, group: 'hit', pri: 0 },
  fireballCast:{ vol: 0.45, rv: 0.06, cd: 110, max: 2, pri: 0 },
  fireballHit:{ vol: 0.55, rv: 0.07, cd: 110, max: 3, group: 'boom', pri: 0 },
  // 英雄技能
  skillWhirl:     { vol: 0.80, rv: 0.02, cd: 300, max: 1, pri: 1, imp: 1 },
  skillCharge:    { vol: 0.80, rv: 0.02, cd: 300, max: 1, pri: 1, imp: 1 },
  skillStarburst: { vol: 0.75, rv: 0.02, cd: 300, max: 1, pri: 1, imp: 1 },
  skillPollen:    { vol: 0.75, rv: 0.02, cd: 300, max: 1, pri: 1, imp: 1 },
  skillFirestorm: { vol: 0.85, rv: 0.02, cd: 300, max: 1, pri: 1, imp: 1 },
  skillIcefall:   { vol: 0.85, rv: 0.02, cd: 300, max: 1, pri: 1, imp: 1 },
  // 英雄選擇、妖精受傷／倒下（妖精不用男聲）
  heroPick_knight:{ vol: 0.75, cd: 150, max: 1, pri: 1, imp: 1 },
  heroPick_fairy: { vol: 0.75, cd: 150, max: 1, pri: 1, imp: 1 },
  heroPick_mage:  { vol: 0.75, cd: 150, max: 1, pri: 1, imp: 1 },
  fairyHurt:  { vol: 0.50, rv: 0.06, cd: 450, max: 1, pri: 1, imp: 1 },
  fairyDeath: { vol: 0.75, max: 1, cd: 1000, pri: 1, imp: 1 },
};

// 群組限頻：每 window 毫秒最多 n 個新聲音、同時最多 max 個
const GROUPS = {
  hit:   { window: 50, n: 3, max: 4 },
  shoot: { window: 40, n: 3, max: 7 },
  death: { window: 50, n: 3, max: 5 },
  boom:  { window: 60, n: 2, max: 4 },
};
const MAX_VOICES = 28;           // 總聲部上限（不重要的聲音會被略過）
const MUSIC_FADE = 1.6;          // 配樂交叉淡入淡出秒數
const BOSS_TYPES = new Set(['slimeKing', 'nightLord', 'moleKing', 'abyssWorm']);
const ARMORED = new Set(['skeleton', 'golem', 'gargoyle', 'abyssWorm']);
// v2.0
const LEVEL_MOODS = new Set(['day', 'night', 'boss', 'cave', 'caveBoss']);
const BOSS_MOODS = new Set(['boss', 'caveBoss']);
const MUSIC_GROUPS = { island: ['menu', 'day', 'night', 'boss'], cave: ['cave', 'caveBoss', 'menu'] };
const groupOf = (mood) => (mood === 'cave' || mood === 'caveBoss' ? 'cave' : 'island');
const LASER_MAX = 3;                       // 同時最多幾道雷射有聲音
const LASER_RATES = [1, 1.122, 0.891];     // 每一道稍微不同音高（避免同相疊在一起）
const HERO_SKILL_SND = { whirl: 'skillWhirl', charge: 'skillCharge', starburst: 'skillStarburst', pollen: 'skillPollen', firestorm: 'skillFirestorm', icefall: 'skillIcefall' };
const ATTACK_HERO = { sword: 'knight', bolt: 'fairy', fireball: 'mage' };

// ---------- 內部狀態 ----------
let ctx = null, master = null, sfxBus = null, musicBus = null, ambBus = null, comp = null;
const buffers = new Map();       // key → AudioBuffer
const offsets = new Map();       // key → 前置靜音秒數（AAC 解碼若未去掉 priming 時使用）
const loading = new Map();       // key → Promise
const failed = new Set();
const lastPlay = new Map();      // name → ctx 時間
const voices = new Map();        // name → [結束時間]
const groupLog = new Map();      // group → { starts: [時間], ends: [時間] }
let activeVoices = [];           // 結束時間
let vol = { music: 0.6, sfx: 0.9 };
let muted = false;
let curMood = null, curMusic = null;   // { mood, src, gain }
let wantedMood = null;
let env = { time: 'day', weather: 'clear' };
let inLevel = false;             // 目前在關卡裡（music 收到 day/night/boss 時成立；menu、勝負時解除）
let envFresh = false;            // 進關前已用 setEnv 指定過環境
let bossActive = false;
let nPlayed = 0, nSkipped = 0;
let lastSell = -1;   // 統計（測試頁用）
const enemyType = new Map();     // 敵人 id → 種類（給命中音判斷用）
let spatialFn = null;
const amb = {};                  // kind → { src, gain }
let wantAmb = new Set();
let unlocked = false;
let initDone = false;
// v2.0
let loopBus = null;              // 持續音（雷射）的匯流排：暫停時壓到 0
let loopsPaused = false;
const lasers = new Map();        // 塔 id → { voice: { src, gain, slot } | null, t: 開始時間 }
const towerInfo = new Map();     // 塔 id → { type, x, z }（給升級音效與雷射左右聲道）
let heroType = 'knight';
let liveLaserSrc = 0;            // 還在播的雷射音源數（onended 才減；測試用來確認真的停了）

const now = () => (ctx ? ctx.currentTime : 0);
const rnd = (a) => (a ? (Math.random() * 2 - 1) * a : 0);
const clamp01 = (v) => Math.max(0, Math.min(1, v));
function volValue(v, dflt) {
  if (v === true) return 1;
  if (v === false) return 0;
  if (typeof v === 'number' && isFinite(v)) return clamp01(v > 1 ? v / 100 : v);
  return dflt;
}

function safe(fn) {
  return (...args) => { try { return fn(...args); } catch (e) { warnOnce('audio', e); return undefined; } };
}
const warned = new Set();
function warnOnce(key, e) {
  if (warned.has(key)) return;
  warned.add(key);
  try { console.warn('[audio] 略過錯誤：', key, e && e.message ? e.message : e); } catch (_) {}
}

// ---------- 建立 AudioContext ----------
function ensureCtx() {
  if (ctx) return ctx;
  const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
  if (!AC) return null;
  try { ctx = new AC({ latencyHint: 'interactive' }); } catch (_) { try { ctx = new AC(); } catch (e) { return null; } }
  master = ctx.createGain(); master.gain.value = muted ? 0 : 1;
  try {
    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -10; comp.knee.value = 8; comp.ratio.value = 4;
    comp.attack.value = 0.004; comp.release.value = 0.2;
    master.connect(comp); comp.connect(ctx.destination);
  } catch (_) { master.connect(ctx.destination); }
  sfxBus = ctx.createGain(); sfxBus.connect(master);
  loopBus = ctx.createGain(); loopBus.gain.value = loopsPaused ? 0 : 1; loopBus.connect(sfxBus);
  musicBus = ctx.createGain(); musicBus.connect(master);
  ambBus = ctx.createGain(); ambBus.connect(master);
  applyVolume();
  return ctx;
}

function applyVolume() {
  if (!ctx) return;
  const t = ctx.currentTime;
  // 感知曲線：平方
  sfxBus.gain.setTargetAtTime(vol.sfx * vol.sfx, t, 0.03);
  musicBus.gain.setTargetAtTime(vol.music * vol.music * 0.75, t, 0.05);
  ambBus.gain.setTargetAtTime(vol.sfx * vol.sfx * 0.6, t, 0.05);
}

function decode(ab) {
  return new Promise((res, rej) => {
    try {
      const p = ctx.decodeAudioData(ab, res, rej);
      if (p && typeof p.then === 'function') p.then(res, rej);
    } catch (e) { rej(e); }
  });
}

function leadingSilence(buf) {
  // AAC 在部分解碼器會留下約 2112 個樣本的前置延遲；偵測並跳過（最多 0.06 秒）
  try {
    const d = buf.getChannelData(0);
    const lim = Math.min(d.length, Math.floor(buf.sampleRate * 0.06));
    for (let i = 0; i < lim; i++) if (Math.abs(d[i]) > 1e-4) return i / buf.sampleRate;
    return lim / buf.sampleRate;
  } catch (_) { return 0; }
}

// 環境音是雜訊類，AAC 在循環點前後的波形不會完全一樣，接點可能有細小喀聲。
// 檔案在 loopStart 之前放了一段與 loopEnd 之前相同的內容，這裡把 loopEnd 前 0.25 秒淡入那段內容，接點就連續了。
function smoothLoop(buf, e) {
  try {
    const sr = buf.sampleRate, K = Math.floor(sr * 0.25);
    const a = Math.round((e.loopStart || 0) * sr), b = Math.round((e.loopEnd || buf.duration) * sr);
    if (a < K || b > buf.length || b - a < 2 * K) return;
    for (let ch = 0; ch < buf.numberOfChannels; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < K; i++) { const t = i / K; d[b - K + i] = d[b - K + i] * (1 - t) + d[a - K + i] * t; }
    }
  } catch (_) {}
}

function entry(key) {
  // key：'sfx:click' / 'music:day' / 'amb:rain'
  const [kind, name] = key.split(':');
  const tbl = kind === 'sfx' ? SFX : kind === 'music' ? MUSIC : AMB;
  return tbl && tbl[name];
}

function load(key) {
  if (buffers.has(key)) return Promise.resolve(buffers.get(key));
  if (loading.has(key)) return loading.get(key);
  if (failed.has(key) || !ensureCtx()) return Promise.resolve(null);
  const kind = key.split(':')[0];
  const e = entry(key);
  if (!e) { failed.add(key); return Promise.resolve(null); }
  const p = fetch(BASE + e.f)
    .then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.arrayBuffer(); })
    .then(decode)
    .then((buf) => {
      if (kind === 'amb') smoothLoop(buf, e);
      buffers.set(key, buf);
      offsets.set(key, key.startsWith('sfx:') ? leadingSilence(buf) : 0);
      loading.delete(key);
      return buf;
    })
    .catch((err) => { failed.add(key); loading.delete(key); warnOnce('load ' + key, err); return null; });
  loading.set(key, p);
  return p;
}

async function loadQueue(keys, conc = 4) {
  let i = 0;
  const worker = async () => { while (i < keys.length) { const k = keys[i++]; await load(k); } };
  await Promise.all(Array.from({ length: Math.min(conc, keys.length) }, worker));
}

let preloadStarted = false;
// v1.3（整合者）：holdPreload(promise) 讓預載等某件事做完再開始（例如開場動畫播完），不跟影片搶網路
let preloadGate = null;
function holdPreload(p) { preloadGate = p && typeof p.then === 'function' ? p : null; }

function startPreload() {
  if (preloadStarted || !ensureCtx()) return;
  preloadStarted = true;
  if (preloadGate) { const g = preloadGate; preloadGate = null; g.then(runPreload, runPreload); return; }
  runPreload();
}

function runPreload() {
  const names = Object.keys(SFX);
  const byPri = (p) => names.filter((n) => (DEF[n] ? DEF[n].pri : 1) === p).map((n) => 'sfx:' + n);
  // 先載 UI 與常用音效，再載其餘，最後才是結算音樂與環境音
  loadQueue(byPri(0), 4)
    .then(() => loadQueue(byPri(1), 3))
    .then(() => loadQueue(byPri(2), 2))
    .then(() => loadQueue(names.filter((n) => !DEF[n]).map((n) => 'sfx:' + n), 2))
    .catch(() => {});
}

// ---------- 播放 ----------
function prune(arr, t) { let j = 0; for (let i = 0; i < arr.length; i++) if (arr[i] > t) arr[j++] = arr[i]; arr.length = j; return arr; }

function allowed(name, d, t) {
  const cd = (d.cd || 0) / 1000;
  const lp = lastPlay.get(name);
  if (lp !== undefined && t - lp < cd) return false;
  const v = prune(voices.get(name) || [], t);
  voices.set(name, v);
  if (d.max && v.length >= d.max) return false;
  if (d.group && GROUPS[d.group]) {
    const g = GROUPS[d.group];
    let gl = groupLog.get(d.group);
    if (!gl) { gl = { starts: [], ends: [] }; groupLog.set(d.group, gl); }
    prune(gl.ends, t);
    gl.starts = gl.starts.filter((s) => t - s < g.window / 1000);
    if (gl.starts.length >= g.n || gl.ends.length >= g.max) return false;
  }
  activeVoices = prune(activeVoices, t);
  if (!d.imp && activeVoices.length >= MAX_VOICES) return false;
  return true;
}

function playBuffer(name, buf, d, opts, t0) {
  const key = 'sfx:' + name;
  const rate = Math.max(0.25, Math.min(4, (opts.rate || 1) * (1 + rnd(d.rv || 0))));
  const g = (opts.vol != null ? opts.vol : 1) * (d.vol != null ? d.vol : 0.6) * (1 + rnd(d.gv != null ? d.gv : 0.1));
  if (g <= 0.0005) return null;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = rate;
  const gain = ctx.createGain();
  gain.gain.value = g;
  let out = gain;
  let pan = opts.pan;
  let sg = 1;
  if (spatialFn && opts.x != null && opts.z != null) {
    try { const s = spatialFn(opts.x, opts.z) || {}; if (s.pan != null) pan = s.pan; if (s.gain != null) sg = s.gain; } catch (_) {}
  }
  if (sg !== 1) gain.gain.value = g * Math.max(0, sg);
  if (pan && ctx.createStereoPanner) {
    const p = ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan));
    gain.connect(p); out = p;
  }
  src.connect(gain);
  out.connect(sfxBus);
  const off = offsets.get(key) || 0;
  const start = t0 + Math.max(0, opts.delay || 0);
  src.start(start, off);
  const end = start + (buf.duration - off) / rate;
  src.onended = () => { try { src.disconnect(); gain.disconnect(); if (out !== gain) out.disconnect(); } catch (_) {} };
  return end;
}

function play(name, opts = {}) {
  if (typeof name === 'string' && name.startsWith('heroPick_')) setHero(name.slice(9));   // 選英雄的音效順便記住目前英雄
  if (!ensureCtx() || muted) return false;
  const d = DEF[name] || { vol: 0.6 };
  if (!SFX[name]) return false;
  const t = ctx.currentTime;
  if (!opts.force && !allowed(name, d, t + (opts.delay || 0))) { nSkipped++; return false; }
  const key = 'sfx:' + name;
  const buf = buffers.get(key);
  const mark = (end) => {
    if (end == null) return;
    nPlayed++;
    lastPlay.set(name, t + (opts.delay || 0));
    (voices.get(name) || voices.set(name, []).get(name)).push(end);
    activeVoices.push(end);
    if (d.group && groupLog.get(d.group)) { const gl = groupLog.get(d.group); gl.starts.push(t); gl.ends.push(end); }
  };
  if (buf) { mark(playBuffer(name, buf, d, opts, t)); return true; }
  // 還沒載入：重要音效等載入（0.8 秒內完成才播），其餘略過但觸發載入
  const req = ctx.currentTime;
  lastPlay.set(name, t);
  load(key).then((b) => {
    if (!b || !d.imp) return;
    if (ctx.currentTime - req > 0.8) return;
    try { mark(playBuffer(name, b, d, opts, ctx.currentTime)); } catch (e) { warnOnce('late ' + name, e); }
  });
  return false;
}

// ---------- 配樂 ----------
function music(mood) {
  if (!ensureCtx()) return;
  const isCaveMood = mood === 'cave' || mood === 'caveBoss';
  // 用配樂判斷是否在關卡裡，順便帶動環境音
  if (LEVEL_MOODS.has(mood)) {
    if (!inLevel) {
      inLevel = true;
      if (!envFresh) env = { time: mood === 'night' ? 'night' : isCaveMood ? 'cave' : 'day', weather: 'clear' };
      else if (isCaveMood) env.time = 'cave';
      else if (mood === 'night') env.time = 'night';
      else if (mood === 'day' && env.time === 'night') env.time = 'day';
      envFresh = false;
      updateAmbience();
    } else if (isCaveMood && env.time !== 'cave') {
      env.time = 'cave'; updateAmbience();
    }
    // v2.0：洞窟關卡裡 day／night → cave、boss → caveBoss（main.js 沿用 musicFor() 也會對）
    if (env.time === 'cave') { if (mood === 'day' || mood === 'night') mood = 'cave'; else if (mood === 'boss') mood = 'caveBoss'; }
  } else if (mood === 'menu') {
    inLevel = false; envFresh = false; bossActive = false;
    stopLoops();
    updateAmbience();
  }
  if (mood && !MUSIC[mood]) mood = mood === 'caveBoss' && MUSIC.boss ? 'boss' : mood === 'cave' && MUSIC.night ? 'night' : null;
  if (BOSS_MOODS.has(mood)) bossActive = true;
  else if (mood === 'day' || mood === 'night' || mood === 'cave') bossActive = false;
  wantedMood = mood;
  if (curMusic && curMusic.mood === mood) return;
  const t = ctx.currentTime;
  if (curMusic) {
    const old = curMusic;
    try {
      old.gain.gain.cancelScheduledValues(t);
      old.gain.gain.setValueAtTime(old.gain.gain.value, t);
      old.gain.gain.linearRampToValueAtTime(0, t + MUSIC_FADE);
      old.src.stop(t + MUSIC_FADE + 0.1);
    } catch (_) {}
    setTimeout(() => { try { old.src.disconnect(); old.gain.disconnect(); } catch (_) {} }, (MUSIC_FADE + 0.5) * 1000);
    curMusic = null;
  }
  curMood = mood;
  if (!mood) return;
  load('music:' + mood).then((buf) => {
    if (!buf || wantedMood !== mood || (curMusic && curMusic.mood === mood)) return;
    const m = MUSIC[mood];
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const ls = Math.min(m.loopStart || 0, buf.duration - 0.1);
    const le = Math.min(m.loopEnd || buf.duration, buf.duration);
    src.loopStart = ls; src.loopEnd = le;
    const g = ctx.createGain();
    const t1 = ctx.currentTime;
    g.gain.setValueAtTime(0, t1);
    g.gain.linearRampToValueAtTime(m.vol != null ? m.vol : 1, t1 + MUSIC_FADE);
    src.connect(g); g.connect(musicBus);
    src.start(t1);
    curMusic = { mood, src, gain: g };
    // v2.0：只保留同一組（小島／洞窟）的配樂在記憶體（iPhone 省記憶體），4 秒後預載同組其他首
    const grp = MUSIC_GROUPS[groupOf(mood)];
    for (const k of [...buffers.keys()]) {
      if (k.startsWith('music:') && !grp.includes(k.slice(6))) buffers.delete(k);
    }
    setTimeout(() => {
      if (wantedMood !== mood) return;
      grp.forEach((k) => { if (k !== mood && MUSIC[k]) load('music:' + k); });
    }, 4000);
  });
}

// ---------- 環境音（雨、海浪、夜蟲） ----------
function ambience(kinds) {
  if (!ensureCtx()) return;
  wantAmb = new Set((kinds || []).filter((k) => AMB[k]));
  const t = ctx.currentTime;
  for (const k of Object.keys(amb)) {
    if (!wantAmb.has(k)) {
      const a = amb[k]; delete amb[k];
      try { a.gain.gain.cancelScheduledValues(t); a.gain.gain.setValueAtTime(a.gain.gain.value, t); a.gain.gain.linearRampToValueAtTime(0, t + 2); a.src.stop(t + 2.1); } catch (_) {}
    }
  }
  for (const k of wantAmb) {
    if (amb[k]) continue;
    amb[k] = { pending: true };
    load('amb:' + k).then((buf) => {
      if (!buf || !wantAmb.has(k)) { if (amb[k] && amb[k].pending) delete amb[k]; return; }
      const e = AMB[k];
      const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
      src.loopStart = Math.min(e.loopStart || 0, buf.duration - 0.1); src.loopEnd = Math.min(e.loopEnd || buf.duration, buf.duration);
      const g = ctx.createGain(); const t1 = ctx.currentTime;
      g.gain.setValueAtTime(0, t1); g.gain.linearRampToValueAtTime(e.vol != null ? e.vol : 0.5, t1 + 2.5);
      src.connect(g); g.connect(ambBus); src.start(t1, Math.random() * Math.max(0, (e.loopEnd || buf.duration) - 1));
      amb[k] = { src, gain: g };
    });
  }
}

function moodFor(e) { return e && e.time === 'night' ? 'night' : e && e.time === 'cave' ? 'cave' : 'day'; }

function updateAmbience() {
  if (!audio.auto.ambience) return;
  if (!inLevel) { ambience([]); return; }
  if (env.time === 'cave') { ambience(AMB.cave ? ['cave'] : []); return; }   // 洞窟：只有洞窟環境音（沒有海浪）
  const k = ['sea'];
  if (env.weather === 'rain') k.push('rain');
  if (env.time === 'night') k.push('night');
  ambience(k);
}

// env 事件（遊戲中換時段／天氣）
function applyEnv(e) {
  if (!e) return;
  env = { time: e.time || env.time, weather: e.weather || env.weather };
  if (!inLevel) { envFresh = true; return; }   // 進關前先設定：等 music() 進關時才開始
  updateAmbience();
  if (audio.auto.music && !bossActive && (curMood === 'day' || curMood === 'night' || curMood === 'cave')) music(moodFor(env));
}

// 公開的 setEnv：整合者在 startLevel 呼叫一次＝新的一局開始（同時清掉上一局的雷射迴圈等狀態）
function setEnv(e) {
  if (!e) return;
  stopLoops();
  enemyType.clear(); towerInfo.clear();
  applyEnv(e);
}

function leaveLevel() {
  bossActive = false; inLevel = false; envFresh = false;
  stopLoops();
  if (audio.auto.music) music(null);
  ambience([]);
}

// ---------- 稜鏡雷射迴圈（v2.0） ----------
// laserOn／laserOff 依塔 id 開關；同時最多 LASER_MAX 道有聲音（多的排隊），音量依數量 1/√n 壓低
function laserVoiceStart(id, slot, gainTo) {
  const buf = buffers.get('sfx:laserLoop');
  if (!buf) { load('sfx:laserLoop').then((b) => { if (b) refreshLasers(); }); return null; }
  const e = SFX.laserLoop || {};
  const t = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = buf; src.loop = true;
  const ls = Math.min(e.loopStart || 0, buf.duration - 0.1), le = Math.min(e.loopEnd || buf.duration, buf.duration);
  src.loopStart = ls; src.loopEnd = le;
  // 鎖定越久越強：3 秒內音高慢慢往上
  const r = LASER_RATES[slot % LASER_RATES.length];
  try { src.playbackRate.setValueAtTime(r * 0.94, t); src.playbackRate.linearRampToValueAtTime(r * 1.06, t + 3); } catch (_) { src.playbackRate.value = r; }
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gainTo, t + 0.09);
  let out = g;
  const ti = towerInfo.get(id);
  if (spatialFn && ti && ctx.createStereoPanner) {
    try { const s = spatialFn(ti.x, ti.z) || {}; if (s.pan) { const p = ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, s.pan)); g.connect(p); out = p; } } catch (_) {}
  }
  src.connect(g); out.connect(loopBus);
  src.start(t, ls + Math.random() * Math.max(0, le - ls - 0.05));
  liveLaserSrc++;
  src.onended = () => { liveLaserSrc = Math.max(0, liveLaserSrc - 1); };
  return { src, gain: g, out, slot };
}

function laserVoiceStop(v, sec = 0.12) {
  if (!v) return;
  try {
    const t = ctx.currentTime;
    v.gain.gain.cancelScheduledValues(t); v.gain.gain.setValueAtTime(v.gain.gain.value, t);
    v.gain.gain.linearRampToValueAtTime(0, t + sec);
    v.src.stop(t + sec + 0.03);
  } catch (_) {}
  setTimeout(() => { try { v.src.disconnect(); v.gain.disconnect(); if (v.out !== v.gain) v.out.disconnect(); } catch (_) {} }, (sec + 0.3) * 1000);
}

function refreshLasers() {
  if (!ctx) return;
  const n = Math.min(lasers.size, LASER_MAX);
  if (!n) return;
  const per = ((DEF.laserLoop && DEF.laserLoop.vol) || 0.5) / Math.sqrt(n);
  const used = new Set();
  for (const L of lasers.values()) if (L.voice) used.add(L.voice.slot);
  let active = used.size;
  for (const [id, L] of lasers) {
    if (L.voice || active >= LASER_MAX) continue;
    let slot = 0; while (used.has(slot)) slot++;
    const v = laserVoiceStart(id, slot, per);
    if (!v) return;            // 還沒載入：載好後會再呼叫
    L.voice = v; used.add(slot); active++;
  }
  const t = ctx.currentTime;
  for (const L of lasers.values()) {
    if (!L.voice) continue;
    try { L.voice.gain.gain.cancelScheduledValues(t); L.voice.gain.gain.setValueAtTime(L.voice.gain.gain.value, t); L.voice.gain.gain.linearRampToValueAtTime(per, t + 0.12); } catch (_) {}
  }
}

function laserOn(id) {
  if (id == null || !ensureCtx()) return;
  if (lasers.has(id)) return;                     // 重複的 laserOn 不理
  lasers.set(id, { voice: null, t: ctx.currentTime });
  const ti = towerInfo.get(id);
  play('laserStart', ti ? { x: ti.x, z: ti.z } : {});
  refreshLasers();
}

function laserOff(id) {
  const L = lasers.get(id);
  if (!L) return;
  lasers.delete(id);
  if (L.voice) laserVoiceStop(L.voice);
  refreshLasers();                                // 排隊中的雷射補上、音量重新分配
}

function stopLoops() {
  for (const L of lasers.values()) if (L.voice) laserVoiceStop(L.voice, 0.08);
  lasers.clear();
}

function setPaused(p) {
  loopsPaused = !!p;
  if (!loopBus) return;
  try { loopBus.gain.setTargetAtTime(loopsPaused ? 0 : 1, ctx.currentTime, 0.04); } catch (_) {}
}

function setHero(t) { if (t === 'knight' || t === 'fairy' || t === 'mage') heroType = t; }

// ---------- 事件對應 ----------
function deathSound(type) {
  switch (type) {
    case 'slime': return ['slimePop', 1];
    case 'slimelet': return ['slimePop', 1.3];
    case 'splitter': return ['slimePop', 0.85];
    case 'skeleton': return ['bones', 1];
    case 'gargoyle': return ['crumble', 1.1];
    case 'golem': return ['golemDeath', 1];
    case 'bat': return ['bat', 1];
    case 'slimeKing': case 'nightLord': return ['bossDeath', type === 'slimeKing' ? 1.1 : 0.92];
    // 第二章
    case 'ghost': return ['ghostDeath', 1];
    case 'mole': return ['moleDeath', 1];
    case 'inkBat': return ['bat', 0.85];
    case 'moleKing': return ['bossDeath', 1.05];
    case 'abyssWorm': return ['bossDeath', 0.8];
    default: return ['death', 1];
  }
}

const isDigBoss = (type) => type === 'moleKing' || type === 'abyssWorm';
const HERO_KINDS = new Set(['fairyBolt', 'fireball', 'starBolt', ...Object.keys(HERO_SKILL_SND)]);

function handleEvent(ev) {
  if (!ev || !ev.type || !ensureCtx()) return;
  const pos = ev.x != null ? { x: ev.x, z: ev.z } : {};
  switch (ev.type) {
    case 'spawn': {
      if (ev.id != null) enemyType.set(ev.id, ev.enemy);
      if (BOSS_TYPES.has(ev.enemy)) {
        if (ev.enemy === 'moleKing') play('moleKingRoar', {});
        else if (ev.enemy === 'abyssWorm') { play('wormRoar', {}); play('quake', { vol: 0.7 }); }
        else play('bossRoar', { rate: ev.enemy === 'slimeKing' ? 1.12 : 0.9, force: false });
        if (audio.auto.music) { bossActive = true; music(env.time === 'cave' ? 'caveBoss' : 'boss'); }
      } else if (ev.enemy === 'golem') play('golemStep', { ...pos });
      else if (ev.enemy === 'ghost') play('spawn', { ...pos, rate: 1.25, vol: 0.7 });
      else play('spawn', { ...pos, rate: ev.enemy === 'bat' || ev.enemy === 'inkBat' ? 1.4 : ev.enemy === 'mole' ? 0.85 : 1 });
      break;
    }
    case 'death': {
      const type = ev.enemy || enemyType.get(ev.id);
      enemyType.delete(ev.id);
      const [snd, r] = deathSound(type);
      play(snd, { rate: r, ...pos });
      if (type === 'abyssWorm') play('quake', { delay: 0.3 });
      // 金幣聲由緊接著的 gold 事件負責
      if (BOSS_TYPES.has(type) && audio.auto.music) { bossActive = false; music(moodFor(env)); }
      break;
    }
    case 'leak': {
      const boss = BOSS_TYPES.has(ev.enemy);
      enemyType.delete(ev.id);
      play('leak', { rate: boss ? 0.85 : 1, vol: boss ? 1.25 : 1, force: boss });
      break;
    }
    case 'shoot': {
      const k = ev.kind;
      if (k === 'arrow') play('arrow', pos);
      else if (k === 'bolt') play('bolt', pos);
      else if (k === 'rock') play('catapult', pos);
      else if (k === 'boulder') play('catapult', { ...pos, rate: 0.82, vol: 1.15 });
      else if (k === 'firebomb') play('catapult', { ...pos, rate: 1.08 });
      else if (k === 'orb') play('orb', pos);
      else if (k === 'frost') play('frostShot', pos);
      else if (k === 'lightning') { /* 由 beam 事件負責 */ }
      else if (k === 'laser' || k === 'prism') { /* 由 laserOn／laserOff 迴圈負責 */ }
      else if (HERO_KINDS.has(k)) { /* 英雄出手由 heroAttack／heroSkill 負責 */ }
      else play('arrow', pos);
      break;
    }
    case 'hit': {
      const k = ev.kind;
      if (k === 'rock' || k === 'boulder' || k === 'firebomb' || k === 'meteor' || k === 'lightning') break; // 由 explode／beam 負責
      if (k === 'laser' || k === 'prism') break;                                  // 雷射的持續傷害由迴圈代表
      if (k === 'fairyBolt' || k === 'starBolt') { play('sparkHit', pos); break; }
      if (k === 'fireball') { play('fireballHit', pos); break; }                  // 與 explode{kind:'fireball'} 同名，限頻自動去重
      if (HERO_SKILL_SND[k] && ev.dmgType === 'magic') { play('hitMagic', { ...pos, vol: 0.7 }); break; }
      if (k === 'frost') { play('iceCrack', { ...pos, vol: 0.8 }); break; }
      if (ev.dmgType === 'magic' || k === 'orb') { play('hitMagic', pos); break; }
      const type = enemyType.get(ev.targetId);
      if (ARMORED.has(type)) play('hitArmor', { ...pos, rate: type === 'golem' ? 0.8 : 1 });
      else play('hitFlesh', { ...pos, rate: type && type.startsWith('slime') ? 1.15 : 1 });
      break;
    }
    case 'explode': {
      const k = ev.kind;
      if (k === 'meteor') play('meteorImpact', pos);
      else if (k === 'fire') play('fire', pos);
      else if (k === 'boulder') play('explosion', { ...pos, rate: 0.8, vol: 1.15 });
      else if (k === 'fireball') play('fireballHit', pos);
      else if (HERO_SKILL_SND[k]) { /* 英雄技能的爆炸已包含在 heroSkill 音效裡 */ }
      else play('explosion', pos);
      break;
    }
    case 'beam': if (ev.kind === 'laser' || ev.kind === 'prism') break; play('lightning', ev.points && ev.points[0] ? { x: ev.points[0].x, z: ev.points[0].z } : {}); break;
    case 'pulse': {
      if (ev.kind !== 'vines' && ev.kind !== 'thorns' && ev.kind !== 'roots' && ev.kind != null) break;   // 其他種類（例如英雄技能）不出藤蔓聲
      const r = ev.kind === 'thorns' ? 1.15 : ev.kind === 'roots' ? 0.88 : 1;
      play('vines', { ...pos, rate: r });
      break;
    }
    case 'status': {
      // shield 由 aura 事件負責（一次施放只響一聲）；slow／root／stun 由塔本身的聲音代表
      if (ev.kind === 'freeze') play('iceCrack', {});
      else if (ev.kind === 'burn') play('ignite', {});
      break;
    }
    case 'aura': play('shield', { ...pos, vol: ev.any === false ? 0.5 : 1 }); break;
    case 'shieldBreak': play('shieldBreak', {}); break;
    case 'split': play('slimePop', { ...pos, rate: 1.2, vol: 0.7 }); break;
    case 'summon': {
      // 地鼠王叫出地鼠：從地底冒出來，不用暗黑召喚聲
      if (ev.enemy === 'mole' || isDigBoss(enemyType.get(ev.id))) { play('emerge', { ...pos, rate: 0.9 }); play('quake', { ...pos, vol: 0.55 }); }
      else play('summon', pos);
      break;
    }
    case 'dim': play('dim', pos); break;
    case 'build': {
      // 塔種在 towerType（A 的實作；合約原寫 type，但 type 被事件名稱佔用）
      const tt = ev.towerType || ev.tower;
      if (ev.towerId != null) towerInfo.set(ev.towerId, { type: tt, x: ev.x, z: ev.z });
      if (tt === 'lantern') { play('lanternLight', pos); break; }        // 燈籠：放下＋點火（不另外播 build）
      play('build', { rate: tt === 'archer' ? 1.08 : tt === 'catapult' ? 0.9 : tt === 'treant' ? 0.95 : 1 });
      if (tt === 'mage') play('hitMagic', { delay: 0.18, vol: 0.6 });
      else if (tt === 'treant') play('vines', { delay: 0.12, vol: 0.45 });
      else if (tt === 'prism') play('crystal', { delay: 0.16, vol: 0.8 });
      break;
    }
    case 'upgrade': {
      play('upgrade', { rate: ev.branch ? 0.94 : 1 }); if (ev.branch) play('star', { delay: 0.35, vol: 0.5 });
      const ti = towerInfo.get(ev.towerId);
      if (ti && ti.type === 'lantern') play('lanternOn', { delay: 0.3, vol: 0.7 });
      else if (ti && ti.type === 'prism') play('crystal', { delay: 0.25, vol: 0.5 });
      break;
    }
    case 'sell': play('sell', {}); lastSell = now(); laserOff(ev.towerId); towerInfo.delete(ev.towerId); break;
    case 'gold': {
      if (now() - lastSell < 0.05) break;              // 賣塔：sell 音效本身就有錢幣聲
      if (ev.early) { play('coin', { force: true }); play('coin', { delay: 0.09, rate: 1.12, force: true }); }
      else play('coin', { ...pos, vol: 0.55, delay: 0.05 });
      break;
    }
    case 'waveStart': {
      play('waveStart', { rate: ev.boss ? 0.89 : 1, force: true });
      // 王的吼聲在王真正出場（spawn）時才播
      if (ev.boss && audio.auto.music) { bossActive = true; music('boss'); }
      break;
    }
    case 'waveCleared': play('waveCleared', {}); break;
    case 'env': applyEnv(ev); break;
    case 'heroAttack': {
      // v2.0：attack＝'sword'（騎士，第一章原音）／'bolt'（妖精光彈）／'fireball'（法師火球出手；爆開由 hit／explode 負責）
      if (ATTACK_HERO[ev.attack]) heroType = ATTACK_HERO[ev.attack];
      if (ev.attack === 'bolt') play('fairyBolt', pos);
      else if (ev.attack === 'fireball') play('fireballCast', pos);
      else play('swordSwing', {});
      break;
    }
    case 'heroSkill': {
      if (ev.hero) setHero(ev.hero);
      const snd = HERO_SKILL_SND[ev.skill];
      if (snd) play(snd, ev.x != null ? pos : {});
      break;
    }
    case 'heroHurt': play((ev.hero || heroType) === 'fairy' ? 'fairyHurt' : 'heroHurt', {}); break;
    case 'heroDeath': play((ev.hero || heroType) === 'fairy' ? 'fairyDeath' : 'heroDeath', {}); break;
    case 'heroRespawn': play('heroRespawn', {}); break;
    case 'heroLevel': play('levelUp', {}); break;
    case 'skill': {
      if (ev.id === 'meteor') play('meteorFall', pos);
      else if (ev.id === 'freeze') play('freeze', {});
      break;
    }
    // ===== 第二章（v2.0）=====
    case 'lanternOut': play('lanternOut', pos); break;
    case 'lanternOn': play('lanternOn', pos); break;
    case 'ink': play('ink', pos); break;
    case 'laserOn': laserOn(ev.towerId); break;
    case 'laserOff': laserOff(ev.towerId); break;
    case 'burrow': case 'emerge': {
      const type = ev.enemy || enemyType.get(ev.id);
      if (isDigBoss(type)) {
        play(ev.type, { ...pos, rate: type === 'abyssWorm' ? 0.6 : 0.72, vol: 1.3, force: true });
        play('quake', { ...pos, vol: ev.type === 'emerge' ? 1 : 0.75 });
      } else play(ev.type, pos);
      break;
    }
    case 'reveal': play('reveal', pos); break;
    case 'segment': play('segment', { ...pos, rate: 1 + Math.max(0, 5 - (ev.left != null ? ev.left : 3)) * 0.04 }); break;
    case 'eat': play('eat', pos); laserOff(ev.towerId); towerInfo.delete(ev.towerId); break;
    case 'won': leaveLevel(); play('victory', { delay: 0.25, force: true }); break;
    case 'lost': leaveLevel(); play('defeat', { delay: 0.25, force: true }); break;
    default: break;
  }
}

// ---------- 解鎖（iOS 需在使用者手勢中呼叫） ----------
function unlock() {
  if (!ensureCtx()) return;
  try {
    if (ctx.state !== 'running') { const p = ctx.resume(); if (p && p.catch) p.catch(() => {}); }
    const b = ctx.createBuffer(1, 1, 22050);
    const s = ctx.createBufferSource(); s.buffer = b; s.connect(ctx.destination); s.start(0);
  } catch (_) {}
  unlocked = true;
  startPreload();
}

function init() {
  if (initDone) return audio;
  initDone = true;
  if (!ensureCtx()) return audio;
  startPreload();
  if (typeof document !== 'undefined') {
    // 保險：任何手勢都順便解鎖／恢復（iOS 從背景回來時可能是 interrupted）
    const g = () => { if (ctx && ctx.state !== 'running') unlock(); };
    ['touchend', 'pointerdown', 'mousedown', 'keydown', 'click'].forEach((t) =>
      document.addEventListener(t, g, { capture: true, passive: true }));
    document.addEventListener('visibilitychange', () => {
      try {
        if (document.hidden) { if (ctx.state === 'running') ctx.suspend(); }
        else if (unlocked) { const p = ctx.resume(); if (p && p.catch) p.catch(() => {}); }
      } catch (_) {}
    });
  }
  return audio;
}

function setVolume(v = {}) {
  if (v.music !== undefined) vol.music = volValue(v.music, vol.music);
  if (v.sfx !== undefined) vol.sfx = volValue(v.sfx, vol.sfx);
  applyVolume();
}

function playStars(n, opts = {}) {
  const gap = opts.gap || 0.38;
  for (let i = 0; i < (n | 0); i++) play('star', { delay: (opts.delay || 0) + i * gap, rate: 1 + i * 0.125, force: true });
}

function stats() {
  return {
    state: ctx ? ctx.state : 'none',
    loaded: [...buffers.keys()], failed: [...failed], loading: [...loading.keys()],
    music: curMusic ? curMusic.mood : null, ambience: Object.keys(amb),
    voices: prune(activeVoices, now()).length, vol: { ...vol },
    played: nPlayed, skipped: nSkipped, inLevel, env: { ...env }, boss: bossActive,
    lasers: lasers.size, laserVoices: [...lasers.values()].filter((L) => L.voice).length, laserSources: liveLaserSrc, loopsPaused, hero: heroType,
  };
}

async function loadAll() {
  if (!ensureCtx()) return stats();
  const keys = [...Object.keys(SFX).map((k) => 'sfx:' + k), ...Object.keys(MUSIC).map((k) => 'music:' + k), ...Object.keys(AMB).map((k) => 'amb:' + k)];
  await loadQueue(keys, 4);
  return stats();
}

export const audio = {
  init: safe(init),
  unlock: safe(unlock),
  play: safe(play),
  music: safe(music),
  setVolume: safe(setVolume),
  handleEvent: safe(handleEvent),
  // 擴充（非合約必要）
  setEnv: safe(setEnv),
  ambience: safe(ambience),
  playStars: safe(playStars),
  setSpatial: safe((fn) => { spatialFn = typeof fn === 'function' ? fn : null; }),
  holdPreload: safe(holdPreload),
  // v2.0
  setHero: safe(setHero),
  setPaused: safe(setPaused),
  stopLoops: safe(stopLoops),
  mute: safe((m) => { muted = !!m; if (master) master.gain.setTargetAtTime(muted ? 0 : 1, ctx.currentTime, 0.05); }),
  moodFor,
  stats: safe(stats),
  loadAll: safe(loadAll),
  get context() { return ctx; },
  auto: { music: true, ambience: true },
  names: Object.keys(SFX),
};
export default audio;
