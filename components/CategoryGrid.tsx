// components/CategoryGrid.tsx
// components/CategoryGrid.tsx
export const dynamic = 'force-dynamic';
export const revalidate = 0;
import Link from 'next/link';

async function getAllCategories() {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/site_content?key=${apiKey}`;

    try {
        const res = await fetch(url, { next: { revalidate: 3600 } });
        const data = await res.json();
        if (!data.documents) return [];
        return data.documents.map((doc: any) => ({
            id: doc.name.split('/').pop(),
            name: doc.fields.category_name?.stringValue || "Unknown",
            desc: doc.fields.seo_description?.stringValue || ""
        }));
    } catch (e) {
        return [];
    }
}

export default async function CategoryGrid() {
    const categories = await getAllCategories();
    console.log("Categories found:", categories.length);

    if (categories.length === 0) return null;

    return (
        <section id="explore" className="py-24 bg-slate-50/50">
            <div className="container mx-auto px-6">
                <div className="text-center mb-16">
                    <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
                        Trending Market Categories
                    </h2>
                    <p className="text-slate-500 max-w-2xl mx-auto">
                        Deep dive into high-growth niches. Updated weekly via Google Merchant Center data.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {categories.map((cat) => (
                        <Link
                            key={cat.id}
                            href={`/trends/${cat.id}`}
                            className="group bg-white rounded-2xl p-8 shadow-sm border border-slate-100 hover:shadow-xl hover:border-blue-500 transition-all duration-300"
                        >
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-2 h-8 bg-blue-600 rounded-full group-hover:h-10 transition-all" />
                                <h3 className="text-xl font-bold text-slate-800">{cat.name}</h3>
                            </div>
                            <p className="text-slate-500 text-sm leading-relaxed line-clamp-2 mb-6">
                                {cat.desc || `Latest market trends and top 100 products for ${cat.name}.`}
                            </p>
                            <div className="flex items-center text-blue-600 font-bold text-sm">
                                View Reports
                                <svg className="w-4 h-4 ml-2 group-hover:translate-x-2 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                </svg>
                            </div>
                        </Link>
                    ))}
                </div>
            </div>
        </section>
    );
}