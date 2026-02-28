import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

type RawMessage = {
  role?: string;
  content?: unknown;
  timestamp?: string | number;
};

export type ArchivedMessage = {
  id: string;
  agentId: string;
  sessionKey: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
};

const ARCHIVE_DIR = path.join(process.env.HOME || '', '.openclaw', 'workspace', 'chat-archive');

function normalizeAgentId(sessionKey: string): string {
  const parts = sessionKey.split(':');
  return (parts[1] || 'unknown').toLowerCase();
}

function extractText(content: unknown): string {
  if (typeof content === 'string') return content.trim();
  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item === 'string') return item;
        if (!item || typeof item !== 'object') return '';
        const rec = item as Record<string, unknown>;
        const type = String(rec.type || '');
        if (type && type !== 'text') return '';
        return typeof rec.text === 'string' ? rec.text : '';
      })
      .filter(Boolean)
      .join(' ')
      .trim();
  }
  return '';
}

function toIso(ts?: string | number): string {
  if (!ts) return new Date().toISOString();
  if (typeof ts === 'string') {
    const d = new Date(ts);
    return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
  }
  const ms = ts < 1e12 ? ts * 1000 : ts;
  return new Date(ms).toISOString();
}

function msgId(sessionKey: string, role: string, ts: string, text: string) {
  return crypto.createHash('sha1').update(`${sessionKey}|${role}|${ts}|${text}`).digest('hex');
}

async function ensureDir() {
  await fs.mkdir(ARCHIVE_DIR, { recursive: true });
}

function archivePath(agentId: string) {
  return path.join(ARCHIVE_DIR, `${agentId}.jsonl`);
}

export async function appendArchiveFromSession(sessionKey: string, messages: RawMessage[]) {
  if (!sessionKey || !Array.isArray(messages) || messages.length === 0) return;
  const agentId = normalizeAgentId(sessionKey);
  await ensureDir();

  const file = archivePath(agentId);
  let existing = '';
  try {
    existing = await fs.readFile(file, 'utf-8');
  } catch {
    // no file yet
  }

  const known = new Set<string>();
  if (existing) {
    for (const line of existing.split('\n')) {
      if (!line.trim()) continue;
      try {
        const row = JSON.parse(line) as ArchivedMessage;
        if (row.id) known.add(row.id);
      } catch {
        // ignore bad line
      }
    }
  }

  const out: string[] = [];
  for (const m of messages) {
    const role = m.role === 'user' || m.role === 'assistant' ? m.role : null;
    if (!role) continue;
    const text = extractText(m.content);
    if (!text) continue;
    if (text.startsWith('System: [') && text.includes('Exec')) continue;

    const ts = toIso(m.timestamp);
    const id = msgId(sessionKey, role, ts, text);
    if (known.has(id)) continue;
    known.add(id);

    const row: ArchivedMessage = { id, agentId, sessionKey, role, text, timestamp: ts };
    out.push(JSON.stringify(row));
  }

  if (out.length > 0) {
    await fs.appendFile(file, out.join('\n') + '\n', 'utf-8');
  }
}

export async function readAgentArchive(
  agentId: string,
  limit = 2000,
  offset = 0,
): Promise<{ rows: ArchivedMessage[]; total: number }> {
  const file = archivePath(agentId.toLowerCase());
  try {
    const raw = await fs.readFile(file, 'utf-8');
    const rows: ArchivedMessage[] = [];
    for (const line of raw.split('\n')) {
      if (!line.trim()) continue;
      try {
        rows.push(JSON.parse(line));
      } catch {
        // ignore
      }
    }
    // newest first for pagination
    rows.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    const total = rows.length;
    return { rows: rows.slice(offset, offset + limit), total };
  } catch {
    return { rows: [], total: 0 };
  }
}
