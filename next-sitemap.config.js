/** @type {import('next-sitemap').IConfig} */
module.exports = {
    siteUrl: process.env.SITE_URL || 'https://ecompulsedata.com', // Replace with your actual domain
    generateRobotsTxt: true, // (optional)
    // ...other options
    // outDir: 'out', // if you are using static export
    exclude: ['/api/*'], // Exclude API routes
    robotsTxtOptions: {
        policies: [
            {
                userAgent: '*',
                allow: '/',
                disallow: ['/api/*'],
            },
        ],
    },
}
