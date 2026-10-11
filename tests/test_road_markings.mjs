import assert from 'node:assert/strict';
import { curbTriangles, isMajorRoad, PAIRED } from '../web/road-markings.js';

// 上下行兩條、各寬 7m、中心線相距 7m：路緣只在外側（z = ±7），不在中線 z = 0。
const north = { width: 7, widthStatus: PAIRED, points: [[0, -3.5], [40, -3.5]] };
const south = { width: 7, widthStatus: PAIRED, points: [[0, 3.5], [40, 3.5]] };
assert.equal(isMajorRoad(north), true, '分開繪製的單向車道群仍畫車道線');
assert.equal(isMajorRoad({ width: 7 }), false);
assert.equal(isMajorRoad({ width: 20 }), true);
const tris = curbTriangles([north, south]);
assert.equal(tris.length, 2 * 6 * 3, '每條各一段外側路緣');
const zs = tris.filter((_, i) => i % 3 === 2);
assert.ok(zs.every((z) => Math.abs(z) >= 7 && Math.abs(z) <= 7.3 + 1e-9), '路緣在車道外緣 0.3m 內');
assert.equal(curbTriangles([{ width: 20, points: [[0, 0], [40, 0]] }]).length, 0, '一般道路不推測路緣');
console.log('ok: 主幹道判定與路緣只畫外側');
