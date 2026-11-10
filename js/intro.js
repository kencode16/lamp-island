// 開場動畫（v1.2，擁有者：整合者）
// 每次開啟遊戲全螢幕播放 assets/video/intro.mp4；播完或按「略過」後淡出，回傳的 Promise 完成。
// 瀏覽器不准網頁自己出聲：先試著有聲播放，被擋就改靜音播放並顯示「點一下開啟聲音」；
// 連靜音都被擋（例如 iPhone 低耗電模式）就顯示大的播放鈕。

const CSS = `
#intro { position: fixed; inset: 0; z-index: 10000; background: #000; display: flex; align-items: center;
  justify-content: center; opacity: 1; transition: opacity .7s ease; touch-action: manipulation;
  -webkit-user-select: none; user-select: none; }
#intro.is-out { opacity: 0; pointer-events: none; }
#intro video { width: 100%; height: 100%; object-fit: contain; background: #000; }
#intro .in-btn { position: absolute; border: 1px solid rgba(255, 236, 190, .55); background: rgba(10, 18, 24, .55);
  color: #fbecc8; font: 600 15px/1 -apple-system, "PingFang TC", sans-serif; letter-spacing: .08em; border-radius: 999px;
  padding: 0 18px; min-height: 44px; display: inline-flex; align-items: center; gap: 8px; cursor: pointer;
  -webkit-backdrop-filter: blur(6px); backdrop-filter: blur(6px); opacity: 0; transition: opacity .5s; }
#intro .in-btn.is-on { opacity: 1; }
#intro .in-skip { top: calc(env(safe-area-inset-top, 0px) + 14px); right: calc(env(safe-area-inset-right, 0px) + 14px); }
/* 放左上角，不要蓋到影片底部的字幕 */
#intro .in-sound { top: calc(env(safe-area-inset-top, 0px) + 14px); left: calc(env(safe-area-inset-left, 0px) + 14px);
  animation: inPulse 1.8s ease-in-out infinite; }
#intro .in-play { left: 50%; top: 50%; transform: translate(-50%, -50%); min-height: 64px; padding: 0 28px; font-size: 18px; }
@keyframes inPulse { 50% { box-shadow: 0 0 0 6px rgba(255, 214, 140, .18); } }
`;

export function playIntro(src) {
  return new Promise((resolve) => {
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    const root = document.createElement('div');
    root.id = 'intro';
    const video = document.createElement('video');
    video.src = src;
    video.preload = 'auto';
    video.playsInline = true;
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');
    video.disablePictureInPicture = true;
    video.controls = false;

    const btn = (cls, text) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'in-btn ' + cls; b.textContent = text; return b; };
    const skip = btn('in-skip', '略過 ›');
    const sound = btn('in-sound', '🔊 點一下開啟聲音');
    const play = btn('in-play', '▶ 播放開場');
    sound.style.display = 'none';
    play.style.display = 'none';
    root.append(video, skip, sound, play);
    document.body.appendChild(root);

    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(skipTimer); clearTimeout(stallTimer);
      root.classList.add('is-out');
      try { video.pause(); } catch (e) { /* 忽略 */ }
      resolve();
      setTimeout(() => { root.remove(); style.remove(); video.removeAttribute('src'); video.load(); }, 800);
    };

    // 「略過」1 秒後出現；如果 6 秒還沒開始播（網路慢），也確保略過鈕在
    const skipTimer = setTimeout(() => skip.classList.add('is-on'), 1000);
    const stallTimer = setTimeout(() => { if (video.currentTime < 0.2) skip.classList.add('is-on'); }, 6000);

    const showSound = () => { sound.style.display = ''; requestAnimationFrame(() => sound.classList.add('is-on')); };
    const unmute = () => {
      if (!video.muted) return;
      video.muted = false;
      video.volume = 1;
      sound.classList.remove('is-on');
      setTimeout(() => { sound.style.display = 'none'; }, 500);
      if (video.paused) video.play().catch(() => {});
    };

    skip.addEventListener('click', (e) => { e.stopPropagation(); finish(); });
    sound.addEventListener('click', (e) => { e.stopPropagation(); unmute(); });
    play.addEventListener('click', (e) => {
      e.stopPropagation();
      play.style.display = 'none';
      video.muted = false;
      video.play().catch(() => { video.muted = true; video.play().catch(finish); showSound(); });
    });
    // 點畫面任何地方＝開聲音（靜音播放時）
    root.addEventListener('click', () => { if (video.muted && !done) unmute(); });

    video.addEventListener('ended', finish);
    video.addEventListener('error', finish);

    // 先試有聲播放；被擋就靜音播放；再被擋就顯示播放鈕
    video.muted = false;
    video.play().catch(() => {
      video.muted = true;
      showSound();   // 馬上顯示，不等影片真的開始（網路慢時可能要等一下）
      video.play().catch(() => {
        sound.style.display = 'none';
        play.style.display = '';
        requestAnimationFrame(() => play.classList.add('is-on'));
        skip.classList.add('is-on');
      });
    });
  });
}
