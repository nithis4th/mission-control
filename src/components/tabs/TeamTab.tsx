'use client';

import { useEffect, useState } from 'react';
import type { Agent } from '@/lib/types';

const KNOWN_AGENTS = [
  { id: 'main',     emoji: '🦋', label: 'Eve',      model: 'kimi-k2.5' },
  { id: 'dexter',   emoji: '🤖', label: 'Dexter',   model: 'gpt-5.3-codex' },
  { id: 'sherlock', emoji: '🔍', label: 'Sherlock', model: 'kimi-k2.5' },
  { id: 'shelby',   emoji: '💼', label: 'Shelby',   model: 'claude-sonnet-4-6' },
  { id: 'bluma',    emoji: '🛡️', label: 'Bluma',    model: 'claude-opus-4.6' },
  { id: 'goku',     emoji: '⚡', label: 'Goku',     model: 'gpt-5-nano' },
  { id: 'monalisa', emoji: '🎨', label: 'Monalisa', model: 'claude-sonnet-4-6' },
];

type AgentInfo = {
  id: string;
  emoji: string;
  label: string;
  model: string;
  status: 'working' | 'standby';
};

export function TeamTab() {
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const loadAgents = async () => {
    try {
      const res = await fetch('/api/agents');
      const data: Agent[] = res.ok ? await res.json() : [];

      const statusMap = new Map<string, 'working' | 'standby'>();
      for (const a of data) {
        const key = (a.gateway_agent_id || a.name || '').toLowerCase();
        statusMap.set(key, (a.status as 'working' | 'standby') || 'standby');
      }

      const enriched: AgentInfo[] = KNOWN_AGENTS.map((ka) => {
        const dbAgent = data.find(
          (a) => (a.gateway_agent_id || '').toLowerCase() === ka.id ||
                 a.name.toLowerCase() === ka.label.toLowerCase()
        );
        return {
          ...ka,
          model: dbAgent?.model || ka.model,
          status: statusMap.get(ka.id) || 'standby',
        };
      });

      setAgents(enriched);
      setLastUpdated(new Date());
    } catch {
      setAgents(KNOWN_AGENTS.map((a) => ({ ...a, status: 'standby' as const })));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAgents();
    const interval = setInterval(loadAgents, 30000);
    return () => clearInterval(interval);
  }, []);

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

  const workingCount = agents.filter((a) => a.status === 'working').length;

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold text-mc-text">Team</h2>
          <p className="text-xs text-mc-text-secondary mt-0.5">
            {workingCount} active · {agents.length - workingCount} standby
            {lastUpdated && (
              <span className="ml-2 opacity-60">
                · updated {lastUpdated.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </p>
        </div>
        <button
          onClick={loadAgents}
          className="text-xs text-mc-text-secondary hover:text-mc-text px-2 py-1 rounded border border-mc-border hover:border-mc-accent/40 transition-colors"
        >
          Refresh
        </button>
      </div>

      <div className="grid gap-3">
        {agents.map((agent) => (
          <div
            key={agent.id}
            className="flex items-center gap-4 p-4 rounded-xl bg-mc-bg-secondary border border-mc-border hover:border-mc-accent/30 transition-colors"
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
                  <span className={`w-1.5 h-1.5 rounded-full ${agent.status === 'working' ? 'bg-green-400 animate-pulse' : 'bg-yellow-400'}`} />
                  {agent.status === 'working' ? 'working' : 'standby'}
                </span>
              </div>
              <div className="text-xs text-mc-text-secondary truncate mt-0.5">
                Model: {agent.model}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
