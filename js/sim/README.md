# 模擬核心 `js/sim/`（擁有者：A）

純邏輯，不 import three、不碰 DOM/window，Node 也能跑。合約見 `架構.md` §5；這裡記錄實作細節、**新增**的欄位／事件／函式，以及平衡公式。

## 檔案
| 檔案 | 內容 |
|---|---|
| `game.js` | `createGame`、全部指令、波次、技能、勝負；另匯出 `validateLevel`、`BAL` |
| `combat.js` | 敵人生成、傷害、死亡、漏怪、狀態（緩速／凍結／定身／暈眩／燃燒／護盾）、敵人 special、移動 |
| `towersim.js` | 塔數值（含天賦）、選目標、開火、投射物、連鎖閃電、樹靈脈衝、地帶（火焰／荊棘／流星標記） |
| `hero.js` | 守燈騎士：BFS 移動、守備點、攔截、攻擊、死亡復活、升級、回血 |
| `map.js` | 解析 grid、8 連通 Dijkstra 流場（斜走不切角）、4 連通防封路檢查 |
| `spatial.js` | 敵人空間分格（每幀計數排序重建，查詢不配置物件） |
| `mods.js` | 天賦 id → 修正值 |
| `balance.js` | 平衡常數（`BAL`） |
| `rng.js` | 固定亂數（mulberry32） |
| `testmaps.js` | 測試用小地圖、autoplay 備用關卡 |

測試：`/opt/anaconda3/envs/hermes3d/bin/node tests/test_sim.mjs`（37 項）。
自動試玩：`/opt/anaconda3/envs/hermes3d/bin/node tests/autoplay.mjs [--level=7] [--strategy=balanced|lazy|archer|rush] [--seeds=3] [--log]`

## API
```js
import { createGame, validateLevel } from './js/sim/game.js';
const game = createGame(levelDef, { talents: [], seed: 1, enemyHpMul: 1 });
```
- `opts.enemyHpMul`（新增）：所有敵人血量倍率，給調難度／測試用，預設 1。
- `levelDef.id` 決定解鎖（`unlock <= id`）；沒有 id＝全部解鎖。`startGold` 預設 200、`lamp` 預設 20。
- §5 的指令全部照合約。補充：
  - `callNextWave()`：prep 階段＝開始第 1 波，回傳 `0`；之後回傳拿到的獎勵（數字）；沒有下一波或已結束回傳 `false`。
  - `sell(id)` 回傳退款金額（數字）；`build` 回傳塔 id 或 `null`；`upgrade` 回傳 `true/false`。
  - `castSkill('freeze')` 不用座標；`castSkill('meteor', x, z)` 沒座標回傳 `false`。prep 階段也能放。
  - `moveHero(x, z)`：英雄死亡時呼叫＝改守備點（復活地點）。
  - 結束（won/lost）後所有指令回傳失敗、`step` 不再推進。
- **新增函式**：
  - `typeStats(type, level = 1, branch = null)` → 蓋塔前預覽（含天賦與夜晚效果）`{ name, damage, rate, range, dmgType, air, desc, splash, special, cost }`
  - `buildOptions(c, r)` → 蓋塔輪盤要的 `[{ type, name, icon, cost, ok, reason }]`（依 `TOWER_ORDER`）
  - `pickEnemy(x, z, radius = 0.6)` → 點選敵人（顯示資訊用）
  - `heroCanStand(c, r)` → 英雄能不能站這格
  - `validateLevel(levelDef)`（模組匯出）→ 問題字串陣列（缺燈、出生點走不到燈、heroStart 不可站、未知敵人、spawn 編號超出）
  - `game._G`：內部狀態，**只給測試／除錯**，畫面不要依賴。

## state 補充（合約欄位都有；以下是新增或說明）
- `state.grid`：原本的字串陣列（複本）。另有 `state.spawns: [{ index, c, r, x, z }]`、`state.lampPos: { c, r, x, z }`、`state.levelId`、`state.waveSpawning`（還有怪沒出完）。
- `state.waveIndex`＝已開始的波數（1 起算的「第幾波」）；**事件 `waveStart.index`／`waveCleared.index` 是 0 起算**（另附 `number`＝第幾波），與 main.js 的 `ev.index + 1` 一致。
- `nextWaveIn`＝最近一波剩餘出怪時間＋它的 `gap`（出完後就是 gap 倒數）。prep 階段、最後一波開始後為 `null`。
- `towers[]`：`range` 是實際射程（天賦×夜晚×熄光）；`dimmed` 布林。內部欄位：`st`（目前數值）、`cd`、`target`、`dimT`…
- `enemies[]`：`frozen/rooted/stunned/burning` 都是**剩餘秒數**（>0 表示生效）；`slow` 是目前緩速比例；`shield` 目前護盾（`shieldMax` 新增）。`moving` 是這一幀有沒有移動；`blocked` 被英雄擋住。內部欄位：`def`、`speed`（基礎速度）、`remain`（到燈的剩餘路程，塔用它選目標）、`cell`、`tc`、`dead`…
- `projectiles[]`：`{ id, kind, x, y, z, vx, vy, vz }`＋內部 `targetId`、`towerId`…；`kind` 只會是 `arrow bolt rock boulder firebomb orb frost`（連鎖閃電是瞬間的 `beam` 事件，沒有投射物）。
- `zones[]`：`fire`（燃燒彈，ttl 3 秒）、`thorns`（荊棘林分支存在期間一直有，`ttl` 固定 9999、半徑跟著塔射程，賣塔就消失）、`meteorMark`（流星雨落下前 `delay` 秒）。
- `hero`：新增 `postX/postZ`（守備點，可畫旗子）、`damage`（目前攻擊力）、`blocking`（正在擋幾隻）。`target` 是敵人 id。`xpNext` 滿級時為 `null`。

## 事件（全部欄位）
合約列的全部都有；`build` 的塔種不能放在 `type`（被事件名稱佔用），所以放在 **`towerType`**（另有別名 `tower`）。

| 事件 | 欄位 |
|---|---|
| `spawn` | `id, enemy, x, z, flying` |
| `death` | `id, enemy, x, y, z, gold` |
| `leak` | `id, enemy, damage, x, z` |
| `shoot` | `towerId, kind, x, y, z, targetId`（kind 含 `lightning`） |
| `hit` | `x, y, z, kind, dmgType, damage, targetId`；kind 另有 `lightning`、`meteor`、`sword`（英雄） |
| `explode` | `x, z, radius, kind: rock/boulder/fire/meteor`（塔的另附 `towerId`） |
| `beam` | `kind:'lightning', points:[{x,y,z}…], towerId`（第一點是塔） |
| `pulse` | `towerId, kind: vines/thorns/roots, x, z, radius` |
| `status` | `id, kind: slow/freeze/root/stun/burn/shield`（從無到有時才發） |
| `split` | `id`（被分裂的那隻）`, x, z` |
| `summon` | `id`（召喚者）`, x, z, enemy, count` |
| `dim` | `id, x, z, radius` |
| `build` | `towerId, towerType, tower, c, r, x, z` |
| `upgrade` | `towerId, level, branch, x, z` |
| `sell` | `towerId, gold, x, z` |
| `gold` | `amount, x, z`（提早叫波另有 `early: true`，座標是燈） |
| `waveStart` | `index`（0 起算）`, number, boss` |
| `waveCleared` | `index, number` |
| `env` | `time, weather` |
| `heroAttack` | `targetId` |
| `heroHurt` | `damage, by` |
| `heroDeath` / `heroRespawn` | `x, z` |
| `heroLevel` | `level, x, z` |
| `skill` | `id, x, z`（freeze 的座標是燈；meteor 另附 `radius, delay`） |
| `won` | `stars` |
| `lost` | — |
| **新增** `shieldBreak` | `id`（護盾被打破） |
| **新增** `aura` | `id, x, z, radius, any`（暗影巫師施放護盾） |

## 規則與平衡公式
常數都在 `balance.js`。
- **地圖**：敵人可走 `= B o S L`（`o` 有塔就不可走）；英雄可走 `. , = B o S`（有塔不可走）。8 連通，斜走時兩個正交格都要可走（不切角）。
- **地面移動**：從燈做 Dijkstra 得到每格的下一格；敵人朝「下一格中心＋側向偏移」前進，離目標 < 0.5 格就換下一格（轉角自然切圓），方向每秒平滑 `TURN_RATE`。側向偏移每隻隨機 ±`LANE_OFFSET`（0.22 格）。蓋／賣塔後流場重算，在場敵人從目前格接新路線。
- **防封路**：`o` 格蓋下去後，用 4 連通 BFS 檢查每個出生點＋每隻地面敵人所在格仍能到燈，否則 `blocks-path`；地面敵人站在那格上＝`occupied`。英雄站在那格可以蓋（英雄會移到最近的可站格）。
- **飛行**：從出生點（或被召喚處）直線飛向燈，`y = 1.3`，偏移在離燈 2 格內收斂。
- **傷害**：物理 ×(1−armor)；魔法 ×(1−max(0, mres−mresPierce))；先減免再被護盾吸收。燃燒、火焰地帶、流星雨、冰封都是**魔法**傷害；英雄是物理。
- **選目標**：射程內 `remain`（剩餘路程）最小者；`air:false` 只看地面。塔每 0.1 秒重選一次，開火時塔頭立即對準，平常以 12 rad/s 轉向。
- **投射物**：箭／弩／法球／冰霜等速追蹤（14／16／7／8 格/秒），石頭類固定飛行時間 0.55–0.65＋0.1×距離 秒、拋物線；落點跟著目標，目標死了就落在最後位置（單體不造成傷害，範圍類照樣爆炸）。
- **塔 special**：
  - `multishot`：射程內最前面的 n 隻各一支；不足 n 隻就輪流分配。
  - `airBonus`：對飛行傷害倍率。
  - `splash`：半徑內地面敵人全額傷害。`stun`／`burn` 套在所有被炸到的敵人。`fireZone`：落點留下火焰地帶（半徑吃 `splashMul`）。
  - `chain`：最多 n 隻（含第一隻），每跳 ×`chainFalloff`，跳躍距離 `chainRange`，同一隻不重複。
  - `slow`＋`slowSec`、`freezeChance`＋`freezeSec`：冰霜命中時。
  - 樹靈塔：射程內有地面敵人才脈衝（間隔 1/rate），全部受傷＋緩速；`root`：其中最前面的 `rootTargets` 隻定身。
- **狀態**：緩速取最大值不疊加（較弱的在較強的生效時被忽略），上限 0.9；凍結／暈眩＝不能動也不能打；定身＝不能動但能打英雄；**王受到凍結／暈眩／定身的時間 ×0.5**。
- **敵人 special**：`split` 死亡時原地分裂（小怪間隔 0.18 秒起步、分走不同側）；`shieldAura` 第一次在出生後 every×0.4 秒，之後每 every 秒給半徑內其他敵人 `amount` 護盾（取較大值，不疊加）；`splitAt` 血量每跨過一個門檻就分裂一次；`summon` 首次 every×0.6 秒；`dim` 首次 every×0.5 秒，半徑內的塔 `sec` 秒射程 ×`rangeMul`。凍結／暈眩時這些計時暫停。
- **英雄**：守備點周圍 `HERO_ENGAGE`（1.6）格內的地面敵人會被攔，最多 `blocks` 隻（選離英雄最近的）。英雄走到第一隻旁邊（`range`）打，被擋的敵人停下、往英雄靠近到 0.7 格，1.0 格內每秒用 `atk`（`enemies.js` **新增欄位**）打英雄，英雄護甲減免。追不到 2.5 秒或離守備點超過 `HERO_LEASH`（2.6）就放掉（那隻 4 秒內不會再被攔）。脫戰 3 秒後每秒回 `regen`×等級倍率。死亡：放開所有敵人，`respawn + heroRespawnAdd`（最少 3）秒後在守備點滿血復活。
  - **經驗**：英雄打死或擋過的敵人＝全額 `gold` 經驗；英雄 2.5 格內被塔打死的＝0.4 倍。`levelXp[i]` 是升到 i+2 級的累計經驗；每級生命與傷害 ×(1＋`perLevel`×(等級−1))，升級時補上增加的生命。
- **技能**：開局冷卻 0（可直接用）。`cdMax = cd × skillCdMul × 技能 cdMul`。流星雨：`meteorMark` 地帶 `delay` 秒後對半徑內**地面與飛行**敵人造成 `damage × damageMul`。冰封：全場凍結 `duration`（王減半）並造成 `damage`。
- **波次**：`callNextWave` 開始 prep。每組 `delay` 秒後開始、每 `interval` 秒出一隻、`spawn` 超過出生點數量就取餘數。一波全部出完後 `gap`（預設 15）秒自動下一波；提早叫的波和前一波同時出。`waves[i].env` 在該波開始時合併到 `state.env` 並發 `env`。選填 `waves[i].reward`：該波清完時給的金幣（預設 0）。選填 `waves[i].hpMul`：該波敵人血量倍率（預設 1，和 `opts.enemyHpMul` 相乘；該波敵人分裂、召喚出來的小怪也套用；`validateLevel` 檢查要是正數）。
- **提早叫波**：`earlyBonus = floor(nextWaveIn × (0.6 + 0.08 × waveIndex) × earlyBonusMul)`。例：第 1 波出完後剩 15 秒 → 10 金；第 8 波剩 20 秒 → 24 金。
- **環境**：夜晚（`time:'night'`）非法師塔射程 ×0.9；雨天敵人移速 ×0.9、燃燒與火焰地帶傷害 ×0.5；黃昏、霧沒有規則效果（純氣氛）。
- **經濟**：擊殺金幣 `round(gold × killGoldMul)`；賣塔退 `floor(累計投資 × sellRatio)`（預設 0.7）；分支費用 `round(cost × branchCostMul)`。
- **勝負**：燈 ≤ 0 → `lost`；全部波次開始、全部出完、場上沒敵人 → `won`。星等：燈 ≥ 18 三星、≥ 10 兩星、其他一星（絕對值，不看 lampMax）。
- **天賦解析**（`mods.js`）：effect 有 `towers` → 套到那些塔；有 `skills` → 套到那些技能；其他是全域。`…Mul` 相乘、`…Add` 與 `mresPierce` 相加、`sellRatio` 取較大值。塔可用：`rangeMul damageMul rateMul splashMul branchCostMul costMul slowAdd`；技能可用：`damageMul cdMul radiusMul durationMul`；全域：`mresPierce heroHpMul heroDamageMul heroRespawnAdd skillCdMul startGoldAdd sellRatio killGoldMul earlyBonusMul`。
- **可重現**：所有隨機（側向偏移、凍結機率、召喚角度）都用 `seed` 的 mulberry32。
- **效能**：敵人用 1×1 空間分格；查詢寫進重複使用的陣列；每幀只配置事件物件與新投射物。300 敵人＋40 座 4 級塔約 0.06–0.2 ms／step（機器負載高時）。

## 資料變更（A 擁有的 data 檔）
- `enemies.js`：每種敵人新增 `atk`（被擋時每秒打英雄的傷害）。可選 `atkRate`（預設 1）。
- `towers.js`：鷹眼分支傷害 60 → 70（原本比連弩弱太多）。
- 英雄經驗新增「附近被塔打死也分 0.4 倍」（`HERO_XP_RADIUS`、`HERO_XP_SHARE`），不然英雄幾乎不會升級。
- 其餘數值維持初版。2026-11-06 用當時的 levels.js 跑 autoplay（2 個 seed）：`lazy` 只過 1–3 關；`balanced`（無天賦）全過，但第 7、8 關只有 1 星、9、10 關 2–3 星；`balanced`＋天賦（星星預算 3×(關卡−1)）全部 2–3 星。

## autoplay 回傳
`{ won, stars, lamp, wavesReached, waveCount, goldLeft, time, kills, leaked, towers, heroLevel, leakBy:{ 'w5:skeleton': 7, … }, log:[…] }`。`leakBy` 可看出哪一波、哪種怪漏最多，調關卡最好用。另匯出 `talentsForBudget(stars)`（依星星數挑天賦）。
