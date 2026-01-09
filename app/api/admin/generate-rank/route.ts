import { NextRequest, NextResponse } from "next/server";
import { BigQuery } from "@/lib/bigquery-edge";

export const runtime = 'edge';

const projectId = process.env.GCP_PROJECT_ID!;
const datasetId = process.env.GCP_DATASET_ID!;
const serviceAccountJson = process.env.GCP_SERVICE_ACCOUNT_JSON!;
const googleApiKey = process.env.GOOGLE_SEARCH_API_KEY!;
const googleEngineId = process.env.GOOGLE_SEARCH_ENGINE_ID!;

function getBigQueryClient() {
  return new BigQuery({
    projectId,
    credentials: JSON.parse(serviceAccountJson),
  });
}

async function searchGoogleImage(title: string) {
  const url = `https://www.googleapis.com/customsearch/v1?key=${googleApiKey}&cx=${googleEngineId}&q=${encodeURIComponent(
    title
  )}&searchType=image&num=1`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.items && data.items.length > 0) {
    return {
      image_url: data.items[0].link,
      search_link: data.items[0].image.contextLink,
      search_title: data.items[0].title,
    };
  }
  return { image_url: "", search_link: "", search_title: "" };
}

export async function POST(req: NextRequest) {
  try {
    const { country, category, topN, isFastest } = await req.json();
    const categoryNum = Number(category);
    const bq = getBigQueryClient();

    const orderBy = isFastest ? 'ORDER BY previous_rank - rank DESC' : 'ORDER BY rank ASC';
    const sql = `
        SELECT
          entity_id, rank, title, report_category_id, country_code, _PARTITIONDATE AS rank_timestamp, previous_rank
        FROM \`${projectId}.${datasetId}.BestSellersProductClusterWeekly_479974220\`
        WHERE country_code = @country AND report_category_id = @category
        ${orderBy}
        LIMIT @topN
      `;
    console.log("BigQuery SQL:", sql);
    console.log("BigQuery Params:", { country, category: categoryNum, topN });
    const [rows] = await bq.query({
      query: sql,
      params: { country, category: categoryNum, topN },
    });

    // 组装插入数据
    const enrichedRows = await Promise.all(
      rows.map(async (row: any, idx: number) => {
        // 验证 rank_timestamp 一致性
        let finalRankTimestamp;
        if (row.rank_timestamp && typeof row.rank_timestamp.value === "string") {
          finalRankTimestamp = row.rank_timestamp.value;
        } else if (row.rank_timestamp instanceof Date) {
          finalRankTimestamp = row.rank_timestamp.toISOString();
        } else if (typeof row.rank_timestamp === "string") {
          finalRankTimestamp = row.rank_timestamp;
        } else {
          finalRankTimestamp = new Date().toISOString();
        }
        console.log("源表 rank_timestamp:", row.rank_timestamp, "插入表 rank_timestamp:", finalRankTimestamp);
        const google = await searchGoogleImage(String(row.title || ""));
        return {
          rank_id: String(row.entity_id),
          rank: Number(row.rank),
          product_title: String(row.title || ""),
          category_id: Number(row.report_category_id),
          country: String(row.country_code),
          image_url: google.image_url,
          search_link: google.search_link,
          search_title: google.search_title,
          rank_timestamp: finalRankTimestamp,
          previous_rank: Number(row.previous_rank),
          rank_improvement: Number(row.previous_rank) - Number(row.rank),
          rank_type: "1",
          rank_order: String(idx + 1),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
      })
    );

    // 插入到 enriched 表前打印
    console.log("BigQuery Insert Rows:", enrichedRows);
    await bq.dataset(datasetId).table("product_week_rank_enriched").insert(enrichedRows);

    return NextResponse.json({ success: true, count: enrichedRows.length });
  } catch (e: any) {
    console.error("BigQuery Insert Error:", e);
    if (e && e.errors) {
      console.error("BigQuery Insert Error details:", e.errors);
    }
    return NextResponse.json({ success: false, error: e.message || String(e), details: e.errors }, { status: 500 });
  }
} 