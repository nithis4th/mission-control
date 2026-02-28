'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Search } from 'lucide-react';
import { useMissionControl } from '@/lib/store';
import type { Agent, AgentStatus, OpenClawSession } from '@/lib/types';
import { AgentModal } from './AgentModal';
import { DiscoverAgentsModal } from './DiscoverAgentsModal';

// Deterministic color signature per agent name
const AGENT_COLORS: Record<string, string> = {
  eve: '#a371f7',
  rex: '#f85149',
  nova: '#58a6ff',
  iris: '#db61a2',
  otto: '#d29922',
  sage: '#3fb950',
  kai: '#39d353',
  luna: '#79c0ff',
  bolt: '#ffa657',
  max: '#ff7b72',
};

function getAgentColor(name: string): string {
  const key = name.toLowerCase().trim();
  if (AGENT_COLORS[key]) return AGENT_COLORS[key];
  // Fallback: hash name to pick from palette
  const palette = ['#a371f7', '#58a6ff', '#3fb950', '#d29922', '#db61a2', '#f85149', '#ffa657', '#79c0ff'];
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = key.charCodeAt(i) + ((hash << 5) - hash);
  }
  return palette[Math.abs(hash) % palette.length];
}

type FilterTab = 'all' | 'working' | 'standby';

interface AgentCardGridProps {
  workspaceId?: string;
}

export function AgentCardGrid({ workspaceId }: AgentCardGridProps) {
  const { agents, tasks, selectedAgent, setSelectedAgent, agentOpenClawSessions, setAgentOpenClawSession } = useMissionControl();
  const [filter, setFilter] = useState<FilterTab>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [showDiscoverModal, setShowDiscoverModal] = useState(false);
  const [liveAgentIds, setLiveAgentIds] = useState<Set<string>>(new Set());
  const [liveSessionsLoaded, setLiveSessionsLoaded] = useState(false);

  // Poll live Gateway sessions to determine real agent status
  useEffect(() => {
    const pollLiveSessions = async () => {
      try {
        const res = await fetch('/api/openclaw/sessions');
        if (!res.ok) return;
        const data = await res.json();
        let sessionsList: Array<{ key?: string }> = [];
        if (data?.sessions?.sessions && Array.isArray(data.sessions.sessions)) {
          sessionsList = data.sessions.sessions;
        } else if (Array.isArray(data?.sessions)) {
          sessionsList = data.sessions;
        }

        const THIRTY_MIN_MS = 30 * 60 * 1000;
        const now = Date.now();
        const activeIds = new Set<string>();
        for (const session of sessionsList) {
          const key = session.key || '';
          const match = key.match(/^agent:([^:]+):/);
          if (!match) continue;
          const updatedAtRaw = Number((session as { updatedAt?: number }).updatedAt || 0);
          if (!updatedAtRaw) continue;
          const updatedAtMs = updatedAtRaw < 1e12 ? updatedAtRaw * 1000 : updatedAtRaw;
          if (now - updatedAtMs <= THIRTY_MIN_MS) {
            activeIds.add(match[1].toLowerCase());
          }
        }
        setLiveAgentIds(activeIds);
        setLiveSessionsLoaded(true);
      } catch (error) {
        console.error('Failed to poll live sessions:', error);
      }
    };

    pollLiveSessions();
    const interval = setInterval(pollLiveSessions, 15000);
    return () => clearInterval(interval);
  }, []);

  // Load OpenClaw session status for all agents
  const loadOpenClawSessions = useCallback(async () => {
    for (const agent of agents) {
      try {
        const res = await fetch(`/api/agents/${agent.id}/openclaw`);
        if (res.ok) {
          const data = await res.json();
          if (data.linked && data.session) {
            setAgentOpenClawSession(agent.id, data.session as OpenClawSession);
          }
        }
      } catch (error) {
        console.error(`Failed to load OpenClaw session for ${agent.name}:`, error);
      }
    }
  }, [agents, setAgentOpenClawSession]);

  useEffect(() => {
    if (agents.length > 0) {
      loadOpenClawSessions();
    }
  }, [loadOpenClawSessions, agents.length]);

  const getAgentLiveStatus = useCallback((agent: Agent): AgentStatus => {
    if (!liveSessionsLoaded) return agent.status || 'standby';
    const agentId = (agent.gateway_agent_id || agent.name || '').toLowerCase();
    if (agentId && liveAgentIds.has(agentId)) return 'working';
    return 'standby';
  }, [liveAgentIds, liveSessionsLoaded]);

  // Find current work: the most recent in_progress or assigned task for this agent
  const getAgentCurrentWork = useCallback((agent: Agent): string | null => {
    const agentTasks = tasks.filter(
      (t) => t.assigned_agent_id === agent.id && (t.status === 'in_progress' || t.status === 'assigned')
    );
    if (agentTasks.length === 0) return null;
    // Prefer in_progress over assigned
    const inProgress = agentTasks.find((t) => t.status === 'in_progress');
    return (inProgress || agentTasks[0]).title;
  }, [tasks]);

  const filteredAgents = agents.filter((agent) => {
    if (filter === 'all') return true;
    return getAgentLiveStatus(agent) === filter;
  });

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header Bar */}
      <div className="px-6 py-4 border-b border-mc-border flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-mc-text-secondary">
            Agents
          </h2>
          <span className="text-xs bg-mc-bg-tertiary text-mc-text-secondary px-2 py-0.5 rounded">
            {agents.length}
          </span>
          {/* Filter Tabs */}
          <div className="flex gap-1 ml-2">
            {(['all', 'working', 'standby'] as FilterTab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={`px-3 py-1 text-xs rounded uppercase tracking-wide transition-colors ${
                  filter === tab
                    ? 'bg-mc-accent text-mc-bg font-medium'
                    : 'text-mc-text-secondary hover:bg-mc-bg-tertiary hover:text-mc-text'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowDiscoverModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 rounded text-blue-400 hover:text-blue-300 transition-colors"
          >
            <Search className="w-3.5 h-3.5" />
            Import
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-mc-bg-tertiary hover:bg-mc-border rounded text-mc-text-secondary hover:text-mc-text transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Agent
          </button>
        </div>
      </div>

      {/* Card Grid */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl">
          {filteredAgents.map((agent) => {
            const liveStatus = getAgentLiveStatus(agent);
            const currentWork = getAgentCurrentWork(agent);
            const color = getAgentColor(agent.name);
            const isWorking = liveStatus === 'working';

            return (
              <button
                key={agent.id}
                onClick={() => {
                  setSelectedAgent(agent);
                  setEditingAgent(agent);
                }}
                className="agent-card group text-left rounded-lg border border-mc-border bg-mc-bg-secondary p-4 transition-all duration-200 hover:scale-[1.02] hover:border-transparent focus:outline-none focus:ring-1 focus:ring-mc-accent/50"
                style={{
                  '--agent-color': color,
                  borderLeftWidth: '3px',
                  borderLeftColor: color,
                } as React.CSSProperties}
              >
                <div className="flex items-start gap-3">
                  {/* Avatar */}
                  <div className="text-2xl flex-shrink-0 mt-0.5">{agent.avatar_emoji}</div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-medium text-sm text-mc-text truncate">
                        {agent.name}
                      </span>
                      {!!agent.is_master && (
                        <span className="text-xs text-mc-accent-yellow flex-shrink-0">★</span>
                      )}
                      {agent.source === 'gateway' && (
                        <span className="text-[10px] px-1 py-0 bg-blue-500/20 text-blue-400 rounded flex-shrink-0">
                          GW
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-mc-text-secondary truncate">{agent.role}</div>
                    {agent.model && (
                      <div className="text-[10px] text-mc-text-secondary/60 mt-1 truncate font-mono">
                        {agent.model}
                      </div>
                    )}
                  </div>

                  {/* Status Pill */}
                  <span
                    className={`flex-shrink-0 text-[10px] font-semibold px-2.5 py-1 rounded-full uppercase tracking-wider ${
                      isWorking
                        ? 'bg-mc-accent-green/15 text-mc-accent-green border border-mc-accent-green/30'
                        : 'bg-mc-bg-tertiary text-mc-text-secondary border border-mc-border'
                    }`}
                  >
                    {liveStatus}
                  </span>
                </div>

                {/* Current Work */}
                {currentWork && (
                  <div className="mt-3 pt-2 border-t border-mc-border/50">
                    <p className="text-[11px] text-mc-text-secondary truncate">
                      <span className="text-mc-text-secondary/50 mr-1">Working on:</span>
                      {currentWork}
                    </p>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {filteredAgents.length === 0 && (
          <div className="flex items-center justify-center h-48 text-mc-text-secondary text-sm">
            No agents match the current filter.
          </div>
        )}
      </div>

      {/* Modals */}
      {showCreateModal && (
        <AgentModal onClose={() => setShowCreateModal(false)} workspaceId={workspaceId} />
      )}
      {editingAgent && (
        <AgentModal
          agent={editingAgent}
          onClose={() => setEditingAgent(null)}
          workspaceId={workspaceId}
        />
      )}
      {showDiscoverModal && (
        <DiscoverAgentsModal
          onClose={() => setShowDiscoverModal(false)}
          workspaceId={workspaceId}
        />
      )}
    </div>
  );
}
