// 合併燈箱外殼與局部柔光：不新增店名、招牌位置或數百個即時光源。
import * as THREE from 'three';

function geometryFrom(data, colors = false) {
  const geometry = new THREE.BufferGeometry();
  for (const [key, size] of [['position', 3], ['normal', 3], ['uv', 2]]) {
    geometry.setAttribute(key, new THREE.Float32BufferAttribute(data[key], size));
  }
  if (colors) geometry.setAttribute('color', new THREE.Float32BufferAttribute(data.color, 3));
  geometry.computeBoundingSphere();
  return geometry;
}

export function createLightboxes() {
  const body = { position: [], normal: [], uv: [] };
  const halo = { position: [], normal: [], uv: [], color: [] };
  function glow(center, face, width, height, color) {
    const right = new THREE.Vector3(face.z, 0, -face.x);
    const up = new THREE.Vector3(0, 1, 0);
    const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
    for (const k of [0, 1, 2, 0, 2, 3]) {
      const [x, y] = corners[k];
      const p = center.clone().addScaledVector(right, x * width / 2).addScaledVector(up, y * height / 2);
      halo.position.push(p.x, p.y, p.z);
      halo.normal.push(face.x, 0, face.z);
      halo.uv.push((x + 1) / 2, (y + 1) / 2);
      halo.color.push(color.r, color.g, color.b);
    }
  }
  return {
    // center 為正面印刷板所在位置，外殼在後方；double 表示背面也有印刷板。
    add(center, face, width, height, color = '#fff0d7', depth = 0.2, double = false) {
      const geometry = new THREE.BoxGeometry(width + 0.12, height + 0.12, depth).toNonIndexed();
      geometry.rotateY(Math.atan2(face.x, face.z));
      geometry.translate(center.x - face.x * (depth / 2 + 0.012), center.y, center.z - face.z * (depth / 2 + 0.012));
      for (const key of ['position', 'normal', 'uv']) for (const value of geometry.attributes[key].array) body[key].push(value);
      geometry.dispose();
      const tint = new THREE.Color(color);
      glow(center.clone().addScaledVector(face, 0.025), face, width + 1.0, height + 0.8, tint);
      if (double) glow(center.clone().addScaledVector(face, -depth - 0.049), face.clone().negate(), width + 1.0, height + 0.8, tint);
    },
    finish() {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 128;
      const ctx = canvas.getContext('2d');
      const gradient = ctx.createRadialGradient(64, 64, 4, 64, 64, 64);
      gradient.addColorStop(0, 'rgba(255,255,255,0.5)');
      gradient.addColorStop(0.5, 'rgba(255,255,255,0.18)');
      gradient.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = gradient; ctx.fillRect(0, 0, 128, 128);
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      const material = new THREE.MeshBasicMaterial({
        map: texture, vertexColors: true, transparent: true, opacity: 0,
        blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
      });
      const group = new THREE.Group();
      const casing = new THREE.Mesh(geometryFrom(body), new THREE.MeshStandardMaterial({ color: '#444b50', metalness: 0.55, roughness: 0.38 }));
      casing.castShadow = casing.receiveShadow = true;
      const aura = new THREE.Mesh(geometryFrom(halo, true), material);
      aura.renderOrder = 2; // 深度測試仍開啟，不穿透建築。
      group.add(casing, aura);
      return { group, setNight(night) { material.opacity = night * 0.32; group.children[1].visible = night > 0.01; } };
    },
  };
}
