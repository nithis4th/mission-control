import { NextResponse } from 'next/server';
import { computeCostData } from '@/lib/cost/calculate';
import { getBangkokDate, writeSnapshot, type CostSnapshot } from '@/lib/cost-history';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const cost = await computeCostData();
    const date = getBangkokDate(new Date());

    const snapshot: CostSnapshot = {
      date,
      takenAt: new Date().toISOString(),
      totalTokens: cost.totalTokens,
      totalCost: cost.totalCost,
      todayTokens: cost.todayTokens,
      todayCost: cost.todayCost,
      modelBreakdown: cost.modelBreakdown,
    };

    const filePath = await writeSnapshot(snapshot);

    return NextResponse.json({ ok: true, date, filePath, snapshot });
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ ok: false, error }, { status: 500 });
  }
}
