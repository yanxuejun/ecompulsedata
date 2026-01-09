import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { auth } from "@clerk/nextjs/server";

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

// 价格映射 - 使用实际的 Stripe 价格 ID
const priceMap: Record<string, { priceId: string; name: string }> = {
  starter: { priceId: process.env.STRIPE_PRICE_ID_STARTER!, name: 'Starter Plan' },
  standard: { priceId: process.env.STRIPE_PRICE_ID_STANDARD!, name: 'Standard Plan' },
  premium: { priceId: process.env.STRIPE_PRICE_ID_PREMIUM!, name: 'Premium Plan' },
};

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    const { tier } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    if (!tier) {
      return NextResponse.json({ error: "Tier is required" }, { status: 400 });
    }

    const priceInfo = priceMap[tier];
    if (!priceInfo) {
      return NextResponse.json({ error: "Invalid tier" }, { status: 400 });
    }

    if (!stripe || !process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json({
        error: "Stripe not configured. Please set STRIPE_SECRET_KEY environment variable."
      }, { status: 500 });
    }

    // 创建订阅 Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceInfo.priceId,
          quantity: 1,
        },
      ],
      mode: "subscription",
      client_reference_id: userId,
      metadata: {
        userId,
        tier,
      },
      success_url: `${req.nextUrl.origin}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.nextUrl.origin}/payment-cancel`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("Stripe checkout error:", err);
    return NextResponse.json({ error: "Stripe error" }, { status: 500 });
  }
} 