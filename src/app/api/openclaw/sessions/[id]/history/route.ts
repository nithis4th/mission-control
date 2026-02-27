import { NextResponse } from 'next/server';
import { getSessionHistory } from '@/lib/openclaw/gateway-http';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/openclaw/sessions/[id]/history - Get conversation history
export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const messages = await getSessionHistory(id);
    return NextResponse.json({ history: messages });
  } catch (error) {
    console.error('Failed to get OpenClaw session history:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
