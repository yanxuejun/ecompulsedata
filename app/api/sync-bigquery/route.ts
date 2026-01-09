import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@/lib/bigquery-edge';

export const runtime = 'edge';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  // 查询参数
  const country = searchParams.get('country');
  const title = searchParams.get('title');
  const start = searchParams.get('start');
  const end = searchParams.get('end');
  const category = searchParams.get('category');
  const brand = searchParams.get('brand');
  const brandIsNull = searchParams.get('brandIsNull');
  const minRank = searchParams.get('minRank');
  const maxRank = searchParams.get('maxRank');
  const minPrice = searchParams.get('minPrice');
  const maxPrice = searchParams.get('maxPrice');
  const page = Number(searchParams.get('page') || 1);
  const pageSize = Number(searchParams.get('pageSize') || 10);
  const minRelativeDemand = searchParams.get('minRelativeDemand');
  const maxRelativeDemand = searchParams.get('maxRelativeDemand');
  const minPrevRelativeDemand = searchParams.get('minPrevRelativeDemand');
  const maxPrevRelativeDemand = searchParams.get('maxPrevRelativeDemand');
  const minPreviousRank = searchParams.get('minPreviousRank');
  const maxPreviousRank = searchParams.get('maxPreviousRank');

  // 构建WHERE条件
  let where = 'WHERE 1=1 ';
  if (country) where += ` AND ranking_country = @country`;
  if (title) where += ` AND EXISTS (SELECT 1 FROM UNNEST(product_title) AS t WHERE LOWER(t.name) LIKE LOWER(@title))`;
  if (category) where += ` AND ranking_category = @category`;
  if (brand) where += ` AND LOWER(brand) = LOWER(@brand)`;
  if (brandIsNull === 'true') where += ` AND (brand IS NULL OR brand = '')`;
  if (start) where += ` AND DATE(rank_timestamp) >= @start`;
  if (end) where += ` AND DATE(rank_timestamp) <= @end`;
  if (minRank) where += ` AND rank >= @minRank`;
  if (maxRank) where += ` AND rank <= @maxRank`;
  if (minPrice) where += ` AND price_range.min >= @minPrice`;
  if (maxPrice) where += ` AND price_range.max <= @maxPrice`;
  if (minRelativeDemand) where += ` AND relative_demand.min >= @minRelativeDemand`;
  if (maxRelativeDemand) where += ` AND relative_demand.max <= @maxRelativeDemand`;
  if (minPrevRelativeDemand) where += ` AND previous_relative_demand.min >= @minPrevRelativeDemand`;
  if (maxPrevRelativeDemand) where += ` AND previous_relative_demand.max <= @maxPrevRelativeDemand`;
  if (minPreviousRank) where += ` AND previous_rank >= @minPreviousRank`;
  if (maxPreviousRank) where += ` AND previous_rank <= @maxPreviousRank`;

  // 查询总数
  const countSql = `
    SELECT COUNT(*) as total
    FROM \`new_gmc_data.BestSellers_TopProducts_Optimized\`
    ${where}
  `;

  // 查询当前页数据
  const dataSql = `
    SELECT 
      rank_id, 
      rank, 
      ranking_country, 
      ranking_category, 
      brand, 
      product_title, 
      previous_rank, 
      price_range, 
      relative_demand, 
      previous_relative_demand, 
      rank_timestamp,
      gtins
    FROM \`new_gmc_data.BestSellers_TopProducts_Optimized\`
    ${where}
    ORDER BY rank ASC
    LIMIT @pageSize OFFSET @offset
  `;

  // 构建参数和类型，只包含有值的字段
  const params: any = {
    country,
    start,
    pageSize,
    offset: (page - 1) * pageSize,
  };
  const types: any = {
    country: 'STRING',
    start: 'STRING',
    pageSize: 'INT64',
    offset: 'INT64',
  };
  if (title) {
    params.title = `%${title}%`;
    types.title = 'STRING';
  }
  if (category) {
    params.category = Number(category);
    types.category = 'INT64';
  }
  if (brand) {
    params.brand = brand;
    types.brand = 'STRING';
  }
  if (brandIsNull === 'true') {
    params.brandIsNull = true;
    types.brandIsNull = 'BOOL';
  }
  if (end) {
    params.end = end;
    types.end = 'STRING';
  }
  if (minRank) {
    params.minRank = Number(minRank);
    types.minRank = 'INT64';
  }
  if (maxRank) {
    params.maxRank = Number(maxRank);
    types.maxRank = 'INT64';
  }
  if (minPrice) {
    params.minPrice = Number(minPrice);
    types.minPrice = 'NUMERIC';
  }
  if (maxPrice) {
    params.maxPrice = Number(maxPrice);
    types.maxPrice = 'NUMERIC';
  }
  if (minRelativeDemand) {
    params.minRelativeDemand = Number(minRelativeDemand);
    types.minRelativeDemand = 'NUMERIC';
  }
  if (maxRelativeDemand) {
    params.maxRelativeDemand = Number(maxRelativeDemand);
    types.maxRelativeDemand = 'NUMERIC';
  }
  if (minPrevRelativeDemand) {
    params.minPrevRelativeDemand = Number(minPrevRelativeDemand);
    types.minPrevRelativeDemand = 'NUMERIC';
  }
  if (maxPrevRelativeDemand) {
    params.maxPrevRelativeDemand = Number(maxPrevRelativeDemand);
    types.maxPrevRelativeDemand = 'NUMERIC';
  }
  if (minPreviousRank) {
    params.minPreviousRank = Number(minPreviousRank);
    types.minPreviousRank = 'INT64';
  }
  if (maxPreviousRank) {
    params.maxPreviousRank = Number(maxPreviousRank);
    types.maxPreviousRank = 'INT64';
  }

  console.log('🔍 BigQuery Sync API - Count Query:');
  console.log(countSql);
  console.log('🔍 BigQuery Sync API - Data Query:');
  console.log(dataSql);
  console.log('📊 Query Parameters:', params);

  // 连接BigQuery
  const credentials = JSON.parse(process.env.GCP_SERVICE_ACCOUNT_JSON!);
  const bigquery = new BigQuery({ projectId: credentials.project_id, credentials });

  // 打印最终SQL和参数
  console.log('=== BigQuery 最终查询SQL ===');
  console.log('Count SQL:', countSql);
  console.log('Data SQL:', dataSql);
  console.log('参数:', params);
  console.log('参数类型:', types);
  console.log('=======================');

  // 查询总数
  const [countRows] = await bigquery.query({
    query: countSql,
    params,
    types,
    location: 'US',
  });
  const total = countRows[0]?.total || 0;

  // 查询当前页数据
  const [dataRows] = await bigquery.query({
    query: dataSql,
    params,
    types,
    location: 'US',
  });
  console.log('BigQuery 返回数据:', dataRows);

  return NextResponse.json({ data: dataRows, total });
}