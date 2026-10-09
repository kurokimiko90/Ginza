# 資料與素材來源

## OpenStreetMap 衍生資料

© OpenStreetMap contributors

`web/assets/city.json` 與 `web/assets/roads.json` 由 `scripts/fetch_osm.py` 經 Overpass API 取得、`scripts/build_city.py` 轉換的銀座建築幾何、估算高度、道路中心線與店家名稱／位置（招牌），屬 OpenStreetMap 衍生資料庫，依 **Open Database License (ODbL) 1.0** 提供。

- 取得日期：2026-10-09（重新執行 `fetch_osm.py` 會取得當下最新資料）
- 範圍：緯度 35.6650–35.6775、經度 139.7590–139.7720
- 高度：多數為估算值（見 README「重建地圖資料」）
- [OpenStreetMap 著作權與授權](https://www.openstreetmap.org/copyright)
- [ODbL 1.0 全文](https://opendatacommons.org/licenses/odbl/1-0/)

公開散布衍生資料時須保留上述出處，並以相同授權提供。網頁畫面為 Produced Work，頁尾已標示來源。

## Three.js

`web/vendor/` 隨附 Three.js r180 與 OrbitControls，MIT 授權，聲明見 `web/vendor/LICENSE`。

## 自產內容

窗格、天空、地面貼圖皆於瀏覽器中以 Canvas／著色器程序化產生，未使用照片或第三方貼圖。

和光與 GINZA SIX 的立面構成參考官方公開資料，未複製照片；數值、來源與建模精度見 [實景參考清單](STREET_REFERENCES.md)。和光官方高度於執行時另行校正，不覆寫 OSM 原始高度。

## 參考

構想參考 [GAT-Taiwan-Pound](https://github.com/POUND0423/GAT-Taiwan-Pound)（信義區 3D 城市漫遊）。該專案未授予開源授權，本專案未複製其程式碼或素材。
