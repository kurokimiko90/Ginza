// 歌舞伎座正面：白漆喰牆、左右千鳥破風、中央唐破風玄關、提灯帯、朱色露台與下屋。
// 依 photo-reference.js 的照片換算尺寸自行建模；不使用照片貼圖，幟與看板不重現文字。
import * as THREE from 'three';
import { KABUKIZA as K } from './photo-reference.js';

const ROOF_DEPTH = 14; // 正面屋頂向內延伸深度（示意）
const OVERHANG = 1.4; // 屋簷外挑

function canvasTexture(width, height, draw, repeat = [1, 1]) {
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  draw(canvas.getContext('2d'), width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(...repeat);
  texture.anisotropy = 8;
  return texture;
}

function createMaterials() {
  // 瓦：銀灰色本瓦的縱向瓦筋
  const tiles = canvasTexture(64, 64, (c, w, h) => {
    c.fillStyle = '#6a727b'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#4b525a'; for (let x = 0; x < w; x += 8) c.fillRect(x, 0, 3, h);
    c.fillStyle = '#7d858d'; for (let y = 0; y < h; y += 16) c.fillRect(0, y, w, 2);
  }, [10, 3]);
  // 提灯：朱色底上一排白色燈籠，夜間同圖發光
  const lanterns = canvasTexture(256, 32, (c, w, h) => {
    c.fillStyle = '#b3201c'; c.fillRect(0, 0, w, h);
    for (let x = 8; x < w; x += 16) {
      c.fillStyle = '#ffe9d6'; c.beginPath(); c.ellipse(x, h / 2, 6, 11, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#d4392c'; c.fillRect(x - 6, h / 2 - 1, 12, 2);
    }
  });
  // 幟：只取色帶構成，不重現演目文字
  const banner = (base, mark) => canvasTexture(32, 256, (c, w, h) => {
    c.fillStyle = base; c.fillRect(0, 0, w, h);
    c.fillStyle = mark; c.beginPath(); c.arc(w / 2, 16, 9, 0, Math.PI * 2); c.fill();
    c.fillStyle = mark; c.globalAlpha = 0.85;
    // 直書文字的筆畫塊（4–5 字份），不是實際文字
    for (let y = 40; y < h - 30; y += 40) {
      c.fillRect(9, y, 14, 3); c.fillRect(15, y - 2, 3, 26); c.fillRect(10, y + 12, 12, 3);
      c.fillRect(9 + ((y / 40) % 2) * 9, y + 6, 4, 14); c.fillRect(8, y + 23, 16, 3);
    }
    c.globalAlpha = 1;
  });
  // 簷下白色斗栱：白底加深色縫
  const brackets = canvasTexture(64, 16, (c, w, h) => {
    c.fillStyle = '#f1ece0'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#b9b4a8'; for (let x = 0; x < w; x += 16) c.fillRect(x + 11, 4, 3, h - 4);
    c.fillRect(0, h - 3, w, 3);
  }, [12, 1]);
  const mon = canvasTexture(64, 64, (c, w, h) => {
    c.fillStyle = '#23407c'; c.fillRect(0, 0, w, h);
    c.strokeStyle = '#ffffff'; c.lineWidth = 5; c.beginPath(); c.arc(w / 2, h / 2, 20, 0, Math.PI * 2); c.stroke();
    c.fillStyle = '#ffffff'; c.beginPath(); c.arc(w / 2, h / 2, 8, 0, Math.PI * 2); c.fill();
  });
  const glow = (color, map) => new THREE.MeshStandardMaterial({ color: '#ffffff', map, emissive: color, emissiveMap: map, emissiveIntensity: 0.25, roughness: 0.6 });
  return {
    plaster: new THREE.MeshStandardMaterial({ color: '#f3eee3', emissive: '#ffe6c4', emissiveIntensity: 0, roughness: 0.85 }),
    brackets: new THREE.MeshStandardMaterial({ map: brackets, emissive: '#ffe6c4', emissiveIntensity: 0, roughness: 0.85 }),
    roof: new THREE.MeshStandardMaterial({ map: tiles, roughness: 0.75, metalness: 0.15 }),
    edge: new THREE.MeshStandardMaterial({ color: '#4a5260', roughness: 0.6 }),
    gold: new THREE.MeshStandardMaterial({ color: '#c8a248', metalness: 0.7, roughness: 0.35 }),
    lacquer: new THREE.MeshStandardMaterial({ color: '#9e2a26', roughness: 0.5 }),
    window: new THREE.MeshStandardMaterial({ color: '#3b3a36', emissive: '#ffb45e', emissiveIntensity: 0, roughness: 0.3 }),
    shop: new THREE.MeshStandardMaterial({ color: '#5c5250', emissive: '#ff6a4c', emissiveIntensity: 0.1, roughness: 0.3, metalness: 0.2 }),
    noren: new THREE.MeshStandardMaterial({ color: '#2a2333', roughness: 0.9 }),
    lanterns: glow('#ffffff', lanterns),
    blueBanner: glow('#ffffff', banner('#24407a', '#d8deea')),
    redBanner: glow('#ffffff', banner('#b3242a', '#2a1a18')),
    mon: glow('#ffffff', mon),
  };
}

// 依材質收集零件，最後每種材質合併成一個網格
function createCollector() {
  const parts = new Map();
  return {
    add(material, geometry) {
      if (!parts.has(material)) parts.set(material, []);
      parts.get(material).push(geometry.index ? geometry.toNonIndexed() : geometry);
    },
    meshes() {
      return [...parts].map(([material, list]) => {
        const merged = new THREE.BufferGeometry();
        for (const name of ['position', 'normal', 'uv']) {
          const size = list[0].attributes[name].itemSize;
          const out = new Float32Array(list.reduce((n, g) => n + g.attributes[name].count * size, 0));
          let offset = 0;
          for (const g of list) { out.set(g.attributes[name].array, offset); offset += g.attributes[name].array.length; }
          merged.setAttribute(name, new THREE.BufferAttribute(out, size));
        }
        list.forEach((g) => g.dispose());
        merged.computeBoundingSphere();
        const mesh = new THREE.Mesh(merged, material);
        mesh.castShadow = mesh.receiveShadow = true;
        return mesh;
      });
    },
  };
}

const box = (w, h, d, x, y, z) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);

// (x,y) 輪廓沿 -z 拉伸 depth，正面在 z = front
function prismXY(points, depth, front) {
  const shape = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
  return new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 1 }).translate(0, 0, front - depth);
}

// 山牆朝街的切妻屋頂（千鳥破風）：x0..x1 寬，簷 eave，脊 apex
function gableRoof(out, m, x0, x1, eave, apex, front) {
  const xc = (x0 + x1) / 2, a = x0 - OVERHANG, b = x1 + OVERHANG;
  const slope = (apex - eave) / (xc - x0), drop = slope * OVERHANG, t = 0.55;
  const outline = [[a, eave - drop], [xc, apex], [b, eave - drop], [b, eave - drop - t], [xc, apex - t * 1.4], [a, eave - drop - t]];
  out.add(m.roof, prismXY(outline, ROOF_DEPTH, front + OVERHANG));
  // 破風板（深色緣）與白色山牆三角面、懸魚金飾
  const board = [[a - 0.1, eave - drop - 0.05], [xc, apex + 0.25], [b + 0.1, eave - drop - 0.05], [b + 0.1, eave - drop - 0.55], [xc, apex - 0.4], [a - 0.1, eave - drop - 0.55]];
  out.add(m.edge, prismXY(board, 0.35, front + OVERHANG + 0.05));
  out.add(m.plaster, prismXY([[x0 + 0.3, eave], [xc, apex - 0.7], [x1 - 0.3, eave]], 0.3, front + 0.2));
  out.add(m.gold, box(0.9, 0.9, 0.25, xc, apex - 1.4, front + 0.4));
  out.add(m.edge, box(0.6, 0.9, 0.4, xc, apex + 0.5, front + OVERHANG - 0.2)); // 鬼瓦
  out.add(m.edge, box(0.5, 0.45, ROOF_DEPTH, xc, apex + 0.05, front + OVERHANG - ROOF_DEPTH / 2)); // 棟
  // 入母屋的水平屋簷裙：山牆三角下方整段外挑，前低後高
  const skirt = 3.0, tilt = 0.6; // 比街面仰角陡，從人行道能看到瓦面
  out.add(m.roof, box(b - a, 0.45, skirt, xc, 0, 0).rotateX(tilt).translate(0, eave - 0.1, front + skirt / 2 - 0.3));
  out.add(m.edge, box(b - a + 0.1, 0.3, 0.2, xc, eave - 0.1 - Math.sin(tilt) * skirt / 2, front + skirt - 0.35));
}

// 唐破風：中央弓形隆起、兩端外翻
function karahafu(out, m, xc, width, eave, crown, front, depth) {
  const half = width / 2, top = [], bottom = [];
  for (let i = 0; i <= 24; i++) {
    const t = -1 + (2 * i) / 24, a = Math.abs(t);
    const x = xc + t * half * (1 + 0.1 * a ** 3);
    const y = eave + (crown - eave) * (1 - t * t) ** 1.6 + 0.25 * Math.max(0, a - 0.85) / 0.15;
    top.push([x, y]); bottom.unshift([x, y - 0.5 - 0.2 * (1 - a)]);
  }
  out.add(m.roof, prismXY([...top, ...bottom], depth, front));
  out.add(m.edge, prismXY([...top.map(([x, y]) => [x, y + 0.12]), ...bottom.map(([x, y]) => [x, y + 0.3])], 0.3, front + 0.1));
  // 弓形下的白色破風板與金色雕飾
  const fill = top.filter(([x]) => Math.abs(x - xc) < half * 0.9).map(([x, y]) => [x, y - 0.55]);
  out.add(m.plaster, prismXY([...fill, [xc + half * 0.9, eave - 0.9], [xc - half * 0.9, eave - 0.9]], 0.2, front - 0.15));
  out.add(m.gold, box(width * 0.42, 0.7, 0.2, xc, eave + (crown - eave) * 0.45, front - 0.05));
}

// 一段白牆立面：窗、露台、簷下斗栱
function gableFacade(out, m, x0, x1) {
  const w = x1 - x0, xc = (x0 + x1) / 2;
  out.add(m.plaster, box(w, K.cornice[0], 0.6, xc, K.cornice[0] / 2, -0.3));
  out.add(m.brackets, box(w + 0.6, K.cornice[1] - K.cornice[0], 1.0, xc, (K.cornice[0] + K.cornice[1]) / 2, 0.1));
  for (const px of [x0 + 0.5, x1 - 0.5, xc - w * 0.18, xc + w * 0.18]) out.add(m.plaster, box(0.9, K.cornice[0] - K.lowerEave, 0.35, px, (K.cornice[0] + K.lowerEave) / 2, 0.15)); // 付柱
  for (const dx of [-0.3, 0.3]) {
    const wx = xc + dx * w;
    out.add(m.window, box(w * 0.18, 2.2, 0.1, wx, 7.0, 0.05));
    out.add(m.window, box(w * 0.18, 1.6, 0.1, wx, 11.0, 0.05));
    out.add(m.window, box(w * 0.12, 0.7, 0.1, wx, 13.7, 0.05));
  }
  // 朱色露台
  out.add(m.lacquer, box(w * 0.42, 0.9, 0.9, xc, K.balcony + 0.45, 0.45));
  out.add(m.plaster, box(w * 0.46, 0.25, 1.2, xc, K.balcony, 0.5));
  // 下屋與其下暖色店舖
  out.add(m.roof, box(w + 0.4, 0.3, 2.3, xc, K.lowerEave, 1.1));
  out.add(m.edge, box(w + 0.4, 0.25, 0.15, xc, K.lowerEave - 0.2, 2.25));
  // 照片：下屋下是兩扇紅光店窗，中間與兩端為白牆
  for (const dx of [-0.24, 0.24]) {
    out.add(m.shop, box(w * 0.36, 2.6, 0.1, xc + dx * w, 1.9, 0.05));
    out.add(m.edge, box(w * 0.36 + 0.3, 0.2, 0.2, xc + dx * w, 3.3, 0.1));
  }
}

function centerSection(out, m, x0, x1, recessDepth) {
  const w = x1 - x0, xc = (x0 + x1) / 2, z = -recessDepth;
  out.add(m.plaster, box(w, K.cornice[1], 0.6, xc, K.cornice[1] / 2, z - 0.3));
  out.add(m.brackets, box(w, 0.9, 0.8, xc, K.centerEave - 0.45, z + 0.1));
  // 入母屋風的中央屋頂：脊與正面平行
  const ridgeBack = z - 3;
  const profile = [[z + OVERHANG, K.centerEave], [ridgeBack, K.centerRidge], [ridgeBack - 6, K.centerEave]];
  const shape = new THREE.Shape(profile.map(([pz, y]) => new THREE.Vector2(pz, y)));
  out.add(m.roof, new THREE.ExtrudeGeometry(shape, { depth: w + 1, bevelEnabled: false }).rotateY(-Math.PI / 2).translate(x1 + 0.5, 0, 0));
  out.add(m.edge, box(w + 1, 0.4, 0.5, xc, K.centerRidge + 0.1, ridgeBack));
  // 提灯帶、紋章、窗
  out.add(m.lanterns, box(w + 2.5, 1.2, 0.3, xc, K.lanternBand, z + 0.4));
  out.add(m.mon, box(2.4, 2.0, 0.2, xc, 11.0 - 0.9, z + 0.1));
  for (const dx of [-0.32, 0.32]) out.add(m.window, box(w * 0.2, 1.6, 0.1, xc + dx * w, 11.0, z + 0.05));
}

function porch(out, m, xc, recessDepth) {
  const p = K.porch, half = p.width / 2, front = 1.0, depth = recessDepth + front;
  karahafu(out, m, xc, p.width, p.eave, p.crown, front, depth);
  out.add(m.lanterns, box(p.width - 0.6, 0.8, 0.3, xc, p.lanterns, front - 0.6));
  for (const dx of [-half + 0.4, half - 0.4]) out.add(m.plaster, box(0.45, p.eave - 0.2, 0.45, xc + dx, (p.eave - 0.2) / 2, front - 0.8)); // 白柱
  out.add(m.noren, box(p.width - 1.4, 2.0, 0.1, xc, 3.6, -recessDepth + 0.3));
  for (const dx of [-1.5, 1.5]) out.add(m.mon, box(0.9, 0.9, 0.12, xc + dx, 3.7, -recessDepth + 0.38));
  out.add(m.window, box(p.width - 2, 2.4, 0.1, xc, 1.25, -recessDepth + 0.05));
}

function wing(out, m, w) {
  const z = -w.setback, xc = (w.x0 + w.x1) / 2, width = w.x1 - w.x0;
  out.add(m.plaster, box(width, K.wing.eave, 0.6, xc, K.wing.eave / 2, z - 0.3));
  out.add(m.brackets, box(width + 0.4, 0.9, 0.9, xc, K.wing.eave - 0.45, z + 0.1));
  gableRoof(out, m, w.x0 + 0.5, w.x1 - 0.3, K.wing.eave, K.wing.apex, z);
  out.add(m.window, box(width * 0.5, 1.4, 0.1, xc, 7.5, z + 0.05));
  out.add(m.shop, box(width - 2, 3.2, 0.1, xc, 2.0, z + 0.05));
}

function banners(out, m, plan) {
  const g = plan.recess.x0;
  // 照片：左端藍色幟，右側山牆兩條朱色幟（位置為照片比例）
  for (const [x, material] of [[g * 0.12, m.blueBanner], [plan.recess.x1 + 0.6, m.redBanner], [plan.width - 0.6, m.redBanner]]) {
    out.add(material, box(1.6, 9.4, 0.15, x, 9.8, 0.75));
  }
}

/**
 * @param {ReturnType<import('./kabukiza-layout.js').planKabukiza>} plan
 */
export function buildKabukiza(plan) {
  const group = new THREE.Group();
  if (!plan) return { group, setNight() {} };
  const m = createMaterials();
  const out = createCollector();
  const { recess } = plan;
  gableFacade(out, m, 0, recess.x0);
  gableFacade(out, m, recess.x1, plan.width);
  gableRoof(out, m, 0, recess.x0, K.gableEave, K.gableApex, 0);
  gableRoof(out, m, recess.x1, plan.width, K.gableEave, K.gableApex, 0);
  centerSection(out, m, recess.x0, recess.x1, recess.depth);
  porch(out, m, (recess.x0 + recess.x1) / 2, recess.depth);
  if (plan.wing) wing(out, m, plan.wing);
  banners(out, m, plan);
  group.add(...out.meshes());
  group.position.set(plan.origin[0], 0, plan.origin[1]);
  group.rotation.y = Math.atan2(-plan.u[1], plan.u[0]); // 局部 +x → u、+z → n
  const glowing = [m.lanterns, m.blueBanner, m.redBanner, m.mon];
  return {
    group,
    setNight(night) {
      // 實景夜照：白牆受投光、提灯與幟發亮、窗內暖光
      m.plaster.emissiveIntensity = m.brackets.emissiveIntensity = night * 0.62;
      m.window.emissiveIntensity = night * 1.3;
      m.shop.emissiveIntensity = 0.15 + night * 0.9;
      for (const g of glowing) g.emissiveIntensity = 0.25 + night * 1.1;
    },
  };
}
