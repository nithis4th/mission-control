"use client";

import { useEffect, useState } from 'react';
import { useMissionControl } from '@/lib/store';
import type { Task } from '@/lib/types';

const AGENTS = [
  { id: 'main', name: 'Eve', emoji: '🦋', color: 'from-pink-400 to-purple-500' },
  { id: 'dexter', name: 'Dexter', emoji: '🤖', color: 'from-blue-400 to-cyan-500' },
  { id: 'bluma', name: 'Bluma', emoji: '🛡️', color: 'from-green-400 to-emerald-500' },
  { id: 'sherlock', name: 'Sherlock', emoji: '🔍', color: 'from-orange-400 to-amber-500' },
  { id: 'shelby', name: 'Shelby', emoji: '📊', color: 'from-indigo-400 to-violet-500' },
  { id: 'goku', name: 'Goku', emoji: '⚡', color: 'from-yellow-400 to-orange-500' },
  { id: 'monalisa', name: 'Monalisa', emoji: '🎨', color: 'from-rose-400 to-pink-500' },
];

const ZONES = [
  { id: 'breakroom', name: 'Break Room', color: 'purple' },
  { id: 'building', name: 'Building', color: 'blue' },
  { id: 'qa', name: 'QA', color: 'green' },
  { id: 'review', name: 'Review', color: 'amber' },
];

const STATUS_MAP: Record<string, number> = {
  'inbox': 0, 'planning': 0, 'pending': 0,
  'assigned': 1, 'in_progress': 1,
  'testing': 2, 'review': 2,
  'done': 3,
};

function getAgentZone(status: string): number {
  const s = (status || '').toLowerCase();
  if (s.includes('standby') || s.includes('idle')) return 0;
  if (s.includes('working') || s.includes('active')) return 1;
  return 0;
}

export default function TaskBoard() {
  const { agents, tasks } = useMissionControl();
  const [time, setTime] = useState(0);

  const stats = {
    shipped: tasks.filter(t => t.status === 'done').length,
    inProgress: tasks.filter(t => ['assigned', 'in_progress', 'testing'].includes(t.status)).length,
    backlog: tasks.filter(t => ['inbox', 'planning', 'pending'].includes(t.status)).length,
    blocked: tasks.filter(t => t.status === 'rejected').length,
  };

  const tasksByZone = {
    0: tasks.filter(t => STATUS_MAP[t.status] === 0),
    1: tasks.filter(t => STATUS_MAP[t.status] === 1),
    2: tasks.filter(t => STATUS_MAP[t.status] === 2),
    3: tasks.filter(t => t.status === 'done'),
  };

  useEffect(() => {
    const interval = setInterval(() => setTime(t => t + 1), 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="h-full flex flex-col bg-mc-bg overflow-hidden">
      {/* Summary Stats */}
      <div className="flex items-center gap-4 p-3 border-b border-mc-border bg-mc-bg-secondary">
        <StatCard label="Shipped" value={stats.shipped} color="green" />
        <StatCard label="In Progress" value={stats.inProgress} color="blue" />
        <StatCard label="Backlog" value={stats.backlog} color="yellow" />
        <StatCard label="Blocked" value={stats.blocked} color="red" />
      </div>

      {/* Workflow + Kanban */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Agent Status (25%) */}
        <div className="w-[25%] relative border-r border-mc-border bg-mc-bg-tertiary">
          <div className="absolute top-2 left-0 right-0 text-center text-xs font-medium text-mc-text-secondary">
            Agent Status
          </div>
          <div className="pt-8 px-2">
            {agents.slice(0, 7).map((agent, idx) => {
              const zone = getAgentZone(agent.status || 'standby');
              const agentInfo = AGENTS[idx % 7];
              return (
                <div key={agent.id} className="flex items-center gap-2 p-2 mb-1 rounded-lg bg-mc-bg">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm bg-gradient-to-br ${agentInfo.color}`}>
                    {agentInfo.emoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-mc-text truncate">{agentInfo.name}</p>
                    <p className="text-[10px] text-mc-text-secondary">{zone === 1 ? 'กำลังทำงาน' : 'ว่าง'}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Kanban (75%) */}
        <div className="w-[75%] flex">
          {ZONES.map((zone, idx) => (
            <div key={zone.id} className="flex-1 border-r border-mc-border/30 last:border-0 p-2 overflow-auto">
              <div className={`text-xs font-medium text-mc-${zone.color}-400 uppercase mb-2 text-center`}>
                {zone.name} ({tasksByZone[idx as keyof typeof tasksByZone]?.length || 0})
              </div>
              <div className="space-y-2">
                {(tasksByZone[idx as keyof typeof tasksByZone] || []).map(task => (
                  <TaskCard key={task.id} task={task} zoneColor={zone.color} />
                ))}
                {(tasksByZone[idx as keyof typeof tasksByZone]?.length || 0) === 0 && (
                  <div className="text-center text-xs text-mc-text-secondary py-4">No tasks</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg bg-mc-${color}-500/10 border border-mc-${color}-500/20`}>
      <span className={`text-lg font-bold text-mc-${color}-400`}>{value}</span>
      <span className="text-xs text-mc-text-secondary">{label}</span>
    </div>
  );
}

function TaskCard({ task, zoneColor }: { task: Task; zoneColor: string }) {
  const priorityColors: Record<string, string> = {
    urgent: 'border-red-500 shadow-red-500/20',
    high: 'border-orange-500',
    normal: 'border-mc-border',
    low: 'border-gray-600',
  };

  return (
    <div className={`p-2 rounded-lg bg-mc-bg border ${priorityColors[task.priority || 'normal']} hover:border-mc-${zoneColor}-400 transition-colors cursor-pointer`}>
      <p className="text-xs font-medium text-mc-text truncate">{task.title}</p>
      <div className="flex items-center justify-between mt-1">
        <span className="text-[10px] text-mc-text-secondary">{task.assigned_agent_id || 'Unassigned'}</span>
      </div>
    </div>
  );
}
