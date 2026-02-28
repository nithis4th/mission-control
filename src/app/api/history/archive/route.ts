import { NextRequest, NextResponse } from 'next/server';
import { execSync } from 'child_process';
import { getSessionHistory } from '@/lib/openclaw/gateway-http';
import { appendArchiveFromSession, readAgentArchive } from '@/lib/chat-archive';

export const dynamic = 'force-dynamic';

type RawSession = { key?: string; agentId?: string };

type SessionsJson = { sessions?: RawSession[]; stores?: Array<{ sessions?: RawSession[] }> };

function listAllSessionKeys(): string[] {
  try {
    const raw = execSync('openclaw sessions --all-agents --json 2>/dev/null', {
      timeout: 10000,
      encoding: 'utf-8',
    });
    const parsed = JSON.parse(raw) as SessionsJson;
    const arr: RawSession[] = [];
    if (Array.isArray(parsed.sessions)) arr.push(...parsed.sessions);
    if (Array.isArray(parsed.stores)) {
      for (const st of parsed.stores) {
        if (Array.isArray(st.sessions)) arr.push(...st.sessions);
      }
    }
    return arr.map((s) => s.key || '').filter(Boolean);
  } catch {
    return [];
  }
}

// GET /api/history/archive?agent=dexter&sync=1
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const agent = (searchParams.get('agent') || '').toLowerCase();
  const sync = searchParams.get('sync') === '1';

  try {
    if (sync) {
      const keys = listAllSessionKeys();
      const filtered = agent ? keys.filter((k) => k.split(':')[1]?.toLowerCase() === agent) : keys;

      // sync in sequence to reduce gateway pressure
      for (const key of filtered.slice(-80)) {
        try {
          const history = await getSessionHistory(key);
          await appendArchiveFromSession(key, history as any);
        } catch {
          // ignore one session failure
        }
      }
    }

    if (!agent) {
      return NextResponse.json({ ok: true, note: 'pass ?agent=<id> to read archive' });
    }

    const rows = await readAgentArchive(agent, 5000);
    return NextResponse.json({ ok: true, agent, rows });
  } catch (error) {
    const err = error instanceof Error ? error.message : 'unknown';
    return NextResponse.json({ ok: false, error: err }, { status: 500 });
  }
}
