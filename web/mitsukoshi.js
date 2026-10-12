// 銀座三越：新館朝十字路口立面的紅色圓形標誌（全景照），本館屋上「銀座テラス」芝生廣場（事例集照片）。
import * as THREE from 'three';
import { MITSUKOSHI as M } from './photo-reference.js';

function logoTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#c4112f'; ctx.beginPath(); ctx.arc(128, 128, 126, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#f6efe6'; ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(128, 128, 108, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#f6efe6'; ctx.font = 'bold 140px "Hiragino Mincho ProN", "Yu Mincho", serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('越', 128, 136);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** @param {ReturnType<import('./mitsukoshi-layout.js').splitMitsukoshi>} split */
export function buildMitsukoshi(split) {
  const group = new THREE.Group();
  if (!split) return { group, setNight() {} };
  const { cut, n } = split;
  // 標誌：照片中位於靠晴海通り（十字路口）一端、本館屋頂之上的新館立面，朝中央通り
  // cut 依 u 排序，b 端靠晴海通り（test_mitsukoshi 驗證）
  const at = [cut.b[0] + (cut.a[0] - cut.b[0]) * M.logoAlong, cut.b[1] + (cut.a[1] - cut.b[1]) * M.logoAlong];
  const logoMap = logoTexture();
  const logo = new THREE.Mesh(new THREE.CircleGeometry(M.logoRadius, 48),
    new THREE.MeshStandardMaterial({ map: logoMap, emissiveMap: logoMap, emissive: '#ffffff', emissiveIntensity: 0.1, roughness: 0.5 }));
  logo.position.set(at[0] + n[0] * 0.15, M.logoHeight, at[1] + n[1] * 0.15);
  logo.rotation.y = Math.atan2(n[0], n[1]);
  group.add(logo);
  // 芝生廣場：本館屋頂內縮 3 m 的草地（以重心縮放近似）
  const cx = split.main.reduce((s, p) => s + p[0], 0) / split.main.length;
  const cz = split.main.reduce((s, p) => s + p[1], 0) / split.main.length;
  const shape = new THREE.Shape(split.main.map(([x, z]) => new THREE.Vector2(cx + (x - cx) * 0.82, -(cz + (z - cz) * 0.82))));
  const lawn = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshStandardMaterial({ color: '#6f9a4c', roughness: 0.95 }));
  lawn.rotation.x = -Math.PI / 2;
  lawn.position.y = M.mainHeight + 0.06;
  group.add(lawn);
  return {
    group,
    setNight(night) { logo.material.emissiveIntensity = 0.1 + 0.9 * night; },
  };
}
