import { auth } from "@clerk/nextjs/server";
import { deductUserCredit, getUserProfile } from "@/lib/bigquery";
import { NextResponse } from "next/server";

export const runtime = 'edge';

export async function POST() {
  const { userId } = await auth();
  console.log("[credits/deduct] userId:", userId);
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  try {
    // 先检查用户当前积分
    const profile = await getUserProfile(userId);
    if (!profile) {
      return NextResponse.json({ error: "User profile not found" }, { status: 404 });
    }

    if (profile.credits <= 0) {
      return NextResponse.json({
        error: "Insufficient credits",
        message: "积分不足，请升级套餐或等待下月重置"
      }, { status: 400 });
    }

    // 扣除积分
    await deductUserCredit(userId);
    console.log("[credits/deduct] Successfully deducted credit for:", userId);

    // 重新获取更新后的积分
    const updatedProfile = await getUserProfile(userId);
    const remainingCredits = updatedProfile?.credits || profile.credits - 1;

    // 新增日志：积分变化
    console.log(`[CREDITS] 用户 ${userId} 积分变动: 原积分=${profile.credits}, 剩余积分=${remainingCredits}`);

    return NextResponse.json({
      success: true,
      remainingCredits,
      message: `积分扣除成功，剩余积分：${remainingCredits}`
    });
  } catch (e) {
    console.error("[credits/deduct] Error:", e);
    return NextResponse.json({
      error: "Failed to deduct credit",
      detail: String(e),
      message: "扣除积分失败，请稍后重试"
    }, { status: 500 });
  }
} 