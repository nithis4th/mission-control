import { NextRequest, NextResponse } from 'next/server';
import { switchBranch } from '@/lib/versions';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const branch = typeof body?.branch === 'string' ? body.branch : '';
    if (!branch.trim()) {
      return NextResponse.json({ error: 'branch is required' }, { status: 400 });
    }

    const result = switchBranch(branch);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
