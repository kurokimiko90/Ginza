import assert from 'node:assert/strict';
import { INTERIOR_TYPES, interiorTypeFor, nearestShopCategory, shopRooms } from '../web/shop-types.js';

assert.equal(interiorTypeFor('jewelry', 'a'), 'jewelry');
assert.equal(interiorTypeFor('Cafe', 'a'), 'cafe');
assert.equal(interiorTypeFor('restaurant', 'a'), 'dining');
assert.equal(interiorTypeFor('confectionery', 'a'), 'sweets');
assert.equal(interiorTypeFor('convenience', 'a'), 'convenience');
assert.equal(interiorTypeFor('hairdresser', 'a'), 'salon');

// 未知分類：可重現、只落在已定義類型，且不抽到需要明確資料的便利店／美髮。
const counts = {};
for (let i = 0; i < 4000; i++) {
  const type = interiorTypeFor(i % 2 ? undefined : 'unknown_tag', `bay-${i}`);
  assert.equal(type, interiorTypeFor(i % 2 ? undefined : 'unknown_tag', `bay-${i}`));
  assert.ok(INTERIOR_TYPES.includes(type));
  counts[type] = (counts[type] || 0) + 1;
}
assert.ok(!counts.convenience && !counts.salon);
assert.ok(counts.fashion > counts.cafe && counts.cafe > counts.books);

const signs = [
  { kind: 'crown', cat: 'clothes', x: 0, z: 0, nx: 1, nz: 0 },
  { kind: 'shop', cat: 'jewelry', x: 3, z: 0, nx: 1, nz: 0 },
  { kind: 'cafe', cat: 'cafe', x: 1, z: 0, nx: -1, nz: 0 },
  { kind: 'shop', cat: 'books', x: 20, z: 0, nx: 1, nz: 0 },
];
assert.equal(nearestShopCategory(signs, 0, 0, 1, 0), 'jewelry'); // 跳過頂部招牌與反向牆面
assert.equal(nearestShopCategory(signs, 0, 0, -1, 0), 'cafe');
assert.equal(nearestShopCategory(signs, 10, 0, 1, 0), null);
console.log('ok: 店家分類→室內類型、可重現抽樣、就近招牌比對');

const bays = [{ start: 0, end: 5 }, { start: 5, end: 10 }, { start: 10, end: 15 }, { start: 15, end: 20 }];
const rooms = shopRooms(bays, ['cafe', 'cafe', 'books', 'cafe']);
assert.deepEqual(rooms.map((r) => [r.type, r.width, r.from, r.to]),
  [['cafe', 10, 0, 5], ['cafe', 10, 5, 10], ['books', 5, 0, 5], ['cafe', 5, 0, 5]]);
assert.deepEqual(shopRooms([], []), []);
console.log('ok: 同業態相鄰分節合併為一間店');
