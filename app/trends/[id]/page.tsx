export const runtime = 'edge'; // 添加这一行
export const dynamic = 'force-dynamic'; // 建议同时也显式声明为动态

import { db } from '@/lib/firebase-admin';
import { notFound } from 'next/navigation';
import { Metadata } from 'next';

// 定义 Next.js 15 要求的 Promise Params 类型
type Props = {
    params: Promise<{ id: string }>;
};

/**
 * 1. 动态生成 SEO 元数据
 * 对 AdSense 和 Google 索引至关重要
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { id } = await params; // 必须 await

    try {
        const doc = await db.collection('site_content').doc(id).get();
        const data = doc.data();

        if (!data) return { title: 'Category Not Found - Market Trends' };

        return {
            title: `${data.category_name} Top 100 Best Sellers & Trends - 2026`,
            description: data.seo_description?.substring(0, 160),
            keywords: `${data.category_name}, best sellers, market analysis, trending products`,
        };
    } catch (e) {
        return { title: 'Market Trends Analysis' };
    }
}

/**
 * 2. 详情页主组件
 */
export default async function TrendPage({ params }: Props) {
    // 在 Next.js 15 中，必须 await params
    const { id } = await params;

    // 从 Firestore 获取数据
    let data: any;
    try {
        const doc = await db.collection('site_content').doc(id).get();
        if (!doc.exists) {
            notFound();
        }
        data = doc.data();
    } catch (error) {
        console.error("Firestore read error:", error);
        throw new Error("Failed to fetch data from database");
    }

    return (
        <main className="max-w-5xl mx-auto px-4 py-8 font-sans">
            {/* 面包屑导航 - 对 SEO 友好 */}
            <nav className="text-sm text-gray-500 mb-4">
                <a href="/" className="hover:underline">Home</a> /
                <span className="ml-2 text-gray-900">{data.category_name}</span>
            </nav>

            {/* 头部标题区 */}
            <header className="mb-10 border-b pb-6">
                <h1 className="text-4xl font-black text-gray-900 mb-3 tracking-tight">
                    {data.category_name} <span className="text-blue-600">Market Insight</span>
                </h1>
                <div className="flex items-center text-sm text-gray-500 space-x-4">
                    <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded">US Market</span>
                    <span>Updated: {data.last_updated?.toDate().toLocaleDateString()}</span>
                </div>
            </header>

            {/* AI 生成的 SEO 分析文案 - AdSense 爬虫最看重的内容 */}
            <section className="mb-12">
                <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center">
                    <span className="mr-2">📊</span> Weekly Trend Analysis
                </h2>
                <div className="bg-white border border-gray-200 p-6 rounded-2xl shadow-sm leading-relaxed text-gray-700 text-lg">
                    {data.seo_description}
                </div>
            </section>

            {/* Top 100 商品表格 */}
            <section>
                <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center">
                    <span className="mr-2">🏆</span> Top 100 Best Sellers
                </h2>
                <div className="overflow-hidden border border-gray-200 rounded-xl shadow-sm">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Rank</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Product</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Brand</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Category Path</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {data.top_100_products?.map((product: any) => (
                                <tr key={product.rank} className="hover:bg-blue-50/50 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-blue-600">
                                        #{product.rank}
                                    </td>
                                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                                        {product.title}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                        {product.brand || 'Generic'}
                                    </td>
                                    <td className="px-6 py-4 text-xs text-gray-400">
                                        <div className="flex flex-wrap gap-1">
                                            <span className="bg-gray-100 px-1.5 py-0.5 rounded">{product.category_l2}</span>
                                            {product.category_l3 && (
                                                <>
                                                    <span>&gt;</span>
                                                    <span className="bg-gray-100 px-1.5 py-0.5 rounded">{product.category_l3}</span>
                                                </>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            {/* 页脚免责声明 - 增加页面内容长度，利于 SEO */}
            <footer className="mt-16 pt-8 border-t text-gray-400 text-xs text-center italic">
                Data source: Google Merchant Center Best Sellers (Weekly).
                Market analysis is generated by AI based on historical ranking trends.
            </footer>
        </main>
    );
}