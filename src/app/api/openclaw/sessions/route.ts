import { NextRequest, NextResponse } from 'next/server';
import { listSessions } from '@/lib/openclaw/gateway-http';
import { queryAll } from '@/lib/db';
import type { OpenClawSession } from '@/lib/types';

// Ensure this route is always dynamic (never cached by Next.js)
export const dynamic = 'force-dynamic';

// GET /api/openclaw/sessions - List OpenClaw sessions
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionType = searchParams.get('session_type');
    const status = searchParams.get('status');

    // If filtering by database fields, query the database
    if (sessionType || status) {
      let sql = 'SELECT * FROM openclaw_sessions WHERE 1=1';
      const params: unknown[] = [];

      if (sessionType) {
        sql += ' AND session_type = ?';
        params.push(sessionType);
      }

      if (status) {
        sql += ' AND status = ?';
        params.push(status);
      }

      sql += ' ORDER BY created_at DESC';

      const sessions = queryAll<OpenClawSession>(sql, params);
      return NextResponse.json(sessions);
    }

    // Query OpenClaw Gateway HTTP API for live sessions
    const sessions = await listSessions();
    return NextResponse.json({
      sessions,
      count: sessions.length,
    });
  } catch (error) {
    console.error('Failed to list OpenClaw sessions:', error);
    const msg = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// POST /api/openclaw/sessions - Create a new OpenClaw session
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { channel } = body;

    if (!channel) {
      return NextResponse.json(
        { error: 'channel is required' },
        { status: 400 },
      );
    }

    // Sessions are created automatically when messages are sent via
    // /v1/chat/completions. Return a helpful error.
    return NextResponse.json(
      {
        error:
          'Direct session creation is not supported via HTTP. Send a message via POST /api/chat to auto-create a session.',
      },
      { status: 501 },
    );
  } catch (error) {
    console.error('Failed to create OpenClaw session:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
