import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { planDecor, segmentDistance } from '../web/decor-layout.js';
import { createCollider } from '../web/collision.js';
import { fitCentralRoads } from '../web/road-layout.js';
import { BED, bedPlants } from '../web/flowerbeds.js';

const city = JSON.parse(readFileSync(new URL('../web/assets/city.json', import.meta.url)));
const roads = fitCentralRoads(JSON.parse(readFileSync(new URL('../web/assets/roads.json', import.meta.url))));
const items = planDecor(city, roads);
assert.ok(Math.hypot(BED.width / 2, BED.length / 2) < BED.radius, '碰撞包住旋轉花壇四角');
for (const tree of items.filter((p) => p.type === 'tree')) {
  const plants = bedPlants(tree);
  assert.equal(plants.length, 24);
  assert.deepEqual(plants, bedPlants(tree));
  assert.ok(plants.some((p) => p.kind === 'grass') && plants.some((p) => p.kind === 'flower'));
  assert.ok(plants.every((p) => Math.hypot(p.x - tree.x, p.z - tree.z) + 0.16 < tree.radius), '植物含花瓣不超出花壇碰撞範圍');
}
assert.ok(items.length > 0 && items.length < 136, '有來源的中央通り近似綠化，並非宣稱逐株復刻');
assert.ok(items.every((p) => p.positionStatus === 'approximate' && p.source === 'https://www.ginza.jp/topics/16958'));
assert.deepEqual(items, planDecor(city, roads), '配置應可重現');
assert.deepEqual(planDecor(city, []), [], '沒有道路時不產生街景');
const original = createCollider(city.buildings, city.bounds);
const decorated = createCollider(city.buildings, city.bounds, items);
for (const p of items) {
  assert.equal(original.blockedCircle(p.x, p.z, p.radius), false, '不落入建築');
  assert.equal(decorated.blocked(p.x, p.z), true, '玩家不能穿過花箱或燈柱');
  assert.equal(decorated.buildingAt(p.x, p.z), null, '小物不影響建築視線辨識');
  for (const r of roads) for (let i = 1; i < r.points.length; i++) {
    const distance = segmentDistance(p.x, p.z, r.points[i - 1], r.points[i]);
    if (r.crossing) assert.ok(distance >= 7, '過街線保留空隙');
    else if (['footway', 'path', 'pedestrian', 'steps'].includes(r.kind)) assert.ok(distance >= p.radius + 0.6, '步道中心保留1.2m淨通道');
    else if (r.kind !== 'cycleway') assert.ok(distance >= r.width / 2 + p.radius + 0.2, '不侵入車道');
  }
}
for (const landmark of city.landmarks) {
  const view = original.viewpointFor(landmark.target, landmark.id, landmark.height, 0.35);
  assert.equal(decorated.blockedCircle(...view, 0.35), false, '保留原有地標觀賞點');
  const newView = decorated.viewpointFor(landmark.target, landmark.id, landmark.height, 0.35);
  assert.ok(newView && !decorated.blockedCircle(...newView, 0.35), '加入小物後地標仍可定位');
}
console.log(`ok: ${items.length} 個街景位置、道路淨空與 ${city.landmarks.length} 個地標通過`);

const fixture = { buildings: [], bounds: [-100, -100, 100, 100], landmarks: [], streetFurniture: [
  { x: 0, z: 13, type: 'tree', source: 'https://example.org/survey', positionStatus: 'verified' },
  { x: 20, z: 0, type: 'lamp', source: 'https://example.org/survey', positionStatus: 'verified' },
  { x: 40, z: 14, type: 'tree', source: 'https://example.org/survey', positionStatus: 'estimated' },
] };
const placed = planDecor(fixture, [{ width: 20, points: [[-80, 0], [80, 0]] }]);
assert.equal(placed.length, 1, '只接受已核實且不在車道上的位置');
assert.equal(createCollider([], fixture.bounds, placed).blocked(0, 13), true, '已核實小物保留碰撞');
console.log('ok: 已核實位置與未核實／車道內位置的篩選通過');
