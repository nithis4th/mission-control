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
  transcriptPath?: string;
}

interface SessionsJson {
  sessions?: RawSession[];
}

export interface DocSession {
  key: string;
  sessionId?: string;
  date: string;         // ISO date string
  dateLabel: 'today' | 'yesterday' | 'earlier';
  model: string;
  messageCount: number; // estimated from tokens
  excerpt: string;      // last user message preview
  kind: string;
}

function getDateLabel(dateStr: string): 'today' | 'yesterday' | 'earlier' {
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (dateStr === today) return 'today';
  if (dateStr === yesterday) return 'yesterday';
  return 'earlier';
}

function shortModelName(model: string): string {
  if (!model) return 'unknown';
  // e.g. "openrouter/anthropic/claude-sonnet-4-6" → "claude-sonnet-4-6"
  const parts = model.split('/');
  return parts[parts.length - 1] || model;
}

function estimateMessages(tokens: number | undefined): number {
  // rough: average ~200 tokens per message exchange
  if (!tokens) return 0;
  return Math.max(1, Math.round(tokens / 200));
}

function getExcerpt(key: string): string {
  // Try to read transcript for last message
  try {
    const agentId = key.split(':')[1] || 'main';
    const sessionsPath = `/Users/nithis4th/.openclaw/agents/${agentId}/sessions/sessions.json`;
    // We can't read individual session transcripts without more info
    // Just return key-based excerpt
    const parts = key.split(':');
    if (parts[2] === 'telegram' && parts[3] === 'direct') {
      return 'แชทกับ Eve ผ่าน Telegram';
    }
    if (parts[2] === 'cron') {
      return 'Cron job session';
    }
    if (parts[2] === 'telegram' && parts[3] === 'group') {
      return 'Group chat session';
    }
    if (parts[2] === 'openai') {
      return 'OpenAI-compatible session';
    }
    return sessionsPath ? 'Direct session' : key;
  } catch {
    return key;
  }
}

export async function GET() {
  try {
    let raw = '';
    try {
      raw = execSync('openclaw sessions --agent main --json 2>/dev/null', {
        timeout: 10000,
        encoding: 'utf-8',
      });
    } catch {
      return NextResponse.json({ sessions: [], error: 'openclaw not available' });
    }

    if (!raw.trim()) {
      return NextResponse.json({ sessions: [] });
    }

    const parsed: SessionsJson = JSON.parse(raw);
    const allSessions: RawSession[] = parsed.sessions || [];

    // Filter: direct sessions only (kind === 'direct' or key contains 'direct')
    const directSessions = allSessions.filter(
      (s) =>
        s.kind === 'direct' ||
        s.key.includes(':direct:') ||
        (s.key.includes('telegram') && !s.key.includes('group') && !s.key.includes('cron'))
    );

    const sessions: DocSession[] = directSessions.map((s) => {
      const ts = s.updatedAt ? new Date(s.updatedAt) : new Date();
      const dateStr = ts.toISOString().slice(0, 10);

      return {
        key: s.key,
        sessionId: s.sessionId,
        date: ts.toISOString(),
        dateLabel: getDateLabel(dateStr),
        model: shortModelName(s.model || ''),
        messageCount: estimateMessages(s.totalTokens || s.inputTokens),
        excerpt: getExcerpt(s.key),
        kind: s.kind || 'direct',
      };
    });

    // Sort newest first
    sessions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return NextResponse.json({ sessions });
  } catch (error) {
    console.error('Failed to fetch docs/sessions:', error);
    return NextResponse.json({ error: 'Failed to fetch sessions' }, { status: 500 });
  }
}
