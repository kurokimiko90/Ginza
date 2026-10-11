// 共用側欄。每頁 <body data-active="<id>" data-depth="0|1">。
// 加頁面：在對應 section 的 items[] 加 { id, href, label }。
(() => {
  const sections = [
    { title: '入口', items: [{ id: 'home', href: 'index.html', label: '總覽' }] },
    { title: '產品', items: [
      { id: 'product-overview', href: 'product/overview.html', label: '這是什麼 / 給誰' },
      { id: 'product-features', href: 'product/features.html', label: '功能一覽' },
      { id: 'product-numbers', href: 'product/numbers.html', label: '規模與數字' },
    ] },
    { title: '流程', items: [
      { id: 'workflow-pipeline', href: 'workflow/pipeline.html', label: '端到端流程' },
      { id: 'workflow-data', href: 'workflow/data-rebuild.html', label: '① 重建地圖資料' },
      { id: 'workflow-load', href: 'workflow/page-load.html', label: '② 網頁載入與組場景' },
      { id: 'workflow-shops', href: 'workflow/shops.html', label: '③ 店面與店內縱深' },
      { id: 'workflow-time', href: 'workflow/day-night.html', label: '④ 時間與夜景' },
    ] },
    { title: '技術', items: [
      { id: 'tech-stack', href: 'tech/stack.html', label: '技術棧與設計取捨' },
      { id: 'tech-files', href: 'tech/files.html', label: '檔案地圖' },
      { id: 'tech-schema', href: 'tech/data-schema.html', label: '資料格式' },
    ] },
    { title: '運營', items: [
      { id: 'ops-run', href: 'ops/run-and-test.html', label: '啟動與測試' },
      { id: 'ops-trouble', href: 'ops/troubleshooting.html', label: '故障排查' },
      { id: 'ops-hooks', href: 'ops/upgrade-hooks.html', label: '想加 X 改哪' },
      { id: 'ops-shots', href: 'ops/screenshots.html', label: '截圖規範' },
    ] },
  ];
  const active = document.body.dataset.active || '';
  const prefix = (document.body.dataset.depth || '0') === '0' ? '' : '../';
  const el = document.querySelector('.sidebar');
  if (!el) return;
  el.innerHTML = `<div class="brand"><span class="dot"></span>銀座 3D 漫遊</div>` + sections.map((s) => `
    <h5>${s.title}</h5>
    <nav>${s.items.map((i) => `<a href="${prefix}${i.href}" class="${i.id === active ? 'active' : ''}">${i.label}</a>`).join('')}</nav>`).join('');
})();
