'use client';

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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

interface ArchiveRow {
  id: string;
  agentId: string;
  sessionKey: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
}

interface SessionMessage {
  role: 'user' | 'assistant' | 'system';
  content: unknown;
  timestamp?: string | number;
}

// ---------------------------------------------------------------------------
// Constants & Helpers
// ---------------------------------------------------------------------------

const PAGE_SIZE = 80;

const AGENT_NAMES: Record<string, string> = {
  main: 'Eve', dexter: 'Dexter', sherlock: 'Sherlock',
  shelby: 'Shelby', bluma: 'Bluma', goku: 'Goku', monalisa: 'Monalisa',
};

function formatDateTime(isoStr: string): string {
  const d = new Date(isoStr);
  return d.toLocaleString('th-TH', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

function formatDateKey(isoStr: string): string {
  return new Date(isoStr).toISOString().slice(0, 10);
}

function dayLabel(dateKey: string): { label: string; color: string } {
  const today = new Date().toISOString().slice(0, 10);
  const yest = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (dateKey === today) return { label: 'Today', color: 'text-mc-accent-green' };
  if (dateKey === yest) return { label: 'Yesterday', color: 'text-mc-accent-yellow' };
  // Format as readable date for earlier dates
  const d = new Date(dateKey + 'T00:00:00');
  const label = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  return { label, color: 'text-mc-text-secondary' };
}

function extractTextContent(content: unknown): string {
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

function shortKey(key: string): string {
  const parts = key.split(':');
  if (parts.length >= 4) return `${parts[2]} · ${parts[3]}`;
  return key.slice(0, 30);
}

/** Group rows by date key, return ordered array of [dateKey, rows[]]. Newest day first. */
function groupByDay(rows: ArchiveRow[]): Array<[string, ArchiveRow[]]> {
  const map = new Map<string, ArchiveRow[]>();
  for (const r of rows) {
    const dk = formatDateKey(r.timestamp);
    const arr = map.get(dk);
    if (arr) arr.push(r);
    else map.set(dk, [r]);
  }
  // Sort days newest-first
  const entries = Array.from(map.entries());
  entries.sort((a, b) => b[0].localeCompare(a[0]));
  // Within each day, sort messages chronologically (oldest first)
  for (const [, msgs] of entries) {
    msgs.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }
  return entries;
}

// ---------------------------------------------------------------------------
// SessionMessages modal (unchanged)
// ---------------------------------------------------------------------------

function SessionMessages({ sessionKey, onClose }: { sessionKey: string; onClose: () => void }) {
  const [messages, setMessages] = useState<SessionMessage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const id = encodeURIComponent(sessionKey);
        const res = await fetch(`/api/openclaw/sessions/${id}/history`);
        if (res.ok) {
          const data = await res.json();
          setMessages(data.messages || data.history || []);
        }
      } catch { /* ignore */ } finally { setLoading(false); }
    };
    fetchHistory();
  }, [sessionKey]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const filtered = useMemo(() =>
    messages
      .map((m) => ({ ...m, plainText: extractTextContent(m.content) }))
      .filter((m) => {
        if (m.role === 'system') return false;
        const t = String(m.plainText || '').trim();
        if (!t) return false;
        if (t.startsWith('System: [') && t.includes('Exec')) return false;
        return true;
      }),
    [messages],
  );

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-mc-bg-secondary border border-mc-border rounded-2xl glow-card w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-mc-border flex-shrink-0">
          <div className="flex-1 min-w-0 pr-4">
            <h2 className="text-sm font-bold text-mc-text font-mono truncate">{shortKey(sessionKey)}</h2>
            <p className="text-xs text-mc-text-secondary mt-0.5">Session History</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-mc-bg-tertiary text-mc-text-secondary hover:text-mc-text transition-colors text-lg leading-none">×</button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-12"><div className="text-mc-text-secondary text-sm animate-pulse">Loading history...</div></div>
          ) : filtered.length === 0 ? (
            <div className="flex items-center justify-center py-12"><div className="text-center"><div className="text-3xl mb-2">💬</div><p className="text-mc-text-secondary text-sm">No messages to display</p></div></div>
          ) : (
            filtered.map((msg, i) => (
              <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role !== 'user' && <div className="w-6 h-6 rounded-full bg-mc-accent/20 flex items-center justify-center text-xs flex-shrink-0 mt-0.5">🦋</div>}
                <div className={`max-w-[80%] rounded-xl px-3 py-2 text-xs leading-relaxed ${msg.role === 'user' ? 'bg-mc-accent/15 text-mc-text border border-mc-accent/20' : 'bg-mc-bg-tertiary text-mc-text border border-mc-border'}`}>
                  {msg.plainText.slice(0, 500)}{msg.plainText.length > 500 ? '...' : ''}
                  {msg.timestamp && <div className="mt-1 text-[10px] opacity-60">{formatDateTime(typeof msg.timestamp === 'string' ? msg.timestamp : new Date(msg.timestamp).toISOString())}</div>}
                </div>
                {msg.role === 'user' && <div className="w-6 h-6 rounded-full bg-mc-accent-purple/20 flex items-center justify-center text-xs flex-shrink-0 mt-0.5">👤</div>}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AgentTimeline modal — archive-first with load-more
// ---------------------------------------------------------------------------

function AgentTimeline({ agentName, sessions, onClose }: { agentName: string; sessions: DocSession[]; onClose: () => void }) {
  const [rows, setRows] = useState<ArchiveRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [total, setTotal] = useState(0);
  const offsetRef = useRef(0);
  const agentId = (sessions[0]?.agentId || agentName).toLowerCase();

  const loadPage = useCallback(async (offset: number, doSync: boolean) => {
    const syncParam = doSync ? '&sync=1' : '';
    const res = await fetch(`/api/history/archive?agent=${encodeURIComponent(agentId)}&limit=${PAGE_SIZE}&offset=${offset}${syncParam}`);
    if (!res.ok) return null;
    return res.json() as Promise<{ ok: boolean; rows: ArchiveRow[]; total: number }>;
  }, [agentId]);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      try {
        // 1) Archive-first: sync + first page
        const data = await loadPage(0, true);
        if (data && data.rows.length > 0) {
          setRows(data.rows);
          setTotal(data.total);
          offsetRef.current = data.rows.length;
          return;
        }

        // 2) Fallback: direct session merge (secondary)
        const all: ArchiveRow[] = [];
        const unique = Array.from(new Set(sessions.map((s) => s.key))).slice(0, 20);
        for (const key of unique) {
          const id = encodeURIComponent(key);
          const res = await fetch(`/api/openclaw/sessions/${id}/history`);
          if (!res.ok) continue;
          const d = await res.json();
          const msgs = (d.history || d.messages || []) as Array<{ role: string; content: unknown; timestamp?: string | number }>;
          const agId = key.split(':')[1]?.toLowerCase() || 'unknown';
          for (const m of msgs) {
            if (m.role !== 'user' && m.role !== 'assistant') continue;
            const t = extractTextContent(m.content);
            if (!t || (t.startsWith('System: [') && t.includes('Exec'))) continue;
            const ts = m.timestamp
              ? (typeof m.timestamp === 'string' ? m.timestamp : new Date(m.timestamp).toISOString())
              : new Date().toISOString();
            all.push({ id: '', agentId: agId, sessionKey: key, role: m.role as 'user' | 'assistant', text: t, timestamp: ts });
          }
        }
        all.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        setRows(all);
        setTotal(all.length);
        offsetRef.current = all.length;
      } finally {
        setLoading(false);
      }
    };
    run();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentName, sessions]);

  const hasMore = offsetRef.current < total;

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const data = await loadPage(offsetRef.current, false);
      if (data && data.rows.length > 0) {
        setRows((prev) => [...prev, ...data.rows]);
        offsetRef.current += data.rows.length;
      }
    } finally {
      setLoadingMore(false);
    }
  };

  const dayGroups = useMemo(() => groupByDay(rows), [rows]);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-mc-bg-secondary border border-mc-border rounded-2xl glow-card w-full max-w-3xl max-h-[88vh] flex flex-col shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-mc-border flex-shrink-0">
          <div>
            <h2 className="text-sm font-bold text-mc-text">{agentName} Timeline</h2>
            <p className="text-xs text-mc-text-secondary mt-0.5">
              {total > 0 ? `${total} messages across all sessions` : 'All sessions merged'}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-mc-bg-tertiary text-mc-text-secondary hover:text-mc-text transition-colors text-lg leading-none">×</button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {loading ? (
            <div className="text-mc-text-secondary text-sm animate-pulse py-8 text-center">Syncing archive & loading timeline...</div>
          ) : dayGroups.length === 0 ? (
            <div className="text-mc-text-secondary text-sm text-center py-8">No messages to display</div>
          ) : (
            <>
              {dayGroups.map(([dateKey, msgs]) => {
                const dl = dayLabel(dateKey);
                return (
                  <div key={dateKey}>
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className={`text-[11px] font-bold uppercase tracking-wider ${dl.color}`}>{dl.label}</h3>
                      <div className="flex-1 h-px bg-mc-border" />
                      <span className="text-[10px] text-mc-text-secondary">{msgs.length}</span>
                    </div>
                    <div className="space-y-2">
                      {msgs.map((r, i) => (
                        <div key={r.id || `${dateKey}-${i}`} className={`flex gap-2 ${r.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed ${r.role === 'user' ? 'bg-mc-accent/15 text-mc-text border border-mc-accent/20' : 'bg-mc-bg-tertiary text-mc-text border border-mc-border'}`}>
                            {r.text.slice(0, 600)}{r.text.length > 600 ? '...' : ''}
                            <div className="mt-1 text-[10px] opacity-60">{formatDateTime(r.timestamp)}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
              {hasMore && (
                <div className="text-center py-3">
                  <button
                    onClick={loadMore}
                    disabled={loadingMore}
                    className="text-xs px-4 py-2 rounded-lg border border-mc-accent/40 text-mc-accent hover:bg-mc-accent/10 transition-colors disabled:opacity-50"
                  >
                    {loadingMore ? 'Loading...' : `Load more (${total - offsetRef.current} remaining)`}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SessionRow (unchanged)
// ---------------------------------------------------------------------------

function SessionRow({ session, onOpen }: { session: DocSession; onOpen: () => void }) {
  return (
    <div
      className="flex items-center justify-between gap-3 py-3 px-4 hover:bg-mc-bg-tertiary/40 transition-colors border-b border-mc-border last:border-0 cursor-pointer group"
      onClick={onOpen}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-xs text-mc-text font-medium truncate">{session.agentName} · {shortKey(session.key)}</span>
          <span className="text-[10px] text-mc-text-secondary/50 font-mono flex-shrink-0">{session.messageCount}msg</span>
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

// ---------------------------------------------------------------------------
// ArchiveMessageRow — compact row for archive list
// ---------------------------------------------------------------------------

function ArchiveMessageRow({ row, onClick }: { row: ArchiveRow; onClick: () => void }) {
  const agentName = AGENT_NAMES[row.agentId] || row.agentId;
  return (
    <div
      className="flex items-center justify-between gap-3 py-3 px-4 hover:bg-mc-bg-tertiary/40 transition-colors border-b border-mc-border last:border-0 cursor-pointer group"
      onClick={onClick}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className={`text-xs font-medium ${row.role === 'user' ? 'text-mc-accent-purple' : 'text-mc-accent'}`}>
            {row.role === 'user' ? 'You' : agentName}
          </span>
          <span className="text-[10px] text-mc-text-secondary/40">{shortKey(row.sessionKey)}</span>
        </div>
        <p className="text-xs text-mc-text-secondary truncate">{row.text.slice(0, 120)}</p>
      </div>
      <div className="flex-shrink-0 text-right">
        <p className="text-[10px] text-mc-text-secondary/60">{formatDateTime(row.timestamp)}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DocTab — main export — archive-first with day grouping + load-more
// ---------------------------------------------------------------------------

export function DocTab() {
  // Archive state (primary)
  const [archiveRows, setArchiveRows] = useState<ArchiveRow[]>([]);
  const [archiveTotal, setArchiveTotal] = useState(0);
  const [archiveLoading, setArchiveLoading] = useState(true);
  const [archiveMore, setArchiveMore] = useState(false);
  const archiveOffsetRef = useRef(0);

  // Fallback session state (secondary)
  const [sessions, setSessions] = useState<DocSession[]>([]);
  const [usingFallback, setUsingFallback] = useState(false);

  const [search, setSearch] = useState('');
  const [agentFilter, setAgentFilter] = useState('all');
  const [openSession, setOpenSession] = useState<string | null>(null);
  const [openAgentTimeline, setOpenAgentTimeline] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // -------------------------------------------------------------------------
  // Load archive (primary) — fetches all agents merged
  // -------------------------------------------------------------------------

  const loadArchivePage = useCallback(async (agents: string[], offset: number, sync: boolean): Promise<ArchiveRow[]> => {
    const all: ArchiveRow[] = [];
    for (const ag of agents) {
      const syncParam = sync ? '&sync=1' : '';
      const res = await fetch(`/api/history/archive?agent=${encodeURIComponent(ag)}&limit=${PAGE_SIZE}&offset=${offset}${syncParam}`);
      if (!res.ok) continue;
      const data = await res.json();
      if (data.rows) all.push(...(data.rows as ArchiveRow[]));
      if (offset === 0) setArchiveTotal((prev) => prev + (data.total || 0));
    }
    // re-sort merged across agents newest-first
    all.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return all;
  }, []);

  const knownAgents = useRef<string[]>([]);

  const loadInitial = useCallback(async () => {
    setArchiveLoading(true);
    setArchiveTotal(0);
    try {
      // Discover agents from /api/docs (lightweight, also populates fallback)
      let agents: string[] = [];
      try {
        const res = await fetch('/api/docs');
        if (res.ok) {
          const data = await res.json();
          const sess: DocSession[] = data.sessions || [];
          setSessions(sess);
          const agentSet = new Set(sess.map((s) => s.agentId));
          agents = Array.from(agentSet);
        }
      } catch { /* ignore */ }

      if (agents.length === 0) agents = ['main'];
      knownAgents.current = agents;

      // Archive-first: sync + first page for each agent
      const rows = await loadArchivePage(agents, 0, true);
      if (rows.length > 0) {
        setArchiveRows(rows);
        archiveOffsetRef.current = PAGE_SIZE; // per-agent offset
        setLastUpdated(new Date());
        return;
      }

      // Fallback to session-based view
      setUsingFallback(true);
      setLastUpdated(new Date());
    } finally {
      setArchiveLoading(false);
    }
  }, [loadArchivePage]);

  useEffect(() => {
    loadInitial();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLoadMore = async () => {
    setArchiveMore(true);
    try {
      const rows = await loadArchivePage(knownAgents.current, archiveOffsetRef.current, false);
      if (rows.length > 0) {
        setArchiveRows((prev) => [...prev, ...rows]);
        archiveOffsetRef.current += PAGE_SIZE;
      }
    } finally {
      setArchiveMore(false);
    }
  };

  const handleRefresh = () => {
    setArchiveRows([]);
    setSessions([]);
    setUsingFallback(false);
    archiveOffsetRef.current = 0;
    loadInitial();
  };

  // -------------------------------------------------------------------------
  // Derived data
  // -------------------------------------------------------------------------

  // Archive: filter + day-group
  const filteredArchive = useMemo(() => {
    const q = search.trim().toLowerCase();
    return archiveRows.filter((r) => {
      const passAgent = agentFilter === 'all' || (AGENT_NAMES[r.agentId] || r.agentId) === agentFilter;
      const passSearch = !q || r.text.toLowerCase().includes(q) || r.sessionKey.toLowerCase().includes(q);
      return passAgent && passSearch;
    });
  }, [archiveRows, agentFilter, search]);

  const archiveDayGroups = useMemo(() => groupByDay(filteredArchive), [filteredArchive]);

  // Agent list from archive rows
  const archiveAgents = useMemo(() => {
    const map: Record<string, number> = {};
    for (const r of archiveRows) {
      const name = AGENT_NAMES[r.agentId] || r.agentId;
      map[name] = (map[name] || 0) + 1;
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [archiveRows]);

  // Fallback: filter + group
  const filteredSessions = useMemo(() => {
    if (!usingFallback) return [];
    const q = search.trim().toLowerCase();
    return sessions.filter((s) => {
      const passSearch = !q || s.key.toLowerCase().includes(q) || s.excerpt.toLowerCase().includes(q) || s.model.toLowerCase().includes(q);
      const passAgent = agentFilter === 'all' || (s.agentName || s.agentId) === agentFilter;
      return passSearch && passAgent;
    });
  }, [sessions, search, agentFilter, usingFallback]);

  const fallbackGrouped = useMemo(() => {
    const g: Record<string, DocSession[]> = { today: [], yesterday: [], earlier: [] };
    for (const s of filteredSessions) g[s.dateLabel]?.push(s);
    return g;
  }, [filteredSessions]);

  const fallbackAgents = useMemo(() => {
    const map: Record<string, number> = {};
    for (const s of sessions) {
      const name = s.agentName || s.agentId || 'Unknown';
      map[name] = (map[name] || 0) + 1;
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [sessions]);

  const agentList = usingFallback ? fallbackAgents : archiveAgents;
  const totalCount = usingFallback ? sessions.length : archiveRows.length;
  const hasMore = !usingFallback && archiveOffsetRef.current < archiveTotal;

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  if (archiveLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-3 animate-pulse">📄</div>
          <p className="text-mc-text-secondary text-sm">Syncing archive...</p>
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
                {totalCount} messages{usingFallback ? ' (sessions fallback)' : ' (archive)'}
                <span className="ml-2 opacity-70">· {agentFilter === 'all' ? 'All agents' : agentFilter}</span>
                {lastUpdated && (
                  <span className="ml-2 opacity-60">
                    · updated {lastUpdated.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </p>
            </div>
            <button
              onClick={handleRefresh}
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
                All · {totalCount}
              </button>
              {agentList.map(([name, count]) => (
                <button
                  key={name}
                  onClick={() => setAgentFilter(name)}
                  className={`text-[10px] px-2 py-1 rounded border transition-colors ${agentFilter === name ? 'border-mc-accent/50 text-mc-accent bg-mc-accent/10' : 'border-mc-border bg-mc-bg text-mc-text-secondary hover:text-mc-text'}`}
                >
                  {name} · {count}
                </button>
              ))}
            </div>
          </div>

          {agentFilter !== 'all' && (
            <div className="mt-2">
              <button
                onClick={() => setOpenAgentTimeline(agentFilter)}
                className="text-[11px] px-2 py-1 rounded border border-mc-accent/40 text-mc-accent hover:bg-mc-accent/10 transition-colors"
              >
                Open {agentFilter} Timeline
              </button>
            </div>
          )}

          {/* Search */}
          <div className="relative mt-3">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-mc-text-secondary text-sm">🔍</span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search history..."
              className="w-full bg-mc-bg border border-mc-border rounded-lg glow-input pl-9 pr-4 py-2 text-sm text-mc-text placeholder:text-mc-text-secondary/50 focus:outline-none focus:border-mc-accent/50 transition-colors"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-mc-text-secondary hover:text-mc-text text-sm">×</button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {!usingFallback ? (
            /* ---- Archive-first view with day grouping ---- */
            archiveDayGroups.length === 0 ? (
              <div className="flex items-center justify-center py-20">
                <div className="text-center">
                  <div className="text-5xl mb-3">{search ? '🔍' : '💬'}</div>
                  <p className="text-sm font-medium text-mc-text">{search ? `No results for "${search}"` : 'No history yet'}</p>
                </div>
              </div>
            ) : (
              <div className="p-6 space-y-6">
                {archiveDayGroups.map(([dateKey, msgs]) => {
                  const dl = dayLabel(dateKey);
                  return (
                    <div key={dateKey}>
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className={`text-xs font-bold uppercase tracking-wider ${dl.color}`}>{dl.label}</h3>
                        <div className="flex-1 h-px bg-mc-border" />
                        <span className="text-[10px] text-mc-text-secondary">{msgs.length}</span>
                      </div>
                      <div className="bg-mc-bg-secondary border border-mc-border rounded-xl glow-card overflow-hidden">
                        {msgs.map((row, i) => (
                          <ArchiveMessageRow
                            key={row.id || `${dateKey}-${i}`}
                            row={row}
                            onClick={() => setOpenSession(row.sessionKey)}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
                {hasMore && (
                  <div className="text-center py-3">
                    <button
                      onClick={handleLoadMore}
                      disabled={archiveMore}
                      className="text-xs px-4 py-2 rounded-lg border border-mc-accent/40 text-mc-accent hover:bg-mc-accent/10 transition-colors disabled:opacity-50"
                    >
                      {archiveMore ? 'Loading...' : `Load more (${archiveTotal - archiveOffsetRef.current} remaining)`}
                    </button>
                  </div>
                )}
              </div>
            )
          ) : (
            /* ---- Fallback: session-based view ---- */
            filteredSessions.length === 0 ? (
              <div className="flex items-center justify-center py-20">
                <div className="text-center">
                  <div className="text-5xl mb-3">{search ? '🔍' : '💬'}</div>
                  <p className="text-sm font-medium text-mc-text">{search ? `No results for "${search}"` : 'No history yet'}</p>
                </div>
              </div>
            ) : (
              <div className="p-6 space-y-6">
                {(['today', 'yesterday', 'earlier'] as const).map((section) => {
                  const items = fallbackGrouped[section];
                  if (!items || items.length === 0) return null;
                  const cfg = { today: { label: 'Today', color: 'text-mc-accent-green' }, yesterday: { label: 'Yesterday', color: 'text-mc-accent-yellow' }, earlier: { label: 'Earlier', color: 'text-mc-text-secondary' } }[section];
                  return (
                    <div key={section}>
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className={`text-xs font-bold uppercase tracking-wider ${cfg.color}`}>{cfg.label}</h3>
                        <div className="flex-1 h-px bg-mc-border" />
                        <span className="text-[10px] text-mc-text-secondary">{items.length}</span>
                      </div>
                      <div className="bg-mc-bg-secondary border border-mc-border rounded-xl glow-card overflow-hidden">
                        {items.map((session) => (
                          <SessionRow key={session.key} session={session} onOpen={() => setOpenSession(session.key)} />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          )}
        </div>
      </div>

      {/* Modals */}
      {openSession && <SessionMessages sessionKey={openSession} onClose={() => setOpenSession(null)} />}
      {openAgentTimeline && (
        <AgentTimeline
          agentName={openAgentTimeline}
          sessions={sessions.filter((s) => (s.agentName || s.agentId) === openAgentTimeline)}
          onClose={() => setOpenAgentTimeline(null)}
        />
      )}
    </>
  );
}
