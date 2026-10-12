// 實景校正清單。官方數值與照片觀察分開記錄，未核對的小物不進入場景。
export const WAKO = Object.freeze({
  roofHeight: 30.30, towerHeight: 9.09, lightningRodHeight: 8, dialDiameter: 2.4,
  source: 'https://www.wako.co.jp/f/clock_tower/',
  image: 'https://dolvbt8sp2m5f.cloudfront.net/files/assets/img/tower/image_clock_tower.jpg',
});

/** roads 可省略；給了才會把銀座三越輪廓切成本館／新館。 */
export function applyReferences(city, roads = []) {
  const buildings = city.buildings.flatMap((b) => {
    if (b.id === PLACE_NIGHT.osmId) return [{ ...b, name: PLACE_NIGHT.building, reference: PLACE_NIGHT.source }];
    if (b.id !== MITSUKOSHI.osmId) return [b];
    const split = splitMitsukoshi(b, roads);
    if (!split) return [b];
    const method = 'MITSUKOSHI section-scaled estimate';
    return [
      { ...b, name: MITSUKOSHI.building, outers: [split.main], height: MITSUKOSHI.mainHeight, method, reference: MITSUKOSHI.source },
      { ...b, id: `${b.id}-annex`, name: MITSUKOSHI.annex, outers: [split.annex], height: MITSUKOSHI.annexHeight, method, reference: MITSUKOSHI.source },
    ];
  });
  const wako = city.buildings.find((b) => b.name === '和光');
  const modeled = buildings.filter((b) => MODELED_BUILDINGS.includes(b.name));
  const onReferenceFacade = (sign) => modeled.some((b) => b.outers.some((ring) => ring.some((a, i) => segmentDistance(sign.x, sign.z, a, ring[(i + 1) % ring.length]) < 1.5)));
  return {
    ...city,
    buildings: buildings.map((b) => {
      if (b.id === wako?.id) return { ...b, height: WAKO.roofHeight, method: 'WAKO official roof height', reference: WAKO.source };
      // 屋頂另由 kabukiza.js 建模；牆體高度為照片換算值
      if (b.name === KABUKIZA.building) return { ...b, height: KABUKIZA.bodyHeight, method: 'KABUKIZA photo-estimated wall height', reference: KABUKIZA.source };
      if (b.id === TOKYU_PLAZA.osmId) return { ...b, height: TOKYU_PLAZA.wallHeight, method: 'TOKYU_PLAZA elevator-journal building height', reference: TOKYU_PLAZA.heightSource };
      return b;
    }),
    landmarks: city.landmarks.map((l) => {
      if (l.id === wako?.id) return { ...l, height: WAKO.roofHeight + WAKO.towerHeight };
      if (l.label === KABUKIZA.building) return { ...l, height: KABUKIZA.gableApex };
      if (l.id === TOKYU_PLAZA.osmId) return { ...l, height: TOKYU_PLAZA.wallHeight };
      return l;
    }),
    clock: city.clock ? { ...city.clock, base: WAKO.roofHeight, source: WAKO.source } : null,
    signs: (city.signs || []).filter((s) => !['和光', 'GINZA SIX'].includes(s.text) && !onReferenceFacade(s)),
    boards: (city.boards || []).filter((s) => !onReferenceFacade(s)),
    // 空清單是刻意的：官方證實街樹存在，但目前沒有逐株／逐燈的已核實位置。
    streetFurniture: city.streetFurniture || [],
  };
}
import { segmentDistance } from './decor-layout.js';
import { KABUKIZA, MITSUKOSHI, MODELED_BUILDINGS, PLACE_NIGHT, TOKYU_PLAZA } from './photo-reference.js';
import { splitMitsukoshi } from './mitsukoshi-layout.js';
