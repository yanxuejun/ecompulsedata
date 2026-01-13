export const runtime = 'edge';
export const dynamic = 'force-dynamic';

import { notFound } from 'next/navigation';
import { Metadata } from 'next';


type Props = {
    params: Promise<{ id: string }>;
};

// 工具函数：将 Firestore REST API 的复杂格式转为普通 JSON
function formatFirestoreData(fields: any) {
    const result: any = {};
    for (const key in fields) {
        const valueObj = fields[key];
        const type = Object.keys(valueObj)[0];
        let val = valueObj[type];

        if (type === 'arrayValue') {
            val = val.values ? val.values.map((v: any) => formatFirestoreData(v.mapValue.fields)) : [];
        } else if (type === 'timestampValue') {
            val = new Date(val).toLocaleDateString();
        } else if (type === 'integerValue') {
            val = parseInt(val);
        }
        result[key] = val;
    }
    return result;
}

async function getDocViaRest(id: string) {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;

    // 直接使用 Google API 域名，永不走 SDK 逻辑
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/site_content/${id}?key=${apiKey}`;

    const res = await fetch(url, {
        next: { revalidate: 3600 }, // 开启 Next.js 缓存（1小时）
    });

    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Rest API Error: ${res.statusText}`);

    const rawData = await res.json();
    return formatFirestoreData(rawData.fields);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { id } = await params;
    const data = await getDocViaRest(id);
    if (!data) return { title: 'Category Not Found' };
    return { title: `${data.category_name} - 2026 Trends` };
}

export default async function TrendPage({ params }: Props) {
    const { id } = await params;
    const data = await getDocViaRest(id);

    if (!data) notFound();

    return (
        <main className="max-w-5xl mx-auto px-4 py-8 font-sans antialiased">
            <nav className="text-sm text-gray-500 mb-8">
                <a href="/" className="hover:underline">Home</a> / <span className="font-semibold text-gray-900">{data.category_name}</span>
            </nav>

            <div className="bg-white rounded-3xl border border-gray-100 p-8 shadow-sm mb-12">
                <h1 className="text-4xl font-extrabold text-gray-900 mb-4">{data.category_name}</h1>
                <p className="text-lg text-gray-600 leading-relaxed italic border-l-4 border-blue-500 pl-4">
                    {data.seo_description}
                </p>
            </div>

            <div className="grid gap-4">
                <h2 className="text-xl font-bold text-gray-800 mb-2">Top Performance Products</h2>
                {data.top_100_products?.map((item: any, idx: number) => (
                    <div key={idx} className="flex items-center p-5 bg-gray-50 hover:bg-white hover:shadow-md transition-all rounded-2xl border border-transparent hover:border-blue-100">
                        <span className="text-2xl font-black text-blue-200 mr-6 w-8 text-center">{(idx + 1).toString().padStart(2, '0')}</span>
                        <div>
                            <p className="font-bold text-gray-900 text-lg">{item.title}</p>
                            <p className="text-sm text-blue-600 font-medium">{item.brand || 'Trending Brand'}</p>
                        </div>
                    </div>
                ))}
            </div>
        </main>
    );
}