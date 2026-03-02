'use client';

import { useEffect, useState, useRef } from 'react';
import { useMissionControl } from '@/lib/store';

// Agent configuration with pixel art avatars
const AGENTS = [
  { id: 'main', name: 'Eve', emoji: '🦋', color: 'from-pink-400 to-purple-500' },
  { id: 'dexter', name: 'Dexter', emoji: '🤖', color: 'from-blue-400 to-cyan-500' },
  { id: 'bluma', name: 'Bluma', emoji: '🛡️', color: 'from-green-400 to-emerald-500' },
  { id: 'sherlock', name: 'Sherlock', emoji: '🔍', color: 'from-orange-400 to-amber-500' },
  { id: 'shelby', name: 'Shelby', emoji: '📊', color: 'from-indigo-400 to-violet-500' },
  { id: 'goku', name: 'Goku', emoji: '⚡', color: 'from-yellow-400 to-orange-500' },
  { id: 'monalisa', name: 'Monalisa', emoji: '🎨', color: 'from-rose-400 to-pink-500' },
];

// 4 Zones in the workflow
const ZONES = [
  { id: 'breakroom', name: 'Break Room', x: 10 },
  { id: 'building', name: 'Building', x: 35 },
  { id: 'qa', name: 'QA', x: 60 },
  { id: 'review', name: 'Review', x: 85 },
];

function getAgentZone(status: string): number {
  const s = status?.toLowerCase() || '';
  if (s.includes('standby') || s.includes('idle')) return 0;
  if (s.includes('working') || s.includes('active')) return 1;
  if (s.includes('qa') || s.includes('review')) return 2;
  if (s.includes('done') || s.includes('complete')) return 3;
  return 0;
}

function getAgentActivity(status: string): string {
  const s = status?.toLowerCase() || '';
  if (s.includes('standby')) return 'พักผ่อน';
  if (s.includes('idle')) return 'รองาน';
  if (s.includes('working')) return 'กำลังเขียนโค้ด';
  if (s.includes('active')) return 'ทำงาน';
  if (s.includes('thinking')) return 'คิดวิเคราะห์';
  return 'ไม่ทราบ';
}

interface AgentWithPosition {
  id: string;
  name: string;
  emoji: string;
  color: string;
  zone: number;
  status: string;
  activity: string;
}

export default function VisualWorkflowBoard() {
  const { agents } = useMissionControl();
  const [agentPositions, setAgentPositions] = useState<AgentWithPosition[]>([]);
  const [hoveredAgent, setHoveredAgent] = useState<AgentWithPosition | null>(null);
  const [time, setTime] = useState(0);

  useEffect(() => {
    const positions: AgentWithPosition[] = AGENTS.map(agent => {
      const agentData = agents.find(a => 
        a.gateway_agent_id?.toLowerCase() === agent.id.toLowerCase() ||
        a.name?.toLowerCase() === agent.id.toLowerCase()
      );
      
      const status = agentData?.status || 'standby';
      const zone = getAgentZone(status);
      const activity = getAgentActivity(status);
      
      return { ...agent, zone, status, activity };
    });
    
    setAgentPositions(positions);
  }, [agents]);

  const getAgentPosition = (agent: AgentWithPosition, index: number) => {
    const zone = ZONES[agent.zone];
    const offset = Math.sin(time * 0.05 + index) * 3;
    return { left: zone.x + offset, top: 30 + (index % 3) * 20 };
  };

  return (
    <div className="h-full flex flex-col bg-mc-bg overflow-hidden">
      <div className="p-4 border-b border-mc-border">
        <h2 className="text-lg font-semibold text-mc-text flex items-center gap-2">
          <span className="text-2xl">🎮</span> Visual Workflow Board
        </h2>
        <p className="text-xs text-mc-text-secondary mt-1">
          Agent real-time status
        </p>
      </div>

      <div className="relative flex-1 min-h-[300px] bg-gradient-to-br from-mc-bg to-mc-bg-tertiary">
        {/* Zone Backgrounds */}
        <div className="absolute inset-0 flex">
          {ZONES.map((zone, idx) => (
            <div key={zone.id} className={`flex-1 border-r border-mc-border/30 last:border-0 ${
              ['bg-purple-500/5', 'bg-blue-500/5', 'bg-green-500/5', 'bg-amber-500/5'][idx]
            }`}>
              <div className="absolute top-2 left-1/2 -translate-x-1/2 text-xs font-medium text-mc-text-secondary uppercase tracking-wider">
                {zone.name}
              </div>
              <div className="absolute top-1/2 left-2 right-2 h-0.5 bg-mc-border/20" />
            </div>
          ))}
        </div>

        {/* Agent Avatars */}
        {agentPositions.map((agent, index) => {
          const pos = getAgentPosition(agent, index);
          
          return (
            <div
              key={agent.id}
              className="absolute transition-all duration-1000 ease-in-out cursor-pointer"
              style={{ left: `${pos.left}%`, top: `${pos.top}%` }}
              onMouseEnter={() => setHoveredAgent(agent)}
              onMouseLeave={() => setHoveredAgent(null)}
            >
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl bg-gradient-to-br ${agent.color} shadow-lg transform hover:scale-110 transition-transform`}>
                {agent.emoji}
              </div>
            </div>
          );
        })}

        {/* Tooltip */}
        {hoveredAgent && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-mc-bg border border-mc-border rounded-lg px-4 py-2 shadow-xl z-10">
            <div className="flex items-center gap-2">
              <span className="text-xl">{hoveredAgent.emoji}</span>
              <div>
                <p className="text-sm font-medium text-mc-text">{hoveredAgent.name}</p>
                <p className="text-xs text-mc-text-secondary">{hoveredAgent.activity}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
