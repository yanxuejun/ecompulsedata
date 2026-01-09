import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@/lib/bigquery-edge';
import { auth } from '@clerk/nextjs/server';

export const runtime = 'edge';

const credentialsJson = process.env.GCP_SERVICE_ACCOUNT_JSON;
if (!credentialsJson) throw new Error('GCP_SERVICE_ACCOUNT_JSON 环境变量未设置');
const credentials = JSON.parse(credentialsJson);
const bigquery = new BigQuery({ projectId: credentials.project_id, credentials });
const projectId = process.env.GCP_PROJECT_ID!;
const datasetId = 'new_gmc_data';
const tableId = 'Product_Favorites';
const tableRef = `\`${projectId}.${datasetId}.${tableId}\``;

// DELETE /api/favorites/[id] - Soft-remove a product from favorites by setting status to 0
export async function DELETE(

  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {

  console.log("DELETE /api/favorites/[id]")
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const favoriteId = id;
    console.log(favoriteId)



    // 检查收藏是否属于该用户且状态不为0（未被软删除）
    const checkQuery = `
      SELECT id FROM ${tableRef}
      WHERE id = @id AND userid = @userid AND status != 'Delete'
    `;

    console.log('软删除收藏 - 检查权限SQL:', checkQuery);
    console.log('软删除收藏 - 检查权限参数:', {
      id: favoriteId,
      userid: userId
    });

    const [checkRows] = await bigquery.query({
      query: checkQuery,
      params: {
        id: favoriteId,
        userid: userId
      },
      types: {
        id: 'STRING',
        userid: 'STRING'
      }
    });

    if (checkRows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Favorite not found, already removed, or not authorized' },
        { status: 404 }
      );
    }

    //修改为 UPDATE 语句以实现软删除 (Soft Delete) 
    const updateQuery = `
      UPDATE ${tableRef}
      SET status = 'Delete'
      WHERE id = @id AND userid = @userid
    `;

    console.log('软删除收藏 - UPDATE SQL:', updateQuery);
    console.log('软删除收藏 - UPDATE 参数:', {
      id: favoriteId,
      userid: userId
    });

    await bigquery.query({
      query: updateQuery,
      params: {
        id: favoriteId,
        userid: userId
      },
      types: {
        id: 'STRING',
        userid: 'STRING'
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Favorite successfully soft-removed (status set to 0)',
    });
  } catch (error) {
    console.error('Error soft-removing favorite:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to soft-remove favorite' },
      { status: 500 }
    );
  }
}