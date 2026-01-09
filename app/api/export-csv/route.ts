import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@/lib/bigquery-edge';
import { stringify } from 'csv-stringify/sync';

export const runtime = 'edge';

const credentialsJson = process.env.GCP_SERVICE_ACCOUNT_JSON;
if (!credentialsJson) throw new Error('GCP_SERVICE_ACCOUNT_JSON 环境变量未设置');
const credentials = JSON.parse(credentialsJson);
const projectId = process.env.GCP_PROJECT_ID!;
const datasetId = 'new_gmc_data';
const tableId = 'BestSellers_TopProducts_479974220';

const BATCH_SIZE = 5000; // Smaller batch size for Edge
const MAX_ROWS = 50000; // Warning: 500k might timeout on Edge (usually 30s limit), reducing default limit unless configured otherwise

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const country = searchParams.get('country') || '';
  const category = searchParams.get('category') || '';

  const bigquery = new BigQuery({ projectId, credentials });

  let where = [];
  const params: any = {};
  if (country) { where.push('ranking_country = @country'); params.country = country; }
  if (category) { where.push('CAST(ranking_category AS STRING) = @category'); params.category = category; }
  const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';

  const tableRef = `\`${projectId}.${datasetId}.${tableId}\``;
  const fileName = `export_${country || 'all'}_${category || 'all'}_${Date.now()}.csv`;

  // Create a TransformStream to stream data to response
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let totalRows = 0;
      let offset = 0;
      let isFirstBatch = true;

      try {
        while (totalRows < MAX_ROWS) {
          const batchQuery = `
            SELECT
              rank, previous_rank, ranking_country, ranking_category, 
              brand,
              FORMAT('%s-%s %s', CAST(price_range.min AS STRING), CAST(price_range.max AS STRING), price_range.currency) AS price_range,
              FORMAT('%s-%s %s', CAST(relative_demand.min AS STRING), CAST(relative_demand.max AS STRING), relative_demand.bucket) AS relative_demand,
              FORMAT('%s-%s %s', CAST(previous_relative_demand.min AS STRING), CAST(previous_relative_demand.max AS STRING), previous_relative_demand.bucket) AS previous_relative_demand,
              FORMAT_DATE('%Y-%m-%d', DATE(rank_timestamp)) AS rank_timestamp,
              COALESCE(
                ARRAY(SELECT name FROM UNNEST(product_title) WHERE locale = 'en' LIMIT 1)[SAFE_OFFSET(0)],
                ARRAY(SELECT name FROM UNNEST(product_title) WHERE locale = 'zh-CN' LIMIT 1)[SAFE_OFFSET(0)],
                ARRAY(SELECT name FROM UNNEST(product_title) LIMIT 1)[SAFE_OFFSET(0)]
              ) AS product_title
            FROM ${tableRef}
            ${whereClause}
            ORDER BY rank ASC
            LIMIT @batchSize OFFSET @offset
          `;

          const batchParams = { ...params, batchSize: BATCH_SIZE, offset };
          console.log(`Fetching batch offset ${offset}...`);
          const [rows] = await bigquery.query({ query: batchQuery, params: batchParams });

          if (!rows || rows.length === 0) break;

          const csvChunk = stringify(rows, { header: isFirstBatch });
          controller.enqueue(encoder.encode(csvChunk));

          isFirstBatch = false;
          totalRows += rows.length;
          offset += BATCH_SIZE;

          if (rows.length < BATCH_SIZE) break;
        }
        controller.close();
      } catch (err: any) {
        console.error("Stream Error:", err);
        controller.error(err);
      }
    }
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${fileName}"`,
    }
  });
} 