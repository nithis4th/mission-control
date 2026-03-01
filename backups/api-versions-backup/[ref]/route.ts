import { NextRequest, NextResponse } from 'next/server';
import { deleteVersionTag, renameVersionTag } from '@/lib/versions';

export const dynamic = 'force-dynamic';

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { ref: string } }
) {
  try {
    const result = deleteVersionTag(params.ref);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { ref: string } }
) {
  try {
    const body = await request.json().catch(() => ({}));
    const newLabel = typeof body?.newLabel === 'string' ? body.newLabel : '';
    if (!newLabel.trim()) {
      return NextResponse.json({ error: 'newLabel is required' }, { status: 400 });
    }

    const result = renameVersionTag(params.ref, newLabel);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
