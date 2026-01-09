import { NextRequest, NextResponse } from "next/server";
import { BigQuery } from "@/lib/bigquery-edge";

export const runtime = 'edge';

const projectId = process.env.GCP_PROJECT_ID!;
const datasetId = process.env.GCP_DATASET_ID!;
const serviceAccountJson = process.env.GCP_SERVICE_ACCOUNT_JSON!;

function getBigQueryClient() {
  return new BigQuery({
    projectId,
    credentials: JSON.parse(serviceAccountJson),
  });
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const country = searchParams.get("country") || "US";
    const category = Number(searchParams.get("category"));
    const type = searchParams.get("type") || "fastest";
    const productTitle = searchParams.get("productTitle");
    const bq = getBigQueryClient();

    // 1. 查最新rank_timestamp
    const [dateRows] = await bq.query({
      query: `
        SELECT MAX(rank_timestamp) as latest_date
        FROM \`${projectId}.${datasetId}.product_week_rank_enriched\`
        WHERE country = @country AND category_id = @category
      `,
      params: { country, category },
    });
    const latestDate = dateRows[0]?.latest_date;
    if (!latestDate) {
      return NextResponse.json({ products: [], rank_timestamp: null });
    }

    // 2. 查Top10
    const orderBy = type === "fastest" ? "rank_improvement DESC" : "rank ASC";
    const sql = `
      SELECT rank_id, rank, product_title, image_url, rank_improvement, rank_timestamp
      FROM \`${projectId}.${datasetId}.product_week_rank_enriched\`
      WHERE country = @country AND category_id = @category AND DATE(rank_timestamp) = DATE(@latestDate)
      ${productTitle ? 'AND LOWER(product_title) LIKE LOWER(@productTitle)' : ''}
      ORDER BY ${orderBy}
      LIMIT 10
    `;
    console.log("BigQuery SQL:", sql);
    console.log("BigQuery Params:", { country, category, latestDate, productTitle });
    const [rows] = await bq.query({
      query: sql,
      params: { country, category, latestDate, ...(productTitle ? { productTitle: `%${productTitle}%` } : {}) },
    });
    console.log("API 返回产品数量:", rows.length);
    console.log("API 返回产品:", rows);
    return NextResponse.json({ products: rows, rank_timestamp: latestDate });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || String(e) }, { status: 500 });
  }
} 