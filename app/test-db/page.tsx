export const runtime = 'edge'; // 添加这一行
import { db } from '@/lib/firebase-admin';

// 强制动态渲染，不使用缓存
export const dynamic = 'force-dynamic';

export default async function TestDBPage() {
    try {
        // 尝试读取一个已知 ID，或者获取集合前 1 条数据进行测试
        const snapshot = await db.collection('site_content').limit(1).get();

        if (snapshot.empty) {
            return (
                <div style={{ padding: '40px' }}>
                    <h1 style={{ color: '#d97706' }}>✅ 连接成功，但数据库是空的</h1>
                    <p>Firebase 握手成功，但 'site_content' 集合里没有任何文档。</p>
                </div>
            );
        }

        const firstDoc = snapshot.docs[0].data();

        return (
            <div style={{ padding: '40px', fontFamily: 'sans-serif' }}>
                <h1 style={{ color: '#16a34a' }}>🚀 Firebase 连接成功!</h1>
                <div style={{ marginTop: '20px', padding: '15px', background: '#f3f4f6', border: '1px solid #ddd' }}>
                    <p><b>项目 ID:</b> {process.env.FIREBASE_PROJECT_ID}</p>
                    <p><b>读取到的分类:</b> {firstDoc.category_name}</p>
                </div>
                <h3 style={{ marginTop: '20px' }}>第一条商品预览:</h3>
                <pre style={{ background: '#1e1e1e', color: '#4ade80', padding: '15px', borderRadius: '8px', overflow: 'auto' }}>
                    {JSON.stringify(firstDoc.top_100_products?.[0], null, 2)}
                </pre>
            </div>
        );
    } catch (error: any) {
        return (
            <div style={{ padding: '40px', color: '#dc2626' }}>
                <h1>❌ 连接失败</h1>
                <pre style={{ background: '#fee2e2', padding: '15px', border: '1px solid #fecaca' }}>
                    {error.message}
                </pre>
                <div style={{ marginTop: '20px', color: '#666' }}>
                    <p><b>常见原因：</b></p>
                    <ul>
                        <li>环境变量 <code>FIREBASE_PRIVATE_KEY</code> 没填对</li>
                        <li>Cloudflare 未开启 <code>nodejs_compat</code></li>
                    </ul>
                </div>
            </div>
        );
    }
}