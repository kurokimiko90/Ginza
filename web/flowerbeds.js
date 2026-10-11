// 照片構成參考的示意尺寸，不是官方測繪；碰撞半徑包住旋轉後的四角。
export const BED = Object.freeze({ width: 1.1, length: 2.2, radius: 1.25 });

// 銀座通り 2021 植栽帶四區（https://www.ginza.jp/topics/16958）；植物型態為示意，不是逐株品種。
// zone：0 = 1〜4丁目東「ギンザのノハラ」、1 = 1〜4丁目西「銀座植物園」、
//       2 = 5〜8丁目東「銀座エキゾチック」、3 = 5〜8丁目西「SASA deco」。
export const ZONES = Object.freeze([
  { name: 'ギンザのノハラ', mix: ['grass', 'grass', 'flower', 'grass', 'cover'], flowers: ['#e9e4d2', '#d8c48a'], leaf: '#8c9a62' },
  { name: '銀座植物園', mix: ['flower', 'flower', 'grass', 'flower', 'cover'], flowers: ['#d98aa6', '#efd397', '#b9a2dc', '#f2efe6'], leaf: '#6f9a5c' },
  { name: '銀座エキゾチック', mix: ['spike', 'cover', 'spike', 'flower', 'cover'], flowers: ['#e8743f', '#f0b13c'], leaf: '#5f8a70' },
  { name: 'SASA deco', mix: ['sasa', 'sasa', 'flower', 'sasa', 'sasa'], flowers: ['#c95f7a', '#f2e6c7', '#8f7cc4'], leaf: '#6d9450' },
]);

/** 在樹幹以外分層配植；local z 沿街道，每株位置可重現。 */
export function bedPlants(tree) {
  const zone = ZONES[(tree.zone || 0) % ZONES.length];
  const zoneIndex = tree.zone || 0;
  return Array.from({ length: 24 }, (_, i) => {
    const x = (i % 4 - 1.5) * 0.21;
    const z = (Math.floor(i / 4) - 2.5) * 0.34;
    const heading = tree.heading || 0, c = Math.cos(heading), s = Math.sin(heading);
    const kind = Math.abs(z) < 0.25 ? 'cover' : zone.mix[(i + zoneIndex) % zone.mix.length];
    return { ...tree, x: tree.x + x * c + z * s, z: tree.z - x * s + z * c, kind,
      plantHeight: 0.28 + ((i * 7 + zoneIndex) % 5) * 0.055,
      // SASA deco 以盆栽做高低差；只抬高花卉。
      potted: zoneIndex === 3 && kind === 'flower',
      flowerColor: zone.flowers[i % zone.flowers.length],
      leafColor: zone.leaf,
      heading: heading + (i % 3 - 1) * 0.3,
    };
  });
}
