// 地圖解析與尋路（純邏輯）。字元表見 架構.md §3。
// 格 (c, r) 的索引 i = r*W + c；中心 (c+0.5, r+0.5)。

export const ENEMY_WALK = '=BoSL';      // 敵人可走（o 上有塔就不可走）
export const BUILDABLE = '#o';          // 可蓋塔
export const HERO_LAND = '.,=BoS';      // 英雄可走（不含海、裝飾、塔基座、燈、有塔的格）

const SQRT2 = Math.SQRT2;
// 先 4 個正交方向，再 4 個斜向（平手時偏好正交）
export const NB_DC = [1, -1, 0, 0, 1, 1, -1, -1];
export const NB_DR = [0, 0, 1, -1, 1, -1, 1, -1];

export function parseMap(levelDef) {
  const grid = levelDef && levelDef.grid;
  if (!Array.isArray(grid) || grid.length === 0) throw new Error('關卡缺少 grid');
  const H = grid.length, W = grid[0].length;
  for (let r = 0; r < H; r++) {
    if (typeof grid[r] !== 'string' || grid[r].length !== W) throw new Error(`grid 第 ${r} 列長度 ${grid[r] && grid[r].length} ≠ ${W}`);
  }
  const N = W * H;
  const chars = new Array(N);
  const walkBase = new Uint8Array(N), buildable = new Uint8Array(N), heroBase = new Uint8Array(N);
  const spawns = [];
  let lamp = -1;
  for (let r = 0; r < H; r++) {
    for (let c = 0; c < W; c++) {
      const ch = grid[r][c], i = r * W + c;
      chars[i] = ch;
      if (ENEMY_WALK.includes(ch)) walkBase[i] = 1;
      if (BUILDABLE.includes(ch)) buildable[i] = 1;
      if (HERO_LAND.includes(ch)) heroBase[i] = 1;
      if (ch === 'S') spawns.push({ index: spawns.length, c, r, x: c + 0.5, z: r + 0.5, i });
      if (ch === 'L') {
        if (lamp >= 0) throw new Error('地圖有超過 1 個守護燈 L');
        lamp = i;
      }
    }
  }
  if (lamp < 0) throw new Error('地圖沒有守護燈 L');
  if (spawns.length === 0) throw new Error('地圖沒有出生點 S');
  const lc = lamp % W, lr = (lamp - lc) / W;
  return { W, H, N, grid: grid.slice(), chars, walkBase, buildable, heroBase, spawns, lamp, lampC: lc, lampR: lr, lampX: lc + 0.5, lampZ: lr + 0.5 };
}

export function cellAt(map, x, z) {
  let c = Math.floor(x), r = Math.floor(z);
  if (c < 0) c = 0; else if (c >= map.W) c = map.W - 1;
  if (r < 0) r = 0; else if (r >= map.H) r = map.H - 1;
  return r * map.W + c;
}

// 簡單的二元堆積（允許重複，取出時忽略過期項）
export class MinHeap {
  constructor(cap = 64) { this.k = new Float64Array(cap); this.v = new Int32Array(cap); this.n = 0; }
  clear() { this.n = 0; }
  push(key, val) {
    if (this.n >= this.k.length) {
      const k2 = new Float64Array(this.k.length * 2); k2.set(this.k); this.k = k2;
      const v2 = new Int32Array(this.v.length * 2); v2.set(this.v); this.v = v2;
    }
    const K = this.k, V = this.v;
    let i = this.n++;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (K[p] <= key) break;
      K[i] = K[p]; V[i] = V[p]; i = p;
    }
    K[i] = key; V[i] = val;
  }
  pop() {
    const K = this.k, V = this.v;
    const topV = V[0]; this.topKey = K[0];
    const n = --this.n;
    if (n > 0) {
      const key = K[n], val = V[n];
      let i = 0;
      for (;;) {
        let l = 2 * i + 1;
        if (l >= n) break;
        const r = l + 1;
        if (r < n && K[r] < K[l]) l = r;
        if (K[l] >= key) break;
        K[i] = K[l]; V[i] = V[l]; i = l;
      }
      K[i] = key; V[i] = val;
    }
    return topV;
  }
}

// 8 連通 Dijkstra（斜走需要兩個正交格都可走，避免切角）。parent 可省略。
export function dijkstra(W, H, walk, src, dist, heap, parent) {
  dist.fill(Infinity);
  if (parent) parent.fill(-1);
  dist[src] = 0;
  heap.clear(); heap.push(0, src);
  while (heap.n > 0) {
    const i = heap.pop(); const d = heap.topKey;
    if (d > dist[i] + 1e-4) continue; // dist 可能是 Float32Array，要留容差
    const c = i % W, r = (i - c) / W;
    for (let k = 0; k < 8; k++) {
      const nc = c + NB_DC[k], nr = r + NB_DR[k];
      if (nc < 0 || nr < 0 || nc >= W || nr >= H) continue;
      const j = nr * W + nc;
      if (!walk[j]) continue;
      if (k >= 4 && (!walk[r * W + nc] || !walk[nr * W + c])) continue;
      const nd = d + (k >= 4 ? SQRT2 : 1);
      if (nd < dist[j] - 1e-5) { dist[j] = nd; if (parent) parent[j] = i; heap.push(nd, j); }
    }
  }
}

// 從 i 往 dist 較小的方向走一步（偏好正交）；回傳鄰格索引或 -1
export function descend(W, H, walk, dist, i) {
  const c = i % W, r = (i - c) / W;
  let best = -1, bestD = Infinity;
  for (let k = 0; k < 8; k++) {
    const nc = c + NB_DC[k], nr = r + NB_DR[k];
    if (nc < 0 || nr < 0 || nc >= W || nr >= H) continue;
    const j = nr * W + nc;
    if (!walk[j] || !(dist[j] < dist[i])) continue;
    if (k >= 4 && (!walk[r * W + nc] || !walk[nr * W + c])) continue;
    const cand = dist[j] + (k >= 4 ? SQRT2 : 1);
    if (cand < bestD - 1e-6) { best = j; bestD = cand; }
  }
  return best;
}

// 地面敵人流場：從燈做 Dijkstra，每格記下一步 next[i]、沿路側向單位向量 perp
export class Pathing {
  constructor(map) {
    this.map = map;
    const N = map.N;
    this.walk = new Uint8Array(map.walkBase);
    this.dist = new Float32Array(N);
    this.next = new Int32Array(N);
    this.perpX = new Float32Array(N);
    this.perpZ = new Float32Array(N);
    this.heap = new MinHeap(N * 4 + 16);
    this.queue = new Int32Array(N);
    this.seen = new Uint8Array(N);
    this.version = 0;
    this._paths = null;
    this.recompute();
  }
  setBlocked(i, blocked) { this.walk[i] = blocked ? 0 : this.map.walkBase[i]; }
  recompute() {
    const { W, H, N, lamp } = this.map;
    const { walk, dist, next, perpX, perpZ } = this;
    // dist 用 Float32Array；dijkstra 內 fill(Infinity) 可用
    dijkstra(W, H, walk, lamp, dist, this.heap, null);
    for (let i = 0; i < N; i++) {
      next[i] = -1; perpX[i] = 0; perpZ[i] = 0;
      if (!walk[i] || i === lamp || !(dist[i] < Infinity)) continue;
      const j = descend(W, H, walk, dist, i);
      next[i] = j;
      if (j >= 0) {
        const ci = i % W, ri = (i - ci) / W, cj = j % W, rj = (j - cj) / W;
        let dx = cj - ci, dz = rj - ri; const l = Math.hypot(dx, dz); dx /= l; dz /= l;
        perpX[i] = -dz; perpZ[i] = dx;
      }
    }
    this.version++;
    this._paths = null;
  }
  reachable(i) { return this.dist[i] < Infinity; }
  // 4 連通可達性：再額外封住 extra 格後，cells 裡每一格是否都能走到燈
  reachableAll(extra, cells) {
    const { W, H, lamp } = this.map;
    const walk = this.walk, seen = this.seen, q = this.queue;
    seen.fill(0);
    let head = 0, tail = 0;
    q[tail++] = lamp; seen[lamp] = 1;
    while (head < tail) {
      const i = q[head++];
      const c = i % W, r = (i - c) / W;
      if (c > 0) { const j = i - 1; if (!seen[j] && walk[j] && j !== extra) { seen[j] = 1; q[tail++] = j; } }
      if (c < W - 1) { const j = i + 1; if (!seen[j] && walk[j] && j !== extra) { seen[j] = 1; q[tail++] = j; } }
      if (r > 0) { const j = i - W; if (!seen[j] && walk[j] && j !== extra) { seen[j] = 1; q[tail++] = j; } }
      if (r < H - 1) { const j = i + W; if (!seen[j] && walk[j] && j !== extra) { seen[j] = 1; q[tail++] = j; } }
    }
    for (let k = 0; k < cells.length; k++) if (!seen[cells[k]]) return false;
    return true;
  }
  // 從某格沿流場走到燈，回傳格子中心點陣列
  pathFrom(i) {
    const { W, lamp } = this.map;
    const pts = [];
    let guard = this.map.N + 2;
    while (i >= 0 && guard-- > 0) {
      const c = i % W, r = (i - c) / W;
      pts.push({ x: c + 0.5, z: r + 0.5 });
      if (i === lamp) break;
      i = this.next[i];
    }
    return pts;
  }
  paths() {
    if (!this._paths) this._paths = this.map.spawns.map((s) => this.pathFrom(s.i));
    return this._paths;
  }
}
