// 街上的車與行人：沿 OSM 道路圖行進，路口隨機轉向。車輛靠左行駛（日本）。
import * as THREE from 'three';
import { createPeopleMesh } from './people.js';

const CAR_ROADS = new Set([
  'trunk', 'primary', 'secondary', 'tertiary', 'unclassified', 'residential', 'living_street',
  'trunk_link', 'primary_link', 'secondary_link',
]);
const WALK_ROADS = new Set(['footway', 'pedestrian', 'path', 'steps', 'living_street']);
const CAR_COUNT = 170;
const PEOPLE_COUNT = 2200;
const BUSY_RADIUS = 450; // 銀座四丁目（原點）周圍人車較密集
// 銀座常見車色：黑頭計程車、黃綠計程車、白、銀、黑
const CAR_COLORS = ['#334c61', '#334c61', '#edbf55', '#5e9a86', '#f5eee0', '#f5eee0', '#abc4ce', '#527cab', '#c77766'];

const keyOf = (p) => `${p[0]},${p[1]}`;

// 把 roads.json 的線段建成以端點相連的圖
function buildNetwork(roads, kinds) {
  const segments = roads
    .filter((r) => kinds.has(r.kind) && r.points.length >= 2)
    .map((r) => {
      const cum = [0];
      for (let i = 1; i < r.points.length; i++) {
        cum.push(cum[i - 1] + Math.hypot(r.points[i][0] - r.points[i - 1][0], r.points[i][1] - r.points[i - 1][1]));
      }
      return { ...r, cum, length: cum.at(-1) };
    })
    .filter((s) => s.length > 3);
  const nodes = new Map();
  segments.forEach((seg, index) => {
    for (const end of [0, 1]) {
      const key = keyOf(end ? seg.points.at(-1) : seg.points[0]);
      if (!nodes.has(key)) nodes.set(key, []);
      nodes.get(key).push({ index, end });
    }
  });
  return { segments, nodes };
}

// 依長度加權隨機挑一段路；離銀座四丁目越近權重越高
function busyWeight(seg) {
  const mid = seg.points[Math.floor(seg.points.length / 2)];
  return seg.length * (Math.hypot(mid[0], mid[1]) < BUSY_RADIUS ? 3 : 1);
}

function pickWeighted(segments, rand) {
  const total = segments.reduce((sum, s) => sum + busyWeight(s), 0);
  let t = rand() * total;
  for (let i = 0; i < segments.length; i++) {
    t -= busyWeight(segments[i]);
    if (t <= 0) return i;
  }
  return segments.length - 1;
}

// s：沿行進方向的距離；dir = 1 從起點走、-1 從終點走
function sample(seg, s, dir, out) {
  const along = dir > 0 ? s : seg.length - s;
  let i = 1;
  while (i < seg.cum.length - 1 && seg.cum[i] < along) i++;
  const a = seg.points[i - 1], b = seg.points[i];
  const span = seg.cum[i] - seg.cum[i - 1] || 1;
  const t = (along - seg.cum[i - 1]) / span;
  out.x = a[0] + (b[0] - a[0]) * t;
  out.z = a[1] + (b[1] - a[1]) * t;
  out.dx = ((b[0] - a[0]) / span) * dir;
  out.dz = ((b[1] - a[1]) / span) * dir;
  return out;
}

function advance(agent, network, rand, distance) {
  agent.s += distance;
  let seg = network.segments[agent.seg];
  while (agent.s > seg.length) {
    agent.s -= seg.length;
    const endKey = keyOf(agent.dir > 0 ? seg.points.at(-1) : seg.points[0]);
    const options = network.nodes.get(endKey).filter((o) => o.index !== agent.seg);
    if (options.length) {
      const next = options[Math.floor(rand() * options.length)];
      agent.seg = next.index;
      agent.dir = next.end === 0 ? 1 : -1;
    } else {
      agent.dir = -agent.dir; // 死巷迴轉
    }
    seg = network.segments[agent.seg];
  }
}

// 合併多個零件為一個幾何，每個零件帶自己的頂點色。part 可為 {geometry} 或 {size, at}（方塊）
function mergeParts(parts) {
  const geometries = parts.map(({ geometry, size, at, color }) => {
    const g = (geometry || new THREE.BoxGeometry(...size).translate(...at)).toNonIndexed();
    const c = new THREE.Color(color);
    const colors = new Float32Array(g.attributes.position.count * 3);
    for (let i = 0; i < colors.length; i += 3) colors.set([c.r, c.g, c.b], i);
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return g;
  });
  const merged = new THREE.BufferGeometry();
  for (const name of ['position', 'normal', 'color']) {
    const arrays = geometries.map((g) => g.attributes[name].array);
    const out = new Float32Array(arrays.reduce((n, a) => n + a.length, 0));
    let offset = 0;
    for (const a of arrays) { out.set(a, offset); offset += a.length; }
    merged.setAttribute(name, new THREE.BufferAttribute(out, 3));
  }
  geometries.forEach((g) => g.dispose());
  return merged;
}

// 側面輪廓 [z, y]（車頭朝 -z）沿 x 方向拉出寬度
function extrudeProfile(points, width, bevel = 0) {
  const shape = new THREE.Shape(points.map(([z, y]) => new THREE.Vector2(z, y)));
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: width - bevel * 2, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 3, steps: 1, curveSegments: 1,
  });
  g.rotateY(-Math.PI / 2); // 輪廓 x → 世界 z，拉伸方向 → 世界 -x
  g.translate(width / 2 - bevel, 0, 0);
  return g;
}

const CAR_BODY = [[-2.2, 0.32], [-2.2, 0.74], [-1.2, 0.88], [-0.55, 1.36], [0.85, 1.4], [1.6, 0.95], [2.2, 0.9], [2.2, 0.32]];
const CAR_GLASS = [[-1.16, 0.92], [-0.56, 1.375], [0.84, 1.415], [1.55, 0.98]];

function carGeometries() {
  const wheels = [[-0.78, -1.35], [0.78, -1.35], [-0.78, 1.38], [0.78, 1.38]].map(([x, z]) => ({
    geometry: new THREE.CylinderGeometry(0.32, 0.32, 0.22, 12).rotateZ(Math.PI / 2).translate(x, 0.32, z), color: '#121212',
  }));
  return {
    body: mergeParts([{ geometry: extrudeProfile(CAR_BODY, 1.72, 0.09), color: '#ffffff' }]),
    trim: mergeParts([...wheels, { size: [1.74, 0.16, 0.12], at: [0, 0.42, -2.2], color: '#2a2a2a' }, { size: [1.74, 0.16, 0.12], at: [0, 0.42, 2.2], color: '#2a2a2a' }]),
    glass: mergeParts([{ geometry: extrudeProfile(CAR_GLASS, 1.76), color: '#7eafc2' }]),
    lights: mergeParts([
      { size: [0.36, 0.13, 0.05], at: [-0.58, 0.68, -2.25], color: '#fff6dc' },
      { size: [0.36, 0.13, 0.05], at: [0.58, 0.68, -2.25], color: '#fff6dc' },
      { size: [0.32, 0.12, 0.05], at: [-0.62, 0.8, 2.25], color: '#ff2a1a' },
      { size: [0.32, 0.12, 0.05], at: [0.62, 0.8, 2.25], color: '#ff2a1a' },
    ]),
  };
}

function instanced(geometry, material, count, shadow = true) {
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false; // 實例散布全城，用幾何本身的包圍球會誤判
  mesh.castShadow = shadow;
  mesh.receiveShadow = shadow;
  return mesh;
}

function mulberry(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function spawn(network, count, rand, make) {
  if (!network.segments.length) return [];
  return Array.from({ length: count }, () => {
    const seg = pickWeighted(network.segments, rand);
    return { seg, dir: rand() < 0.5 ? 1 : -1, s: rand() * network.segments[seg].length, ...make() };
  });
}

function createCars(roads, rand) {
  const network = buildNetwork(roads, CAR_ROADS);
  const cars = spawn(network, CAR_COUNT, rand, () => ({ speed: 7 + rand() * 5, lane: 0.25 + rand() * 0.08 }));
  // 車身沿 -z 為車頭方向（與相機 yaw 慣例一致）
  const geo = carGeometries();
  const bodyMesh = instanced(geo.body, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, metalness: 0.45 }), cars.length);
  const trimMesh = instanced(geo.trim, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 }), cars.length);
  const glassMesh = instanced(geo.glass, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.22, metalness: 0.15 }), cars.length, false);
  const lightMaterial = new THREE.MeshBasicMaterial({ vertexColors: true });
  const lightMesh = instanced(geo.lights, lightMaterial, cars.length, false);
  const color = new THREE.Color();
  cars.forEach((_, i) => bodyMesh.setColorAt(i, color.set(CAR_COLORS[Math.floor(rand() * CAR_COLORS.length)])));
  return { network, agents: cars, meshes: [bodyMesh, trimMesh, glassMesh, lightMesh], lightMaterial };
}

function createPeople(roads, rand) {
  const network = buildNetwork(roads, WALK_ROADS);
  const people = spawn(network, PEOPLE_COUNT, rand, () => ({
    speed: 1 + rand() * 0.6, lane: (rand() - 0.5) * 0.6, phase: rand() * Math.PI * 2, scale: 0.92 + rand() * 0.14,
  }));
  const walkers = createPeopleMesh(people, rand);
  return { network, agents: people, meshes: [walkers.mesh], setTime: walkers.setTime };
}

export function createLife(roads) {
  const rand = mulberry(20261009);
  const cars = createCars(roads, rand);
  const people = createPeople(roads, rand);
  const group = new THREE.Group();
  group.add(...cars.meshes, ...people.meshes);
  const dummy = new THREE.Object3D();
  const point = {};
  let clock = 0;

  function place(fleet, update) {
    fleet.agents.forEach((agent, i) => {
      const seg = fleet.network.segments[agent.seg];
      sample(seg, agent.s, agent.dir, point);
      update(agent, seg);
      fleet.meshes.forEach((mesh) => mesh.setMatrixAt(i, dummy.matrix));
    });
    fleet.meshes.forEach((mesh) => { mesh.instanceMatrix.needsUpdate = true; });
  }

  function update(dt) {
    clock += dt;
    people.setTime(clock);
    place(cars, (agent, seg) => {
      // 靠左：行進方向的左側為 (dz, -dx)
      const offset = seg.width * agent.lane;
      dummy.position.set(point.x + point.dz * offset, 0, point.z - point.dx * offset);
      dummy.rotation.set(0, Math.atan2(-point.dx, -point.dz), 0);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
    });
    place(people, (agent, seg) => {
      const offset = seg.width * agent.lane;
      const bob = Math.abs(Math.sin(clock * agent.speed * 5.6 + agent.phase)) * 0.03; // 與步伐同步
      dummy.position.set(point.x + point.dz * offset, bob, point.z - point.dx * offset);
      dummy.rotation.set(0, Math.atan2(-point.dx, -point.dz), 0);
      dummy.scale.setScalar(agent.scale);
      dummy.updateMatrix();
    });
    for (const agent of cars.agents) advance(agent, cars.network, rand, agent.speed * dt);
    for (const agent of people.agents) advance(agent, people.network, rand, agent.speed * dt);
  }

  update(0);
  return {
    group,
    counts: { cars: cars.agents.length, people: people.agents.length },
    update,
    setNight(night) {
      cars.lightMaterial.color.setScalar(0.7 + night * 1.6); // 夜間車燈更亮
    },
  };
}
