import { NextResponse } from 'next/server';
import { computeCostData } from '@/lib/cost/calculate';
import { execSync } from 'child_process';

export const dynamic = 'force-dynamic';

type UsageDaily = {
  date: string;
  totalCost: number;
  totalTokens: number;
};

type UsageTotals = {
  totalCost: number;
  totalTokens: number;
};

type UsageCostJson = {
  daily?: UsageDaily[];
  totals?: UsageTotals;
};

function getBangkokDate(date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function readGatewayUsageCost() {
  try {
    const raw = execSync('openclaw gateway usage-cost --json 2>/dev/null', {
      timeout: 10000,
      encoding: 'utf-8',
      env: {
        ...process.env,
        PATH: '/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:' + (process.env.PATH || ''),
      },
    });
    const data = JSON.parse(raw) as UsageCostJson;
    const today = getBangkokDate(new Date());
    const todayRow = (data.daily || []).find((d) => d.date === today);

    return {
      todayCost: Number(todayRow?.totalCost || 0),
      todayTokens: Number(todayRow?.totalTokens || 0),
      totalCost: Number(data.totals?.totalCost || 0),
      totalTokens: Number(data.totals?.totalTokens || 0),
      source: 'gateway-usage-cost',
    };
  } catch {
    return null;
  }
}

// GET /api/cost
export async function GET() {
  try {
    // Prefer gateway's authoritative usage-cost when available
    const usage = readGatewayUsageCost();

    const data = await computeCostData();

    if (usage) {
      return NextResponse.json({
        ...data,
        todayCost: usage.todayCost,
        todayTokens: usage.todayTokens,
        totalCost: usage.totalCost,
        totalTokens: usage.totalTokens,
        costSource: usage.source,
      });
    }

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
