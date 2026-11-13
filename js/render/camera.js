// 鏡頭與手勢（擁有者：C）。介面見 架構.md §7 與 js/render/README.md。
// 鏡頭繞「目標點」（地面 y=0）旋轉；俯角隨距離在 PITCH_NEAR～PITCH_FAR 之間變化（約 50°）。
// 手機：單指拖曳平移、雙指捏合縮放＋扭轉旋轉（以兩指中點為錨點）
// 滑鼠：左鍵拖曳平移、右鍵（或中鍵）拖曳旋轉、滾輪縮放（以游標為錨點）
// 鍵盤：WASD／方向鍵平移、Q/E 旋轉、+/- 縮放。其他按鍵一律不攔。
import * as THREE from 'three';

const DEG = Math.PI / 180;
const PITCH_NEAR = 41 * DEG, PITCH_FAR = 56 * DEG;
const PITCH_D0 = 6, PITCH_D1 = 34;
const TAP_MOVE = 8, TAP_TIME = 400;
const ROT_THRESHOLD = 9 * DEG;     // 雙指扭轉超過這個角度才開始旋轉（避免捏合時誤轉）

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const smooth01 = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };

export function pitchFor(dist) {
  return PITCH_NEAR + (PITCH_FAR - PITCH_NEAR) * smooth01((dist - PITCH_D0) / (PITCH_D1 - PITCH_D0));
}

/**
 * camera：THREE.PerspectiveCamera；dom：接收手勢的元素（canvas）
 * hooks：{ onTap(clientX, clientY, pointerType), onHover(clientX, clientY) , onHoverEnd() }
 */
export function createCameraRig(camera, dom, hooks = {}) {
  const target = new THREE.Vector3();
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3(), tmp3 = new THREE.Vector3();
  const anchor = new THREE.Vector3();
  const shakeOff = new THREE.Vector3();
  const velSamples = []; // {t, x, z, yaw}
  for (let i = 0; i < 12; i++) velSamples.push({ t: 0, x: 0, z: 0, yaw: 0 });
  let velHead = 0, velCount = 0;

  const cam = {
    enabled: true,
    target,
    yaw: 0,
    dist: 20, distGoal: 20,
    minDist: 5, maxDist: 40, fitDist: 20,
    bounds: { minX: -10, maxX: 10, minZ: -10, maxZ: 10 },
    vel: new THREE.Vector2(), yawVel: 0,
    userMoved: false,
    W: 0, H: 0,
    level: null,
    // 參數（可調）
    panFriction: 5, rotFriction: 5, zoomSmooth: 11, keyPanSpeed: 0.85, keyRotSpeed: 1.9, keyZoomSpeed: 1.5,
    fitMargin: { left: 0.93, right: 0.93, top: 0.8, bottom: 0.88 },
    pitch: () => pitchFor(cam.dist),
  };

  let rect = dom.getBoundingClientRect();
  const refreshRect = () => { rect = dom.getBoundingClientRect(); };

  function apply() {
    const p = pitchFor(cam.dist);
    const cp = Math.cos(p), sp = Math.sin(p);
    camera.position.set(
      target.x + Math.sin(cam.yaw) * cp * cam.dist + shakeOff.x,
      target.y + sp * cam.dist + shakeOff.y,
      target.z + Math.cos(cam.yaw) * cp * cam.dist + shakeOff.z);
    tmp3.copy(target).add(shakeOff);
    camera.lookAt(tmp3);
    camera.updateMatrixWorld();
  }

  /** 螢幕座標 → 地面 y=0 交點（世界座標）；打不到回傳 null */
  function groundAt(clientX, clientY, out) {
    ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    return ray.ray.intersectPlane(plane, out);
  }
  function groundAtNdc(x, y, out) {
    ndc.set(x, y);
    ray.setFromCamera(ndc, camera);
    return ray.ray.intersectPlane(plane, out);
  }

  function clampTarget() {
    const b = cam.bounds;
    if (target.x < b.minX) { target.x = b.minX; cam.vel.x = 0; }
    if (target.x > b.maxX) { target.x = b.maxX; cam.vel.x = 0; }
    if (target.z < b.minZ) { target.z = b.minZ; cam.vel.y = 0; }
    if (target.z > b.maxZ) { target.z = b.maxZ; cam.vel.y = 0; }
  }

  function pushSample() {
    const s = velSamples[velHead];
    s.t = performance.now(); s.x = target.x; s.z = target.z; s.yaw = cam.yaw;
    velHead = (velHead + 1) % velSamples.length;
    velCount = Math.min(velCount + 1, velSamples.length);
  }
  function releaseVelocity(withPan, withYaw) {
    const now = performance.now();
    let oldest = null, newest = null;
    for (let i = 0; i < velCount; i++) {
      const s = velSamples[(velHead - 1 - i + velSamples.length * 2) % velSamples.length];
      if (!newest) newest = s;
      if (now - s.t > 110) break;
      oldest = s;
    }
    cam.vel.set(0, 0); cam.yawVel = 0;
    if (!oldest || !newest || oldest === newest) return;
    const dt = (newest.t - oldest.t) / 1000;
    if (dt < 0.012 || now - newest.t > 60) return;
    if (withPan) {
      cam.vel.set((newest.x - oldest.x) / dt, (newest.z - oldest.z) / dt);
      const max = cam.dist * 3;
      if (cam.vel.length() > max) cam.vel.setLength(max);
    }
    if (withYaw) cam.yawVel = clamp((newest.yaw - oldest.yaw) / dt, -6, 6);
  }
  const resetSamples = () => { velCount = 0; };

  // ---------------------------------------------------------------- 指標事件
  const pointers = new Map(); // id → { x, y }
  let mode = null;            // 'pan' | 'rotate' | 'pinch'
  let tap = null;             // { id, x0, y0, t0, moved, valid, pointerType }
  let lastX = 0;
  const pinch = { d0: 1, a0: 0, dist0: 20, yaw0: 0, rot: false, rotOff: 0, ax: 0, az: 0 };
  let focusGoal = null;       // {x, z}
  let zoomAnchor = null;      // { x, y, gx, gz, until }
  let hoverPending = false, hoverX = 0, hoverY = 0;

  function startPan(x, y) {
    mode = 'pan';
    if (groundAt(x, y, anchor)) anchor.y = 1; else anchor.y = 0;
    resetSamples(); pushSample();
  }
  function startPinch() {
    const [a, b] = [...pointers.values()];
    pinch.d0 = Math.max(10, Math.hypot(b.x - a.x, b.y - a.y));
    pinch.a0 = Math.atan2(b.y - a.y, b.x - a.x);
    pinch.dist0 = cam.dist; pinch.yaw0 = cam.yaw; pinch.rot = false; pinch.rotOff = 0;
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    if (groundAt(mx, my, tmp)) { pinch.ax = tmp.x; pinch.az = tmp.z; pinch.ok = true; } else pinch.ok = false;
    mode = 'pinch';
    resetSamples(); pushSample();
  }

  function onDown(e) {
    if (!cam.enabled) return;
    if (e.pointerType === 'mouse' && e.button > 2) return;
    e.preventDefault();
    refreshRect();
    try { dom.setPointerCapture(e.pointerId); } catch (_) { /* 忽略 */ }
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    cam.vel.set(0, 0); cam.yawVel = 0; focusGoal = null; zoomAnchor = null;
    if (pointers.size === 1) {
      // v2.0（整合者）：用事件發生的時間 e.timeStamp 計時，主執行緒忙（掉幀）時不會把點擊誤判成長按
      tap = { id: e.pointerId, x0: e.clientX, y0: e.clientY, t0: e.timeStamp || performance.now(), moved: 0,
        valid: e.pointerType !== 'mouse' || e.button === 0, pointerType: e.pointerType || 'mouse' };
      if (e.pointerType === 'mouse' && (e.button === 2 || e.button === 1)) { mode = 'rotate'; lastX = e.clientX; resetSamples(); pushSample(); }
      else startPan(e.clientX, e.clientY);
    } else if (pointers.size === 2) {
      if (tap) tap.valid = false;
      startPinch();
    } else if (tap) tap.valid = false;
  }

  function onMove(e) {
    if (e.pointerType === 'mouse' && pointers.size === 0) {
      hoverPending = true; hoverX = e.clientX; hoverY = e.clientY;
      return;
    }
    const p = pointers.get(e.pointerId);
    if (!p) return;
    e.preventDefault();
    p.x = e.clientX; p.y = e.clientY;
    if (tap && e.pointerId === tap.id) tap.moved = Math.max(tap.moved, Math.hypot(p.x - tap.x0, p.y - tap.y0));
    if (!cam.enabled) return;
    if (mode === 'pan' && pointers.size === 1) {
      if (tap && tap.moved < 3) return;        // 小於 3px 的抖動不移動畫面
      if (anchor.y && groundAt(p.x, p.y, tmp)) {
        target.x += anchor.x - tmp.x; target.z += anchor.z - tmp.z;
        clampTarget(); apply(); pushSample();
        cam.userMoved = true;
      } else { startPan(p.x, p.y); }
    } else if (mode === 'rotate') {
      cam.yaw -= (p.x - lastX) * 0.0085;
      lastX = p.x;
      apply(); pushSample();
      cam.userMoved = true;
    } else if (mode === 'pinch' && pointers.size >= 2) {
      const [a, b] = [...pointers.values()];
      const d = Math.max(10, Math.hypot(b.x - a.x, b.y - a.y));
      const ang = Math.atan2(b.y - a.y, b.x - a.x);
      cam.dist = cam.distGoal = clamp(pinch.dist0 * pinch.d0 / d, cam.minDist, cam.maxDist);
      const da = angDiff(ang, pinch.a0);
      if (!pinch.rot && Math.abs(da) > ROT_THRESHOLD) { pinch.rot = true; pinch.rotOff = Math.sign(da) * ROT_THRESHOLD; }
      if (pinch.rot) cam.yaw = pinch.yaw0 + (da - pinch.rotOff);
      apply();
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      if (pinch.ok && groundAt(mx, my, tmp)) {
        target.x += pinch.ax - tmp.x; target.z += pinch.az - tmp.z;
        clampTarget(); apply();
      }
      pushSample();
      cam.userMoved = true;
    }
  }

  function onUp(e) {
    const p = pointers.get(e.pointerId);
    if (!p) return;
    pointers.delete(e.pointerId);
    try { dom.releasePointerCapture(e.pointerId); } catch (_) { /* 忽略 */ }
    const cancelled = e.type === 'pointercancel';
    if (tap && e.pointerId === tap.id) {
      const dt = (e.timeStamp || performance.now()) - tap.t0;
      const ok = !cancelled && tap.valid && tap.moved < TAP_MOVE && dt < TAP_TIME && pointers.size === 0;
      const info = { x: e.clientX, y: e.clientY, type: tap.pointerType };
      tap = null;
      if (ok && hooks.onTap) {
        if (mode === 'pan') { cam.vel.set(0, 0); }
        mode = null;
        hooks.onTap(info.x, info.y, info.type);
        return;
      }
    }
    if (pointers.size === 0) {
      if (!cancelled) releaseVelocity(mode === 'pan', mode === 'rotate' || mode === 'pinch');
      if (mode === 'pinch') cam.vel.set(0, 0);
      mode = null;
    } else if (pointers.size === 1 && mode === 'pinch') {
      const [q] = [...pointers.values()];
      startPan(q.x, q.y);
    }
  }

  function onWheel(e) {
    if (!cam.enabled) return;
    e.preventDefault();
    refreshRect();
    let dy = e.deltaY;
    if (e.deltaMode === 1) dy *= 16; else if (e.deltaMode === 2) dy *= 400;
    const k = e.ctrlKey ? 0.012 : 0.0016;          // 觸控板捏合（ctrlKey）要靈敏一點
    cam.distGoal = clamp(cam.distGoal * Math.exp(clamp(dy, -300, 300) * k), cam.minDist, cam.maxDist);
    if (groundAt(e.clientX, e.clientY, tmp)) zoomAnchor = { x: e.clientX, y: e.clientY, gx: tmp.x, gz: tmp.z, until: performance.now() + 700 };
    focusGoal = null;
    cam.userMoved = true;
  }

  const onContext = (e) => e.preventDefault();
  const onLeave = (e) => { if (e.pointerType === 'mouse' && pointers.size === 0 && hooks.onHoverEnd) hooks.onHoverEnd(); hoverPending = false; };
  // iOS：阻止頁面捏合縮放／捲動
  const prevent = (e) => { if (e.cancelable) e.preventDefault(); };

  // ---------------------------------------------------------------- 鍵盤
  const keys = new Set();
  const KEYMAP = {
    KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
    KeyQ: 'rotL', KeyE: 'rotR', Equal: 'in', NumpadAdd: 'in', Minus: 'out', NumpadSubtract: 'out',
  };
  function keyOf(e) {
    if (e.key === '+' ) return 'in';
    if (e.key === '-' || e.key === '_') return 'out';
    return KEYMAP[e.code] || null;
  }
  function onKeyDown(e) {
    if (!cam.enabled || e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    const k = keyOf(e);
    if (!k) return;
    keys.add(k);
    focusGoal = null;
    cam.userMoved = true;
    if (k === 'in' || k === 'out') {
      if (!e.repeat) cam.distGoal = clamp(cam.distGoal * (k === 'in' ? 0.85 : 1 / 0.85), cam.minDist, cam.maxDist);
    }
    if (e.code && e.code.startsWith('Arrow')) e.preventDefault();
  }
  function onKeyUp(e) { const k = keyOf(e); if (k) keys.delete(k); }
  const onBlur = () => keys.clear();

  dom.style.touchAction = 'none';
  dom.style.webkitUserSelect = 'none';
  dom.style.userSelect = 'none';
  dom.style.webkitTouchCallout = 'none';
  dom.style.webkitTapHighlightColor = 'transparent';
  dom.addEventListener('pointerdown', onDown);
  dom.addEventListener('pointermove', onMove);
  dom.addEventListener('pointerup', onUp);
  dom.addEventListener('pointercancel', onUp);
  dom.addEventListener('pointerleave', onLeave);
  dom.addEventListener('wheel', onWheel, { passive: false });
  dom.addEventListener('contextmenu', onContext);
  dom.addEventListener('touchstart', prevent, { passive: false });
  dom.addEventListener('touchmove', prevent, { passive: false });
  document.addEventListener('gesturestart', prevent, { passive: false });
  document.addEventListener('gesturechange', prevent, { passive: false });
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);

  // ---------------------------------------------------------------- 更新
  const keyVel = new THREE.Vector2();
  let keyYawVel = 0;
  let shakeAmp = 0, shakeTime = 0, shakeDur = 0.0001, shakeT = 0;
  let autoRotate = 0;   // 每秒旋轉的弧度（標題／地圖畫面的背景慢慢轉）

  cam.update = function (dt) {
    dt = Math.min(dt, 0.1);
    // 鍵盤平移／旋轉
    const f = (keys.has('up') ? 1 : 0) - (keys.has('down') ? 1 : 0);
    const r = (keys.has('right') ? 1 : 0) - (keys.has('left') ? 1 : 0);
    const sp = cam.dist * cam.keyPanSpeed;
    const fx = -Math.sin(cam.yaw), fz = -Math.cos(cam.yaw), rx = Math.cos(cam.yaw), rz = -Math.sin(cam.yaw);
    const wantX = (fx * f + rx * r) * sp, wantZ = (fz * f + rz * r) * sp;
    const kk = 1 - Math.exp(-dt * 10);
    keyVel.x += (wantX - keyVel.x) * kk; keyVel.y += (wantZ - keyVel.y) * kk;
    if (keyVel.lengthSq() > 1e-6) { target.x += keyVel.x * dt; target.z += keyVel.y * dt; }
    const wantYaw = ((keys.has('rotL') ? 1 : 0) - (keys.has('rotR') ? 1 : 0)) * cam.keyRotSpeed;
    keyYawVel += (wantYaw - keyYawVel) * kk;
    cam.yaw += keyYawVel * dt;
    if (keys.has('in')) cam.distGoal = clamp(cam.distGoal * Math.exp(-cam.keyZoomSpeed * dt), cam.minDist, cam.maxDist);
    if (keys.has('out')) cam.distGoal = clamp(cam.distGoal * Math.exp(cam.keyZoomSpeed * dt), cam.minDist, cam.maxDist);

    if (autoRotate && !mode) cam.yaw += autoRotate * dt;
    // 慣性
    if (!mode) {
      if (cam.vel.lengthSq() > 1e-5) {
        target.x += cam.vel.x * dt; target.z += cam.vel.y * dt;
        cam.vel.multiplyScalar(Math.exp(-cam.panFriction * dt));
      } else cam.vel.set(0, 0);
      if (Math.abs(cam.yawVel) > 1e-4) { cam.yaw += cam.yawVel * dt; cam.yawVel *= Math.exp(-cam.rotFriction * dt); } else cam.yawVel = 0;
    }
    // 聚焦動畫
    if (focusGoal) {
      const k = 1 - Math.exp(-dt * 5);
      target.x += (focusGoal.x - target.x) * k; target.z += (focusGoal.z - target.z) * k;
      if (focusGoal.dist) cam.distGoal = focusGoal.dist;
      if (Math.hypot(focusGoal.x - target.x, focusGoal.z - target.z) < 0.01) focusGoal = null;
    }
    // 平滑縮放（滾輪時以游標為錨點）
    if (mode !== 'pinch' && Math.abs(cam.distGoal - cam.dist) > 1e-4) {
      cam.dist += (cam.distGoal - cam.dist) * (1 - Math.exp(-dt * cam.zoomSmooth));
      if (zoomAnchor) {
        apply();
        if (groundAt(zoomAnchor.x, zoomAnchor.y, tmp)) { target.x += zoomAnchor.gx - tmp.x; target.z += zoomAnchor.gz - tmp.z; }
      }
    }
    if (zoomAnchor && performance.now() > zoomAnchor.until) zoomAnchor = null;
    clampTarget();
    // 震動
    if (shakeTime > 0) {
      shakeTime -= dt; shakeT += dt;
      const a = shakeAmp * Math.max(0, shakeTime / shakeDur);
      shakeOff.set(Math.sin(shakeT * 61) * a, Math.sin(shakeT * 47 + 1.3) * a * 0.6, Math.sin(shakeT * 53 + 2.1) * a);
    } else shakeOff.set(0, 0, 0);
    apply();
    // 滑鼠 hover：一幀最多一次
    if (hoverPending) { hoverPending = false; if (hooks.onHover) hooks.onHover(hoverX, hoverY); }
  };

  /** 鏡頭震動：amp（世界單位）、dur（秒）。重疊時取較大值 */
  cam.shake = function (amp = 0.3, dur = 0.4) {
    if (amp * Math.max(0, shakeTime / shakeDur) > amp) return;
    shakeAmp = amp; shakeDur = dur; shakeTime = dur;
  };

  // ---------------------------------------------------------------- 關卡與重設
  /** W,H：地圖大小；bounds：陸地格範圍 {minC,maxC,minR,maxR}；view：{yaw,zoom}（levelDef.camera） */
  cam.setLevel = function (W, H, bounds, view = {}) {
    cam.W = W; cam.H = H;
    cam.level = { bounds, view: view || {} };
    const b = bounds;
    cam.bounds = { minX: b.minC - W / 2, maxX: b.maxC + 1 - W / 2, minZ: b.minR - H / 2, maxZ: b.maxR + 1 - H / 2 };
    cam.reset();
  };

  /** 計算讓整座島剛好入鏡的距離與目標點（考慮畫面比例與 HUD 邊距） */
  function computeFit(yaw) {
    const lv = cam.level;
    if (!lv) return { dist: 20, x: 0, z: 0 };
    const W = cam.W, H = cam.H, b = lv.bounds;
    const x0 = b.minC - W / 2 - 0.2, x1 = b.maxC + 1 - W / 2 + 0.2;
    const z0 = b.minR - H / 2 - 0.2, z1 = b.maxR + 1 - H / 2 + 0.2;
    const corners = [];
    for (const x of [x0, x1]) for (const z of [z0, z1]) for (const y of [-0.3, 0.9]) corners.push(new THREE.Vector3(x, y, z));
    const M = cam.fitMargin;
    const saveYaw = cam.yaw, saveDist = cam.dist, sx = target.x, sz = target.z;
    cam.yaw = yaw;
    target.set((x0 + x1) / 2, 0, (z0 + z1) / 2);
    const p = new THREE.Vector3();
    const fits = (d) => {
      cam.dist = d; apply();
      for (const c of corners) {
        p.copy(c).project(camera);
        if (p.z > 1 || p.x < -M.left || p.x > M.right || p.y > M.top || p.y < -M.bottom) return false;
      }
      return true;
    };
    let dist = 20;
    for (let iter = 0; iter < 4; iter++) {
      let lo = 3, hi = 160;
      for (let i = 0; i < 26; i++) { const mid = (lo + hi) / 2; if (fits(mid)) hi = mid; else lo = mid; }
      dist = hi;
      // 把投影後的外框置中到可用區域
      cam.dist = dist; apply();
      let nx0 = 9, nx1 = -9, ny0 = 9, ny1 = -9;
      for (const c of corners) { p.copy(c).project(camera); nx0 = Math.min(nx0, p.x); nx1 = Math.max(nx1, p.x); ny0 = Math.min(ny0, p.y); ny1 = Math.max(ny1, p.y); }
      const cx = (nx0 + nx1) / 2, cy = (ny0 + ny1) / 2;
      const wantX = (M.right - M.left) / 2, wantY = (M.top - M.bottom) / 2;
      if (Math.abs(cx - wantX) < 0.004 && Math.abs(cy - wantY) < 0.004) break;
      if (groundAtNdc(cx, cy, tmp) && groundAtNdc(wantX, wantY, tmp2)) {
        target.x += tmp.x - tmp2.x; target.z += tmp.z - tmp2.z;
      }
    }
    const res = { dist, x: target.x, z: target.z };
    cam.yaw = saveYaw; cam.dist = saveDist; target.x = sx; target.z = sz;
    return res;
  }

  cam.reset = function () {
    refreshRect();
    const view = (cam.level && cam.level.view) || {};
    const yaw = Number.isFinite(view.yaw) ? view.yaw : 0;
    const fit = computeFit(yaw);
    cam.fitDist = fit.dist;
    cam.maxDist = fit.dist * 1.3;
    cam.minDist = Math.min(5.5, fit.dist * 0.6);
    const zoom = Number.isFinite(view.zoom) && view.zoom > 0 ? view.zoom : 1;
    cam.yaw = yaw;
    cam.dist = cam.distGoal = clamp(fit.dist / zoom, cam.minDist, cam.maxDist);
    target.set(fit.x, 0, fit.z);
    // 平移範圍至少包含重設時的目標點
    const b = cam.bounds;
    b.minX = Math.min(b.minX, target.x); b.maxX = Math.max(b.maxX, target.x);
    b.minZ = Math.min(b.minZ, target.z); b.maxZ = Math.max(b.maxZ, target.z);
    cam.vel.set(0, 0); cam.yawVel = 0; focusGoal = null; zoomAnchor = null;
    cam.userMoved = false;
    apply();
  };

  /** 視窗大小改變：沒動過鏡頭就重新取景；動過就只更新縮放範圍 */
  cam.onResize = function () {
    refreshRect();
    if (!cam.level) { apply(); return; }
    if (!cam.userMoved) { cam.reset(); return; }
    const fit = computeFit(cam.yaw);
    cam.fitDist = fit.dist; cam.maxDist = fit.dist * 1.3; cam.minDist = Math.min(5.5, fit.dist * 0.6);
    cam.dist = cam.distGoal = clamp(cam.dist, cam.minDist, cam.maxDist);
    apply();
  };

  /** 平滑移到格子座標 (x, z)；zoom 選填（1＝整島入鏡的距離，2＝拉近一倍） */
  cam.focus = function (x, z, zoom) {
    focusGoal = { x: x - cam.W / 2, z: z - cam.H / 2, dist: zoom ? clamp(cam.fitDist / zoom, cam.minDist, cam.maxDist) : 0 };
    cam.vel.set(0, 0);
  };

  /** 背景自動慢轉：on＝true／false，speed＝每秒弧度（預設 0.07） */
  cam.setAutoRotate = function (on, speed = 0.07) { autoRotate = on ? speed : 0; };

  /** 套用關卡開場鏡頭 { yaw, zoom }（buildLevel 已自動套用 levelDef.camera，重複呼叫無妨） */
  cam.setView = function (view = {}) {
    if (!cam.level) return;
    cam.level.view = view || {};
    cam.reset();
  };

  cam.groundAt = groundAt;
  cam.refreshRect = refreshRect;
  cam.apply = apply;
  cam.isDragging = () => mode !== null;
  cam.dispose = function () {
    dom.removeEventListener('pointerdown', onDown);
    dom.removeEventListener('pointermove', onMove);
    dom.removeEventListener('pointerup', onUp);
    dom.removeEventListener('pointercancel', onUp);
    dom.removeEventListener('pointerleave', onLeave);
    dom.removeEventListener('wheel', onWheel);
    dom.removeEventListener('contextmenu', onContext);
    dom.removeEventListener('touchstart', prevent);
    dom.removeEventListener('touchmove', prevent);
    document.removeEventListener('gesturestart', prevent);
    document.removeEventListener('gesturechange', prevent);
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('blur', onBlur);
  };
  apply();
  return cam;
}
