# 音效與配樂 `js/audio/`（擁有者：E）

Web Audio API 實作，不依賴任何函式庫。所有呼叫遇到錯誤都安靜略過（不丟例外）；沒有 AudioContext 的環境（例如 Node）全部是空操作。

## 檔案
| 路徑 | 內容 |
|---|---|
| `audio.js` | 音效引擎：載入、限頻、混音、配樂交叉淡入淡出、環境音、事件對應 |
| `manifest.js` | 自動產生的素材清單（檔名、長度、循環點、音量），不要手改 |
| `build/` | 重建素材用的 Python 腳本（見最下方「重建」） |
| `../../assets/audio/sfx/*.m4a` | 51 個音效（AAC 單聲道 80 kbps，共約 0.9 MB） |
| `../../assets/audio/music/*.m4a` | 4 首循環配樂 menu／day／night／boss（AAC 立體聲 112 kbps，共約 3.5 MB） |
| `../../assets/audio/amb/*.m4a` | 3 個循環環境音 sea／rain／night（共約 0.4 MB） |
| `../../tools/audio_test.html` | 測試台：逐一試聽、事件模擬、限頻壓力測試、載入檢查 |
| `../../CREDITS.txt` | 素材來源與授權（含一項 CC BY 4.0，需要標示出處） |

AAC（.m4a）在 iOS Safari、桌面 Safari／Chrome／Edge／Firefox 都能解碼。

## API
合約（架構.md §9）全部照寫：
```js
import { audio } from './audio/audio.js';
audio.init();                  // 建立 AudioContext、開始背景載入；可重複呼叫
audio.unlock();                // 在使用者手勢裡呼叫（iOS 必要）。init() 也會自動在任何點擊／觸控時補呼叫
audio.play('click');           // 名稱見下方清單；回傳是否真的播了
audio.music('day');            // 'menu' | 'day' | 'night' | 'boss' | null，1.6 秒交叉淡入淡出；同一首重複呼叫不會重播
audio.setVolume({ music: 0.6, sfx: 0.8 });   // 0–1；也接受 0–100 或 true/false
audio.handleEvent(ev);         // 吃 sim 事件自動播音效（對應表見下方）
```
`play(name, opts)` 的 `opts`：`vol`（倍率）、`rate`（音高倍率）、`delay`（秒）、`pan`（-1–1）、`x`/`z`（格子座標，配合 `setSpatial`）、`force`（略過限頻）。

**新增**（非合約必要，`?.` 呼叫即可）：
| 函式 | 說明 |
|---|---|
| `setEnv({ time, weather })` | 設定時段／天氣 → 自動切環境音（海浪＋雨＋夜蟲）與白天／夜晚配樂。**建議整合者在 `startLevel` 呼叫一次 `audio.setEnv?.(game.state.env)`**：sim 不會為關卡的初始環境發 `env` 事件，不呼叫的話第 4、9 關開場的雨聲要等到第一個 env 事件才出現；重玩同一關時也靠它把上一局的環境清掉。在 `music()` 之前或之後呼叫都可以 |
| `playStars(n, { delay, gap })` | 結算畫面星星一顆顆亮起時的音效（音高逐顆升高）。`won` 事件本身已經會播 `victory` |
| `setSpatial(fn)` | `fn(x, z) → { pan, gain }`，讓有座標的音效依鏡頭左右聲道與遠近音量。不設定＝全部置中 |
| `ambience(['sea', 'rain', 'night'])` | 手動指定環境音（一般用不到，`setEnv` 會處理） |
| `mute(bool)` | 全部靜音 |
| `moodFor(env)` | `env.time === 'night'` → `'night'`，其他 → `'day'`（與 main.js 的 `musicFor` 相同） |
| `stats()` | 載入狀態、目前配樂／環境音、同時聲部數、累計播放／限頻略過數 |
| `loadAll()` | 立刻載入全部素材（測試用），回傳 Promise<stats> |
| `auto.music`、`auto.ambience` | 預設 `true`。設成 `false` 就不自動切配樂／環境音 |
| `context` | 底下的 AudioContext（除錯用） |

### 自動行為（與 main.js 目前寫法相容）
- **進出關卡**：`music('day'|'night'|'boss')` 視為進入關卡 → 開始環境音；`music('menu')` 或 `won`／`lost` 事件 → 停止環境音。
- **王戰**：`waveStart{boss:true}` 或王 `spawn` → 切 `boss`；王 `death` → 依目前環境切回 `day`／`night`（main.js 目前沒有做這一步，這裡補上）。王戰中的 `env` 事件不切配樂。
- **勝負**：`won`／`lost` → 配樂淡出、環境音淡出，0.25 秒後播 `victory`／`defeat`。main.js 1.4 秒後再呼叫 `music(null)` 也沒關係。
- iOS 從背景回來時會自動恢復；分頁隱藏時暫停 AudioContext（省電）。
- 載入順序：介面與最常用的音效先載，王／結算音效最後；配樂在第一次 `music()` 時才載，播放後 4 秒再背景預載其他首。還沒載好的「重要」音效（介面、建造、波次等）會在 0.8 秒內載完時補播，其他的直接略過。

## 事件對應
| 事件 | 音效 |
|---|---|
| `spawn` | 一般怪：低沉的 `spawn`（小聲，每 0.3 秒最多一次）；魔像：`golemStep`；王：`bossRoar`＋切王戰配樂 |
| `death` | 依種類：史萊姆類 `slimePop`（小的音高高）、骷髏 `bones`、石像鬼 `crumble`、夜蝠 `bat`、魔像 `golemDeath`、王 `bossDeath`、其他 `death` |
| `gold` | 擊殺：小聲 `coin`；提早叫波（`early`）：兩聲 `coin`；賣塔時由 `sell` 代表（不重複） |
| `leak` | `leak`（燈受傷的低沉鐘聲；王漏進來更大聲） |
| `shoot` | `arrow`／`bolt`／`catapult`（boulder 低沉、firebomb 稍高）／`orb`／`frostShot`；`lightning` 由 `beam` 負責 |
| `hit` | 法術或法球 `hitMagic`；冰霜 `iceCrack`；其他依目標護甲：骷髏／石像鬼／魔像 `hitArmor`，其餘 `hitFlesh`（含英雄的 `sword`）。範圍類的命中由 `explode`／`beam` 負責 |
| `explode` | `explosion`（boulder 低沉）、`fire`、`meteorImpact` |
| `beam` | `lightning` |
| `pulse` | `vines`（荊棘偏高、古樹偏低） |
| `status` | `freeze` → `iceCrack`、`burn` → `ignite`；`slow`／`root`／`stun`／`shield` 不另外出聲（由塔、`aura` 代表） |
| `aura` | `shield`（暗影巫師施放護盾；`any:false` 時小聲） |
| `shieldBreak` | `shieldBreak`（護盾碎裂） |
| `split` | 高音 `slimePop` |
| `summon`／`dim` | `summon`／`dim` |
| `build` | `build`，依 `towerType`（合約原寫 `type`，A 實作在 `towerType`／`tower`）變化音高；法師塔加魔法閃光、樹靈塔加藤蔓聲 |
| `upgrade` | `upgrade`；選分支時再加一聲 `star` |
| `sell` | `sell` |
| `waveStart` | 號角 `waveStart`（王波次音高較低）；`waveCleared` → `waveCleared` |
| `env` | 切環境音與配樂（見 `setEnv`） |
| `heroAttack`／`heroHurt`／`heroDeath`／`heroRespawn`／`heroLevel` | `swordSwing`／`heroHurt`／`heroDeath`／`heroRespawn`／`levelUp` |
| `skill` | meteor → `meteorFall`（之後的 `explode` 播撞擊）；freeze → `freeze` |
| `won`／`lost` | `victory`／`defeat` |

## 限頻與混音
- 每個音效有：同名最短間隔（35–1500 ms）、同名同時上限（1–4）、音高／音量隨機變化（避免機關槍感）。
- 群組限頻：`hit`（每 50 ms 最多 3 個新聲音、同時 4 個）、`shoot`（40 ms／3、同時 7）、`death`（50 ms／3、同時 5）、`boom`（60 ms／2、同時 4）。同一幀 60 個命中只會出 1–3 聲。
- 總聲部上限 28；超過時只放「重要」音效（介面、建造、波次、王、英雄、技能）。
- 匯流排：音效／配樂／環境音三條 → 主音量 → 壓縮器（防爆音）。音量滑桿用平方曲線。
- 實測（Chrome，第 10 關、22 座滿級塔、4 倍速跑 40 秒、1338 個事件）：平均每秒 16 個聲音、同時最多 24 個，沒有錯誤。

## 音效名稱（`audio.play(name)`）
- 介面（合約）：`click` `open` `error` `coin` `star` `victory` `defeat`
- 建造：`build` `upgrade` `sell`
- 塔：`arrow` `bolt` `catapult` `orb` `frostShot` `explosion` `fire` `lightning` `frost` `vines` `hitFlesh` `hitArmor` `hitMagic` `iceCrack` `ignite` `shieldBreak`
- 敵人：`slimePop` `death` `bones` `bat` `crumble` `golemStep` `golemDeath` `spawn` `shield` `summon` `dim` `bossRoar` `bossDeath` `leak`
- 波次／技能：`waveStart` `waveCleared` `meteorFall` `meteorImpact` `freeze`
- 英雄：`swordSwing` `heroHurt` `heroDeath` `heroRespawn` `levelUp`
- 天氣：`thunder`（目前沒有事件觸發；若畫面做了閃電，可在閃光時 `audio.play?.('thunder')`）

## 測試
```
python3 -m http.server 8204      # 在專案根目錄
```
電腦開 http://127.0.0.1:8204/tools/audio_test.html （iPhone 用筆電 IP）。先按「點這裡啟用聲音」。
- 「全部載入並檢查」：全部 58 個檔案解碼，失敗會用紅字列出。
- 「事件模擬」：齊射、大混戰（每秒 200 個事件）、王出場／倒下、暗影巫師護盾、英雄一生、勝負等。紀錄區會顯示播放數與限頻略過數。
- 「關卡環境」：先按「進關卡」，再按各種天氣，確認環境音與配樂跟著切換。
- headless 用：頁面有 `window.__audio`、`window.__chaos(秒, 每秒事件數)`。

## 重建素材
腳本在 `build/`（numpy＋scipy，用 `/opt/anaconda3/bin/python`；編碼用 macOS 內建 `afconvert`）。
1. 準備工作資料夾 `$AUDIO_WORK/dec/`（全部轉成 44.1 kHz 單聲道 16-bit wav）：
   - `dec/wyz/<id>.wav`：SFX Kit（https://github.com/wyzowl/sfx-kit ）中用到的約 50 個聲音，id 見 `sfx.py` 的 `W('…')`
   - `dec/meta_inst/`：Meta Piano（Vel02 全部、Vel03 每 3 個半音一個）與 Meta Nylon Guitar（Vel01Finger／Vel02Pick），清單由 `pick_meta.py` 依兩者的 manifest 產生；`dec_inst.py` 負責轉檔與截短
   - `dec/oculus/`：上表四個 Oculus Audio Pack 檔（另有幾個備用）
   - `dec/pander/sword-clash.wav`
2. `AUDIO_WORK=<工作資料夾> js/audio/build/build.sh <專案根目錄> music`（不加 `music`＝只重建音效，約 15 秒；加了要多 1–3 分鐘）
3. 會覆寫 `assets/audio/**` 與 `js/audio/manifest.js`。結果是固定的（亂數有固定種子）。

配樂循環：每首在 `loopStart`（0.5 秒）之前與 `loopEnd` 之後都放了循環的重疊內容，即使瀏覽器沒去掉 AAC 的前置延遲，循環點也一樣無縫；環境音另外在載入時於循環點做 0.25 秒交叉淡化。
