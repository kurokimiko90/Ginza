import * as THREE from 'three';

/** 合併實例零件；不逐燈新增光源或陰影貼圖。信號為靜態示意，尚不控制人車。 */
export function buildInfrastructure(items) {
  const group = new THREE.Group();
  const lamps = items.filter((p) => p.type === 'lamp');
  const signals = items.filter((p) => p.type === 'signal');
  // 2015／2021 銀座通り實照：燈柱與信號柱為淺灰綠塗裝，信號燈箱為淺灰。
  const metal = new THREE.MeshStandardMaterial({ color: '#8e9a93', metalness: 0.25, roughness: 0.55 });
  const housing = new THREE.MeshStandardMaterial({ color: '#a4aba9', roughness: 0.6 });
  const glass = new THREE.MeshStandardMaterial({ color: '#e4eced', emissive: '#dceaff', emissiveIntensity: 0, roughness: 0.4 });
  const lampLight = new THREE.MeshStandardMaterial({ color: '#f4f3e8', emissive: '#fff3dc', emissiveIntensity: 0.1 });
  const red = new THREE.MeshStandardMaterial({ color: '#b52624', emissive: '#ff3022', emissiveIntensity: 0.8 });
  const unlit = new THREE.MeshStandardMaterial({ color: '#172b2d', roughness: 0.5 });
  const dummy = new THREE.Object3D();
  function part(points, geometry, material, offset, rotation = 0) {
    if (!points.length) { geometry.dispose(); return; }
    const mesh = new THREE.InstancedMesh(geometry, material, points.length);
    points.forEach((p, i) => {
      const c = Math.cos(p.heading), s = Math.sin(p.heading);
      dummy.position.set(p.x + offset[0] * c + offset[2] * s, offset[1], p.z - offset[0] * s + offset[2] * c);
      dummy.rotation.set(0, p.heading + rotation, 0); dummy.scale.setScalar(1); dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    // 小燈頭／遮沿不重複投影，只讓長柱與基座投影。
    mesh.castShadow = material === metal && offset[0] === 0;
    mesh.receiveShadow = true; mesh.computeBoundingSphere(); group.add(mesh);
  }
  // 官方照片：矩形乳白光柱、兩側高低平直燈臂，非球形燈罩。
  part(lamps, new THREE.BoxGeometry(0.36, 0.25, 0.36), metal, [0, 0.16, 0]);
  part(lamps, new THREE.BoxGeometry(0.26, 8.5, 0.26), metal, [0, 4.5, 0]);
  part(lamps, new THREE.BoxGeometry(0.19, 6.8, 0.275), glass, [0, 5.1, 0]);
  for (const [height, side] of [[8.5, 1], [5.6, -1]]) {
    part(lamps, new THREE.BoxGeometry(1.65, 0.16, 0.3), metal, [side * 0.8, height, 0]);
    part(lamps, new THREE.BoxGeometry(0.8, 0.08, 0.28), lampLight, [side * 1.2, height - 0.1, 0]);
  }
  part(signals, new THREE.CylinderGeometry(0.08, 0.11, 5.8, 10), metal, [0, 2.94, 0]);
  part(signals, new THREE.BoxGeometry(3.2, 0.12, 0.13), metal, [1.55, 5.55, 0]);
  // 車用橫排三色：面對正面左青、中黃、右紅，背面亦各自正確排序。
  for (const side of [-1, 1]) {
    part(signals, new THREE.BoxGeometry(1.35, 0.5, 0.2), housing, [2.5, 5.4, side * 0.12]);
    for (const [index, material] of [[-1, unlit], [0, unlit], [1, red]]) {
      const x = 2.5 + index * side * 0.43;
      part(signals, new THREE.CylinderGeometry(0.17, 0.17, 0.035, 16).rotateX(Math.PI / 2), material, [x, 5.4, side * 0.245]);
      part(signals, new THREE.BoxGeometry(0.36, 0.07, 0.28), housing, [x, 5.61, side * 0.3]);
    }
  }
  // 行人灯正面朝向過街線（local +x），上紅站立、下青步行圖示。
  part(signals, new THREE.BoxGeometry(0.2, 0.82, 0.4), housing, [0.18, 2.9, 0]);
  const iconCanvas = document.createElement('canvas'); iconCanvas.width = 64; iconCanvas.height = 128;
  const ctx = iconCanvas.getContext('2d'); ctx.fillStyle = '#10191b'; ctx.fillRect(0, 0, 64, 128);
  function person(y, color, walking) {
    ctx.strokeStyle = ctx.fillStyle = color; ctx.lineWidth = 5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(32, y + 10, 5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(32, y + 20); ctx.lineTo(32, y + 34);
    ctx.moveTo(21, y + 30); ctx.lineTo(32, y + 23); ctx.lineTo(43, y + 30);
    ctx.moveTo(32, y + 34); ctx.lineTo(walking ? 19 : 27, y + 50);
    ctx.moveTo(32, y + 34); ctx.lineTo(walking ? 45 : 37, y + 50); ctx.stroke();
  }
  person(3, '#ff4637', false); person(67, '#183536', true);
  const iconTexture = new THREE.CanvasTexture(iconCanvas); iconTexture.colorSpace = THREE.SRGBColorSpace;
  const pedestrian = new THREE.MeshBasicMaterial({ map: iconTexture, toneMapped: false });
  part(signals, new THREE.PlaneGeometry(0.34, 0.74), pedestrian, [0.29, 2.9, 0], Math.PI / 2);
  return { group, counts: { lamps: lamps.length, signals: signals.length }, setNight(night) {
    glass.emissiveIntensity = night * 0.75;
    lampLight.emissiveIntensity = 0.1 + night * 2;
    red.emissiveIntensity = 0.8 + night * 0.7;
  } };
}
