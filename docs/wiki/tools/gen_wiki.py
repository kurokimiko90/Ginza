"""產生 docs/wiki 靜態頁（2026-10-11 首版）。之後可直接改 HTML，或改本檔重跑：python3 docs/wiki/tools/gen_wiki.py"""
import pathlib, html

ROOT = pathlib.Path(__file__).resolve().parents[1]
UPDATED = '2026-10-11'


def legend():
    return '''<div class="legend">
  <span class="item"><span class="swatch" style="background:var(--human)"></span>人工（維護者／使用者操作）</span>
  <span class="item"><span class="swatch" style="background:var(--auto)"></span>自動腳本</span>
  <span class="item"><span class="swatch" style="background:var(--llm)"></span>LLM（本專案未使用）</span>
  <span class="item"><span class="swatch" style="background:var(--store);border:1px solid var(--line)"></span>檔案 / 儲存</span>
  <span class="item"><span class="swatch" style="background:var(--extern)"></span>外部 API</span>
</div>'''


def cards(items):
    return '<div class="cards">' + ''.join(
        f'<div class="card"><div class="label">{a}</div><div class="value">{b}</div><div class="desc">{c}</div></div>'
        for a, b, c in items) + '</div>'


def table(head, rows):
    th = ''.join(f'<th>{h}</th>' for h in head)
    tr = ''.join('<tr>' + ''.join(f'<td>{c}</td>' for c in r) + '</tr>' for r in rows)
    return f'<table><thead><tr>{th}</tr></thead><tbody>{tr}</tbody></table>'


def shot(path, alt, see, issue, nxt, depth=1):
    pre = '../' if depth else ''
    return f'''<figure class="shot"><img src="{pre}screenshots/{path}" alt="{alt}" loading="lazy">
<figcaption class="cap"><b>要看什麼</b>：{see}<br><b>常見問題</b>：{issue}<br><b>下一步</b>：{nxt}</figcaption></figure>'''


def box(kind, title, body):
    return f'<div class="{kind}"><div class="title">{title}</div>{body}</div>'


def code(text):
    return f'<pre><code>{html.escape(text.strip())}</code></pre>'


def node(cls, x, y, w, label, sub='', light=False):
    fill = 'white' if light else '#5A5248'
    s = f'<rect class="{cls}" x="{x}" y="{y}" width="{w}" height="50" rx="6"/>'
    s += f'<text x="{x + w / 2}" y="{y + 22}" class="lab" fill="{fill}" text-anchor="middle">{label}</text>'
    if sub:
        s += f'<text x="{x + w / 2}" y="{y + 40}" class="sub" fill="{fill}" text-anchor="middle">{sub}</text>'
    return s


SVG_STYLE = '''<defs><marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto"><path d="M0,0 L0,10 L10,5 z" fill="#5A5248"/></marker></defs>
<style>.lab{font:600 15px "Noto Sans JP",sans-serif}.sub{font:400 12.5px "Noto Sans JP",sans-serif;opacity:.85}.cap{font:700 13px "Noto Sans JP",sans-serif;fill:#5A5248;letter-spacing:.1em}
.nh{fill:#A89889}.na{fill:#F5C842}.ns{fill:#E8D5B7;stroke:#C9B89A}.ne{fill:#5A5248}.arrow{stroke:#5A5248;stroke-width:1.6;fill:none}</style>'''


def arrow(x1, y1, x2, y2):
    return f'<path class="arrow" d="M{x1} {y1} L{x2} {y2}" marker-end="url(#arrow)"/>'


PIPELINE_SVG = f'''<div class="flow"><svg viewBox="0 0 1080 250" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="資料到畫面的端到端流程">{SVG_STYLE}
<text x="95" y="24" class="cap" text-anchor="middle">① 取得</text><text x="315" y="24" class="cap" text-anchor="middle">② 轉換</text>
<text x="535" y="24" class="cap" text-anchor="middle">③ 靜態檔</text><text x="755" y="24" class="cap" text-anchor="middle">④ 組場景</text><text x="975" y="24" class="cap" text-anchor="middle">⑤ 漫遊</text>
{node('nh', 25, 40, 140, '維護者執行', '偶爾，資料要更新時', True)}
{node('ne', 25, 120, 140, 'OpenStreetMap', 'Overpass（4 備援）', True)}
{node('na', 245, 120, 140, '建築／道路／招牌', '轉成公尺座標')}
{node('ns', 465, 120, 140, 'city.json', 'roads.json（約 1 MB）')}
{node('na', 685, 120, 140, '瀏覽器即時生成', '建築、店面、人車、光')}
{node('nh', 905, 120, 140, '使用者', '鳥瞰／街道漫遊', True)}
{arrow(95, 86, 95, 118)}{arrow(165, 143, 243, 143)}{arrow(385, 143, 463, 143)}{arrow(605, 143, 683, 143)}{arrow(825, 143, 903, 143)}
<text x="755" y="200" class="sub" fill="#5A5248" text-anchor="middle">每次開網頁都重新生成，不存模型檔</text>
<text x="315" y="200" class="sub" fill="#5A5248" text-anchor="middle">高度缺漏時依占地面積估算</text>
</svg><div class="caption">只有 ① 需要網路與人工；②③ 的結果已放在專案內，④⑤ 在使用者瀏覽器內完成，沒有後端服務。</div></div>'''

LOAD_SVG = f'''<div class="flow"><svg viewBox="0 0 1080 200" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="網頁載入流程">{SVG_STYLE}
{node('nh', 10, 70, 120, '開啟網址', '可帶 #@視角 ?hour=', True)}
{node('ns', 160, 70, 130, '讀兩份 JSON', 'city / roads')}
{node('na', 320, 70, 130, '校正', '中央通り車道、地標高度')}
{node('na', 480, 70, 140, '生成場景', '建築→店面→人車→街具')}
{node('na', 650, 70, 130, '夜間照明圖', '路燈、橱窗、招牌')}
{node('na', 810, 70, 120, '設定時間', '太陽、窗光')}
{node('nh', 960, 70, 110, '開始操作', '鳥瞰或漫遊', True)}
{arrow(130, 93, 158, 93)}{arrow(290, 93, 318, 93)}{arrow(450, 93, 478, 93)}{arrow(620, 93, 648, 93)}{arrow(780, 93, 808, 93)}{arrow(930, 93, 958, 93)}
</svg><div class="caption">全部在瀏覽器內完成；任何一步失敗，畫面停在「載入失敗：原因」。</div></div>'''

SHOP_SVG = f'''<div class="flow"><svg viewBox="0 0 1080 220" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="店面業態決定流程">{SVG_STYLE}
{node('ns', 10, 30, 150, '臨街外牆', '沒有相鄰建築擋住')}
{node('na', 200, 30, 150, '切成約 5.5 m 分節', '每節一扇門＋櫥窗')}
{node('ns', 200, 130, 150, 'OSM 店家分類', 'shop / amenity')}
{node('na', 390, 30, 170, '決定業態', '6 m 內同向店家優先')}
{node('na', 600, 30, 170, '同業態相鄰合併', '一間店只有兩端側牆')}
{node('na', 810, 30, 180, '玻璃後畫出店內', '隨視角改變透視')}
{node('nh', 810, 130, 180, '使用者走過', '看見縱深與陳列', True)}
{arrow(160, 53, 198, 53)}{arrow(350, 53, 388, 53)}{arrow(350, 153, 475, 78)}{arrow(560, 53, 598, 53)}{arrow(770, 53, 808, 53)}{arrow(900, 78, 900, 128)}
</svg><div class="caption">沒有店家資料的牆面，整面牆共用一個依比例抽樣的業態，避免一間店被切成不同業態的小隔間。</div></div>'''


PAGES = []


def page(path, pid, crumb, title, lede, body):
    PAGES.append((path, pid, crumb, title, lede, body))


# ---------------------------------------------------------------- 入口
page('index.html', 'home', '產品文檔 · 入口', '銀座 3D 漫遊', '用 OpenStreetMap 資料，在瀏覽器裡重建東京銀座一〜八丁目約 1.2 × 1.5 km 的街區，可從空中鳥瞰，也能以第一人稱走在街上。純靜態網頁，沒有建置步驟與後端。',
    cards([
        ('建築', '2,548 棟', 'OSM 外形；約九成高度為估算'),
        ('店家招牌', '1,257 筆', '網頁最多顯示 512 塊；含 149 個大樓頂部招牌'),
        ('街上活動', '170 車 · 2,200 人', '靠左行駛、沿人行道走、路口隨機轉向'),
        ('建置與依賴', '0 步驟', '不需 npm install；Three.js r180 隨附'),
    ]) + '<h2>五分鐘速覽</h2><p>維護者偶爾從 OpenStreetMap 抓一次資料，轉成兩份 JSON 放在專案裡。之後每次有人打開網頁，瀏覽器就讀這兩份檔案，當場生成建築、店面、招牌、人車、花壇、路燈與日夜光線。</p>'
    + legend() + PIPELINE_SVG
    + shot('overview/02-street-day.jpg', '白天街景', '石材鋪裝、店面分節、行道樹；此圖為「專注看景」模式，面板已隱藏。', '截圖是 2026-10-09 版本，店面玻璃後尚未有店內縱深；最新外觀見「店面與店內縱深」。', '<a href="workflow/shops.html">③ 店面與店內縱深</a>', 0)
    + '<h2>給接手人的閱讀路徑</h2>' + cards([
        ('30 分鐘', '看懂產品', '本頁 → 這是什麼 → 功能一覽 → 端到端流程'),
        ('1 小時', '能跑能修', '+ 啟動與測試 + 故障排查 + 檔案地圖'),
        ('半天', '能加功能', '+ ①〜④ 流程頁 + 資料格式 + 想加 X 改哪'),
    ]) + box('note', '本站為誰而寫', '主要讀者是<b>日後接手或回頭維護這個專案的開發者</b>。每頁都假設你「明天要負責它」。若某段含糊、不可執行、或寫的是沒確認過的推論——那就是 bug，請直接改 HTML。'))

# ---------------------------------------------------------------- 產品
page('product/overview.html', 'product-overview', '產品 · 這是什麼', '這是什麼 / 給誰', '一個可以在瀏覽器裡逛的銀座。重點是「像在街上走」的感覺，而不是精確測量。',
    '<h2>解決什麼問題</h2><p>地圖服務能看平面與照片，卻很難自由地「走一段銀座」：轉個彎看看並木通り、晚上看招牌亮起來、停在和光鐘樓前抬頭。本專案用公開地圖資料，在任何電腦的瀏覽器裡提供這種體驗，不需要安裝或帳號。</p>'
    + '<h2>怎麼處理</h2>' + cards([
        ('看法', '2 種', '城市鳥瞰、第一人稱街道漫遊'),
        ('時間', '05:00–22:00', '依東京緯度與日期估算太陽位置'),
        ('地標', '4 處', '和光、歌舞伎座、GINZA SIX、東急プラザ銀座'),
        ('店內業態', '12 種', '服飾、珠寶、甜點、喫茶、餐廳、便利店等'),
    ])
    + '<h2>考慮了哪些情況</h2>' + table(['情境', '系統怎麼應對'], [
        ['OSM 沒有建築高度（約九成）', '依占地面積估算並加小幅隨機；每棟記錄高度來源（method）'],
        ['不確定的實景細節（路燈位置、遮陽棚、藍色街名牌）', '不放置，或只在文件中標為「示意」；寧缺勿假'],
        ['地標需要準確', '和光、GINZA SIX 依官方公開資料校正高度與立面構成'],
        ['手機或窄螢幕', '觸控方向鍵、窄版面；未做完整手機實機驗收'],
        ['想分享某個角度', '網址 <code>#@x,z,方位,仰角</code> 直接進入該位置；<code>?hour=</code> 固定時間'],
    ])
    + '<h2>為什麼這樣設計</h2>' + box('tip', '設計取捨', '選擇「純靜態＋瀏覽器即時生成」：部署只要丟資料夾，五年後仍能打開；代價是外觀細節全靠程序化繪製，與實景有差距。專案文件刻意區分「實景參考」與「示意」，避免使用者把示意當成事實。')
    + box('warn-box', '業主確認區', '下列內容未從程式碼得到，需專案擁有者補充：<ul><li>對外公開的網址與部署方式（目前只確認可放 GitHub Pages）</li><li>是否有使用者數、造訪量等目標</li><li>此專案的定位：個人作品集／教學示範／其他（訪談答覆：個人作品，主要給接手開發者）</li></ul>'))

page('product/features.html', 'product-features', '產品 · 功能', '功能一覽', '使用者能看到、能操作的東西。每項標明「實景參考」或「示意」。',
    '<h2>解決什麼問題</h2><p>接手時最常問的是「這功能在畫面哪裡、是真的還是畫出來的」。本頁逐項列出，並附截圖。</p>'
    + '<h2>怎麼處理</h2>' + table(['功能', '使用者看到什麼', '真實程度'], [
        ['城市鳥瞰', '拖曳旋轉、滾輪縮放（朝游標方向）、右鍵平移；浮出街名', '建築外形來自 OSM；高度多為估算'],
        ['街道漫遊', 'WASD／方向鍵、Shift 加速、滑鼠轉頭；碰撞沿牆滑動', '碰撞以建築外形計算'],
        ['輕鬆看景', '一鍵到「街邊花壇／夜景燈箱」；自動前進、遇阻擋停止', '觀景點為程式挑選，非尋路'],
        ['地標定位', '飛到和光等 4 處上空或街上最佳觀看點', '和光、GINZA SIX 依官方資料校正'],
        ['店面與店內', '約 5.5 m 一節的櫥窗；玻璃後可看到 12 種業態的店內陳列', '業態取自鄰近 OSM 店家分類；陳列為同業態典型構成'],
        ['招牌', 'OSM 真實店名：橫式、直式、大樓頂部、多租戶袖看板', '店名真實；招牌位置為點位推算'],
        ['花壇與行道樹', '中央通り 104 處綠化點、四區不同花色', '參考官方植栽主題；非逐株實測'],
        ['日夜', '05:00–22:00 滑桿與日光／傍晚／夜景快捷鍵', '太陽位置為近似計算；夜光為靜態近似'],
        ['明信片', '把目前視角存成 PNG（不含介面）', '—'],
    ])
    + shot('overview/01-bird-view.jpg', '城市鳥瞰', '傍晚 19:30 的鳥瞰，浮出街名標籤，右下小地圖。', '截圖為 2026-10-09 版本，建築配色已調整，外觀可能不同。', '<a href="../workflow/page-load.html">② 網頁載入與組場景</a>')
    + '<div class="shots">'
    + shot('functional/shops/01-oblique-day.jpg', '斜看店面', '玻璃後的服飾店與化妝品店有縱深，斜看時後牆與側牆會移動。', '若玻璃後是一片白或黑，見故障排查「店內一片白」。', '<a href="../workflow/shops.html">③ 店面與店內縱深</a>')
    + shot('functional/walk/01-easy-explore.jpg', '輕鬆看景', '頂部提示「已到達街邊花壇」，下方左轉／自動前進／右轉。', '自動前進遇到牆會停，這是設計而不是當機。', '<a href="../ops/troubleshooting.html">故障排查</a>')
    + shot('functional/landmarks/01-wako.jpg', '和光鐘樓', '石材立面、鐘面指針隨時間滑桿轉動。', '截圖為 2026-10-09 版本。', '<a href="../tech/stack.html">技術棧</a>')
    + shot('functional/greenery/01-flowerbed-day.jpg', '中央通り花壇', '長條低邊框花壇、樹冠與步道避讓。', '花壇擋路時，見「想加 X 改哪」的綠化段。', '<a href="../ops/upgrade-hooks.html">想加 X 改哪</a>')
    + '</div><h2>考慮了哪些情況</h2>' + table(['情境', '系統怎麼應對'], [
        ['滑鼠無法鎖定（Pointer Lock 被擋）', '改用拖曳轉頭'],
        ['使用者想專心看景', '「專注看景」隱藏面板，保留停止自動前進的控制'],
        ['標籤彼此重疊或擋住介面', '街名與地標標籤自動避讓'],
    ])
    + '<h2>為什麼這樣設計</h2>' + box('tip', '「示意」要說出來', 'README、docs 與本 wiki 都標出哪些是示意：曾經放過未核實的路燈、遮陽棚與藍色名牌，後來撤下。接手時新增細節也請比照：查得到來源才當「實景」，否則寫明示意。'))

page('product/numbers.html', 'product-numbers', '產品 · 數字', '規模與數字', '可量化的規模，方便判斷改動影響範圍。數字來自程式常數與資料檔，不是效能基準。',
    '<h2>解決什麼問題</h2><p>改動前需要知道「量有多大」：例如新增一種店內業態，會影響多少面牆；加人流會不會拖慢。</p>'
    + '<h2>怎麼處理</h2>' + table(['項目', '數字', '來源'], [
        ['建築', '2,548 棟', 'city.json buildings'],
        ['店家／設施點位', '1,174 筆（OSM 抓取）', 'work/ginza_poi.json'],
        ['招牌資料', '1,257 筆（頂部 149）', 'city.json signs'],
        ['畫面上招牌上限', '橫式 320 + 直式 192，最多實際放 512', '招牌圖集容量'],
        ['袖看板', '177 塊', 'city.json boards'],
        ['車輛／行人', '170 / 2,200', 'web/life.js 常數'],
        ['店內業態', '12 種，每種 6 個面', 'web/shop-types.js'],
        ['綠化點', '104 處（官方 136 株）', 'README'],
        ['地圖範圍', '緯度 35.6650–35.6775、經度 139.7590–139.7720', 'scripts/fetch_osm.py'],
        ['自動測試', '12 個 Node 測試 + 1 個 Python 測試', 'tests/'],
    ])
    + '<h2>考慮了哪些情況</h2>' + table(['情境', '影響'], [
        ['招牌超過 512 塊', '頂部招牌優先，再依離主要道路距離；遠處小店不顯示'],
        ['OSM 店家分類分布', '餐廳 335、咖啡 120、便利店 59、服飾 56、珠寶 28…（決定店內業態的比例）'],
    ])
    + box('warn-box', '業主確認區', '沒有正式的效能基準。介面右下角 FPS 為瞬時值，不能當效能結論；若要比較效能，需另定固定視角與設備。'))

# ---------------------------------------------------------------- 流程
page('workflow/pipeline.html', 'workflow-pipeline', '流程 · 總覽', '端到端流程', '從公開地圖資料到使用者畫面的五步。只有第一步需要網路與人工。',
    legend() + PIPELINE_SVG + '<h2>解決什麼問題</h2><p>3D 城市通常依賴大型模型檔或伺服器。本專案把「資料轉換」與「畫面生成」分開：轉換一次、結果放進專案；畫面每次在瀏覽器裡現做。</p>'
    + '<h2>每一步做什麼</h2>' + table(['步驟', '誰做', '何時', '詳細'], [
        ['① 取得', '<span class="badge human">人工</span> 觸發 <span class="badge extern">外部</span>', '想更新地圖時', '<a href="data-rebuild.html">重建地圖資料</a>'],
        ['② 轉換', '<span class="badge auto">自動</span>', '緊接 ①', '<a href="data-rebuild.html">重建地圖資料</a>'],
        ['③ 靜態檔', '<span class="badge store">儲存</span>', '隨專案提交', '<a href="../tech/data-schema.html">資料格式</a>'],
        ['④ 組場景', '<span class="badge auto">自動</span>', '每次開網頁', '<a href="page-load.html">網頁載入</a>、<a href="shops.html">店面</a>、<a href="day-night.html">日夜</a>'],
        ['⑤ 漫遊', '<span class="badge human">使用者</span>', '—', '<a href="../product/features.html">功能一覽</a>'],
    ])
    + '<h2>考慮了哪些情況</h2>' + table(['情境', '怎麼應對'], [
        ['Overpass API 忙碌或失敗', '依序嘗試 4 個公開節點'],
        ['只想補缺的檔案', '<code>fetch_osm.py --skip-existing</code>'],
        ['離線開發', '② 只讀本機 work/ 的原始資料，不需網路'],
    ])
    + box('tip', '為什麼這樣設計', '把可重複、耗時的轉換放在 Python 腳本，網頁只負責呈現：資料出錯時看 JSON 就能定位，不必在瀏覽器裡除錯。'))

page('workflow/data-rebuild.html', 'workflow-data', '流程 · ①', '① 重建地圖資料', '把 OpenStreetMap 的建築、道路、店家，轉成網頁能直接用的公尺座標 JSON。',
    '<h2>解決什麼問題</h2><p>OSM 原始資料是經緯度、標籤雜亂、高度常缺。網頁需要的是：以銀座四丁目為原點的公尺座標、每棟樓都有高度、每個店名已決定貼在哪面牆。</p>'
    + '<h2>怎麼處理</h2>' + cards([
        ('原點', '銀座四丁目', '35.6712, 139.7655；x 往東、z 往南'),
        ('高度來源', '4 層優先序', 'OSM height → 樓層 × 3.4 m → 知名建築補正 → 面積估算'),
        ('招牌', '25 m 內最近外牆', '每面牆最多 3 塊；保留 OSM 分類給店內業態'),
        ('執行時間', '數秒', '② 只讀本機檔案（實測未計時，屬推論）'),
    ])
    + '<h3>操作步驟</h3>' + code('''python3 scripts/fetch_osm.py                  # ① 取得：Overpass → work/ginza_osm.json、work/ginza_poi.json
python3 scripts/fetch_osm.py --skip-existing  # 只補缺少的檔案
python3 scripts/build_city.py                 # ② 轉換 → web/assets/city.json、roads.json
python3 tests/test_build_city.py              # 確認裁剪與欄位保留''')
    + '<p><b>什麼時候用</b>：想要最新 OSM 資料、改了地圖範圍、或改了招牌／地標規則之後。<b>為什麼重要</b>：網頁只讀 JSON，不重建就看不到規則改動。</p>'
    + '<h2>考慮了哪些情況</h2>' + table(['情境', '怎麼應對'], [
        ['建築中心在範圍外', '整棟裁掉；道路則只裁掉範圍外線段'],
        ['名稱含「ビル」等字', '不做頂部招牌，避免整排「〇〇ビル」'],
        ['同一建築 2 家以上店且高 ≥ 12 m', '加多租戶袖看板'],
        ['重跑結果是否穩定', '同一份原始資料重跑，輸出完全相同（2026-10-11 實測比對）'],
    ])
    + box('warn-box', '授權', 'city.json、roads.json 是 OSM 衍生資料庫，依 ODbL 1.0；公開時須保留「© OpenStreetMap contributors」，詳見 <code>docs/ATTRIBUTION.md</code>。'))

page('workflow/page-load.html', 'workflow-load', '流程 · ②', '② 網頁載入與組場景', '打開網頁後，瀏覽器在數秒內把兩份 JSON 變成可走動的街區。',
    legend() + LOAD_SVG
    + '<h2>解決什麼問題</h2><p>上千棟建築、上萬個店面零件、兩千多個行人，若一個一個畫會很慢。這一步把同類物件合併成少數幾批繪製，並在開始前完成地標校正。</p>'
    + '<h2>怎麼處理</h2>' + table(['順序', '做什麼', '白話說明'], [
        ['1', '讀資料', '同時下載 city.json 與 roads.json'],
        ['2', '校正', '依平行步道修正中央通り車道寬度；和光、GINZA SIX 套用官方高度（不改原始資料）'],
        ['3', '建築', '外形擠出成樓，貼上程序化窗格；地標用專屬立面'],
        ['4', '街景', '店面櫥窗與店內、招牌燈箱、花壇行道樹、路燈信號'],
        ['5', '人車', '依道路網生成，靠左行駛、沿人行道行走'],
        ['6', '夜間照明圖', '把路燈、招牌、櫥窗位置畫成一張光照圖，讓低處地面與牆面入夜變亮'],
        ['7', '時間與視角', '依現在東京時間（或 ?hour=）設定光線；若網址帶 #@ 視角就直接進入漫遊'],
    ])
    + '<h2>考慮了哪些情況</h2>' + table(['情境', '怎麼應對'], [
        ['用 file:// 直接開 index.html', '瀏覽器會擋 ES module 與 fetch；必須用本機伺服器'],
        ['JSON 載入失敗', '畫面顯示「載入失敗：原因」，主控台記錄錯誤'],
        ['夜晚時間開啟', '時間限制在 05:00–22:00 之間'],
    ])
    + box('tip', '為什麼這樣設計', '同材質物件合併為一批、人車用實例化繪製：數量級是「幾十次繪製」而不是「上萬次」，一般筆電也能流暢走動。'))

page('workflow/shops.html', 'workflow-shops', '流程 · ③', '③ 店面與店內縱深', '沿街一樓的櫥窗，以及玻璃後隨視角變化的店內陳列。2026-10-11 新增。',
    legend() + SHOP_SVG
    + '<h2>解決什麼問題</h2><p>過去櫥窗是一張平面圖，走近或斜看都像貼紙。真的挖空建築做室內，會讓上千面牆的幾何變複雜。現在的做法是：玻璃只是一片面，但畫面上會「算出」玻璃後一間約 3.6 m 深的房間，斜看時後牆、側牆、地板與家具會正確移動。</p>'
    + '<h2>怎麼處理</h2>' + cards([
        ('房間', '3.6 m 深', '高 3.5 m；寬＝店面寬，寬店每約 5.5 m 重複一組陳列'),
        ('層次', '後牆 + 2 層', '櫥窗陳列（0.85 m）＋ 櫃台桌子（2.05 m）'),
        ('業態', '12 種', '依附近 OSM 店家分類，或整面牆抽樣'),
        ('額外幾何', '0', '仍是一片玻璃；不能走進店內'),
    ])
    + table(['業態', 'OSM 分類例', '典型陳列（參考銀座同業態常見擺放）'], [
        ['精品服飾', 'clothes, shoes, bag', '櫥窗兩側人台、中央摺疊台、後牆燈箱壁龕放包、掛衣桿'],
        ['珠寶鐘錶', 'jewelry, watches', '柱形玻璃罩展示台、腰高亮燈玻璃櫃、壁面燈箱、水晶吊燈'],
        ['甜點', 'confectionery, bakery, deli', '全寬冷藏玻璃櫃兩層蛋糕、禮盒層架、後方暖簾'],
        ['喫茶', 'cafe, fast_food', '窗邊小圓桌曲木椅、吧台咖啡機、黑板菜單、吊燈'],
        ['餐廳酒吧', 'restaurant, bar, pub', '白桌布雙人桌、背光酒架、吧台高腳椅'],
        ['化妝品', 'beauty, chemist', '白色試用島台、色號格架、品牌燈箱'],
        ['書店文具', 'books, stationery', '高書架、平台疊書、窗邊筆記本陳列'],
        ['畫廊', 'gallery, art, museum', '白牆掛畫與投射燈、長凳、小雕塑'],
        ['便利店', 'convenience, supermarket', '沿窗雜誌架、貨架端面、後方飲料冷藏櫃'],
        ['生活雜貨', 'gift, houseware, knives', '階梯陳列台、木層架陶器、刀具有孔板'],
        ['銀行窗口', 'bank, travel_agency', '窗口櫃台與螢幕、等候椅、ATM'],
        ['美髮', 'hairdresser', '鏡台燈條、背向街道的美髮椅'],
    ])
    + '<div class="shots">'
    + shot('functional/shops/02-jewelry-day.jpg', '珠寶店白天', '玻璃櫃在前、壁面燈箱在後，兩層有前後遮擋。', '店名與業態對不上時，可能是 6 m 內有別家店的點位。', '<a href="../ops/upgrade-hooks.html">想加 X 改哪</a>')
    + shot('functional/shops/03-convenience-day.jpg', '便利店白天', '多個分節合成一間店，只有兩端有側牆。', '若每節各自有側牆，代表相鄰分節業態不同。', '<a href="../tech/files.html">檔案地圖</a>')
    + shot('functional/shops/04-cafe-night.jpg', '喫茶夜間', '暖色光、吊燈、吧台與窗邊座位。', '夜間太亮或太暗：調整店內日夜亮度係數。', '<a href="../ops/troubleshooting.html">故障排查</a>')
    + shot('functional/shops/01-oblique-day.jpg', '斜看', '斜看時後牆與側牆位移，呈現縱深。', '非常貼近斜看時，家具是薄片。', '<a href="day-night.html">④ 時間與夜景</a>')
    + '</div><h2>考慮了哪些情況</h2>' + table(['情境', '系統怎麼應對'], [
        ['附近沒有店家點位', '整面牆共用一個業態，依目測比例抽樣（服飾最多，其次喫茶、珠寶…）；不抽便利店、美髮這類需要明確資料的業態'],
        ['同一面牆有兩家不同店', '依各分節最近的店家決定；不同業態之間有側牆隔開'],
        ['店面很窄（< 5.5 m）', '取陳列中段，不把家具壓扁'],
        ['店面很寬', '每約 5.5 m 重複一組陳列，不把家具拉長'],
        ['和光、GINZA SIX、GINZA PLACE', '不套用通用店面，由實景參考立面處理'],
        ['白天 vs 夜晚', '白天店內約為夜間亮度一半並帶玻璃反光；便利店／銀行偏冷白光'],
    ])
    + box('tip', '為什麼這樣設計', '這種「在玻璃上算出房間」的做法是遊戲常用的室內貼圖技巧：成本跟店面數量無關、不改建築外形、一次繪製。代價是不能進店、店內不接收建築陰影，近距離斜看時家具是平面。')
    + '<h2>截圖清單（給維護者）</h2>' + table(['截圖', '網址參數', '對應源檔案'], [
        ['shops/01-oblique-day', '<code>?hour=13#@-92,60,170,-3</code>', 'web/shop-interiors.js, web/shop-paint-retail.js, web/streetscape.js'],
        ['shops/02-jewelry-day', '<code>?hour=13#@-423.1,121.9,131,-4</code>', 'web/shop-paint-retail.js, web/shop-interiors.js'],
        ['shops/03-convenience-day', '<code>?hour=13#@98.0,-469.3,200,-4</code>', 'web/shop-paint-food.js, web/shop-types.js'],
        ['shops/04-cafe-night', '<code>?hour=20#@-533.0,618.1,215,-4</code>', 'web/shop-paint-food.js, web/shop-interiors.js'],
    ]))

page('workflow/day-night.html', 'workflow-time', '流程 · ④', '④ 時間與夜景', '時間滑桿改變太陽、天色、窗光、招牌與店內亮度。',
    '<h2>解決什麼問題</h2><p>銀座的魅力一半在夜晚。但上千盞真實燈光即時計算太重，因此用「預先畫好的光照圖＋發光材質」近似夜景。</p>'
    + '<h2>怎麼處理</h2>' + table(['元素', '白天', '夜晚'], [
        ['太陽', '依東京緯度與當天日期估算方位與高度', '降到地平線下，改用夜間補光'],
        ['建築窗格', '反光玻璃', '約六成窗格亮燈，部分拉窗簾'],
        ['店內', '約夜間一半亮度＋玻璃反光', '全亮，依業態暖光或冷白光'],
        ['招牌與燈箱', '微亮', '主要光源，袖看板合併金屬外殼與柔光'],
        ['地面', '石材鋪裝', '路燈、招牌、櫥窗前出現暖色光池（7 m 以上不受影響）'],
    ])
    + shot('functional/time/01-street-night.jpg', '夜間街景', '地面光池、窗格點燈、招牌為主要亮點。', '截圖為 2026-10-09，店面尚無店內縱深。', '<a href="../ops/troubleshooting.html">故障排查</a>')
    + shot('functional/signs/01-lightbox-night.jpg', '夜間燈箱', '袖看板與橫式招牌的光暈層次。', '同上，為舊版店面外觀。', '<a href="../ops/upgrade-hooks.html">想加 X 改哪</a>')
    + '<h2>考慮了哪些情況</h2>' + table(['情境', '怎麼應對'], [
        ['想分享固定時刻的畫面', '<code>?hour=20</code>；也可用面板「日光／傍晚／夜景」'],
        ['牆角溢光', '已知限制：光照圖不算建築遮擋'],
        ['人車、樹木等實例化物件', '不注入光照圖，避免材質相容問題'],
    ])
    + box('tip', '為什麼這樣設計', '一張 2048² 光照圖的成本與路燈數量無關；代價是沒有即時陰影與反射。文件中已明確標示「不是即時照明」。'))

# ---------------------------------------------------------------- 技術
page('tech/stack.html', 'tech-stack', '技術 · 技術棧', '技術棧與設計取捨', '選了什麼、為什麼、放棄了什麼。',
    '<h2>解決什麼問題</h2><p>接手者需要知道哪些限制是刻意的（例如沒有 npm），避免「順手現代化」破壞零建置的特性。</p>'
    + table(['層', '使用', '為什麼'], [
        ['3D', 'Three.js r180（隨附在 web/vendor）', '成熟、不需打包；以 importmap 載入'],
        ['網頁', '原生 ES modules、Canvas 2D 繪製貼圖', '零建置；貼圖程序化產生，無版權素材'],
        ['資料處理', 'Python 3 標準庫', '抓取與轉換一次性執行，不需套件'],
        ['本機伺服器', 'Node 內建 http（web/server.cjs）', '只聽 127.0.0.1、擋 ../ 路徑'],
        ['測試', 'Node assert（.mjs）＋ Python unittest', '純資料模組可在 Node 直接測'],
        ['部署', '任何靜態主機（如 GitHub Pages）', 'web/ 內全為相對路徑'],
    ])
    + '<h2>關鍵技術手法</h2>' + table(['手法', '用在哪', '白話'], [
        ['幾何合併', '建築、店面、招牌', '同材質的東西併成一大塊，一次畫完'],
        ['實例化繪製', '行人、車輛、樹、花', '同一個模型畫幾千次只算一次'],
        ['頂點著色器動畫', '行人擺臂擺腿', '動作在顯示卡上算，不佔主程式'],
        ['室內貼圖（interior mapping）', '店內縱深', '在玻璃上用視線算出虛擬房間'],
        ['靜態光照圖', '夜間地面與低層牆面', '把燈光預先畫成一張圖'],
    ])
    + '<h2>考慮了哪些情況</h2>' + table(['想做的事', '目前結論'], [
        ['加 npm / 打包工具', '不建議：失去零建置；若真需要，先另開分支評估'],
        ['接 PLATEAU 精確建築', '未接入；文件不宣稱達到 PLATEAU 精度'],
        ['即時陰影與反射', '只有建築陰影開關；店內與光照圖不吃陰影'],
    ])
    + box('tip', '為什麼這樣設計', '目標是「五年後打開還能跑」。每多一個依賴，就多一個會壞的理由。'))

FILES = [
    ['scripts/fetch_osm.py', '資料', 'Overpass 抓建築／道路與店家點位'],
    ['scripts/build_city.py', '資料', '轉公尺座標、估高度、找地標、輸出 JSON'],
    ['scripts/signage.py', '資料', '招牌、袖看板、街名、和光鐘樓位置；保留店家分類 cat'],
    ['web/app.js', '入口', '組場景、鳥瞰／漫遊切換、輸入、時間、小地圖、明信片'],
    ['web/city.js', '建築', '建築網格、窗格貼圖、地標立面、地面與道路'],
    ['web/streetscape.js', '店面', '店面分節、門框貼圖、招牌圖集；串接店內'],
    ['web/shop-layout.js', '店面', '店面分節（純資料）'],
    ['web/shop-types.js', '店內', 'OSM 分類 → 業態、就近招牌、同業態合併（純資料）'],
    ['web/shop-interiors.js', '店內', '室內貼圖著色器、圖集組裝、業態光色'],
    ['web/shop-paint-kit.js', '店內', '公尺座標畫筆、人台／桌椅／層架等共用輪廓'],
    ['web/shop-paint-retail.js', '店內', '服飾、珠寶、化妝品、書店、畫廊、雜貨陳列'],
    ['web/shop-paint-food.js', '店內', '甜點、喫茶、餐廳、便利店、銀行、美髮陳列'],
    ['web/lightboxes.js / night-style.js', '招牌', '燈箱外殼、柔光與光色'],
    ['web/signage.js', '招牌', '袖看板、和光鐘樓'],
    ['web/life.js / people.js', '人車', '道路網、車流人流、行人動畫'],
    ['web/decor-layout.js / decor.js', '街具', '行道樹花箱位置與繪製、道路淨空'],
    ['web/flowerbeds.js / bed-zones.js', '綠化', '花壇尺寸、四區配植'],
    ['web/infrastructure-layout.js / infrastructure.js', '街具', '路燈、信號柱'],
    ['web/road-layout.js / road-markings.js', '道路', '中央通り車道校正、路緣與標線'],
    ['web/references.js / photo-reference.js', '實景', '官方高度、立面與夜照參數'],
    ['web/surface-lighting.js', '光', '夜間光照圖與鋪裝圖樣注入'],
    ['web/sky.js', '光', '太陽位置、天色'],
    ['web/collision.js / movement.js', '漫遊', '碰撞、觀景點搜尋、移動'],
    ['web/server.cjs', '工具', '本機靜態伺服器'],
    ['tests/*.mjs, tests/test_build_city.py', '測試', '純資料模組與轉換腳本'],
    ['docs/*.md', '文件', '街景品質、實景參考清單、授權來源'],
]
page('tech/files.html', 'tech-files', '技術 · 檔案', '檔案地圖', '每個檔案負責什麼。標「純資料」的模組不依賴瀏覽器，可在 Node 測試。',
    '<h2>解決什麼問題</h2><p>約 30 個模組、單檔多在 300 行內。找「這個東西在哪改」時先看本表，再看 <a href="../ops/upgrade-hooks.html">想加 X 改哪</a>。</p>'
    + table(['檔案', '分類', '職責'], [[f'<code>{a}</code>', b, c] for a, b, c in FILES])
    + box('tip', '慣例', '新功能先寫「純資料」模組（位置、分類、規則）加 Node 測試，再寫繪製模組。這樣規則能測，繪製只負責畫。'))

page('tech/data-schema.html', 'tech-schema', '技術 · 資料', '資料格式', '網頁讀的兩份 JSON。座標單位為公尺，原點為銀座四丁目，x 往東、z 往南。',
    '<h2>解決什麼問題</h2><p>網頁的所有內容都從這兩份檔案長出來。改規則前先確認欄位語意，避免前後端（腳本與網頁）理解不一致。</p>'
    + code('''city.json   { origin:[lat,lon], bounds:[minX,minZ,maxX,maxZ],
              landmarks:[{label, id, target:[x,z], height}],
              signs:[{text, kind, cat?, x, z, nx, nz, room, top, slot, prio}],
              boards:[{names[], x, z, nx, nz, top}],
              streetSigns:[{name, en, x, z, dx, dz}], streets:[{name, en, x, z}],
              clock:{x, z, base, face:[x,z]},
              buildings:[{id, height, base, method, tone, outers:[[[x,z],…]], holes?, name?}] }
roads.json  [{kind, width, points:[[x,z],…], name?, en?}]''')
    + table(['欄位', '意思', '注意'], [
        ['signs.kind', 'crown（大樓頂部）／shop／restaurant／cafe…', '既有語意：所有 shop 標籤都歸成 "shop"'],
        ['signs.cat', 'OSM shop 或 amenity 的原值，例如 jewelry、convenience', '2026-10-11 新增；只有店家招牌有，頂部招牌沒有'],
        ['signs.nx, nz', '招牌所在外牆朝外的方向', '店內業態比對時要求方向一致'],
        ['buildings.method', '高度來源', '估算值不要當實測'],
        ['buildings.base', '架空建築的底部高度', 'base ≥ 2 的不做店面'],
    ])
    + box('warn-box', '授權', '兩份檔案屬 OSM 衍生資料（ODbL 1.0）。'))

# ---------------------------------------------------------------- 運營
page('ops/run-and-test.html', 'ops-run', '運營 · 啟動', '啟動與測試', '在本機跑起來、確認沒壞。',
    '<h2>啟動</h2>' + code('''node web/server.cjs              # http://127.0.0.1:8770/
PORT=8780 node web/server.cjs    # 換埠''')
    + '<p><b>什麼時候用</b>：每次開發。<b>為什麼</b>：瀏覽器不允許 file:// 載入模組與 JSON。需要 Node（驗證環境 v25）與支援 WebGL 2 的瀏覽器。</p>'
    + '<h2>常用網址</h2>' + table(['網址', '用途'], [
        ['<code>/#@-41,0,0,28</code>', '從交差點仰望和光'],
        ['<code>/?hour=13#@-92,60,170,-3</code>', '白天斜看中央通り店面'],
        ['<code>/?hour=20#@-533,618,215,-4</code>', '夜間喫茶店內'],
    ])
    + '<h2>測試</h2>' + code('''for t in tests/*.mjs; do node "$t" || echo "FAIL $t"; done
python3 tests/test_build_city.py''')
    + table(['測試', '檢查什麼'], [
        ['test_collision', '碰撞、沿牆滑動、地標觀景點可站立且不被遮擋'],
        ['test_shop_layout', '店面分節連續、可重現、相鄰圖樣不同'],
        ['test_shop_types', '分類 → 業態、抽樣可重現、就近招牌、同業態合併'],
        ['test_decor / road_layout / road_markings / infrastructure', '街具位置、道路淨空、車道校正'],
        ['test_surface_lighting / night_style', '夜間光照與燈箱光色'],
        ['test_references / movement', '官方高度、移動'],
        ['test_build_city.py', '資料轉換、裁剪與欄位保留'],
    ])
    + box('warn-box', '沒有自動化的部分', '畫面外觀沒有自動視覺回歸測試；改動繪製後請依 <a href="screenshots.html">截圖規範</a> 手動截圖比對。'))

page('ops/troubleshooting.html', 'ops-trouble', '運營 · 排查', '故障排查', '依「看到什麼」找原因。',
    table(['看到的症狀', '可能原因', '怎麼處理'], [
        ['畫面停在「載入失敗」', 'JSON 不存在或伺服器沒開', '確認 <code>node web/server.cjs</code> 正在跑；確認 web/assets/ 兩份 JSON 存在'],
        ['空白頁、主控台 module 錯誤', '用 file:// 開啟', '改用本機伺服器網址'],
        ['店內一片白／一片黑', '店內圖集或著色器編譯失敗', '看主控台 WebGL 錯誤；確認 shop-interiors.js 的業態數與 shop-types.js 一致'],
        ['店名是珠寶店，店內卻是服飾', '6 m 內最近的同向點位是另一家店，或該店 OSM 無分類', '查 city.json 該招牌的 cat；必要時調整比對距離'],
        ['一間店被切成好幾個小隔間', '相鄰分節業態不同', '確認附近點位分類；無點位的牆面應共用同業態'],
        ['招牌缺很多', '超過 512 塊上限', '頂部與臨大街優先，屬預期行為'],
        ['重建資料後地標不見', 'build_city.py 找不到地標名稱', '檢查 LANDMARKS 名稱是否與最新 OSM 一致'],
        ['Overpass 抓取失敗', '公開節點忙碌', '稍後重試；腳本會輪流試 4 個節點'],
        ['無法轉頭', 'Pointer Lock 被瀏覽器擋', '改用拖曳；或先點一下畫面'],
        ['自動前進突然停止', '遇到阻擋／按 Esc／視窗失焦', '設計如此，再按一次自動前進'],
    ])
    + box('tip', '除錯順序', '先看主控台錯誤 → 再看 JSON 資料 → 最後才看繪製程式。資料錯了，畫面一定錯。'))

page('ops/upgrade-hooks.html', 'ops-hooks', '運營 · 擴充', '想加 X 改哪', '常見擴充需求與要改的位置。改完都要跑測試並截圖確認。',
    table(['想做的事', '要改哪裡', '注意'], [
        ['新增一種店內業態', '<code>web/shop-types.js</code> 的 INTERIOR_TYPES 與 CATEGORY → <code>shop-paint-*.js</code> 新增 6 面畫法 → <code>shop-interiors.js</code> 的 PAINTERS 與 TINTS', '三處順序一致；補 test_shop_types'],
        ['調整某業態的陳列', '<code>web/shop-paint-retail.js</code> 或 <code>shop-paint-food.js</code>', '單位是公尺，y 由下往上；front／mid 是透明層'],
        ['改沒有點位時的業態比例', '<code>web/shop-types.js</code> 的 FALLBACK', '比例是目測估計，改動請在註解寫依據'],
        ['店內深度、陳列層位置', '<code>web/shop-paint-kit.js</code> 的 ROOM、LAYER_DEPTHS', '畫法以 5.5×3.5×3.6 m 為基準'],
        ['店內日夜亮度', '<code>web/shop-interiors.js</code> 片段著色器 mix(0.58, 1.12, uNight)', '—'],
        ['改地圖範圍', '<code>scripts/fetch_osm.py</code> 的 BBOX → 重抓 → 重建', '同步更新 ATTRIBUTION 範圍'],
        ['新增地標', '<code>scripts/build_city.py</code> LANDMARKS／LANDMARK_HEIGHT；<code>web/app.js</code> LANDMARK_NOTES', '加觀景點測試'],
        ['人車數量', '<code>web/life.js</code> CAR_COUNT、PEOPLE_COUNT', '先截圖看 FPS 變化'],
        ['行道樹間距', '<code>web/decor-layout.js</code> TREE_SPACING', '官方 136 株，勿宣稱逐株實測'],
        ['花壇尺寸與花色', '<code>web/flowerbeds.js</code> BED、ZONES', '—'],
        ['地標實景參數', '<code>web/references.js</code>、<code>photo-reference.js</code>', '附官方來源到 docs/STREET_REFERENCES.md'],
        ['招牌規則', '<code>scripts/signage.py</code> → 重建資料', '網頁只讀結果'],
    ])
    + box('tip', '原則', '查得到來源才當「實景」；否則在程式註解與文件寫「示意」。'))

page('ops/screenshots.html', 'ops-shots', '運營 · 截圖', '截圖規範', '本 wiki 的截圖如何命名、記錄來源、偵測過期。',
    '<h2>解決什麼問題</h2><p>改了繪製程式，舊截圖就會誤導讀者。每張截圖旁有同名 <code>.meta.json</code>，記錄截圖時間與對應源檔案；源檔案較新就代表截圖可能過期。</p>'
    + code('''cd docs/wiki
./scripts/capture-screenshots.sh list        # 引用了但不存在的截圖
./scripts/capture-screenshots.sh staleness   # 源檔案比截圖新的（可能過期）
./scripts/capture-screenshots.sh check       # 命名、大小、孤兒檔''')
    + table(['規則', '說明'], [
        ['路徑', '<code>screenshots/&lt;章節&gt;/&lt;頁面&gt;/&lt;NN&gt;-&lt;描述&gt;</code>，副檔名 jpg'],
        ['尺寸', '1280×720 視窗，存 JPEG（品質約 85）'],
        ['說明', '每張三行：要看什麼／常見問題／下一步'],
        ['固定畫面', '用網址 <code>?hour=</code> 與 <code>#@x,z,方位,仰角</code>，寫在 meta.json 的 url'],
        ['不做', '不放假截圖、不用與目前程式不符的圖卻不註明'],
    ])
    + box('warn-box', '目前已知過期', '<code>overview/02-street-day</code>、<code>functional/time/01-street-night</code>、<code>functional/signs/01-lightbox-night</code> 為 2026-10-09 版本，店面尚無店內縱深；已在說明中標註。staleness 依 git 提交時間判斷，未提交的改動不會被偵測到。'))


TEMPLATE = '''<!DOCTYPE html>
<html lang="zh-Hant">
<head>
  <meta charset="UTF-8">
  <title>{title} — 銀座 3D 漫遊</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="stylesheet" href="{pre}assets/style.css">
</head>
<body data-active="{pid}" data-depth="{depth}">
<div class="layout">
  <aside class="sidebar"></aside>
  <main class="main">
    <header class="page-head">
      <div class="crumb">{crumb}</div>
      <h1>{title}</h1>
      <p class="lede">{lede}</p>
    </header>
{body}
    <div class="footer"><span>銀座 3D 漫遊 · 接手文件</span><span>最後更新：{updated}</span></div>
  </main>
</div>
<script src="{pre}assets/sidebar.js"></script>
</body>
</html>
'''

for path, pid, crumb, title, lede, body in PAGES:
    depth = path.count('/')
    out = ROOT / path
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(TEMPLATE.format(title=title, pre='../' * depth, pid=pid, depth=depth, crumb=crumb, lede=lede, body=body, updated=UPDATED))
print(len(PAGES), 'pages')
