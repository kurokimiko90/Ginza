// 照片觀察記錄：可追溯到具體圖像，避免把任意發光樣式當成實景。
export const SIX_NIGHT = Object.freeze({
  building: 'GINZA SIX',
  source: 'https://ginza6.tokyo/magazine/detail/125505/',
  image: 'https://ginza6.tokyo/wp-content/uploads/2017/03/taniguchi-02.jpg',
  period: '2017 architectural reference; not a current tenant survey',
  glassDay: ['#364a5b', '#748c9b', '#405a6c'],
  glassNight: '#172d49',
  eaves: [31, 36, 41, 46, 51, 56, 61, 65.6], // 示意模型高度，非照片量測值。
  glassGain: 0.32,
  metalGain: 1.1,
});

export const PLACE_NIGHT = Object.freeze({
  building: 'GINZA PLACE', osmId: 'w195551651',
  source: 'https://www.colorkinetics.co.jp/works/930',
  image: 'https://www.colorkinetics.co.jp/files/fix/works/930/ginzaplace_001.jpg',
  period: '2016 completed-project photo; facade reference, not current tenants',
  // 樓高仍沿用 OSM 輪廓估計；露台分層為照片構成的示意比例。
  terraces: [0.21, 0.53], nightGain: 0.8,
});
