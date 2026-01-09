import { NextRequest, NextResponse } from "next/server";
import { BigQuery } from "@/lib/bigquery-edge";

export const runtime = 'edge';

// Initialize BigQuery
const getBigQueryClient = () => {
  const credentialsJson = process.env.GCP_SERVICE_ACCOUNT_JSON;
  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID || process.env.GCP_PROJECT_ID;

  if (!credentialsJson || !projectId) {
    throw new Error("Missing GCP credentials");
  }

  const credentials = JSON.parse(credentialsJson);
  return new BigQuery({ projectId, credentials });
};

async function getTopProductsFromBigQuery(bq: BigQuery, country: string, categoryId: number, limit: number, datasetId: string, tableId: string) {
  const query = `
      SELECT 
        COALESCE(
          (SELECT name FROM UNNEST(product_title) WHERE locale = 'en'),
          (SELECT name FROM UNNEST(product_title) LIMIT 1)
        ) AS product_title,
        rank,
        rank_timestamp
      FROM \`${bq.projectId}.${datasetId}.${tableId}\`
      WHERE ranking_country = @country 
        AND ranking_category = @categoryId
      ORDER BY rank ASC
      LIMIT @limit
    `;

  const [rows] = await bq.query({
    query,
    params: { country, categoryId, limit }
  });
  return rows;
}

async function searchGoogleProduct(productTitle: string, apiKey: string, engineId: string) {
  try {
    const searchQuery = encodeURIComponent(productTitle);
    const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${engineId}&q=${searchQuery}&searchType=image&num=1`;

    const response = await fetch(url);
    if (!response.ok) return null;

    const data = await response.json();
    if (data.items && data.items.length > 0) {
      const firstResult = data.items[0];
      return {
        imageUrl: firstResult.link,
        searchTitle: firstResult.title,
        searchLink: firstResult.image?.contextLink || firstResult.link
      };
    }
    return null;
  } catch (e) {
    console.error('Google search error:', e);
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    console.log('Starting product week rank update via Edge API...');

    // Config values (fallback to defaults if not in env/params)
    const { searchParams } = new URL(req.url);
    const country = searchParams.get('country') || 'US';
    const categoryId = parseInt(searchParams.get('categoryId') || '609');
    const limit = parseInt(searchParams.get('limit') || '10');

    // Env vars
    const datasetId = process.env.BIGQUERY_DATASET_ID || 'new_gmc_data';
    const sourceTableId = 'product_rank_history'; // Assuming this is the source
    const targetTableId = 'product_week_rank_enriched';

    const apiKey = process.env.GOOGLE_SEARCH_API_KEY;
    const engineId = process.env.GOOGLE_SEARCH_ENGINE_ID;

    if (!apiKey || !engineId) {
      return NextResponse.json({ error: "Missing Google Search configuration" }, { status: 500 });
    }

    const bq = getBigQueryClient();

    // 1. Get products
    const products = await getTopProductsFromBigQuery(bq, country, categoryId, limit, datasetId, sourceTableId);
    console.log(`Found ${products.length} products`);

    if (products.length === 0) {
      return NextResponse.json({ message: "No products found", count: 0 });
    }

    // 2. Enrich with Google Search (batched to avoid timeouts, but sequential for rate limits)
    // Note: Edge has CPU limits, but await fetch is I/O.
    const enrichedProducts = [];
    for (const product of products) {
      const searchResult = await searchGoogleProduct(product.product_title, apiKey, engineId);
      enrichedProducts.push({
        ...product,
        imageUrl: searchResult?.imageUrl || null,
        searchTitle: searchResult?.searchTitle || null,
        searchLink: searchResult?.searchLink || null,
        category_id: categoryId,
        country: country,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
      // Tiny delay if needed, but in Edge usually better to proceed fast
    }

    // 3. Insert into BigQuery
    // Since our simple client doesn't support table.insert() helper, we use INSERT via query
    // Constructing a large INSERT statement
    if (enrichedProducts.length > 0) {
      const values = enrichedProducts.map(p => {
        // Sanitize strings for SQL
        const safe = (s: any) => s ? `'${String(s).replace(/'/g, "\\'")}'` : 'NULL';
        return `(${safe(p.rank)}, ${safe(p.product_title)}, ${p.category_id}, ${safe(p.imageUrl)}, ${safe(p.searchTitle)}, ${safe(p.searchLink)}, ${safe(p.country)}, ${safe(p.rank_timestamp)}, ${safe(p.created_at)}, ${safe(p.updated_at)})`;
      }).join(',');

      const insertQuery = `
            INSERT INTO \`${bq.projectId}.${datasetId}.${targetTableId}\` 
            (rank, product_title, category_id, image_url, search_title, search_link, country, rank_timestamp, created_at, updated_at)
            VALUES ${values}
        `;

      await bq.query({ query: insertQuery });
    }

    return NextResponse.json({
      message: "Product week rank update completed",
      count: enrichedProducts.length
    });

  } catch (error: any) {
    console.error('Error in product week rank update:', error);
    return NextResponse.json({
      error: "Failed to update product week rank",
      details: error.message
    }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const country = searchParams.get('country') || 'US';
    const categoryId = parseInt(searchParams.get('categoryId') || '609');

    return NextResponse.json({
      message: "Product week rank API is ready",
      country,
      categoryId,
      note: "Run POST request to start the update process"
    });
  } catch (error) {
    console.error('Error in GET request:', error);
    return NextResponse.json({
      error: "Failed to process request"
    }, { status: 500 });
  }
} 