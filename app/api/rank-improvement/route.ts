import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@/lib/bigquery-edge';

export const runtime = 'edge';

// Initialize BigQuery
const credentialsJson = process.env.GCP_SERVICE_ACCOUNT_JSON;
// Check if credentials exist to avoid edge case runtime errors during build if env missing, though usually it should be there.
// But for safety, we initialize it.
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
    const limit = parseInt(searchParams.get('limit') || '10');
    const timestamp = searchParams.get('timestamp'); // 新增timestamp参数

    console.log(`📊 Fetching rank improvement analysis for country: ${country}, category: ${categoryId}, timestamp: ${timestamp}`);

    // 构建查询条件
    let categoryCondition = '';
    let categoryParams = {};

    if (categoryId === '123456') {
      // 当 categoryId=123456 时，去掉 category_id 条件，检索所有目录
      categoryCondition = '';
      console.log('📊 检索所有目录的排名数据');
    } else {
      // 正常按分类检索
      categoryCondition = 'AND category_id = @categoryId';
      categoryParams = { categoryId: categoryId };
      console.log(`📊 检索分类 ${categoryId} 的排名数据`);
    }

    // 构建时间条件
    let timeCondition = '';
    if (timestamp) {
      // 如果提供了timestamp参数，使用指定时间
      timeCondition = 'AND DATE_TRUNC(analysis_timestamp, WEEK) = DATE_TRUNC(CAST(@timestamp AS TIMESTAMP), WEEK)';
      categoryParams = { ...categoryParams, timestamp: timestamp };
      console.log(`📊 使用指定时间: ${timestamp}`);
    } else {
      // 否则使用最近一周的数据
      timeCondition = 'AND DATE_TRUNC(analysis_timestamp, WEEK) = (SELECT MAX(DATE_TRUNC(analysis_timestamp, WEEK)) FROM `' + process.env.GCP_PROJECT_ID + '.' + process.env.GCP_DATASET_ID + '.product_momentum_analysis` WHERE country = @country ' + categoryCondition + ')';
      console.log('📊 使用最近一周的数据');
    }

    const query = `
      SELECT
        product_title,
        MAX(current_rank) as current_rank,
        MAX(rank_change) AS rank_improvement,
        MAX(current_relative_demand) as current_relative_demand,
        MAX(analysis_timestamp) AS rank_timestamp,
        MAX(category_id) AS ranking_category,
        MAX(image_url) as image_url
      FROM \`${process.env.GCP_PROJECT_ID}.${process.env.GCP_DATASET_ID}.product_momentum_analysis\`
      WHERE country = @country 
        ${categoryCondition}
        AND rank_change > 0  -- 只选择排名上升的产品
        ${timeCondition}
      GROUP BY product_title
      ORDER BY rank_improvement DESC  -- 按排名改善降序排序
      LIMIT @limit
    `;

    console.log('🔍 Rank Improvement Query:');
    console.log(query);

    const options = {
      query: query,
      params: {
        country: country,
        limit: limit,
        ...categoryParams
      }
    };

    const [rows] = await bigquery.query(options);
    console.log(`Found ${rows.length} products with rank improvement`);

    // Debug: Log the first row to see the data structure
    if (rows.length > 0) {
      console.log('🔍 First row data structure:', JSON.stringify(rows[0], null, 2));
    }

    // 格式化返回数据
    const formattedResults = rows.map((row: any) => {
      // Debug: Log each field type
      console.log('🔍 Row field types:', {
        product_title: typeof row.product_title,
        current_rank: typeof row.current_rank,
        rank_improvement: typeof row.rank_improvement,
        current_relative_demand: typeof row.current_relative_demand,
        rank_timestamp: typeof row.rank_timestamp,
        ranking_category: typeof row.ranking_category,
        image_url: typeof row.image_url
      });

      return {
        // Ensure productTitle is always a string
        productTitle: typeof row.product_title === 'string' ? row.product_title : (row.product_title ? JSON.stringify(row.product_title) : ''),
        currentRank: typeof row.current_rank === 'number' ? row.current_rank : 0,
        previousRank: (typeof row.current_rank === 'number' ? row.current_rank : 0) + (typeof row.rank_improvement === 'number' ? row.rank_improvement : 0), // 计算历史排名
        rankImprovement: typeof row.rank_improvement === 'number' ? row.rank_improvement : 0,
        currentRelativeDemand: typeof row.current_relative_demand === 'number' ? row.current_relative_demand : 0,
        previousRelativeDemand: typeof row.current_relative_demand === 'number' ? row.current_relative_demand : 0, // 简化处理
        daysBetweenRankings: 7, // 假设一周
        currentTimestamp: typeof row.rank_timestamp === 'string' ? row.rank_timestamp : '',
        previousTimestamp: typeof row.rank_timestamp === 'string' ? row.rank_timestamp : '', // 简化处理
        rankingCategory: typeof row.ranking_category === 'string' ? row.ranking_category : '',
        imageUrl: typeof row.image_url === 'string' ? row.image_url : (row.image_url ? JSON.stringify(row.image_url) : '')
      };
    });

    return NextResponse.json({
      success: true,
      data: formattedResults,
      count: formattedResults.length,
      filters: {
        country,
        categoryId,
        limit
      }
    });

  } catch (error) {
    console.error('Error fetching rank improvement analysis:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch rank improvement analysis data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// 获取排名上升统计信息
export async function POST(request: NextRequest) {
  try {
    const { country, categoryId, timestamp } = await request.json();

    console.log(`📊 Fetching rank improvement statistics for country: ${country}, category: ${categoryId}, timestamp: ${timestamp}`);

    // 构建查询条件
    let categoryCondition = '';
    let categoryParams = {};

    if (categoryId === '123456') {
      // 当 categoryId=123456 时，去掉 category_id 条件，检索所有目录
      categoryCondition = '';
      console.log('📊 检索所有目录的排名统计');
    } else {
      // 正常按分类检索
      categoryCondition = 'AND category_id = @categoryId';
      categoryParams = { categoryId: categoryId };
      console.log(`📊 检索分类 ${categoryId} 的排名统计`);
    }

    // 构建时间条件
    let timeCondition = '';
    if (timestamp) {
      // 如果提供了timestamp参数，使用指定时间
      timeCondition = 'AND DATE_TRUNC(analysis_timestamp, WEEK) = DATE_TRUNC(CAST(@timestamp AS TIMESTAMP), WEEK)';
      categoryParams = { ...categoryParams, timestamp: timestamp };
      console.log(`📊 使用指定时间: ${timestamp}`);
    } else {
      // 否则使用最近一周的数据
      timeCondition = 'AND DATE_TRUNC(analysis_timestamp, WEEK) = (SELECT MAX(DATE_TRUNC(analysis_timestamp, WEEK)) FROM `' + process.env.GCP_PROJECT_ID + '.' + process.env.GCP_DATASET_ID + '.product_momentum_analysis` WHERE country = @country ' + categoryCondition + ')';
      console.log('📊 使用最近一周的数据');
    }

    const query = `
      SELECT
        COUNT(*) as total_products,
        COUNT(CASE WHEN rank_change > 0 THEN 1 END) as rising_products,
        COUNT(CASE WHEN rank_change < 0 THEN 1 END) as declining_products,
        COUNT(CASE WHEN rank_change = 0 THEN 1 END) as stable_products,
        AVG(CASE WHEN rank_change > 0 THEN rank_change END) as avg_rank_improvement,
        MAX(CASE WHEN rank_change > 0 THEN rank_change END) as max_rank_improvement,
        MIN(CASE WHEN rank_change > 0 THEN rank_change END) as min_rank_improvement
      FROM \`${process.env.GCP_PROJECT_ID}.${process.env.GCP_DATASET_ID}.product_momentum_analysis\`
      WHERE country = @country 
        ${categoryCondition}
        ${timeCondition}
    `;

    console.log('🔍 Rank Improvement Statistics Query:');
    console.log(query);

    const options = {
      query: query,
      params: {
        country: country || 'US',
        ...categoryParams
      }
    };

    const [rows] = await bigquery.query(options);
    console.log(`Found rank improvement statistics`);

    return NextResponse.json({
      success: true,
      data: rows[0],
      filters: {
        country,
        categoryId
      }
    });

  } catch (error) {
    console.error('Error fetching rank improvement statistics:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch rank improvement statistics',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 