// 天空與光線：以東京緯度、當天日期近似計算太陽位置，並依高度角調整天色與夜間窗光。
import * as THREE from 'three';

const LAT = 35.6712;
const LON = 139.7655;
const TZ_MERIDIAN = 135; // JST 標準經線

/** 回傳太陽方向（世界座標：x 東、y 上、z 南）與高度角（度）。忽略均時差，屬近似值。 */
export function sunDirection(hour, date = new Date()) {
  const start = Date.UTC(date.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) - start) / 86400000);
  const decl = THREE.MathUtils.degToRad(23.44 * Math.sin(((2 * Math.PI) / 365) * (dayOfYear - 81)));
  const solarHour = hour + (LON - TZ_MERIDIAN) / 15;
  const hourAngle = THREE.MathUtils.degToRad((solarHour - 12) * 15);
  const lat = THREE.MathUtils.degToRad(LAT);
  const sinEl = Math.sin(lat) * Math.sin(decl) + Math.cos(lat) * Math.cos(decl) * Math.cos(hourAngle);
  const el = Math.asin(sinEl);
  // 方位角：由北順時針
  const az = Math.atan2(Math.sin(hourAngle), Math.cos(hourAngle) * Math.sin(lat) - Math.tan(decl) * Math.cos(lat)) + Math.PI;
  const dir = new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el));
  return { dir, elevation: THREE.MathUtils.radToDeg(el) };
}

const SKY_VERTEX = `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 p = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * p;
  gl_Position.z = gl_Position.w; // 永遠在最遠處
}`;
const SKY_FRAGMENT = `
uniform vec3 top; uniform vec3 horizon; uniform vec3 sunDir; uniform vec3 sunColor; uniform float glow;
varying vec3 vDir;
void main() {
  float h = clamp(vDir.y, 0.0, 1.0);
  vec3 col = mix(horizon, top, pow(h, 0.55));
  float s = max(dot(normalize(vDir), normalize(sunDir)), 0.0);
  col += sunColor * (pow(s, 600.0) * 3.0 + pow(s, 12.0) * 0.35 * glow);
  // 遠處柔軟的雲帶；球面方向取樣，轉動鏡頭時保持穩定。
  vec3 d = normalize(vDir);
  float clouds = 0.0;
  for (int i = 0; i < 7; i++) {
    float a = float(i) * 0.897 + 0.25;
    vec3 center = normalize(vec3(sin(a), 0.3 + 0.08 * sin(a * 3.0), cos(a)));
    vec3 side = vec3(cos(a), 0.0, -sin(a));
    float puff = smoothstep(0.988, 0.998, dot(d, center));
    puff = max(puff, smoothstep(0.992, 0.999, dot(d, normalize(center + side * 0.13 - vec3(0.0, 0.03, 0.0)))));
    puff = max(puff, smoothstep(0.992, 0.999, dot(d, normalize(center - side * 0.12 - vec3(0.0, 0.04, 0.0)))));
    clouds = max(clouds, puff);
  }
  float mask = clouds * glow * 0.65;
  col = mix(col, mix(horizon, vec3(1.0, 0.96, 0.88), 0.7), mask);
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export function createSky() {
  const uniforms = {
    top: { value: new THREE.Color() }, horizon: { value: new THREE.Color() },
    sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunColor: { value: new THREE.Color() }, glow: { value: 1 },
  };
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(5000, 32, 16),
    new THREE.ShaderMaterial({ uniforms, vertexShader: SKY_VERTEX, fragmentShader: SKY_FRAGMENT, side: THREE.BackSide, depthWrite: false, fog: false }),
  );
  mesh.frustumCulled = false;
  return { mesh, uniforms };
}

// 依太陽高度角內插的天色關鍵影格
const KEYS = [
  { el: -12, top: '#070a16', horizon: '#2a2630', sun: '#000000', light: 0, hemi: 0.5, windows: 0.85, label: '夜晚' },
  { el: -3, top: '#141c3a', horizon: '#c0607a', sun: '#ff7a4a', light: 0, hemi: 0.75, windows: 0.7, label: '暮色' },
  { el: 4, top: '#739abf', horizon: '#ffd4a0', sun: '#ffbd85', light: 1.5, hemi: 1.6, windows: 0.5, label: '斜陽' },
  { el: 20, top: '#66b5dc', horizon: '#e7eff0', sun: '#ffe3b0', light: 2.4, hemi: 2.0, windows: 0, label: '午後日光' },
  { el: 60, top: '#58add9', horizon: '#e0f0f2', sun: '#fff0d5', light: 2.7, hemi: 2.2, windows: 0, label: '正午' },
];

function sample(elevation) {
  const e = THREE.MathUtils.clamp(elevation, KEYS[0].el, KEYS.at(-1).el);
  let i = 0;
  while (i < KEYS.length - 2 && e > KEYS[i + 1].el) i++;
  const a = KEYS[i], b = KEYS[i + 1];
  const t = (e - a.el) / (b.el - a.el);
  const mix = (x, y) => new THREE.Color(x).lerp(new THREE.Color(y), t);
  return {
    top: mix(a.top, b.top), horizon: mix(a.horizon, b.horizon), sun: mix(a.sun, b.sun),
    light: THREE.MathUtils.lerp(a.light, b.light, t), hemi: THREE.MathUtils.lerp(a.hemi, b.hemi, t),
    windows: THREE.MathUtils.lerp(a.windows, b.windows, t), label: t < 0.5 ? a.label : b.label,
  };
}

/** 套用時間到場景；回傳顯示用標籤。 */
export function applyTime(hour, { sky, sun, hemi, scene, wallMaterial, referenceMaterials = [] }) {
  const { dir, elevation } = sunDirection(hour);
  const look = sample(elevation);
  sky.uniforms.top.value.copy(look.top);
  sky.uniforms.horizon.value.copy(look.horizon);
  sky.uniforms.sunDir.value.copy(dir);
  sky.uniforms.sunColor.value.copy(look.sun);
  sky.uniforms.glow.value = elevation > -4 ? 1 : 0;
  sun.color.copy(look.sun);
  sun.intensity = look.light;
  sun.userData.dir = dir;
  hemi.intensity = look.hemi;
  hemi.color.copy(look.top).lerp(new THREE.Color('#ffffff'), 0.5);
  hemi.groundColor.copy(look.horizon).multiplyScalar(0.5);
  scene.fog.color.copy(look.horizon);
  // 普通窗格退為背景，燈箱與櫥窗保持獨立較亮的夜景層次。
  wallMaterial.emissiveIntensity = look.windows * 0.32;
  for (const material of referenceMaterials) material.emissiveIntensity = look.windows * (material.userData.nightGain ?? 0.65);
  return { label: look.label, elevation, night: Math.min(1, look.windows / 0.85) };
}
