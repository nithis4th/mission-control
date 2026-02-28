import { NextRequest, NextResponse } from 'next/server';
import {
  getBangkokDate,
  listRecentSnapshots,
  readSnapshot,
  type CostSnapshot,
} from '@/lib/cost-history';

export const dynamic = 'force-dynamic';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidDateString(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime());
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const date = searchParams.get('date');

    if (date) {
      if (!isValidDateString(date)) {
        return NextResponse.json({ error: 'Invalid date format. Use YYYY-MM-DD' }, { status: 400 });
      }

      const snapshot = await readSnapshot(date);
      if (!snapshot) {
        return NextResponse.json({ error: `No cost snapshot for ${date}`, date }, { status: 404 });
      }

      const trend = await listRecentSnapshots(7);
      return NextResponse.json({ date, snapshot, trend });
    }

    const today = getBangkokDate(new Date());
    const snapshot = await readSnapshot(today);
    const trend = await listRecentSnapshots(7);

    return NextResponse.json({ date: today, snapshot, trend });
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error }, { status: 500 });
  }
}
