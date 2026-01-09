import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@/lib/bigquery-edge';

export const runtime = 'edge';

type JwtPayload = {
  email: string;
  category: string;
  type?: string;
  iat?: number;
  exp?: number;
};

function base64UrlDecode(str: string) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) {
    str += '=';
  }
  return atob(str);
}

function str2ab(str: string) {
  const buf = new ArrayBuffer(str.length);
  const bufView = new Uint8Array(buf);
  for (let i = 0, strLen = str.length; i < strLen; i++) {
    bufView[i] = str.charCodeAt(i);
  }
  return buf;
}

function ab2str(buf: ArrayBuffer) {
  return String.fromCharCode.apply(null, new Uint8Array(buf) as any);
}

async function verifyJwtHs256(token: string, secret: string): Promise<JwtPayload> {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid token format');
  const [encodedHeader, encodedPayload, encodedSignature] = parts;

  const header = JSON.parse(base64UrlDecode(encodedHeader));
  if (header.alg !== 'HS256') throw new Error('Unsupported alg');

  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const key = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  );

  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signatureRaw = base64UrlDecode(encodedSignature);
  const signature = str2ab(signatureRaw);

  const isValid = await crypto.subtle.verify(
    "HMAC",
    key,
    signature,
    encoder.encode(signingInput)
  );

  if (!isValid) throw new Error('Signature verification failed');

  const payload: JwtPayload = JSON.parse(base64UrlDecode(encodedPayload));
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && now >= payload.exp) throw new Error('Token expired');
  return payload;
}

function successHtml(message: string) {
  return `<!doctype html>
  <html lang="zh-CN">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>退订成功</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif; background: #f7f9fa; margin: 0; }
        .card { max-width: 560px; margin: 40px auto; background: #fff; border-radius: 12px; box-shadow: 0 1px 8px rgba(0,0,0,0.06); padding: 28px; }
        h1 { font-size: 20px; margin: 0 0 8px; color: #111827; }
        p { color: #374151; line-height: 1.6; }
        a.btn { display: inline-block; margin-top: 16px; background: #2563eb; color: #fff; text-decoration: none; padding: 10px 14px; border-radius: 8px; }
      </style>
    </head>
    <body>
      <div class="card">
        <h1>退订成功</h1>
        <p>${message}</p>
        <a class="btn" href="/">返回首页</a>
      </div>
    </body>
  </html>`;
}

function errorHtml(message: string) {
  return `<!doctype html>
  <html lang="zh-CN">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>退订失败</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif; background: #f7f9fa; margin: 0; }
        .card { max-width: 560px; margin: 40px auto; background: #fff; border-radius: 12px; box-shadow: 0 1px 8px rgba(0,0,0,0.06); padding: 28px; }
        h1 { font-size: 20px; margin: 0 0 8px; color: #111827; }
        p { color: #374151; line-height: 1.6; }
        a.btn { display: inline-block; margin-top: 16px; background: #2563eb; color: #fff; text-decoration: none; padding: 10px 14px; border-radius: 8px; }
      </style>
    </head>
    <body>
      <div class="card">
        <h1>退订失败</h1>
        <p>${message}</p>
        <a class="btn" href="/">返回首页</a>
      </div>
    </body>
  </html>`;
}

async function handleUnsubscribe(req: NextRequest): Promise<NextResponse> {
  try {
    const method = req.method;
    let token = '';
    if (method === 'GET') {
      const { searchParams } = new URL(req.url);
      token = searchParams.get('token') || '';
    } else if (method === 'POST') {
      const contentType = req.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const body = await req.json().catch(() => ({}));
        token = body?.token || '';
      } else if (contentType.includes('application/x-www-form-urlencoded')) {
        const text = await req.text();
        const params = new URLSearchParams(text);
        token = params.get('token') || '';
      } else {
        // As fallback, try query string
        const { searchParams } = new URL(req.url);
        token = searchParams.get('token') || '';
      }
    }
    if (!token) {
      return new NextResponse(errorHtml('缺少退订令牌'), { status: 400, headers: { 'content-type': 'text/html; charset=utf-8' } });
    }

    const secret = process.env.UNSUBSCRIBE_JWT_SECRET;
    if (!secret) {
      return new NextResponse(errorHtml('服务器未配置退订密钥'), { status: 500, headers: { 'content-type': 'text/html; charset=utf-8' } });
    }

    const payload = await verifyJwtHs256(token, secret);
    if (!payload.email || !payload.category) {
      return new NextResponse(errorHtml('退订令牌无效'), { status: 400, headers: { 'content-type': 'text/html; charset=utf-8' } });
    }

    // Prepare BigQuery
    const credentialsJson = process.env.GCP_SERVICE_ACCOUNT_JSON;
    if (!credentialsJson) {
      return new NextResponse(errorHtml('BigQuery 凭据未配置'), { status: 500, headers: { 'content-type': 'text/html; charset=utf-8' } });
    }
    const credentials = JSON.parse(credentialsJson);
    const projectId = process.env.GCP_PROJECT_ID;
    if (!projectId) {
      return new NextResponse(errorHtml('服务器未配置 GCP_PROJECT_ID'), { status: 500, headers: { 'content-type': 'text/html; charset=utf-8' } });
    }
    const bigquery = new BigQuery({ projectId, credentials });

    const datasetId = 'new_gmc_data';
    const tableId = 'weekly_email_subscriptions';
    const tableRef = `\`${projectId}.${datasetId}.${tableId}\``;

    // Fetch current values
    const selectSql = `SELECT categories, keywords FROM ${tableRef} WHERE email = @email LIMIT 1`;
    const [rows] = await bigquery.query({
      query: selectSql,
      params: { email: payload.email },
      types: { email: 'STRING' },
    });
    if (!rows || rows.length === 0) {
      return new NextResponse(errorHtml('未找到对应的订阅记录（邮箱不匹配）'), { status: 404, headers: { 'content-type': 'text/html; charset=utf-8' } });
    }

    const current = rows[0] as { categories: string | null; keywords: string | null };
    let categoriesStr = (current.categories as string | null) || '';
    let keywordsStr = (current.keywords as string | null) || '';

    const underscoreIndex = payload.category.indexOf('_');
    const rest = underscoreIndex >= 0 ? payload.category.slice(underscoreIndex + 1) : '';
    const isNumeric = /^\d+$/.test(rest);

    let changed = false;
    if (isNumeric) {
      // Remove from categories
      const list = categoriesStr
        ? categoriesStr.split(',').map(s => s.trim()).filter(Boolean)
        : [];
      const filtered = list.filter(s => s !== payload.category);
      changed = filtered.length !== list.length;
      categoriesStr = filtered.join(',');
    } else {
      // Remove from keywords
      const list = keywordsStr
        ? keywordsStr.split(',').map(s => s.trim()).filter(Boolean)
        : [];
      const filtered = list.filter(s => s !== payload.category);
      changed = filtered.length !== list.length;
      keywordsStr = filtered.join(',');
    }

    if (!changed) {
      const which = isNumeric ? '类目' : '关键词';
      const msg = `${payload.email} 的 ${payload.category}（${which}）未在订阅中，或已退订，无需变更。`;
      return new NextResponse(successHtml(msg), { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } });
    }

    const updateSql = `
      UPDATE ${tableRef}
      SET categories = @categories, keywords = @keywords, created_at = CURRENT_TIMESTAMP()
      WHERE email = @email
    `;

    // Use standard query and inspect numDmlAffectedRows
    const [updateRows, queryData] = await bigquery.query({
      query: updateSql,
      params: {
        email: payload.email,
        categories: categoriesStr || null,
        keywords: keywordsStr || null,
      },
      types: {
        email: 'STRING',
        categories: 'STRING',
        keywords: 'STRING',
      }
    });

    // Check DML affected rows
    let updatedCount = 0;
    if (queryData && queryData.numDmlAffectedRows) {
      updatedCount = Number(queryData.numDmlAffectedRows);
    }
    // Fallback: if no error, assume update worked since we verified existence with SELECT
    else {
      // Safe assumption if we just did a SELECT
      updatedCount = 1;
    }

    if (!updatedCount) {
      return new NextResponse(errorHtml('未找到可更新的记录，可能邮箱不匹配或记录已被删除'), { status: 404, headers: { 'content-type': 'text/html; charset=utf-8' } });
    }

    const which = isNumeric ? '类目' : '关键词';
    const msg = `${payload.email} 已成功退订 ${payload.category}（${which}）。`;
    return new NextResponse(successHtml(msg), { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } });
  } catch (e: any) {
    console.error('Unsubscribe error:', e);
    return new NextResponse(errorHtml(e?.message || '退订失败'), { status: 400, headers: { 'content-type': 'text/html; charset=utf-8' } });
  }
}

export async function GET(req: NextRequest) {
  return handleUnsubscribe(req);
}

export async function POST(req: NextRequest) {
  return handleUnsubscribe(req);
}


