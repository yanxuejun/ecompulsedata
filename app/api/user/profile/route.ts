import { auth } from "@clerk/nextjs/server";
import { getUserProfile } from "@/lib/bigquery";
import { NextResponse } from "next/server";

export const runtime = 'edge';

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const profile = await getUserProfile(userId);
  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }
  return NextResponse.json(profile);
} 