import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@/lib/bigquery-edge';

export const runtime = 'edge';

// Initialize BigQuery
const credentialsJson = process.env.GCP_SERVICE_ACCOUNT_JSON;
const credentials = credentialsJson ? JSON.parse(credentialsJson) : {};

const bigquery = new BigQuery({
  projectId: process.env.GCP_PROJECT_ID || '',
  credentials: credentials
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const country = searchParams.get('country') || 'US';
    const categoryId = searchParams.get('categoryId') || '1';
    const trendType = searchParams.get('trendType'); // 可选：ROCKET_RISING, DEMAND_INCREASING 等
    const limit = parseInt(searchParams.get('limit') || '10');
    const analysisDate = searchParams.get('analysisDate'); // 可选：特定分析日期

    console.log(`📊 Fetching momentum analysis for country: ${country}, category: ${categoryId}`);

    // 构建查询条件
    let whereConditions = [
      `country = @country`,
      `category_id = @categoryId`
    ];

    if (trendType) {
      whereConditions.push(`trend_type = @trendType`);
    }

    if (analysisDate) {
      whereConditions.push(`DATE(analysis_timestamp) = @analysisDate`);
    } else {
      // 默认获取最新的分析结果
      whereConditions.push(`analysis_timestamp = (
        SELECT MAX(analysis_timestamp) 
        FROM \`${process.env.GCP_PROJECT_ID}.${process.env.GCP_DATASET_ID}.product_momentum_analysis\`
        WHERE country = @country AND category_id = @categoryId
      )`);
    }

    const query = `
      SELECT 
        product_title,
        current_rank,
        previous_rank,
        -- 动态计算排名改善
        (previous_rank - current_rank) AS rank_improvement,
        current_relative_demand,
        previous_relative_demand,
        demand_change,
        momentum_score,
        trend_type,
        image_url,
        search_title,
        search_link,
        analysis_timestamp
      FROM \`${process.env.GCP_PROJECT_ID}.${process.env.GCP_DATASET_ID}.product_momentum_analysis\`
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY momentum_score DESC
      LIMIT @limit
    `;

    console.log('🔍 Momentum Analysis Query:');
    console.log(query);

    const queryParams: any = {
      country: country,
      categoryId: categoryId,
      limit: limit
    };

    if (trendType) {
      queryParams.trendType = trendType;
    }

    if (analysisDate) {
      queryParams.analysisDate = analysisDate;
    }

    console.log('📊 Query Parameters:', queryParams);

    const options = {
      query: query,
      params: queryParams
    };

    const [rows] = await bigquery.query(options);
    console.log(`Found ${rows.length} momentum analysis results`);

    // 格式化返回数据
    const formattedResults = rows.map((row: any) => ({
      productTitle: row.product_title,
      currentRank: row.current_rank,
      previousRank: row.previous_rank,
      rankImprovement: row.rank_improvement,
      currentRelativeDemand: row.current_relative_demand,
      previousRelativeDemand: row.previous_relative_demand,
      demandChange: row.demand_change,
      momentumScore: row.momentum_score,
      trendType: row.trend_type,
      imageUrl: row.image_url,
      searchTitle: row.search_title,
      searchLink: row.search_link,
      analysisTimestamp: row.analysis_timestamp
    }));

    return NextResponse.json({
      success: true,
      data: formattedResults,
      count: formattedResults.length,
      filters: {
        country,
        categoryId,
        trendType,
        limit,
        analysisDate
      }
    });

  } catch (error) {
    console.error('Error fetching momentum analysis:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch momentum analysis data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// 获取趋势统计信息
export async function POST(request: NextRequest) {
  try {
    const { country, categoryId, analysisDate } = await request.json();

    console.log(`📊 Fetching trend statistics for country: ${country}, category: ${categoryId}`);

    const query = `
      SELECT 
        trend_type,
        COUNT(*) as count,
        AVG(momentum_score) as avg_momentum_score,
        AVG(rank_change) as avg_rank_change,
        AVG(demand_change) as avg_demand_change
      FROM \`${process.env.GCP_PROJECT_ID}.${process.env.GCP_DATASET_ID}.product_momentum_analysis\`
      WHERE country = @country 
        AND category_id = @categoryId
        ${analysisDate ? 'AND DATE(analysis_timestamp) = @analysisDate' : 'AND analysis_timestamp = (SELECT MAX(analysis_timestamp) FROM `' + process.env.GCP_PROJECT_ID + '.' + process.env.GCP_DATASET_ID + '.product_momentum_analysis` WHERE country = @country AND category_id = @categoryId)'}
      GROUP BY trend_type
      ORDER BY count DESC
    `;

    console.log('🔍 Trend Statistics Query:');
    console.log(query);

    const queryParams: any = {
      country: country || 'US',
      categoryId: categoryId || '1'
    };

    if (analysisDate) {
      queryParams.analysisDate = analysisDate;
    }

    const options = {
      query: query,
      params: queryParams
    };

    const [rows] = await bigquery.query(options);
    console.log(`Found ${rows.length} trend statistics`);

    return NextResponse.json({
      success: true,
      data: rows,
      filters: {
        country,
        categoryId,
        analysisDate
      }
    });

  } catch (error) {
    console.error('Error fetching trend statistics:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch trend statistics',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 