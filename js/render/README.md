# js/render：場景、鏡頭、特效（擁有者：C）

合約見 `架構.md` §7。這裡記錄實作細節、**新增**的函式，以及整合時要注意的事。
（`models.js`、`models/**`、`palette.js` 是 B 的，不在本文件範圍。）

## 檔案
| 檔案 | 內容 |
|---|---|
| `world.js` | `createWorld`：renderer、場景、燈光、關卡建置、點選、標示、日夜天氣、畫質、迴圈 |
| `camera.js` | 鏡頭與手勢（觸控／滑鼠／鍵盤），慣性、縮放錨點、取景、震動 |
| `effects.js` | `createEffects`：吃 sim 事件的特效＋依 `game.state` 畫持續狀態 |
| `env/terrain.js` | 島嶼地形（合併成少量 mesh）、海岸距離場、地面高度 |
| `env/water.js` | 海面 shader（波紋、岸邊泡沫、淺灘、反光、霧） |
| `env/sky.js`、`env/lighting.js` | 天空、星星；白天／黃昏／夜晚 × 晴／雨／霧的參數與平滑過渡 |
| `env/weather.js` | 雨（Points＋水面漣漪） |
| `env/markers.js` | 格子高亮、射程圈、路線箭頭、流星瞄準圈 |
| `env/glows.js` | 夜晚的地面光池＋光暈（不增加真的燈光） |
| `env/merge.js` | 靜態裝飾依材質合併 |
| `env/rng.js` | 決定性亂數、雜訊 |
| `env/darkness.js` | **v2.0** 第二章黑暗：光照貼圖（DataTexture）＋受光材質的著色器補丁 |
| `env/cave.js` | **v2.0** 洞窟外圍岩壁、牆上發光礦石；B 還沒做洞窟裝飾時的備用模型 |
| `tools/world_test.html` | 測試頁（見最後一節） |

## world（合約之外新增的）
- `world.setQuality('high' | 'low')`：low＝pixelRatio 上限 1.25、陰影貼圖 1024。
- `world.groundHeight(x, z)`：格子空間座標的地面高度（塔基座頂 0.12、沙灘 -0.1、碼頭 -0.03、海 -0.35）。
- `world.cellAt(c, r)`：地圖字元；`world.lampPos`：`{ x, z }`（燈格中心）。
- `world.envParams()`：目前（過渡中的）環境參數，`night` 0–1。
- `world.flashLamp(sec)`：讓守護燈閃爍（effects 在 `leak` 時自動呼叫）。
- `world.pixelScale()`、`world.lamp`、`world.gates`、`world.cam`（見下）。
- `world.highlightCell(c, r, null)` 或 `c = null` 都是取消高亮。
- `buildLevel` 會自己套用 `levelDef.camera` 與 `levelDef.env`（0 秒），之後再呼叫 `setEnv`／`cam.reset` 也沒關係。
- **燈與傳送門的動畫不由 world 更新**（view.js／main.js 已經每幀呼叫 `lamp.userData.update`、`gate.userData.update`，world 再叫一次會變兩倍速）。world 只負責：在 `buildLevel` 時把 lamp 的 `update` 包一層，漏怪閃爍期間把 `frac` 乘上抖動係數。其他會動的裝飾（風車等）由 world 更新。
- 裝飾的點光源最多保留 3 盞（加守護燈的 1 盞），其餘關掉；夜晚亮度靠 glows。

## world.cam（camera.js）
- 操作：單指／左鍵拖曳＝平移（手指下的地面點跟著手指走）；雙指＝捏合縮放＋扭轉旋轉（超過 9° 才開始轉，以兩指中點為錨點）；右鍵／中鍵拖曳＝旋轉；滾輪＝以游標為錨點縮放（觸控板捏合也可）；WASD／方向鍵平移、Q/E 旋轉、+/- 縮放（輸入框有焦點時不攔）。
- 點擊判定：移動 < 8px 且 < 400ms 且只有一根手指，才呼叫 `world.onTap`；拖曳、捏合不會觸發。
- 俯角隨距離 41°～56°（拉近時比較平、拉遠時比較俯視）。
- `cam.reset()`：依畫面比例把整座島放進畫面（上方、左右留 HUD 空間）；`cam.fitDist` 是這時的距離，縮放範圍 `minDist = min(5.5, fit×0.6)`、`maxDist = fit×1.3`。
- `cam.focus(x, z, zoom?)`：平滑移到格子座標；`zoom` 1＝整島、2＝拉近一倍。
- `cam.shake(amp = 0.3, dur = 0.4)`：鏡頭震動（世界單位），重疊時取較大的。
- **新增** `cam.setAutoRotate(on, speed = 0.07)`：標題／地圖背景慢慢轉（`cam.enabled = false` 時也會轉）。
- **新增** `cam.setView({ yaw, zoom })`：套用開場鏡頭（等同改 `levelDef.camera` 後 `reset()`）。
- `cam.enabled`、`cam.isDragging()`、`cam.yaw`、`cam.dist`、`cam.target`。
- 視窗大小改變：沒動過鏡頭就重新取景，動過就只更新縮放範圍。

## effects（fx）
- `createEffects(world)` → `fx`；`fx.handle(ev)`；`fx.update(dt, state?)`；**新增** `fx.setState(state)`、`fx.clear()`、`fx.shake(amp, dur)`、`fx.stats()`。
- 全部用物件池／InstancedMesh／Points，事件發生時不 new 物件（飄字用 24 個預先建好的 canvas Sprite 輪流用）。閃光用一盞固定存在的 PointLight（數量不變 → 不會重編 shader），強度上限 3。
- **要給 state 才會畫的東西**（`fx.setState(game.state)` 或 `fx.update(dt, game.state)`，state 是原地更新的那個物件，設一次就好）：
  - 持續狀態：護盾泡泡（`shield > 0`）、冰塊（`frozen > 0`）、定身樹根（`rooted`）、暈眩星星（`stunned`）、緩速藍圈（`slow`）、燃燒火苗（`burning`）、被熄光的塔冒黑煙（`dimmed`）。
  - `state.zones` 的地帶：`fire`（焦痕＋火苗）、`thorns`（法陣＋冒刺）、`meteorMark`（紅色脈動瞄準圈）。有 `state.zones` 時 fx 就以它為準；沒給 state 時，燃燒彈與流星雨會用事件自己產生暫時的地帶。
  - 需要查位置的事件：`status`、`shieldBreak`、`heroAttack`、`heroHurt`（其他事件都用事件自帶的座標）。
- 吃的事件（A 的欄位，見 `js/sim/README.md`）：`spawn death leak shoot hit explode beam pulse status split summon dim build upgrade sell gold waveStart waveCleared heroAttack heroHurt heroDeath heroRespawn heroLevel skill won lost`，以及 A 新增的 `shieldBreak`（護盾碎片）、`aura`（紫色光環）。
  - `hit`：`kind:'lightning'` 不另外畫（`beam` 已經畫了）；`y` 用 A 給的高度，沒給才補到身體中段。
  - 金幣飄字：`death`／`sell` 和隨後的 `gold` 事件會去重，同一處只出現一次 `+N`。
  - `skill meteor` 用事件的 `radius`、`delay`（沒有就讀 `SKILLS.meteor`）；隕石在 `delay` 秒內落下，衝擊由 `explode kind:'meteor'` 觸發（震動＋閃光）。
  - `leak` 會讓燈閃爍＋紅色暈影＋小震動。

## v2.0 第二章：洞窟、黑暗、雷射、英雄特效（合約見 `架構_第二章.md` §4）

### 洞窟主題（`levelDef.theme === 'cave'`）
- `buildLevel` 依 theme 建：洞窟地面貼圖（石地、碎石、踩實的土路、石板開放地、黑色地洞出生點）、深色崖壁與石台、`.`／`,` 上的碎石（合併進地形）、外圍一圈往上長的岩壁＋石筍＋嵌在牆上的發光礦石（`env/cave.js`，在地圖矩形外 0.2～7 格，一般俯角不會擋到畫面）。`~` 是黑色地底湖／深淵。
- 裝飾：`C→cavecrystal`、`U→glowshroom`、`X→stalagmite`、`Q→minecart`，第一章的字元（`R K M`…）照用；一律呼叫 `makeDecor(kind, rng, 'cave')`。B 的 `DECOR_KINDS` 沒有某個 kind 時改用 `env/cave.js` 的簡單備用模型。出生點 `makeSpawnGate('cave')`。洞窟不長草叢小花。
- **洞窟水晶（中繼）**：B 的 `cavecrystal` 有 `userData.setLit(on)`（預設沒照到＝微光）。world 每幀依 `state.lights` 裡 kind `'crystal'` 的光源（同一格）呼叫 `setLit(on)`；沒有黑暗時一律亮。`world.crystals()` 回傳格子 key → 物件。
- `minecart` 不隨機旋轉：相鄰 `Q` 是直向時轉 90°（B 的模型自帶鐵軌，沿 x 軸橫跨整格，相鄰格會接起來）。洞窟 `.` 上的小碎石／小菇芽用 B 的 `grassTuft`／`flower` 洞窟版，比草地稀疏。
- `world.theme`：`'island' | 'cave'`。
- `setEnv({ time: 'cave', weather: 'clear' | 'mist' })`：`lighting.js` 的 `cave` 預設（冷色頂光、近黑的霧與天空、深黑湖面）；`mist`＝瘴氣：霧色偏紫＋貼地漂浮的霧團（`weather.js` 的 `createMist`，霧團亮度也吃光照貼圖）。

### 黑暗效果（`env/darkness.js`）
- **`world.bindGame(state)`**：整合者建立 game 後呼叫；`clearLevel()` 自動解除。`state.dark` 為 true 才有效果（還沒 bind 前依 `levelDef.dark`，所以進關第一幀就是暗的）。dark 切換時 0.8 秒淡入淡出。
- 作法：**不用 PointLight**。每 1/45 秒（60fps＝隔幀）依 `state.lights` 在 CPU 畫一張光照貼圖（每格 3×3 像素、地圖外多 3 格；R＝亮度、G＝暖色、B＝冷色；柔邊約 0.9 格；中心稍亮）。`on:false` 的光源與消失的光源會在約 0.3 秒內淡掉（燈籠熄滅會慢慢暗下去），點亮約 0.15 秒。`r ≥ 40`（流星雨）＝全場亮。
- 受光材質（MeshStandard／Lambert／Phong／Toon）用 onBeforeCompile 補一段（包住原本的 onBeforeCompile，program 快取鍵加 `|dark1`，和 B 的 `patchFx` 相容）：依世界座標 xz 取樣貼圖 → 光外＝原色 ×（0.105, 0.125, 0.185）＋冷色輪廓光（約 13% 冷色）、光內＝原色 × 暖／冷色調 × 1.08；**`totalEmissiveRadiance`（自發光）原封不動加回**，所以 vc 材質裡 `fx.x` 發光的眼睛、窗戶也會亮。
- **不受影響**：`material.userData.noDark === true`、加色混合、MeshBasic、Sprite、Points、ShaderMaterial（特效、血條、標示、光暈都屬於這類）。
- 補丁時機：只有黑暗第一次開啟時才補（第一章從頭到尾不碰任何材質，畫面與 v1.3 逐像素相同）；補過的材質在 `uDkOn = 0` 時走 if 分支跳過，結果也完全相同。黑暗開啟時 `world.render()` 前會走一遍 `levelRoot`＋`entities`（WeakSet 查表，很便宜），view.js 隨時新增的模型、換上的閃白／冰凍材質都會在第一次畫之前補好。進洞窟時先補好 `MAT` 全部共用材質，避免遊戲中才編譯卡一下。
- 自己的 shader 也吃同一份貼圖：海面（光外近黑、光裡映出暖／冷色波光）、一般混合的粒子（煙、碎屑在暗處變暗）、瘴氣霧團。特效的碎石、尖刺、土堆（Lambert）也加進補丁範圍；加色的光、刀光、雷射、技能特效不變暗，所以黑暗中特效一樣亮。
- 新增 API：`world.addLight(x, z, r, sec, warm, cool, 強度)`（特效的短暫光）、`world.pushLight(x, z, r, warm, cool, 強度)`（只亮這一幀，飛行中的火球每幀推）、`world.lightAt(x, z)`（0–1）、`world.isDark()`、`world.forceDark(true|false|null)`（測試用）、`world.addDarkRoot(obj)`（其他根節點也要變暗）、`world.darkUniforms`、`world.darkness.stats()`。

### 雷射（effects.js，讀 `state.towers[i].lasers`）
- 從水晶（`y = 1.2 + 0.15 × level`，分支 1.8）畫到目標（`y < 0.1` 時補到身體中段）。全部光束在**同一個 mesh**（一個 draw call，最多 24 道），面向鏡頭的帶狀＋往前流動的光脈衝與螺旋光絲；`power` 越高越粗越亮，兩端有光點與火花。
- 一般：青白色；分支 a 分光：三道各自青／粉紫／金；分支 b 聚焦：粗白青光束，貫穿延伸 0.9＋power 格後淡出。`laserOn` 時水晶閃一下星芒。

### 新特效（事件見合約 §2）
| 事件 | 特效 |
|---|---|
| `lanternOn` | 暖光爆開、光圈擴散、火星往上飄（＋短暫照亮） |
| `lanternOut` | 黑煙、火星落下、往內縮的暗環 |
| `ink` | 墨汁從蝙蝠噴下、地面墨漬（約 3 秒） |
| `burrow`／`emerge` | 土塊、塵土環、地洞痕跡、3D 土堆（冒起→停留→沉下去；冒出後留一圈）；`abyssWorm`／`moleKing` 是大號版（震動＋暗色閃屏）；`spawn` 這兩種王也會竄出 |
| 潛地中（`enemies[i].burrowed`） | 跟著走的 3D 隆起土堆、沿路留下會淡掉的土痕、翻出土塊 |
| `reveal` | 冷白光環＋往上旋的幽光 |
| `segment` | 紫黑黏液與碎塊、紫色光環、震動 |
| `eat` | 暖光被吸進中心＋內縮黑環，0.3 秒後翻土＋暗色閃屏＋震動 |
| 光源光暈（黑暗時） | 亮著的燈籠腳下暖光圈、被照亮的水晶紫色光暈＋星芒 |

### 英雄特效
- `heroAttack{ attack }`：`sword` 金白雙層刀光＋命中火花星芒；`bolt` 妖精手上綠白光點；`fireball` 法杖火光。`attack` 沒給時依 `HEROES[state.hero.type].attack`（再沒有就是劍）。
- 英雄投射物（`state.projectiles` 的 `fairyBolt`、`starBolt`、`fireball`）：fx 每幀畫拖尾＋跟隨光；**投射物從 state 消失時**畫命中特效（光彈星芒、火球爆炸），不依賴事件格式。`explode{kind:'fireball'}` 也會爆，0.25 秒內同一處只爆一次；`hit` 的這幾種 kind 只補小火花。
- `heroSkill{ skill, x, z, radius, tx, tz }`（中心＝`tx,tz`，沒有就 `x,z`；旋風斬、星塵連射以英雄位置為中心）：
  - `whirl` 旋風斬：兩層旋轉劍光環（跟著英雄）、衝擊波、切線方向的風、星芒、震動
  - `charge` 聖燈衝鋒：地面金色光痕從起點長到終點、沿途光粒（sim 的 `hero.dashing` 或 `state === 'charge'` 期間跟著英雄、衝完才撞擊；沒有就依距離估時間），抵達時光柱＋大衝擊波＋碎石＋閃屏＋震動
  - `starburst` 星塵連射：一圈星芒爆開＋光環（星塵彈本身由投射物拖尾畫）
  - `pollen` 花粉迷霧：粉色霧團＋花粉星點，持續 `HERO_SKILLS.pollen.duration` 秒，地面粉色法陣
  - `firestorm` 火焰風暴：火圈往上竄、5 根火柱輪流噴發、天上落下 6 顆小火球、閃屏、震動（之後的燃燒地帶由 `state.zones` 的 fire 畫）
  - `icefall` 冰隕：中間一根大冰柱＋6 根小冰柱從天而降，落地碎冰、冰刺留在地上、霜環、閃屏、震動
- 所有技能都會加短暫的光（黑暗中特效周圍會被照亮）；sim 的 `spell` 光源照樣算。

### 其他
- `world.showCastRange(x, z, radius)` / `hideCastRange()`：金色虛線外圈＋往外擴散的波紋（每幀呼叫也只是改位置）。
- 第一章的 `hit`／`explode`／事件格式全部照舊；`Slashes.emit` 多了選用參數，第一章呼叫方式不變。
- **第一章唯一的畫面差異**：騎士普攻改成新的雙層刀光（英雄特效升級，合約允許）。地形、海、天空、日夜雨霧、其他特效逐像素相同（測試頁白天／夜晚／雨的截圖比對過）。

## 給整合者（main.js／view.js）的建議
1. 建立 game 之後呼叫 `fx.setState(game.state)`；切關或回地圖時呼叫 `fx.clear()`（清掉殘留粒子、計時器）。目前 main.js 沒有呼叫，所以上面「要給 state」的那些效果不會出現。
2. 給了 state 之後，fx 會畫 `state.zones`；view.js 自己畫的地帶圓盤可以拿掉，不然會疊兩層。
3. **dt 要夾成 ≥ 0**：瀏覽器第一幀的 rAF 時間戳可能比 `performance.now()` 早（頁面剛載入、主執行緒很忙時差到 1～2 秒），dt 變負的。world／fx 內部有夾，但直接傳給 `lamp.userData.update` 的 dt 沒夾，B 的 `damp()` 遇到負 dt 會爆衝（實測燈的光暈放大到 28 倍、點光源強度 15、照亮半個島，幾秒後才恢復）。main.js 迴圈改成 `Math.min(0.1, Math.max(0, (now - last) / 1000))` 即可。
4. `leak` 時 main 也呼叫了 `world.cam.shake(0.15)`，fx 也會震；兩者取較大值，不會疊加，可留可拿。
5. **v2.0**：順序維持 `buildLevel → createGame → view.reset → fx.setState → world.bindGame`（main.js 已是這樣）。英雄技能瞄準時每幀呼叫 `world.showCastRange(hero.x, hero.z, castRange)`，離開瞄準記得 `world.hideCastRange()`（`clearLevel` 也會清）。
6. `view.js` 不用處理黑暗：模型材質由 world 自動補丁；`hidden` 的敵人照合約隱藏即可。雷射、英雄投射物拖尾、潛地土痕都由 fx 讀 state 畫，不需要事件以外的呼叫。

## 效能（SwiftShader 實測，僅供比較）
10 關全部建置 41–79 ms；靜態場景 41–76 draw calls、17k–28k 三角形（含 B 的模型）；測試頁含 5 座塔＋8 隻敵人約 110–130 draw calls、30k 三角形。重複建關 12 次，貼圖數固定、幾何數只在第一次看到新裝飾時增加（B 的快取），沒有洩漏。

### v2.0 效能
- 光照貼圖：24×16 地圖＝84×60 像素；21 個光源（6 燈籠 r3.4、守護燈 r4.5、6 蘑菇、3 水晶、4 雷射光、英雄）一次重算 node 實測中位數約 0.09–0.15 ms，60fps 時隔幀才算，平均每幀 < 0.1 ms（iPhone 估計 2–3 倍仍 < 0.5 ms）。上傳 20 KB／次。
- 黑暗不加 draw call、不加燈光；只多一次貼圖取樣。補丁後的受光材質共用同一份 program（快取鍵 `|dark1`）。
- 特效池沒東西時整個隱藏（粒子、地面貼片、碎石、尖刺、冰柱…），閒置時反而比 v1.3 少約 10 個 draw call；雷射全部一個 draw call。
- 洞窟測試頁（12 座塔／燈籠、8 隻敵人、黑暗＋雷射）約 150 draw calls、37k 三角形（SwiftShader）。

## 測試頁 `tools/world_test.html`
`python3 -m http.server 8202` 後開 `http://127.0.0.1:8202/tools/world_test.html`。左上「測試面板」可切時段／天氣、觸發每一種特效。
網址參數：`level=n`（用 levels.js 第 n 關；第 11 關以後是洞窟）、`map=cave`（內建洞窟範例：`. , ~ # o U C X Q = B S L R K M` 全部字元）、`dark=0|1`（預設依關卡 `dark`）、`hero=knight|fairy|mage`、`orbit=1`（一盞繞圈移動的測試光）、`time=day|dusk|night|cave`、`weather=clear|rain|fog|mist`、`q=low`、`panel=0|min`、`paths=0`、`enemies=0`、`towers=0`、`status=0`（不加持續狀態）、`move=0`（敵人不動）、`fx=hit,meteor,...`（載入後自動觸發）。省略 `level`／`map`＝第一章範例島。
洞窟模式有一個簡化的「假 sim」：依合約 §2 算 `state.lights`（守護燈、燈籠、英雄、法師塔、蘑菇、水晶中繼、火焰地帶、雷射目標、技能閃光、流星全場亮）、敵人 `lit`／`hidden`（幽靈在暗處隱形、地鼠定時鑽地）、噴墨蝙蝠讓燈籠熄滅、稜鏡塔鎖定光裡的敵人（power 3 秒爬升、分光三道）。**點地面讓英雄走過去＝移動英雄的光**。
面板：「黑暗」開關／移動光／施放範圍／流星；「英雄」普攻與六個技能；「洞窟」燈籠熄／亮、噴墨、鑽地、冒出、幽靈現形、巨蟲竄出、斷節、吞燈籠。
主控台：`T.fire('firestorm')`、`T.step(秒)`（暫停並固定步長推進，截圖用）、`T.snap([{ fx, step, at, zoom, label }], 欄數)`（一次拍好幾格特效拼成一張）、`T.perf(n)`（黑暗貼圖耗時、draw calls）、`T.levelGrid(欄, from, to)`（關卡縮圖拼一張）、`T.moveHero(x, z)`、`T.world`、`T.fx`、`T.state`。
