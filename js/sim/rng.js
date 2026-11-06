// 可重現的固定亂數（mulberry32）。同一個 seed 永遠得到同一串數字。
export function makeRng(seed = 1) {
  let s = (Number(seed) >>> 0) || 0x9e3779b9;
  return function rng() {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
