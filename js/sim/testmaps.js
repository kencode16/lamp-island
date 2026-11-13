// 模擬核心自帶的小測試地圖（tests/test_sim.mjs 與 tests/autoplay.mjs 用；不依賴 levels.js）

const base = (extra) => Object.assign({ env: { time: 'day', weather: 'clear' }, startGold: 5000, lamp: 20, waves: [] }, extra);

// 直線道路、上下兩排塔基座
export const MAP_STRAIGHT = base({
  id: 99, name: '測試：直線',
  grid: [
    '~~~~~~~~~~~~~~~~',
    '~..............~',
    '~.#.#.#.#.#.#..~',
    '~S============L~',
    '~.#.#.#.#.#.#..~',
    '~..............~',
    '~~~~~~~~~~~~~~~~',
  ],
  heroStart: { c: 8, r: 1 },
});

// L 形轉角道路
export const MAP_CORNER = base({
  id: 99, name: '測試：轉角',
  grid: [
    '~~~~~~~~~~~~',
    '~S=====....~',
    '~.#..#=.#..~',
    '~.....=....~',
    '~..#..=..#.~',
    '~.....====L~',
    '~~~~~~~~~~~~',
  ],
  heroStart: { c: 8, r: 3 },
});

// 開放草地（可蓋塔擋路）
export const MAP_OPEN = base({
  id: 99, name: '測試：開放草地',
  grid: [
    '~~~~~~~~~~~~',
    '~..........~',
    '~.oooooooo.~',
    '~Soooooooo=L',
    '~.oooooooo.~',
    '~..........~',
    '~~~~~~~~~~~~',
  ],
  heroStart: { c: 5, r: 1 },
});

// 道路旁有一個死巷口袋（測「場上敵人所在格仍能到燈」）
export const MAP_POCKET = base({
  id: 99, name: '測試：口袋',
  grid: [
    '~~~~~~~~~',
    '~~~o~~~~~',
    '~~~o~~~~~',
    '~S=====L~',
    '~.......~',
    '~~~~~~~~~',
  ],
  heroStart: { c: 4, r: 4 },
});

// 兩個出生點
export const MAP_TWO = base({
  id: 99, name: '測試：雙入口',
  grid: [
    '~~~~~~~~~~~~~~',
    '~S=====......~',
    '~.#...=..#...~',
    '~.....====L..~',
    '~.#...=..#...~',
    '~S=====......~',
    '~~~~~~~~~~~~~~',
  ],
  heroStart: { c: 8, r: 2 },
});

// 蛇形長路（效能測試、autoplay 備用）
export function snakeGrid(W = 24) {
  const rows = [1, 4, 7, 10, 13];
  const H = 15;
  const g = Array.from({ length: H }, () => Array(W).fill('.'));
  for (let r = 0; r < H; r++) { g[r][0] = '~'; g[r][W - 1] = '~'; }
  for (let c = 0; c < W; c++) { g[0][c] = '~'; g[H - 1][c] = '~'; }
  rows.forEach((r, k) => {
    for (let c = 1; c <= W - 2; c++) g[r][c] = '=';
    if (k < rows.length - 1) {
      const cc = k % 2 === 0 ? W - 2 : 1;
      for (let rr = r + 1; rr < rows[k + 1]; rr++) {
        for (let c = 2; c <= W - 3; c += 2) g[rr][c] = '#';
        g[rr][cc] = '=';
      }
    }
  });
  g[1][1] = 'S';
  g[13][W - 2] = 'L';
  return g.map((row) => row.join(''));
}

export const MAP_SNAKE = base({
  id: 99, name: '測試：蛇形',
  grid: snakeGrid(24),
  heroStart: { c: 12, r: 3 },
});

// autoplay 備用關卡（levels.js 不存在時）
export const DEMO_LEVELS = [
  base({
    id: 1, name: '測試關 A（直線）', startGold: 250, grid: MAP_STRAIGHT.grid, heroStart: MAP_STRAIGHT.heroStart,
    waves: [
      { groups: [{ enemy: 'slime', count: 8, interval: 1.2, spawn: 0 }] },
      { groups: [{ enemy: 'slime', count: 10, interval: 1.0, spawn: 0 }, { enemy: 'goblin', count: 4, interval: 1.2, spawn: 0, delay: 6 }] },
      { groups: [{ enemy: 'splitter', count: 6, interval: 1.5, spawn: 0 }, { enemy: 'bat', count: 6, interval: 0.6, spawn: 0, delay: 4 }] },
      { groups: [{ enemy: 'skeleton', count: 6, interval: 1.5, spawn: 0 }, { enemy: 'goblin', count: 8, interval: 0.8, spawn: 0, delay: 3 }] },
    ],
  }),
  base({
    id: 6, name: '測試關 B（蛇形）', startGold: 400, grid: MAP_SNAKE.grid, heroStart: MAP_SNAKE.heroStart,
    waves: [
      { groups: [{ enemy: 'slime', count: 15, interval: 0.8, spawn: 0 }] },
      { groups: [{ enemy: 'skeleton', count: 10, interval: 1.0, spawn: 0 }, { enemy: 'gargoyle', count: 4, interval: 2, spawn: 0, delay: 5 }] },
      { groups: [{ enemy: 'golem', count: 3, interval: 4, spawn: 0 }, { enemy: 'shaman', count: 3, interval: 3, spawn: 0, delay: 2 }, { enemy: 'goblin', count: 12, interval: 0.6, spawn: 0, delay: 1 }], env: { time: 'night' } },
      { groups: [{ enemy: 'slimeKing', count: 1, interval: 1, spawn: 0 }, { enemy: 'bat', count: 12, interval: 0.5, spawn: 0, delay: 6 }] },
    ],
  }),
];

// ===== 第二章測試地圖（洞窟、暗） =====
const cave = (extra) => base(Object.assign({ chapter: 2, theme: 'cave', dark: true, env: { time: 'cave', weather: 'clear' } }, extra));

// 直線洞窟：燈在右端（燈光 4.5 只照到右半段），左半段全黑；上下兩排石台、外面是洞窟地面
export const MAP_CAVE_LINE = cave({
  id: 99, name: '測試：洞窟直線',
  grid: [
    '~~~~~~~~~~~~~~~~~~~~',
    '~..................~',
    '~.#.#.#.#.#.#.#....~',
    '~S================L~',
    '~.#.#.#.#.#.#.#....~',
    '~..................~',
    '~~~~~~~~~~~~~~~~~~~~',
  ],
  heroStart: { c: 17, r: 5 },
});

// 光源測試：發光蘑菇 U、水晶 C（C 在燈光邊緣，再接一顆 C 中繼）
export const MAP_CAVE_LIGHTS = cave({
  id: 99, name: '測試：洞窟光源',
  grid: [
    '~~~~~~~~~~~~~~~~~~~~',
    '~...U..............~',
    '~.#.#.#.#.#.C.C....~',
    '~S================L~',
    '~.#.#.#.#.#.#.#....~',
    '~....X.Q...........~',
    '~~~~~~~~~~~~~~~~~~~~',
  ],
  heroStart: { c: 17, r: 5 },
});

// 洞窟開放地（燈籠放在 o 上也會擋路）
export const MAP_CAVE_OPEN = cave({
  id: 99, name: '測試：洞窟開放地',
  grid: [
    '~~~~~~~~~~~~',
    '~..........~',
    '~.oooooooo.~',
    '~Soooooooo=L',
    '~.oooooooo.~',
    '~..........~',
    '~~~~~~~~~~~~',
  ],
  heroStart: { c: 5, r: 1 },
});

// 蛇形洞窟（效能測試、autoplay 備用）：在草地格放一些發光蘑菇與水晶
export function caveSnakeGrid(W = 24) {
  const g = snakeGrid(W).map((row) => row.split(''));
  const put = (c, r, ch) => { if (g[r] && g[r][c] === '.') g[r][c] = ch; };
  [[5, 2], [15, 5], [9, 8], [19, 11], [3, 11]].forEach(([c, r]) => put(c, r, 'U'));
  [[11, 2], [13, 2], [7, 5], [17, 8], [11, 11]].forEach(([c, r]) => put(c, r, 'C'));
  [[1, 3], [22, 6], [1, 9], [22, 12]].forEach(([c, r]) => put(c, r, 'X'));
  return g.map((row) => row.join(''));
}

export const MAP_CAVE_SNAKE = cave({
  id: 99, name: '測試：洞窟蛇形',
  grid: caveSnakeGrid(24),
  heroStart: { c: 11, r: 3 },
});

// autoplay 用的洞窟示範關（F 的第 11–20 關還沒寫好時，用來驗證燈籠策略）
export const DEMO_CAVE_LEVELS = [
  cave({
    id: 11, name: '示範洞窟 A（直線）', startGold: 300, grid: MAP_CAVE_LINE.grid, heroStart: MAP_CAVE_LINE.heroStart,
    waves: [
      { groups: [{ enemy: 'slime', count: 8, interval: 1.2, spawn: 0 }], reward: 10 },
      { groups: [{ enemy: 'slime', count: 8, interval: 1.0, spawn: 0 }, { enemy: 'ghost', count: 4, interval: 1.5, spawn: 0, delay: 4 }], reward: 12 },
      { groups: [{ enemy: 'mole', count: 5, interval: 1.6, spawn: 0 }, { enemy: 'goblin', count: 6, interval: 0.9, spawn: 0, delay: 3 }], reward: 14 },
      { groups: [{ enemy: 'inkBat', count: 6, interval: 0.8, spawn: 0 }, { enemy: 'skeleton', count: 5, interval: 1.5, spawn: 0, delay: 2 }], reward: 16 },
      { groups: [{ enemy: 'ghost', count: 10, interval: 0.7, spawn: 0 }, { enemy: 'mole', count: 6, interval: 1.2, spawn: 0, delay: 4 }], reward: 18 },
    ],
  }),
  cave({
    id: 15, name: '示範洞窟 B（蛇形＋地鼠王）', startGold: 450, grid: MAP_CAVE_SNAKE.grid, heroStart: MAP_CAVE_SNAKE.heroStart,
    waves: [
      { groups: [{ enemy: 'slime', count: 12, interval: 0.9, spawn: 0 }], reward: 10 },
      { groups: [{ enemy: 'ghost', count: 8, interval: 1.0, spawn: 0 }, { enemy: 'goblin', count: 8, interval: 0.8, spawn: 0, delay: 5 }], reward: 14 },
      { groups: [{ enemy: 'mole', count: 8, interval: 1.2, spawn: 0 }, { enemy: 'inkBat', count: 6, interval: 0.8, spawn: 0, delay: 4 }], reward: 18 },
      { groups: [{ enemy: 'skeleton', count: 8, interval: 1.2, spawn: 0 }, { enemy: 'ghost', count: 10, interval: 0.7, spawn: 0, delay: 3 }], reward: 22 },
      { groups: [{ enemy: 'moleKing', count: 1, interval: 1, spawn: 0 }, { enemy: 'mole', count: 6, interval: 1.5, spawn: 0, delay: 6 }], reward: 30 },
    ],
  }),
  cave({
    id: 20, name: '示範洞窟 C（深淵巨蟲）', startGold: 700, grid: MAP_CAVE_SNAKE.grid, heroStart: MAP_CAVE_SNAKE.heroStart,
    waves: [
      { groups: [{ enemy: 'ghost', count: 12, interval: 0.8, spawn: 0 }], reward: 15 },
      { groups: [{ enemy: 'inkBat', count: 10, interval: 0.6, spawn: 0 }, { enemy: 'mole', count: 8, interval: 1.0, spawn: 0, delay: 4 }], reward: 20 },
      { groups: [{ enemy: 'skeleton', count: 10, interval: 1.0, spawn: 0 }, { enemy: 'shaman', count: 3, interval: 3, spawn: 0, delay: 3 }], reward: 25 },
      { groups: [{ enemy: 'abyssWorm', count: 1, interval: 1, spawn: 0 }, { enemy: 'ghost', count: 10, interval: 1.2, spawn: 0, delay: 8 }], reward: 30 },
    ],
  }),
];
