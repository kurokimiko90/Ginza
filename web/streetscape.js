// 街景：一樓店面櫥窗、遮陽棚、店家招牌（OSM 真實店名）。入夜後櫥窗與招牌發光。
import * as THREE from 'three';
import { pointInRing, createCollider } from './collision.js';
import { shopBays } from './shop-layout.js';
import { createLightboxes } from './lightboxes.js';
import { lightboxTint } from './night-style.js';

const SHOP_BOTTOM = 0.1;
const SHOP_TOP = 3.6;
const VARIANTS = 8;
const WALL_OFFSET = 0.06;   // 貼在外牆外側，避免 z-fighting
const H_CELL = [256, 64];   // 橫式招牌在圖集中的格子大小
const V_CELL = [64, 256];   // 直式招牌
const ATLAS_W = 2048;
const H_ROWS = 40;          // 橫式最多 8 × 40 = 320 塊
const V_ROWS = 6;           // 直式最多 32 × 6 = 192 塊
const SIGN_COLORS = [
  ['#111111', '#f4efe6'], ['#f6f3ee', '#1b1b1b'], ['#7a1c22', '#f8e9c8'], ['#1d2a4a', '#e9dcc0'],
  ['#c9a253', '#1a1408'], ['#2f4a3a', '#efe6d0'], ['#e8e2d8', '#7a1c22'], ['#000000', '#d6b46e'],
];
const SERIF = '"Hiragino Mincho ProN", "Noto Serif JP", serif';
const SANS = '"Hiragino Sans", "Noto Sans JP", sans-serif';

function hash(text) {
  let h = 2166136261;
  for (const ch of text) h = Math.imul(h ^ ch.codePointAt(0), 16777619);
  return (h >>> 0) / 4294967295;
}

const isCJK = (text) => /[぀-ヿ一-鿿]/.test(text);

function storefrontTextures() {
  // Match a ~5.5m wide / 3.5m tall bay; the old 8:1 canvas stretched objects into sticks.
  const w = 256, rowH = 128, h = rowH * VARIANTS;
  const day = document.createElement('canvas');
  const night = document.createElement('canvas');
  day.width = night.width = w;
  day.height = night.height = h;
  const d = day.getContext('2d'), n = night.getContext('2d');
  n.fillStyle = '#000'; n.fillRect(0, 0, w, h);
  const frames = ['#3b454a', '#99876b', '#dad6ce', '#6b625b', '#667576', '#43505c', '#9a8469', '#c0c2bb'];
  const glows = ['#ffe2b0', '#fff4e0', '#ffd9a0', '#e8f0ff', '#ffe9c8', '#fff0d0', '#ffd0a8', '#f4f8ff'];
  for (let v = 0; v < VARIANTS; v++) {
    const y0 = v * rowH;
    d.fillStyle = frames[v]; d.fillRect(0, y0, w, rowH);
    const panes = 3 + (v % 3);
    const paneW = w / panes;
    for (let i = 0; i < panes; i++) {
      const x = i * paneW + 8, y = y0 + 24, pw = paneW - 16, ph = rowH - 30;
      const glass = d.createLinearGradient(0, y, 0, y + ph);
      glass.addColorStop(0, '#485d62'); glass.addColorStop(0.45, '#92877a'); glass.addColorStop(1, '#c3b59e');
      d.fillStyle = glass; d.fillRect(x, y, pw, ph);
      // Perspective floor and side reveals make the display read as a shallow room.
      d.fillStyle = '#d5c6ab';
      d.beginPath(); d.moveTo(x + 12, y + ph * 0.76); d.lineTo(x + pw - 12, y + ph * 0.76);
      d.lineTo(x + pw, y + ph); d.lineTo(x, y + ph); d.fill();
      d.fillStyle = 'rgba(24,32,34,0.35)'; d.fillRect(x, y, 9, ph); d.fillRect(x + pw - 9, y, 9, ph);
      d.fillStyle = '#ead0a3'; d.fillRect(x + 10, y + ph * 0.72, pw - 20, 3);
      // 程序化商品輪廓：花盆、糕點、服裝與展示台。
      // 櫥窗內的商品陳列
      const productCount = pw < 60 ? 1 : 2;
      for (let k = 0; k < productCount; k++) {
        const r = hash(`${v}-${i}-${k}`);
        d.fillStyle = `hsl(${Math.round(r * 360)}, 35%, ${45 + r * 25}%)`;
        const gx = 0, gy = y + ph * 0.56;
        d.save(); d.translate(x + pw * (k + 1) / (productCount + 1) - 12, 0);
        d.scale(Math.min(1, (pw / productCount - 8) / 28), 1);
        if (v % 3 === 0) {
          d.fillStyle = '#72975d';
          d.beginPath(); d.ellipse(gx + 9, gy - 12, 12, 17, -0.3, 0, Math.PI * 2); d.fill();
          d.fillStyle = '#cf946c'; d.fillRect(gx, gy, 18, 18);
        } else if (v % 3 === 1) {
          d.beginPath(); d.arc(gx + 10, gy + 10, 10, Math.PI, 0); d.fill();
          d.fillStyle = '#f5e4c4'; d.fillRect(gx - 3, gy + 11, 26, 4);
        } else {
          // Apparel display: shoulders, sleeves and torso instead of colored sticks.
          d.beginPath(); d.moveTo(gx + 7, gy - 17); d.lineTo(gx + 16, gy - 17);
          d.lineTo(gx + 25, gy - 9); d.lineTo(gx + 21, gy - 3);
          d.lineTo(gx + 18, gy - 6); d.lineTo(gx + 18, gy + 17);
          d.lineTo(gx + 5, gy + 17); d.lineTo(gx + 5, gy - 6);
          d.lineTo(gx + 1, gy - 3); d.lineTo(gx - 3, gy - 9); d.closePath(); d.fill();
          d.fillStyle = '#b3aaa0'; d.fillRect(gx + 10, gy + 17, 3, 9);
        }
        d.restore();
      }
      d.fillStyle = 'rgba(255,255,255,0.09)';
      d.beginPath(); d.moveTo(x + pw * 0.6, y); d.lineTo(x + pw * 0.8, y);
      d.lineTo(x + pw * 0.35, y + ph); d.lineTo(x + pw * 0.15, y + ph); d.fill();
      n.fillStyle = glows[v]; n.globalAlpha = 0.85; n.fillRect(x, y, pw, ph); n.globalAlpha = 1;
    }
    // 每個分節各有一個入口，玻璃門／門框／把手，不再整面連續重複櫥窗。
    const doorX = v % 2 ? 190 : 13, doorW = 36;
    d.fillStyle = '#333f45'; d.fillRect(doorX - 9, y0 + 22, doorW + 18, 106);
    const doorGlass = d.createLinearGradient(doorX, y0, doorX + doorW, y0 + rowH);
    doorGlass.addColorStop(0, '#8aabae'); doorGlass.addColorStop(1, '#344951');
    d.fillStyle = doorGlass; d.fillRect(doorX, y0 + 27, doorW, 97);
    d.fillStyle = '#d2c7b4'; d.fillRect(doorX + doorW - 7, y0 + 67, 2, 26);
    d.fillStyle = 'rgba(233,242,241,0.15)'; d.fillRect(doorX + 3, y0 + 29, 5, 91);
    n.fillStyle = '#d2d4cc'; n.fillRect(doorX, y0 + 27, doorW, 97);
    d.fillStyle = '#8e8a80'; d.fillRect(0, y0 + 124, w, 4);
    d.fillStyle = 'rgba(0,0,0,0.25)'; d.fillRect(0, y0, w, 20); // 上方簷板
  }
  // 夜間保留商品與窗框細節，避免整塊櫥窗成為無細節的白色燈箱。
  n.globalCompositeOperation = 'multiply';
  n.drawImage(day, 0, 0);
  n.globalCompositeOperation = 'source-over';
  return [day, night].map((canvas) => {
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    return tex;
  });
}

export function pushQuad(buf, corners, normal, uvs, color) {
  const [a, b, c, d] = corners;
  for (const [p, uv] of [[a, uvs[0]], [b, uvs[1]], [c, uvs[2]], [a, uvs[0]], [c, uvs[2]], [d, uvs[3]]]) {
    buf.position.push(p.x, p.y, p.z);
    buf.normal.push(normal.x, normal.y, normal.z);
    buf.uv.push(uv[0], uv[1]);
    if (color) buf.color.push(color.r, color.g, color.b);
  }
}

export function meshFrom(buf, material, castShadow = false) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(buf.position, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(buf.normal, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(buf.uv, 2));
  if (buf.color.length) geometry.setAttribute('color', new THREE.Float32BufferAttribute(buf.color, 3));
  geometry.computeBoundingSphere();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = castShadow;
  mesh.receiveShadow = true;
  return mesh;
}

export const newBuffer = () => ({ position: [], normal: [], uv: [], color: [] });

function streetLookup(roads) {
  const grid = new Map(), cellSize = 32;
  for (const road of roads) {
    for (let i = 1; i < road.points.length; i++) {
      const a = road.points[i - 1], b = road.points[i], reach = road.width / 2 + 6;
      const segment = { a, b, reach };
      for (let x = Math.floor((Math.min(a[0], b[0]) - reach) / cellSize); x <= Math.floor((Math.max(a[0], b[0]) + reach) / cellSize); x++) {
        for (let z = Math.floor((Math.min(a[1], b[1]) - reach) / cellSize); z <= Math.floor((Math.max(a[1], b[1]) + reach) / cellSize); z++) {
          const key = `${x},${z}`;
          if (!grid.has(key)) grid.set(key, []);
          grid.get(key).push(segment);
        }
      }
    }
  }
  return (x, z, nx, nz) => (grid.get(`${Math.floor(x / cellSize)},${Math.floor(z / cellSize)}`) || []).some(({ a, b, reach }) => {
    const dx = b[0] - a[0], dz = b[1] - a[1];
    const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1)));
    const rx = a[0] + dx * t - x, rz = a[1] + dz * t - z;
    return rx * nx + rz * nz > 0.1 && Math.hypot(rx, rz) <= reach;
  });
}

// 只在面向街道、外側沒有相鄰建築的外牆配置店面。
function buildShopfronts(buildings, roads) {
  const fronts = newBuffer(), awnings = newBuffer(), frames = newBuffer();
  const lightSources = [];
  const awningColor = new THREE.Color();
  const facesStreet = streetLookup(roads);
  const collider = createCollider(buildings, [-10000, -10000, 10000, 10000]);
  for (const b of buildings) {
    if (['和光', 'GINZA SIX', 'GINZA PLACE'].includes(b.name)) continue; // 實景參考立面自行處理橱窗。
    if ((b.base || 0) >= 2 || b.height < SHOP_TOP + 1) continue;
    for (const ring of b.outers) {
      for (let k = 0; k < ring.length; k++) {
        let p = ring[k], q = ring[(k + 1) % ring.length];
        const length = Math.hypot(q[0] - p[0], q[1] - p[1]);
        if (length < 2.5) continue;
        let nx = (q[1] - p[1]) / length, nz = -(q[0] - p[0]) / length;
        const mx = (p[0] + q[0]) / 2, mz = (p[1] + q[1]) / 2;
        if (pointInRing(mx + nx * 0.3, mz + nz * 0.3, ring)) { nx = -nx; nz = -nz; }
        if (!facesStreet(mx, mz, nx, nz) || collider.buildingAt(mx + nx * 0.8, mz + nz * 0.8) !== null) continue;
        // 讓四邊形正面朝外：(q - p) × up 應與法向同向
        if ((-(q[1] - p[1])) * nx + (q[0] - p[0]) * nz < 0) [p, q] = [q, p];
        const off = (pt, y, extra = 0) => new THREE.Vector3(pt[0] + nx * (WALL_OFFSET + extra), y, pt[1] + nz * (WALL_OFFSET + extra));
        const normal = new THREE.Vector3(nx, 0, nz);
        const r = hash(`${b.id}-${k}`);
        const at = (distance) => [p[0] + (q[0] - p[0]) * distance / length, p[1] + (q[1] - p[1]) * distance / length];
        for (const bay of shopBays(length, `${b.id}-${k}`)) {
          const a = at(bay.start), c = at(bay.end);
          lightSources.push({ x: (a[0] + c[0]) / 2 + nx * 1.1, z: (a[1] + c[1]) / 2 + nz * 1.1 });
          const v0 = (bay.variant + 0.03) / VARIANTS, v1 = (bay.variant + 0.97) / VARIANTS;
          pushQuad(fronts, [off(a, SHOP_BOTTOM), off(c, SHOP_BOTTOM), off(c, SHOP_TOP), off(a, SHOP_TOP)], normal,
            [[0, 1 - v1], [1, 1 - v1], [1, 1 - v0], [0, 1 - v0]]);
          // 窄石材分隔條向外偏移，與玻璃分開接收光照。
          const a1 = at(Math.min(bay.end, bay.start + 0.12));
          pushQuad(frames, [off(a, SHOP_BOTTOM, 0.04), off(a1, SHOP_BOTTOM, 0.04), off(a1, SHOP_TOP, 0.04), off(a, SHOP_TOP, 0.04)], normal,
            [[0, 0], [1, 0], [1, 1], [0, 1]]);
        }
        if (b.awningVerified === true && r > 0.68 && length < 24) {
          awningColor.set(['#b95753', '#3f8790', '#d3a258', '#6d956d'][Math.floor(hash(`a${b.id}${k}`) * 4)]);
          const slope = new THREE.Vector3(nx * 0.5, 0.85, nz * 0.5).normalize();
          pushQuad(awnings, [off(p, SHOP_TOP - 0.55, 1.3), off(q, SHOP_TOP - 0.55, 1.3), off(q, SHOP_TOP), off(p, SHOP_TOP)], slope,
            [[0, 0], [1, 0], [1, 1], [0, 1]], awningColor);
        }
      }
    }
  }
  const [dayMap, nightMap] = storefrontTextures();
  const frontMaterial = new THREE.MeshStandardMaterial({
    map: dayMap, emissive: '#ffffff', emissiveMap: nightMap, emissiveIntensity: 0.35, roughness: 0.35, metalness: 0.1,
  });
  const awningMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, side: THREE.DoubleSide });
  const frameMaterial = new THREE.MeshStandardMaterial({ color: '#b8b2a7', roughness: 0.75 });
  return { meshes: [meshFrom(fronts, frontMaterial), meshFrom(frames, frameMaterial), meshFrom(awnings, awningMaterial, true)], frontMaterial, lightSources };
}

function fitFont(ctx, text, family, maxWidth, maxSize) {
  let size = maxSize;
  ctx.font = `600 ${size}px ${family}`;
  while (size > 10 && ctx.measureText(text).width > maxWidth) {
    size -= 2;
    ctx.font = `600 ${size}px ${family}`;
  }
  return size;
}

function drawHorizontal(ctx, x, y, text, colors, family) {
  const [w, h] = H_CELL;
  ctx.fillStyle = colors[0]; ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = colors[1]; ctx.globalAlpha = 0.35; ctx.strokeRect(x + 3, y + 3, w - 6, h - 6); ctx.globalAlpha = 1;
  fitFont(ctx, text, family, w - 24, 38);
  ctx.fillStyle = colors[1]; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, x + w / 2, y + h / 2 + 2);
}

function drawVertical(ctx, x, y, text, colors) {
  const [w, h] = V_CELL;
  const chars = [...text].slice(0, 8);
  ctx.fillStyle = colors[0]; ctx.fillRect(x, y, w, h);
  const size = Math.min(44, (h - 16) / chars.length);
  ctx.font = `600 ${size}px ${SERIF}`;
  ctx.fillStyle = colors[1]; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  chars.forEach((ch, i) => ctx.fillText(ch, x + w / 2, y + 8 + size * (i + 0.5)));
}

// 招牌四邊形：面向 face，中心 c，寬 w 高 h，貼圖格子 cell = [x, y, w, h]（像素，canvas 座標）
export function pushSign(buf, c, face, w, h, cell, atlasW, atlasH) {
  const up = new THREE.Vector3(0, 1, 0);
  const right = new THREE.Vector3(face.z, 0, -face.x);
  const hw = right.clone().multiplyScalar(w / 2), hh = up.multiplyScalar(h / 2);
  const u0 = cell[0] / atlasW, u1 = (cell[0] + cell[2]) / atlasW;
  const vTop = 1 - cell[1] / atlasH, vBottom = 1 - (cell[1] + cell[3]) / atlasH;
  pushQuad(buf, [
    c.clone().sub(hw).sub(hh), c.clone().add(hw).sub(hh), c.clone().add(hw).add(hh), c.clone().sub(hw).add(hh),
  ], face, [[u0, vBottom], [u1, vBottom], [u1, vTop], [u0, vTop]]);
}

function buildSigns(signs) {
  const boxes = createLightboxes();
  const atlasH = H_ROWS * H_CELL[1] + V_ROWS * V_CELL[1];
  const canvas = document.createElement('canvas');
  canvas.width = ATLAS_W;
  canvas.height = atlasH;
  const ctx = canvas.getContext('2d');
  const buf = newBuffer();
  let hCount = 0, vCount = 0;
  const hMax = (ATLAS_W / H_CELL[0]) * H_ROWS, vMax = (ATLAS_W / V_CELL[0]) * V_ROWS;
  // 頂部招牌優先，避免圖集用完時漏掉大樓名
  const ordered = [...signs].sort((a, b) => (b.kind === 'crown') - (a.kind === 'crown'));
  for (const s of ordered) {
    const r = hash(s.text);
    const colors = SIGN_COLORS[Math.floor(r * SIGN_COLORS.length)];
    const face = new THREE.Vector3(s.nx, 0, s.nz);
    const vertical = s.kind !== 'crown' && isCJK(s.text) && [...s.text].length <= 8 && (r * 7) % 1 < 0.45 && s.top > 9;
    if (vertical && vCount < vMax) {
      const cell = [(vCount % 32) * V_CELL[0], H_ROWS * H_CELL[1] + Math.floor(vCount / 32) * V_CELL[1], ...V_CELL];
      drawVertical(ctx, cell[0], cell[1], s.text, colors);
      const height = 4, y = Math.min(s.top - height / 2 - 0.5, 6.5 + s.slot * 1.2 + r * 2.5);
      const center = new THREE.Vector3(s.x + s.nx * 0.7, y, s.z + s.nz * 0.7);
      const side = new THREE.Vector3(-s.nz, 0, s.nx); // 垂直牆面突出，正反兩面
      const front = center.clone().addScaledVector(side, 0.15);
      pushSign(buf, front, side, 1, height, cell, ATLAS_W, atlasH);
      pushSign(buf, center.clone().addScaledVector(side, -0.15), side.clone().negate(), 1, height, cell, ATLAS_W, atlasH);
      boxes.add(front, side, 1, height, lightboxTint(...colors), 0.276, true);
      vCount++;
      continue;
    }
    if (hCount >= hMax) continue;
    const crown = s.kind === 'crown';
    const width = crown ? Math.min(s.room * 0.85, 18) : Math.min(s.room * 0.9, 5.6);
    if (width < 2) continue;
    const cell = [(hCount % 8) * H_CELL[0], Math.floor(hCount / 8) * H_CELL[1], ...H_CELL];
    drawHorizontal(ctx, cell[0], cell[1], s.text, colors, crown || isCJK(s.text) ? SERIF : SANS);
    const height = width / 4;
    if (!crown && 4.45 + height + 0.06 > s.top) continue; // 重建資料時不讓低樓燈箱超過屋頂。
    // 通用樓層腰線頂部約 4.26m，燈箱底部留出空隙，避免遮住字樣。
    const y = crown ? s.top - height / 2 - 1.2 : 4.45 + height / 2;
    const center = new THREE.Vector3(s.x + s.nx * 0.24, y, s.z + s.nz * 0.24);
    pushSign(buf, center, face, width, height, cell, ATLAS_W, atlasH);
    boxes.add(center, face, width, height, lightboxTint(...colors), 0.2);
    hCount++;
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  const material = new THREE.MeshStandardMaterial({
    map: texture, emissive: '#ffffff', emissiveMap: texture, emissiveIntensity: 0.15, roughness: 0.5,
  });
  return { mesh: meshFrom(buf, material), material, boxes: boxes.finish(), count: hCount + vCount };
}

export function buildStreetscape(buildings, signs, roads) {
  const shop = buildShopfronts(buildings, roads);
  const sign = buildSigns(signs);
  const group = new THREE.Group();
  group.add(...shop.meshes, sign.mesh, sign.boxes.group);
  return {
    group,
    signCount: sign.count,
    lightSources: shop.lightSources,
    setNight(night) {
      shop.frontMaterial.emissiveIntensity = 0.12 + night * 0.85;
      sign.material.emissiveIntensity = 0.08 + night * 1.7;
      sign.boxes.setNight(night);
    },
  };
}
