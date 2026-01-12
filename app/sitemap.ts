import { MetadataRoute } from 'next';

export const runtime = 'edge';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const baseUrl = 'https://www.ecompulsedata.com';

    // 1. 静态路由
    const staticRoutes = [
        '',
        '/how-it-works',
        '/pricing',
        '/products-explorer',
        '/rank-improvement',
        '/momentum-analysis',
        '/privacy-policy',
        '/refund-policy',
        '/terms-of-service',
    ].map((route) => ({
        url: `${baseUrl}${route}`,
        lastModified: new Date(),
        changeFrequency: 'daily' as const,
        priority: route === '' ? 1 : 0.8,
    }));

    // 2. 动态路由 (从 Firestore 获取所有趋势分类)
    let dynamicRoutes: any[] = [];
    try {
        const projectId = process.env.FIREBASE_PROJECT_ID;
        const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
        // 使用 mask.fieldPaths=name 仅获取文档名称，节省流量和时间
        const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/site_content?key=${apiKey}&mask.fieldPaths=category_name`;

        const res = await fetch(url, { next: { revalidate: 3600 } });
        const data = await res.json();

        if (data.documents) {
            dynamicRoutes = data.documents.map((doc: any) => {
                const id = doc.name.split('/').pop();
                return {
                    url: `${baseUrl}/trends/${id}`,
                    lastModified: new Date(),
                    changeFrequency: 'weekly' as const,
                    priority: 0.7,
                };
            });
        }
    } catch (error) {
        console.error('Failed to fetch dynamic routes for sitemap:', error);
    }

    // 3. 合并静态和动态路由
    return [...staticRoutes, ...dynamicRoutes];
}