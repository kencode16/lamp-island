// 敵人空間分格：每格 1×1（與地圖格相同），每幀重建一次（計數排序，不配置新物件）。
export const Q_GROUND = 1, Q_AIR = 2, Q_TOWER = 4, Q_VISIBLE = 8;
export class SpatialGrid {
  constructor(W, H) {
    this.W = W; this.H = H;
    const N = W * H;
    this.start = new Int32Array(N + 1);
    this.fill = new Int32Array(N);
    this.items = [];
    this.n = 0;
  }
  rebuild(list) {
    const { W, H, start, fill } = this;
    const N = W * H;
    start.fill(0);
    let n = 0;
    for (let k = 0; k < list.length; k++) {
      const e = list[k];
      if (e.dead) { e._gi = -1; continue; }
      let c = Math.floor(e.x), r = Math.floor(e.z);
      if (c < 0) c = 0; else if (c >= W) c = W - 1;
      if (r < 0) r = 0; else if (r >= H) r = H - 1;
      const gi = r * W + c;
      e._gi = gi;
      start[gi + 1]++;
      n++;
    }
    for (let i = 0; i < N; i++) { start[i + 1] += start[i]; fill[i] = start[i]; }
    const items = this.items;
    while (items.length < n) items.push(null);
    for (let k = 0; k < list.length; k++) {
      const e = list[k];
      if (e._gi < 0) continue;
      items[fill[e._gi]++] = e;
    }
    for (let k = n; k < items.length && items[k] !== null; k++) items[k] = null;
    this.n = n;
  }
  // 把半徑 rad 內、還活著的敵人寫進 out[0..count)，回傳 count。
  // mode 低 2 位：0 全部、1 只要地面、2 只要飛行；
  //   ＋4（Q_TOWER）＝塔能鎖定的（e.lit 且不 hidden）；＋8（Q_VISIBLE）＝不要 hidden 的。潛地中（burrowed）的一律不回傳。
  query(x, z, rad, out, mode = 0) {
    const { W, H, start, items } = this;
    const air = mode & 3, needLit = (mode & 4) !== 0, noHidden = (mode & 8) !== 0;
    let c0 = Math.floor(x - rad), c1 = Math.floor(x + rad), r0 = Math.floor(z - rad), r1 = Math.floor(z + rad);
    if (c0 < 0) c0 = 0; if (r0 < 0) r0 = 0; if (c1 >= W) c1 = W - 1; if (r1 >= H) r1 = H - 1;
    const r2 = rad * rad;
    let n = 0;
    for (let rr = r0; rr <= r1; rr++) {
      let gi = rr * W + c0;
      for (let cc = c0; cc <= c1; cc++, gi++) {
        const s = start[gi], e2 = start[gi + 1];
        for (let k = s; k < e2; k++) {
          const e = items[k];
          if (e.dead || e.burrowed) continue;
          if (air === 1 ? e.flying : air === 2 ? !e.flying : false) continue;
          if (needLit ? (!e.lit || e.hidden) : (noHidden && e.hidden)) continue;
          const dx = e.x - x, dz = e.z - z;
          if (dx * dx + dz * dz <= r2) out[n++] = e;
        }
      }
    }
    return n;
  }
}
