// 銀座 3D 城市漫遊：場景初始化、鳥瞰／街道兩種視角、地標定位、小地圖與介面。
import * as THREE from 'three';
import { OrbitControls } from './vendor/OrbitControls.js';
import { createCollider } from './collision.js';
import { buildBuildings, buildGround, buildRoads, drawGroundCanvas } from './city.js';
import { createSky, applyTime } from './sky.js';
import { buildStreetscape } from './streetscape.js';
import { createLife } from './life.js';
import { buildSignage } from './signage.js';
import { planDecor } from './decor-layout.js';
import { buildDecor } from './decor.js';
import { planInfrastructure } from './infrastructure-layout.js';
import { buildInfrastructure } from './infrastructure.js';
import { createStreetLighting } from './surface-lighting.js';
import { applyReferences } from './references.js';
import { fitCentralRoads } from './road-layout.js';
import { stepMovement } from './movement.js';

const LANDMARK_NOTES = [
  '沿弧形石材立面仰望方形鐘樓。鐘面朝向東西南北，屋頂與塔體比例參考和光官方資料。',
  '留意屋頂輪廓與街道的對比。試著退後幾步，將整棟地標放進畫面。',
  '留意上層環繞的水平「ひさし」與下層垂直「のれん」立面，參考 GINZA SIX 官方建築介紹。',
  '沿街尋找不同角度，對比玻璃、石材與招牌在日光和夜色下的變化。',
];

const EYE = 1.65;
const RADIUS = 0.35;
const WALK_SPEED = 3.2;
const RUN_SPEED = 7;
const LOOK_SPEED = 0.0022;
const MOVE_KEYS = {
  KeyW: [0, 1], ArrowUp: [0, 1], KeyS: [0, -1], ArrowDown: [0, -1],
  KeyA: [-1, 0], ArrowLeft: [-1, 0], KeyD: [1, 0], ArrowRight: [1, 0],
};

const $ = (id) => document.getElementById(id);
const state = {
  mode: 'bird', yaw: 0, pitch: 0, keys: new Set(), player: new THREE.Vector2(),
  drag: null, fly: null, shadows: true, birdView: null,
  velocity: [0, 0], autoWalk: false, turnButton: 0, stopIndex: -1,
};
let ctx; // 場景物件集合

async function loadJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} 回應 ${res.status}`);
  return res.json();
}

function jstHour() {
  const now = new Date();
  const hour = ((now.getUTCHours() + 9) % 24) + now.getUTCMinutes() / 60;
  return THREE.MathUtils.clamp(Math.round(hour * 4) / 4, 5, 22);
}

function formatHour(h) {
  return `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.round((h % 1) * 60)).padStart(2, '0')}`;
}

function toast(message) {
  const el = $('toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove('show'), 2200);
}

function createRenderer() {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  $('viewport').appendChild(renderer.domElement);
  return renderer;
}

function createLights(scene) {
  const hemi = new THREE.HemisphereLight('#ffffff', '#555555', 1);
  const sun = new THREE.DirectionalLight('#ffffff', 2.5);
  const nightFill = new THREE.DirectionalLight('#9bbdd9', 0);
  nightFill.position.set(-200, 400, 250);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.6;
  sun.shadow.camera.near = 10;
  sun.shadow.camera.far = 4000;
  scene.add(hemi, sun, sun.target, nightFill);
  return { hemi, sun, nightFill };
}

function setShadowArea(halfSize) {
  const cam = ctx.sun.shadow.camera;
  cam.left = cam.bottom = -halfSize;
  cam.right = cam.top = halfSize;
  cam.updateProjectionMatrix();
}

function lookAt(tx, tz, height) {
  const dx = tx - state.player.x, dz = tz - state.player.y;
  state.yaw = Math.atan2(-dx, -dz);
  state.pitch = THREE.MathUtils.clamp(Math.atan2(height * 0.55 - EYE, Math.hypot(dx, dz)), -0.2, 0.75);
}

function placePlayerAt(landmark) {
  stopWalking();
  const spot = ctx.collider.viewpointFor(landmark.target, landmark.id, landmark.height, RADIUS);
  if (!spot) return toast('附近找不到可站立的位置');
  state.player.set(spot[0], spot[1]);
  lookAt(landmark.target[0], landmark.target[1], landmark.height);
}

function stopWalking() {
  state.keys.clear(); state.velocity = [0, 0]; state.autoWalk = false; state.turnButton = 0;
  $('autoWalk').textContent = '▶ 自動前進'; $('autoWalk').setAttribute('aria-pressed', 'false');
}

function visitStop(index) {
  const stops = [
    { label: '街邊花壇', view: [-71, 12, 219, -14], hour: 14 },
    { label: '夜景燈箱', view: [-94, 59, 132, 12], hour: 20 },
    { label: '路燈與信號', view: [-41, -5, 247, 11], hour: 20 },
    { label: '銀座四丁目・和光', landmark: ctx.city.landmarks[0], hour: 17 },
  ];
  const stop = stops[index % stops.length];
  stopWalking(); setMode('walk'); $('walkPrompt').hidden = true;
  if (stop.landmark) placePlayerAt(stop.landmark);
  else {
    const [x, z, heading, pitch] = stop.view;
    const spot = ctx.collider.nearestFree(x, z, RADIUS);
    if (!spot) return toast('此觀景點暫時無法到達');
    state.player.set(...spot); state.yaw = -THREE.MathUtils.degToRad(heading); state.pitch = THREE.MathUtils.degToRad(pitch);
  }
  state.stopIndex = index % stops.length;
  $('time').value = stop.hour; updateTime(stop.hour);
  $('landmarkNote').textContent = `正在看：${stop.label}。可拖曳轉頭；點「下一景點」繼續，不必手動找路。`;
  for (const button of $('landmarks').children) button.setAttribute('aria-pressed', 'false');
  toast(`已到達「${stop.label}」`);
}

function syncModeUI(mode) {
  document.body.dataset.mode = mode;
  for (const id of ['bird', 'walk']) {
    $(id).classList.toggle('selected', mode === id);
    $(id).setAttribute('aria-pressed', String(mode === id));
  }
  $('modeLabel').textContent = mode === 'bird' ? '城市鳥瞰' : '街道漫遊';
  $('hint').innerHTML = mode === 'bird'
    ? '<span class="hint-dot"></span> 拖曳旋轉 <b>·</b> 滾輪縮放 <b>·</b> 右鍵平移'
    : '<span class="hint-dot"></span> 拖曳轉頭 · Q/E 轉向 · WASD 行走 · Esc 停止';
  if (mode === 'bird') $('streetPlate').hidden = true;
}

function setMode(mode) {
  const { camera, controls } = ctx;
  if (mode === state.mode) return;
  stopWalking();
  state.fly = null;
  if (mode === 'walk') {
    state.birdView = { position: camera.position.clone(), target: controls.target.clone() };
    // 從鳥瞰中心附近的街道開始
    const spot = ctx.collider.nearestFree(controls.target.x, controls.target.z, RADIUS);
    if (spot) state.player.set(spot[0], spot[1]);
    controls.enabled = false;
    camera.fov = 70;
    setShadowArea(160);
    $('walkPrompt').hidden = true; // 不再用鎖定滑鼠提示遮住觀景；拖曳即可轉頭。
  } else {
    if (document.pointerLockElement) document.exitPointerLock();
    controls.enabled = true;
    camera.fov = 50;
    const view = state.birdView;
    controls.target.set(state.player.x, 0, state.player.y);
    const offset = view ? view.position.clone().sub(view.target) : new THREE.Vector3(-420, 520, 620);
    camera.position.copy(controls.target).add(offset);
    camera.rotation.order = 'XYZ';
    setShadowArea(760);
    $('walkPrompt').hidden = true;
  }
  camera.updateProjectionMatrix();
  state.mode = mode;
  syncModeUI(mode);
}

function goToLandmark(landmark) {
  const index = ctx.city.landmarks.indexOf(landmark);
  $('landmarkNote').textContent = LANDMARK_NOTES[index] || LANDMARK_NOTES[0];
  for (const button of $('landmarks').children) button.setAttribute('aria-pressed', String(button.textContent === landmark.label));
  if (state.mode === 'walk') {
    placePlayerAt(landmark);
    return toast(`已移動到「${landmark.label}」附近`);
  }
  const [tx, tz] = landmark.target;
  const toTarget = new THREE.Vector3(tx, landmark.height * 0.4, tz);
  const offset = ctx.camera.position.clone().sub(ctx.controls.target).setLength(Math.max(260, landmark.height * 3));
  state.fly = {
    t: 0, fromPos: ctx.camera.position.clone(), fromTarget: ctx.controls.target.clone(),
    toPos: toTarget.clone().add(offset), toTarget,
  };
}

function turn(dx, dy) {
  state.yaw -= dx * LOOK_SPEED;
  state.pitch = THREE.MathUtils.clamp(state.pitch - dy * LOOK_SPEED, -1.35, 1.35);
}

function bindPointer(canvas) {
  document.addEventListener('pointerlockchange', () => {
    if (state.mode === 'walk') $('walkPrompt').hidden = true;
  });
  document.addEventListener('mousemove', (e) => {
    if (document.pointerLockElement === canvas) turn(e.movementX, e.movementY);
  });
  canvas.addEventListener('pointerdown', (e) => {
    if (state.mode !== 'walk' || document.pointerLockElement) return;
    state.drag = { x: e.clientX, y: e.clientY, id: e.pointerId };
    $('walkPrompt').hidden = true;
  });
  window.addEventListener('pointermove', (e) => {
    if (!state.drag || e.pointerId !== state.drag.id) return;
    turn((e.clientX - state.drag.x) * 1.6, (e.clientY - state.drag.y) * 1.6);
    state.drag.x = e.clientX;
    state.drag.y = e.clientY;
  });
  window.addEventListener('pointerup', () => { state.drag = null; });
}

function bindKeys() {
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Escape') { stopWalking(); return; }
    if (e.target instanceof HTMLElement && e.target.closest('input, select, textarea, [contenteditable=true]')) return;
    if (MOVE_KEYS[e.code] && state.autoWalk) stopWalking();
    state.keys.add(e.code);
    if (MOVE_KEYS[e.code] && state.mode === 'walk') e.preventDefault();
  });
  window.addEventListener('keyup', (e) => state.keys.delete(e.code));
  window.addEventListener('blur', stopWalking);
  document.addEventListener('visibilitychange', () => { if (document.hidden) stopWalking(); });
  for (const button of document.querySelectorAll('[data-move]')) {
    const code = button.dataset.move;
    button.addEventListener('pointerdown', (e) => { e.preventDefault(); if (state.autoWalk) stopWalking(); state.keys.add(code); });
    for (const type of ['pointerup', 'pointerleave', 'pointercancel']) button.addEventListener(type, () => state.keys.delete(code));
  }
}

function bindInput() {
  $('sceneFocus').addEventListener('click', () => {
    const focused = document.body.classList.toggle('scene-focused');
    $('sceneFocus').setAttribute('aria-pressed', String(focused));
    $('sceneFocus').textContent = focused ? '顯示面板' : '專注看景';
  });
  const canvas = ctx.renderer.domElement;
  $('bird').onclick = () => setMode('bird');
  $('walk').onclick = () => setMode('walk');
  $('enterWalk').onclick = () => canvas.requestPointerLock?.();
  $('helpToggle').onclick = () => { $('help').hidden = !$('help').hidden; };
  $('closeHelp').onclick = () => { $('help').hidden = true; };
  $('postcard').onclick = savePostcard;
  $('visitFlowers').onclick = () => visitStop(0);
  $('visitNight').onclick = () => visitStop(1);
  $('nextStop').onclick = () => visitStop(state.stopIndex + 1);
  $('autoWalk').onclick = () => {
    state.autoWalk = !state.autoWalk;
    $('autoWalk').textContent = state.autoWalk ? '■ 停止前進' : '▶ 自動前進';
    $('autoWalk').setAttribute('aria-pressed', String(state.autoWalk));
  };
  for (const button of document.querySelectorAll('[data-turn]')) {
    button.onpointerdown = (event) => { event.preventDefault(); button.setPointerCapture(event.pointerId); state.turnButton = Number(button.dataset.turn); };
    button.onpointerup = button.onpointercancel = button.onlostpointercapture = () => { state.turnButton = 0; };
    button.onclick = (event) => { if (event.detail === 0) state.yaw += Number(button.dataset.turn) * Math.PI / 12; };
  }
  for (const button of document.querySelectorAll('[data-hour]')) button.onclick = () => {
    const hour = Number(button.dataset.hour);
    $('time').value = hour;
    updateTime(hour);
  };
  $('shadows').onchange = (e) => { state.shadows = e.target.checked; };
  $('time').oninput = (e) => updateTime(Number(e.target.value));
  bindPointer(canvas);
  bindKeys();
  window.addEventListener('resize', () => {
    ctx.camera.aspect = window.innerWidth / window.innerHeight;
    ctx.camera.updateProjectionMatrix();
    ctx.renderer.setSize(window.innerWidth, window.innerHeight);
  });
}

function updateTime(hour) {
  const { label, night } = applyTime(hour, ctx);
  ctx.street.setNight(night);
  ctx.life.setNight(night);
  ctx.roadLayer.setNight(night);
  ctx.signage.setNight(night);
  ctx.signage.setHour(hour);
  ctx.decor.setNight(night);
  ctx.infrastructure.setNight(night);
  ctx.surfaceLighting.setNight(night);
  ctx.nightFill.intensity = night * 0.8;
  for (const button of document.querySelectorAll('[data-hour]')) button.setAttribute('aria-pressed', String(Number(button.dataset.hour) === Number(hour)));
  $('timeLabel').textContent = formatHour(hour);
  $('lightLabel').textContent = label;
}

function savePostcard() {
  const { renderer, scene, camera } = ctx;
  // 同一任務內 render → toBlob，無需保留每一幀的 framebuffer。
  renderer.render(scene, camera);
  renderer.domElement.toBlob((blob) => {
    if (!blob) return toast('無法保存畫面，請再試一次');
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ginza-${formatHour(Number($('time').value)).replace(':', '')}.png`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    toast('已保存銀座明信片');
  }, 'image/png');
}

function updateWalk(dt) {
  let ix = 0, iz = state.autoWalk ? 1 : 0;
  for (const code of state.keys) {
    const dir = MOVE_KEYS[code];
    if (dir) { ix += dir[0]; iz += dir[1]; }
  }
  state.yaw += (state.turnButton + (state.keys.has('KeyQ') ? 1 : 0) - (state.keys.has('KeyE') ? 1 : 0)) * dt * 1.25;
  const movement = stepMovement([state.player.x, state.player.y], state.velocity, [ix, iz], state.yaw,
    state.keys.has('ShiftLeft') || state.keys.has('ShiftRight') ? RUN_SPEED : WALK_SPEED, dt, ctx.collider, RADIUS);
  state.player.set(...movement.position); state.velocity = movement.velocity;
  if (state.autoWalk && movement.collided) { stopWalking(); toast('前方有障礙，已停止。可轉向或選下一景點。'); }
  ctx.camera.rotation.order = 'YXZ';
  ctx.camera.rotation.set(state.pitch, state.yaw, 0);
  ctx.camera.position.set(state.player.x, EYE, state.player.y);
}

function updateFly(dt) {
  const fly = state.fly;
  fly.t = Math.min(1, fly.t + dt / 1.4);
  const k = fly.t * fly.t * (3 - 2 * fly.t);
  ctx.controls.target.lerpVectors(fly.fromTarget, fly.toTarget, k);
  ctx.camera.position.lerpVectors(fly.fromPos, fly.toPos, k);
  if (fly.t >= 1) state.fly = null;
}

function updateSun() {
  const { sun, controls } = ctx;
  const center = state.mode === 'walk' ? new THREE.Vector3(state.player.x, 0, state.player.y) : controls.target.clone().setY(0);
  const dir = sun.userData.dir || new THREE.Vector3(0, 1, 0);
  sun.position.copy(center).addScaledVector(dir, 1800);
  sun.target.position.copy(center);
  sun.castShadow = state.shadows && sun.intensity > 0 && dir.y > 0.02;
}

function updateLabels() {
  const { camera, labels } = ctx;
  const v = new THREE.Vector3();
  // 地標先排，街名後排；避開介面面板，避免小螢幕標籤彼此遮擋。
  const occupied = ['.masthead', '.view-switch', '.environment', '.location'].flatMap((selector) => {
    const el = document.querySelector(selector);
    const rect = el.getBoundingClientRect();
    return rect.width && rect.height ? [rect] : [];
  });
  for (const { el, landmark, width, height } of labels) {
    v.set(landmark.target[0], landmark.height + 18, landmark.target[1]); // 留空間給和光鐘樓等屋頂構造
    const distance = v.distanceTo(camera.position);
    v.project(camera);
    const inRange = landmark.street ? state.mode === 'bird' && distance < 1400 : state.mode === 'bird' || distance < 420;
    const x = (v.x + 1) * window.innerWidth / 2, y = (1 - v.y) * window.innerHeight / 2;
    const box = { left: x - width / 2, right: x + width / 2, top: y - height, bottom: y };
    const overlaps = occupied.some((r) => box.left < r.right + 6 && box.right > r.left - 6 && box.top < r.bottom + 6 && box.bottom > r.top - 6);
    const visible = v.z > -1 && v.z < 1 && box.left >= 4 && box.right <= window.innerWidth - 4 && box.top >= 4 && box.bottom < window.innerHeight - 36 && inRange && !overlaps;
    el.style.opacity = visible ? '1' : '0';
    if (visible) {
      occupied.push(box);
      el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
    }
  }
}

function drawMinimap() {
  const { minimap, mini, city, controls, camera } = ctx;
  const c = minimap.getContext('2d');
  c.drawImage(mini.canvas, 0, 0, minimap.width, minimap.height);
  const [minX, minZ] = city.bounds;
  const scale = (minimap.width / mini.canvas.width) * mini.scale;
  const focus = state.mode === 'walk'
    ? { x: state.player.x, z: state.player.y, yaw: state.yaw }
    : { x: controls.target.x, z: controls.target.z, yaw: Math.atan2(camera.position.x - controls.target.x, camera.position.z - controls.target.z) };
  c.save();
  c.translate((focus.x - minX) * scale, (focus.z - minZ) * scale);
  c.rotate(-focus.yaw);
  c.fillStyle = 'rgba(214,180,110,0.3)';
  c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, 26, -Math.PI / 2 - 0.5, -Math.PI / 2 + 0.5); c.closePath(); c.fill();
  c.fillStyle = '#d6b46e';
  c.beginPath(); c.arc(0, 0, 4, 0, Math.PI * 2); c.fill();
  c.restore();
  const lat = city.origin[0] - focus.z / 111320;
  const lon = city.origin[1] + focus.x / (111320 * Math.cos(THREE.MathUtils.degToRad(lat)));
  $('position').textContent = `${lat.toFixed(4)}° N  ${lon.toFixed(4)}° E`;
}

function createLandmarkUI(landmarks) {
  return landmarks.map((landmark) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = landmark.label;
    button.setAttribute('aria-pressed', String(landmark === landmarks[0]));
    button.onclick = () => goToLandmark(landmark);
    $('landmarks').appendChild(button);
    const el = document.createElement('div');
    el.className = 'label';
    el.textContent = landmark.label;
    $('labels').appendChild(el);
    return { el, landmark, width: el.offsetWidth, height: el.offsetHeight };
  });
}

// 鳥瞰時浮在街道上方的街名（沿用地標標籤的投影邏輯）
function createStreetLabels(streets) {
  return streets.map((s) => {
    const el = document.createElement('div');
    el.className = 'label street';
    el.innerHTML = `${s.name}${s.en ? `<small>${s.en}</small>` : ''}`;
    $('labels').appendChild(el);
    return { el, landmark: { target: [s.x, s.z], height: -6, street: true }, width: el.offsetWidth, height: el.offsetHeight };
  });
}

// 漫遊時找出腳下的街道（距離中心線不超過半個路寬 + 6 m）
function currentStreet() {
  const { x, y: z } = state.player;
  let best = null;
  for (const road of ctx.namedRoads) {
    const pts = road.points;
    for (let i = 1; i < pts.length; i++) {
      const [ax, az] = pts[i - 1], [bx, bz] = pts[i];
      const dx = bx - ax, dz = bz - az;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1)));
      const d = Math.hypot(ax + dx * t - x, az + dz * t - z);
      if (d < road.width / 2 + 6 && (!best || d < best.d)) best = { d, road };
    }
  }
  return best?.road ?? null;
}

function updateStreetPlate(frame) {
  if (frame % 15) return;
  const road = state.mode === 'walk' ? currentStreet() : null;
  const plate = $('streetPlate');
  plate.hidden = !road;
  if (road) plate.innerHTML = `${road.name}${road.en ? `<small>${road.en}</small>` : ''}`;
}

function loop() {
  let last = performance.now(), frames = 0, fpsTime = 0, frameNo = 0;
  const frame = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    ctx.life.update(dt);
    if (state.mode === 'walk') updateWalk(dt);
    else {
      if (state.fly) updateFly(dt);
      ctx.controls.update();
    }
    updateSun();
    updateLabels();
    updateStreetPlate(frameNo++);
    drawMinimap();
    ctx.renderer.render(ctx.scene, ctx.camera);
    frames++;
    fpsTime += dt;
    if (fpsTime >= 1) {
      $('fps').textContent = `${Math.round(frames / fpsTime)} FPS`;
      frames = 0;
      fpsTime = 0;
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

// 網址 #@x,z,方位角[,仰角]（度；方位 0 = 北、90 = 東）→ 直接在該位置進入街道漫遊，可用來分享視角
function applyViewHash() {
  const match = location.hash.match(/^#@(-?[\d.]+),(-?[\d.]+)(?:,(-?[\d.]+))?(?:,(-?[\d.]+))?$/);
  if (!match) return false;
  const [x, z, heading = 0, pitch = 5] = match.slice(1).map((v) => (v === undefined ? undefined : Number(v)));
  const spot = ctx.collider.nearestFree(x, z, RADIUS);
  if (!spot) return false;
  setMode('walk');
  state.player.set(spot[0], spot[1]);
  state.yaw = -THREE.MathUtils.degToRad(heading);
  state.pitch = THREE.MathUtils.degToRad(THREE.MathUtils.clamp(pitch, -60, 75));
  return true;
}

function createControls(camera, renderer) {
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.zoomToCursor = true;
  controls.dampingFactor = 0.08;
  controls.maxPolarAngle = 1.42;
  controls.minDistance = 40;
  controls.maxDistance = 2600;
  controls.target.set(0, 0, 0);
  return controls;
}

async function init() {
  const [rawCity, rawRoads] = await Promise.all([loadJSON('./assets/city.json'), loadJSON('./assets/roads.json')]);
  const roads = fitCentralRoads(rawRoads);
  const city = applyReferences(rawCity);
  const renderer = createRenderer();
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog('#e7eff0', 650, 2800);
  const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.3, 9000);
  camera.position.set(-420, 520, 620);
  const { hemi, sun, nightFill } = createLights(scene);
  const sky = createSky();
  const { group: buildingGroup, wallMaterial, referenceMaterials } = buildBuildings(city.buildings);
  const street = buildStreetscape(city.buildings, city.signs || [], roads);
  const life = createLife(roads);
  const roadLayer = buildRoads(roads);
  const signage = buildSignage({ ...city, streetSigns: [] }); // 藍色名牌坐標未經實景核實；街名保留在 UI。
  const decorItems = planDecor(city, roads);
  const decor = buildDecor(decorItems);
  const infrastructureItems = planInfrastructure(city, roads, decorItems);
  const infrastructure = buildInfrastructure(infrastructureItems);
  scene.add(sky.mesh, buildingGroup, buildGround(roads, city.buildings, city.bounds, renderer), street.group, life.group, roadLayer.group, signage.group);
  scene.add(decor.group);
  scene.add(infrastructure.group);
  const surfaceLighting = createStreetLighting(city.bounds, infrastructureItems, city.signs || [], street.lightSources);
  surfaceLighting.attach(scene);

  const minimap = $('minimap');
  const mini = drawGroundCanvas(roads, city.buildings, city.bounds, 260, { forMinimap: true });
  minimap.width = mini.canvas.width;
  minimap.height = mini.canvas.height;

  ctx = {
    city, renderer, scene, camera, hemi, sun, nightFill, sky, wallMaterial, referenceMaterials, minimap, mini, street, life, roadLayer, signage, decor, infrastructure,
    surfaceLighting,
    namedRoads: roads.filter((r) => r.name && /通り|京浜/.test(r.name)),
    controls: createControls(camera, renderer),
    collider: createCollider(city.buildings, city.bounds, [...decorItems, ...infrastructureItems]),
  };
  ctx.labels = [...createLandmarkUI(city.landmarks), ...createStreetLabels(city.streets || [])];
  $('landmarkNote').textContent = LANDMARK_NOTES[0];
  setShadowArea(760);
  bindInput();
  const hour = jstHour();
  $('time').value = hour;
  updateTime(hour);
  if (city.landmarks[0]) placePlayerAt(city.landmarks[0]);
  applyViewHash();
  $('stats').textContent = `${city.buildings.length.toLocaleString()} 棟建築 · ${street.signCount} 塊招牌 · ${life.counts.cars} 輛車 · ${life.counts.people} 位行人`;
  $('loading').hidden = true;
  loop();
}

init().catch((error) => {
  $('loading').textContent = `載入失敗：${error.message}`;
  console.error(error);
});
