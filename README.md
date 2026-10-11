# Ginza — 銀座 3D 城市漫遊

以 OpenStreetMap 的建築與道路資料，在瀏覽器中呈現東京銀座（一〜八丁目及周邊，約 1.2 × 1.5 km）的立體城市，提供城市鳥瞰與第一人稱街道漫遊。

純靜態網頁：無建置步驟、無 `npm install`、無 API Key。Three.js r180 已隨附於 `web/vendor/`。

> 本專案參考 [GAT-Taiwan-Pound](https://github.com/POUND0423/GAT-Taiwan-Pound)（信義區版）的構想，但程式碼全部重新撰寫，未複製其原始碼（該專案未授予開源授權）。

接手文件（wiki，純 HTML，直接打開即可）：[docs/wiki/index.html](docs/wiki/index.html)

## 功能

- 街景質感：細顆粒柏油、石材鋪裝、叶簇樹冠、比例修正的橱窗與室內窗格；局部夜間暖光及「專注看景」模式。實作範圍、驗收與限制見 [街景質感優化](docs/STREET_QUALITY.md)。

- 實景校正：以 [和光官方規格](https://www.wako.co.jp/f/clock_tower/) 與 [GINZA SIX 官方建築介紹](https://ginza6.tokyo/magazine/detail/125505/) 校正兩處地標；以原始 OSM 過街標記繪製斑馬線。已撤下未逐點核實的樹木、燈柱與實體藍色街道名牌。參考範圍與仍未核對的部分見 [實景參考清單](docs/STREET_REFERENCES.md)。

- 美術：保留 3D 動畫化材質、柔和光影與人物，建築色板調整為較接近實景的石材與玻璃色系；和光改為方形石塔與阿拉伯數字鐘面，屋頂／塔體／避雷針採官方高度。
- 三種通用窗格間距、只在臨街可見外牆配置店面、圓潤車身與人物五官；中央通り參考官方桂樹及樹下花壇，加入 104 處近似綠化點（官方 136 株；非實測逐株位置），四個植栽區按官方設計主題區分植物，使用實例網格繪製1.1×2.2m長條低邊框、覆土、地被、細葉草、五瓣花與樹冠。花壇擴大後重新避讓步道、燈柱與店面；未核實的復古街燈仍不放置。
- 店內縱深：橱窗玻璃後以 interior mapping 呈現約 3.6 m 深的店內（後牆、側牆、地板、天花板與兩層陳列剖面，隨視角產生透視），不增加建築幾何。12 種業態（精品服飾、珠寶鐘錶、洋菓子／和菓子、喫茶、餐廳酒吧、化妝品、書店文具、畫廊、便利店、生活雜貨、銀行窗口、美髮）各有典型陳列：櫥窗人台、玻璃展示櫃、冷藏蛋糕櫃、吧台與吊燈、沿窗雜誌架等。業態取自鄰近 OSM 店家分類，無點位的牆面依目測比例抽樣；相鄰同業態分節合併為一間店。陳列為同業態常見構成，不是逐店實景。
- 近距離街景：現有 OSM 步道加上世界座標石材鋪裝；通用店面按約 5.5 m 分節，交替圖樣、玻璃入口與把手、石材分隔條。入口與鋪裝是示意設計，非實測；未核實的通用遮陽棚不再生成，不推測信號燈、路緣或盲道位置。
- 地標觀察提示、日光／傍晚／夜景快捷切換；「保存明信片」匯出目前視角的 PNG（只有場景，不含介面）。
- 輕鬆看景：首頁「街邊花壇／夜景燈箱」一鍵切換至街道觀景點並對準；「下一景點」輪換四個視角。自動前進免長按W，遇阻擋／Esc／失焦停止（非尋路）；屏幕左右轉向與Q/E、短促平滑加減速、碰撞小步進；沒有改成第三人稱，也沒有鏡頭搖晃。
- 街名與地標標籤會避開介面及彼此重疊；夜間保留橱窗商品細節並補上柔和環境光，天空使用與場景一致的色彩輸出。
- 夜景燈箱：現有橫式、縱式與多租戶袖看板增加合併金屬外殼與柔光，普通窗格降亮、橱窗和招牌保持主次。燈箱厚度／光效是藝術化示意，原招牌定位仍為 OSM 店家點位推算，不代表已逐店核對；柔光是深度測試的局部疊加，不是即時照明或真實地面反射。

- 城市鳥瞰：拖曳旋轉、滾輪縮放、右鍵平移
- 街道漫遊：WASD／方向鍵行走、Shift 加速、滑鼠轉頭（Pointer Lock；無法鎖定時可拖曳）
- 建築碰撞：玩家半徑、沿牆滑動、地圖邊界；中庭可走、架空建築下方可通行
- 地標定位：銀座四丁目・和光、歌舞伎座、GINZA SIX、東急プラザ銀座
  - 鳥瞰時飛到地標上空；漫遊時移到「視線第一個撞到的就是地標」的街道位置
- 時間 05:00–22:00：依東京緯度與當天日期近似計算太陽位置；入夜後窗格點燈
- 街景：一樓店面櫥窗與入口示意；OSM 真實店名招牌（橫式貼牆、日文短名做縦看板、大型商業建築頂部招牌）
- 車流與人流：約 170 輛車靠左行駛、約 2,200 位行人沿人行道行走，路口隨機轉向；銀座四丁目周邊較密集
  - 行人為程序化低多邊形人偶（頭髮、軀幹、四肢、鞋），擺臂擺腿在 vertex shader 計算，全部共用一次繪製；上衣／下身／膚色／髮色各自隨機
  - 車輛有側面輪廓（引擎蓋、擋風玻璃、車頂）、輪胎、保險桿與車燈
- 銀座識別：
  - 街道名牌：保留原有生成資料，因位置與樣式未核實而不在場景中顯示
  - 鳥瞰時街道上方浮出街名標籤；漫遊時畫面下方顯示目前所在街道
  - 袖看板：同一棟樓有多家店時，直立招牌逐層列出店名
  - 和光鐘樓：位於中央通り×晴海通り交差點的和光轉角，四面鐘的指針跟隨時間滑桿
- 夜間：窗格、櫥窗、招牌、鐘面發光，車燈變亮，路面有路燈反光
- 固定時間：網址加 `?hour=13`（5–22）以指定開場時間，例如 `?hour=20#@-533,618,215,-4`
- 分享視角：網址加 `#@x,z,方位角[,仰角]`（公尺／度，方位 0 = 北、90 = 東）直接在該處進入漫遊，例如 `#@-41,0,0,28` 從交差點仰望和光
- 建築陰影開關、小地圖（位置與朝向）、經緯度、FPS
- 手機：觸控方向鍵、窄螢幕版面

## 執行

需要 Node.js（驗證環境 v25）與支援 WebGL 2 的瀏覽器。

```sh
node web/server.cjs          # 開 http://127.0.0.1:8770/
PORT=8780 node web/server.cjs
```

伺服器只監聽 `127.0.0.1`，僅用 Node 內建模組。不要用 `file://` 直接開 `index.html`（ES module 與 fetch 會被瀏覽器擋）。

`web/` 內全為相對路徑，可直接放到 GitHub Pages 等任何靜態主機。

## 重建地圖資料

```sh
python3 scripts/fetch_osm.py    # Overpass API → work/ginza_osm.json（建築/道路）、work/ginza_poi.json（店家）
python3 scripts/fetch_osm.py --skip-existing   # 只補抓缺少的檔案
python3 scripts/build_city.py   # → web/assets/city.json、roads.json
```

- 範圍由 `scripts/fetch_osm.py` 的 `BBOX` 決定；`build_city.py` 會裁掉中心在範圍外的建築與範圍外的道路線段。
- 座標：以銀座四丁目交差點附近（`ORIGIN`）為原點，`x` 往東、`z` 往南（北為 `-z`），單位公尺。
- 標示資料由 `scripts/signage.py` 產生（`build_city.py` 呼叫）。
- 招牌：店家點位（`shop` / `amenity=restaurant,cafe…` / `tourism=hotel…` 且有 `name`）貼到 25 m 內最近的外牆，每面牆最多 3 塊；有名稱、高 20 m 以上且名稱不含「ビル」等字的建築加頂部招牌。招牌依離主要道路的距離排序，網頁端受貼圖集容量限制最多顯示 512 塊（頂部招牌優先，其次臨大街者）。
- 袖看板：同一建築 ≥2 家店且高 ≥12 m；網頁端最多 96 塊（店家多者優先）。
- 街道名牌：名稱含「通り」的街道，名牌立在路緣外 1.5 m、不落在建築內；鳥瞰標籤取總長前 14 條。
- 和光鐘樓：以中央通り與晴海通り共用節點的平均位置為交差點，鐘樓放在和光最靠近交差點的轉角內側。
- 建築高度優先序：OSM `height` → `building:levels × 3.4 m` → 知名建築補正值 → 依占地面積估算（加固定亂數擾動）。估算方式記錄在每棟的 `method` 欄位。

資料格式：

```text
city.json   { origin:[lat,lon], bounds:[minX,minZ,maxX,maxZ],
              landmarks:[{label, id, target:[x,z], height}],
              signs:[{text, kind, cat?, x, z, nx, nz, room, top, slot, prio}],   // cat：OSM shop/amenity 原值
              boards:[{names[], x, z, nx, nz, top}],
              streetSigns:[{name, en, x, z, dx, dz}], streets:[{name, en, x, z}],
              clock:{x, z, base, face:[x,z]},
              buildings:[{id, height, base, method, tone, outers:[[[x,z],…]], holes?, name?}] }
roads.json  [{kind, width, points:[[x,z],…], name?, en?}]
```

## 測試

```sh
node tests/test_collision.mjs
node tests/test_decor.mjs
node tests/test_references.mjs
node tests/test_shop_layout.mjs
node tests/test_shop_types.mjs
node tests/test_night_style.mjs
node tests/test_road_layout.mjs
node tests/test_infrastructure.mjs
node tests/test_movement.mjs
python3 tests/test_build_city.py
```

涵蓋碰撞規則（牆內／外、邊界、中庭、架空建築、沿牆滑動、最近可站立點），以及真實資料中每個地標的觀賞點：可站立、不貼牆（≥12 m）、視線不被其他建築遮擋。
街景測試另外檢查配置可重現、道路淨空、小物碰撞與地標觀賞點保留。
實景校正測試涵蓋官方高度、不覆寫 OSM 原始資料、過街標記與寬度解析，以及裁剪後的欄位保留。
店面分節測試檢查完整覆蓋、相鄰圖樣變化、穩定生成與無效長度；店內業態測試檢查分類對應、可重現抽樣、就近招牌比對與同業態合併。

## 目錄

```text
scripts/fetch_osm.py    抓 OSM 資料
scripts/build_city.py   轉換成網頁用 JSON
scripts/signage.py      招牌、袖看板、街道名牌、街名標籤、和光鐘樓位置
web/index.html          頁面
web/app.js              場景、視角切換、地標、小地圖、輸入
web/city.js             建築網格合併、程序化窗格、地面貼圖、道路帶狀面
web/streetscape.js      店面櫥窗、遮陽棚、招牌圖集
web/shop-layout.js      店面分節與圖樣（純資料）
web/shop-types.js       OSM 分類→店內業態、同業態分節合併（純資料）
web/shop-interiors.js   店內 interior mapping 著色器與圖集
web/shop-paint-kit.js   店內圖集繪製工具與共用家具輪廓
web/shop-paint-retail.js  物販類陳列（服飾、珠寶、化妝品、書店、畫廊、雜貨）
web/shop-paint-food.js  餐飲與服務類陳列（甜點、喫茶、餐廳、便利店、銀行、美髮）
web/lightboxes.js       合併燈箱外殼與局部柔光
web/night-style.js      燈箱光色選擇（純資料）
web/life.js             車流與人流（道路圖、InstancedMesh）、車輛模型
web/people.js           行人模型與走路動畫（shader）
web/signage.js          袖看板、街道名牌、和光鐘樓
web/decor-layout.js     街景位置、道路淨空與觀賞點避讓（純資料）
web/road-layout.js      依平行 OSM 步道校正中央通り預設車道寬度（非實測）
web/decor.js            實例化花箱樹木、街燈與夜間光暈
web/flowerbeds.js       長條花壇尺寸、分層配植與四區花色的示意參數
web/references.js       官方高度、已參考立面與推測招牌過濾
web/photo-reference.js  具體夜照來源、歷史時期與示意立面／光效參數
web/infrastructure-layout.js  中央通り路燈、過街信號柱近似布局與燈臂淨空
web/infrastructure.js   照片參考的乳白光柱、雙側燈臂、車用與行人信號（靜態示意）
web/sky.js              太陽位置、天色、夜間窗光
web/collision.js        碰撞與觀賞點搜尋（純函式，可在 Node 測試）
web/server.cjs          本機靜態伺服器
work/shot.mjs           驗證用：headless Chrome 截圖並收集 console 錯誤
tests/                  測試
docs/ATTRIBUTION.md     資料與素材來源
```

## 限制

- 約九成建築沒有 OSM 高度資料，為依占地面積估算；天際線與實景不完全相同。
- 外牆、窗格、道路寬度與標線皆為程序化示意，非實拍或測量資料。
- 中央通り原始 22m 預設寬度部分覆蓋 OSM 步道，現在按鄰近平行步道估算車道邊界（最小14m）。僅處理 `widthSource=estimated` 的預設路段，明確 OSM 寬度不變，中心線不移動。綠化點避開車道、過街線、店家點及地標觀賞點，步道中央保留1.2m；這是模型淨空檢查，不是現實無障礙合規認證。
- 地面為平面；首都高速等高架與地下道路未呈現；建築內部不可進入。
- 車與行人只沿道路線前進，沒有紅綠燈、不會互相避讓，也不與玩家碰撞；單行道未區分。
- 店面依道路鄰近與外牆朝向程序化配置，沒有店家精確門面範圍；車與行人不會避讓新增街景小物，但小物位置不佔道路資料所定義的行進範圍。
- 地面貼圖上限 4096 px（更大會在部分裝置耗盡 GPU 記憶體導致 WebGL Context Lost）。

## 授權

- 地圖資料：© OpenStreetMap contributors，ODbL 1.0 → 見 [docs/ATTRIBUTION.md](docs/ATTRIBUTION.md)
- Three.js：MIT（`web/vendor/LICENSE`）
