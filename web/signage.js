// 銀座識別標示：袖看板（一棟樓多家店的直立招牌）、藍底街道名牌、和光鐘樓（指針跟隨場景時間）。
import * as THREE from 'three';
import { pushSign, meshFrom, newBuffer } from './streetscape.js';
import { WAKO } from './references.js';
import { createLightboxes } from './lightboxes.js';

const ATLAS_W = 4096;
const ATLAS_H = 2048;
const BOARD_CELL = [128, 512];   // 每列 32 格 × 3 列 = 96 塊袖看板
const BOARD_ROWS = 3;
const STREET_CELL = [256, 64];   // 每列 16 格 × 8 列 = 128 個街名
const STREET_TOP = BOARD_ROWS * BOARD_CELL[1];
const BOARD_COLORS = ['#7a1c22', '#1d2a4a', '#111111', '#2f4a3a', '#5a3d1e', '#3a3a40', '#8c6a2a'];
const SANS = '"Hiragino Sans", "Noto Sans JP", sans-serif';
const SERIF = '"Hiragino Mincho ProN", "Noto Serif JP", serif';
const STREET_BLUE = '#1d4f9e';

function fitText(ctx, text, weight, family, maxWidth, maxSize) {
  let size = maxSize;
  do {
    ctx.font = `${weight} ${size}px ${family}`;
    size -= 1;
  } while (size > 8 && ctx.measureText(text).width > maxWidth);
}

function drawBoard(ctx, x, y, names) {
  const [w, h] = BOARD_CELL;
  const rowH = h / names.length;
  ctx.fillStyle = '#e9e4da'; ctx.fillRect(x, y, w, h);
  names.forEach((name, i) => {
    const top = y + i * rowH;
    ctx.fillStyle = BOARD_COLORS[(name.length + i) % BOARD_COLORS.length];
    ctx.fillRect(x + 4, top + 3, w - 8, rowH - 6);
    fitText(ctx, name, 600, /[a-zA-Z]/.test(name) ? SANS : SERIF, w - 16, Math.min(28, rowH * 0.5));
    ctx.fillStyle = '#f8f3e8'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(name, x + w / 2, top + rowH / 2);
  });
}

function drawStreet(ctx, x, y, name, en) {
  const [w, h] = STREET_CELL;
  ctx.fillStyle = STREET_BLUE; ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.strokeRect(x + 4, y + 4, w - 8, h - 8);
  ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  fitText(ctx, name, 700, SANS, w - 24, en ? 26 : 32);
  ctx.fillText(name, x + w / 2, y + (en ? h * 0.4 : h / 2));
  if (en) {
    fitText(ctx, en, 500, SANS, w - 24, 13);
    ctx.fillText(en, x + w / 2, y + h * 0.76);
  }
}

function pushGeometry(buf, geometry) {
  const g = geometry.toNonIndexed();
  buf.position.push(...g.attributes.position.array);
  buf.normal.push(...g.attributes.normal.array);
  buf.uv.push(...g.attributes.uv.array);
  g.dispose();
}

function buildBoards(ctx, boards, buf, boxes) {
  const max = (ATLAS_W / BOARD_CELL[0]) * BOARD_ROWS;
  const ordered = [...boards].sort((a, b) => b.names.length - a.names.length).slice(0, max);
  ordered.forEach((board, i) => {
    const cell = [(i % 32) * BOARD_CELL[0], Math.floor(i / 32) * BOARD_CELL[1], ...BOARD_CELL];
    drawBoard(ctx, cell[0], cell[1], board.names);
    const height = Math.min(board.names.length * 1.15, board.top - 5);
    if (height < 2) return;
    const center = new THREE.Vector3(board.x + board.nx * 0.75, 4.2 + height / 2, board.z + board.nz * 0.75);
    const side = new THREE.Vector3(-board.nz, 0, board.nx); // 垂直牆面突出，正反兩面
    const front = center.clone().addScaledVector(side, 0.17);
    pushSign(buf, front, side, 1.2, height, cell, ATLAS_W, ATLAS_H);
    pushSign(buf, center.clone().addScaledVector(side, -0.17), side.clone().negate(), 1.2, height, cell, ATLAS_W, ATLAS_H);
    boxes.add(front, side, 1.2, height, '#fff2db', 0.316, true);
  });
  return ordered.length;
}

function buildStreetSigns(ctx, signs, panels, poles) {
  const cells = new Map();
  for (const s of signs) {
    if (!cells.has(s.name)) {
      const i = cells.size;
      if (i >= 16 * 8) continue;
      const cell = [(i % 16) * STREET_CELL[0], STREET_TOP + Math.floor(i / 16) * STREET_CELL[1], ...STREET_CELL];
      drawStreet(ctx, cell[0], cell[1], s.name, s.en);
      cells.set(s.name, cell);
    }
    const cell = cells.get(s.name);
    pushGeometry(poles, new THREE.CylinderGeometry(0.05, 0.06, 3.3, 6).translate(s.x, 1.65, s.z));
    // 名牌面向道路行進方向，讓沿街行走的人看得到；正反兩面
    const face = new THREE.Vector3(s.dx, 0, s.dz);
    const center = new THREE.Vector3(s.x, 3.05, s.z);
    pushSign(panels, center.clone().addScaledVector(face, 0.03), face, 1.6, 0.4, cell, ATLAS_W, ATLAS_H);
    pushSign(panels, center.clone().addScaledVector(face, -0.03), face.clone().negate(), 1.6, 0.4, cell, ATLAS_W, ATLAS_H);
  }
}

function drawClockFace(canvas, hour) {
  const ctx = canvas.getContext('2d');
  const r = canvas.width / 2;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#d7e0dd'; ctx.beginPath(); ctx.arc(r, r, r - 2, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#1b1b1b'; ctx.lineWidth = 8; ctx.stroke();
  ctx.fillStyle = '#1b1b1b'; ctx.font = `600 ${r * 0.2}px ${SERIF}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ['12', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11'].forEach((numeral, i) => {
    const a = (i / 12) * Math.PI * 2;
    ctx.fillText(numeral, r + Math.sin(a) * r * 0.74, r - Math.cos(a) * r * 0.74);
  });
  const hand = (angle, length, width) => {
    ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(r, r);
    ctx.lineTo(r + Math.sin(angle) * length, r - Math.cos(angle) * length); ctx.stroke();
  };
  hand(((hour % 12) / 12) * Math.PI * 2, r * (0.75 / 1.2), 9);
  hand(((hour % 1) * Math.PI * 2), r * (1.17 / 1.2), 5);
}

// 和光官方照片：方形石塔、青銅窗飾、四個朝向正方位的鐘面與 8 m 避雷針。
function buildClockTower(clock) {
  const group = new THREE.Group();
  if (!clock) return { group, setHour() {}, setNight() {} };
  const stone = new THREE.MeshStandardMaterial({ color: '#dedbd1', roughness: 0.82 });
  const bronze = new THREE.MeshStandardMaterial({ color: '#514c41', roughness: 0.55, metalness: 0.35 });
  const parts = [
    [new THREE.BoxGeometry(5, 7.6, 5), stone, 3.8],
    [new THREE.BoxGeometry(5.5, 0.35, 5.5), bronze, 7.6],
    [new THREE.BoxGeometry(5.9, 0.4, 5.9), stone, 7.95],
    [new THREE.BoxGeometry(5.6, 0.15, 5.6), stone, 8.225],
    [new THREE.CylinderGeometry(0.3, 0.5, 0.79, 8), stone, 8.695],
    [new THREE.CylinderGeometry(0.025, 0.07, WAKO.lightningRodHeight, 8), bronze, WAKO.towerHeight + WAKO.lightningRodHeight / 2],
  ];
  for (const [geometry, material, y] of parts) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(clock.x, clock.base + y, clock.z);
    mesh.castShadow = mesh.receiveShadow = true;
    group.add(mesh);
  }
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const faceMaterial = new THREE.MeshStandardMaterial({ map: texture, emissive: '#fff4d8', emissiveMap: texture, emissiveIntensity: 0 });
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2;
    const facade = new THREE.Group();
    const panel = new THREE.Mesh(new THREE.BoxGeometry(1.95, 3.5, 0.06), bronze);
    panel.position.set(0, 2.8, 2.53); facade.add(panel);
    for (const side of [-1, 1]) {
      const column = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 3.6, 10), stone);
      column.position.set(side * 1.7, 3.25, 2.58); facade.add(column);
      for (const y of [1.4, 5.05]) {
        const cap = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.28, 0.5), stone);
        cap.position.set(side * 1.7, y, 2.57); facade.add(cap);
      }
    }
    for (const x of [-0.48, 0, 0.48]) for (const y of [1.55, 2.15, 2.75, 3.35]) {
      const scroll = new THREE.Mesh(new THREE.TorusGeometry(0.21, 0.025, 5, 12), stone);
      scroll.position.set(x, y, 2.58); facade.add(scroll);
    }
    facade.position.set(clock.x, clock.base, clock.z); facade.rotation.y = a; group.add(facade);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(1.37, 0.13, 8, 32), stone);
    rim.position.set(clock.x + Math.sin(a) * 2.6, clock.base + 5.8, clock.z + Math.cos(a) * 2.6);
    rim.rotation.y = a;
    group.add(rim);
    const face = new THREE.Mesh(new THREE.CircleGeometry(WAKO.dialDiameter / 2, 32), faceMaterial);
    face.position.set(clock.x + Math.sin(a) * 2.66, clock.base + 5.8, clock.z + Math.cos(a) * 2.66);
    face.rotation.y = a;
    group.add(face);
  }
  return {
    group,
    setHour(hour) { drawClockFace(canvas, hour); texture.needsUpdate = true; },
    setNight(night) { faceMaterial.emissiveIntensity = night * 0.9; },
  };
}

export function buildSignage({ boards = [], streetSigns = [], clock = null }) {
  const canvas = document.createElement('canvas');
  canvas.width = ATLAS_W;
  canvas.height = ATLAS_H;
  const ctx = canvas.getContext('2d');
  const boardBuf = newBuffer(), panelBuf = newBuffer(), poleBuf = newBuffer();
  const boxes = createLightboxes();
  const boardCount = buildBoards(ctx, boards, boardBuf, boxes);
  buildStreetSigns(ctx, streetSigns, panelBuf, poleBuf);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  const signMaterial = new THREE.MeshStandardMaterial({ map: texture, emissive: '#ffffff', emissiveMap: texture, emissiveIntensity: 0.12, roughness: 0.5 });
  const poleMaterial = new THREE.MeshStandardMaterial({ color: '#8a8d91', roughness: 0.4, metalness: 0.6 });
  const tower = buildClockTower(clock);
  const lightboxes = boxes.finish();
  const group = new THREE.Group();
  group.add(meshFrom(boardBuf, signMaterial), meshFrom(panelBuf, signMaterial), meshFrom(poleBuf, poleMaterial, true), tower.group, lightboxes.group);
  return {
    group,
    counts: { boards: boardCount, streetSigns: streetSigns.length },
    setHour: tower.setHour,
    setNight(night) {
      signMaterial.emissiveIntensity = 0.08 + night * 1.6;
      lightboxes.setNight(night);
      tower.setNight(night);
    },
  };
}
