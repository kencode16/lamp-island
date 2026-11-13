# 模型（B 模型美術）

所有 3D 模型都用程式生成（low-poly、flat shading、頂點色），沒有任何外部素材。
對外入口是 `js/render/models.js`（轉出 `js/render/models/index.js`），合約見 `架構.md` §6、`架構_第二章.md` §3（v2.0）。

## 檔案

| 檔案 | 內容 |
|---|---|
| `js/render/models.js` | 對外入口（只做轉出） |
| `js/render/palette.js` | 顏色表 `COLORS`、共用材質 `MAT`、光暈 Sprite、全域發光／提亮調整 |
| `models/lib.js` | `Builder`（基本幾何 → 合併成一個頂點色 geometry）、geometry 快取、`part()`、`glowPart()`、`partG()`、`makeSkin()`（閃白／冰凍）、`countTris()` |
| `models/towers.js` | `makeTower`（第一章四種塔） |
| `models/towers2.js` | 第二章：燈籠 `lantern`、水晶稜鏡塔 `prism` |
| `models/enemies.js` | `makeEnemy`、`ENEMY_TYPES`（第一章敵人） |
| `models/enemies2.js` | 第二章：影子幽靈、挖洞地鼠、噴墨蝙蝠、地鼠王、深淵巨蟲 |
| `models/hero.js` | `makeHero`、`HERO_TYPES`、守燈騎士 |
| `models/heroes2.js` | 森林妖精、星詠法師、`starPts()` |
| `models/props.js` | `makeLamp`、`makeSpawnGate`（含洞窟岩縫）、`makeProjectile` |
| `models/decor.js` | `makeDecor`、`DECOR_KINDS`、`DECOR_VARIANTS` |
| `models/cave.js` | 洞窟裝飾（石筍、發光蘑菇、洞窟水晶、礦車）＋第一章裝飾的洞窟版 |
| `tools/gallery.html` | 驗收用展示頁（見最後一節） |

## 共通規則

- 回傳 `THREE.Group`，原點在格子中心地面（y = 0），正面朝 **+Z**。飛行敵人例外：原點在身體中心（view 把它放在 y = 1.3）。
- **不要改模型根節點的 position / rotation / scale 以外的東西**；動畫只動子節點，所以 view 可以自由設定根節點的位置、`rotation.y = yaw`、縮放（蓋塔彈跳）。
- 每個 mesh 都 `castShadow = true`（小花、草叢除外）；塔、燈、傳送門、房子、風車、碼頭 `receiveShadow = true`。
- geometry 依 key 快取：同型模型共用同一份 geometry；材質幾乎全部共用 `MAT.vc`。建立新物件只會 new Group / Mesh，不會重建 geometry。
- 物件池重複使用沒問題：`update()` 每次都會把材質狀態（閃白／冰凍）校正回來。
- `damp()` 遇到 dt ≤ 0 會原地不動（dt 上限 0.5），負的 dt 不會再讓燈的光暈爆衝。

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
不要合併：`userData.animated === true` 的 mesh（風車葉片）和 Sprite（水晶、路燈的光暈），以及有 `userData.update` 的裝飾（發光蘑菇、洞窟水晶）。

### 第二章：自發光與黑暗效果（noDark 規則）

- **自發光的部分一律是獨立 mesh**，材質的 `material.userData.noDark === true`，C 的黑暗效果要跳過這些材質。
  包含：所有敵人的眼睛（第一章敵人也拆出來了，外觀不變）、地鼠頭燈、巨蟲的嘴與發光斑點、燈籠紙、稜鏡塔水晶、
  發光蘑菇傘、洞窟水晶、洞窟岩縫的紫水晶、法杖星晶、妖精魔杖、英雄投射物、法師塔水晶球、燃燒彈火盆火焰、騎士提燈玻璃。
- 有 noDark 的材質：`MAT.glow`（亮）、`MAT.glowDim`（微弱：未照到的洞窟水晶）、`MAT.glowOff`（熄滅：燈籠被噴墨、稜鏡塔沒光）、
  所有光暈 Sprite（`halo()`／`haloOwn()`）、加色材質（`additive()`：漩渦、地上光圈）、守護燈的玻璃與火焰、傳送門漩渦底、妖精翅膀。
  清單：`NODARK_MATS`（vc 系）；會被變暗的 vc 材質：`DARKABLE_MATS`（`MAT.vc / flash / frozen / ghost / ghostFlash / ghostFrozen`）。
- 自己 new 的發光材質用 `markNoDark(mat)` 標記。
- 做法：`glowPart(key, fn)` 建一個 `MAT.glow` 的 mesh；或在同一個 Builder 裡把零件選項加 `{ nd: true }`，再用
  `parent.add(...partG(key, fn))` 一次拿到「一般 mesh＋自發光 mesh」（第一章敵人就是這樣拆眼睛，Builder 的明暗亂數順序不變，所以外觀完全一樣）。
- shader 快取鍵：一般 vc 材質共用 `shoudeng-vcfx-3`，noDark 那組是 `shoudeng-vcfx-3-nd`，所以 C 改一般材質的 shader 不會影響發光材質。
- **選用掛勾**：`registerDarkPatch((shader, material, renderer) => { ... }, 'key')`，之後所有「不是 noDark」的 vc 材質編譯時會呼叫它（快取鍵加上 key、會自動 `needsUpdate`）。C 要用自己的方式也可以，只要跳過 `userData.noDark`。
- 每個材質自己的發光倍率 `uGlowMul`：`setMaterialGlow(mat, v)`（`glowDim` 0.28、`glowOff` 0.04 就是靠這個）。

陰影建議：方向光 `shadow.bias = -0.0004`、`shadow.normalBias = 0.02`（gallery 用這組，塔身沒有陰影粉刺）。

## makeTower(type, level = 1, branch = null)

`type`：`archer | catapult | mage | treant | prism | lantern`；`level` 1–3（超出會夾住）；`branch`：`null | 'a' | 'b'`（有分支時忽略 level；燈籠沒有分支，給了分支＝3 級）。

| userData | 說明 |
|---|---|
| `head` | 會轉向目標的 Group（view 設 `head.rotation.y = yaw`）。弓箭塔＝弩／弓手，投石砲＝整台投石機；法師塔、樹靈塔為 `null` |
| `muzzle` | 發射點 Object3D（`getWorldPosition` 取得世界座標） |
| `fire()` | 開火動畫：弩後座＋閃光、投石臂甩出（0.13 秒上甩、停 0.22 秒、0.7–1 秒收回，石頭在甩出時隱藏）、法球脈衝放大、樹靈樹冠彈跳＋手臂舉起 |
| `update(dt)` | 持續動畫：法球漂浮自轉、電環／冰片環繞、樹冠與樹枝擺動、燃燒彈火盆火焰跳動 |
| `height` | 模型高度（放 UI 用） |
| `kind / type / level` | `'tower'`、塔種、`1|2|3|'a'|'b'` |
| `setLit(on)` | **所有塔都有**。第一章的塔是空函式；燈籠＝點亮／熄滅；稜鏡塔＝有光／沒光。可以每幀呼叫（狀態沒變就什麼都不做） |
| `lit` | （燈籠、稜鏡塔）目前狀態 |
| `crystalY` | （稜鏡塔）水晶中心高度 |

### 第二章的塔（towers2.js）
- **燈籠 `lantern` 1–3**：石座＋木柱＋紅色紙燈籠（暖橘色發光紙身）。1 級方石座小燈籠、2 級兩層石座＋紅色小屋頂＋金環流蘇、3 級三層雕花石座＋石柱＋金屋頂＋四角小光石。高度 0.86 / 1.02 / 1.3。
  `setLit(false)`：紙身換 `MAT.glowOff`（變暗灰）、光暈淡出；`setLit(true)`：先閃爍約 0.5 秒再穩定點亮。`head = null`、`fire()` 空函式、`muzzle` 在燈籠中心。**沒有 PointLight**（照明交給 C 的光照貼圖）。
- **水晶稜鏡塔 `prism`**：淺藍灰石柱＋黃銅爪＋青色雙尖水晶，水晶中心 `y = 1.2 + 0.15 × level`（1.35 / 1.5 / 1.65），分支 1.8；`muzzle` 在水晶中心。
  2 級加嵌在底座的小水晶、3 級金邊＋繞轉的三片小水晶。分光 `a`：三根石柱底座＋三稜柱水晶＋黃銅環上繞轉的青／粉／黃三顆小稜鏡（三稜水晶環）。
  聚焦 `b`：轉台＋黃銅叉架＋紫色長水晶槍管（`head` 會轉向目標，`muzzle` 在槍管中心、高度 1.8）。
  `setLit(false)`：所有水晶換 `MAT.glowOff`、光暈淡出、轉速變慢。`fire()`：水晶脈衝放大。

外型：
- 弓箭塔：1 級木架塔＋紅屋頂；2 級加石基座、旗子；3 級石塔身、金邊、紅旗幟。連弩＝方形石堡＋三管連弩＋箭匣；鷹眼＝高聳木構瞭望台＋綠衣長弓手＋藍旗。
- 投石砲：1 級木轉盤；2 級方石台＋石堆；3 級金邊＋橘旗。巨石＝高大配重投石機（配重箱會保持垂直）；燃燒彈＝暗鐵框＋三座火盆＋火彈。
- 法師塔：薰衣草石塔＋紫色簷＋石尖＋粉紫水晶球。連鎖閃電＝深藍石＋銅線圈＋避雷針＋兩道旋轉電環；冰霜＝冰白石＋冰晶簇＋積雪＋環繞冰片。
- 樹靈塔：有臉（發光眼）的活樹。荊棘林＝暗紅樹幹＋滿身尖刺＋荊棘藤圈＋紅眼；古樹＝粗壯古木＋金黃寬樹冠＋苔鬚＋符文石＋金眼。
- 高度約：1 級 1.0–1.1、2 級 1.2–1.5、3 級 1.35–1.6、分支 1.4–2.2。

## makeEnemy(type)

`type`：`slime slimelet splitter goblin skeleton gargoyle bat golem shaman slimeKing nightLord`＋第二章 `ghost mole inkBat moleKing abyssWorm`（未知 id 用 slime）。

| userData | 說明 |
|---|---|
| `update(dt, { moving, speed, frozen, slowed, attacking })` | 走路／跳／拍翅。`frozen` 為真：換冰凍材質並停住動畫；`slowed`：動畫 0.55 倍速；`speed`：步頻參考（0.7–1.5 倍）；`attacking`（被英雄擋住）：原地攻擊動作 |
| `hit()` | 受擊閃白 0.12 秒（史萊姆王還會抖一下） |
| `height` | 血條擺放高度（從原點起算） |
| `flying` | 石像鬼、夜蝠為 `true` |
| `boss` | 史萊姆王、夜之君主為 `true` |

動畫：史萊姆系＝跳躍＋壓扁伸展（分裂史萊姆兩半交錯）；哥布林／骷髏／魔像／夜之君主＝雙腿擺動＋上下彈＋左右晃；魔像攻擊時雙拳輪流舉起；巫師＝漂浮＋法杖擺動（攻擊時舉杖）；石像鬼慢拍翅、夜蝠快拍翅；夜之君主披風擺動、攻擊時揮大劍。

第二章（enemies2.js）：
- **影子幽靈 `ghost`**：半透明紫黑（`MAT.ghost`，opacity 0.8）、下擺一圈尖角＋後面拖煙尾、舉起小手、青白發光大眼和嘴、淡紫光暈。漂浮在地面上約 0.2，飄動擺盪。高度 0.92。
- **挖洞地鼠 `mole`**：圓滾棕色身體、粉紅鼻、門牙、白色三爪大手（走路時像游泳一樣扒土）、黃色礦工帽＋發光頭燈、黃色發光小眼。高度 0.62。
- **噴墨蝙蝠 `inkBat`**（飛行，原點在身體中心）：墨藍色、肚子下鼓起的大墨囊（會呼吸般鼓動）、青色發光眼、嘴角滴墨。額外 `userData.ink()`：墨囊擠扁再彈回（噴墨事件時可呼叫）。高度 0.28。
- **地鼠王 `moleKing`**（王）：巨大地鼠、金王冠（三顆發光寶石）、紅披風白毛邊、扛著大十字鎬（攻擊時揮鎬）、紅色發光眼、生氣的眉毛與鬍鬚。高度 1.6。
- **深淵巨蟲 `abyssWorm`**（王）：抬起的大頭（一圈尖牙、橘紅發光喉嚨、四顆金色發光眼、頭頂尖角、兩側大顎），身體 6 節紫色甲殼（每節兩側有青色發光斑點）＋尾巴。高度 1.5。
  - `userData.setSegments(n)`：只顯示前 n 節（0–6，從尾巴開始消失，尾巴會接在最後一節後面）；`userData.segMax = 6`；`userData.resetPath()`：清掉路徑記錄（物件池重用時可呼叫，不呼叫也會自動偵測瞬移）。
  - **拖尾作法**：每次 `update` 時把 group 的 `position`（父物件座標）記進路徑（每 0.08 格一點，最多 140 點）；各節放在「從頭沿路徑往後量 d」的位置、朝向路徑方向。節都掛在一個 `segRoot` 底下，它的 `matrix` 設成 `group.matrix` 的反矩陣，所以節的座標＝父物件座標，不受頭的旋轉影響。一次移動超過 2.5 格（鑽地後冒出、物件池重用）會把路徑重設成頭後方的一直線。**view 要先設好 position / rotation 再呼叫 update**（現在的 view.js 就是這個順序）。
- 所有第二章敵人的眼睛（與頭燈、斑點）都是 noDark 的獨立 mesh；`hit()`／冰凍只換身體材質，眼睛照樣發光。

辨識：史萊姆亮綠＋頭頂小芽、小史萊姆小一號偏黃綠、分裂史萊姆青藍雙球、哥布林橄欖綠＋紅尖帽＋背袋、骷髏白骨大頭骨＋生鏽圓盾、石像鬼灰石＋大翅膀＋橘眼、夜蝠紫色、魔像棕灰巨石＋熔岩裂紋、巫師深紫尖兜帽＋發光法杖、史萊姆王巨大＋金王冠、夜之君主暗紫鎧甲＋角盔＋紅眼＋紅披風＋紫法球。

## makeHero(type)

`type`：`knight | fairy | mage`（未知用騎士）。`HERO_TYPES` 列出全部。

| userData | 說明 |
|---|---|
| `update(dt, { moving, attacking, dead, casting })` | 走路／漂浮、待機、陣亡（往後倒或落地）；`casting` 為真時維持施法姿勢（例如衝鋒時一直前傾） |
| `attack()` | 普攻動作（見下） |
| `cast(skillId)` | 技能動作（見下）；施法中再呼叫 `attack()` 會被忽略 |
| `hit()` | 受擊閃白（額外提供） |
| `height` | 血條高度（從模型原點算）：騎士 0.82、妖精 0.7、法師 0.95 |
| `hover` | 飛行高度：騎士 0、**妖精 0.6**、法師 0。**妖精的原點在腳底，view 要把根節點放在 `y = hover`**（血條＝`hover + height + 0.2`）；陣亡時模型自己往下掉 hover 的距離，剛好躺在地上 |
| `flying` | 妖精 `true` |

- **守燈騎士**：普攻＝蓄力舉劍＋身體後轉 0.1 秒 → 斬下＋跨步前轉 0.09 秒 → 停 0.06 秒 → 收劍 0.2 秒（比 v1 更有力）。
  `cast('whirl')`：劍平舉往外、原地轉一圈（0.55 秒，提燈手張開）；`cast('charge')`：前傾、劍往前刺、披風往後飛、快跑（至少 0.7 秒，`casting` 為真時持續）。
- **森林妖精**：金色短髮＋尖耳、綠葉洋裝配粉紅花瓣裙、兩對半透明發光翅膀（一直拍）、右手花朵魔杖（綠光）、全身淡綠光暈＋三顆繞身光點。
  普攻＝魔杖往前刺（0.09 秒）再收回；`cast(任何技能)`＝張開翅膀、雙手往外上舉、光暈放大（約 0.8 秒）。
- **星詠法師**：深藍長袍（金邊、金星）、白鬍子、往後彎的星星帽、右手法杖（頂端發光金星晶＋光暈）。
  普攻＝法杖往前指（杖頭朝目標）、星晶閃一下；`cast(任何技能)`＝法杖高舉過頭（杖身直立）、左手舉起、光暈變大（約 0.85 秒）。法杖掛在手上的樞紐會反向補償手臂角度，所以舉手時法杖不會倒過來。

## makeLamp()

精緻三層石座＋石柱＋鐵框大提燈（玻璃與火焰為獨立材質）＋暖色 `PointLight`（`userData.light`，不投影）＋光暈＋繞燈光點。

`update(dt, frac, time)`：`frac` 0–1（平滑追蹤）、`time` `'day'|'dusk'|'night'`。
燈光強度 ≈ (1.6 + 夜晚 × 5.2) × frac^0.6 × 閃爍；照射距離 4–9.5；`frac = 0` 時火焰熄滅、玻璃變暗。高度 1.75。

## makeSpawnGate(theme)

暗色粗石拱門＋紫色符文＋雙層反向旋轉的漩渦（加色）＋深紫底＋被吸進去的光點。`update(dt)` 驅動旋轉與脈動。漩渦面朝 ±Z（雙面），高度 1.4、寬約 1.05。

`theme === 'cave'`：**岩縫**——兩塊往中間傾斜的大岩石夾出三角形的縫、後面堵住像洞口、縫裡是窄長的紫色漩渦、底下長著發光紫水晶與發光裂紋、地上一圈紫色光圈、光點從地上飄進岩縫。高度 1.25、寬約 1.1，入口朝 +Z。

## makeProjectile(kind)

`arrow bolt rock boulder firebomb orb frost`，另有 `lightning`（備用小電光）；未知 kind 用法球。正面朝 +Z（view 會 `lookAt` 速度方向）。
第二章（英雄）：`fairyBolt`（亮綠光彈＋光尾＋兩片小葉）、`fireball`（火球＋三道往後竄、會跳動的火焰）、`starBolt`（五角星光彈，繞前進方向自轉）、`laser`（佔位：細長青色光棒，雷射由 C 畫）。發光零件全部 noDark。
`userData.update(dt)`（額外提供）：石頭翻滾、冰晶自轉、火彈與法球光暈閃動、火球火焰跳動、星星自轉。

## makeDecor(kind, rng = Math.random, theme)

kind：`tree pine rock mushroom house windmill fence grave dock bush crystal lamppost flower grassTuft`＋第二章 `stalagmite glowshroom cavecrystal minecart`（未知用 bush）。

### 第二章洞窟裝飾（cave.js）
- `stalagmite`（`X`）：深藍灰／紫灰石筍，6 種（單根高、三根一叢、雙柱、矮丘加小刺、高尖帶水滴、斷柱）。
- `glowshroom`（`U`）：一叢 3–5 朵發光蘑菇（青、青綠、紫、青紫混），傘與斑點 noDark；附光暈＋一顆往上飄的孢子，`userData.update(dt)`。
- `cavecrystal`（`C`）：岩座上一簇水晶（青、紫、青綠、藍）。**`userData.setLit(on)`**：被照到＝`MAT.glow`＋光暈變大變亮；沒照到＝`MAT.glowDim`（微弱發光，看得出那裡有水晶）。預設沒照到；`userData.lit`；`userData.update(dt)` 讓光暈平滑變化。
- `minecart`（`Q`）：鐵軌沿 x 軸橫跨整格（−0.5～0.5，相鄰格會接起來），**不隨機旋轉**（同 `fence`，直向請轉 90°）。變體：滿載礦石的礦車、傾斜的空礦車、只有鐵軌＋石頭。
- `theme === 'cave'` 時第一章的 kind 換成洞窟版：`rock→caveRock`（藍灰岩＋青苔）、`bush→caveFern`（暗青蕨叢）、`mushroom→caveFungus`（不發光的灰紫菇，**避免被當成光源**）、
  `tree→caveBigShroom`（大型灰紫菇樹）、`pine→stalagmite`、`crystal→cavecrystal`、`grassTuft→cavePebbles`（碎石）、`flower→caveSprouts`（小白菇芽）、
  `grave→caveGrave`、`lamppost→caveLampOff`（熄掉的舊礦燈柱，不發光）、`fence→caveFence`（礦坑木柵，不隨機旋轉）。其他 kind（house、windmill、dock）沿用第一章外觀。
- 第二章新 kind 不論 theme 都一樣；rng 的使用順序同第一章（變體 → 旋轉 → 縮放）。
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
| 第二章塔 | 燈籠 230 / 307 / 397（< 400）；稜鏡 340 / 432 / 520、分光 567、聚焦 562（< 900） |
| 第二章敵人 | 影子幽靈 291、挖洞地鼠 332、噴墨蝙蝠 336（< 350）；地鼠王 1011、深淵巨蟲 1344（含 6 節＋尾巴，< 1800） |
| 英雄 | 騎士 734、妖精 952、法師 819（< 1000） |
| 第二章其他 | 洞窟岩縫 705、投射物 20–154、洞窟裝飾 60–454 |

mesh 數：第一章敵人多 1 個（拆出來的眼睛）；巨蟲 16 個（頭、6 節 × 2、尾巴 × 2、嘴）。

每個模型 1–7 個 mesh（有動畫的部位才拆開）。

## tools/gallery.html

在專案根目錄 `python3 -m http.server 8201`，開 `http://127.0.0.1:8201/tools/gallery.html`。

| 參數 | 說明 |
|---|---|
| `time=day|dusk|night`（或 `night=1`） | 時段（夜晚自動套用 `setGlowStrength(1.6)`、`setModelLift(0.12)`） |
| `cam=front|top|game|far|close|side` | 鏡頭；`game`＝50° 俯視、畫面寬約 20 格（模擬手機遊戲畫面） |
| `only=towers|enemies|hero|props|projectiles|decor|mock` | 只顯示某一類；`mock`＝模擬遊戲場景（道路上走的敵人＋塔＋裝飾）。預設（不給 only）＝第一章全部，和 v1.3 一樣 |
| `only=ch2`（或 `ch2towers,ch2enemies,ch2props,ch2decor` 任選） | 第二章：燈籠 1–3＋熄滅、稜鏡 1–3＋分支＋無光、五種敵人（巨蟲繞圈走，看拖尾）、洞窟岩縫、英雄投射物、洞窟裝飾、第一章裝飾的洞窟版 |
| `only=heroes` | 三位英雄 × 走路／攻擊／待機／技能一／技能二／陣亡（妖精放在 `y = hover`） |
| `only=mock2` | 模擬洞窟遊戲畫面（自動 `dark=1`；配 `cam=game` 看 50° 俯視的辨識度） |
| `dark=1` | 洞窟暗色光照（看發光部分） |
| `dark=2` | 剪影測試：不是 noDark 的材質全部換成近黑色、非 noDark 的 Sprite 隱藏，只剩自發光部分（檢查眼睛、水晶是不是都拆成 noDark） |
| `attack=1` | 第二章敵人顯示攻擊動作 |
| `pick=archer,goblin` | 只顯示名稱含這些字的模型 |
| `frozen=1`、`anim=0`、`labels=0`、`hud=0`、`tone=aces`、`lift=0.1` | 冰凍狀態、停止動畫、隱藏標籤、隱藏說明、ACES 色調、自訂提亮 |
| `yaw= pitch= dist= cx= cz=` | 自訂鏡頭角度、距離倍率、中心 |
| `src=dev` | 直接讀 `models/index.js` |

頁面變數：`window.__gallery`（每個模型的三角形數、mesh 數、是否超出預算）、`window.__fireAll()`（全部開火／受擊／揮劍）、`window.__drawCalls`、
`window.__step(秒)`（固定步長推進動畫，截圖用；配 `anim=0` 或先 `__pause()` 就能拍到固定的動作時間點）、`window.__pause(on)`。
標籤顯示「三角形數 · mesh 數」，超出預算會變紅。
