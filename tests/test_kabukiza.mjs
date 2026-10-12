import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { planKabukiza } from '../web/kabukiza-layout.js';
import { KABUKIZA, MODELED_BUILDINGS } from '../web/photo-reference.js';
import { applyReferences } from '../web/references.js';
import { fitCentralRoads } from '../web/road-layout.js';
import { createCollider } from '../web/collision.js';

const raw = JSON.parse(readFileSync(new URL('../web/assets/city.json', import.meta.url)));
const city = applyReferences(raw);
const roads = fitCentralRoads(JSON.parse(readFileSync(new URL('../web/assets/roads.json', import.meta.url))));
const before = JSON.stringify([city.buildings, roads]);
const plan = planKabukiza(city.buildings, roads);
assert.equal(JSON.stringify([city.buildings, roads]), before, '不修改輸入');
assert.deepEqual(plan, planKabukiza(city.buildings, roads), '可重現');

// 照片：正面約 46 m、中央凹入玄關約 11.6 m 居中、右側後退低翼
assert.ok(plan.width > 40 && plan.width < 52, `正面寬 ${plan.width}`);
const recessWidth = plan.recess.x1 - plan.recess.x0;
assert.ok(recessWidth > 9 && recessWidth < 14, `玄關寬 ${recessWidth}`);
assert.ok(Math.abs((plan.recess.x0 + plan.recess.x1) / 2 - plan.width / 2) < 2, '玄關居中');
assert.ok(plan.recess.depth > 1 && plan.recess.depth < 4);
assert.ok(plan.wing && plan.wing.setback > 5 && plan.wing.x1 - plan.wing.x0 > 8, '右側低翼');
assert.ok(Math.abs(Math.hypot(...plan.u) - 1) < 1e-9 && Math.abs(plan.u[0] * plan.n[0] + plan.u[1] * plan.n[1]) < 1e-9);

// 正面朝向晴海通り：正面外側 8 m 不在建築內，內側 3 m 在建築內
const collider = createCollider(city.buildings, city.bounds);
for (const t of [0.1, 0.3, 0.7, 0.9]) {
  const x = plan.origin[0] + plan.u[0] * plan.width * t, z = plan.origin[1] + plan.u[1] * plan.width * t;
  assert.equal(collider.blocked(x + plan.n[0] * 8, z + plan.n[1] * 8), false, '正面外是街道');
  assert.equal(collider.blocked(x - plan.n[0] * 3, z - plan.n[1] * 3), true, '正面內是建築');
}

// 高度校正與通用元素排除
const body = city.buildings.find((b) => b.name === KABUKIZA.building);
assert.equal(body.height, KABUKIZA.bodyHeight);
assert.equal(raw.buildings.find((b) => b.name === KABUKIZA.building).height, 32, '原始資料不變');
assert.ok(KABUKIZA.gableApex > KABUKIZA.gableEave && KABUKIZA.gableEave > KABUKIZA.cornice[0] && KABUKIZA.porch.crown > KABUKIZA.porch.eave);
assert.ok(MODELED_BUILDINGS.includes(KABUKIZA.building) && MODELED_BUILDINGS.includes(KABUKIZA.tower));
assert.equal(planKabukiza(city.buildings.filter((b) => b.name !== KABUKIZA.building), roads), null);
assert.equal(planKabukiza(city.buildings, []), null);
console.log(`ok: 歌舞伎座正面 ${plan.width.toFixed(1)} m、玄關 ${recessWidth.toFixed(1)} m（凹 ${plan.recess.depth.toFixed(1)} m）、右翼後退 ${plan.wing.setback.toFixed(1)} m`);
