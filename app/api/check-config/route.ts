import { NextResponse } from "next/server";

export const runtime = 'edge';

export async function GET() {
  const config = {
    stripe: {
      secretKey: !!process.env.STRIPE_SECRET_KEY,
      publishableKey: !!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
    },
    clerk: {
      publishableKey: !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
      secretKey: !!process.env.CLERK_SECRET_KEY,
    },
    database: {
      url: !!process.env.DATABASE_URL,
    },
  };

  return NextResponse.json(config);
} 