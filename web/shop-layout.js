// 純資料：程序化店面分節，不代表實際租戶或入口位置。
export function shopBays(length, seed) {
  if (!Number.isFinite(length) || length < 2.5) return [];
  const count = Math.max(1, Math.round(length / 5.5));
  const width = length / count;
  let h = 2166136261;
  for (const ch of String(seed)) h = Math.imul(h ^ ch.codePointAt(0), 16777619);
  return Array.from({ length: count }, (_, i) => ({
    start: i * width, end: (i + 1) * width,
    variant: ((h >>> 0) + i * 3) % 8,
  }));
}
