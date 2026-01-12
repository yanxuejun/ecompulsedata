// 在页面顶部添加
export const revalidate = 86400; // 缓存 24 小时

import { db } from '@/lib/firebase-admin';
import { notFound } from 'next/navigation';
import { Metadata } from 'next';

interface Props {
    params: { id: string };
}

// 1. 动态生成 SEO 元数据，方便 AdSense 爬虫索引
export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const doc = await db.collection('site_content').doc(params.id).get();
    const data = doc.data();

    if (!data) return { title: 'Category Not Found' };

    return {
        title: `${data.category_name} - 2026 US Market Trends & Best Sellers`,
        description: data.seo_description?.substring(0, 160),
    };
}

// 2. 服务器组件直接抓取数据并渲染 HTML
export default async function TrendPage({ params }: Props) {
    const doc = await db.collection('site_content').doc(params.id).get();

    if (!doc.exists) {
        notFound();
    }

    const data = doc.data()!;

    return (
        <article className="max-w-4xl mx-auto p-6">
            {/* 头部：对爬虫友好的 H1 */}
            <header className="mb-8 border-b pb-4">
                <h1 className="text-4xl font-extrabold text-gray-900 mb-2">
                    {data.category_name} Trending Analysis
                </h1>
                <p className="text-sm text-gray-500">
                    Last Updated: {data.last_updated?.toDate().toLocaleDateString()}
                </p>
            </header>

            {/* AI 生成的 SEO 描述：AdSense 的核心内容区 */}
            <section className="prose prose-blue max-w-none mb-12">
                <h2 className="text-2xl font-bold mb-4">Market Insight</h2>
                <div className="bg-blue-50 p-6 rounded-xl border border-blue-100 shadow-sm text-gray-800 leading-relaxed">
                    {data.seo_description}
                </div>
            </section>

            {/* Top 100 产品表格 */}
            <section>
                <h2 className="text-2xl font-bold mb-6">Top 100 Best Sellers</h2>
                <div className="overflow-x-auto shadow-md rounded-lg">
                    <table className="w-full text-left text-sm text-gray-700">
                        <thead className="bg-gray-100 text-gray-600 uppercase text-xs">
                            <tr>
                                <th className="px-4 py-3">Rank</th>
                                <th className="px-4 py-3">Product Name</th>
                                <th className="px-4 py-3">Brand</th>
                                <th className="px-4 py-3">Category Path</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {data.top_100_products?.map((item: any) => (
                                <tr key={item.rank} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-4 py-3 font-semibold text-blue-600">{item.rank}</td>
                                    <td className="px-4 py-3 font-medium text-gray-900">{item.title}</td>
                                    <td className="px-4 py-3">{item.brand || '-'}</td>
                                    {/* 这里渲染你之前存入的 category_l1 到 l5 */}
                                    <td className="px-4 py-3 text-xs text-gray-400">
                                        {item.category_l2 && <span>{item.category_l2}</span>}
                                        {item.category_l3 && <span> &gt; {item.category_l3}</span>}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>
        </article>
    );
}