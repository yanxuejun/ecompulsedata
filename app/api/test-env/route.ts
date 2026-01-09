import { NextResponse } from 'next/server';

export const runtime = 'edge';

export async function GET() {
  // 检查环境变量
  const envVars = {
    DATABASE_URL: process.env.DATABASE_URL ? 'Set' : 'Missing',
    GOOGLE_CLOUD_PROJECT_ID: process.env.GOOGLE_CLOUD_PROJECT_ID || 'Missing',
    BIGQUERY_DATASET_ID: process.env.BIGQUERY_DATASET_ID || 'Missing',
    BIGQUERY_TABLE_ID: process.env.BIGQUERY_TABLE_ID || 'Missing',
    GOOGLE_SEARCH_API_KEY: process.env.GOOGLE_SEARCH_API_KEY ? 'Set' : 'Missing',
    GOOGLE_SEARCH_ENGINE_ID: process.env.GOOGLE_SEARCH_ENGINE_ID || 'Missing',
    GCP_SERVICE_ACCOUNT_JSON: process.env.GCP_SERVICE_ACCOUNT_JSON ? 'Set' : 'Missing'
  };

  const allSet = Object.values(envVars).every(value => value !== 'Missing');

  return NextResponse.json({
    success: true,
    message: allSet ? '所有环境变量都已正确设置' : '部分环境变量缺失',
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
    envVars
  });
} 