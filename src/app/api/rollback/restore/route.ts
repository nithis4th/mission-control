import { NextRequest, NextResponse } from 'next/server';
import { restoreRollbackPoint } from '@/lib/rollback';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const hash = body?.hash as string;
    if (!hash) {
      return NextResponse.json({ error: 'hash is required' }, { status: 400 });
    }

    const result = restoreRollbackPoint(hash);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
