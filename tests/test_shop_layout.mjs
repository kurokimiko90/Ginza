import assert from 'node:assert/strict';
import { shopBays } from '../web/shop-layout.js';
for (const length of [2.5, 5, 11, 24, 100]) {
  const bays = shopBays(length, 'building-42');
  assert.deepEqual(bays, shopBays(length, 'building-42'));
  assert.equal(bays[0].start, 0);
  assert.equal(bays.at(-1).end, length);
  bays.forEach((bay, i) => {
    assert.ok(bay.end > bay.start);
    assert.ok(Number.isInteger(bay.variant) && bay.variant >= 0 && bay.variant < 8);
    if (i) assert.equal(bay.start, bays[i - 1].end);
  });
  if (bays.length > 1) assert.notEqual(bays[0].variant, bays[1].variant);
}
for (const length of [0, -1, 2, NaN, Infinity]) assert.deepEqual(shopBays(length, 'x'), []);
console.log('ok: 店面分節連續、可重現、不重複相鄰圖樣');
