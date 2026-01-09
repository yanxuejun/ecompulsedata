import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { auth } from "@clerk/nextjs/server";
import { getUserProfile, updateUserProfileCreditsAndTier } from "@/lib/bigquery";

export const runtime = 'edge';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2025-06-30.basil" });

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const userProfile = await getUserProfile(userId);
  if (!userProfile || !userProfile.subscriptionId) {
    return NextResponse.json({ error: "No active subscription" }, { status: 400 });
  }

  try {
    // 取消订阅（到期后取消）
    await stripe.subscriptions.update(userProfile.subscriptionId, { cancel_at_period_end: true });
    // 可选：同步 BigQuery，降级为 free
    await updateUserProfileCreditsAndTier(userId, 0, "free", undefined);
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: "Failed to cancel subscription", detail: String(e) }, { status: 500 });
  }
} 