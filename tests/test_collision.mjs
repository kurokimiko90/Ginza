// 碰撞模組測試：node tests/test_collision.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createCollider } from '../web/collision.js';

const square = { base: 0, outers: [[[0, 0], [10, 0], [10, 10], [0, 10]]] };
const courtyard = {
  base: 0,
  outers: [[[30, 0], [60, 0], [60, 30], [30, 30]]],
  holes: [[[40, 10], [50, 10], [50, 20], [40, 20]]],
};
const elevated = { base: 6, outers: [[[-30, -30], [-20, -30], [-20, -20], [-30, -20]]] };
const collider = createCollider([square, courtyard, elevated], [-50, -50, 100, 100]);

assert.equal(collider.blocked(5, 5), true, '建築內部不可走');
assert.equal(collider.blocked(-1, 5), false, '建築外可走');
assert.equal(collider.blocked(100, 0), true, '地圖邊界不可走');
assert.equal(collider.blocked(45, 15), false, '中庭可走');
assert.equal(collider.blocked(35, 5), true, '中庭外圍建築不可走');
assert.equal(collider.blocked(-25, -25), false, '架空建築下方可走');
assert.equal(collider.blockedCircle(-0.2, 5, 0.35), true, '半徑碰到牆即阻擋');

// 撞牆時沿牆滑動：斜向撞上西牆，只保留 z 方向位移
const [x, z] = collider.move(-0.5, 5, 0.4, 0.4, 0.35);
assert.equal(x, -0.5);
assert.equal(z, 5.4);

const spot = collider.nearestFree(5, 5, 0.35);
assert.ok(spot && !collider.blockedCircle(spot[0], spot[1], 0.35), '能找到最近可站立點');

// 真實資料：地標都要找得到可站立點
const city = JSON.parse(readFileSync(new URL('../web/assets/city.json', import.meta.url)));
const real = createCollider(city.buildings, city.bounds);
for (const landmark of city.landmarks) {
  assert.ok(real.blocked(...landmark.target), `${landmark.label} 中心應在建築內`);
  assert.ok(real.nearestFree(...landmark.target, 0.35), `${landmark.label} 附近應有街道`);
  // 觀賞點：站得住，且視線第一個撞到的就是地標本身
  const [vx, vz] = real.viewpointFor(landmark.target, landmark.id, landmark.height, 0.35);
  assert.equal(real.blockedCircle(vx, vz, 0.35), false, `${landmark.label} 觀賞點可站立`);
  const [tx, tz] = landmark.target;
  const distance = Math.hypot(tx - vx, tz - vz);
  let step = 0, hit = null;
  while (step < distance && !hit) hit = real.buildingAt(vx + ((tx - vx) * ++step) / distance, vz + ((tz - vz) * step) / distance);
  assert.equal(hit, landmark.id, `${landmark.label} 視線不被其他建築遮擋`);
  assert.ok(step >= 12, `${landmark.label} 觀賞點不貼牆（${step} m）`);
}
assert.equal(real.blocked(0, 0), false, '銀座四丁目交差點中心為道路');

// 長條花壇按朝向判定：沿街長 2.2m 擋住，橫向 0.55m 外可通行。
const bed = { x: 0, z: 0, radius: 1.25, heading: Math.PI / 4, halfWidth: 0.55, halfLength: 1.1 };
const bedCollider = createCollider([], [-10, -10, 10, 10], [bed]);
const along = [Math.sin(bed.heading), Math.cos(bed.heading)], across = [Math.cos(bed.heading), -Math.sin(bed.heading)];
assert.equal(bedCollider.blocked(along[0] * 1.0, along[1] * 1.0), true, '花壇長邊方向被擋');
assert.equal(bedCollider.blocked(across[0] * 0.7, across[1] * 0.7), false, '花壇側邊外可通行');
assert.equal(createCollider([], [-10, -10, 10, 10], [{ x: 0, z: 0, radius: 0.5 }]).blocked(0.4, 0.4), true, '無朝向小物仍為方形半徑');

console.log(`ok：合成測試與 ${city.landmarks.length} 個地標通過`);
