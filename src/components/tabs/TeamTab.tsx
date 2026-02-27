'use client';

import { useEffect, useState } from 'react';
import type { Agent } from '@/lib/types';

const KNOWN_AGENTS = [
  { id: 'main',     emoji: '🦋', label: 'Eve',      model: 'claude-sonnet-4-6' },
  { id: 'dexter',   emoji: '🤖', label: 'Dexter',   model: 'claude-sonnet-4-6' },
  { id: 'sherlock', emoji: '🔍', label: 'Sherlock', model: 'claude-sonnet-4-6' },
  { id: 'shelby',   emoji: '💼', label: 'Shelby',   model: 'claude-sonnet-4-6' },
  { id: 'bluma',    emoji: '🛡️', label: 'Bluma',    model: 'claude-sonnet-4-6' },
  { id: 'goku',     emoji: '⚡', label: 'Goku',     model: 'claude-sonnet-4-6' },
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {agents.map((agent) => (
          <AgentCard key={agent.id} agent={agent} />
        ))}
      </div>
    </div>
  );
}

function AgentCard({ agent }: { agent: AgentInfo }) {
  const isWorking = agent.status === 'working';
  return (
    <div
      className={`relative bg-mc-bg-secondary border rounded-xl p-5 flex flex-col gap-3 transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 ${
        isWorking ? 'border-mc-accent-green/40 shadow-sm shadow-mc-accent-green/10' : 'border-mc-border'
      }`}
    >
      <div
        className={`absolute top-3 right-3 w-2.5 h-2.5 rounded-full ${
          isWorking ? 'bg-mc-accent-green animate-pulse' : 'bg-mc-text-secondary/40'
        }`}
        title={isWorking ? 'Working' : 'Standby'}
      />
      <div className="w-14 h-14 rounded-2xl bg-mc-bg flex items-center justify-center text-3xl border border-mc-border">
        {agent.emoji}
      </div>
      <div>
        <h3 className="font-semibold text-sm text-mc-text">{agent.label}</h3>
        <p className="text-[10px] text-mc-text-secondary/70 mt-0.5 font-mono truncate">
          {agent.model}
        </p>
      </div>
      <div className="mt-auto">
        <span
          className={`inline-flex items-center gap-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
            isWorking
              ? 'bg-mc-accent-green/15 text-mc-accent-green'
              : 'bg-mc-text-secondary/10 text-mc-text-secondary'
          }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              isWorking ? 'bg-mc-accent-green' : 'bg-mc-text-secondary/50'
            }`}
          />
          {isWorking ? 'Working' : 'Standby'}
        </span>
      </div>
    </div>
  );
}
