import { NextRequest, NextResponse } from 'next/server';
import { createSnapshot, listSnapshots } from '@/lib/snapshots';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const limit = Number(request.nextUrl.searchParams.get('limit') || '30');
    const snapshots = listSnapshots(limit);
    return NextResponse.json({ snapshots });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const label = typeof body?.label === 'string' ? body.label : undefined;
    const snapshot = createSnapshot(label);
    return NextResponse.json({ snapshot }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
