import { NextRequest, NextResponse } from 'next/server';
import { getDiff } from '@/lib/versions';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: { ref: string } }
) {
  try {
    const ref = decodeURIComponent(params.ref);
    const diff = getDiff(ref);
    return NextResponse.json(diff);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
