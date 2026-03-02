'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Search, RefreshCw } from 'lucide-react';
import { motion } from 'framer-motion';
import { useMissionControl } from '@/lib/store';
import { staggerContainer, fadeSlideUp } from '@/lib/animations';
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

const ACTIVE_WINDOW_MS = 2 * 60 * 1000; // 2 minutes
const POLL_INTERVAL_MS = 15000; // 15 seconds

export function AgentCardGrid({ workspaceId }: AgentCardGridProps) {
  const { agents, tasks, selectedAgent, setSelectedAgent, setAgents, agentOpenClawSessions, setAgentOpenClawSession } = useMissionControl();
  const [filter, setFilter] = useState<FilterTab>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [showDiscoverModal, setShowDiscoverModal] = useState(false);
  const [liveAgentIds, setLiveAgentIds] = useState<Set<string>>(new Set());
  const [liveSessionsLoaded, setLiveSessionsLoaded] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [justRefreshed, setJustRefreshed] = useState(false);

  // Poll live Gateway sessions to determine real agent status
  const pollLiveSessions = useCallback(async () => {
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

      const now = Date.now();
      const activeIds = new Set<string>();
      for (const session of sessionsList) {
        const key = session.key || '';
        const match = key.match(/^agent:([^:]+):/);
        if (!match) continue;
        const updatedAtRaw = Number((session as { updatedAt?: number }).updatedAt || 0);
        if (!updatedAtRaw) continue;
        const updatedAtMs = updatedAtRaw < 1e12 ? updatedAtRaw * 1000 : updatedAtRaw;
        if (now - updatedAtMs <= ACTIVE_WINDOW_MS) {
          activeIds.add(match[1].toLowerCase());
        }
      }
      setLiveAgentIds(activeIds);
      setLiveSessionsLoaded(true);
    } catch (error) {
      console.error('Failed to poll live sessions:', error);
    }
  }, []);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    // Refresh live session status
    await pollLiveSessions();
    // Also reload agents from API (in case new agents were added)
    try {
      const res = await fetch(`/api/agents?workspace_id=${workspaceId || 'default'}`);
      if (res.ok) {
        const agentsData = await res.json();
        setAgents(agentsData);
      }
    } catch (error) {
      console.error('Failed to reload agents:', error);
    }
    setIsRefreshing(false);
    setJustRefreshed(true);
    setTimeout(() => setJustRefreshed(false), 1200);
  }, [pollLiveSessions, setAgents, workspaceId]);

  useEffect(() => {
    pollLiveSessions();
    const interval = setInterval(pollLiveSessions, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [pollLiveSessions]);


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
          <h2 className="text-sm font-semibold uppercase tracking-wider text-mc-text-secondary neon-line-bottom pb-1">
            Agents
          </h2>
          <span className="text-xs glow-badge px-2 py-0.5 rounded">
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
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs glow-button"
          >
            <Search className="w-3.5 h-3.5" />
            Import
          </button>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded border transition-colors glow-button ${
              isRefreshing || justRefreshed
                ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                : 'text-mc-text-secondary hover:text-mc-text'
            }`}
            title="Refresh agent status now"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing || justRefreshed ? 'Updated' : 'Refresh'}
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs glow-button text-mc-text-secondary hover:text-mc-text transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Agent
          </button>
        </div>
      </div>

      {/* Card Grid */}
      <div className="flex-1 overflow-y-auto p-6">
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl"
          variants={staggerContainer}
          initial="hidden"
          animate="show"
        >
          {filteredAgents.map((agent) => {
            const liveStatus = getAgentLiveStatus(agent);
            const currentWork = getAgentCurrentWork(agent);
            const color = getAgentColor(agent.name);
            const isWorking = liveStatus === 'working';

            return (
              <motion.button
                key={agent.id}
                variants={fadeSlideUp}
                whileHover={{
                  y: -4,
                  transition: { type: 'spring', stiffness: 400, damping: 17 },
                }}
                onClick={() => {
                  setSelectedAgent(agent);
                  setEditingAgent(agent);
                }}
                className={`agent-card glow-card group text-left rounded-xl p-5 transition-all duration-300 ease-out hover:scale-[1.02] focus:outline-none focus:ring-1 focus:ring-mc-accent/50 ${
                  isWorking ? 'glow-card-highlight glow-pulse' : ''
                }`}
                style={{
                  '--agent-color': color,
                  border: '1px solid rgba(0, 212, 255, 0.25)',
                  background: 'linear-gradient(135deg, rgba(0, 212, 255, 0.03) 0%, rgba(0, 0, 0, 0) 50%, rgba(176, 122, 255, 0.02) 100%), rgba(8, 16, 32, 0.7)',
                } as React.CSSProperties}
              >
                <div className="flex items-start gap-3">
                  {/* Avatar */}
                  <div className="text-2xl flex-shrink-0 mt-0.5">{agent.avatar_emoji}</div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-bold text-[18px] text-mc-text truncate tracking-[0.02em]">
                        {agent.name}
                      </span>
                      {!!agent.is_master && (
                        <span className="text-xs text-mc-accent-yellow flex-shrink-0">★</span>
                      )}
                      {agent.source === 'gateway' && (
                        <span className="text-[9px] px-[5px] py-[1px] rounded-[3px] flex-shrink-0" style={{ background: 'rgba(0, 212, 255, 0.12)', color: 'var(--mc-accent-cyan)' }}>
                          GW
                        </span>
                      )}
                    </div>
                    <div className="text-[12px] text-mc-text-secondary truncate">{agent.role}</div>
                    {agent.model && (
                      <div className="text-[11px] mt-1 truncate font-mono px-2 py-[2px] rounded-[4px] inline-block model-name" style={{
                        ...(agent.model.toLowerCase().includes('claude')
                          ? { color: '#b07aff', background: 'rgba(176, 122, 255, 0.12)', border: '1px solid rgba(176, 122, 255, 0.25)' }
                          : agent.model.toLowerCase().includes('gpt')
                          ? { color: '#00ff9d', background: 'rgba(0, 255, 157, 0.1)', border: '1px solid rgba(0, 255, 157, 0.2)' }
                          : agent.model.toLowerCase().includes('kimi')
                          ? { color: '#ff5c93', background: 'rgba(255, 92, 147, 0.1)', border: '1px solid rgba(255, 92, 147, 0.2)' }
                          : agent.model.toLowerCase().includes('minimax')
                          ? { color: '#ffc107', background: 'rgba(255, 193, 7, 0.1)', border: '1px solid rgba(255, 193, 7, 0.2)' }
                          : { color: 'var(--mc-text-secondary)', background: 'rgba(90,125,168,0.08)', border: '1px solid rgba(90,125,168,0.18)' })
                      }}>
                        {agent.model}
                      </div>
                    )}
                  </div>

                  {/* Status Pill */}
                  <motion.span
                    animate={isWorking ? { opacity: [0.7, 1, 0.7] } : { opacity: 1 }}
                    transition={isWorking ? { duration: 2, repeat: Infinity, ease: 'easeInOut' } : undefined}
                    className={`flex-shrink-0 text-[10px] font-semibold px-[10px] py-[3px] rounded-[6px] uppercase tracking-[0.1em] ${
                      isWorking ? 'status-badge-working' : 'status-badge-standby'
                    }`}
                  >
                    {isWorking ? 'WORKING' : 'STANDBY'}
                  </motion.span>
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
              </motion.button>
            );
          })}
        </motion.div>

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
