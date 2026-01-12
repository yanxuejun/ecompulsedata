import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// 这里的配置对应你之前的环境变量
const firebaseConfig = {
    projectId: process.env.FIREBASE_PROJECT_ID,
    // 注意：JS SDK 不需要 clientEmail 和 privateKey 
    // 但为了安全读取 Firestore，请确保你的 Firestore 规则允许读取
    // 或者使用更加轻量级的 REST 方式。
};

// 初始化单例
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const db = getFirestore(app);