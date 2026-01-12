export const runtime = 'edge'; // 必须保持 edge 运行时

import { db } from '@/lib/firebase-admin';
import { collection, query, limit, getDocs } from 'firebase/firestore';

export default async function TestDBPage() {
    try {
        // 使用 JS SDK 的新语法：query(collection(db, 'name'), limit(n))
        const q = query(collection(db, 'site_content'), limit(1));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            return (
                <div className="p-10">
                    <h1 className="text-red-500 text-2xl">Connection Successful!</h1>
                    <p className="mt-4">But the collection "site_content" is empty.</p>
                </div>
            );
        }

        const data = snapshot.docs[0].data();

        return (
            <div className="p-10">
                <h1 className="text-green-500 text-2xl">✅ Database Connected!</h1>
                <div className="mt-6 p-4 bg-gray-100 rounded border">
                    <p><strong>First Document ID:</strong> {snapshot.docs[0].id}</p>
                    <pre className="mt-2 text-xs overflow-auto">
                        {JSON.stringify(data, null, 2)}
                    </pre>
                </div>
            </div>
        );
    } catch (error: any) {
        console.error("Database test error:", error);
        return (
            <div className="p-10">
                <h1 className="text-red-500 text-2xl">❌ Connection Failed</h1>
                <p className="mt-4 bg-red-50 p-4 border border-red-200 text-red-700">
                    {error.message || "Unknown error occurred"}
                </p>
                <p className="mt-2 text-sm text-gray-500">
                    Check if your Firestore Security Rules allow public read.
                </p>
            </div>
        );
    }
}