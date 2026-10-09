// 照片構成參考的示意尺寸，不是官方測繪；碰撞半徑包住旋轉後的四角。
export const BED = Object.freeze({ width: 1.1, length: 2.2, radius: 1.25 });

/** 在樹幹以外分層配植；local z 沿街道，每株位置可重現。 */
export function bedPlants(tree) {
  return Array.from({ length: 24 }, (_, i) => {
    const x = (i % 4 - 1.5) * 0.21;
    const z = (Math.floor(i / 4) - 2.5) * 0.34;
    const heading = tree.heading || 0, c = Math.cos(heading), s = Math.sin(heading);
    const zone = tree.zone || 0;
    return { ...tree, x: tree.x + x * c + z * s, z: tree.z - x * s + z * c,
      kind: Math.abs(z) < 0.25 ? 'cover' : (i + zone) % 4 === 0 ? 'grass' : 'flower',
      plantHeight: 0.28 + ((i * 7 + zone) % 5) * 0.055,
      flowerColor: ['#ede8dc', '#c2aedb', '#efd397', '#dbb9ca'][zone % 4],
      heading: heading + (i % 3 - 1) * 0.3,
    };
  });
}
