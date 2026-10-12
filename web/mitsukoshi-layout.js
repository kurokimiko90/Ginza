// 銀座三越分棟（純資料）：OSM 只有一個輪廓，依鹿島設計斷面圖把中央通り側切成本館、三原通り側為新館。
import { MITSUKOSHI } from './photo-reference.js';
import { segmentDistance } from './decor-layout.js';

const EPS = 1e-6;

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

/** Sutherland–Hodgman：保留 depth(p) >= limit（keepFront）或 <= limit 的部分。 */
function clipRing(ring, depthOf, limit, keepFront) {
  const inside = (p) => (keepFront ? depthOf(p) >= limit - EPS : depthOf(p) <= limit + EPS);
  const out = [];
  ring.forEach((a, i) => {
    const b = ring[(i + 1) % ring.length];
    const ia = inside(a), ib = inside(b);
    if (ia) out.push(a);
    if (ia !== ib) {
      const t = (limit - depthOf(a)) / (depthOf(b) - depthOf(a));
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  });
  return out;
}

/**
 * @returns {null | {main:number[][], annex:number[][], u:number[], n:number[],
 *   cut:{a:number[], b:number[]}, source:string}}
 * n 指向中央通り；cut 是本館與新館的分界線（新館朝本館屋頂的立面）。
 */
export function splitMitsukoshi(building, roads) {
  if (!building || !roads?.length) return null;
  const ring = building.outers[0];
  const cx = ring.reduce((s, p) => s + p[0], 0) / ring.length;
  const cz = ring.reduce((s, p) => s + p[1], 0) / ring.length;
  const seg = nearestSegment(roads, MITSUKOSHI.street, cx, cz);
  if (!seg) return null;
  const len = Math.hypot(seg[1][0] - seg[0][0], seg[1][1] - seg[0][1]) || 1;
  let u = [(seg[1][0] - seg[0][0]) / len, (seg[1][1] - seg[0][1]) / len];
  let n = [-u[1], u[0]];
  const mid = [(seg[0][0] + seg[1][0]) / 2, (seg[0][1] + seg[1][1]) / 2];
  if ((mid[0] - cx) * n[0] + (mid[1] - cz) * n[1] < 0) { u = [-u[0], -u[1]]; n = [-n[0], -n[1]]; }
  const depthOf = ([x, z]) => x * n[0] + z * n[1];
  const depths = ring.map(depthOf);
  const front = Math.max(...depths), back = Math.min(...depths);
  const limit = front - (front - back) * MITSUKOSHI.mainDepthRatio;
  const main = clipRing(ring, depthOf, limit, true), annex = clipRing(ring, depthOf, limit, false);
  if (main.length < 3 || annex.length < 3) return null;
  const onCut = annex.filter((p) => Math.abs(depthOf(p) - limit) < 1e-4);
  const along = (p) => p[0] * u[0] + p[1] * u[1];
  onCut.sort((p, q) => along(p) - along(q));
  return { main, annex, u, n, cut: { a: onCut[0], b: onCut[onCut.length - 1] }, source: MITSUKOSHI.source };
}
