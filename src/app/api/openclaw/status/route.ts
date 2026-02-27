import { NextResponse } from 'next/server';
import { listSessions } from '@/lib/openclaw/gateway-http';

export const dynamic = 'force-dynamic';

// GET /api/openclaw/status - Check OpenClaw connection status
export async function GET() {
  const gatewayUrl = (process.env.OPENCLAW_GATEWAY_URL || 'ws://127.0.0.1:18789')
    .replace(/^ws(s?):\/\//, 'http$1://');

  try {
    const sessions = await listSessions();
    return NextResponse.json({
      connected: true,
      sessions_count: sessions.length,
      sessions,
      gateway_url: gatewayUrl,
    });
  } catch (error) {
    console.error('OpenClaw status check failed:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({
      connected: false,
      error: msg,
      gateway_url: gatewayUrl,
    });
  }
}
