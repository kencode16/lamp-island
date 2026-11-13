# js/ui — 介面（擁有者：D）

合約見 `架構.md` §8 與 `架構_第二章.md` §5（v2.0）。這裡記錄檔案分工、**新增**的 API／handler、資料格式的寬容處理，以及給整合者的注意事項。

## 檔案
| 檔案 | 內容 |
|---|---|
| `ui.js` | 入口 `createUI(root, handlers)`：畫面切換、鍵盤、Toast、橫幅、教學泡泡、技能瞄準提示 |
| `hud.js` | 遊戲中 HUD（差異更新，每幀呼叫也不重建 DOM） |
| `menus.js` | 蓋塔輪盤、塔選單（升級／分支二選一／賣出），透明 scrim 擋住點擊穿透 |
| `screens.js` | 標題、航海圖（關卡地圖）、關卡介紹卡、天賦、暫停、結算、設定、直向提示 |
| `map.js` | 航海圖 SVG：`renderChart`（第一章海圖，10 個島嶼）、`renderCave`（第二章洞窟，10 個發光節點） |
| `chapters.js` | 章節定義 `CHAPTERS`、`chapterOf(lv)`、`chapterLevels`、`lastLevelOf`、`isChapterUnlocked` |
| `save.js` | 存檔（localStorage 鍵 `shoudeng-island.progress.v1`，v2.0 沿用同一個鍵；失敗改存記憶體） |
| `dom.js` | `h()` 建元素、內嵌 SVG 圖示 `icon(name)`、數字格式 `fmt()` |
| `levels_fallback.js` | `js/data/levels.js` 載不到時的備用關卡資料（只給地圖與測試頁用） |
| `../../style.css` | 全部樣式；主題變數在 `.ui-root`（羊皮紙、木框、金邊、深藍綠） |

## v2.0（第二章＋三位英雄）對外介面
- **`handlers.onStartLevel(levelId, heroId)`**：關卡介紹卡按「出發」。`heroId` 一定是已解鎖的英雄（`knight|fairy|mage`）；UI 已先把選擇寫進 `progress.hero` 並存檔。
- **`handlers.onHeroSkill(skillId)`**：按英雄技能鈕或鍵盤 `C`（第一個）／`V`（第二個）。UI 會先擋掉：英雄陣亡、`unlocked:false`（等級不夠）、冷卻中（各自 toast＋`error` 音效），這些情況**不會**呼叫。要指定地點的技能（`HERO_SKILLS[id].needsTarget`）請 main 呼叫 `ui.setTargeting(skillId)`（和流星雨同一套：提示條變紫色、文字「點地面施放火焰風暴」、按鈕外框發光；再按一次同一顆＝取消，會呼叫 `onCancelTargeting`）。
- **`ui.showResult({ won, stars, lamp, levelId, isLast, unlocks })`**：`unlocks: [{ kind: 'hero', id: 'fairy' }, { kind: 'chapter', id: 2 }]`，勝利時在星星之後彈出「解鎖新英雄：森林妖精！」「第二章開放！」。`isLast` 只在全部關卡最後一關（第 20 關）為真；第 10 關 `isLast:false` 就會顯示「下一關」。最後一關通關文字依章節（第二章：「恭喜！洞窟最深處也點亮了燈」）。
  - main 可用 `unlocksForClear(progress, levelId, LEVELS)` 算 `unlocks`：**要在寫入這關星數之前呼叫**（這關以前過過就回傳 `[]`；章節只在 LEVELS 裡真的有該章關卡時才列出）。
- **HUD**：頭像依 `state.hero.type` 換（騎士／妖精／法師），名稱、toast 文字也跟著換。英雄技能鈕讀 `state.hero.skills[id] = { cd, cdMax, unlocked, ready }`，順序照 `HEROES[type].skills`；沒有 `hero.skills` 時不顯示。`unlocked:false` 顯示鎖頭＋「Lv3」（取 `HERO_SKILLS[id].minLevel`）；冷卻中顯示秒數與環形進度；英雄陣亡時整組變灰。手機上英雄技能在左下（頭像右邊），流星雨／冰封在右下，不會擠在一起。
- **航海圖分章**：關卡依 `LEVELS[i].chapter`（沒有＝1）分組，頂端分頁「第一章／第二章」（鍵盤 ←／→）。第 2 章在第 1 章最後一關（第 10 關）過關後開放，之前顯示鎖住的洞窟預覽與「打倒夜之君主後開放」；開放了但 LEVELS 裡還沒有第二章關卡時顯示「敬請期待」。進入地圖時自動選章：剛開放的新章 → 剛玩過那關的章 → 目前該挑戰那關的章。總星數上限＝關卡數 × 3（20 關＝60）。
- **英雄選擇**：關卡介紹卡右半部三張卡（頭像、名稱、定位 `role`、兩個特點標籤〔由 `blocks/flying/splash/air/hp` 推出〕、兩個技能名稱），下方顯示選中英雄的 `desc`。未解鎖顯示鎖頭＋「通過第 N 關解鎖」（`HEROES[id].unlockAfter`）。鍵盤 1–3 選英雄。
- **塔選單**：燈籠（`TOWERS[type].kind === 'light'`）只顯示「照亮範圍」（`stats.light ?? tower.light ?? stats.range`）與「不會攻擊」，升級差異顯示照亮範圍；`tower.out > 0` 時提示被噴墨弄熄。稜鏡塔（`needsLight`）傷害顯示「/秒」、不顯示攻速、加「☀ 需要光照」標籤；`tower.active === false` 時提示「這座塔目前在暗處，不會攻擊」。
- **蓋塔輪盤**：選項照 main 給的（洞窟地面只給燈籠就只顯示燈籠）；1 個選項放在格子正上方，5、6 個排成五角／六角形。保險起見，`TOWERS[type].unlock` 大於目前關卡編號的選項 UI 一律不顯示。鍵盤 1–6 對應 `TOWER_ORDER`。

### 存檔欄位（v2.0）
`loadProgress()` → `{ stars, best, talents, hero, settings }`。新增 `hero`（上次選的英雄 id，預設 `'knight'`）；舊存檔沒有這欄會補成騎士，`stars`／`best` 的 11–20 關照舊用關卡 id 當鍵。`talents` 會濾掉不存在的天賦 id。
`save.js` 新增：`isHeroUnlocked(p, heroId)`、`chosenHero(p)`（上次選的還沒解鎖就回騎士）、`unlocksForClear(p, levelId, levels?)`、`isChapterUnlocked(p, ch, levels)`（也從 `ui.js` 轉出）。

## handlers
合約內的都支援。以下是**選填**的額外 handler（沒給也能動）：
- `onMenuClosed(reason)`：使用者關掉選單時通知。reason：`'action'`（選了蓋塔／升級／賣出，**先**通知關閉，**再**呼叫 `onBuild`／`onUpgrade`／`onSell`）、`'outside'`（點選單外）、`'cancel'`（按 × 或點英雄頭像）、`'esc'`。由 `ui.closeMenus()` 關閉或被另一個選單取代時**不**通知。
- `onScreen(name)`：畫面換成 `'title' | 'map' | 'talents' | 'game'` 時通知（同一畫面不重複通知）。
- `onHeroSelect()`：點英雄頭像。有這個 handler 時，UI 不顯示提示文字，選取／取消與提示都交給 main。**main 要呼叫 `ui.setHeroSelected(on)` 讓頭像外框同步**（UI 自己不知道英雄有沒有被選）。英雄陣亡時點頭像只會顯示「N 秒後復活」，不呼叫 handler；正在瞄準技能時會先取消瞄準（會呼叫 `onCancelTargeting`）。
- `onSound(name)`：UI 音效（`click open error star`）。**沒給就直接用 `js/audio/audio.js` 的 `audio.play(name)`**（同一個模組實例）。蓋塔／塔選單打開時 UI 不播 `open`（main 自己播）。結算畫面的星星音效由 main 呼叫 `audio.playStars` 負責、`victory`／`defeat` 由 audio 的 `won`／`lost` 事件負責，UI 都不播（天賦點亮時 UI 會播 `star`）。

## 新增的 ui 方法（合約以外）
`ui.setLevels(list)`（UI 也會自己動態 import `js/data/levels.js`；呼叫過 `setLevels` 之後就以呼叫端的資料為準，不會被自動載入的覆蓋）、`ui.setMapChapter(n)`／`ui.mapChapter`、`ui.level`（目前 showGame 的 levelDef）、`ui.showSettings(credits?)`（`true` 直接開製作名單）、`ui.setSpeed(1|2)`（只同步顯示，不呼叫 `onSpeed`）、`ui.setHeroSelected(on)`、`ui.isMenuOpen()`、`ui.menuKind()` → `'build' | 'tower' | null`，唯讀屬性 `ui.screen / paused / speed / targeting / progress`。`ui.js` 也轉出 `loadProgress / saveProgress / starsEarned / starsSpent`。

## 資料格式的寬容處理
- 蓋塔選項的 `reason` 可以是 A 的代碼（`'no-gold'`…），也可以是先翻好的中文（main 傳的是「金幣不夠」「尚未解鎖」這類）：UI 會轉回代碼。`locked` 的塔不顯示；`no-gold` 的選項在金幣變多時會自動變成可蓋（`updateHUD` 內處理）。認不得的中文原樣顯示。
- `updateHUD(state)`：`nextWaveIn == null`（prep 或最後一波開始後）會隱藏「提早叫波」；prep 顯示「開始第 1 波」；`hero.xpNext == null`（滿級）經驗條顯示全滿；技能 `unlocked:false` 的按鈕不顯示。
- `showResult({ won, ... })`：勝利時 UI 也會用 `recordResult` 寫進度（取最大值，和 main 自己寫的結果一致，不會互蓋；`loadProgress()` 在同一次執行中回傳同一個物件）。

## 版面
- 根層 `pointer-events: none`，只有按鈕等可互動元素吃事件，3D 畫面照樣可拖曳；UI 上的 pointer／click 事件不會冒泡到 canvas。
- 選單開著時有一層透明 scrim：點外面＝關閉選單，這一下不會穿透到 3D（所以 main 的 `onTap` 在選單開著時不會收到點擊）。
- 選單會夾在畫面與 safe-area 內，並且盡量放在上方 HUD 列（金幣、燈、叫波）下面；被推離原位時用小圈標出原本的格子。
- 矮螢幕（`max-height: 520px` 或 `max-width: 760px`）用精簡版：隱藏英雄資訊卡、技能名稱、鍵盤提示等；介紹卡改成較密的兩欄；天賦頁五條分支一次看約四條，左右滑動看第五條。寬度 761–1180 的電腦畫面也會隱藏英雄資訊卡，讓教學泡泡有位置。觸控裝置不顯示鍵盤提示。直向且寬度 ≤ 900px 顯示「請把手機轉成橫向」。
- 換畫面、開始新關卡、出結算時，會清掉還沒播完的橫幅（避免「第 N 波」蓋在結算卡上）。

## 鍵盤
空白＝暫停、F＝速度、N＝叫波、Z／X＝流星雨／冰封、C／V＝英雄技能、1–6＝蓋塔（輪盤開著時）、U＝升級、1／2＝選分支、Del／Backspace＝賣出（鍵盤直接賣；觸控要按兩次確認）、Esc＝關閉／取消／暫停、Enter＝標題開始／出發／結算的主要按鈕；航海圖：←／→ 換章、介紹卡開著時 1–3 選英雄。WASD、Q/E、方向鍵、+/- 留給鏡頭。

## 測試頁 `tools/ui_test.html`
本機 `python3 -m http.server 8203` 後開 `http://127.0.0.1:8203/tools/ui_test.html?screen=…`：
- 假資料：`screen=title|map|levelinfo|talents|settings|game|build|tower|branch|max|result|lost|final|pause|targeting|tip`，另有 `at=edge|left`（選單貼邊）、`dead=1`、`prep=1`、`locked=1`、`log=1`（顯示 handler 呼叫紀錄，`window.__log`）。
- v2.0 假資料：`screen=map2|map2lock|heropick|herohud|herotarget|talents5|unlock|unlockch|final2|lantern|prism|prismbranch|build1|build6`，另有 `hero=knight|fairy|mage`、`hlv=3`（英雄等級，決定第二個技能是否解鎖）、`cleared=N`（假進度：通過 1–N 關）、`level=N`（heropick／herohud 用哪一關）、`out=3`（燈籠被噴墨）、`skill=id`（herotarget）。測試頁會把正式 LEVELS 與備用的第二章資料合併後 `ui.setLevels`。
- 真資料：`real=1&level=3` 用 A 的 `createGame` 驅動 HUD 與選單，選項資料和 `js/main.js` 傳的一樣；`window.__real.openBuild(i)`／`__real.openTower(id)`；技能瞄準中點畫面＝在該處施放（英雄技能用 `game.castHeroSkill`）。`level=11`、`hero=fairy` 要等 F／A 的資料與功能。

## 製作名單
設定視窗裡的「製作名單」按鈕：開頭一句「遊戲由 Claude 與子代理團隊以程式製作；3D 模型與部分音效為程式生成。」，下面用 fetch 讀專案根目錄 `CREDITS.txt`（路徑用 `import.meta.url` 算，index.html 與 tools/ 頁面都能讀），可捲動、可選取文字；讀取失敗顯示簡短說明。Esc 先回到設定，再按一次關閉。
