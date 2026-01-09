import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@/lib/bigquery-edge';
import { auth } from '@clerk/nextjs/server';
import { Resend } from 'resend';

export const runtime = 'edge';

const credentialsJson = process.env.GCP_SERVICE_ACCOUNT_JSON;
if (!credentialsJson) throw new Error('GCP_SERVICE_ACCOUNT_JSON 环境变量未设置');
const credentials = JSON.parse(credentialsJson);
const projectId = process.env.GCP_PROJECT_ID!;
const datasetId = 'new_gmc_data';
const tableId = 'weekly_email_subscriptions';
const tableRef = `\`${projectId}.${datasetId}.${tableId}\``;
const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: '未登录' }, { status: 401 });

    // 前端可传 username/useremail，否则为空
    const { categories, keywords, email, username = '', useremail = '' } = await req.json();
    if (!email || (!categories || categories.length === 0) && !keywords) {
      return NextResponse.json({ error: '请填写邮箱，并至少选择一个类目或输入关键词' }, { status: 400 });
    }
    const params = {
      userid: userId,
      username,
      useremail,
      email,
      categories: categories && categories.length ? categories.join(',') : null,
      keywords: keywords || null,
    };
    const mergeQuery = `
      MERGE INTO ${tableRef} T
      USING (SELECT @userid AS userid) S
      ON T.userid = S.userid
      WHEN MATCHED THEN
        UPDATE SET
          username = @username,
          useremail = @useremail,
          email = @email,
          categories = @categories,
          keywords = @keywords,
          created_at = CURRENT_TIMESTAMP()
      WHEN NOT MATCHED THEN
        INSERT (userid, username, useremail, email, categories, keywords, created_at)
        VALUES (@userid, @username, @useremail, @email, @categories, @keywords, CURRENT_TIMESTAMP())
    `;
    const types = {
      userid: 'STRING',
      username: 'STRING',
      useremail: 'STRING',
      email: 'STRING',
      categories: 'STRING',
      keywords: 'STRING'
    };
    const bigquery = new BigQuery({ projectId, credentials });
    await bigquery.query({ query: mergeQuery, params, types });

    // 发送订阅确认邮件
    const html = `
      <div style="font-family: Arial, sans-serif; background: #f6f8fa; padding: 32px;">
        <div style="max-width: 480px; margin: 0 auto; background: #fff; border-radius: 8px; box-shadow: 0 2px 8px #eee; padding: 32px;">
          <div style="text-align: center; margin-bottom: 24px;">
            <img src="https://ecompulsedata.com/logo-footer.png" alt="ecompulsedata" style="height: 48px; margin-bottom: 8px;" />
            <h2 style="color: #2563eb; margin: 0;">每周订阅成功</h2>
          </div>
          <p style="font-size: 16px; color: #222;">您好，您的每周订阅已成功！</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
          <div style="font-size: 15px; color: #333;">
            <strong>订阅类目：</strong> ${categories?.join(', ') || '无'}<br/>
            <strong>关键词：</strong> ${keywords || '无'}
          </div>
          <div style="margin: 32px 0 0 0; text-align: center;">
            <a href="https://ecompulsedata.com/dashboard" style="display: inline-block; background: #2563eb; color: #fff; padding: 12px 32px; border-radius: 6px; text-decoration: none; font-weight: bold;">管理我的订阅</a>
          </div>
          <p style="font-size: 13px; color: #888; margin-top: 32px; text-align: center;">
            感谢您的订阅！<br/>
            <span style="color: #bbb;">ecompulsedata.com 团队</span>
          </p>
        </div>
      </div>
    `;
    console.log('[RESEND] API KEY:', process.env.RESEND_API_KEY ? 'set' : 'not set');
    console.log('[RESEND] from:', 'noreply@ecompulsedata.com');
    console.log('[RESEND] to:', email);
    console.log('[RESEND] subject:', '每周订阅确认');
    try {
      const result = await resend.emails.send({
        from: 'noreply@ecompulsedata.com',
        to: email,
        subject: '每周订阅确认',
        html
      });
      console.log('[RESEND] send result:', result);
    } catch (mailErr) {
      console.error('[RESEND] send error:', mailErr);
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('[weekly-subscribe] error:', e, e?.stack);
    return NextResponse.json({ error: e?.message || String(e) || '订阅失败', stack: e?.stack }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: '未登录' }, { status: 401 });
    const selectQuery = `SELECT categories, keywords FROM ${tableRef} WHERE userid = @userid LIMIT 1`;
    const options = {
      query: selectQuery,
      params: { userid: userId },
      types: { userid: 'STRING' }
    };
    const bigquery = new BigQuery({ projectId, credentials });
    const [rows] = await bigquery.query(options);
    if (!rows.length) return NextResponse.json({ categories: '', keywords: '' });
    return NextResponse.json(rows[0]);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) || '查询失败' }, { status: 500 });
  }
}