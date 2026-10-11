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
    // 上下行分開繪製的路段：兩條中心線各是單向車道群中心，車道群在中線相接，
    // 每條寬度不應超過與對向中心線的間距，否則兩條重疊、吃掉人行道。
    const separation = pairedSeparation(r, roads);
    if (separation) return { ...r, width: separation, widthStatus: 'estimated-from-paired-carriageway' };
    // 保留整條原始折線與端點，不拆短段，避免改變人車路網連通性。
    return { ...r, width: half * 2, widthStatus: 'estimated-from-osm-footways' };
  });
}

const PAIR_RANGE = [4, 12];

/** 與平行對向中央通り中心線的中位間距（公尺）；配對長度不足一半時回傳 null。 */
function pairedSeparation(road, roads) {
  const others = roads.filter((o) => o !== road && o.name === road.name && o.kind === road.kind && !o.crossing)
    .flatMap((o) => o.points.slice(1).map((b, i) => ({ a: o.points[i], b })));
  const samples = [];
  let total = 0;
  road.points.slice(1).forEach((b, i) => {
    const a = road.points[i], length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (length < 10) return;
    total += length;
    const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
    const distances = others.filter((o) => {
      const ol = Math.hypot(o.b[0] - o.a[0], o.b[1] - o.a[1]);
      return ol >= 5 && Math.abs(((o.b[0] - o.a[0]) * (b[0] - a[0]) + (o.b[1] - o.a[1]) * (b[1] - a[1])) / (ol * length)) >= 0.96;
    }).map((o) => segmentDistance(mx, mz, o.a, o.b)).filter((d) => d >= PAIR_RANGE[0] && d <= PAIR_RANGE[1]);
    if (distances.length) samples.push({ d: Math.min(...distances), length });
  });
  const paired = samples.reduce((sum, s) => sum + s.length, 0);
  if (!total || paired < total / 2) return null;
  const sorted = samples.map((s) => s.d).sort((x, y) => x - y);
  return Math.round(sorted[Math.floor(sorted.length / 2)] * 10) / 10;
}
