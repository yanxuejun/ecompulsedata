import { MetadataRoute } from 'next'

export const runtime = 'edge';

export default function sitemap(): MetadataRoute.Sitemap {
    const baseUrl = 'https://www.ecompulsedata.com';

    const routes = [
        '',
        '/how-it-works',
        '/pricing',
        '/products-explorer',
        '/rank-improvement',
        '/momentum-analysis',
        '/privacy-policy',
        '/refund-policy',
        '/terms-of-service',
    ];

    return routes.map((route) => ({
        url: `${baseUrl}${route}`,
        lastModified: new Date(),
        changeFrequency: 'daily',
        priority: route === '' ? 1 : 0.8,
    }));
}
