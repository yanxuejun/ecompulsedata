import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeFirestore, terminate, outOfBandConfirmation, connectFirestoreEmulator } from 'firebase/firestore';

const firebaseConfig = {
    projectId: process.env.FIREBASE_PROJECT_ID,
    // 即使只读，有时也需要一个空的 apiKey 来防止 SDK 报错
    apiKey: "AIzaSy..." // 你可以从 Firebase 控制台 Project Settings 获取真实的，或者留空
};

// 初始化 App
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

/**
 * 关键修改：使用 initializeFirestore 而不是 getFirestore
 * 并且设置 forceLongPolling: true 
 * 这会强制 SDK 使用 Cloudflare 支持的普通 HTTP 请求
 */
import { getFirestore, skipNetworkErrorDiffing } from 'firebase/firestore';

export const db = initializeFirestore(app, {
    experimentalForceLongPolling: true, // 强制长轮询（HTTP 模式）
});