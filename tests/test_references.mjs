import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { applyReferences } from '../web/references.js';
import { createCollider } from '../web/collision.js';
import { SIX_NIGHT, PLACE_NIGHT } from '../web/photo-reference.js';

const original = JSON.parse(readFileSync(new URL('../web/assets/city.json', import.meta.url)));
const before = JSON.stringify(original);
const city = applyReferences(original);
assert.equal(JSON.stringify(original), before, '參考校正不覆寫原始 OSM 資料');
assert.equal(city.buildings.find((b) => b.name === '和光').height, 30.3, '官方屋頂高度');
assert.equal(city.landmarks.find((b) => b.label.includes('和光')).height, 39.39, '屋頂加塔體高度');
assert.equal(city.clock.base, 30.3, '鐘樓貼合校正屋頂');
assert.ok(SIX_NIGHT.source.startsWith('https://ginza6.tokyo/') && SIX_NIGHT.image.endsWith('taniguchi-02.jpg'), '記錄具體實景夜照');
assert.ok(SIX_NIGHT.glassGain < SIX_NIGHT.metalGain, '照片的暗玻璃、亮檐帶層次');
assert.ok(SIX_NIGHT.eaves.every((y, i, values) => i === 0 || y > values[i - 1]), '參考檐帶排序');
const place = city.buildings.find((b) => b.id === PLACE_NIGHT.osmId);
assert.equal(place.name, 'GINZA PLACE');
assert.equal(place.height, original.buildings.find((b) => b.id === place.id).height, '照片不冒充官方量測高度');
assert.equal(place.reference, PLACE_NIGHT.source);
assert.ok(!city.signs.some((s) => s.text === 'サッポロ銀座ビル'), '舊樓名不再生成虛構屋頂招牌');
assert.ok(!city.signs.some((s) => s.kind === 'crown' && ['和光', 'GINZA SIX'].includes(s.text)), '不生成實景未證實的地標屋頂廣告');
const collider = createCollider(city.buildings, city.bounds);
for (const landmark of city.landmarks) {
  const view = collider.viewpointFor(landmark.target, landmark.id, landmark.height, 0.35);
  assert.ok(view && !collider.blockedCircle(...view, 0.35), '實景校正後仍能定位地標');
}
const roads = JSON.parse(readFileSync(new URL('../web/assets/roads.json', import.meta.url)));
const crossings = roads.filter((r) => r.crossing);
assert.ok(crossings.length > 0 && crossings.some((r) => r.marked), '保留 OSM 過街與標線資料');
assert.ok(crossings.every((r) => r.kind === 'footway' && typeof r.marked === 'boolean'), '只以明確標記的步行過街線生成標線');
console.log(`ok: 和光官方高度、地標定位與 ${crossings.length} 條 OSM 過街線通過`);
