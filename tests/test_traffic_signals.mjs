import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CYCLE_LENGTH, axisOf, carStep, leaderGaps, distanceToStop, mainAxis, planSignals, stopsOnPath, vehiclePhase, walkState } from '../web/traffic-signals.js';
import { planInfrastructure } from '../web/infrastructure-layout.js';
import { planDecor } from '../web/decor-layout.js';
import { fitCentralRoads } from '../web/road-layout.js';
import { applyReferences } from '../web/references.js';

// 週期：任何時刻至少一方向為紅；兩方向不同時放行；行人只在橫越車流為紅時可走
for (let t = 0; t < CYCLE_LENGTH * 2; t += 0.25) {
  const p = vehiclePhase(t);
  assert.ok(p.main === 'red' || p.side === 'red', `t=${t} 兩向不可同時非紅`);
  for (const axis of ['main', 'side']) {
    if (walkState(axis, t) !== 'stop') assert.equal(p[axis], 'red', `t=${t} 行人放行時被橫越車流必須紅燈`);
  }
}
assert.deepEqual(vehiclePhase(1), vehiclePhase(1 + CYCLE_LENGTH), '週期性');
assert.deepEqual(vehiclePhase(-1), vehiclePhase(CYCLE_LENGTH - 1), '負時間');
const states = new Set(Array.from({ length: CYCLE_LENGTH * 4 }, (_, i) => `${vehiclePhase(i / 4).main}/${walkState('side', i / 4)}`));
for (const s of ['green/walk', 'green/flash', 'yellow/stop', 'red/stop']) assert.ok(states.has(s), `出現 ${s}`);

// 軸向
assert.deepEqual(mainAxis([]), [1, 0]);
const axis = mainAxis([{ name: '中央通り', points: [[0, 0], [10, 10]] }, { name: '中央通り', points: [[10, 10], [0, 0]] }]);
assert.ok(Math.abs(Math.abs(axis[0]) - Math.SQRT1_2) < 1e-9, '正反方向不抵銷');
assert.equal(axisOf(1, 1, axis), 'main');
assert.equal(axisOf(-1, 1, axis), 'side');

// 停止線：過街線與車道交叉，停在線前 width/2 + 1.5
const crossing = { points: [[50, -5], [50, 5]], width: 4, vehicleAxis: 'main' };
const stops = stopsOnPath([[0, 0], [100, 0]], [0, 100], [crossing]);
assert.equal(stops.length, 1);
assert.ok(Math.abs(stops[0].at - 50) < 1e-9 && stops[0].clearance === 3.5);
assert.deepEqual(stopsOnPath([[0, 0], [40, 0]], [0, 40], [crossing]), [], '未交叉不產生');
assert.equal(stopsOnPath([[0, 0], [50, 0]], [0, 50], [{ ...crossing, points: [[50, 0.5], [50, 8]] }]).length, 1, '端點相接也接得住');
const redMain = CYCLE_LENGTH - 1; // 側街方向全紅時段 → main 為紅
assert.equal(vehiclePhase(redMain).main, 'red');
assert.ok(Math.abs(distanceToStop(stops, 100, 30, 1, redMain) - 16.5) < 1e-9, '正向紅燈');
assert.ok(Math.abs(distanceToStop(stops, 100, 30, -1, redMain) - 16.5) < 1e-9, '反向紅燈');
assert.equal(distanceToStop(stops, 100, 30, 1, 0), Infinity, '綠燈不停');
assert.equal(distanceToStop(stops, 100, 48, 1, redMain), Infinity, '已越過停止線');
const yellow = 34.5;
assert.equal(vehiclePhase(yellow).main, 'yellow');
assert.equal(distanceToStop(stops, 100, 43, 1, yellow), Infinity, '黃燈近線通過');
assert.ok(Number.isFinite(distanceToStop(stops, 100, 20, 1, yellow)), '黃燈遠處停車');

// 模擬：兩台車從紅燈前接近，停在停止線前且不重疊；轉綠後通過
{
  const seg = { length: 200, stops: stopsOnPath([[0, 0], [200, 0]], [0, 200], [{ ...crossing, points: [[120, -5], [120, 5]] }]) };
  const line = 120 - 3.5;
  const start = 40; // main 綠 0–34、黃 34–37、紅 37–60 → t=40 起紅燈
  const cars = [{ seg: 0, dir: 1, s: 60, v: 10, speed: 10 }, { seg: 0, dir: 1, s: 45, v: 10, speed: 10 }];
  let maxS = 0;
  for (let t = start; t < start + 25; t += 0.05) {
    const gaps = leaderGaps(cars);
    for (const car of cars) {
      const step = carStep(car, seg, gaps.get(car), t, 0.05);
      car.v = step.v; car.s += step.distance;
    }
    maxS = Math.max(maxS, cars[0].s);
    assert.ok(cars[0].s - cars[1].s >= 6.5 - 1e-6, `t=${t.toFixed(2)} 前後車重疊`);
  }
  assert.ok(maxS <= line + 1e-6, `紅燈越線 ${maxS}`);
  assert.ok(line - cars[0].s < 1.5 && cars[0].v < 0.5, `未停在線前：s=${cars[0].s} v=${cars[0].v}`);
  assert.ok(cars[0].s - cars[1].s < 8, '後車跟上排隊');
  for (let t = CYCLE_LENGTH; t < CYCLE_LENGTH + 20; t += 0.05) {
    const gaps = leaderGaps(cars);
    for (const car of cars) { const step = carStep(car, seg, gaps.get(car), t, 0.05); car.v = step.v; car.s += step.distance; }
  }
  assert.ok(cars[1].s > 120, '綠燈後通過');
}

// 真實資料：每支信號柱都對到一條過街線，且有車道會停
const city = applyReferences(JSON.parse(readFileSync(new URL('../web/assets/city.json', import.meta.url))));
const roads = fitCentralRoads(JSON.parse(readFileSync(new URL('../web/assets/roads.json', import.meta.url))));
const items = planInfrastructure(city, roads, planDecor(city, roads));
const before = JSON.stringify([roads, items]);
const plan = planSignals(roads, items);
assert.equal(JSON.stringify([roads, items]), before, '不修改輸入');
assert.equal(plan.poleAxes.length, items.filter((p) => p.type === 'signal').length);
assert.ok(plan.crossings.length > 0);
assert.ok(plan.crossings.some((c) => c.vehicleAxis === 'main') && plan.crossings.some((c) => c.vehicleAxis === 'side'), '兩方向都有');
const carRoads = roads.filter((r) => !r.crossing && ['trunk', 'primary', 'secondary', 'tertiary', 'unclassified', 'residential'].includes(r.kind));
const stopCount = carRoads.reduce((n, r) => {
  const cum = [0];
  for (let i = 1; i < r.points.length; i++) cum.push(cum[i - 1] + Math.hypot(r.points[i][0] - r.points[i - 1][0], r.points[i][1] - r.points[i - 1][1]));
  return n + stopsOnPath(r.points, cum, plan.crossings).length;
}, 0);
assert.ok(stopCount >= plan.crossings.length * 0.5, `停止線 ${stopCount} 太少`);
console.log(`ok: ${plan.crossings.length} 條信號過街線、${plan.poleAxes.length} 支信號柱、${stopCount} 處停止線；週期 ${CYCLE_LENGTH}s`);
