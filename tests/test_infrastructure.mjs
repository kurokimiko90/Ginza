import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { planInfrastructure } from '../web/infrastructure-layout.js';
import { planDecor, segmentDistance } from '../web/decor-layout.js';
import { fitCentralRoads } from '../web/road-layout.js';
import { applyReferences } from '../web/references.js';
import { createCollider } from '../web/collision.js';

const city = applyReferences(JSON.parse(readFileSync(new URL('../web/assets/city.json', import.meta.url))));
const roads = fitCentralRoads(JSON.parse(readFileSync(new URL('../web/assets/roads.json', import.meta.url))));
const decor = planDecor(city, roads), before = JSON.stringify([city, roads, decor]);
const items = planInfrastructure(city, roads, decor);
assert.equal(JSON.stringify([city, roads, decor]), before, '不修改輸入');
assert.deepEqual(items, planInfrastructure(city, roads, decor), '可重現');
assert.deepEqual(planInfrastructure(city, []), [], '無道路不產生设施');
assert.ok(items.some((p) => p.type === 'lamp') && items.some((p) => p.type === 'signal'));
const collider = createCollider(city.buildings, city.bounds, [...decor, ...items]);
const buildingCollider = createCollider(city.buildings, city.bounds);
for (const p of items) {
  assert.ok(Number.isFinite(p.heading) && p.positionStatus === 'approximate');
  assert.equal(buildingCollider.blockedCircle(p.x, p.z, 0.5), false);
  assert.equal(collider.blocked(p.x, p.z), true, '柱體加入漫遊碰撞');
  for (const r of roads) for (let i = 1; i < r.points.length; i++) {
    const distance = segmentDistance(p.x, p.z, r.points[i - 1], r.points[i]);
    if (r.crossing && r.marked) assert.ok(distance >= (p.type === 'lamp' ? 4 : r.width / 2 + p.radius + 0.4));
    else if (!r.crossing && ['footway', 'path', 'pedestrian', 'steps', 'cycleway'].includes(r.kind)) assert.ok(distance >= p.radius + 0.6);
    else if (!r.crossing) assert.ok(distance >= r.width / 2 + p.radius + 0.2);
  }
  assert.ok(decor.every((d) => Math.hypot(p.x - d.x, p.z - d.z) >= p.radius + d.radius + 0.7));
  for (const end of p.type === 'lamp' ? [-1.65, 1.65] : [3.2]) for (let step = 1; step <= 8; step++) {
    const reach = end * step / 8, x = p.x + reach * Math.cos(p.heading), z = p.z - reach * Math.sin(p.heading);
    assert.equal(buildingCollider.blockedCircle(x, z, 0.3), false, '整段燈臂不穿建築');
    if (p.type === 'lamp') assert.ok(decor.filter((d) => d.type === 'tree').every((d) => Math.hypot(x - d.x, z - d.z) >= 1.6), '燈臂避讓樹冠');
  }
}
for (const l of city.landmarks) {
  const view = buildingCollider.viewpointFor(l.target, l.id, l.height, 0.35);
  assert.equal(collider.blockedCircle(...view, 0.35), false, '保留地標觀賞點');
}
console.log(`ok: ${items.filter((p) => p.type === 'lamp').length} 路燈、${items.filter((p) => p.type === 'signal').length} 信號柱；淨空、碰撞與不可變輸入通過`);
