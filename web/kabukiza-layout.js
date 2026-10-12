// 歌舞伎座正面配置（純資料）：從 OSM 輪廓與晴海通り方向推出正面、中央凹入玄關與右側低翼。
import { KABUKIZA } from './photo-reference.js';
import { segmentDistance } from './decor-layout.js';

const MAIN_TOLERANCE = 3; // 與最前緣相差 3 m 內視為正面
const RECESS_MIN = 1; // 凹入超過 1 m 視為玄關凹部
const WING_DEPTH = 12; // 右翼最多後退 12 m

function nearestSegment(roads, name, x, z) {
  let best = null, bestD = Infinity;
  for (const r of roads) {
    if (r.name !== name || r.crossing) continue;
    for (let i = 1; i < r.points.length; i++) {
      const d = segmentDistance(x, z, r.points[i - 1], r.points[i]);
      if (d < bestD) { bestD = d; best = [r.points[i - 1], r.points[i]]; }
    }
  }
  return best;
}

/**
 * @returns {null | {origin:number[], u:number[], n:number[], width:number,
 *   recess:{x0:number, x1:number, depth:number}, wing:null|{x0:number, x1:number, setback:number}, source:string}}
 * 局部座標：x 沿正面（u），z 朝街道（n），原點在正面左端最前緣。
 */
export function planKabukiza(buildings, roads) {
  const b = buildings.find((v) => v.id === KABUKIZA.osmId || v.name === KABUKIZA.building);
  if (!b) return null;
  const ring = b.outers[0];
  const cx = ring.reduce((s, p) => s + p[0], 0) / ring.length;
  const cz = ring.reduce((s, p) => s + p[1], 0) / ring.length;
  const seg = nearestSegment(roads, KABUKIZA.street, cx, cz);
  if (!seg) return null;
  const len = Math.hypot(seg[1][0] - seg[0][0], seg[1][1] - seg[0][1]) || 1;
  let u = [(seg[1][0] - seg[0][0]) / len, (seg[1][1] - seg[0][1]) / len];
  let n = [-u[1], u[0]];
  const mid = [(seg[0][0] + seg[1][0]) / 2, (seg[0][1] + seg[1][1]) / 2];
  if ((mid[0] - cx) * n[0] + (mid[1] - cz) * n[1] < 0) { u = [-u[0], -u[1]]; n = [-n[0], -n[1]]; }
  const pts = ring.map(([x, z]) => ({ s: (x - cx) * u[0] + (z - cz) * u[1], d: (x - cx) * n[0] + (z - cz) * n[1] }));
  const front = Math.max(...pts.map((p) => p.d));
  const main = pts.filter((p) => p.d >= front - MAIN_TOLERANCE);
  const s0 = Math.min(...main.map((p) => p.s)), s1 = Math.max(...main.map((p) => p.s));
  const deep = main.filter((p) => p.d < front - RECESS_MIN);
  const recess = deep.length >= 2
    ? { x0: Math.min(...deep.map((p) => p.s)) - s0, x1: Math.max(...deep.map((p) => p.s)) - s0, depth: front - Math.min(...deep.map((p) => p.d)) }
    : { x0: (s1 - s0) * 0.375, x1: (s1 - s0) * 0.625, depth: 0 };
  const wingPts = pts.filter((p) => p.s > s1 + 0.5 && p.d >= front - WING_DEPTH && p.d < front - MAIN_TOLERANCE);
  const wing = wingPts.length
    ? { x0: s1 - s0, x1: Math.max(...wingPts.map((p) => p.s)) - s0, setback: front - Math.max(...wingPts.map((p) => p.d)) }
    : null;
  return {
    origin: [cx + u[0] * s0 + n[0] * front, cz + u[1] * s0 + n[1] * front],
    u, n, width: s1 - s0, recess, wing, source: KABUKIZA.source,
  };
}
