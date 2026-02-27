import { NextRequest, NextResponse } from 'next/server';
import { chatCompletions } from '@/lib/openclaw/gateway-http';

/**
 * POST /api/chat — Send a message to Eve (agent: main) via OpenClaw Gateway
 *
 * Uses the HTTP /v1/chat/completions endpoint directly.
 * No WebSocket, no polling — synchronous request/response.
 *
 * Body: { message: string, agentId?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, agentId } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'message is required' },
        { status: 400 },
      );
    }

    const targetAgent = agentId || 'main';

    const responseText = await chatCompletions(
      targetAgent,
      message,
      'mission-control',
    );

    return NextResponse.json({
      response: responseText,
      status: 'ok',
      agentId: targetAgent,
    });
  } catch (error) {
    console.error('Chat API error:', error);
    const msg = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
