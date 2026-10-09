import { createCollider } from './collision.js';
import { segmentDistance } from './decor-layout.js';

export const LAMP_REFERENCE = 'https://www.ktr.mlit.go.jp/toukoku/toukoku00045.html';
const WALK_KINDS = new Set(['footway', 'path', 'pedestrian', 'steps', 'cycleway']);
const LAMP_SPACING = 26; // 2015 照明探偵團調查為約 25–27m；不是逐柱坐標。

/** 照片參考外形 + OSM 道路近似布局；不更動原始道路及建築資料。 */
export function planInfrastructure(city, roads, obstacles = []) {
  const collider = createCollider(city.buildings, city.bounds);
  const views = city.landmarks.map((l) => collider.viewpointFor(l.target, l.id, l.height, 0.35)).filter(Boolean);
  const vehicles = roads.filter((r) => !r.crossing && !WALK_KINDS.has(r.kind));
  const walks = roads.filter((r) => !r.crossing && WALK_KINDS.has(r.kind));
  const main = vehicles.filter((r) => r.name === '中央通り');
  const crossings = roads.filter((r) => r.crossing && r.marked);
  const distanceTo = (r, x, z) => Math.min(...r.points.slice(1).map((b, i) => segmentDistance(x, z, r.points[i], b)));
  // 局部陣列增量收集避免反覆複製；輸入保持不變。
  const items = [];
  function clear(x, z, type, heading) {
    const radius = 0.22;
    if (collider.blockedCircle(x, z, 0.5)) return false;
    if (views.some(([vx, vz]) => Math.hypot(x - vx, z - vz) < 2)) return false;
    if ([...obstacles, ...items].some((p) => Math.hypot(x - p.x, z - p.z) < p.radius + radius + 0.7)) return false;
    if (vehicles.some((r) => distanceTo(r, x, z) < r.width / 2 + radius + 0.2)) return false;
    if (walks.some((r) => distanceTo(r, x, z) < radius + 0.6)) return false;
    if (crossings.some((r) => distanceTo(r, x, z) < (type === 'lamp' ? 4 : r.width / 2 + radius + 0.4))) return false;
    if ((city.signs || []).some((p) => p.kind !== 'crown' && Math.hypot(x - p.x, z - p.z) < 1.5)) return false;
    // 不只檢查柱腳：低燈臂可能穿入店面，信號橫臂也需整段避讓建築。
    const armEnds = type === 'lamp' ? [-1.65, 1.65] : [3.2];
    for (const end of armEnds) for (let step = 1; step <= 8; step++) {
      const reach = end * step / 8;
      const ax = x + reach * Math.cos(heading), az = z - reach * Math.sin(heading);
      if (collider.blockedCircle(ax, az, 0.3)) return false;
      if (type === 'lamp' && obstacles.some((p) => p.type === 'tree' && Math.hypot(ax - p.x, az - p.z) < 1.6)) return false;
    }
    return true;
  }
  function add(type, x, z, heading, source) {
    items.push({ type, x, z, heading, radius: 0.22, source, positionStatus: 'approximate' });
  }
  for (const road of main) {
    let carry = 13;
    for (let i = 1; i < road.points.length; i++) {
      const a = road.points[i - 1], b = road.points[i];
      const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (length < 0.01) continue;
      const dx = (b[0] - a[0]) / length, dz = (b[1] - a[1]) / length;
      for (let s = carry; s < length; s += LAMP_SPACING) for (const side of [-1, 1]) {
        for (const margin of [0.8, 1.4, 2.0, 2.6, 3.2]) {
          const offset = side * (road.width / 2 + margin);
          const x = a[0] + dx * s - dz * offset, z = a[1] + dz * s + dx * offset;
          const heading = Math.atan2(side * dx, side * dz);
          if (!clear(x, z, 'lamp', heading) || items.some((p) => p.type === 'lamp' && Math.hypot(x - p.x, z - p.z) < 18)) continue;
          // local +x 指向車道，高燈臂在車道側，低燈臂在步道側。
          add('lamp', x, z, heading, LAMP_REFERENCE);
          break;
        }
      }
      carry = ((carry - length) % LAMP_SPACING + LAMP_SPACING) % LAMP_SPACING;
    }
  }
  // 僅在中央通り附近的長標線過街兩端放置示意信號柱。
  // OSM 未包含交通信號逐柱資料，不能把每条過街線都稱為已核實信號路口。
  for (const crossing of crossings) {
    const a = crossing.points[0], b = crossing.points.at(-1);
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (length < 8 || !main.some((r) => distanceTo(r, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2) < r.width / 2 + 3)) continue;
    const dx = (b[0] - a[0]) / length, dz = (b[1] - a[1]) / length;
    for (const [end, inward] of [[a, 1], [b, -1]]) {
      let placed = false;
      for (const outward of [0.7, 1.4, 2.2, 3.0]) {
        for (const shift of [-2.8, 2.8, -4, 4]) {
          const x = end[0] - inward * dx * outward - dz * shift;
          const z = end[1] - inward * dz * outward + dx * shift;
          const heading = Math.atan2(-inward * dz, inward * dx);
          if (!clear(x, z, 'signal', heading) || items.some((p) => p.type === 'signal' && Math.hypot(x - p.x, z - p.z) < 7)) continue;
          add('signal', x, z, heading, LAMP_REFERENCE);
          placed = true; break;
        }
        if (placed) break;
      }
    }
  }
  return items;
}
