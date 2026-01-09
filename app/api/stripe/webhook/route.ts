import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { headers } from "next/headers";
// 1. 引入 BigQuery 工具
import { updateUserProfileCreditsAndTier, getUserProfile } from '@/lib/bigquery';

export const runtime = 'edge';

// 检查环境变量
if (!process.env.STRIPE_SECRET_KEY) {
  console.error("STRIPE_SECRET_KEY is not set");


}

// 只有在有密钥时才初始化 Stripe
const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: "2025-06-30.basil",
  })
  : null;

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const headersList = await headers();
    const signature = headersList.get('stripe-signature');

    if (!signature || !webhookSecret || !stripe) {
      return NextResponse.json({ error: "Webhook signature verification failed" }, { status: 400 });
    }

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    console.log('[STRIPE] Webhook received event type:', event.type);

    // 处理不同类型的事件
    switch (event.type) {
      case 'checkout.session.completed':
        const session = event.data.object as Stripe.Checkout.Session;
        console.log('[STRIPE] Payment completed for session:', session.id);
        console.log('[STRIPE] session object:', JSON.stringify(session, null, 2));
        // 获取 Clerk userId 和 tier
        const userId = session.client_reference_id || session.metadata?.userId;
        const tier = session.metadata?.tier;
        const subscriptionId = session.subscription as string | undefined;
        console.log('[STRIPE] Extracted userId:', userId, 'tier:', tier, 'subscriptionId:', subscriptionId);
        if (!userId || !tier) {
          console.warn('[STRIPE] userId 或 tier 缺失，无法更新用户信息', { userId, tier, session });
          break;
        }
        // 获取当前用户套餐
        const userProfile = await getUserProfile(userId);
        console.log('[STRIPE] userProfile:', userProfile);
        if (!userProfile) {
          console.warn('[STRIPE] userProfile 不存在，userId:', userId);
          break;
        }
        const currentTier = userProfile.tier;
        // 禁止Premium降级
        if (currentTier === 'premium' && (tier === 'standard' || tier === 'starter')) {
          console.log(`[STRIPE] 用户 ${userId} 当前为Premium，禁止降级到${tier}`);
          break;
        }
        let credits: number | null = 20;
        if (tier === 'standard') {
          credits = 580;
        }
        if (tier === 'premium') {
          credits = 999999;
        }
        console.log('[STRIPE] currentTier:', currentTier, 'targetTier:', tier, 'targetCredits:', credits);
        // 只有升级或同级才允许更新
        if (
          (currentTier === 'starter' && (tier === 'standard' || tier === 'premium')) ||
          (currentTier === 'standard' && tier === 'premium') ||
          (currentTier === tier) // 允许同级覆盖
        ) {
          console.log('[STRIPE] Updating user credits, tier, and subscriptionId in BigQuery...', { userId, credits, tier, subscriptionId });
          await updateUserProfileCreditsAndTier(userId, credits, tier, subscriptionId);
          console.log('[STRIPE] BigQuery update complete');
        } else {
          console.log('[STRIPE] 不满足升级/同级条件，不更新 credits/tier');
        }
        break;

      case 'payment_intent.succeeded':
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        console.log('Payment intent succeeded:', paymentIntent.id);
        break;

      case 'payment_intent.payment_failed':
        const failedPayment = event.data.object as Stripe.PaymentIntent;
        console.log('Payment failed:', failedPayment.id);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error('Webhook error:', err);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
} 