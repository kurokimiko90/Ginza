// 店內縱深：interior mapping。每個店面分節只有一片玻璃四邊形，片段著色器沿視線求交
// 虛擬房間（後牆／側牆／地板／天花板）與兩層陳列剖面，得到隨視角變化的室內透視。
// 不增加建築幾何，也不挖空外牆；陳列為同業態典型構成，不是逐店實景。
import * as THREE from 'three';
import { INTERIOR_TYPES } from './shop-types.js';
import { ROOM, CELL, SURFACES, LAYER_DEPTHS, surface, rng } from './shop-paint-kit.js';
import { fashion, jewelry, cosmetics, bookstore, gallery, goods } from './shop-paint-retail.js';
import { sweets, cafe, dining, convenience, service, salon } from './shop-paint-food.js';

const PAINTERS = { fashion, jewelry, sweets, cafe, dining, cosmetics, books: bookstore, gallery, convenience, goods, service, salon };
// 室內光色：便利店／銀行偏冷白，餐飲與珠寶偏暖。
const TINTS = {
  fashion: '#fff4e4', jewelry: '#ffe9c8', sweets: '#fff1dc', cafe: '#ffe0b8', dining: '#ffd49e', cosmetics: '#fffaf6',
  books: '#fff0d8', gallery: '#fbfbff', convenience: '#f2f8ff', goods: '#fff0dc', service: '#f4f8ff', salon: '#fff3e2',
};

export function paintInteriorAtlas() {
  const canvas = document.createElement('canvas');
  canvas.width = CELL[0] * SURFACES.length;
  canvas.height = CELL[1] * INTERIOR_TYPES.length;
  const ctx = canvas.getContext('2d');
  INTERIOR_TYPES.forEach((type, row) => {
    const painter = PAINTERS[type];
    SURFACES.forEach((kind, col) => {
      const ox = col * CELL[0], oy = row * CELL[1];
      ctx.save();
      ctx.beginPath(); ctx.rect(ox, oy, CELL[0], CELL[1]); ctx.clip();
      painter[kind](surface(ctx, ox, oy, kind), rng(row * 97 + col * 13 + 5));
      ctx.restore();
    });
  });
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

const VERTEX = /* glsl */`
  attribute vec4 aRoom;
  varying vec3 vWorld;
  varying vec3 vNormalW;
  varying vec2 vUv;
  varying vec4 vRoom;
  #include <fog_pars_vertex>
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    vNormalW = normalize(mat3(modelMatrix) * normal);
    vUv = uv;
    vRoom = aRoom;
    vec4 mvPosition = viewMatrix * world;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }`;

const FRAGMENT = /* glsl */`
  uniform sampler2D uAtlas;
  uniform float uNight;
  uniform vec3 uSky;
  uniform vec3 uTint[${INTERIOR_TYPES.length}];
  varying vec3 vWorld;
  varying vec3 vNormalW;
  varying vec2 vUv;
  varying vec4 vRoom;
  #include <fog_pars_fragment>
  const vec3 ROOM = vec3(${ROOM.width.toFixed(2)}, ${ROOM.height.toFixed(2)}, ${ROOM.depth.toFixed(2)});
  const vec2 GRID = vec2(${SURFACES.length}.0, ${INTERIOR_TYPES.length}.0);

  vec4 cell(float type, float col, vec2 uv) {
    uv = clamp(uv, vec2(0.004), vec2(0.996));
    return texture2D(uAtlas, (vec2(col, GRID.y - 1.0 - type) + uv) / GRID);
  }
  // 窄店取中段；較寬的店按約 5.5m 重複陳列單元，避免家具被拉長或壓扁。
  float across(float x, float width) {
    if (width < ROOM.x * 1.5) return (x - width * 0.5) / max(width, ROOM.x) + 0.5;
    float unit = width / floor(width / ROOM.x + 0.5);
    return fract(x / unit);
  }
  float safe(float v) { return abs(v) < 1e-4 ? (v < 0.0 ? -1e-4 : 1e-4) : v; }

  vec3 layer(vec3 color, vec3 p, vec3 dir, float depth, float tHit, float type, float col, float width) {
    float t = depth / dir.z;
    if (t >= tHit) return color;
    vec3 q = p + dir * t;
    if (q.x < 0.0 || q.x > width || q.y < 0.0 || q.y > ROOM.y) return color;
    vec4 s = cell(type, col, vec2(across(q.x, width), q.y / ROOM.y));
    return mix(color, s.rgb * mix(1.0, 0.86, depth / ROOM.z), s.a);
  }

  void main() {
    float width = vRoom.x, type = vRoom.y;
    vec3 n = normalize(vNormalW);
    vec3 tangent = vec3(n.z, 0.0, -n.x);
    vec3 d = normalize(vWorld - cameraPosition);
    vec3 dir = vec3(dot(d, tangent), d.y, -dot(d, n));
    vec3 p = vec3(vUv.x, vUv.y * ROOM.y, 0.0);
    if (vRoom.z > 0.5) { p.x = width - p.x; dir.x = -dir.x; }
    float facing = max(dir.z, 0.02);
    dir.z = facing;
    float tx = (dir.x > 0.0 ? width - p.x : -p.x) / safe(dir.x);
    float ty = (dir.y > 0.0 ? ROOM.y - p.y : -p.y) / safe(dir.y);
    float tz = ROOM.z / dir.z;
    float tHit = min(min(tx, ty), tz);
    vec3 h = p + dir * tHit;

    vec3 color; float edge;
    if (tHit == tz) {
      color = cell(type, 0.0, vec2(across(h.x, width), h.y / ROOM.y)).rgb;
      edge = min(min(h.x, width - h.x), min(h.y, ROOM.y - h.y));
    } else if (tHit == tx) {
      color = cell(type, 1.0, vec2(h.z / ROOM.z, h.y / ROOM.y)).rgb * 0.86;
      edge = min(min(h.y, ROOM.y - h.y), ROOM.z - h.z);
    } else {
      bool floorHit = dir.y < 0.0;
      color = cell(type, floorHit ? 2.0 : 3.0, vec2(across(h.x, width), h.z / ROOM.z)).rgb * (floorHit ? 0.9 : 1.0);
      edge = min(min(h.x, width - h.x), ROOM.z - h.z);
    }
    color *= mix(0.55, 1.0, smoothstep(0.0, 0.45, edge)) * mix(1.0, 0.8, h.z / ROOM.z);
    color = layer(color, p, dir, ${LAYER_DEPTHS.mid.toFixed(2)}, tHit, type, 5.0, width);
    color = layer(color, p, dir, ${LAYER_DEPTHS.front.toFixed(2)}, tHit, type, 4.0, width);

    color *= uTint[int(type + 0.5)] * mix(0.58, 1.12, uNight);
    float fresnel = 0.05 + 0.55 * pow(1.0 - facing, 4.0);
    vec3 reflection = mix(uSky, vec3(0.03, 0.035, 0.05), uNight);
    color = mix(color * vec3(0.95, 0.985, 0.98), reflection, fresnel * mix(1.0, 0.45, uNight));
    gl_FragColor = vec4(color, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }`;

export function createInteriorMaterial() {
  const material = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      uAtlas: { value: null }, uNight: { value: 0 },
      uSky: { value: new THREE.Color('#aebfc8') },
      uTint: { value: INTERIOR_TYPES.map((type) => new THREE.Color(TINTS[type])) },
    }]),
    vertexShader: VERTEX, fragmentShader: FRAGMENT, fog: true,
  });
  material.uniforms.uAtlas.value = paintInteriorAtlas();
  return material;
}

// 分節玻璃四邊形；corners 依 [左下, 右下, 右上, 左上]，u 沿牆面切線方向。
export function createInteriorBuffer() {
  const position = [], normal = [], uv = [], room = [];
  const UV = [[0, 0], [1, 0], [1, 1], [0, 1]]; // u: 0=起點 1=終點
  return {
    // room = { type, width, from, to }：u 以公尺記錄分節在整間店內的位置。
    add(corners, n, { type, width, from, to }, mirror) {
      for (const i of [0, 1, 2, 0, 2, 3]) {
        const p = corners[i];
        position.push(p.x, p.y, p.z);
        normal.push(n.x, n.y, n.z);
        uv.push(UV[i][0] ? to : from, UV[i][1]);
        room.push(width, INTERIOR_TYPES.indexOf(type), mirror ? 1 : 0, 0);
      }
    },
    finish(material) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
      geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normal, 3));
      geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      geometry.setAttribute('aRoom', new THREE.Float32BufferAttribute(room, 4));
      geometry.computeBoundingSphere();
      return new THREE.Mesh(geometry, material);
    },
    get count() { return position.length / 18; },
  };
}
