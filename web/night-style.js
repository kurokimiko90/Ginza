// 深色字／白底燈箱的光色取較亮的一方，避免用黑色字樣產生黑色光暈。
export function lightboxTint(background, ink) {
  const luminance = (hex) => {
    const value = Number.parseInt(hex.slice(1), 16);
    const channels = [value >>> 16, (value >>> 8) & 255, value & 255].map((v) => {
      const s = v / 255;
      return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  };
  return luminance(background) > luminance(ink) ? background : ink;
}
