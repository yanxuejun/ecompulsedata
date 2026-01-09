import { NextRequest } from 'next/server';
import Papa from 'papaparse';
import categoriesData from '@/public/categories.json';

export const runtime = 'edge';

// 递归查找 catalog_name
function findCategoryName(nodes: any, code: any): string {
  for (const n of nodes) {
    if (n.code === code) return n.catalog_name;
    if (n.children) {
      const found = findCategoryName(n.children, code);
      if (found) return found;
    }
  }
  return '';
}

export async function POST(req: NextRequest) {
  const { filePath, csvContent: inputCsvContent } = await req.json();

  // Use inputCsvContent directly
  if (!inputCsvContent) {
    return new Response('CSV content must be provided in body', { status: 400 });
  }
  const csvContent = inputCsvContent;

  const parsed = Papa.parse(csvContent, { header: true });
  const rows = parsed.data.filter((r: any) => r.product_title);

  // 热门产品 Top 10：优先 rank<100 且 relative_demand>50，不足10个则补rank<100
  const parseNum = (v: any) => Number(String(v).replace(/[^\d.\-]/g, ''));
  const demandNum = (v: any) => {
    if (typeof v === 'string') {
      if (v.toLowerCase().includes('very high')) return 100;
      if (v.toLowerCase().includes('high')) return 75;
      if (v.toLowerCase().includes('medium')) return 50;
      if (v.toLowerCase().includes('low')) return 25;
    }
    return parseNum(v) || 0;
  };
  const rankNum = (v: any) => parseNum(v);
  // 先筛选rank<100且relative_demand>50
  let topProducts = rows.filter((r: any) => rankNum(r.rank) < 100 && demandNum(r.relative_demand) > 50);
  // 不足10个则补足
  if (topProducts.length < 10) {
    const extra = rows
      .filter((r: any) => rankNum(r.rank) < 100 && !topProducts.includes(r))
      .sort((a: any, b: any) => rankNum(a.rank) - rankNum(b.rank));
    topProducts = topProducts.concat(extra.slice(0, 10 - topProducts.length));
  }
  topProducts = topProducts.slice(0, 10);

  // Top Performing Products - no brand: 只展示 brand 为空或无效的数据，取前10
  const topNoBrandProducts = rows
    .filter((r: any) => !r.brand || String(r.brand).trim() === '' || r.brand === 'no brand')
    .sort((a: any, b: any) => rankNum(a.rank) - rankNum(b.rank))
    .slice(0, 10);

  // 品牌分布（只显示前10，其余合并为“other brands”，brand为空标记为no brand）
  const brandCount: Record<string, number> = {};
  rows.forEach((r: any) => {
    const brand = r.brand && String(r.brand).trim() ? r.brand : 'no brand';
    brandCount[brand] = (brandCount[brand] || 0) + 1;
  });
  const totalBrands = Object.values(brandCount).reduce((a: any, b: any) => a + b, 0);
  const sortedBrands = Object.entries(brandCount).sort((a: any, b: any) => b[1] - a[1]);
  const topN = 10;
  const topBrands = sortedBrands.slice(0, topN);
  const otherCount = sortedBrands.slice(topN).reduce((sum: any, [, count]: any) => sum + count, 0);
  const brandLabels = topBrands.map(([brand]: any) => brand).concat(otherCount > 0 ? ['other brands'] : []);
  const brandData = topBrands.map(([, count]: any) => count).concat(otherCount > 0 ? [otherCount] : []);
  // 品牌分布表格数据
  const brandTableRows = topBrands.map(([brand, count]: any) => ({
    brand,
    share: ((count / totalBrands) * 100).toFixed(1) + '%'
  }));
  if (otherCount > 0) {
    brandTableRows.push({ brand: 'other brands', share: ((otherCount / totalBrands) * 100).toFixed(1) + '%' });
  }

  // 需求量分布
  // const demandCount: Record<string, number> = {};
  // rows.forEach(r => {
  //   demandCount[r.relative_demand] = (demandCount[r.relative_demand] || 0) + 1;
  // });
  // const demandLabels = Object.keys(demandCount);
  // const demandData = Object.values(demandCount);
  // const demandChart = `https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify({
  //   type: 'bar',
  //   data: { labels: demandLabels, datasets: [{ label: '需求量分布', data: demandData }] },
  //   options: { title: { display: true, text: '需求量分布' } }
  // }))}`;

  // 用 quickchart.io 生成图表图片
  // const brandChart = `https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify({
  //   type: 'pie',
  //   data: { labels: brandLabels, datasets: [{ data: brandData }] },
  //   options: { title: { display: true, text: 'Brand Distribution (Top 10, other brands)' } }
  // }))}`;

  // Fastest Growing Products: 按 previous_rank - rank 倒序排列，取前10
  const growthRows = rows
    .filter((r: any) => r.rank && r.previous_rank && !isNaN(Number(r.rank)) && !isNaN(Number(r.previous_rank)))
    .map((r: any) => ({
      ...r,
      rankChange: Number(r.previous_rank) - Number(r.rank),
      demandChange: (r.previous_relative_demand && r.relative_demand && r.previous_relative_demand !== r.relative_demand)
        ? `${r.previous_relative_demand} → ${r.relative_demand}`
        : (r.relative_demand ? `Stable (${r.relative_demand})` : ''),
    }))
    .sort((a: any, b: any) => b.rankChange - a.rankChange)
    .slice(0, 10);
  // 新品（previous_rank 为空）
  const newEntries = rows.filter((r: any) => (!r.previous_rank || isNaN(Number(r.previous_rank))) && r.rank)
    .slice(0, Math.max(0, 10 - growthRows.length))
    .map((r: any) => ({
      ...r,
      rankChange: 'New entry',
      demandChange: 'New entry',
    }));
  const fastestGrowing = growthRows.concat(newEntries).slice(0, 10);

  // 品牌分布表格HTML
  let brandTableHtml = `<table style="width:100%;border-collapse:collapse;margin-bottom:2rem;">
    <thead>
      <tr style="background:#f5f7fa;color:#222;font-size:1rem;">
        <th style="padding:8px 12px;border-bottom:2px solid #e0e3e8;text-align:left;">Brand</th>
        <th style="padding:8px 12px;border-bottom:2px solid #e0e3e8;text-align:left;">Share</th>
      </tr>
    </thead>
    <tbody>
      ${brandTableRows.map(row => `
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #e0e3e8;">${row.brand}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e0e3e8;">${row.share}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>`;

  // 1. 从文件名提取类目ID
  const match = (filePath || '').match(/export_[^_]+_(\d+)_/);
  const categoryId = match ? match[1] : '';
  // 2. 查找类目名称
  let categoryName = '';
  try {
    const categories = categoriesData;
    categoryName = categoryId ? findCategoryName(categories, categoryId) : '';
  } catch (e) {
    categoryName = '';
  }
  // 3. 获取最新rank_timestamp
  const latestRankTimestamp = rows
    .map((r: any) => r.rank_timestamp)
    .filter(Boolean)
    .sort()
    .reverse()[0] || '';
  // 4. 拼接副表头
  const subHeader = `Week of ${latestRankTimestamp} | ${categoryName}`;

  // 生成 HTML
  let html = `
  <div style="background:#f7f9fa;padding:40px 0 0 0;min-height:100vh;">
    <div style="max-width:900px;margin:0 auto;background:#fff;padding:32px 32px 48px 32px;border-radius:8px;box-shadow:0 2px 8px #0001;">
      <h1 style="font-size:2.5rem;font-weight:700;text-align:center;color:#2a3b4d;margin-bottom:0.5rem;">E-Commerce Trend Report</h1>
      <div style="text-align:center;color:#444;font-size:1.1rem;margin-bottom:2.5rem;">${subHeader}</div>
      <h2 style="color:#2196f3;font-size:1.5rem;font-weight:700;margin-bottom:0.5rem;border-bottom:3px solid #2196f3;padding-bottom:0.2em;">Top Performing Products</h2>
      <table style="width:100%;border-collapse:collapse;margin-bottom:2rem;">
        <thead>
          <tr style="background:#f5f7fa;color:#222;font-size:1rem;">
            <th style="padding:8px 12px;border-bottom:2px solid #e0e3e8;text-align:left;">Rank</th>
            <th style="padding:8px 12px;border-bottom:2px solid #e0e3e8;text-align:left;">Product</th>
            <th style="padding:8px 12px;border-bottom:2px solid #e0e3e8;text-align:left;">Brand</th>
            <th style="padding:8px 12px;border-bottom:2px solid #e0e3e8;text-align:left;">Price</th>
            <th style="padding:8px 12px;border-bottom:2px solid #e0e3e8;text-align:left;">Demand</th>
          </tr>
        </thead>
        <tbody>
          ${topProducts.map((p: any) => `
            <tr>
              <td style="padding:8px 12px;border-bottom:1px solid #e0e3e8;">${p.rank || ''}</td>
              <td style="padding:8px 12px;border-bottom:1px solid #e0e3e8;">${p.product_title || ''}</td>
              <td style="padding:8px 12px;border-bottom:1px solid #e0e3e8;">${p.brand || '-'}</td>
              <td style="padding:8px 12px;border-bottom:1px solid #e0e3e8;">${p.price_range || ''}</td>
              <td style="padding:8px 12px;border-bottom:1px solid #e0e3e8;">${p.relative_demand || ''}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <h2 style="color:#2196f3;font-size:1.5rem;font-weight:700;margin-bottom:0.5rem;border-bottom:3px solid #2196f3;padding-bottom:0.2em;">Top Performing Products - no brand</h2>
      <table style="width:100%;border-collapse:collapse;margin-bottom:2rem;">
        <thead>
          <tr style="background:#f5f7fa;color:#222;font-size:1rem;">
            <th style="padding:8px 12px;border-bottom:2px solid #e0e3e8;text-align:left;">Rank</th>
            <th style="padding:8px 12px;border-bottom:2px solid #e0e3e8;text-align:left;">Product</th>
            <th style="padding:8px 12px;border-bottom:2px solid #e0e3e8;text-align:left;">Brand</th>
            <th style="padding:8px 12px;border-bottom:2px solid #e0e3e8;text-align:left;">Price</th>
            <th style="padding:8px 12px;border-bottom:2px solid #e0e3e8;text-align:left;">Demand</th>
          </tr>
        </thead>
        <tbody>
          ${topNoBrandProducts.map((p: any) => `
            <tr>
              <td style="padding:8px 12px;border-bottom:1px solid #e0e3e8;">${p.rank || ''}</td>
              <td style="padding:8px 12px;border-bottom:1px solid #e0e3e8;">${p.product_title || ''}</td>
              <td style="padding:8px 12px;border-bottom:1px solid #e0e3e8;">${p.brand || '-'}</td>
              <td style="padding:8px 12px;border-bottom:1px solid #e0e3e8;">${p.price_range || ''}</td>
              <td style="padding:8px 12px;border-bottom:1px solid #e0e3e8;">${p.relative_demand || ''}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <h2 style="color:#2196f3;font-size:1.5rem;font-weight:700;margin-bottom:0.5rem;border-bottom:3px solid #2196f3;padding-bottom:0.2em;">Fastest Growing Products</h2>
      <table style="width:100%;border-collapse:collapse;margin-bottom:2rem;">
        <thead>
          <tr style="background:#f5f7fa;color:#222;font-size:1rem;">
            <th style="padding:8px 12px;border-bottom:2px solid #e0e3e8;text-align:left;">Rank</th>
            <th style="padding:8px 12px;border-bottom:2px solid #e0e3e8;text-align:left;">Previous Rank</th>
            <th style="padding:8px 12px;border-bottom:2px solid #e0e3e8;text-align:left;">Product</th>
            <th style="padding:8px 12px;border-bottom:2px solid #e0e3e8;text-align:left;">Rank Change</th>
            <th style="padding:8px 12px;border-bottom:2px solid #e0e3e8;text-align:left;">Demand Change</th>
          </tr>
        </thead>
        <tbody>
          ${fastestGrowing.map((p: any) => `
            <tr>
              <td style="padding:8px 12px;border-bottom:1px solid #e0e3e8;">${p.rank || ''}</td>
              <td style="padding:8px 12px;border-bottom:1px solid #e0e3e8;">${p.previous_rank || ''}</td>
              <td style="padding:8px 12px;border-bottom:1px solid #e0e3e8;">${p.product_title || ''}</td>
              <td style="padding:8px 12px;border-bottom:1px solid #e0e3e8;color:${typeof p.rankChange === 'number' && p.rankChange > 0 ? '#1dbf73' : '#888'};font-weight:600;">${typeof p.rankChange === 'number' ? (p.rankChange > 0 ? `+${p.rankChange} positions` : (p.rankChange < 0 ? `${p.rankChange} positions` : 'Stable')) : p.rankChange}</td>
              <td style="padding:8px 12px;border-bottom:1px solid #e0e3e8;color:${p.demandChange && p.demandChange.includes('→') ? '#1dbf73' : '#888'};font-weight:600;">${p.demandChange}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <h2 style="color:#2196f3;font-size:1.5rem;font-weight:700;margin-bottom:0.5rem;border-bottom:3px solid #2196f3;padding-bottom:0.2em;">Brand Distribution</h2>
      ${brandTableHtml}
    </div>
  </div>
`;

  // 直接返回 HTML; 不保存文件
  return new Response(JSON.stringify({ success: true, html, message: "Report generated in memory" }), {
    headers: { 'Content-Type': 'application/json' }
  });
} 