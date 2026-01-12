export const runtime = 'edge';
export const dynamic = 'force-dynamic';

import { db } from '@/lib/firebase-admin';
import { doc, getDoc } from 'firebase/firestore';
import { notFound } from 'next/navigation';
import { Metadata } from 'next';

type Props = {
    params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { id } = await params;
    try {
        const docRef = doc(db, 'site_content', id);
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists()) return { title: 'Not Found' };
        const data = docSnap.data();
        return { title: `${data.category_name || 'Trends'} - 2026 Market Analysis` };
    } catch (e) {
        return { title: 'Market Trends' };
    }
}

export default async function TrendPage({ params }: Props) {
    const { id } = await params;

    let data: any;
    try {
        const docRef = doc(db, 'site_content', id);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
            console.error(`Document with ID ${id} not found in Firestore`);
            notFound();
        }
        data = docSnap.data();
    } catch (error) {
        // 这能帮助你在 Cloudflare Logs 里看到具体错误
        console.error("Critical Firestore Error:", error);
        throw error;
    }

    // 安全地处理日期显示
    const displayDate = () => {
        try {
            if (data.last_updated?.toDate) return data.last_updated.toDate().toLocaleDateString();
            if (data.last_updated?.seconds) return new Date(data.last_updated.seconds * 1000).toLocaleDateString();
            return new Date().toLocaleDateString();
        } catch (e) {
            return 'Recently Updated';
        }
    };

    return (
        <main className="max-w-5xl mx-auto px-4 py-8 tracking-tight">
            <nav className="mb-4 text-sm"><a href="/" className="text-blue-600">Home</a> / {id}</nav>

            <header className="mb-10">
                <h1 className="text-4xl font-black text-gray-900 mb-2">
                    {data.category_name || 'Market Category'}
                </h1>
                <p className="text-gray-500 text-sm">Update: {displayDate()}</p>
            </header>

            {data.seo_description && (
                <section className="mb-12 p-6 bg-blue-50 border border-blue-100 rounded-2xl text-gray-700 leading-relaxed">
                    {data.seo_description}
                </section>
            )}

            <div className="space-y-3">
                {data.top_100_products?.map((item: any, idx: number) => (
                    <div key={idx} className="flex items-center p-4 bg-white border rounded-xl shadow-sm">
                        <span className="w-10 font-bold text-blue-600">#{item.rank || idx + 1}</span>
                        <div className="flex-1">
                            <p className="font-bold text-gray-900">{item.title}</p>
                            <p className="text-xs text-gray-400">{item.brand}</p>
                        </div>
                    </div>
                ))}
            </div>
        </main>
    );
}