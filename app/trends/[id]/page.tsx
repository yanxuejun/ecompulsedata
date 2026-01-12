export const runtime = 'edge'; // 必须声明，解决 Cloudflare 部署报错
export const dynamic = 'force-dynamic';

import { db } from '@/lib/firebase-admin';
import { doc, getDoc } from 'firebase/firestore'; // 注意：这里导入的是函数式语法
import { notFound } from 'next/navigation';
import { Metadata } from 'next';

type Props = {
    params: Promise<{ id: string }>;
};

/**
 * 1. 动态生成 SEO 元数据
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { id } = await params;

    try {
        const docRef = doc(db, 'site_content', id);
        const docSnap = await getDoc(docRef);
        const data = docSnap.data();

        if (!data) return { title: 'Category Not Found' };

        return {
            title: `${data.category_name} Top 100 Best Sellers - 2026 Trends`,
            description: data.seo_description?.substring(0, 160),
        };
    } catch (e) {
        return { title: 'Market Trends Analysis' };
    }
}

/**
 * 2. 详情页主组件
 */
export default async function TrendPage({ params }: Props) {
    const { id } = await params;

    // 使用 Firebase JS SDK 获取数据
    let data: any;
    try {
        const docRef = doc(db, 'site_content', id);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
            notFound();
        }
        data = docSnap.data();
    } catch (error) {
        console.error("Firestore read error:", error);
        // 如果报错，通常是 Firebase Rules 权限问题
        throw new Error("Failed to fetch data. Check your Firestore Security Rules.");
    }

    return (
        <main className="max-w-5xl mx-auto px-4 py-8 font-sans">
            {/* 导航 */}
            <nav className="text-sm text-gray-500 mb-6">
                <a href="/" className="hover:text-blue-600 transition-colors">Home</a>
                <span className="mx-2">/</span>
                <span className="text-gray-900 font-medium">{data.category_name}</span>
            </nav>

            {/* 标题区 */}
            <header className="mb-10">
                <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 mb-4 tracking-tight">
                    {data.category_name} <span className="text-blue-600">Trends</span>
                </h1>
                <div className="flex items-center space-x-4 text-sm">
                    <span className="bg-blue-600 text-white px-3 py-1 rounded-full font-semibold">2026 Update</span>
                    <span className="text-gray-400">
                        Last analyzed: {data.last_updated?.toDate ? data.last_updated.toDate().toLocaleDateString() : 'Recently'}
                    </span>
                </div>
            </header>

            {/* SEO 文本区 - 吸引 AdSense 爬虫 */}
            <section className="mb-12 bg-gradient-to-br from-gray-50 to-white border border-gray-200 p-8 rounded-3xl shadow-sm">
                <h2 className="text-2xl font-bold text-gray-800 mb-4 tracking-tight">Market Analysis</h2>
                <p className="text-gray-700 leading-relaxed text-lg italic">
                    "{data.seo_description}"
                </p>
            </section>

            {/* 商品列表 */}
            <section>
                <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center">
                    <span className="bg-yellow-400 w-2 h-8 mr-3 rounded-full"></span>
                    Best Sellers Ranking
                </h2>
                <div className="grid gap-4">
                    {data.top_100_products?.map((product: any) => (
                        <div
                            key={product.rank}
                            className="group flex items-center bg-white border border-gray-100 p-4 rounded-2xl hover:border-blue-300 hover:shadow-md transition-all"
                        >
                            <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center bg-blue-50 text-blue-700 font-black rounded-xl text-xl mr-5 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                {product.rank}
                            </div>
                            <div className="flex-grow">
                                <h3 className="text-gray-900 font-bold group-hover:text-blue-600 transition-colors">
                                    {product.title}
                                </h3>
                                <p className="text-sm text-gray-400 mt-1 uppercase tracking-widest font-medium">
                                    Brand: {product.brand || 'Trending'}
                                </p>
                            </div>
                            <div className="hidden md:block text-right">
                                <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded-md">
                                    {product.category_l2}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* 页脚 */}
            <footer className="mt-20 pt-8 border-t border-gray-100 text-center">
                <p className="text-gray-400 text-sm">
                    &copy; 2026 Market Trends Scout. All rights reserved. Data updated weekly.
                </p>
            </footer>
        </main>
    );
}