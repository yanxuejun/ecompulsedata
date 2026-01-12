import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeFirestore } from 'firebase/firestore';

const firebaseConfig = {
    // 必须确保 Cloudflare 后台配置了这些环境变量
    projectId: process.env.FIREBASE_PROJECT_ID,
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
};

// 1. 初始化 App（单例模式）
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// 2. 初始化 Firestore 并强制开启 HTTP 长轮询模式
// 这是在 Cloudflare Edge Runtime 中唯一能稳定运行的方式
export const db = initializeFirestore(app, {
    experimentalForceLongPolling: true,
});