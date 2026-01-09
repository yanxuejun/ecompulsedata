import { auth } from "@clerk/nextjs/server";
import { getUserProfile, createUserProfile } from "@/lib/bigquery";
import { NextResponse } from "next/server";

export const runtime = 'edge';

export async function POST(req: Request) {
  const { userId } = await auth();
  console.log("[user/init] userId:", userId);
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const profile = await getUserProfile(userId);
  console.log("[user/init] profile:", profile);
  if (!profile) {
    try {
      let name = "";
      let email = "";
      try {
        const body = await req.json();
        name = body.name || "";
        email = body.email || "";
      } catch { }
      await createUserProfile(userId, name, email); // credits=20, tier='starter'
      console.log("[user/init] createUserProfile success for:", userId, name, email);
      return NextResponse.json({ created: true });
    } catch (e) {
      console.error("[user/init] createUserProfile error:", e);
      return NextResponse.json({ error: "Failed to create UserProfile", detail: String(e) }, { status: 500 });
    }
  }
  return NextResponse.json({ exists: true });
} 