import assert from 'node:assert/strict';
import { fitCentralRoads } from '../web/road-layout.js';
const roads = [
  { name: '中央通り', kind: 'trunk', width: 22, widthSource: 'estimated', points: [[0, 0], [50, 0]] },
  { kind: 'footway', width: 2, points: [[0, 10], [50, 10]] },
];
const before = JSON.stringify(roads), fitted = fitCentralRoads(roads);
assert.equal(JSON.stringify(roads), before);
assert.equal(fitted[0].width, 15.2);
assert.deepEqual(fitted[0].points, roads[0].points);
assert.equal(fitCentralRoads([{ ...roads[0], width: 18 }, roads[1]])[0].width, 18);
assert.equal(fitCentralRoads([{ ...roads[0], widthSource: 'osm' }, roads[1]])[0].width, 22);
assert.equal(fitCentralRoads([{ ...roads[0], name: '別の道' }, roads[1]])[0].width, 22);
assert.equal(fitCentralRoads([roads[0], { ...roads[1], crossing: true }])[0].width, 22);
assert.equal(fitCentralRoads([roads[0], { ...roads[1], points: [[25, -10], [25, 10]] }])[0].width, 22);
const bridge = { ...roads[0], points: [[0, 0], [50, 0], [51, 0], [70, 0]] };
const result = fitCentralRoads([bridge, roads[1]]);
assert.equal(result.length, 2, '不拆段、保留交通路網數量');
assert.deepEqual(result[0].points, bridge.points, '短橋點位和原始端點完整保留');
console.log('ok: 中央通り步道邊界推估、保留原始中心線、只限符合條件路段');
