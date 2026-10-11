// 道路標線與路緣（純資料，回傳三角形頂點）；依 2019 銀座通り實照：白色車道線、淺灰花崗岩路緣。
import { segmentDistance } from './decor-layout.js';

export const PAIRED = 'estimated-from-paired-carriageway';
const CURB_WIDTH = 0.3;

/** 主要幹道：寬度 ≥ 11m，或上下行分開繪製的單向車道群（每條約 6–9m，仍為多車道）。 */
export function isMajorRoad(road) {
  return road.width >= 11 || road.widthStatus === PAIRED;
}

function pushQuad(buf, quad, y) {
  for (const k of [0, 1, 2, 0, 2, 3]) buf.push(quad[k][0], y, quad[k][1]);
}

/**
 * 上下行分開路段只在外側（人行道側）畫路緣；內側為對向車道，不畫。
 * @returns {number[]} 平面三角形頂點 [x, y, z, ...]
 */
export function curbTriangles(roads, y = 0.038) {
  const paired = roads.filter((r) => r.widthStatus === PAIRED);
  const buf = [];
  for (const road of paired) {
    const others = paired.filter((o) => o !== road);
    for (let i = 1; i < road.points.length; i++) {
      const [ax, az] = road.points[i - 1], [bx, bz] = road.points[i];
      const length = Math.hypot(bx - ax, bz - az);
      if (length < 0.01) continue;
      const nx = -(bz - az) / length, nz = (bx - ax) / length;
      const mx = (ax + bx) / 2, mz = (az + bz) / 2;
      for (const side of [-1, 1]) {
        const edge = road.width / 2 + CURB_WIDTH / 2;
        const px = mx + nx * side * (edge + 0.6), pz = mz + nz * side * (edge + 0.6);
        // 外推點落在對向車道內 → 此側為中線。
        if (others.some((o) => o.points.slice(1).some((q, j) => segmentDistance(px, pz, o.points[j], q) < o.width / 2))) continue;
        const inner = edge - CURB_WIDTH / 2, outer = edge + CURB_WIDTH / 2;
        pushQuad(buf, side > 0
          ? [[ax + nx * outer, az + nz * outer], [bx + nx * outer, bz + nz * outer], [bx + nx * inner, bz + nz * inner], [ax + nx * inner, az + nz * inner]]
          : [[ax - nx * inner, az - nz * inner], [bx - nx * inner, bz - nz * inner], [bx - nx * outer, bz - nz * outer], [ax - nx * outer, az - nz * outer]], y);
      }
    }
  }
  return buf;
}
