// 實景校正清單。官方數值與照片觀察分開記錄，未核對的小物不進入場景。
export const WAKO = Object.freeze({
  roofHeight: 30.30, towerHeight: 9.09, lightningRodHeight: 8, dialDiameter: 2.4,
  source: 'https://www.wako.co.jp/f/clock_tower/',
  image: 'https://dolvbt8sp2m5f.cloudfront.net/files/assets/img/tower/image_clock_tower.jpg',
});

export function applyReferences(city) {
  const buildings = city.buildings.map((b) => b.id === PLACE_NIGHT.osmId
    ? { ...b, name: PLACE_NIGHT.building, reference: PLACE_NIGHT.source } : b);
  const wako = city.buildings.find((b) => b.name === '和光');
  const modeled = buildings.filter((b) => ['和光', 'GINZA SIX', 'GINZA PLACE'].includes(b.name));
  const onReferenceFacade = (sign) => modeled.some((b) => b.outers.some((ring) => ring.some((a, i) => segmentDistance(sign.x, sign.z, a, ring[(i + 1) % ring.length]) < 1.5)));
  return {
    ...city,
    buildings: buildings.map((b) => b.id === wako?.id
      ? { ...b, height: WAKO.roofHeight, method: 'WAKO official roof height', reference: WAKO.source }
      : b),
    landmarks: city.landmarks.map((l) => l.id === wako?.id ? { ...l, height: WAKO.roofHeight + WAKO.towerHeight } : l),
    clock: city.clock ? { ...city.clock, base: WAKO.roofHeight, source: WAKO.source } : null,
    signs: (city.signs || []).filter((s) => !['和光', 'GINZA SIX'].includes(s.text) && !onReferenceFacade(s)),
    boards: (city.boards || []).filter((s) => !onReferenceFacade(s)),
    // 空清單是刻意的：官方證實街樹存在，但目前沒有逐株／逐燈的已核實位置。
    streetFurniture: city.streetFurniture || [],
  };
}
import { segmentDistance } from './decor-layout.js';
import { PLACE_NIGHT } from './photo-reference.js';
