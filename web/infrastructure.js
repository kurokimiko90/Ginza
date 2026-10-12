import * as THREE from 'three';
import { vehiclePhase, walkState } from './traffic-signals.js';

// 燈色：亮燈／熄燈（MeshBasic + instanceColor，不受日照影響）
const LIT = { green: '#2fe0b4', yellow: '#ffb21e', red: '#ff3022', walk: '#3fe8c0', stop: '#ff4637' };
const OFF = '#1d2b2c';

/** 合併實例零件；不逐燈新增光源或陰影貼圖。poleAxes：各信號柱控制的車流方向（traffic-signals.planSignals）。 */
export function buildInfrastructure(items, poleAxes = []) {
  const group = new THREE.Group();
  const lamps = items.filter((p) => p.type === 'lamp');
  const signals = items.filter((p) => p.type === 'signal');
  // 2015／2021 銀座通り實照：燈柱與信號柱為淺灰綠塗裝，信號燈箱為淺灰。
  const metal = new THREE.MeshStandardMaterial({ color: '#8e9a93', metalness: 0.25, roughness: 0.55 });
  const housing = new THREE.MeshStandardMaterial({ color: '#a4aba9', roughness: 0.6 });
  const glass = new THREE.MeshStandardMaterial({ color: '#e4eced', emissive: '#dceaff', emissiveIntensity: 0, roughness: 0.4 });
  const lampLight = new THREE.MeshStandardMaterial({ color: '#f4f3e8', emissive: '#fff3dc', emissiveIntensity: 0.1 });
  const signalLamp = new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false });
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
    return mesh;
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
  const carLamps = { green: [], yellow: [], red: [] };
  for (const side of [-1, 1]) {
    part(signals, new THREE.BoxGeometry(1.35, 0.5, 0.2), housing, [2.5, 5.4, side * 0.12]);
    for (const [index, color] of [[-1, 'green'], [0, 'yellow'], [1, 'red']]) {
      const x = 2.5 + index * side * 0.43;
      const lamp = part(signals, new THREE.CylinderGeometry(0.17, 0.17, 0.035, 16).rotateX(Math.PI / 2), signalLamp, [x, 5.4, side * 0.245]);
      if (lamp) carLamps[color].push(lamp);
      part(signals, new THREE.BoxGeometry(0.36, 0.07, 0.28), housing, [x, 5.61, side * 0.3]);
    }
  }
  // 行人灯正面朝向過街線（local +x），上紅站立、下青步行圖示。
  part(signals, new THREE.BoxGeometry(0.2, 0.82, 0.4), housing, [0.18, 2.9, 0]);
  // 白色圖示 × instanceColor 上色：上半站立（紅）、下半步行（青），各自亮滅。
  function iconTexture(walking) {
    const canvas = document.createElement('canvas'); canvas.width = 64; canvas.height = 64;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#141414'; ctx.fillRect(0, 0, 64, 64);
    ctx.strokeStyle = ctx.fillStyle = '#ffffff'; ctx.lineWidth = 5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(32, 13, 5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(32, 23); ctx.lineTo(32, 37);
    ctx.moveTo(21, 33); ctx.lineTo(32, 26); ctx.lineTo(43, 33);
    ctx.moveTo(32, 37); ctx.lineTo(walking ? 19 : 27, 53);
    ctx.moveTo(32, 37); ctx.lineTo(walking ? 45 : 37, 53); ctx.stroke();
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshBasicMaterial({ map: texture, toneMapped: false });
  }
  const stopIcon = part(signals, new THREE.PlaneGeometry(0.34, 0.37), iconTexture(false), [0.29, 3.085, 0], Math.PI / 2);
  const walkIcon = part(signals, new THREE.PlaneGeometry(0.34, 0.37), iconTexture(true), [0.29, 2.715, 0], Math.PI / 2);

  const lit = Object.fromEntries(Object.entries(LIT).map(([k, v]) => [k, new THREE.Color(v)]));
  const off = new THREE.Color(OFF);
  let lastKey = '';
  function paint(mesh, isOn, color) {
    if (!mesh) return;
    signals.forEach((_, i) => mesh.setColorAt(i, isOn(i) ? color : off));
    mesh.instanceColor.needsUpdate = true;
  }
  // t：與車流共用的時鐘（秒）。只有燈色改變時才更新實例顏色。
  function update(t) {
    const phase = vehiclePhase(t);
    const blink = Math.floor(t * 2) % 2 === 0; // 行人燈閃爍 2 Hz
    const axes = { main: phase.main, side: phase.side };
    const walk = { main: walkState('main', t), side: walkState('side', t) };
    const key = `${axes.main}${axes.side}${walk.main}${walk.side}${blink}`;
    if (key === lastKey) return;
    lastKey = key;
    const axisAt = (i) => poleAxes[i] || 'main';
    for (const color of ['green', 'yellow', 'red']) {
      for (const mesh of carLamps[color]) paint(mesh, (i) => axes[axisAt(i)] === color, lit[color]);
    }
    paint(stopIcon, (i) => walk[axisAt(i)] === 'stop', lit.stop);
    paint(walkIcon, (i) => walk[axisAt(i)] === 'walk' || (walk[axisAt(i)] === 'flash' && blink), lit.walk);
  }
  update(0);
  return { group, counts: { lamps: lamps.length, signals: signals.length }, update, setNight(night) {
    glass.emissiveIntensity = night * 0.75;
    lampLight.emissiveIntensity = 0.1 + night * 2;
  } };
}
