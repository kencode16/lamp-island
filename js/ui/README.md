# js/ui — 介面（擁有者：D）

合約見 `架構.md` §8。這裡記錄檔案分工、**新增**的 API／handler、資料格式的寬容處理，以及給整合者的注意事項。

## 檔案
| 檔案 | 內容 |
|---|---|
| `ui.js` | 入口 `createUI(root, handlers)`：畫面切換、鍵盤、Toast、橫幅、教學泡泡、技能瞄準提示 |
| `hud.js` | 遊戲中 HUD（差異更新，每幀呼叫也不重建 DOM） |
| `menus.js` | 蓋塔輪盤、塔選單（升級／分支二選一／賣出），透明 scrim 擋住點擊穿透 |
| `screens.js` | 標題、航海圖（關卡地圖）、關卡介紹卡、天賦、暫停、結算、設定、直向提示 |
| `map.js` | 航海圖 SVG（10 個島嶼節點、航線、鎖頭、星數） |
| `save.js` | 存檔（localStorage 鍵 `shoudeng-island.progress.v1`；失敗改存記憶體） |
| `dom.js` | `h()` 建元素、內嵌 SVG 圖示 `icon(name)`、數字格式 `fmt()` |
| `levels_fallback.js` | `js/data/levels.js` 載不到時的備用關卡資料（只給地圖與測試頁用） |
| `../../style.css` | 全部樣式；主題變數在 `.ui-root`（羊皮紙、木框、金邊、深藍綠） |

## handlers
合約內的都支援。以下是**選填**的額外 handler（沒給也能動）：
- `onMenuClosed(reason)`：使用者關掉選單時通知。reason：`'action'`（選了蓋塔／升級／賣出，**先**通知關閉，**再**呼叫 `onBuild`／`onUpgrade`／`onSell`）、`'outside'`（點選單外）、`'cancel'`（按 × 或點英雄頭像）、`'esc'`。由 `ui.closeMenus()` 關閉或被另一個選單取代時**不**通知。
- `onScreen(name)`：畫面換成 `'title' | 'map' | 'talents' | 'game'` 時通知（同一畫面不重複通知）。
- `onHeroSelect()`：點英雄頭像。有這個 handler 時，UI 不顯示提示文字，選取／取消與提示都交給 main。**main 要呼叫 `ui.setHeroSelected(on)` 讓頭像外框同步**（UI 自己不知道英雄有沒有被選）。英雄陣亡時點頭像只會顯示「N 秒後復活」，不呼叫 handler；正在瞄準技能時會先取消瞄準（會呼叫 `onCancelTargeting`）。
- `onSound(name)`：UI 音效（`click open error star`）。**沒給就直接用 `js/audio/audio.js` 的 `audio.play(name)`**（同一個模組實例）。蓋塔／塔選單打開時 UI 不播 `open`（main 自己播）。結算畫面的星星音效由 main 呼叫 `audio.playStars` 負責、`victory`／`defeat` 由 audio 的 `won`／`lost` 事件負責，UI 都不播（天賦點亮時 UI 會播 `star`）。

## 新增的 ui 方法（合約以外）
`ui.setLevels(list)`（UI 也會自己動態 import `js/data/levels.js`）、`ui.showSettings(credits?)`（`true` 直接開製作名單）、`ui.setSpeed(1|2)`（只同步顯示，不呼叫 `onSpeed`）、`ui.setHeroSelected(on)`、`ui.isMenuOpen()`、`ui.menuKind()` → `'build' | 'tower' | null`，唯讀屬性 `ui.screen / paused / speed / targeting / progress`。`ui.js` 也轉出 `loadProgress / saveProgress / starsEarned / starsSpent`。

## 資料格式的寬容處理
- 蓋塔選項的 `reason` 可以是 A 的代碼（`'no-gold'`…），也可以是先翻好的中文（main 傳的是「金幣不夠」「尚未解鎖」這類）：UI 會轉回代碼。`locked` 的塔不顯示；`no-gold` 的選項在金幣變多時會自動變成可蓋（`updateHUD` 內處理）。認不得的中文原樣顯示。
- `updateHUD(state)`：`nextWaveIn == null`（prep 或最後一波開始後）會隱藏「提早叫波」；prep 顯示「開始第 1 波」；`hero.xpNext == null`（滿級）經驗條顯示全滿；技能 `unlocked:false` 的按鈕不顯示。
- `showResult({ won, ... })`：勝利時 UI 也會用 `recordResult` 寫進度（取最大值，和 main 自己寫的結果一致，不會互蓋；`loadProgress()` 在同一次執行中回傳同一個物件）。

## 版面
- 根層 `pointer-events: none`，只有按鈕等可互動元素吃事件，3D 畫面照樣可拖曳；UI 上的 pointer／click 事件不會冒泡到 canvas。
- 選單開著時有一層透明 scrim：點外面＝關閉選單，這一下不會穿透到 3D（所以 main 的 `onTap` 在選單開著時不會收到點擊）。
- 選單會夾在畫面與 safe-area 內，並且盡量放在上方 HUD 列（金幣、燈、叫波）下面；被推離原位時用小圈標出原本的格子。
- 矮螢幕（`max-height: 520px` 或 `max-width: 760px`）用精簡版：隱藏英雄資訊卡、技能名稱、鍵盤提示等。觸控裝置不顯示鍵盤提示。直向且寬度 ≤ 900px 顯示「請把手機轉成橫向」。
- 換畫面、開始新關卡、出結算時，會清掉還沒播完的橫幅（避免「第 N 波」蓋在結算卡上）。

## 鍵盤
空白＝暫停、F＝速度、N＝叫波、Z／X＝流星雨／冰封、1–4＝蓋塔（輪盤開著時）、U＝升級、1／2＝選分支、Del／Backspace＝賣出（鍵盤直接賣；觸控要按兩次確認）、Esc＝關閉／取消／暫停、Enter＝標題開始／出發／結算的主要按鈕。WASD、Q/E、方向鍵、+/- 留給鏡頭。

## 測試頁 `tools/ui_test.html`
本機 `python3 -m http.server 8203` 後開 `http://127.0.0.1:8203/tools/ui_test.html?screen=…`：
- 假資料：`screen=title|map|levelinfo|talents|settings|game|build|tower|branch|max|result|lost|final|pause|targeting|tip`，另有 `at=edge|left`（選單貼邊）、`dead=1`、`prep=1`、`locked=1`、`log=1`（顯示 handler 呼叫紀錄，`window.__log`）。
- 真資料：`real=1&level=3` 用 A 的 `createGame` 驅動 HUD 與選單，選項資料和 `js/main.js` 傳的一樣；`window.__real.openBuild(i)`／`__real.openTower(id)`。

## 製作名單
設定視窗裡的「製作名單」按鈕：開頭一句「遊戲由 Claude 與子代理團隊以程式製作；3D 模型與部分音效為程式生成。」，下面用 fetch 讀專案根目錄 `CREDITS.txt`（路徑用 `import.meta.url` 算，index.html 與 tools/ 頁面都能讀），可捲動、可選取文字；讀取失敗顯示簡短說明。Esc 先回到設定，再按一次關閉。
