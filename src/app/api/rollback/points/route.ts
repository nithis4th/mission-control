import { NextRequest, NextResponse } from 'next/server';
import { createRollbackPoint, listRollbackPoints } from '@/lib/rollback';

export async function GET(request: NextRequest) {
  try {
    const limit = Number(request.nextUrl.searchParams.get('limit') || '30');
    const points = listRollbackPoints(limit);
    return NextResponse.json({ points });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const note = typeof body.note === 'string' ? body.note : undefined;
    const point = createRollbackPoint(note);
    return NextResponse.json({ point }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
