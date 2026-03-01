import { NextRequest, NextResponse } from 'next/server';
import { restoreSnapshotOne } from '@/lib/snapshots';

export const dynamic = 'force-dynamic';

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string; filename: string } }
) {
  try {
    const rel = decodeURIComponent(params.filename);
    const result = restoreSnapshotOne(params.id, rel);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
