// 建築碰撞：以網格索引加速的點在多邊形判定。座標為 [x, z]，單位公尺。
const CELL = 24;

export function pointInRing(x, z, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, zi] = ring[i];
    const [xj, zj] = ring[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

function ringBox(ring) {
  let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
  for (const [x, z] of ring) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }
  return [minX, minZ, maxX, maxZ];
}

/**
 * @param {{outers: number[][][], holes?: number[][][], base?: number}[]} buildings
 * @param {number[]} bounds [minX, minZ, maxX, maxZ]
 */
export function createCollider(buildings, bounds, obstacles = []) {
  const grid = new Map();
  const solids = buildings
    .filter((b) => (b.base || 0) < 2) // 架空的部分（如騎樓上方）不擋路
    .flatMap((b) => b.outers.map((outer) => ({ id: b.id, outer, holes: b.holes || [], box: ringBox(outer) })));

  for (const solid of solids) {
    const [x0, z0, x1, z1] = solid.box;
    for (let cx = Math.floor(x0 / CELL); cx <= Math.floor(x1 / CELL); cx++) {
      for (let cz = Math.floor(z0 / CELL); cz <= Math.floor(z1 / CELL); cz++) {
        const key = `${cx},${cz}`;
        if (!grid.has(key)) grid.set(key, []);
        grid.get(key).push(solid);
      }
    }
  }

  // 回傳 (x, z) 所在建築的 id；不在建築內則為 null
  function buildingAt(x, z) {
    const cell = grid.get(`${Math.floor(x / CELL)},${Math.floor(z / CELL)}`);
    if (!cell) return null;
    const hit = cell.find(({ outer, holes, box }) =>
      x >= box[0] && x <= box[2] && z >= box[1] && z <= box[3] &&
      pointInRing(x, z, outer) && !holes.some((hole) => pointInRing(x, z, hole)));
    return hit ? hit.id : null;
  }

  function blocked(x, z) {
    if (x <= bounds[0] || z <= bounds[1] || x >= bounds[2] || z >= bounds[3]) return true;
    return buildingAt(x, z) !== null || obstacles.some((p) => insideObstacle(p, x, z));
  }

  // 有 halfWidth/halfLength 的長條花壇按實際朝向判定；其餘小物維持方形半徑。
  function insideObstacle(p, x, z) {
    if (!p.halfWidth || !p.halfLength) return Math.abs(x - p.x) <= p.radius && Math.abs(z - p.z) <= p.radius;
    const c = Math.cos(p.heading || 0), s = Math.sin(p.heading || 0), dx = x - p.x, dz = z - p.z;
    return Math.abs(dx * c - dz * s) <= p.halfWidth && Math.abs(dx * s + dz * c) <= p.halfLength;
  }

  // 以圓周 8 點近似玩家半徑
  function blockedCircle(x, z, radius) {
    if (blocked(x, z)) return true;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      if (blocked(x + Math.cos(a) * radius, z + Math.sin(a) * radius)) return true;
    }
    return false;
  }

  // 嘗試移動；被擋時分別沿 x、z 軸滑動
  function move(x, z, dx, dz, radius) {
    if (!blockedCircle(x + dx, z + dz, radius)) return [x + dx, z + dz];
    if (!blockedCircle(x + dx, z, radius)) return [x + dx, z];
    if (!blockedCircle(x, z + dz, radius)) return [x, z + dz];
    return [x, z];
  }

  // 從 (x, z) 往外螺旋搜尋最近的可站立點
  function nearestFree(x, z, radius, maxDistance = 160) {
    if (!blockedCircle(x, z, radius)) return [x, z];
    for (let d = 4; d <= maxDistance; d += 4) {
      const steps = Math.max(12, Math.round(d));
      for (let i = 0; i < steps; i++) {
        const a = (i / steps) * Math.PI * 2;
        const px = x + Math.cos(a) * d;
        const pz = z + Math.sin(a) * d;
        if (!blockedCircle(px, pz, radius)) return [px, pz];
      }
    }
    return null;
  }

  /**
   * 找一個能看見目標建築的街道位置：從候選點沿視線前進，第一個撞到的必須是目標本身，
   * 並挑選無遮擋距離最接近理想觀賞距離的候選點。找不到時退回最近可站立點。
   */
  function viewpointFor([tx, tz], targetId, height, radius) {
    const ideal = Math.min(110, Math.max(25, height * 0.9));
    let best = null;
    for (const distance of [ideal * 0.7, ideal, ideal * 1.4, ideal * 2]) {
      for (let i = 0; i < 36; i++) {
        const a = (i / 36) * Math.PI * 2;
        const x = tx + Math.cos(a) * distance, z = tz + Math.sin(a) * distance;
        if (blockedCircle(x, z, radius * 2)) continue;
        let clear = 0, hit = null;
        while (clear < distance && !hit) {
          clear += 1;
          hit = buildingAt(x + ((tx - x) * clear) / distance, z + ((tz - z) * clear) / distance);
        }
        if (hit !== targetId || clear < 12) continue;
        const score = Math.abs(clear - ideal);
        if (!best || score < best.score) best = { x, z, score };
      }
    }
    return best ? [best.x, best.z] : nearestFree(tx, tz, radius);
  }

  return { blocked, buildingAt, blockedCircle, move, nearestFree, viewpointFor };
}
