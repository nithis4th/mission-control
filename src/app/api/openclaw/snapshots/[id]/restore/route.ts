import { NextRequest, NextResponse } from 'next/server';
import { restoreSnapshotAll } from '@/lib/snapshots';

export const dynamic = 'force-dynamic';

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const result = restoreSnapshotAll(params.id);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
