// 街道小物配置（純資料）；不佔車道、人行道或地標既有觀賞點。
import { createCollider } from './collision.js';
import { BED } from './flowerbeds.js';

export function segmentDistance(x, z, a, b) {
  const dx = b[0] - a[0], dz = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t);
}

export function planDecor(city, roads) {
  const collider = createCollider(city.buildings, city.bounds);
  const views = city.landmarks.map((l) => collider.viewpointFor(l.target, l.id, l.height, 0.35)).filter(Boolean);
  const corridors = roads.flatMap((r) => r.points.slice(1).map((b, i) => ({ a: r.points[i], b, width: r.width })));
  const items = [];
  for (const item of city.streetFurniture || []) {
    const { x, z, type, source, positionStatus } = item;
    if (positionStatus !== 'verified' || typeof source !== 'string' || !source.startsWith('https://')) continue;
    if (!Number.isFinite(x) || !Number.isFinite(z) || !['tree', 'lamp'].includes(type)) continue;
    const radius = type === 'tree' ? BED.radius : 0.25;
    if (collider.blockedCircle(x, z, type === 'tree' ? 2.0 : 0.6)) continue;
    if (views.some(([vx, vz]) => Math.hypot(x - vx, z - vz) < 3)) continue;
    if (items.some((p) => Math.hypot(x - p.x, z - p.z) < p.radius + radius + 0.5)) continue;
    if (corridors.some((c) => segmentDistance(x, z, c.a, c.b) < c.width / 2 + radius + 0.25)) continue;
    items.push({ x, z, type, radius, source, positionStatus });
  }
  // 官方確認中央通り有桂樹和樹下植栽；逐株座標未取得，以下明確為近似布局。
  const main = roads.filter((r) => r.name === '中央通り' && !r.crossing && !['footway', 'path', 'pedestrian', 'steps'].includes(r.kind));
  const crossing = roads.filter((r) => r.crossing);
  const vehicles = roads.filter((r) => !r.crossing && !['footway', 'path', 'pedestrian', 'steps', 'cycleway'].includes(r.kind));
  const walking = roads.filter((r) => !r.crossing && ['footway', 'path', 'pedestrian', 'steps'].includes(r.kind));
  const near = (list, x, z, clearance) => list.some((r) => r.points.slice(1).some((b, i) => segmentDistance(x, z, r.points[i], b) < clearance(r)));
  for (const road of main) {
    let carry = 9;
    for (let i = 1; i < road.points.length; i++) {
      const a = road.points[i - 1], b = road.points[i];
      const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (length < 0.01) continue;
      const dx = (b[0] - a[0]) / length, dz = (b[1] - a[1]) / length;
      for (let s = carry; s < length; s += 18) for (const side of [-1, 1]) {
        for (const margin of [1.1, 1.8, 2.5, 3.2, 4.0]) {
          const offset = side * (road.width / 2 + margin);
          const x = a[0] + dx * s - dz * offset, z = a[1] + dz * s + dx * offset;
          const radius = BED.radius;
          if (collider.blockedCircle(x, z, 1.9)) continue;
          if (Math.hypot(x, z) < 24 || views.some(([vx, vz]) => Math.hypot(x - vx, z - vz) < 4)) continue;
          if (items.some((p) => Math.hypot(x - p.x, z - p.z) < 12)) continue;
          if (near(vehicles, x, z, (r) => r.width / 2 + radius + 0.2)) continue;
          if (near(crossing, x, z, () => 7)) continue;
          // 保留步道中央至少 1.2m 淨通道；樹池只佔邊緣，不放在行進中心線。
          if (near(walking, x, z, () => radius + 0.6)) continue;
          // OSM 店家招牌點近似入口範圍，額外保留門前空隙。
          if ((city.signs || []).some((p) => p.kind !== 'crown' && Math.hypot(x - p.x, z - p.z) < 3.5)) continue;
          items.push({ x, z, type: 'tree', radius, heading: Math.atan2(dx, dz),
            zone: (z > 0 ? 2 : 0) + (x > a[0] + dx * s ? 0 : 1),
            source: 'https://www.ginza.jp/topics/16958', positionStatus: 'approximate' });
          break;
        }
      }
      carry = ((carry - length) % 18 + 18) % 18;
    }
  }
  return items;
}
