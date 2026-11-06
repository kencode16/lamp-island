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

## 給整合者（main.js／view.js）的建議
1. 建立 game 之後呼叫 `fx.setState(game.state)`；切關或回地圖時呼叫 `fx.clear()`（清掉殘留粒子、計時器）。目前 main.js 沒有呼叫，所以上面「要給 state」的那些效果不會出現。
2. 給了 state 之後，fx 會畫 `state.zones`；view.js 自己畫的地帶圓盤可以拿掉，不然會疊兩層。
3. **dt 要夾成 ≥ 0**：瀏覽器第一幀的 rAF 時間戳可能比 `performance.now()` 早（頁面剛載入、主執行緒很忙時差到 1～2 秒），dt 變負的。world／fx 內部有夾，但直接傳給 `lamp.userData.update` 的 dt 沒夾，B 的 `damp()` 遇到負 dt 會爆衝（實測燈的光暈放大到 28 倍、點光源強度 15、照亮半個島，幾秒後才恢復）。main.js 迴圈改成 `Math.min(0.1, Math.max(0, (now - last) / 1000))` 即可。
4. `leak` 時 main 也呼叫了 `world.cam.shake(0.15)`，fx 也會震；兩者取較大值，不會疊加，可留可拿。

## 效能（SwiftShader 實測，僅供比較）
10 關全部建置 41–79 ms；靜態場景 41–76 draw calls、17k–28k 三角形（含 B 的模型）；測試頁含 5 座塔＋8 隻敵人約 110–130 draw calls、30k 三角形。重複建關 12 次，貼圖數固定、幾何數只在第一次看到新裝飾時增加（B 的快取），沒有洩漏。

## 測試頁 `tools/world_test.html`
`python3 -m http.server 8202` 後開 `http://127.0.0.1:8202/tools/world_test.html`。左上「測試面板」可切時段／天氣、觸發每一種特效。
網址參數：`level=n`（用 levels.js 第 n 關；省略＝內建範例地圖，包含全部地圖字元）、`time=day|dusk|night`、`weather=clear|rain|fog`、`q=low`、`panel=0|min`、`paths=0`、`enemies=0`、`towers=0`、`status=0`（不加持續狀態）、`move=0`（敵人不動）、`fx=hit,meteor,...`（載入後自動觸發）。
主控台：`T.fire('meteor')`、`T.step(秒)`（暫停並固定步長推進，截圖用）、`T.levelGrid()`（10 關縮圖拼一張）、`T.world`、`T.fx`、`T.state`。
