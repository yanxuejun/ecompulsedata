import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

// GET /api/favorites/test - Test endpoint to verify API structure
export async function GET(request: NextRequest) {
  try {
    return NextResponse.json({
      success: true,
      message: 'Favorites API is working',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Test error:', error);
    return NextResponse.json(
      { success: false, error: 'Test failed' },
      { status: 500 }
    );
  }
}
