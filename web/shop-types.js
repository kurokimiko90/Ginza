// 純資料：OSM 店家分類 → 室內陳列類型。陳列是同業態的典型擺放，不是逐店實測。
export const INTERIOR_TYPES = [
  'fashion', 'jewelry', 'sweets', 'cafe', 'dining', 'cosmetics',
  'books', 'gallery', 'convenience', 'goods', 'service', 'salon',
];

const CATEGORY = {
  fashion: ['clothes', 'boutique', 'shoes', 'bag', 'fashion', 'fashion_accessories', 'sports', 'mall', 'department_store', 'yes', 'shop'],
  jewelry: ['jewelry', 'watches', 'optician'],
  sweets: ['confectionery', 'bakery', 'pastry', 'deli', 'ice_cream', 'tea', 'coffee', 'chocolate', 'seafood', 'butcher', 'alcohol', 'wine'],
  cafe: ['cafe', 'fast_food'],
  dining: ['restaurant', 'pub', 'bar', 'biergarten'],
  cosmetics: ['beauty', 'cosmetics', 'perfumery', 'chemist'],
  books: ['books', 'stationery'],
  gallery: ['gallery', 'art', 'museum', 'arts_centre', 'antiques', 'theatre', 'cinema'],
  convenience: ['convenience', 'supermarket', 'variety_store', 'pharmacy', 'mobile_phone', 'electronics'],
  goods: ['gift', 'houseware', 'knives', 'camera', 'florist', 'interior_decoration', 'kitchen', 'craft', 'tobacco'],
  service: ['bank', 'travel_agency', 'hotel', 'estate_agent', 'massage'],
  salon: ['hairdresser', 'beauty_salon'],
};
const LOOKUP = new Map(Object.entries(CATEGORY).flatMap(([type, cats]) => cats.map((c) => [c, type])));

// 沒有店家點位的分節按銀座低層臨街業態的大致比例抽樣（目測估計，非統計資料）。
const FALLBACK = [['fashion', 30], ['cafe', 14], ['jewelry', 11], ['sweets', 10], ['goods', 10],
  ['cosmetics', 8], ['dining', 8], ['gallery', 4], ['books', 3], ['service', 2]];
const FALLBACK_TOTAL = FALLBACK.reduce((sum, [, w]) => sum + w, 0);

function hash01(text) {
  let h = 2166136261;
  for (const ch of String(text)) h = Math.imul(h ^ ch.codePointAt(0), 16777619);
  return (h >>> 0) / 4294967296;
}

export function interiorTypeFor(category, seed) {
  const known = category && LOOKUP.get(String(category).toLowerCase());
  if (known) return known;
  let pick = hash01(seed) * FALLBACK_TOTAL;
  for (const [type, weight] of FALLBACK) {
    pick -= weight;
    if (pick < 0) return type;
  }
  return FALLBACK[0][0];
}

// 分節中心附近、朝向一致的店家招牌；找不到則回傳 null。
export function nearestShopCategory(signs, x, z, nx, nz, maxDistance = 6) {
  let best = null, bestDistance = maxDistance;
  for (const s of signs) {
    if (s.kind === 'crown' || !s.cat) continue;
    if (s.nx * nx + s.nz * nz < 0.7) continue;
    const distance = Math.hypot(s.x - x, s.z - z);
    if (distance < bestDistance) { best = s.cat; bestDistance = distance; }
  }
  return best;
}

// 相鄰同業態分節合併成同一間店：回傳每個分節在店內的起訖（公尺），室內側牆只出現在店的兩端。
export function shopRooms(bays, types) {
  const rooms = [];
  for (let i = 0; i < bays.length;) {
    let j = i;
    while (j + 1 < bays.length && types[j + 1] === types[i]) j++;
    const start = bays[i].start, width = bays[j].end - start;
    for (let k = i; k <= j; k++) rooms.push({ type: types[i], width, from: bays[k].start - start, to: bays[k].end - start });
    i = j + 1;
  }
  return rooms;
}
