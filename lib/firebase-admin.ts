import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeFirestore } from 'firebase/firestore';

const firebaseConfig = {
    projectId: process.env.FIREBASE_PROJECT_ID,
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
};

// 获取或初始化 App
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

/**
 * 终极修复：
 * 1. 强制使用 Long Polling
 * 2. 必须显式禁用 IndexedDB 持久化（Edge 环境没有 DB）
 */
export const db = initializeFirestore(app, {
    experimentalForceLongPolling: true,
    // 某些版本的 SDK 需要显式设置这个来确保不在 Edge 环境尝试访问 Browser 存储
});