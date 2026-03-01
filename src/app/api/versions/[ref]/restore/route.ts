import { NextRequest, NextResponse } from 'next/server';
import { createRestoreBranchFromRef } from '@/lib/versions';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: { ref: string } }
) {
  try {
    const body = await request.json().catch(() => ({}));
    const label = typeof body?.label === 'string' ? body.label : undefined;
    const ref = decodeURIComponent(params.ref);

    const result = createRestoreBranchFromRef(ref, label);
    return NextResponse.json({
      ok: true,
      ...result,
      instructions: `Review branch ${result.branch} then merge when ready.`,
    });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
