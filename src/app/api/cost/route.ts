import { NextResponse } from 'next/server';
import { computeCostData } from '@/lib/cost/calculate';

export const dynamic = 'force-dynamic';

// GET /api/cost
export async function GET() {
  try {
    const data = await computeCostData();
    return NextResponse.json(data);
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json(
      {
        error,
        sessions: 0,
        modelBreakdown: [],
        totalTokens: 0,
        totalCost: 0,
        todayTokens: 0,
        todayCost: 0,
      },
      { status: 500 }
    );
  }
}
