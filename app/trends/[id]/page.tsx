export const runtime = 'edge';
export const dynamic = 'force-dynamic';

import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import Link from 'next/link';

type Props = {
    params: Promise<{ id: string }>;
};

/**
 * 格式化 Firestore REST API 返回的复杂对象
 */
function formatFirestoreData(fields: any) {
    if (!fields) return {};
    const result: any = {};
    for (const key in fields) {
        const valueObj = fields[key];
        const type = Object.keys(valueObj)[0];
        let val = valueObj[type];

        if (type === 'arrayValue') {
            // 改进点：检查数组内是对象(mapValue)还是普通值
            val = val.values ? val.values.map((v: any) => {
                const subType = Object.keys(v)[0];
                if (subType === 'mapValue') return formatFirestoreData(v.mapValue.fields);
                return v[subType]; // 返回字符串、数字等基本类型
            }) : [];
        } else if (type === 'mapValue') {
            val = formatFirestoreData(val.fields);
        } else if (type === 'timestampValue') {
            val = new Date(val).toLocaleDateString();
        } else if (type === 'integerValue') {
            val = parseInt(val);
        } else if (type === 'doubleValue') {
            val = parseFloat(val);
        } else if (type === 'nullValue') {
            val = null;
        }
        result[key] = val;
    }
    return result;
}

/**
 * 通过 REST API 获取单个文档
 */
async function getDocViaRest(id: string) {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;

    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/site_content/${id}?key=${apiKey}`;

    try {
        const res = await fetch(url, {
            next: { revalidate: 3600 },
        });

        if (res.status === 404) return null;
        if (!res.ok) throw new Error(`Rest API Error: ${res.statusText}`);

        const rawData = await res.json();
        return formatFirestoreData(rawData.fields);
    } catch (e) {
        console.error("Fetch Trend Error:", e);
        return null;
    }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { id } = await params;
    const data = await getDocViaRest(id);
    if (!data) return { title: 'Category Not Found' };
    return { title: `${data.category_name} - 2026 Global Market Trends` };
}

export default async function TrendPage({ params }: Props) {
    const { id } = await params;
    const data = await getDocViaRest(id);

    if (!data) notFound();

    return (
        <main className="max-w-5xl mx-auto px-4 py-12 font-sans antialiased bg-white">
            {/* 面包屑导航 */}
            <nav className="text-sm text-slate-400 mb-10 flex items-center gap-2">
                <Link href="/" className="hover:text-blue-600 transition-colors">Home</Link>
                <span className="text-slate-300">/</span>
                <span className="font-medium text-slate-600">{data.category_name}</span>
            </nav>

            {/* 核心分析头部 */}
            <div className="bg-slate-50 rounded-[2.5rem] p-10 mb-16 border border-slate-100 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-100/30 rounded-full -mr-20 -mt-20 blur-3xl" />
                <div className="relative z-10">
                    <span className="inline-block px-4 py-1.5 mb-6 text-xs font-bold tracking-widest text-blue-600 uppercase bg-blue-50 rounded-full">
                        Market Insights Report
                    </span>
                    <h1 className="text-4xl md:text-5xl font-black text-slate-900 mb-6 tracking-tight">
                        {data.category_name}
                    </h1>
                    <p className="text-xl text-slate-600 leading-relaxed max-w-3xl">
                        {data.seo_description}
                    </p>
                </div>
            </div>

            {/* 产品列表 */}
            <div className="space-y-6">
                <div className="flex items-center justify-between mb-8 px-2">
                    <h2 className="text-2xl font-bold text-slate-900">Weekly Top 100</h2>
                    <span className="text-sm text-slate-400 font-medium">Updated 2026-01-15</span>
                </div>

                {data.top_100_products?.map((item: any, idx: number) => (
                    <div key={idx} className="group flex flex-col md:flex-row items-center p-5 bg-white hover:bg-slate-50/50 transition-all rounded-[1.5rem] border border-slate-100 hover:border-blue-200 shadow-sm hover:shadow-xl hover:shadow-blue-500/5">

                        {/* 左侧：排名与图片 */}
                        <div className="flex items-center w-full md:w-auto mb-4 md:mb-0">
                            <div className="flex flex-col items-center justify-center mr-6">
                                <span className="text-xs font-bold text-slate-300 uppercase mb-1">Rank</span>
                                <span className="text-2xl font-black text-slate-900 leading-none">
                                    {(idx + 1).toString().padStart(2, '0')}
                                </span>
                            </div>

                            {item.image_url && typeof item.image_url === 'string' && (
                                <div className="w-24 h-24 rounded-2xl overflow-hidden bg-slate-50 flex-shrink-0 border border-slate-100 mr-8 p-1 relative">
                                    <img
                                        src={item.image_url}
                                        alt={item.title}
                                        className="w-full h-full object-contain group-hover:scale-110 transition-transform duration-500 relative z-10"
                                    />
                                    {/* 图片下方的占位背景，如果图片加载失败会显示出灰色底色 */}
                                    <div className="absolute inset-0 flex items-center justify-center text-[10px] text-slate-300">
                                        Loading...
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* 中间：标题、品牌、需求度 */}
                        <div className="flex-grow w-full">
                            <h3 className="font-bold text-slate-900 text-lg leading-tight mb-2 group-hover:text-blue-600 transition-colors line-clamp-2">
                                {item.title}
                            </h3>
                            <div className="flex flex-wrap items-center gap-3">
                                <span className="text-sm text-slate-500 font-medium px-2 py-0.5 bg-slate-100 rounded-md">
                                    {item.brand || 'Trending Brand'}
                                </span>

                                {/* 需求度勋章 */}
                                <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full border ${item.relative_demand === 'VERY_HIGH'
                                    ? 'bg-orange-50 border-orange-100 text-orange-600'
                                    : 'bg-emerald-50 border-emerald-100 text-emerald-600'
                                    }`}>
                                    <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${item.relative_demand === 'VERY_HIGH' ? 'bg-orange-400' : 'bg-emerald-400'
                                        }`} />
                                    <span className="text-[10px] font-bold uppercase tracking-wider">
                                        {item.relative_demand?.replace('_', ' ')} Demand
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* 右侧：价格区间 */}
                        <div className="flex flex-row md:flex-col items-center md:items-end justify-between w-full md:w-auto mt-6 md:mt-0 md:ml-8 pt-4 md:pt-0 border-t md:border-t-0 border-slate-100">
                            <div className="text-left md:text-right">
                                <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-1">Price Index</p>
                                <div className="flex items-baseline gap-1 text-slate-900">
                                    <span className="text-sm font-bold text-blue-600">{item.currency || 'USD'}</span>
                                    <span className="text-xl font-black">{item.min_price}</span>
                                    <span className="text-slate-300 font-light mx-1">—</span>
                                    <span className="text-xl font-black">{item.max_price}</span>
                                </div>
                            </div>
                        </div>

                    </div>
                ))}
            </div>

            {/* 底部导航 */}
            <div className="mt-20 pt-10 border-t border-slate-100 text-center">
                <Link href="/" className="inline-flex items-center justify-center px-8 py-3 bg-slate-900 text-white font-bold rounded-full hover:bg-blue-600 transition-all">
                    ← Back to Market Categories
                </Link>
            </div>
        </main>
    );
}