import { NextResponse } from 'next/server';
import { execSync } from 'child_process';

export const dynamic = 'force-dynamic';

interface RawSession {
  key: string;
  updatedAt?: number;
  kind?: string;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  agentId?: string;
  sessionId?: string;
}

interface SessionsJson {
  sessions?: RawSession[];
  stores?: Array<{ sessions?: RawSession[] }>;
}

export interface DocSession {
  key: string;
  sessionId?: string;
  date: string;
  dateLabel: 'today' | 'yesterday' | 'earlier';
  model: string;
  messageCount: number;
  excerpt: string;
  kind: string;
  agentId: string;
  agentName: string;
}

const AGENT_NAME: Record<string, string> = {
  main: 'Eve',
  dexter: 'Dexter',
  sherlock: 'Sherlock',
  shelby: 'Shelby',
  bluma: 'Bluma',
  goku: 'Goku',
  monalisa: 'Monalisa',
};

function getDateLabel(dateStr: string): 'today' | 'yesterday' | 'earlier' {
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (dateStr === today) return 'today';
  if (dateStr === yesterday) return 'yesterday';
  return 'earlier';
}

function shortModelName(model: string): string {
  if (!model) return 'unknown';
  const parts = model.split('/');
  return parts[parts.length - 1] || model;
}

function estimateMessages(tokens: number | undefined): number {
  if (!tokens) return 0;
  return Math.max(1, Math.round(tokens / 200));
}

function parseAgentIdFromKey(key: string): string {
  const parts = key.split(':');
  return (parts[1] || 'main').toLowerCase();
}

function isHumanChatSession(s: RawSession): boolean {
  const key = s.key || '';
  if (!key) return false;

  // keep human-like conversations; drop cron/system/group noise
  if (key.includes(':cron:')) return false;
  if (key.includes(':group:')) return false;
  if (s.kind === 'group') return false;

  // direct channels and web/openai user chats
  if (key.includes(':direct:')) return true;
  if (key.includes(':openai-user:')) return true;
  if (key.includes(':openai:')) return true;
  if (s.kind === 'direct') return true;

  return false;
}

function getExcerpt(key: string, agentName: string): string {
  if (key.includes(':direct:')) return `แชทตรงกับ ${agentName}`;
  if (key.includes(':openai-user:')) return `แชทผ่าน Mission Dashboard กับ ${agentName}`;
  if (key.includes(':openai:')) return `แชท API กับ ${agentName}`;
  return `แชทกับ ${agentName}`;
}

export async function GET() {
  try {
    let raw = '';
    try {
      raw = execSync('openclaw sessions --all-agents --json 2>/dev/null', {
        timeout: 10000,
        encoding: 'utf-8',
      });
    } catch {
      return NextResponse.json({ sessions: [], error: 'openclaw not available' });
    }

    if (!raw.trim()) return NextResponse.json({ sessions: [] });

    const parsed: SessionsJson = JSON.parse(raw);
    const allSessions: RawSession[] = [];

    if (Array.isArray(parsed.sessions)) allSessions.push(...parsed.sessions);
    if (Array.isArray(parsed.stores)) {
      for (const store of parsed.stores) {
        if (Array.isArray(store.sessions)) allSessions.push(...store.sessions);
      }
    }

    const chatSessions = allSessions.filter(isHumanChatSession);

    const sessions: DocSession[] = chatSessions.map((s) => {
      const tsRaw = s.updatedAt || Date.now();
      const tsMs = tsRaw < 1e12 ? tsRaw * 1000 : tsRaw;
      const ts = new Date(tsMs);
      const dateStr = ts.toISOString().slice(0, 10);
      const agentId = (s.agentId || parseAgentIdFromKey(s.key)).toLowerCase();
      const agentName = AGENT_NAME[agentId] || agentId;

      return {
        key: s.key,
        sessionId: s.sessionId,
        date: ts.toISOString(),
        dateLabel: getDateLabel(dateStr),
        model: shortModelName(s.model || ''),
        messageCount: estimateMessages(s.totalTokens || s.inputTokens),
        excerpt: getExcerpt(s.key, agentName),
        kind: s.kind || 'direct',
        agentId,
        agentName,
      };
    });

    sessions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return NextResponse.json({ sessions });
  } catch (error) {
    console.error('Failed to fetch docs/sessions:', error);
    return NextResponse.json({ error: 'Failed to fetch sessions' }, { status: 500 });
  }
}
