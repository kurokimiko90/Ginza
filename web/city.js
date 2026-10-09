// 由 city.json / roads.json 產生建築網格與地面貼圖。
import * as THREE from 'three';
import { SIX_NIGHT, PLACE_NIGHT } from './photo-reference.js';

const FLOOR = 3.4;
const BAY = 2.6;
const WINDOW_TILE = 4; // 貼圖內含 4 × 4 個窗格
// 銀座常見外牆：白石、米色、香檳金、灰玻璃、深色花崗岩
const PALETTE = ['#e9e6df', '#d4cec2', '#b2aaa0', '#a4b3ba', '#7c8991', '#626d76', '#e0ddd6', '#b5b6ad'];
const ROAD_COLOR = {
  footway: '#d8d2c6', steps: '#d8d2c6', path: '#d8d2c6', cycleway: '#d8d2c6', pedestrian: '#cfc6b6',
};

function mulberry(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 程序化窗格：白天反光玻璃，夜間部分窗格點燈
function windowTextures() {
  const size = 512, cell = size / WINDOW_TILE, rand = mulberry(7);
  const day = document.createElement('canvas');
  const night = document.createElement('canvas');
  day.width = day.height = night.width = night.height = size;
  const d = day.getContext('2d'), n = night.getContext('2d');
  d.fillStyle = '#ffffff'; d.fillRect(0, 0, size, size);
  n.fillStyle = '#000000'; n.fillRect(0, 0, size, size);
  for (let i = 0; i < WINDOW_TILE; i++) {
    for (let j = 0; j < WINDOW_TILE; j++) {
      const x = i * cell + cell * 0.18, y = j * cell + cell * 0.18;
      const w = cell * 0.64, h = cell * 0.66;
      d.fillStyle = '#d1c7b5'; d.fillRect(x - 5, y - 5, w + 10, h + 13);
      const glass = d.createLinearGradient(x, y, x + w, y + h);
      glass.addColorStop(0, '#668b9f'); glass.addColorStop(0.55, '#b0d4db'); glass.addColorStop(1, '#537689');
      d.fillStyle = glass; d.fillRect(x, y, w, h);
      d.fillStyle = '#e7e4d9'; d.fillRect(x + w * 0.48, y, 3, h);
      d.fillStyle = 'rgba(255,255,255,0.28)'; d.fillRect(x + 5, y + 5, w * 0.16, h - 10);
      d.fillStyle = '#f8f1e0'; d.fillRect(x - 7, y + h, w + 14, 5);
      if (rand() < 0.62) {
        const warm = rand() < 0.7;
        n.fillStyle = warm ? `rgb(255,${(200 + rand() * 40) | 0},${(130 + rand() * 50) | 0})` : 'rgb(210,230,255)';
        n.globalAlpha = 0.55 + rand() * 0.45;
        n.fillRect(x, y, w, h);
        // Recessed room edges, a ceiling light and partial curtains; keep frames dark.
        n.fillStyle = 'rgba(30,36,39,0.65)';
        n.fillRect(x, y, w, 7); n.fillRect(x, y + h - 12, w, 12);
        n.fillRect(x, y, 5, h); n.fillRect(x + w - 5, y, 5, h);
        n.fillStyle = 'rgba(250,238,216,0.28)';
        n.fillRect(x + 7, y + 7, w * (0.18 + rand() * 0.22), h - 21);
        n.fillStyle = '#454b4d'; n.fillRect(x + w * 0.48, y, 3, h);
        n.globalAlpha = 1;
      }
    }
  }
  return [day, night].map((canvas) => {
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1 / (BAY * WINDOW_TILE), 1 / (FLOOR * WINDOW_TILE));
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    return tex;
  });
}

// 自繪立面貼圖，參考官方照片的構成；不是照片貼圖，細部尺寸仍為簡化模型。
function referenceTextures(name, height) {
  const day = document.createElement('canvas'), night = document.createElement('canvas');
  day.width = night.width = 256; day.height = night.height = 1024;
  const d = day.getContext('2d'), n = night.getContext('2d');
  const y = (meters) => 1024 * (1 - meters / height);
  const rect = (ctx, x, bottom, width, meters) => ctx.fillRect(x, y(bottom + meters), width, meters / height * 1024);
  d.fillStyle = name === '和光' ? '#dedbd1' : '#b8c0c2'; d.fillRect(0, 0, 256, 1024);
  n.fillStyle = '#000'; n.fillRect(0, 0, 256, 1024);
  if (name === '和光') {
    // 低層橱窗、狹長豎窗、頂層拱窗與青銅裝飾；取消通用格子樓與遮陽棚。
    d.fillStyle = '#4b5559'; rect(d, 50, 0.25, 156, 4.8);
    n.fillStyle = '#b6a283'; rect(n, 50, 0.25, 156, 4.8);
    d.fillStyle = '#58554d'; rect(d, 40, 5.4, 176, 1.5);
    for (const bottom of [8.1, 12.1, 16.1, 20.1]) {
      d.fillStyle = '#a6b4b8'; rect(d, 76, bottom, 104, 3.1);
      d.fillStyle = '#5b5c57'; rect(d, 125, bottom, 6, 3.1);
      n.fillStyle = '#8d958e'; rect(n, 76, bottom, 104, 3.1);
    }
    d.fillStyle = '#f1eee5'; rect(d, 15, 7.6, 20, 16.8); rect(d, 221, 7.6, 20, 16.8);
    d.fillStyle = '#566265';
    d.beginPath(); d.roundRect(67, y(28.4), 122, (28.4 - 25.6) / height * 1024, [61, 61, 0, 0]); d.fill();
    n.fillStyle = '#a9a892'; rect(n, 78, 25.6, 100, 2.0);
    d.fillStyle = '#59594e'; rect(d, 59, 25.4, 138, 0.45);
    for (let x = 65; x < 192; x += 12) rect(d, x, 25.4, 3, 0.45);
    d.fillStyle = '#b7b2a6';
    for (const bottom of [5.1, 7.2, 24.6, 29.2]) rect(d, 0, bottom, 256, 0.22);
  } else if (name === 'GINZA PLACE') {
    // 照明施工實景：白鋁板菱形鏤空、兩道玻璃露台、暖色低層橱窗。
    d.fillStyle = '#eeeae2'; d.fillRect(0, 0, 256, 1024);
    // 鋁板也受縫隙溢光照亮，不能退成黑牆上的白色菱形點。
    n.fillStyle = '#8e969c'; n.fillRect(0, 0, 256, 1024);
    for (let row = 0; row < 24; row++) {
      const bottom = height * (0.25 + row * 0.031);
      for (let col = -1; col < 9; col++) {
        const cx = col * 32 + (row % 2) * 16, cy = y(bottom);
        const halfHeight = (row > 16 ? 0.55 : 0.32) / height * 1024;
        for (const [ctx, color] of [[d, '#536473'], [n, '#c2d3e0']]) {
          ctx.fillStyle = color; ctx.beginPath();
          ctx.moveTo(cx, cy - halfHeight); ctx.lineTo(cx + 6, cy);
          ctx.lineTo(cx, cy + halfHeight); ctx.lineTo(cx - 6, cy); ctx.closePath(); ctx.fill();
        }
      }
    }
    for (const ratio of PLACE_NIGHT.terraces) {
      d.fillStyle = '#384b58'; rect(d, 0, height * ratio, 256, height * 0.06);
      n.fillStyle = '#8d7960'; rect(n, 0, height * ratio, 256, height * 0.06);
      d.fillStyle = '#eae5db'; rect(d, 0, height * ratio, 256, 0.25);
      n.fillStyle = '#d3c7ad'; rect(n, 0, height * ratio, 256, 0.18);
    }
    d.fillStyle = '#40525b'; rect(d, 8, 0.3, 240, height * 0.18);
    n.fillStyle = '#bba180'; rect(n, 8, 0.3, 240, height * 0.18);
    for (const x of [8, 87, 166, 245]) {
      d.fillStyle = '#b6b6af'; rect(d, x, 0.3, 3, height * 0.18);
      n.fillStyle = '#1e252b'; rect(n, x, 0.3, 3, height * 0.18);
    }
  } else {
    // GINZA SIX：上層水平檐線，下層高大的垂直店面分節。
    const glass = d.createLinearGradient(0, 0, 256, 0);
    glass.addColorStop(0, SIX_NIGHT.glassDay[0]); glass.addColorStop(0.5, SIX_NIGHT.glassDay[1]); glass.addColorStop(1, SIX_NIGHT.glassDay[2]);
    d.fillStyle = glass; rect(d, 0, 32, 256, height - 32);
    d.fillStyle = '#8f9493'; rect(d, 0, 0.2, 256, 30.5);
    d.fillStyle = '#d5d4cc'; rect(d, 6, 0.2, 30, 30.5);
    d.fillStyle = '#4a5257'; rect(d, 48, 0.2, 186, 5.8);
    d.fillStyle = '#d4d7d6';
    for (let x = 40; x < 256; x += 54) rect(d, x, 32, 3, height - 32);
    n.fillStyle = '#bca98e'; rect(n, 48, 0.2, 186, 5.8);
    // 官方夜照中玻璃是深藍背景、局部辦公室暖光，不是一整面白色燈箱。
    n.fillStyle = SIX_NIGHT.glassNight; rect(n, 0, 32, 256, height - 32);
    for (const bottom of SIX_NIGHT.eaves.filter((v) => v >= 32 && v < height)) {
      n.fillStyle = '#33485e'; rect(n, 5, bottom + 0.7, 246, 3.6);
      for (const x of [20, 91, 182]) {
        n.fillStyle = x === 91 ? '#8e806a' : '#647583';
        rect(n, x, bottom + 1.0, 17, 1.6);
      }
    }
    // 照片下層局部暖色豎向亮面；僅還原構成，不猜測品牌門頭。
    n.fillStyle = '#a99573'; rect(n, 8, 5.8, 16, 24.6);
    n.fillStyle = '#54626c'; rect(n, 44, 7, 34, 22);
  }
  return [day, night].map((canvas) => {
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1 / (name === '和光' ? 3.2 : name === 'GINZA PLACE' ? 12 : 9), 1 / height);
    texture.anisotropy = 8;
    return texture;
  });
}

function metalNightTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 32;
  const ctx = canvas.getContext('2d');
  const sheen = ctx.createLinearGradient(0, 0, 256, 0);
  for (const [stop, color] of [[0, '#403d3b'], [0.16, '#b3a790'], [0.3, '#756d60'], [0.53, '#c8bea9'], [0.7, '#59656c'], [0.87, '#9d917a'], [1, '#403d3b']]) sheen.addColorStop(stop, color);
  ctx.fillStyle = sheen; ctx.fillRect(0, 0, 256, 32);
  ctx.fillStyle = '#e9dfc8'; ctx.fillRect(0, 27, 256, 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping; texture.repeat.set(8, 1);
  return texture;
}

function toShape(ring, holes = []) {
  const shape = new THREE.Shape(ring.map(([x, z]) => new THREE.Vector2(x, -z)));
  for (const hole of holes) shape.holes.push(new THREE.Path(hole.map(([x, z]) => new THREE.Vector2(x, -z))));
  return shape;
}

function createBuffers() {
  return { position: [], normal: [], uv: [], color: [] };
}

// 把 ExtrudeGeometry 的頂點轉到世界座標（Shape 平面 → 地面、拉伸方向 → 高度），依群組分到牆面或屋頂。
// 牆面 v 值改用高度本身，讓窗格從地面起算。
function appendGeometry(geometry, base, color, walls, roofs, bayScale = 1) {
  const pos = geometry.attributes.position.array;
  const nor = geometry.attributes.normal.array;
  const uv = geometry.attributes.uv.array;
  for (const group of geometry.groups) {
    const isWall = group.materialIndex === 1;
    const target = isWall ? walls : roofs;
    for (let v = group.start; v < group.start + group.count; v++) {
      const p = v * 3;
      target.position.push(pos[p], base + pos[p + 2], -pos[p + 1]);
      target.normal.push(nor[p], nor[p + 2], -nor[p + 1]);
      target.uv.push(uv[v * 2] * (isWall ? bayScale : 1), isWall ? pos[p + 2] : uv[v * 2 + 1]);
      target.color.push(color.r, color.g, color.b);
    }
  }
}

function toMesh(buffers, material) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(buffers.position, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(buffers.normal, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(buffers.uv, 2));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(buffers.color, 3));
  geometry.computeBoundingSphere();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export function buildBuildings(buildings) {
  const [dayMap, nightMap] = windowTextures();
  const walls = createBuffers(), roofs = createBuffers();
  const trims = createBuffers(), sixTrims = createBuffers();
  const referenceWalls = new Map(), referenceHeights = new Map();
  const color = new THREE.Color();
  for (const b of buildings) {
    const tone = b.tone ?? 0.5;
    color.set(PALETTE[Math.floor(tone * PALETTE.length) % PALETTE.length]);
    color.offsetHSL(0, 0, (((tone * 37) % 1) - 0.5) * 0.06);
    const referenced = ['和光', 'GINZA SIX', 'GINZA PLACE'].includes(b.name);
    if (referenced) {
      color.set('#ffffff');
      if (!referenceWalls.has(b.name)) referenceWalls.set(b.name, createBuffers());
      referenceHeights.set(b.name, b.height);
    }
    const depth = Math.max(1, b.height - (b.base || 0));
    b.outers.forEach((outer, i) => {
      const geometry = new THREE.ExtrudeGeometry(toShape(outer, i === 0 ? b.holes : []), {
        depth, bevelEnabled: false, curveSegments: 1, UVGenerator: THREE.ExtrudeGeometry.WorldUVGenerator,
      });
      appendGeometry(geometry, b.base || 0, color, referenced ? referenceWalls.get(b.name) : walls, roofs, referenced ? 1 : tone < 0.33 ? 0.72 : tone < 0.66 ? 1 : 1.24);
      geometry.dispose();
      // 屋簷與中層腰線使用合併網格，增加立體感而不逐棟增加 draw call。
      const nearCenter = outer.some(([x, z]) => Math.hypot(x, z) < 320);
      if (nearCenter || referenced) {
        for (let k = 0; k < outer.length; k++) {
          const a = outer[k], q = outer[(k + 1) % outer.length];
          const length = Math.hypot(q[0] - a[0], q[1] - a[1]);
          if (length < 1) continue;
          const levels = b.name === '和光' ? [7.2, 24.8, 29.9] : b.name === 'GINZA SIX' ? SIX_NIGHT.eaves : b.name === 'GINZA PLACE' ? PLACE_NIGHT.terraces.map((v) => v * b.height) : [b.height - 0.4];
          if (!referenced && depth > 14) levels.push((b.base || 0) + 4.1);
          for (const y of levels) {
            if (y > b.height) continue;
            const six = b.name === 'GINZA SIX', target = six ? sixTrims : trims;
            const trim = new THREE.BoxGeometry(length + 0.3, six ? 0.48 : 0.32, six ? 1.1 : 0.5).toNonIndexed();
            trim.rotateY(-Math.atan2(q[1] - a[1], q[0] - a[0]));
            trim.translate((a[0] + q[0]) / 2, y, (a[1] + q[1]) / 2);
            for (const key of ['position', 'normal', 'uv']) {
              const array = trim.attributes[key].array;
              for (const value of array) target[key].push(value);
            }
            for (let v = 0; v < trim.attributes.position.count; v++) target.color.push(six ? 1 : 0.72, six ? 1 : 0.71, six ? 1 : 0.67);
            trim.dispose();
          }
        }
      }
    });
  }
  const wallMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true, map: dayMap, emissive: '#ffffff', emissiveMap: nightMap, emissiveIntensity: 0,
    roughness: 0.78, metalness: 0.02,
  });
  const roofMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, color: '#d7dace' });
  const group = new THREE.Group();
  const referenceMaterials = [];
  for (const [name, buffers] of referenceWalls) {
    const [map, emissiveMap] = referenceTextures(name, referenceHeights.get(name));
    const material = new THREE.MeshStandardMaterial({ vertexColors: true, map, emissiveMap, emissive: '#ffffff', emissiveIntensity: 0, roughness: 0.78 });
    material.userData.nightGain = name === 'GINZA SIX' ? SIX_NIGHT.glassGain : name === 'GINZA PLACE' ? PLACE_NIGHT.nightGain : 0.65;
    referenceMaterials.push(material);
    group.add(toMesh(buffers, material));
  }
  if (sixTrims.position.length) {
    const material = new THREE.MeshStandardMaterial({ color: '#b8bdbe', roughness: 0.3, metalness: 0.55,
      emissive: '#ffffff', emissiveMap: metalNightTexture(), emissiveIntensity: 0 });
    material.userData.nightGain = SIX_NIGHT.metalGain;
    referenceMaterials.push(material);
    group.add(toMesh(sixTrims, material));
  }
  group.add(toMesh(walls, wallMaterial), toMesh(roofs, roofMaterial),
    toMesh(trims, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 })));
  return { group, wallMaterial, referenceMaterials };
}

function tracePath(ctx, points, px) {
  ctx.beginPath();
  points.forEach((p, i) => (i ? ctx.lineTo(...px(p)) : ctx.moveTo(...px(p))));
}

// 地面貼圖（或小地圖）：人行鋪面、柏油道路、主要道路中線、建築輪廓
export function drawGroundCanvas(roads, buildings, bounds, pixels, { forMinimap = false } = {}) {
  const [minX, minZ, maxX, maxZ] = bounds;
  const scale = pixels / Math.max(maxX - minX, maxZ - minZ);
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil((maxX - minX) * scale);
  canvas.height = Math.ceil((maxZ - minZ) * scale);
  const ctx = canvas.getContext('2d');
  const px = ([x, z]) => [(x - minX) * scale, (z - minZ) * scale];
  ctx.fillStyle = forMinimap ? '#1b1d21' : '#b3b3b1';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const order = [...roads].sort((a, b) => a.width - b.width);
  for (const road of order) {
    if (!forMinimap && road.crossing) continue;
    ctx.strokeStyle = forMinimap ? (road.width >= 11 ? '#5b5f66' : '#3a3d42') : (ROAD_COLOR[road.kind] || '#3c3e42');
    ctx.lineWidth = Math.max(forMinimap ? 1 : 1.5, road.width * scale);
    tracePath(ctx, road.points, px);
    ctx.stroke();
  }
  if (!forMinimap) {
    ctx.setLineDash([3 * scale, 5 * scale]);
    ctx.strokeStyle = 'rgba(235,235,225,0.8)';
    ctx.lineWidth = Math.max(1, 0.2 * scale);
    for (const road of order.filter((r) => r.width >= 11)) {
      tracePath(ctx, road.points, px);
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }
  ctx.fillStyle = forMinimap ? '#8c8478' : '#8f8a82';
  for (const b of buildings) {
    for (const ring of b.outers) {
      tracePath(ctx, ring, px);
      ctx.closePath();
      ctx.fill();
    }
  }
  return { canvas, scale };
}

export function buildGround(roads, buildings, bounds, renderer) {
  const pixels = Math.min(4096, renderer.capabilities.maxTextureSize);
  const { canvas } = drawGroundCanvas(roads, buildings, bounds, pixels);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const [minX, minZ, maxX, maxZ] = bounds;
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(maxX - minX, maxZ - minZ),
    new THREE.MeshStandardMaterial({ map: texture, roughness: 0.95 }),
  );
  // Fill the remaining schematic sidewalk ground with the same fine paving detail.
  // Vehicle ribbons cover this base, so asphalt keeps its own material.
  ground.material.userData.ginzaPaving = pavingTexture();
  ground.rotation.x = -Math.PI / 2;
  ground.position.set((minX + maxX) / 2, 0, (minZ + maxZ) / 2);
  ground.receiveShadow = true;
  // 範圍外的大地面，避免看到世界邊緣
  const outer = new THREE.Mesh(
    new THREE.PlaneGeometry(12000, 12000),
    new THREE.MeshStandardMaterial({ color: '#8d8880', roughness: 1 }),
  );
  outer.rotation.x = -Math.PI / 2;
  outer.position.y = -0.05;
  const group = new THREE.Group();
  group.add(outer, ground);
  return group;
}

const WALKWAY_KINDS = new Set(['footway', 'steps', 'path', 'cycleway', 'pedestrian']);

// 沿折線產生寬度 width 的帶狀面；每段前後各延伸半個寬度，補住轉角缺口
function pushRibbon(buf, points, width, y, extend = true) {
  const half = width / 2;
  for (let i = 1; i < points.length; i++) {
    const [ax, az] = points[i - 1], [bx, bz] = points[i];
    const length = Math.hypot(bx - ax, bz - az);
    if (length < 0.01) continue;
    const dx = (bx - ax) / length, dz = (bz - az) / length;
    const ext = extend ? half : 0;
    const sx = ax - dx * ext, sz = az - dz * ext, ex = bx + dx * ext, ez = bz + dz * ext;
    const nx = -dz * half, nz = dx * half;
    // 三角形繞序使法向朝上（+y），否則會被背面剔除
    const quad = [[sx + nx, sz + nz], [ex + nx, ez + nz], [ex - nx, ez - nz], [sx - nx, sz - nz]];
    for (const k of [0, 1, 2, 0, 2, 3]) buf.push(quad[k][0], y, quad[k][1]);
  }
}

// 虛線中線：長 3 m、間隔 5 m
function pushDashes(buf, points, y) {
  let carry = 0;
  for (let i = 1; i < points.length; i++) {
    const [ax, az] = points[i - 1], [bx, bz] = points[i];
    const length = Math.hypot(bx - ax, bz - az);
    for (let s = carry; s < length; s += 8) {
      const e = Math.min(length, s + 3);
      const t0 = s / length, t1 = e / length;
      pushRibbon(buf, [[ax + (bx - ax) * t0, az + (bz - az) * t0], [ax + (bx - ax) * t1, az + (bz - az) * t1]], 0.15, y, false);
    }
    carry = (carry - length) % 8;
    if (carry < 0) carry += 8;
  }
}

function flatMesh(positions, material) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const normals = new Float32Array(positions.length);
  for (let i = 1; i < normals.length; i += 3) normals[i] = 1;
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  const uv = [];
  for (let i = 0; i < positions.length; i += 3) uv.push(positions[i], -positions[i + 2]);
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.computeBoundingSphere();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true;
  return mesh;
}

function flatMaterial(color, offset, roughness = 0.9) {
  return new THREE.MeshStandardMaterial({
    color, roughness, emissive: '#4a4238', emissiveIntensity: 0,
    polygonOffset: true, polygonOffsetFactor: offset, polygonOffsetUnits: offset,
  });
}

// 現有 OSM 步道上的示意石材鋪裝，不增加步道範圍或推測路緣／盲道位置。
function pavingTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d'), rand = mulberry(81);
  ctx.fillStyle = '#a59f94'; ctx.fillRect(0, 0, 256, 256);
  for (let row = 0; row < 8; row++) {
    for (let col = -1; col < 5; col++) {
      const x = col * 64 + (row % 2) * 32;
      const tone = 187 + Math.floor(rand() * 17);
      ctx.fillStyle = `rgb(${tone + 8},${tone + 5},${tone})`;
      ctx.fillRect(x + 1, row * 32 + 1, 62, 30);
      ctx.fillStyle = 'rgba(255,255,255,0.14)'; ctx.fillRect(x + 1, row * 32 + 1, 62, 1);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(0.5, 0.5); // 2m 圖樣，不受道路線段長度拉伸。
  texture.anisotropy = 8;
  return texture;
}

// Subtle, seamless aggregate; stylized clean asphalt rather than copied photo grime.
function asphaltTexture() {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 512;
  const ctx = canvas.getContext('2d'), rand = mulberry(301);
  ctx.fillStyle = '#747a80'; ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 45000; i++) {
    const value = 92 + Math.floor(rand() * 62);
    ctx.fillStyle = `rgb(${value},${value + 3},${value + 6})`;
    ctx.fillRect(rand() * 512, rand() * 512, 1 + rand(), 1 + rand());
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(0.25, 0.25); texture.anisotropy = 8;
  return texture;
}

/** 道路與人行道的實體帶狀面（近看比地面貼圖清楚）；夜間加上路燈的暖色反光。 */
export function buildRoads(roads) {
  const asphalt = [], walkway = [], lines = [];
  for (const road of roads) {
    if (road.crossing) {
      if (road.marked) {
        let carry = 0.2;
        for (let i = 1; i < road.points.length; i++) {
          const a = road.points[i - 1], b = road.points[i];
          const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
          if (length < 0.01) continue;
          for (let s = carry; s < length; s += 1.0) {
            const e = Math.min(length, s + 0.45);
            pushRibbon(lines, [[a[0] + (b[0] - a[0]) * s / length, a[1] + (b[1] - a[1]) * s / length],
              [a[0] + (b[0] - a[0]) * e / length, a[1] + (b[1] - a[1]) * e / length]], road.width, 0.045, false);
          }
          carry = ((carry - length) % 1 + 1) % 1;
        }
      }
    } else if (WALKWAY_KINDS.has(road.kind)) pushRibbon(walkway, road.points, Math.max(1.6, road.width), 0.035);
    else pushRibbon(asphalt, road.points, road.width, 0.03);
    if (road.width >= 11 && !WALKWAY_KINDS.has(road.kind)) pushDashes(lines, road.points, 0.04);
  }
  const materials = [flatMaterial('#e0d2b9', -1), flatMaterial('#637384', -2, 0.8), flatMaterial('#fff3d9', -3, 0.6)];
  // 與柏油相同的深度偏移，避免不同 polygon offset 在遠處再次蓋住步道。
  materials[0].polygonOffsetFactor = materials[1].polygonOffsetFactor;
  materials[0].polygonOffsetUnits = materials[1].polygonOffsetUnits;
  materials[0].color.set('#ffffff');
  materials[0].map = pavingTexture();
  materials[0].bumpMap = materials[0].map;
  materials[0].bumpScale = 0.018;
  materials[1].color.set('#707982');
  materials[1].map = asphaltTexture();
  materials[1].bumpMap = materials[1].map;
  materials[1].bumpScale = 0.024;
  const group = new THREE.Group();
  group.add(flatMesh(walkway, materials[0]), flatMesh(asphalt, materials[1]), flatMesh(lines, materials[2]));
  return {
    group,
    setNight(night) {
      // Localized shared street-light map provides light, not a uniform road glow.
      materials[0].emissiveIntensity = night * 0.025;
      materials[1].emissiveIntensity = night * 0.015;
      materials[2].emissiveIntensity = night * 0.04;
    },
  };
}
