'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Agent } from '@/lib/types';

const KNOWN_AGENTS = [
  { id: 'main', emoji: '🦋', label: 'Eve', model: 'kimi-k2.5' },
  { id: 'dexter', emoji: '🤖', label: 'Dexter', model: 'gpt-5.3-codex' },
  { id: 'sherlock', emoji: '🔍', label: 'Sherlock', model: 'kimi-k2.5' },
  { id: 'shelby', emoji: '💼', label: 'Shelby', model: 'claude-sonnet-4-6' },
  { id: 'bluma', emoji: '🛡️', label: 'Bluma', model: 'claude-opus-4.6' },
  { id: 'goku', emoji: '⚡', label: 'Goku', model: 'gpt-5-nano' },
  { id: 'monalisa', emoji: '🎨', label: 'Monalisa', model: 'claude-sonnet-4-6' },
];

type AgentInfo = {
  id: string;
  emoji: string;
  label: string;
  model: string;
  status: 'working' | 'standby';
  lastActiveAt?: number | null;
  todayTokens?: number;
  todayCost?: number;
};

type FilterMode = 'all' | 'working' | 'standby';
type SortMode = 'name' | 'status' | 'model';
type RefreshIntervalMode = 'off' | '15s' | '30s';

function formatAgo(ts?: number | null): string {
  if (!ts) return 'no activity';
  const diff = Math.max(0, Date.now() - ts);
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}

export function TeamTab({ onOpenTab }: { onOpenTab?: (tab: string) => void }) {
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshCount, setRefreshCount] = useState(0);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [showRefreshDone, setShowRefreshDone] = useState(false);
  const [refreshingTick, setRefreshingTick] = useState(0);

  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [sortMode, setSortMode] = useState<SortMode>('status');
  const [refreshIntervalMode, setRefreshIntervalMode] = useState<RefreshIntervalMode>('30s');

  const loadAgents = async (manual = false) => {
    const startedAt = Date.now();
    if (manual) {
      setIsRefreshing(true);
      setRefreshingTick((x) => x + 1);
      setRefreshCount((x) => x + 1);
      setShowRefreshDone(false);
    }

    try {
      setRefreshError(null);
      const res = await fetch(`/api/agents?t=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: Agent[] = await res.json();

      const statusMap = new Map<string, 'working' | 'standby'>();
      for (const a of data) {
        const key = (a.gateway_agent_id || a.name || '').toLowerCase();
        statusMap.set(key, (a.status as 'working' | 'standby') || 'standby');
      }

      const enriched: AgentInfo[] = KNOWN_AGENTS.map((ka) => {
        const dbAgent = data.find(
          (a) =>
            (a.gateway_agent_id || '').toLowerCase() === ka.id ||
            a.name.toLowerCase() === ka.label.toLowerCase()
        );
        return {
          ...ka,
          model: dbAgent?.model || ka.model,
          status: statusMap.get(ka.id) || 'standby',
        };
      });

      // Phase C: load per-agent health metrics (last active, today tokens, today cost)
      const statsResults = await Promise.all(
        enriched.map(async (agent) => {
          const dbAgent = data.find(
            (a) =>
              (a.gateway_agent_id || '').toLowerCase() === agent.id ||
              a.name.toLowerCase() === agent.label.toLowerCase()
          );
          if (!dbAgent?.id) return { ...agent, lastActiveAt: null, todayTokens: 0, todayCost: 0 };

          try {
            const res = await fetch(`/api/agents/${dbAgent.id}/stats?t=${Date.now()}`, { cache: 'no-store' });
            if (!res.ok) return { ...agent, lastActiveAt: null, todayTokens: 0, todayCost: 0 };
            const stat = await res.json();
            return {
              ...agent,
              lastActiveAt: typeof stat.lastActiveAt === 'number' ? stat.lastActiveAt : null,
              todayTokens: typeof stat.todayTokens === 'number' ? stat.todayTokens : 0,
              todayCost: typeof stat.todayCost === 'number' ? stat.todayCost : 0,
            };
          } catch {
            return { ...agent, lastActiveAt: null, todayTokens: 0, todayCost: 0 };
          }
        })
      );

      setAgents(statsResults);
      setLastUpdated(new Date());
      if (!manual) setRefreshCount((x) => x + 1);

    } catch (err) {
      setRefreshError(err instanceof Error ? err.message : 'refresh failed');
      setAgents(KNOWN_AGENTS.map((a) => ({ ...a, status: 'standby' as const })));
    } finally {
      setLoading(false);
      if (manual) {
        const elapsed = Date.now() - startedAt;
        const minVisibleMs = 450;
        const waitMs = Math.max(0, minVisibleMs - elapsed);
        if (waitMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, waitMs));
        }
        setIsRefreshing(false);
        setShowRefreshDone(true);
        setTimeout(() => setShowRefreshDone(false), 1000);
      }
    }
  };

  useEffect(() => {
    loadAgents();
  }, []);

  useEffect(() => {
    if (refreshIntervalMode === 'off') return;
    const ms = refreshIntervalMode === '15s' ? 15000 : 30000;
    const timer = setInterval(() => {
      loadAgents(false);
    }, ms);

    return () => clearInterval(timer);
  }, [refreshIntervalMode]);

  const workingCount = agents.filter((a) => a.status === 'working').length;

  const visibleAgents = useMemo(() => {
    let list = [...agents];

    if (filterMode !== 'all') {
      list = list.filter((a) => a.status === filterMode);
    }

    if (sortMode === 'name') {
      list.sort((a, b) => a.label.localeCompare(b.label));
    } else if (sortMode === 'model') {
      list.sort((a, b) => a.model.localeCompare(b.model));
    } else {
      list.sort((a, b) => {
        if (a.status === b.status) return a.label.localeCompare(b.label);
        return a.status === 'working' ? -1 : 1;
      });
    }

    return list;
  }, [agents, filterMode, sortMode]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-3 animate-pulse">👥</div>
          <p className="text-mc-text-secondary text-sm">Loading team...</p>
        </div>
      </div>
    );
  }

  const syncedAgo = lastUpdated ? Math.max(0, Math.floor((Date.now() - lastUpdated.getTime()) / 1000)) : null;

  const openSoulForAgent = (agentId: string) => {
    try {
      localStorage.setItem('mc.soul.selectedAgent', agentId);
    } catch {
      // ignore localStorage errors
    }
    onOpenTab?.('soul');
  };


  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="flex flex-col gap-3 mb-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-lg font-bold text-mc-text">Team</h2>
          <p className="text-xs text-mc-text-secondary mt-0.5">
            {workingCount} active · {agents.length - workingCount} standby
            {lastUpdated && (
              <span className="ml-2 opacity-60">
                · updated{' '}
                {lastUpdated.toLocaleTimeString('th-TH', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })}
              </span>
            )}
            <span className="ml-2 opacity-40">· refresh #{refreshCount}</span>
            {syncedAgo !== null && <span className="ml-2 opacity-40">· synced {syncedAgo}s ago</span>}
          </p>
        </div>

        <button
          onClick={() => loadAgents(true)}
          disabled={isRefreshing}
          className="text-xs px-2.5 py-1 rounded border transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-60 border-mc-border hover:border-mc-accent/40 text-mc-text-secondary hover:text-mc-text"
        >
          <span
            className={`inline-flex items-center gap-1.5 transition-all duration-300 ${
              isRefreshing ? 'text-mc-accent' : showRefreshDone ? 'text-green-400' : ''
            }`}
          >
            <span
              className={`inline-flex items-center justify-center w-3.5 h-3.5 rounded-full transition-all duration-300 ${
                isRefreshing
                  ? 'bg-mc-accent/20'
                  : showRefreshDone
                    ? 'bg-green-400/20'
                    : 'bg-mc-text-secondary/15'
              }`}
            >
              <span
                key={refreshingTick}
                className={`block w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                  isRefreshing
                    ? 'bg-mc-accent animate-spin'
                    : showRefreshDone
                      ? 'bg-green-400'
                      : 'bg-mc-text-secondary/60'
                }`}
              />
            </span>
            {isRefreshing ? 'Refresh' : showRefreshDone ? 'Updated' : 'Refresh'}
          </span>
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-5">
        <SegmentButton active={filterMode === 'all'} onClick={() => setFilterMode('all')}>
          All
        </SegmentButton>
        <SegmentButton active={filterMode === 'working'} onClick={() => setFilterMode('working')}>
          Working
        </SegmentButton>
        <SegmentButton active={filterMode === 'standby'} onClick={() => setFilterMode('standby')}>
          Standby
        </SegmentButton>

        <div className="w-px h-5 bg-mc-border/70 mx-1" />

        <label className="text-[11px] text-mc-text-secondary">Sort</label>
        <select
          value={sortMode}
          onChange={(e) => setSortMode(e.target.value as SortMode)}
          className="text-xs px-2 py-1 rounded border border-mc-border bg-mc-bg text-mc-text"
        >
          <option value="status">Status</option>
          <option value="name">Name</option>
          <option value="model">Model</option>
        </select>

        <label className="text-[11px] text-mc-text-secondary ml-2">Auto refresh</label>
        <select
          value={refreshIntervalMode}
          onChange={(e) => setRefreshIntervalMode(e.target.value as RefreshIntervalMode)}
          className="text-xs px-2 py-1 rounded border border-mc-border bg-mc-bg text-mc-text"
        >
          <option value="off">Off</option>
          <option value="15s">15s</option>
          <option value="30s">30s</option>
        </select>
      </div>

      {refreshError && (
        <div className="mb-3 text-[11px] text-red-400/90 bg-red-500/10 border border-red-500/30 rounded px-2 py-1">
          Refresh error: {refreshError}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {visibleAgents.map((agent) => (
          <div
            key={agent.id}
            className="flex items-center gap-3 p-4 min-h-[124px] rounded-xl bg-mc-bg-secondary border border-mc-border hover:border-mc-accent/30 transition-colors"
          >
            <div className="text-2xl">{agent.emoji}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-mc-text truncate">{agent.label}</span>
                <span
                  className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full border ${
                    agent.status === 'working'
                      ? 'bg-green-500/10 text-green-400 border-green-500/30'
                      : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      agent.status === 'working' ? 'bg-green-400 animate-pulse' : 'bg-yellow-400'
                    }`}
                  />
                  {agent.status === 'working' ? 'working' : 'standby'}
                </span>
              </div>
              <div className="text-xs text-mc-text-secondary truncate mt-0.5">Model: {agent.model}</div>
              <div className="text-xs text-mc-text-secondary mt-1">Active: {formatAgo(agent.lastActiveAt)}</div>
              <div className="flex items-center justify-between text-[10px] text-mc-text-secondary mt-1.5 w-full max-w-[360px]">
                <span className="px-1.5 py-0.5 rounded bg-mc-bg border border-mc-border">Today: {agent.todayTokens?.toLocaleString() || 0} tok</span>
                <span className="px-1.5 py-0.5 rounded bg-mc-bg border border-mc-border text-mc-accent-green">Cost: ${(agent.todayCost || 0).toFixed(4)}</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <button
                onClick={() => { try { localStorage.setItem('mc.chat.targetAgent', agent.id); } catch {} onOpenTab?.('chat'); }}
                className="text-[10px] px-2 py-1 rounded border border-mc-border text-mc-text-secondary hover:text-mc-text hover:border-mc-accent/40 transition-colors"
              >
                Chat
              </button>
              <button
                onClick={() => { try { localStorage.setItem('mc.docs.targetAgent', agent.id); } catch {} onOpenTab?.('docs'); }}
                className="text-[10px] px-2 py-1 rounded border border-mc-border text-mc-text-secondary hover:text-mc-text hover:border-mc-accent/40 transition-colors"
              >
                History
              </button>
              <button
                onClick={() => openSoulForAgent(agent.id)}
                className="text-[10px] px-2 py-1 rounded border border-mc-accent/40 text-mc-accent hover:bg-mc-accent/10 transition-colors"
              >
                Soul
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SegmentButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`text-xs px-2.5 py-1 rounded border transition-colors ${
        active
          ? 'border-mc-accent/50 text-mc-accent bg-mc-accent/10'
          : 'border-mc-border text-mc-text-secondary hover:text-mc-text hover:border-mc-accent/30'
      }`}
    >
      {children}
    </button>
  );
}
