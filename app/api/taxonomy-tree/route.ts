import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@/lib/bigquery-edge';

export const runtime = 'edge';

export async function GET(req: NextRequest) {
  try {
    // 连接 BigQuery
    const credentials = JSON.parse(process.env.GCP_SERVICE_ACCOUNT_JSON!);
    const bigquery = new BigQuery({ projectId: credentials.project_id, credentials });

    // 查询 Google_Product_Taxonomy 表
    const query = `
      SELECT 
        code,
        catalog_name,
        catalog_depth,
        parent_catalog_code,
        full_catalog_name
      FROM \`new_gmc_data.Google_Product_Taxonomy\`
      ORDER BY catalog_depth ASC, code ASC
    `;

    const [rows] = await bigquery.query({
      query,
      location: 'US',
    });

    // 构建树结构
    type TaxonomyNode = any & { children: TaxonomyNode[] };
    const map: Map<number, TaxonomyNode> = new Map();
    rows.forEach((item: any) => {
      map.set(item.code, { ...item, children: [] });
    });
    const tree: TaxonomyNode[] = [];
    rows.forEach((item: any) => {
      if (item.parent_catalog_code && map.has(item.parent_catalog_code)) {
        map.get(item.parent_catalog_code)!.children.push(map.get(item.code)!);
      } else {
        tree.push(map.get(item.code)!);
      }
    });

    return NextResponse.json(tree);
  } catch (error) {
    console.error('❌ Error fetching taxonomy tree:', error);
    return NextResponse.json({ error: 'Failed to fetch taxonomy tree' }, { status: 500 });
  }
} 