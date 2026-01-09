import { MetadataRoute } from 'next'

export const runtime = 'edge';

export default function robots(): MetadataRoute.Robots {
    return {
        rules: {
            userAgent: '*',
            allow: '/',
            disallow: ['/api/'],
        },
        sitemap: 'https://ecompulsedata.com/sitemap.xml',
    }
}
