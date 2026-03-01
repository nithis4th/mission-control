import { NextRequest, NextResponse } from 'next/server';
import { getSnapshot, workspaceCurrentFile } from '@/lib/snapshots';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const snapshot = getSnapshot(params.id);

    const withCurrent = Object.fromEntries(
      snapshot.files.map((f) => [f, workspaceCurrentFile(f)])
    );

    return NextResponse.json({
      snapshot: {
        id: snapshot.id,
        timestamp: snapshot.timestamp,
        label: snapshot.label,
        files: snapshot.files,
      },
      snapshotContents: snapshot.contents,
      currentContents: withCurrent,
    });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
