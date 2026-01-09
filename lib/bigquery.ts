import { BigQuery } from './bigquery-edge';

const credentialsJson = process.env.GCP_SERVICE_ACCOUNT_JSON;
if (!credentialsJson) {
  throw new Error('GCP_SERVICE_ACCOUNT_JSON 环境变量未设置');
}
const credentials = JSON.parse(credentialsJson);
const bigquery = new BigQuery({ projectId: credentials.project_id, credentials });
const projectId = process.env.GCP_PROJECT_ID!;
const datasetId = 'new_gmc_data'; // 已替换为你的数据集名
const tableId = 'UserProfile'; // TODO: 替换为你的实际表名
const tableRef = `
  \`${projectId}.${datasetId}.${tableId}\`
`;

export async function getUserProfile(userId: string) {
  const query = `
    SELECT * FROM ${tableRef}
    WHERE id = @userId
    LIMIT 1
  `;
  const options = { query, params: { userId } };
  const [rows] = await bigquery.query(options);
  return rows[0] || null;
}

export async function createUserProfile(userId: string, name: string, email: string) {
  const query = `
    INSERT INTO ${tableRef} (id, credits, tier, createdAt, updatedAt, name, email)
    VALUES (@userId, 20, 'starter', CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP(), @name, @email)
  `;
  const options = { query, params: { userId, name, email } };
  await bigquery.query(options);
}

export async function deductUserCredit(userId: string) {
  const query = `
    UPDATE ${tableRef}
    SET credits = credits - 1, updatedAt = CURRENT_TIMESTAMP()
    WHERE id = @userId AND credits > 0
  `;
  const options = { query, params: { userId } };
  await bigquery.query(options);
}

export async function updateUserProfileCreditsAndTier(userId: string, credits: number | null, tier: string, subscriptionId?: string) {
  let query = `
    UPDATE ${tableRef}
    SET credits = @credits, tier = @tier, updatedAt = CURRENT_TIMESTAMP()`;
  const params: any = { userId, credits, tier };
  if (subscriptionId) {
    query += `, subscriptionId = @subscriptionId`;
    params.subscriptionId = subscriptionId;
  }
  query += ` WHERE id = @userId`;
  await bigquery.query({ query, params });
}

export async function updateUserProfileSubscriptionId(userId: string, subscriptionId: string) {
  const query = `
    UPDATE ${tableRef}
    SET subscriptionId = @subscriptionId, updatedAt = CURRENT_TIMESTAMP()
    WHERE id = @userId
  `;
  const options = { query, params: { userId, subscriptionId } };
  await bigquery.query(options);
} 