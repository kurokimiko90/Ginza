import * as THREE from 'three';
import { BED } from './flowerbeds.js';

export const POT_HEIGHT = 0.22;

/** 合併多個幾何為單一非索引幾何，讓同種植物共用一次 InstancedMesh 繪製。 */
function merge(geometries) {
  const positions = [], normals = [];
  for (const g of geometries) {
    const flat = g.index ? g.toNonIndexed() : g;
    flat.computeVertexNormals();
    positions.push(...flat.attributes.position.array);
    normals.push(...flat.attributes.normal.array);
    if (flat !== g) flat.dispose();
    g.dispose();
  }
  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  merged.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  return merged;
}

// 銀座エキゾチック：向外張開的劍形葉蓮座（龍舌蘭／絲蘭類示意）。
function spikeRosette() {
  return merge(Array.from({ length: 7 }, (_, i) => {
    const blade = new THREE.ConeGeometry(0.035, 0.5, 4);
    blade.translate(0, 0.25, 0);
    blade.rotateZ(0.35 + (i % 2) * 0.25);
    blade.rotateY(i * Math.PI * 2 / 7);
    return blade;
  }));
}

// SASA deco：短稈加數片披針形竹葉。
function sasaClump() {
  return merge(Array.from({ length: 6 }, (_, i) => {
    const leafBlade = new THREE.SphereGeometry(0.11, 6, 4);
    leafBlade.scale(0.28, 0.06, 1);
    leafBlade.translate(0, 0, 0.1);
    leafBlade.rotateX(-0.45 - (i % 3) * 0.12);
    leafBlade.rotateY(i * 2.3);
    leafBlade.translate(0, 0.16 + (i % 3) * 0.1, 0);
    return leafBlade;
  }));
}

// 銀座植物園：長邊的活柳編籬（官方描述為像柵欄的生柳 fedge），以交叉細枝示意。
function willowFedge() {
  const sticks = [];
  for (const side of [-1, 1]) for (let k = 0; k < 7; k++) for (const lean of [-0.55, 0.55]) {
    const stick = new THREE.CylinderGeometry(0.008, 0.012, 0.42, 4);
    stick.rotateX(lean);
    stick.translate(side * (BED.width / 2 - 0.05), 0.33, (k - 3) * (BED.length - 0.3) / 6);
    sticks.push(stick);
  }
  return merge(sticks);
}

/** 依 zone 加入各區特徵植物；part 為 decor.js 的實例化繪製函式。 */
export function buildZoneFeatures(trees, plants, part, { bedLeaf, wood, pot }) {
  part(plants.filter((p) => p.kind === 'spike'), spikeRosette(), bedLeaf, [0, 0.12, 0]);
  part(plants.filter((p) => p.kind === 'sasa'), sasaClump(), bedLeaf, [0, 0.1, 0]);
  part(trees.filter((t) => t.zone === 1), willowFedge(), wood, [0, 0, 0]);
  part(plants.filter((p) => p.potted), new THREE.CylinderGeometry(0.09, 0.07, POT_HEIGHT, 8), pot, [0, 0.12 + POT_HEIGHT / 2, 0]);
}
