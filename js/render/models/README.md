# 模型（B 模型美術）

所有 3D 模型都用程式生成（low-poly、flat shading、頂點色），沒有任何外部素材。
對外入口是 `js/render/models.js`（轉出 `js/render/models/index.js`），合約見 `架構.md` §6。

## 檔案

| 檔案 | 內容 |
|---|---|
| `js/render/models.js` | 對外入口（只做轉出） |
| `js/render/palette.js` | 顏色表 `COLORS`、共用材質 `MAT`、光暈 Sprite、全域發光／提亮調整 |
| `models/lib.js` | `Builder`（基本幾何 → 合併成一個頂點色 geometry）、geometry 快取、`part()`、`makeSkin()`（閃白／冰凍）、`countTris()` |
| `models/towers.js` | `makeTower` |
| `models/enemies.js` | `makeEnemy`、`ENEMY_TYPES` |
| `models/hero.js` | `makeHero` |
| `models/props.js` | `makeLamp`、`makeSpawnGate`、`makeProjectile` |
| `models/decor.js` | `makeDecor`、`DECOR_KINDS`、`DECOR_VARIANTS` |
| `tools/gallery.html` | 驗收用展示頁（見最後一節） |

## 共通規則

- 回傳 `THREE.Group`，原點在格子中心地面（y = 0），正面朝 **+Z**。飛行敵人例外：原點在身體中心（view 把它放在 y = 1.3）。
- **不要改模型根節點的 position / rotation / scale 以外的東西**；動畫只動子節點，所以 view 可以自由設定根節點的位置、`rotation.y = yaw`、縮放（蓋塔彈跳）。
- 每個 mesh 都 `castShadow = true`（小花、草叢除外）；塔、燈、傳送門、房子、風車、碼頭 `receiveShadow = true`。
- geometry 依 key 快取：同型模型共用同一份 geometry；材質幾乎全部共用 `MAT.vc`。建立新物件只會 new Group / Mesh，不會重建 geometry。
- 物件池重複使用沒問題：`update()` 每次都會把材質狀態（閃白／冰凍）校正回來。

## 材質系統（palette.js）

顏色寫在 geometry 的 `color` 屬性；另一個 `fx`（vec2）屬性：`x = 自發光`、`y = 光澤`。
`MAT.vc` 是打過補丁的 `MeshStandardMaterial`（flatShading），自發光 = 頂點色 × fx.x × 全域倍率。

| 名稱 | 說明 |
|---|---|
| `MAT.vc` | 主材質，幾乎所有模型都用它 |
| `MAT.flash` | 受擊閃白（`hit()` 暫時換上，約 0.12 秒） |
| `MAT.frozen` | 冰凍（冰藍色調＋微光） |
| `setGlowStrength(v)` | 全域發光倍率。建議：白天 1.0、黃昏 1.25、夜晚 1.6（窗戶、眼睛、水晶、火盆更亮） |
| `setModelLift(v)` | 全域模型提亮（0＝關）。建議：白天 0、黃昏 0.04、夜晚 0.1–0.15，讓敵人在暗夜仍看得清楚 |
| `halo(color, size, opacity)` | 加色柔邊光暈 Sprite（同色共用材質） |
| `additive(color, opacity, vertexColors)` | 加色 MeshBasicMaterial（傳送門漩渦） |

合併建議（給場景代理）：裝飾全部是 `MAT.vc`，可以依材質把 geometry `applyMatrix4` 後合併成一個 mesh（`fx` 屬性要一起保留）。
不要合併：`userData.animated === true` 的 mesh（風車葉片）和 Sprite（水晶、路燈的光暈）。

陰影建議：方向光 `shadow.bias = -0.0004`、`shadow.normalBias = 0.02`（gallery 用這組，塔身沒有陰影粉刺）。

## makeTower(type, level = 1, branch = null)

`type`：`archer | catapult | mage | treant`；`level` 1–3（超出會夾住）；`branch`：`null | 'a' | 'b'`（有分支時忽略 level）。

| userData | 說明 |
|---|---|
| `head` | 會轉向目標的 Group（view 設 `head.rotation.y = yaw`）。弓箭塔＝弩／弓手，投石砲＝整台投石機；法師塔、樹靈塔為 `null` |
| `muzzle` | 發射點 Object3D（`getWorldPosition` 取得世界座標） |
| `fire()` | 開火動畫：弩後座＋閃光、投石臂甩出（0.13 秒上甩、停 0.22 秒、0.7–1 秒收回，石頭在甩出時隱藏）、法球脈衝放大、樹靈樹冠彈跳＋手臂舉起 |
| `update(dt)` | 持續動畫：法球漂浮自轉、電環／冰片環繞、樹冠與樹枝擺動、燃燒彈火盆火焰跳動 |
| `height` | 模型高度（放 UI 用） |
| `kind / type / level` | `'tower'`、塔種、`1|2|3|'a'|'b'` |

外型：
- 弓箭塔：1 級木架塔＋紅屋頂；2 級加石基座、旗子；3 級石塔身、金邊、紅旗幟。連弩＝方形石堡＋三管連弩＋箭匣；鷹眼＝高聳木構瞭望台＋綠衣長弓手＋藍旗。
- 投石砲：1 級木轉盤；2 級方石台＋石堆；3 級金邊＋橘旗。巨石＝高大配重投石機（配重箱會保持垂直）；燃燒彈＝暗鐵框＋三座火盆＋火彈。
- 法師塔：薰衣草石塔＋紫色簷＋石尖＋粉紫水晶球。連鎖閃電＝深藍石＋銅線圈＋避雷針＋兩道旋轉電環；冰霜＝冰白石＋冰晶簇＋積雪＋環繞冰片。
- 樹靈塔：有臉（發光眼）的活樹。荊棘林＝暗紅樹幹＋滿身尖刺＋荊棘藤圈＋紅眼；古樹＝粗壯古木＋金黃寬樹冠＋苔鬚＋符文石＋金眼。
- 高度約：1 級 1.0–1.1、2 級 1.2–1.5、3 級 1.35–1.6、分支 1.4–2.2。

## makeEnemy(type)

`type`：`slime slimelet splitter goblin skeleton gargoyle bat golem shaman slimeKing nightLord`（未知 id 用 slime）。

| userData | 說明 |
|---|---|
| `update(dt, { moving, speed, frozen, slowed, attacking })` | 走路／跳／拍翅。`frozen` 為真：換冰凍材質並停住動畫；`slowed`：動畫 0.55 倍速；`speed`：步頻參考（0.7–1.5 倍）；`attacking`（被英雄擋住）：原地攻擊動作 |
| `hit()` | 受擊閃白 0.12 秒（史萊姆王還會抖一下） |
| `height` | 血條擺放高度（從原點起算） |
| `flying` | 石像鬼、夜蝠為 `true` |
| `boss` | 史萊姆王、夜之君主為 `true` |

動畫：史萊姆系＝跳躍＋壓扁伸展（分裂史萊姆兩半交錯）；哥布林／骷髏／魔像／夜之君主＝雙腿擺動＋上下彈＋左右晃；魔像攻擊時雙拳輪流舉起；巫師＝漂浮＋法杖擺動（攻擊時舉杖）；石像鬼慢拍翅、夜蝠快拍翅；夜之君主披風擺動、攻擊時揮大劍。

辨識：史萊姆亮綠＋頭頂小芽、小史萊姆小一號偏黃綠、分裂史萊姆青藍雙球、哥布林橄欖綠＋紅尖帽＋背袋、骷髏白骨大頭骨＋生鏽圓盾、石像鬼灰石＋大翅膀＋橘眼、夜蝠紫色、魔像棕灰巨石＋熔岩裂紋、巫師深紫尖兜帽＋發光法杖、史萊姆王巨大＋金王冠、夜之君主暗紫鎧甲＋角盔＋紅眼＋紅披風＋紫法球。

## makeHero('knight')

| userData | 說明 |
|---|---|
| `update(dt, { moving, attacking, dead })` | 走路擺腿、提燈搖晃、披風擺動；`dead` 時向後倒下（約 0.5 秒）、提燈光暈變暗 |
| `attack()` | 揮劍：舉起 0.12 秒 → 斬下 0.12 秒 → 回位 0.22 秒 |
| `hit()` | 受擊閃白（額外提供） |
| `height` | 0.82 |

## makeLamp()

精緻三層石座＋石柱＋鐵框大提燈（玻璃與火焰為獨立材質）＋暖色 `PointLight`（`userData.light`，不投影）＋光暈＋繞燈光點。

`update(dt, frac, time)`：`frac` 0–1（平滑追蹤）、`time` `'day'|'dusk'|'night'`。
燈光強度 ≈ (1.6 + 夜晚 × 5.2) × frac^0.6 × 閃爍；照射距離 4–9.5；`frac = 0` 時火焰熄滅、玻璃變暗。高度 1.75。

## makeSpawnGate()

暗色粗石拱門＋紫色符文＋雙層反向旋轉的漩渦（加色）＋深紫底＋被吸進去的光點。`update(dt)` 驅動旋轉與脈動。漩渦面朝 ±Z（雙面），高度 1.4、寬約 1.05。

## makeProjectile(kind)

`arrow bolt rock boulder firebomb orb frost`，另有 `lightning`（備用小電光）；未知 kind 用法球。正面朝 +Z（view 會 `lookAt` 速度方向）。
`userData.update(dt)`（額外提供）：石頭翻滾、冰晶自轉、火彈與法球光暈閃動。

## makeDecor(kind, rng = Math.random)

kind：`tree pine rock mushroom house windmill fence grave dock bush crystal lamppost flower grassTuft`（未知用 bush）。
每種有 2–8 個預先做好的變體（`DECOR_VARIANTS`），`rng` 依序決定：變體 → 旋轉 → 縮放，所以同一個種子每次結果相同、geometry 全部共用。

- 不隨機旋轉：`fence`（沿 x 軸、橫跨整格 −0.5～0.5，相鄰格會接起來；直向請自己轉 90°）、`dock`（1×1 木板平台，木樁往下伸到 y −0.8，水面上看得到）。
- `grave` 只小角度旋轉（大致朝前）。
- 自發光：房子與風車的窗、路燈、墓前蠟燭、藍紫蘑菇、水晶（配合 `setGlowStrength`）。
- 風車葉片會自己轉（`onBeforeRender` 用時間計算，不需要呼叫 update）；`userData.animated = true`。
- 水晶與路燈多一個光暈 Sprite。
- 小花、草叢不投影（數量多時省陰影成本）。

## 三角形數（gallery 實測）

| 類別 | 數量 |
|---|---|
| 塔 | 弓箭 459 / 568 / 670、連弩 870、鷹眼 850；投石 684 / 728 / 848、巨石 580、燃燒彈 786；法師 416 / 496 / 632、連鎖閃電 828、冰霜 692；樹靈 399 / 571 / 841、荊棘林 868、古樹 869（全部 < 900） |
| 敵人 | 史萊姆 280、小史萊姆 244、分裂 296、哥布林 286、骷髏 284、石像鬼 288、夜蝠 258、魔像 292、巫師 297（全部 < 300）；史萊姆王 1008、夜之君主 828（< 1500） |
| 其他 | 騎士 734、守護燈 860、傳送門 536、投射物 8–167、裝飾 36–444 |

每個模型 1–7 個 mesh（有動畫的部位才拆開）。

## tools/gallery.html

在專案根目錄 `python3 -m http.server 8201`，開 `http://127.0.0.1:8201/tools/gallery.html`。

| 參數 | 說明 |
|---|---|
| `time=day|dusk|night`（或 `night=1`） | 時段（夜晚自動套用 `setGlowStrength(1.6)`、`setModelLift(0.12)`） |
| `cam=front|top|game|far|close|side` | 鏡頭；`game`＝50° 俯視、畫面寬約 20 格（模擬手機遊戲畫面） |
| `only=towers|enemies|hero|props|projectiles|decor|mock` | 只顯示某一類；`mock`＝模擬遊戲場景（道路上走的敵人＋塔＋裝飾） |
| `pick=archer,goblin` | 只顯示名稱含這些字的模型 |
| `frozen=1`、`anim=0`、`labels=0`、`hud=0`、`tone=aces`、`lift=0.1` | 冰凍狀態、停止動畫、隱藏標籤、隱藏說明、ACES 色調、自訂提亮 |
| `yaw= pitch= dist= cx= cz=` | 自訂鏡頭角度、距離倍率、中心 |
| `src=dev` | 直接讀 `models/index.js` |

頁面變數：`window.__gallery`（每個模型的三角形數、mesh 數、是否超出預算）、`window.__fireAll()`（全部開火／受擊／揮劍）、`window.__drawCalls`。
標籤顯示「三角形數 · mesh 數」，超出預算會變紅。
