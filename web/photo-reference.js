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

// 歌舞伎座（第五期，2013）：隈研吾建築都市設計事務所官方作品頁照片。
// 高度由正面照片按 OSM 正面寬 45.8 m 換算（約 21 px/m），不是官方圖面尺寸。
export const KABUKIZA = Object.freeze({
  building: '歌舞伎座', tower: '歌舞伎座タワー', osmId: 'r4859313',
  source: 'https://kkaa.co.jp/en/project/ginza-kabukiza/',
  image: 'https://kkaa.co.jp/img/2024/09/ShinKenchiku_01.jpg',
  period: '2013 completed-project photo; facade composition only, banners and programme change by season',
  street: '晴海通り',
  bodyHeight: 15, // 屋頂下的牆體；屋面另外建模
  gableEave: 16.1, gableApex: 20.9, centerEave: 15.2, centerRidge: 17.6,
  cornice: [14.6, 16.0], lanternBand: 12.6, balcony: 9.5, lowerEave: 4.6,
  porch: { width: 11, eave: 7.6, crown: 10, lanterns: 5.5 },
  wing: { eave: 11, apex: 14.7 },
});

// 東急プラザ銀座（2016，日建設計）：建築師發表的照片與短邊立面圖。
// 分層比例由立面圖量測（牆頂 54.72 m 換算）；OSM 66 m 為含屋頂設備的最高高度。
export const TOKYU_PLAZA = Object.freeze({
  building: '東急プラザ銀座', osmId: 'w149167543',
  source: 'https://www.arch2o.com/?p=144121',
  image: 'https://www.arch2o.com/wp-content/uploads/2020/07/Arch2O-tokyu-plaza-ginza-nikken-sekkei-18.jpg',
  heightSource: 'https://www.n-elekyo.or.jp/about/elevatorjournal/pdf/Journal10_06.pdf',
  period: '2016 completed-project photos and elevation; storefront tenants change',
  wallHeight: 54.72,
  storefront: 8.0, // 低層店面帶頂
  sash: 45.3, // 頂部黑色窗框帶（下沿）
  sashDepth: 0.9,
  diamond: { width: 2.8, height: 18.6 }, // 切子菱形：約 2.8 m 寬；官方稱整體約 6 層樓高、深 500 mm
});

// 銀座三越（本館 1968 改修＋新館 2010，KAJIMA DESIGN）：日建連サステナブル建築事例 05-030 的全景照與斷面圖。
// 高度未見官方數值：本館取銀座舊 31 m 線（推定），新館按斷面圖屋頂比例 1.83 倍換算；本館深度比例亦由斷面量測。
export const MITSUKOSHI = Object.freeze({
  building: '三越銀座店', annex: '三越銀座店 新館', osmId: 'w117923435',
  source: 'https://www.nikkenren.com/kenchiku/sb/pdf/252/05-030.pdf',
  period: '2013 case-sheet photos; banners and window displays change',
  street: '中央通り',
  mainDepthRatio: 0.44, // 銀座通り側本館占街區深度比例（斷面圖）
  mainHeight: 31, annexHeight: 56,
  arcade: 8.6, // 本館低層石材拱廊帶頂
  logoHeight: 46, logoRadius: 2.6, logoAlong: 0.15, // 標誌距晴海通り端約 15% 分界立面寬
});

/** 有自繪參考立面、不套用通用店面與推測招牌的建築。 */
export const MODELED_BUILDINGS = Object.freeze(['和光', 'GINZA SIX', 'GINZA PLACE', KABUKIZA.building, KABUKIZA.tower, TOKYU_PLAZA.building, MITSUKOSHI.building, MITSUKOSHI.annex]);
