import { segmentDistance } from './decor-layout.js';

// 中央通り的預設寬度包含步道時，以鄰近平行 OSM 步道估算車道邊界。
// 不移動中心線；只收窄明顯覆蓋步道的預設 22m 路段，保留原始資料。
export function fitCentralRoads(roads) {
  const walks = roads.filter((r) => r.kind === 'footway' && !r.crossing).flatMap((r) =>
    r.points.slice(1).map((b, i) => ({ a: r.points[i], b, width: r.width })));
  return roads.map((r) => {
    if (r.name !== '中央通り' || r.kind !== 'trunk' || r.width !== 22 || r.widthSource !== 'estimated') return r;
    let half = 11;
    r.points.slice(1).forEach((b, i) => {
      const a = r.points[i], length = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (length < 0.01) return;
      const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
      for (const walk of walks) {
        const wx = walk.b[0] - walk.a[0], wz = walk.b[1] - walk.a[1], wl = Math.hypot(wx, wz);
        if (wl < 5 || Math.abs((wx * (b[0] - a[0]) + wz * (b[1] - a[1])) / (wl * length)) < 0.96) continue;
        const distance = segmentDistance(mx, mz, walk.a, walk.b);
        if (distance < 7 || distance > 15) continue;
        half = Math.min(half, Math.max(7, distance - walk.width / 2 - 1.4));
      }
    });
    // 保留整條原始折線與端點，不拆短段，避免改變人車路網連通性。
    return { ...r, width: half * 2, widthStatus: 'estimated-from-osm-footways' };
  });
}
