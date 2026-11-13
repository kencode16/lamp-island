# 音效與配樂 `js/audio/`（擁有者：E）

Web Audio API 實作，不依賴任何函式庫。所有呼叫遇到錯誤都安靜略過（不丟例外）；沒有 AudioContext 的環境（例如 Node）全部是空操作。

## 檔案
| 路徑 | 內容 |
|---|---|
| `audio.js` | 音效引擎：載入、限頻、混音、配樂交叉淡入淡出、環境音、事件對應 |
| `manifest.js` | 自動產生的素材清單（檔名、長度、循環點、音量），不要手改 |
| `build/` | 重建素材用的 Python 腳本（見最下方「重建」） |
| `../../assets/audio/sfx/*.m4a` | 83 個音效（AAC 單聲道 80 kbps，共約 1.5 MB；v2.0 新增 32 個、約 0.6 MB） |
| `../../assets/audio/music/*.m4a` | 6 首循環配樂 menu／day／night／boss＋v2.0 cave／caveBoss（AAC 立體聲 112 kbps，共約 5.1 MB；新增約 1.6 MB） |
| `../../assets/audio/amb/*.m4a` | 4 個循環環境音 sea／rain／night＋v2.0 cave（共約 0.6 MB） |
| `../../tools/audio_test.html` | 測試台：逐一試聽、事件模擬（含第二章與英雄）、雷射迴圈、限頻壓力測試、載入／解碼檢查 |
| `../../CREDITS.txt` | 素材來源與授權（含一項 CC BY 4.0，需要標示出處） |

AAC（.m4a）在 iOS Safari、桌面 Safari／Chrome／Edge／Firefox 都能解碼。

## API
合約（架構.md §9）全部照寫：
```js
import { audio } from './audio/audio.js';
audio.init();                  // 建立 AudioContext、開始背景載入；可重複呼叫
audio.unlock();                // 在使用者手勢裡呼叫（iOS 必要）。init() 也會自動在任何點擊／觸控時補呼叫
audio.play('click');           // 名稱見下方清單；回傳是否真的播了
audio.music('day');            // 'menu' | 'day' | 'night' | 'boss' | 'cave' | 'caveBoss' | null，1.6 秒交叉淡入淡出；同一首重複呼叫不會重播
audio.setVolume({ music: 0.6, sfx: 0.8 });   // 0–1；也接受 0–100 或 true/false
audio.handleEvent(ev);         // 吃 sim 事件自動播音效（對應表見下方）
```
`play(name, opts)` 的 `opts`：`vol`（倍率）、`rate`（音高倍率）、`delay`（秒）、`pan`（-1–1）、`x`/`z`（格子座標，配合 `setSpatial`）、`force`（略過限頻）。

**新增**（非合約必要，`?.` 呼叫即可）：
| 函式 | 說明 |
|---|---|
| `setEnv({ time, weather })` | 設定時段／天氣 → 自動切環境音（海浪＋雨＋夜蟲；`time:'cave'` → 洞窟環境音）與白天／夜晚／洞窟配樂。**整合者在 `startLevel` 呼叫一次 `audio.setEnv?.(game.state.env)`**：sim 不會為關卡的初始環境發 `env` 事件；重玩同一關時也靠它把上一局的環境清掉。v2.0：這個呼叫＝「新的一局開始」，**同時停掉上一局的雷射迴圈**、清掉敵人／塔的記錄（遊戲中的 env 事件走 `handleEvent`，不會清）。在 `music()` 之前或之後呼叫都可以 |
| `playStars(n, { delay, gap })` | 結算畫面星星一顆顆亮起時的音效（音高逐顆升高）。`won` 事件本身已經會播 `victory` |
| `setSpatial(fn)` | `fn(x, z) → { pan, gain }`，讓有座標的音效依鏡頭左右聲道與遠近音量。不設定＝全部置中 |
| `ambience(['sea', 'rain', 'night'])` | 手動指定環境音（一般用不到，`setEnv` 會處理） |
| `mute(bool)` | 全部靜音 |
| `moodFor(env)` | `'night'` → `'night'`、`'cave'` → `'cave'`，其他 → `'day'` |
| `setHero(type)` | v2.0：`'knight'｜'fairy'｜'mage'`，目前英雄（妖精受傷／倒下改用非人聲的 `fairyHurt`／`fairyDeath`）。不呼叫也會自動判斷：`heroAttack.attack`、`heroSkill.hero`、`play('heroPick_*')` 都會順便設定。建議整合者開關卡時呼叫 `audio.setHero?.(heroId)` |
| `setPaused(bool)` | v2.0：暫停時把持續音（稜鏡雷射）壓到 0、繼續時恢復（配樂照常）。**建議整合者在 main.js 的 `setPaused` 裡呼叫 `audio.setPaused?.(paused)`** |
| `holdPreload(promise)` | v1.3（整合者新增）：預載等這個 Promise 完成才開始（例如開場動畫播完），不跟影片搶網路 |
| `stopLoops()` | v2.0：立刻停掉所有雷射迴圈（`won`／`lost`／`music('menu')`／`setEnv()` 都會自動呼叫） |
| `stats()` | 載入狀態、目前配樂／環境音、同時聲部數、累計播放／限頻略過數；v2.0 加 `lasers`（開著的雷射數）、`laserVoices`（有聲音的，最多 3）、`laserSources`（實際還在播的音源）、`loopsPaused`、`hero` |
| `loadAll()` | 立刻載入全部素材（測試用），回傳 Promise<stats> |
| `auto.music`、`auto.ambience` | 預設 `true`。設成 `false` 就不自動切配樂／環境音 |
| `context` | 底下的 AudioContext（除錯用） |

### 自動行為（與 main.js 目前寫法相容）
- **進出關卡**：`music('day'|'night'|'boss')` 視為進入關卡 → 開始環境音；`music('menu')` 或 `won`／`lost` 事件 → 停止環境音。
- **王戰**：`waveStart{boss:true}` 或王 `spawn` → 切 `boss`；王 `death` → 依目前環境切回 `day`／`night`（main.js 目前沒有做這一步，這裡補上）。王戰中的 `env` 事件不切配樂。
- **洞窟（v2.0）**：關卡環境 `time === 'cave'` 時，`music('day'|'night')` 自動換成 `cave`、`music('boss')` 換成 `caveBoss`，所以 main.js 沿用 `musicFor()` 也是對的（當然也可以直接呼叫 `music('cave')`）。環境音只有洞窟（水滴、遠方回音、微風），不會有海浪；`won`／`lost`／`music('menu')` 時停止。地鼠王、深淵巨蟲也算王（吼聲＋`caveBoss`，倒下回到 `cave`）。
- **配樂記憶體（v2.0）**：配樂分兩組——小島（menu／day／night／boss）、洞窟（cave／caveBoss／menu）。某一首開始播後，只保留同組的解碼資料，4 秒後預載同組其他首（iPhone 省記憶體）。另一組下次要播時再載（約 0.8 MB、瀏覽器有快取）。
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

### 第二章與英雄（v2.0，架構_第二章.md §2）
| 事件 | 音效 |
|---|---|
| `build`（`towerType: 'lantern'`） | `lanternLight`（放下＋擦火柴＋點燃＋暖色鐘聲；不另外播 `build`）。升級燈籠：`upgrade`＋`lanternOn` |
| `build`（`towerType: 'prism'`） | `build`＋`crystal`（水晶鳴響）。升級稜鏡塔：`upgrade`＋小聲 `crystal` |
| `lanternOut`／`lanternOn`／`ink` | `lanternOut`（吹熄＋下沉的音）／`lanternOn`（重新點亮）／`ink`（噴墨） |
| `laserOn`／`laserOff` | `laserStart`（充能電光）＋**迴圈** `laserLoop`（晶體嗡鳴，3 秒內音高慢慢升高＝鎖定越久越強）。同時最多 3 道有聲音（第 4 道起排隊，有一道停了就補上），音量依數量 1/√n 壓低、每道音高略不同。重複的 `laserOn` 不理；`sell`／`eat` 該塔、`won`／`lost`、`setEnv()`、`music('menu')` 都會關掉 |
| `burrow`／`emerge` | `burrow`（扒土下沉）／`emerge`（土堆噴開）。地鼠王、深淵巨蟲：同一個音效降音高、加大，再疊 `quake`（地底轟隆＋落石） |
| `reveal` | `reveal`（影子幽靈現形：倒吸的風＋空靈的嗚聲） |
| `segment` | `segment`（甲殼碎裂＋黏液＋低吼）；剩下的節數越少音高越高 |
| `eat` | `eat`（張口→喀嚓咬碎燈罩→咕嚕吞下） |
| `spawn` | `moleKing` → `moleKingRoar`；`abyssWorm` → `wormRoar`＋`quake`；兩者都切 `caveBoss`。`ghost`／`mole`／`inkBat` → 一般 `spawn`（音高不同） |
| `death` | `ghost` → `ghostDeath`、`mole` → `moleDeath`、`inkBat` → `bat`（較低）、`moleKing`／`abyssWorm` → `bossDeath`（巨蟲較低＋`quake`） |
| `summon`（地鼠王叫地鼠） | `emerge`＋`quake`（不用暗黑召喚聲） |
| `heroAttack` | 依 `attack`：`sword` → `swordSwing`（第一章原音）、`bolt` → `fairyBolt`（清脆光彈）、`fireball` → `fireballCast`（出手）；沒有 `attack`＝騎士 |
| `hit` | `fairyBolt`／`starBolt` → `sparkHit`；`fireball` → `fireballHit`（爆開，與 `explode{kind:'fireball'}` 同名、限頻自動去重）；`laser` 不出聲（迴圈代表）；英雄技能的魔法命中 → 小聲 `hitMagic` |
| `explode` | `fireball` → `fireballHit`；`whirl`／`charge`／`starburst`／`pollen`／`firestorm`／`icefall` 不另外出聲（已包含在 `heroSkill` 音效裡） |
| `heroSkill` | 依 `skill`：`whirl` → `skillWhirl`、`charge` → `skillCharge`、`starburst` → `skillStarburst`、`pollen` → `skillPollen`、`firestorm` → `skillFirestorm`、`icefall` → `skillIcefall`（每個都包含出手到命中，約 1–2 秒） |
| `heroHurt`／`heroDeath` | 妖精：`fairyHurt`／`fairyDeath`（不用男聲）；騎士、法師：`heroHurt`／`heroDeath` |
| `shoot`（`laser`、英雄投射物） | 不出聲（由 `laserOn`、`heroAttack` 負責；第一章未知種類仍播 `arrow`） |
| `pulse` | 只有 `vines`／`thorns`／`roots` 出藤蔓聲（英雄技能若用 pulse 不會誤播） |
| 選英雄（介面） | `audio.play('heroPick_knight'｜'heroPick_fairy'｜'heroPick_mage')`（號角＋拔劍／鈴聲＋拍翅／低沉鐘聲＋神秘和弦），順便設定目前英雄 |

## 限頻與混音
- 每個音效有：同名最短間隔（35–1500 ms）、同名同時上限（1–4）、音高／音量隨機變化（避免機關槍感）。
- 群組限頻：`hit`（每 50 ms 最多 3 個新聲音、同時 4 個）、`shoot`（40 ms／3、同時 7）、`death`（50 ms／3、同時 5）、`boom`（60 ms／2、同時 4）。同一幀 60 個命中只會出 1–3 聲。
- 總聲部上限 28；超過時只放「重要」音效（介面、建造、波次、王、英雄、技能）。
- v2.0：`sparkHit` 在 `hit` 群組、`fireballHit` 在 `boom` 群組、`ghostDeath`／`moleDeath` 在 `death` 群組；雷射迴圈走獨立的迴圈匯流排（在音效匯流排底下，不算在 28 聲部內，最多 3 道）。
- 預載優先：第二章常用的 `lanternLight` `laserStart` `laserLoop` `fairyBolt` `sparkHit` `fireballCast` `fireballHit` 排在第一批；燈籠熄滅、地鼠、幽靈、技能、選英雄在第二批；王的吼聲、斷節、吞燈籠、地底轟隆最後。
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
- v2.0 燈籠與稜鏡塔：`lanternLight` `lanternOn` `lanternOut` `ink` `crystal` `laserStart` `laserLoop`（迴圈，一般不直接 play）
- v2.0 洞窟敵人與王：`burrow` `emerge` `quake` `reveal` `ghostDeath` `moleDeath` `segment` `eat` `moleKingRoar` `wormRoar`
- v2.0 英雄：`fairyBolt` `sparkHit` `fireballCast` `fireballHit` `skillWhirl` `skillCharge` `skillStarburst` `skillPollen` `skillFirestorm` `skillIcefall` `heroPick_knight` `heroPick_fairy` `heroPick_mage` `fairyHurt` `fairyDeath`

### 配樂情境
| mood | 用在哪裡 | 內容 |
|---|---|---|
| `menu` | 標題、航海圖、天賦頁 | 3/4 拍、長笛＋吉他，溫暖 |
| `day`／`night` | 第一章關卡 | 白天輕快；夜晚慢、鋼琴與鐘琴 |
| `boss` | 第一章王戰 | 140 BPM、D 小調、太鼓＋銅管 |
| `cave` | 第二章關卡（`env.time === 'cave'`） | 76 BPM、E 小調、約 63 秒循環。低音弦樂長音（地底共鳴）、稀疏的尼龍吉他、帶兩次回聲的高音鋼琴（像水珠）、調內音高的水滴、段落開頭的低沉鐘聲；第二段長笛主題＋很輕的框鼓心跳。神秘但不壓迫 |
| `caveBoss` | 第二章王戰（地鼠王、深淵巨蟲） | 128 BPM、E 弗里吉亞、約 52.5 秒循環。斷奏低音弦樂頑固音型、沉重太鼓、礦坑金屬敲擊、不協和的高音水滴、銅管重音、高音弦樂主題 |

洞窟環境音 `amb/cave`（14 秒循環）：真實＋合成水滴（隨機音高與左右位置，偶爾有遠方回音）、穿過洞口的微風（緩慢起伏）、很輕的空間低鳴、遠方石頭聲；殘響用循環卷積，循環點完全無縫。

## 測試
```
python3 -m http.server 8204      # 在專案根目錄
```
電腦開 http://127.0.0.1:8204/tools/audio_test.html （iPhone 用筆電 IP）。先按「點這裡啟用聲音」。
- 「全部載入並檢查」：全部 93 個檔案經引擎載入解碼，失敗會用紅字列出（配樂只保留同組，已載入數可能小於總數，看「失敗」即可）。
- 「事件模擬」：齊射、大混戰（每秒 200 個事件）、王出場／倒下、暗影巫師護盾、英雄一生、勝負等。紀錄區會顯示播放數與限頻略過數。
- 「關卡環境」：先按「進關卡」（照 main.js：先 `music` 再 `setEnv`），再按各種天氣（含洞窟），確認環境音與配樂跟著切換。
- 「第二章」：進洞窟關卡、燈籠、稜鏡塔、噴墨、地鼠、幽靈、地鼠王、深淵巨蟲；「稜鏡雷射迴圈」：四座塔各自開關、全部關、暫停、賣塔。
- 「英雄」：三種普攻、六個技能、選英雄、妖精／法師的一生。
- 「自動測試」：逐一解碼全部檔案（不經引擎，核對長度）、第二章事件串（含雷射開關檢查）、第一章回歸。
- headless 用：頁面有 `window.__audio`、`window.__chaos(秒, 每秒事件數)`、`window.__decodeAll()`、`window.__ch2Sequence()`、`window.__ch1Sequence()`（都回傳 Promise＜結果＞）。例：
  `/opt/anaconda3/bin/python tests/shot.py http://127.0.0.1:8204/tools/audio_test.html out.png --wait 4 --eval "window.__ch2Sequence()"`

## 重建素材
腳本在 `build/`（numpy＋scipy，用 `/opt/anaconda3/bin/python`；編碼用 macOS 內建 `afconvert`）。
1. 準備工作資料夾 `$AUDIO_WORK/dec/`（全部轉成 44.1 kHz 單聲道 16-bit wav）：
   - `dec/wyz/<id>.wav`：SFX Kit（https://github.com/wyzowl/sfx-kit ）中用到的約 50 個聲音，id 見 `sfx.py` 的 `W('…')`
   - `dec/meta_inst/`：Meta Piano（Vel02 全部、Vel03 每 3 個半音一個）與 Meta Nylon Guitar（Vel01Finger／Vel02Pick），清單由 `pick_meta.py` 依兩者的 manifest 產生；`dec_inst.py` 負責轉檔與截短
   - `dec/oculus/`：上表四個 Oculus Audio Pack 檔（另有幾個備用）
   - `dec/pander/sword-clash.wav`
2. `AUDIO_WORK=<工作資料夾> js/audio/build/build.sh <專案根目錄> music`（不加 `music`＝只重建音效，約 15 秒；加了要多 1–3 分鐘）
3. 會覆寫 `assets/audio/**` 與 `js/audio/manifest.js`。結果是固定的（亂數有固定種子）。

### 第二章（v2.0）
只重建第二章的素材，不動第一章的檔案：
1. 工作資料夾 `$AUDIO_WORK/dec/`：
   - `dec/wyz/<id>.wav`：SFX Kit 中 `sfx2.py`／`ch2lib.py` 用到的約 60 個聲音（id 見 `W('…')`，包含 `props-drip`、`props-splash` 等）
   - `dec/meta_inst/`：Meta Piano（Vel02 每 2 個半音、Vel03 每 3 個半音）、Meta Nylon Guitar（Vel01Finger／Vel02Pick 每 2 個半音），用 `dec_inst.py` 轉檔
   - `dec/proj/bossRoar.wav`：`build.sh` 會自動從本專案的 `assets/audio/sfx/bossRoar.m4a` 解碼
2. `AUDIO_WORK=<工作資料夾> js/audio/build/build.sh <專案根目錄> ch2`（`ch2sfx`＝不重算配樂）。音效約 40 秒、配樂約 2 分鐘。
3. 腳本：`sfx2.py`（第二章音效＋洞窟環境音＋雷射迴圈）、`music2.py`（cave／caveBoss）、`ch2lib.py`（水滴、泥土、翅膀、低吼、幽靈音、循環殘響）。`manifest.py` v2.0 改成掃描 `assets/audio/sfx/*.m4a`，循環點與音量存在 `build/loops.json`（已提交），所以只重建一部分也能正確產生 manifest。
4. 雷射迴圈 `laserLoop`：2 秒完全週期（所有頻率 × 2 秒都是整數），檔案前後各多放一段，`loopStart` 0.5、`loopEnd` 2.5，寫在 manifest 的 SFX 裡。

配樂循環：每首在 `loopStart`（0.5 秒）之前與 `loopEnd` 之後都放了循環的重疊內容，即使瀏覽器沒去掉 AAC 的前置延遲，循環點也一樣無縫；環境音另外在載入時於循環點做 0.25 秒交叉淡化。
