import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

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

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('session_id');

    if (!sessionId) {
      return NextResponse.json({ error: "Session ID is required" }, { status: 400 });
    }

    if (!stripe || !process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json({
        error: "Stripe not configured. Please set STRIPE_SECRET_KEY environment variable."
      }, { status: 500 });
    }

    // 获取支付会话详情
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['line_items', 'customer'],
    });

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // 检查支付状态
    if (session.payment_status !== 'paid') {
      return NextResponse.json({ error: "Payment not completed" }, { status: 400 });
    }

    // 提取支付详情
    const lineItem = session.line_items?.data[0];
    const customer = session.customer as Stripe.Customer;

    const paymentDetails = {
      sessionId: session.id,
      amount: session.amount_total || 0,
      currency: session.currency || 'usd',
      planName: lineItem?.description || 'Unknown Plan',
      customerEmail: customer?.email || session.customer_details?.email || 'Unknown',
      paymentStatus: session.payment_status,
      createdAt: session.created,
    };

    return NextResponse.json(paymentDetails);
  } catch (err) {
    console.error("Session details error:", err);
    return NextResponse.json({ error: "Failed to retrieve session details" }, { status: 500 });
  }
} 