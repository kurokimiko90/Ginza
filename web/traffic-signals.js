// 信號週期與停止線（純資料，可在 Node 測試）。
// 全城共用同一週期，不是實際各路口的配時；只控制已放置示意信號柱的過街線。

/** 週期（秒）：中央通り方向青→黃→全紅→側街方向青→黃→全紅。 */
export const CYCLE = Object.freeze({ mainGreen: 34, yellow: 3, allRed: 3, sideGreen: 20 });
export const CYCLE_LENGTH = (CYCLE.mainGreen + CYCLE.yellow + CYCLE.allRed) + (CYCLE.sideGreen + CYCLE.yellow + CYCLE.allRed);
const WALK_FLASH = 5; // 行人青燈在對應車流綠燈最後 5 秒閃爍
const POLE_REACH = 6; // 信號柱離過街線端點的最大距離（見 infrastructure-layout 的 outward/shift）
const CAR_GAP = 6.5; // 同一路段前後車最小車頭間距（m）
const BRAKE = 3.5; // 減速度 m/s²
const ACCEL = 2.2; // 起步加速度 m/s²

const mod = (t, n) => ((t % n) + n) % n;

/** @param {number} t 秒 @returns {{main: string, side: string}} 各方向車用燈色 */
export function vehiclePhase(t) {
  const x = mod(t, CYCLE_LENGTH);
  const half = CYCLE.mainGreen + CYCLE.yellow + CYCLE.allRed;
  const light = (local, green) => (local < green ? 'green' : local < green + CYCLE.yellow ? 'yellow' : 'red');
  return x < half
    ? { main: light(x, CYCLE.mainGreen), side: 'red' }
    : { main: 'red', side: light(x - half, CYCLE.sideGreen) };
}

/**
 * 過街線的行人燈：與被橫越道路的車流相反方向同時放行。
 * @param {'main'|'side'} vehicleAxis 被橫越道路的方向
 * @returns {'walk'|'flash'|'stop'}
 */
export function walkState(vehicleAxis, t) {
  const other = vehicleAxis === 'main' ? 'side' : 'main';
  const half = CYCLE.mainGreen + CYCLE.yellow + CYCLE.allRed;
  const x = mod(t, CYCLE_LENGTH);
  const local = other === 'main' ? x : x - half;
  const green = other === 'main' ? CYCLE.mainGreen : CYCLE.sideGreen;
  if (local < 0 || local >= green) return 'stop';
  return local < green - WALK_FLASH ? 'walk' : 'flash';
}

/** 中央通り的整體走向（單位向量，以雙倍角平均避免正反方向互相抵銷）。 */
export function mainAxis(roads) {
  let c = 0, s = 0;
  for (const r of roads) {
    if (r.name !== '中央通り' || r.crossing) continue;
    for (let i = 1; i < r.points.length; i++) {
      const dx = r.points[i][0] - r.points[i - 1][0], dz = r.points[i][1] - r.points[i - 1][1];
      const len = Math.hypot(dx, dz), a = Math.atan2(dz, dx) * 2;
      c += Math.cos(a) * len; s += Math.sin(a) * len;
    }
  }
  if (!c && !s) return [1, 0];
  const a = Math.atan2(s, c) / 2;
  return [Math.cos(a), Math.sin(a)];
}

/** 方向 (dx,dz) 與主軸平行為 'main'，否則 'side'。 */
export function axisOf(dx, dz, axis) {
  const len = Math.hypot(dx, dz) || 1;
  return Math.abs((dx * axis[0] + dz * axis[1]) / len) >= Math.SQRT1_2 ? 'main' : 'side';
}

/**
 * 有信號柱的過街線 → 被橫越車流方向；信號柱 → 所屬過街線方向。
 * @returns {{crossings: Array<{points, width, vehicleAxis}>, poleAxes: string[]}}
 */
export function planSignals(roads, items) {
  const axis = mainAxis(roads);
  const poles = items.filter((p) => p.type === 'signal');
  const near = (p, end) => Math.hypot(p.x - end[0], p.z - end[1]) <= POLE_REACH;
  const crossings = roads
    .filter((r) => r.crossing && r.marked && r.points.length >= 2)
    .filter((r) => poles.some((p) => near(p, r.points[0]) || near(p, r.points.at(-1))))
    .map((r) => {
      const a = r.points[0], b = r.points.at(-1);
      // 過街線與車流垂直：過街方向屬 main → 被橫越的是側街車流
      const vehicleAxis = axisOf(b[0] - a[0], b[1] - a[1], axis) === 'main' ? 'side' : 'main';
      return { points: r.points, width: r.width || 4, vehicleAxis };
    });
  const poleAxes = poles.map((p) => {
    let best = null, bestD = Infinity;
    for (const c of crossings) for (const end of [c.points[0], c.points.at(-1)]) {
      const d = Math.hypot(p.x - end[0], p.z - end[1]);
      if (d < bestD) { bestD = d; best = c; }
    }
    return best ? best.vehicleAxis : 'main';
  });
  return { crossings, poleAxes };
}

// 線段 p1→p2 與 q1→q2 交點在 p 上的比例；q 兩端各延長 ext 公尺以接住端點相接的情況
function intersect(p1, p2, q1, q2, ext) {
  const qx = q2[0] - q1[0], qz = q2[1] - q1[1], ql = Math.hypot(qx, qz) || 1;
  const a = [q1[0] - (qx / ql) * ext, q1[1] - (qz / ql) * ext], b = [q2[0] + (qx / ql) * ext, q2[1] + (qz / ql) * ext];
  const rx = p2[0] - p1[0], rz = p2[1] - p1[1], sx = b[0] - a[0], sz = b[1] - a[1];
  const den = rx * sz - rz * sx;
  if (Math.abs(den) < 1e-9) return null;
  const t = ((a[0] - p1[0]) * sz - (a[1] - p1[1]) * sx) / den;
  const u = ((a[0] - p1[0]) * rz - (a[1] - p1[1]) * rx) / den;
  return t >= -1e-6 && t <= 1 + 1e-6 && u >= 0 && u <= 1 ? t : null;
}

/**
 * 車道折線上的停止位置（沿線距離），停在過街線前 width/2 + 1.5 m。
 * @param {number[][]} points 車道折線
 * @param {number[]} cum 累積距離
 */
export function stopsOnPath(points, cum, crossings) {
  const stops = [];
  for (const c of crossings) {
    for (let i = 1; i < points.length; i++) {
      const t = intersect(points[i - 1], points[i], c.points[0], c.points.at(-1), 1);
      if (t === null) continue;
      const at = cum[i - 1] + (cum[i] - cum[i - 1]) * t;
      if (!stops.some((s) => Math.abs(s.at - at) < 1)) stops.push({ at, clearance: c.width / 2 + 1.5, vehicleAxis: c.vehicleAxis });
      break;
    }
  }
  return stops.sort((a, b) => a.at - b.at);
}

/**
 * 前方最近且需停車的停止線距離（沿行進方向）；無則 Infinity。
 * 黃燈且已近停止線（< 8 m）時視為可通過。
 */
export function distanceToStop(stops, length, s, dir, t) {
  const phase = vehiclePhase(t);
  let best = Infinity;
  for (const stop of stops) {
    const line = (dir > 0 ? stop.at : length - stop.at) - stop.clearance;
    const gap = line - s;
    if (gap < -0.5) continue; // 已越過停止線
    const light = phase[stop.vehicleAxis];
    if (light === 'green' || (light === 'yellow' && gap < 8)) continue;
    best = Math.min(best, Math.max(0, gap));
  }
  return best;
}

/** 同一路段同方向的前車：回傳 Map(agent → 可前進的最大距離)。不跨路段追蹤。 */
export function leaderGaps(agents) {
  const lanes = new Map();
  for (const agent of agents) {
    const key = agent.seg * 2 + (agent.dir > 0 ? 1 : 0);
    if (!lanes.has(key)) lanes.set(key, []);
    lanes.get(key).push(agent);
  }
  const gaps = new Map();
  for (const lane of lanes.values()) {
    const sorted = [...lane].sort((a, b) => b.s - a.s);
    sorted.forEach((agent, i) => gaps.set(agent, i ? sorted[i - 1].s - CAR_GAP - agent.s : Infinity));
  }
  return gaps;
}

/**
 * 一台車這一幀的新速度與前進距離。以可停止距離限速 v ≤ √(2·a·d)，平順減速到停止線或前車後方。
 * @param {{s:number, dir:number, v:number, speed:number}} agent
 * @param {{stops:Array, length:number}} seg
 */
export function carStep(agent, seg, leaderGap, t, dt) {
  const room = Math.max(0, Math.min(leaderGap, distanceToStop(seg.stops || [], seg.length, agent.s, agent.dir, t)));
  const limit = Math.min(agent.speed, Math.sqrt(2 * BRAKE * room));
  const v = Math.min(limit, agent.v + ACCEL * dt);
  return { v, distance: Math.min(v * dt, room) };
}
