import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { splitMitsukoshi } from '../web/mitsukoshi-layout.js';
import { MITSUKOSHI, MODELED_BUILDINGS } from '../web/photo-reference.js';
import { applyReferences } from '../web/references.js';
import { fitCentralRoads } from '../web/road-layout.js';
import { createCollider } from '../web/collision.js';

const raw = JSON.parse(readFileSync(new URL('../web/assets/city.json', import.meta.url)));
const roads = fitCentralRoads(JSON.parse(readFileSync(new URL('../web/assets/roads.json', import.meta.url))));
const before = JSON.stringify([raw, roads]);
const city = applyReferences(raw, roads);
assert.equal(JSON.stringify([raw, roads]), before, '不修改輸入');
const area = (r) => Math.abs(r.reduce((a, p, i) => { const q = r[(i + 1) % r.length]; return a + p[0] * q[1] - q[0] * p[1]; }, 0) / 2);
const original = raw.buildings.find((b) => b.id === MITSUKOSHI.osmId);
const split = splitMitsukoshi(original, roads);

// 面積守恆：本館＋新館＝原輪廓；兩者都有實際面積
assert.ok(Math.abs(area(split.main) + area(split.annex) - area(original.outers[0])) < 1e-6, '切分不遺失面積');
assert.ok(area(split.main) > 1500 && area(split.annex) > 1500);
// 本館在中央通り側：本館重心比新館更朝 n
const centroid = (r) => [r.reduce((s, p) => s + p[0], 0) / r.length, r.reduce((s, p) => s + p[1], 0) / r.length];
const along = ([x, z]) => x * split.n[0] + z * split.n[1];
assert.ok(along(centroid(split.main)) > along(centroid(split.annex)), '本館朝中央通り');
// cut.b 端靠晴海通り：比 cut.a 更接近晴海通り
const harumi = roads.filter((r) => r.name === '晴海通り' && !r.crossing).flatMap((r) => r.points);
const toHarumi = (p) => Math.min(...harumi.map((q) => Math.hypot(q[0] - p[0], q[1] - p[1])));
assert.ok(toHarumi(split.cut.b) < toHarumi(split.cut.a), '標誌端靠晴海通り');
assert.ok(Math.hypot(split.cut.a[0] - split.cut.b[0], split.cut.a[1] - split.cut.b[1]) > 30, '分界立面夠寬放標誌');

const main = city.buildings.find((b) => b.name === MITSUKOSHI.building), annex = city.buildings.find((b) => b.name === MITSUKOSHI.annex);
assert.equal(main.height, MITSUKOSHI.mainHeight);
assert.equal(annex.height, MITSUKOSHI.annexHeight);
assert.ok(annex.height > main.height && MITSUKOSHI.logoHeight - MITSUKOSHI.logoRadius > main.height && MITSUKOSHI.logoHeight + MITSUKOSHI.logoRadius < annex.height, '標誌在本館屋頂之上的新館立面');
assert.equal(new Set(city.buildings.map((b) => b.id)).size, city.buildings.length, 'id 唯一');
assert.ok(MODELED_BUILDINGS.includes(main.name) && MODELED_BUILDINGS.includes(annex.name));
assert.ok(!city.signs.some((s) => s.text === '三越銀座店' && s.kind === 'crown'), '撤去通用屋頂燈箱');
// 切分後碰撞範圍不變：兩棟之間沒有縫
const collider = createCollider(city.buildings, city.bounds);
const mid = [(split.cut.a[0] + split.cut.b[0]) / 2, (split.cut.a[1] + split.cut.b[1]) / 2];
assert.equal(collider.blocked(...mid), true, '分界線上仍是建築');
// 沒給道路時保持原狀
assert.equal(applyReferences(raw).buildings.find((b) => b.id === MITSUKOSHI.osmId).height, original.height);
assert.equal(splitMitsukoshi(original, []), null);
console.log(`ok: 三越本館 ${area(split.main).toFixed(0)} m²／新館 ${area(split.annex).toFixed(0)} m²，分界立面 ${Math.hypot(split.cut.a[0] - split.cut.b[0], split.cut.a[1] - split.cut.b[1]).toFixed(1)} m`);
