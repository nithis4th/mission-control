'use client';

import { useEffect, useState, useMemo } from 'react';

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

interface SessionMessage {
  role: 'user' | 'assistant' | 'system';
  content: unknown;
  timestamp?: string | number;
}

const DATE_LABEL_MAP = {
  today:     { label: 'Today',     color: 'text-mc-accent-green' },
  yesterday: { label: 'Yesterday', color: 'text-mc-accent-yellow' },
  earlier:   { label: 'Earlier',   color: 'text-mc-text-secondary' },
};

function formatDateTime(isoStr: string): string {
  const d = new Date(isoStr);
  return d.toLocaleString('th-TH', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}



function extractTextContent(content: unknown): string {
  if (typeof content === 'string') return content.trim();
  if (Array.isArray(content)) {
    const text = content
      .map((item) => {
        if (typeof item === 'string') return item;
        if (!item || typeof item !== 'object') return '';
        const rec = item as Record<string, unknown>;
        const type = String(rec.type || '');
        // keep only plain text blocks; drop thinking/tool payloads
        if (type && type !== 'text') return '';
        return typeof rec.text === 'string' ? rec.text : '';
      })
      .filter(Boolean)
      .join(' ')
      .trim();
    return text;
  }
  return '';
}

function shortKey(key: string): string {
  // e.g. "agent:main:telegram:direct:6600459815" → "telegram · direct"
  const parts = key.split(':');
  if (parts.length >= 4) {
    return `${parts[2]} · ${parts[3]}`;
  }
  return key.slice(0, 30);
}

function SessionMessages({ sessionKey, onClose }: { sessionKey: string; onClose: () => void }) {
  const [messages, setMessages] = useState<SessionMessage[]>([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const id = encodeURIComponent(sessionKey);
        const res = await fetch(`/api/openclaw/sessions/${id}/history`);
        if (res.ok) {
          const data = await res.json();
          setMessages(data.messages || data.history || []);
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, [sessionKey]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-mc-bg-secondary border border-mc-border rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-mc-border flex-shrink-0">
          <div className="flex-1 min-w-0 pr-4">
            <h2 className="text-sm font-bold text-mc-text font-mono truncate">{shortKey(sessionKey)}</h2>
            <p className="text-xs text-mc-text-secondary mt-0.5">Session History · Agent chat only</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-mc-bg-tertiary text-mc-text-secondary hover:text-mc-text transition-colors text-lg leading-none">
            ×
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-mc-text-secondary text-sm animate-pulse">Loading history...</div>
            </div>
          ) : messages
              .map((m) => ({ ...m, plainText: extractTextContent(m.content) }))
              .filter((m) => {
                if (m.role === 'system') return false;
                const t = String(m.plainText || '').trim();
                if (!t) return false;
                if (t.startsWith('System: [') && t.includes('Exec')) return false;
                return true;
              }).length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="text-3xl mb-2">💬</div>
                <p className="text-mc-text-secondary text-sm">ไม่มีประวัติแชทให้แสดง</p>
              </div>
            </div>
          ) : (
            messages
              .map((m) => ({ ...m, plainText: extractTextContent(m.content) }))
              .filter((m) => {
                if (m.role === 'system') return false;
                const t = String(m.plainText || '').trim();
                if (!t) return false;
                // Drop OpenClaw runtime/system log noise
                if (t.startsWith('System: [') && t.includes('Exec completed')) return false;
                if (t.startsWith('System: [') && t.includes('Exec failed')) return false;
                if (t.startsWith('System: [') && t.includes('Exec')) return false;
                return true;
              })
                .map((msg, i) => (
              <div
                key={i}
                className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role !== 'user' && (
                  <div className="w-6 h-6 rounded-full bg-mc-accent/20 flex items-center justify-center text-xs flex-shrink-0 mt-0.5">
                    🦋
                  </div>
                )}
                <div
                  className={`max-w-[80%] rounded-xl px-3 py-2 text-xs leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-mc-accent/15 text-mc-text border border-mc-accent/20'
                      : msg.role === 'system'
                      ? 'bg-mc-bg-tertiary text-mc-text-secondary border border-mc-border italic'
                      : 'bg-mc-bg-tertiary text-mc-text border border-mc-border'
                  }`}
                >
                  {msg.plainText.slice(0, 500) + (msg.plainText.length > 500 ? "..." : "")}
                  {msg.timestamp && (
                    <div className="mt-1 text-[10px] opacity-60">
                      {formatDateTime(typeof msg.timestamp === 'string' ? msg.timestamp : new Date(msg.timestamp).toISOString())}
                    </div>
                  )}
                </div>
                {msg.role === 'user' && (
                  <div className="w-6 h-6 rounded-full bg-mc-accent-purple/20 flex items-center justify-center text-xs flex-shrink-0 mt-0.5">
                    👤
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function SessionRow({ session, onOpen }: { session: DocSession; onOpen: () => void }) {
  return (
    <div
      className="flex items-center justify-between gap-3 py-3 px-4 hover:bg-mc-bg-tertiary/40 transition-colors border-b border-mc-border last:border-0 cursor-pointer group"
      onClick={onOpen}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-xs text-mc-text font-medium truncate">{session.agentName} · {shortKey(session.key)}</span>
          <span className="text-[10px] text-mc-text-secondary/50 font-mono flex-shrink-0">
            {session.messageCount}msg
          </span>
        </div>
        <p className="text-xs text-mc-text-secondary truncate">{session.excerpt}</p>
      </div>
      <div className="flex-shrink-0 text-right">
        <p className="text-[10px] text-mc-text-secondary/60">{formatDateTime(session.date)}</p>
        <p className="text-[10px] text-mc-accent/60 font-mono mt-0.5 truncate max-w-[100px]">{session.model}</p>
      </div>
      <span className="text-[10px] text-mc-accent opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">→</span>
    </div>
  );
}

type Section = 'today' | 'yesterday' | 'earlier';
const SECTIONS: Section[] = ['today', 'yesterday', 'earlier'];

export function DocTab() {
  const [sessions, setSessions] = useState<DocSession[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [agentFilter, setAgentFilter] = useState('all');
  const [openSession, setOpenSession] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const loadDocs = async () => {
    try {
      const res = await fetch('/api/docs');
      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions || []);
        setLastUpdated(new Date());
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocs();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sessions.filter((s) => {
      const passSearch = !q ||
        s.key.toLowerCase().includes(q) ||
        s.excerpt.toLowerCase().includes(q) ||
        s.model.toLowerCase().includes(q);

      const passAgent = agentFilter === 'all' || (s.agentName || s.agentId) === agentFilter;
      return passSearch && passAgent;
    });
  }, [sessions, search, agentFilter]);

  const grouped: Record<Section, DocSession[]> = {
    today:     filtered.filter((s) => s.dateLabel === 'today'),
    yesterday: filtered.filter((s) => s.dateLabel === 'yesterday'),
    earlier:   filtered.filter((s) => s.dateLabel === 'earlier'),
  };

  const byAgent = useMemo(() => {
    const map: Record<string, DocSession[]> = {};
    for (const s of filtered) {
      const key = s.agentName || s.agentId || 'Unknown';
      if (!map[key]) map[key] = [];
      map[key].push(s);
    }
    return Object.entries(map).sort((a, b) => b[1].length - a[1].length);
  }, [filtered]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-3 animate-pulse">📄</div>
          <p className="text-mc-text-secondary text-sm">Loading sessions...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex-shrink-0 px-6 pt-6 pb-4 border-b border-mc-border">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-mc-text">History</h2>
              <p className="text-xs text-mc-text-secondary mt-0.5">
                {sessions.length} sessions (recent)
                <span className="ml-2 opacity-70">· filter: {agentFilter === 'all' ? 'All' : agentFilter}</span>
                {lastUpdated && (
                  <span className="ml-2 opacity-60">
                    · updated {lastUpdated.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </p>
            </div>
            <button
              onClick={loadDocs}
              className="text-xs text-mc-text-secondary hover:text-mc-text px-2 py-1 rounded border border-mc-border hover:border-mc-accent/40 transition-colors"
            >
              Refresh
            </button>
          </div>



          {/* Agent Filters */}
          <div className="mt-3 rounded-xl border border-mc-border bg-mc-bg-secondary p-3">
            <div className="text-[11px] text-mc-text-secondary mb-2">Filter by Agent</div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setAgentFilter('all')}
                className={`text-[10px] px-2 py-1 rounded border transition-colors ${agentFilter === 'all' ? 'border-mc-accent/50 text-mc-accent bg-mc-accent/10' : 'border-mc-border bg-mc-bg text-mc-text-secondary hover:text-mc-text'}`}
              >
                All · {sessions.length}
              </button>
              {byAgent.map(([name, rows]) => (
                <button
                  key={name}
                  onClick={() => setAgentFilter(name)}
                  className={`text-[10px] px-2 py-1 rounded border transition-colors ${agentFilter === name ? 'border-mc-accent/50 text-mc-accent bg-mc-accent/10' : 'border-mc-border bg-mc-bg text-mc-text-secondary hover:text-mc-text'}`}
                >
                  {name} · {rows.length}
                </button>
              ))}
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-mc-text-secondary text-sm">🔍</span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ค้นหาประวัติแชท..."
              className="w-full bg-mc-bg border border-mc-border rounded-lg pl-9 pr-4 py-2 text-sm text-mc-text placeholder:text-mc-text-secondary/50 focus:outline-none focus:border-mc-accent/50 transition-colors"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-mc-text-secondary hover:text-mc-text text-sm"
              >
                ×
              </button>
            )}
          </div>
        </div>

        {/* Sessions List */}
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <div className="text-5xl mb-3">{search ? '🔍' : '💬'}</div>
                <p className="text-sm font-medium text-mc-text">
                  {search ? `ไม่พบ "${search}"` : 'ยังไม่มีประวัติแชท'}
                </p>
                {!search && (
                  <p className="text-xs text-mc-text-secondary mt-1">
                    session จะแสดงหลังจากมีการแชทกับ Eve
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="p-6 space-y-6">
              {SECTIONS.map((section) => {
                const items = grouped[section];
                if (items.length === 0) return null;
                const cfg = DATE_LABEL_MAP[section];
                return (
                  <div key={section}>
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className={`text-xs font-bold uppercase tracking-wider ${cfg.color}`}>
                        {cfg.label}
                      </h3>
                      <div className="flex-1 h-px bg-mc-border" />
                      <span className="text-[10px] text-mc-text-secondary">{items.length}</span>
                    </div>
                    <div className="bg-mc-bg-secondary border border-mc-border rounded-xl overflow-hidden">
                      {items.map((session) => (
                        <SessionRow
                          key={session.key}
                          session={session}
                          onOpen={() => setOpenSession(session.key)}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Session History Modal */}
      {openSession && (
        <SessionMessages sessionKey={openSession} onClose={() => setOpenSession(null)} />
      )}
    </>
  );
}
