# 模擬核心 `js/sim/`（擁有者：A）

純邏輯，不 import three、不碰 DOM/window，Node 也能跑。合約見 `架構.md` §5、`架構_第二章.md` §1–§2；這裡記錄實作細節、**新增**的欄位／事件／函式，以及平衡公式。
第二章（v2.0）的內容集中在本檔最後的「第二章」一節。

## 檔案
| 檔案 | 內容 |
|---|---|
| `game.js` | `createGame`、全部指令、波次、技能、勝負；另匯出 `validateLevel`、`BAL` |
| `combat.js` | 敵人生成、傷害、死亡、漏怪、狀態（緩速／凍結／定身／暈眩／燃燒／護盾）、敵人 special、移動 |
| `towersim.js` | 塔數值（含天賦）、選目標、開火、投射物、連鎖閃電、樹靈脈衝、地帶（火焰／荊棘／流星標記） |
| `hero.js` | 三位英雄：BFS 移動（妖精直線飛）、守備點、攔截、近戰／遠程攻擊、死亡復活、升級、回血、英雄技能、聖燈衝鋒 |
| `light.js` | 第二章光照：`state.lights`、`lightAt`、敵人 `lit`／`hidden`、塔 `lit`／`active`、水晶中繼 |
| `map.js` | 解析 grid、8 連通 Dijkstra 流場（斜走不切角）、4 連通防封路檢查 |
| `spatial.js` | 敵人空間分格（每幀計數排序重建，查詢不配置物件） |
| `mods.js` | 天賦 id → 修正值 |
| `balance.js` | 平衡常數（`BAL`） |
| `rng.js` | 固定亂數（mulberry32） |
| `testmaps.js` | 測試用小地圖、autoplay 備用關卡；第二章洞窟測試圖（`MAP_CAVE_*`）與洞窟示範關（`DEMO_CAVE_LEVELS`） |

測試：`/opt/anaconda3/envs/hermes3d/bin/node tests/test_sim.mjs`（61 項）。
自動試玩：`/opt/anaconda3/envs/hermes3d/bin/node tests/autoplay.mjs [--level=7|11,12] [--chapter=1|2] [--strategy=balanced|lazy|archer|rush] [--hero=knight|fairy|mage|all] [--seeds=3] [--log] [--leaks] [--demo-cave]`
- `--hero=all` 會依序印三位英雄的表；`--leaks` 印每局的漏怪統計；`--demo-cave` 改跑 testmaps 的洞窟示範關。

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
`autoplay(levelDef, { strategy, talents, seed, hpMul, hero, heroSkills = true, onEvent })`
→ `{ won, stars, lamp, wavesReached, waveCount, goldLeft, time, kills, leaked, towers /*攻擊塔數*/, lanterns, hero, heroLevel, leakBy:{ 'w5:skeleton': 7, … }, log:[…] }`。`leakBy` 可看出哪一波、哪種怪漏最多，調關卡最好用。
`heroSkills: false` 不放英雄技能；`onEvent(ev, game)` 每個事件呼叫一次（統計用）。
另匯出 `talentsForBudget(stars, chapter = 1)`：第一章＝原本四條分支 1–4 層輪流點（和 v1 一樣）；第二章先點滿四條分支 1–4 層，再點燈火 1–4 層，最後第 5 層。命令列的「+天賦」用 3×(關卡−1) 顆星。

---

## 第二章（v2.0）：洞窟、光照、三位英雄

### API 追加
```js
const game = createGame(levelDef, { talents, seed, hero: 'knight' | 'fairy' | 'mage' }); // 沒給或不認得＝knight
game.castHeroSkill(skillId, x?, z?)  // → { ok, reason }
game.lightAt(x, z)                   // → 0–1
```
- `castHeroSkill` 的 reason：`locked`（不是這位英雄的技能、未知 id、等級 < minLevel）、`dead`、`cooldown`（含衝鋒中）、`no-target`（要座標卻沒給；星塵連射射程內沒敵人；衝鋒終點附近沒有可站格）、`range`（離英雄超過 castRange）。**新增** `over`：遊戲已結束。檢查順序：locked → dead → cooldown → no-target → range。
- `lightAt(x, z)`：不暗的關卡永遠 1。暗的關卡：在任一 `on` 光源半徑內＝1，半徑外 `LIGHT_EDGE`（0.75）格內線性漸暗到 0（給畫面；**lit 只看半徑內**）。
- `buildOptions(c, r)`：在 `.` `,`（洞窟地面）且燈籠已解鎖時只回傳 `[燈籠]`；其他格照 `TOWER_ORDER`（6 種，含 prism、lantern）。第一章的 `.` 仍是完整清單、全部 not-buildable（燈籠 unlock 11）。
- `canBuild`：燈籠可放 `# o . ,`，其他塔只能 `# o`；`o` 上的燈籠一樣做防封路檢查（`blocks-path`）。燈籠放在 `. ,` 上該格英雄不能走（英雄或守備點在那格會被移到最近可站格）。
- `heroCanStand(c, r)`：妖精（flying）在地圖範圍內任何格都回傳 true。
- `upgradeInfo`：燈籠 3 級後是 `{ kind: 'max' }`（沒有分支）；`next` 多了 `light`。天賦 `costMul` 也套用在 1→2、2→3 的升級費用（目前只有燈籠用到）。
- `typeStats` / `towerStats` 多了 `kind`（'light'｜'attack'）、`light`、`needsLight`；`towerStats` 另有 `active`、`lit`、`out`。燈籠 `range`＝照亮半徑、`dps` 0；稜鏡塔 `dps`＝每道雷射每秒傷害 × 道數（不含 ramp）。
- `validateLevel` 追加檢查：未知地圖字元（合法：`~.,=B#oSLTPRMHWFGDKCYUXQ`）、`chapter`（正整數）、`theme`（island｜cave）、`dark`（布林）、`env.time`（day｜dusk｜night｜cave）、`env.weather`（clear｜rain｜fog｜mist，含每波的 env）。

### state 追加
- `state.chapter`（預設 1）、`state.theme`（預設 'island'）、`state.dark`（預設 false）、`state.lights`（不暗的關卡是空陣列）。
- `towers[i]`：`kind`（燈籠 'light'，其他 'attack'）、`light`（燈籠照亮半徑，含天賦）、`out`（被噴墨熄滅剩餘秒數）、`active`（稜鏡塔有光；其他塔永遠 true）、`lit`、`lasers: [{ targetId, power, x, y, z }]`（另有內部 `target`、`t`、`_light`…）。
- `enemies[i]`：`lit`、`hidden`、`burrowed`、`segments`／`segMax`（不是巨蟲＝0）。
- `hero`：`type`、`light`、`flying`、`attack`（sword｜bolt｜fireball）、`range`、`skills: { [id]: { cd, cdMax, unlocked, ready } }`；**新增** `casting`（施放技能後 0.6 秒內＝技能 id，給 `userData.update({ casting })`）、`dashing`（聖燈衝鋒中）。
- `projectiles[i].kind` 新增 `fairyBolt`、`fireball`、`starBolt`（英雄的，`hero: true`）。稜鏡雷射不是投射物（看 `towers[i].lasers`）。
- `zones[i].kind` 新增 `pollen`（花粉迷霧，有 `slow`、`reverse`）；火焰風暴用 `fire`（`skill: 'firestorm'`）。

### 事件追加（欄位）
| 事件 | 欄位 |
|---|---|
| `lanternOut` / `lanternOn` | `towerId, x, z` |
| `ink` | `id`（蝙蝠）`, x, z` |
| `burrow` / `emerge` | `id, x, z`（地鼠、地鼠王、巨蟲） |
| `reveal` | `id, x, z`（幽靈從暗處進到光裡） |
| `laserOn` / `laserOff` | `towerId`（塔從沒照射→照射、照射→沒照射） |
| `segment` | `id, x, z, left`（一次打掉兩節＝兩個事件） |
| `eat` | `towerId, x, z, id`（id＝巨蟲；被吞的燈籠已從 towers 移除） |
| `heroSkill` | `skill, hero, x, z, radius, tx, tz`（衝鋒：x,z＝起點、tx,tz＝終點；其他技能 x,z＝tx,tz＝效果中心，旋風斬／星塵連射是英雄位置） |
| `heroAttack`（擴充） | `targetId, attack, x, y, z`（目標位置）、另有 `fromX, fromZ`（英雄位置） |

- `shoot.kind` 新增 `laser`（稜鏡塔鎖定新目標時發一次）。
- `hit.kind` 新增 `laser`（每道雷射每 0.25 秒一次，damage 是累積值）、`whirl`、`charge`、`firestorm`、`icefall`、`fairyBolt`、`fireball`、`starBolt`。
- `explode.kind` 新增 `fireball`（法師英雄火球）。`status.kind` 新增 `reverse`（花粉迷霧倒著走）。

### 光照規則（只在 `dark` 的關卡）
- 每 step 在敵人移動後、塔攻擊前重算 `state.lights`。光源：`lamp` 4.5、`lantern`（light×`lightMul`，`out>0` 時 off）、`hero`（HEROES.light×`heroLightMul`，死亡 off）、`mage`（法師塔 1.2）、`mushroom`（U，1.5）、`crystal`（C，2.0：格中心在任一亮著的光源半徑＋0.35 內才 on，可以一顆接一顆中繼；每 step 從頭算，不會互相點亮後自己維持）、`fire`（火焰地帶半徑＋0.5）、`meteor`（流星雨**落下時**起 3 秒，r 999）、`spell`（英雄技能 1.2 秒；法師火球爆開 0.4 秒 r 1.0）、`laser`（稜鏡雷射目標周圍 1.0）。光源 id 用獨立計數器。
- 敵人在任一 on 光源半徑內＝`lit`。**塔只鎖定 lit 且不 hidden 的敵人**（選目標、連弩、連鎖閃電的跳躍、樹靈脈衝都是）。範圍傷害（投石砲爆炸、火焰地帶、聚焦貫穿）會波及暗處的敵人；英雄普攻、英雄技能、流星雨、冰封不看光（但英雄普攻不打 hidden 的）。
- **laser 光源只照亮敵人**：不算進塔的 `lit`（避免稜鏡塔靠自己的雷射維持運作）、也不點亮水晶。
- 稜鏡塔 `needsLight`：`active = lit`，沒光就關掉雷射（laserOff）。
- 蓋／升級／賣塔後立即重算一次光照（prep 階段也看得到）。
- 第一章「夜晚射程 −10%」只看 `env.time === 'night'`，洞窟（'cave'）不套用。

### 塔
- **燈籠**：不攻擊；`range`＝`light`（不受夜晚、熄光影響）；1–3 級、沒有分支。被噴墨時 `out = sec`，倒數完發 `lanternOn`。
- **稜鏡塔**：每道雷射每秒 `damage` 點魔法傷害 ×（1 →`ramp`，`rampSec` 秒內線性上升；`power`＝進度）。鎖定後一直照到目標死亡、離開射程、hidden 或潛地；換目標 ramp 歸零。分光 `beams: 3`＝三個不同目標各一道。聚焦 `pierce`：塔→目標方向、長度＝射程、寬 0.4 的線段上其他敵人吃 ×0.6（`PRISM_PIERCE_MUL`）。
### 敵人
- **影子幽靈**（`shadow`）：暗的關卡裡不在光內＝`hidden`；hidden→看得見時發 `reveal`。
- **地鼠**（`burrow: { trigger, dist, speed, cooldown }`）：每 0.2 秒檢查，離任一攻擊塔（不含燈籠）`trigger` 格內就鑽地；潛地中 `burrowed`＋`hidden`、沿路線以 `speed` 前進 `dist` 格（不受緩速）、所有傷害（`'true'` 除外）與控制無效、英雄擋不住（被擋時會放開）。冒出後冷卻 `cooldown` 秒。
- **地鼠王**／**深淵巨蟲**（`burrow: { every, dist, speed }`）：出生 every×0.5 秒後第一次鑽地，冒出後每 `every` 秒再鑽。地鼠王潛地時暫停召喚。
- **噴墨蝙蝠**（`ink: { radius, sec, cooldown }`）：半徑內有亮著的燈籠就噴墨，全部熄滅 `sec` 秒，之後冷卻。天賦 `inkImmune`＝不噴。
- **深淵巨蟲**：`segments` 節，每節血量＝maxHp／節數；`eatLantern: { radius, every }`：出生 every×0.5 秒後開始，每 `every` 秒吞掉頭部 `radius` 內最近的一盞燈籠（沒有就每 0.5 秒再找）；潛地中不吞。被吞的燈籠如果在 `o` 上，路線恢復。
- **飛行敵人 vs 妖精**：妖精在空中時，飛行敵人離她 1.0 格內就以 `atk` 每秒攻擊她（不停下）。

### 英雄
- **騎士**（sword）：第一章的近戰邏輯（攔截 blocks 隻、追打被擋的）。
- **妖精**（flying、blocks 0）：直線飛、哪裡都能停；不攔人、地面敵人不會打她；站在守備點打射程內最前面（remain 最小）的敵人，含空中；`fairyBolt` 追蹤彈（魔法）。
- **法師**（fireball、blocks 1、`air: false`）：攔 1 隻（被擋的走到他身邊打他）；站在守備點，優先打擋住他的那隻，否則打射程內最前面的地面敵人；`fireball` 落地爆開 `splash`（只炸地面）。
- 遠程英雄每 0.2 秒重選目標，不追擊。
- **英雄技能**：開局冷卻 0；`cdMax = cd × heroSkillCdMul`（寒冬之心 `skillCdMul` 只管流星雨／冰封）；`unlocked = hero.level >= minLevel`；`ready = unlocked && cd <= 0 && 活著 && 不在衝鋒`。傷害都 ×英雄等級倍率（1＋perLevel×(等級−1)）×`heroDamageMul`，擊殺算英雄經驗。
  - 旋風斬：英雄周圍 radius 內地面敵人（物理）。
  - 聖燈衝鋒：以 10 格/秒直線衝到目標點（可越過障礙；終點格不能站就用最近的可站格），沿路 radius 內地面敵人各一次：傷害、`knockback` 格撞退（往遠離燈的路線退，王 ×0.5）、暈眩（王 ×0.5）。**守備點不變**，衝完會走回去。
  - 星塵連射：英雄 range 內看得見的敵人（含空中），bolts 發 `starBolt` 依序射出，分給最前面的不同目標（不夠就輪流）。
  - 花粉迷霧：`pollen` 地帶 duration 秒；範圍內（含空中）緩速 `slow`；每隻第一次進來時倒著走 `reverse` 秒（王 ×0.5）：地面往流場上坡（離燈更遠的相鄰格）走、到出生點就停；飛行往遠離燈的方向。
  - 火焰風暴：範圍內地面敵人立即魔法傷害＋留下 `fire` 地帶（dps＝burn.dps×等級倍率、ttl＝burn.sec）。
  - 冰隕：範圍內地面敵人魔法傷害＋凍結 `freeze` 秒（王 ×0.5）。
  - 規則：`air: false` 的英雄（騎士、法師）技能只打地面；妖精的技能含空中。
- 每次施放都會發 `heroSkill`，暗的關卡另有 `spell` 光源。

### 天賦（新 effect）
`lightMul`（燈籠照亮半徑，塔用）、`costMul`（建造＋升級費用，塔用）、`inkImmune`（布林，任一為真就真）、`heroLightMul`、`heroSkillCdMul`、`waveGoldAdd`（每波清完額外金幣，沒有 reward 的波也給；**最後一波清完的同一幀就勝利，和第一章一樣不會再發錢**）。第 5 層照原規則（`…Mul` 相乘）。

### 和合約不同或補充的地方
- `castHeroSkill` 多一個 reason `over`；`hero` 多 `casting`、`dashing`；`heroAttack` 多 `fromX/fromZ`。
- 流星雨的全場照亮從**落下**那一刻開始 3 秒（不是施放時）。
- laser 光源不算塔的 lit（見上）。

### 平衡（2026-11-14，A）
- **第一章不變**：把騎士數值改回 v1（300 血、14 傷、擋 2）並關掉英雄技能時，autoplay 結果和 v1.3 逐格相同（同 seed、同關），確認規則核心的第一章邏輯沒動。
- **英雄數值**（`heroes.js`，整合者初版 → 現在）：騎士 340/16 → 320 血、13 傷（擋 3 不變）；妖精 180 血、12 傷 ×1.4 次、射程 2.6 → 160 血、7 傷 ×1.2 次、射程 2.4；法師 220 血、20 傷 ×0.7 次、射程 2.3、splash 0.9、可打空中 → 200 血、9 傷 ×0.55 次、射程 2.1、splash 0.6、**不打空中**。
  技能：旋風斬 60 傷／12 秒 → 30／16；聖燈衝鋒 80 傷、暈 1.5、20 秒 → 40、1.0、26；星塵連射 35×5／10 秒 → 16×5／15；花粉迷霧 緩速 0.5、倒走 2 秒、22 秒 → 0.4、1.2、28；火焰風暴 90 傷 r1.7、燒 15×4／16 秒 → 35 r1.5、5×3／22；冰隕 70 傷 r1.5、凍 2.5／24 秒 → 25 r1.3、1.3／30。
- 方法：第 7–10 關（前面幾關大多 20 燈，看不出差別）、balanced、6 個 seed 的剩燈總和。v1 騎士（沒有技能）＝238。初版數值：騎士 347、妖精 383、法師 390（法師的火焰風暴一招就佔全部命中傷害 31%，還會清掉第 8 關的夜蝠群）。調整後：騎士 ≈ 249–278、妖精 ≈ 276、法師 ≈ 285–292（+15–20%，autoplay 幾乎每次冷卻好就放技能，真人會少一些）。結果很「混沌」：同設定差一個 seed 第 8 關可以差 15 燈，所以 ±30 以內視為一樣。
- 第一章三位英雄 balanced（seed 1–3，剩燈）：

  | 關 | v1 騎士 | 騎士 | 妖精 | 法師 |
  |---|---|---|---|---|
  | 7 | 11/11/12 | 12/10/12 | 14/10/13 | 8/8/12 |
  | 8 | 2/4/3 | 8/3/6 | 10/13/11 | 8/12/15 |
  | 9 | 12/6/17 | 20/20/4 | 18/13/20 | 19/20/16 |
  | 10 | 5/13/11 | 12/20/4 | 7/12/3 | 11/7/12 |

  1–6 關三位都和 v1 一樣（全勝、幾乎都 3 星）；lazy（英雄不動、不放技能）只過 1–3 關，同 v1。balanced＋天賦第 8 關：v1 15/15/12，騎士 16/17/16、妖精 5/12/1、法師 10/13/14。
- 第二章的塔、敵人數值維持整合者初版（F 正在用 autoplay 調關卡），只改了英雄。
