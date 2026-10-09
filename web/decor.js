import * as THREE from 'three';
import { BED, bedPlants } from './flowerbeds.js';

// 每種零件共用一個 InstancedMesh；夜間以發光燈罩和地面光暈替代大量點光源。
export function buildDecor(items) {
  const group = new THREE.Group();
  const trees = items.filter((p) => p.type === 'tree'), lamps = items.filter((p) => p.type === 'lamp');
  const stone = new THREE.MeshStandardMaterial({ color: '#aaa79e', roughness: 0.9 });
  const soil = new THREE.MeshStandardMaterial({ color: '#5b4636', roughness: 1 });
  const wood = new THREE.MeshStandardMaterial({ color: '#97684f', roughness: 0.95 });
  const leaf = new THREE.MeshStandardMaterial({ color: '#8fab75', roughness: 0.9, emissive: '#355335', emissiveIntensity: 0 });
  const flowers = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.8, emissive: '#645b51', emissiveIntensity: 0 });
  const pollen = new THREE.MeshStandardMaterial({ color: '#d4ad57', roughness: 0.8 });
  const metal = new THREE.MeshStandardMaterial({ color: '#3e6470', roughness: 0.45, metalness: 0.2 });
  const glow = new THREE.MeshStandardMaterial({ color: '#fff1cb', emissive: '#ffbd66', emissiveIntensity: 0.15, roughness: 0.35 });
  const dummy = new THREE.Object3D();
  function part(points, geometry, material, at, scale = [1, 1, 1]) {
    if (!points.length) { geometry.dispose(); return; }
    const mesh = new THREE.InstancedMesh(geometry, material, points.length);
    points.forEach((p, i) => {
      const heading = p.heading || 0, c = Math.cos(heading), s = Math.sin(heading);
      dummy.position.set(p.x + at[0] * c + at[2] * s, at[1] + (p.yOffset || 0), p.z - at[0] * s + at[2] * c);
      dummy.rotation.set(0, p.heading || 0, 0);
      dummy.scale.set(...scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      if (material === leaf) mesh.setColorAt(i, new THREE.Color().setHSL(0.21 + (i % 4) * 0.018, 0.3, 0.4 + (i % 3) * 0.035));
      if (material === flowers) mesh.setColorAt(i, new THREE.Color(p.flowerColor || '#ede8dc'));
    });
    mesh.castShadow = material === wood || material === stone || material === metal || (material === leaf && (at[1] > 2 || points.some(p => p.yOffset > 2)));
    mesh.receiveShadow = true;
    mesh.computeBoundingSphere();
    group.add(mesh);
  }
  // 貼地低樹池與覆土，取代先前不符合街景的高盆栽。
  // 長條低邊框中間保留裸土與樹幹，非整塊實心高花箱。
  for (const side of [-1, 1]) {
    part(trees, new THREE.BoxGeometry(0.07, 0.16, BED.length), stone, [side * (BED.width - 0.07) / 2, 0.12, 0]);
    part(trees, new THREE.BoxGeometry(BED.width - 0.14, 0.16, 0.07), stone, [0, 0.12, side * (BED.length - 0.07) / 2]);
  }
  part(trees, new THREE.BoxGeometry(BED.width - 0.14, 0.05, BED.length - 0.14), soil, [0, 0.10, 0]);
  part(trees, new THREE.CylinderGeometry(0.09, 0.16, 4.3, 10), wood, [0, 2.25, 0]);
  // Open, asymmetrical clustered foliage, preserving the animation-like silhouette.
  // All clusters share one mesh; no per-tree draw calls or photographic alpha cards.
  const clusters = trees.flatMap((tree, t) => Array.from({ length: 38 }, (_, i) => {
    const angle = i * 2.399963 + t * 0.7;
    const layer = i % 5, reach = 0.55 + (i % 7) * 0.14;
    return { ...tree, x: tree.x + Math.cos(angle) * reach,
      z: tree.z + Math.sin(angle) * reach,
      yOffset: 3.9 + layer * 0.48 + Math.sin(i * 1.7) * 0.16 };
  }));
  const foliage = new THREE.BufferGeometry(), foliagePositions = [], foliageNormals = [];
  for (let i = 0; i < 9; i++) {
    const angle = i * 2.4;
    const sprig = new THREE.IcosahedronGeometry(0.24, 0);
    sprig.scale(1.25, 0.45, 0.7); sprig.rotateZ(Math.sin(i) * 0.7); sprig.rotateY(angle);
    sprig.translate(Math.cos(angle) * 0.3, (i % 3 - 1) * 0.17, Math.sin(angle) * 0.3);
    foliagePositions.push(...sprig.attributes.position.array);
    foliageNormals.push(...sprig.attributes.normal.array); sprig.dispose();
  }
  foliage.setAttribute('position', new THREE.Float32BufferAttribute(foliagePositions, 3));
  foliage.setAttribute('normal', new THREE.Float32BufferAttribute(foliageNormals, 3));
  part(clusters, foliage, leaf, [0, 0, 0]);
  for (let i = 0; i < 5; i++) {
    const angle = i * Math.PI * 0.4;
    const branch = new THREE.CylinderGeometry(0.025, 0.065, 1.3, 6);
    branch.rotateZ(0.5); branch.rotateY(angle);
    part(trees, branch, wood, [Math.cos(angle) * 0.32, 4.3, Math.sin(angle) * 0.32]);
  }
  const plants = trees.flatMap(bedPlants);
  part(plants, new THREE.SphereGeometry(0.15, 8, 6), leaf, [0, 0.22, 0], [1, 0.65, 1.15]);
  const flowerPlants = plants.filter((p) => p.kind === 'flower').map((p) => ({ ...p, yOffset: p.plantHeight }));
  part(flowerPlants, new THREE.CylinderGeometry(0.012, 0.018, 0.22, 5), leaf, [0, -0.08, 0]);
  // 花瓣與花心分離，替代原來像彩色石子的微小球。
  const petals = flowerPlants.flatMap((p) => Array.from({ length: 5 }, (_, i) => {
    const angle = i * Math.PI * 2 / 5;
    return { ...p, x: p.x + Math.cos(angle) * 0.065, z: p.z + Math.sin(angle) * 0.065, heading: -angle };
  }));
  part(petals, new THREE.SphereGeometry(0.065, 7, 5), flowers, [0, 0.12, 0], [1.2, 0.35, 0.85]);
  part(flowerPlants, new THREE.SphereGeometry(0.035, 6, 4), pollen, [0, 0.135, 0], [1, 0.6, 1]);
  // 彎曲細葉草簇：不是尖錐體；不同高度交錯，保持低於橱窗視線。
  const blades = new THREE.BufferGeometry();
  blades.setAttribute('position', new THREE.Float32BufferAttribute([
    -0.035, 0, 0, 0.035, 0, 0, 0.055, 0.25, 0,
    -0.035, 0, 0, 0.055, 0.25, 0, 0, 0.25, 0,
    0, 0.25, 0, 0.055, 0.25, 0, 0.14, 0.48, 0,
  ], 3));
  blades.computeVertexNormals();
  const grassMaterial = new THREE.MeshStandardMaterial({ color: '#809468', roughness: 0.9, side: THREE.DoubleSide });
  const grass = plants.filter((p) => p.kind === 'grass').flatMap((p) => Array.from({ length: 5 }, (_, i) => ({ ...p, heading: p.heading + i * Math.PI * 0.4 })));
  part(grass, blades, grassMaterial, [0, 0.18, 0]);
  part(lamps, new THREE.CylinderGeometry(0.12, 0.22, 0.4, 10), metal, [0, 0.2, 0]);
  part(lamps, new THREE.CylinderGeometry(0.065, 0.1, 4.0, 10), metal, [0, 2.2, 0]);
  part(lamps, new THREE.SphereGeometry(0.3, 12, 8), glow, [0, 4.25, 0], [1, 1.3, 1]);
  part(lamps, new THREE.ConeGeometry(0.4, 0.25, 12), metal, [0, 4.7, 0]);

  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(255,191,104,0.48)');
  gradient.addColorStop(1, 'rgba(255,191,104,0)');
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, 128, 128);
  const poolMaterial = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true, depthWrite: false, opacity: 0, polygonOffset: true, polygonOffsetFactor: -4 });
  poolMaterial.map.colorSpace = THREE.SRGBColorSpace;
  const pools = new THREE.InstancedMesh(new THREE.PlaneGeometry(7, 7).rotateX(-Math.PI / 2), poolMaterial, lamps.length);
  lamps.forEach((p, i) => {
    dummy.position.set(p.x, 0.06, p.z); dummy.scale.setScalar(1); dummy.updateMatrix(); pools.setMatrixAt(i, dummy.matrix);
  });
  pools.computeBoundingSphere();
  group.add(pools);
  return { group, counts: { trees: trees.length, lamps: lamps.length }, setNight(night) {
    glow.emissiveIntensity = 0.15 + night * 2.5;
    leaf.emissiveIntensity = night * 0.05; // 微弱環境補色，不把植物做成發光物。
    flowers.emissiveIntensity = night * 0.08;
    poolMaterial.opacity = night;
    pools.visible = night > 0.01;
  } };
}
