'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { AgentStatus } from '@/lib/types';

interface AgentData {
  id: string;
  name: string;
  status: AgentStatus;
  avatar_emoji: string;
  role: string;
}

interface AgentConfig {
  name: string;
  label: string;
  color: string;
  seatX: number;
  seatY: number;
  deskX: number;
  deskY: number;
  deskW: number;
  deskH: number;
  features: string[];
  emoji: string;
}

const AGENTS: AgentConfig[] = [
  {
    name: 'Monalisa',
    label: 'Artist',
    color: '#db61a2',
    seatX: 430, seatY: 135,
    deskX: 380, deskY: 52, deskW: 110, deskH: 40,
    features: ['art-supplies'],
    emoji: '🎨',
  },
  {
    name: 'Sherlock',
    label: 'CMO',
    color: '#3fb950',
    seatX: 160, seatY: 195,
    deskX: 100, deskY: 110, deskW: 120, deskH: 40,
    features: ['whiteboard'],
    emoji: '🔍',
  },
  {
    name: 'Dexter',
    label: 'CTO',
    color: '#58a6ff',
    seatX: 700, seatY: 195,
    deskX: 635, deskY: 110, deskW: 130, deskH: 40,
    features: ['multi-monitor'],
    emoji: '🤖',
  },
  {
    name: 'Eve',
    label: 'COO',
    color: '#a371f7',
    seatX: 430, seatY: 310,
    deskX: 360, deskY: 220, deskW: 140, deskH: 45,
    features: ['big-desk', 'nameplate'],
    emoji: '🧠',
  },
  {
    name: 'Shelby',
    label: 'Strategist',
    color: '#d29922',
    seatX: 160, seatY: 420,
    deskX: 100, deskY: 335, deskW: 120, deskH: 40,
    features: ['charts'],
    emoji: '📊',
  },
  {
    name: 'Bluma',
    label: 'CISO',
    color: '#f85149',
    seatX: 700, seatY: 420,
    deskX: 635, deskY: 335, deskW: 120, deskH: 40,
    features: ['security-monitor'],
    emoji: '🛡️',
  },
  {
    name: 'Goku',
    label: 'Trainer',
    color: '#ff8c00',
    seatX: 430, seatY: 500,
    deskX: 380, deskY: 415, deskW: 100, deskH: 38,
    features: ['small-energetic'],
    emoji: '⚡',
  },
];

const DOOR = { x: 420, y: 555 };
const PX = 3;
const CHAR_W = 14 * PX;
const CHAR_H = 22 * PX;

const LOUNGE_SEATS = [
  { cx: 540, by: 522 },
  { cx: 580, by: 522 },
  { cx: 620, by: 522 },
  { cx: 660, by: 522 },
  { cx: 700, by: 522 },
  { cx: 740, by: 522 },
];

function Agent({
  cx,
  bottomY,
  color,
  status,
  name,
  isWalking,
  isMini,
}: {
  cx: number;
  bottomY: number;
  color: string;
  status: AgentStatus;
  name: string;
  isWalking: boolean;
  isMini?: boolean;
}) {
  const S = isMini ? 2 : PX;
  const w = 14 * S;
  const h = 22 * S;
  const x = cx - w / 2;
  const y = bottomY - h;
  const skin = '#ffd5b8';

  const isSherlock = name === 'Sherlock';
  const isMonalisa = name === 'Monalisa';
  const isShelby = name === 'Shelby';

  return (
    <g className={isWalking ? 'pixel-walk' : status === 'working' ? 'pixel-typing' : 'pixel-idle'}>
      <ellipse cx={cx} cy={bottomY - h / 2} rx={w * 0.8} ry={h * 0.55} fill={color} opacity={0.12} filter="url(#glow)" />
      <ellipse cx={cx} cy={bottomY + 2} rx={w * 0.4} ry={S * 1.5} fill="rgba(0,0,0,0.3)" />

      {/* Hair / Hat */}
      {!isSherlock ? (
        <>
          <rect x={x + 3 * S} y={y} width={8 * S} height={2 * S} fill={isMonalisa ? '#5b3b2b' : color} />
          <rect x={x + 2 * S} y={y + S} width={10 * S} height={2 * S} fill={isMonalisa ? '#6a4330' : color} />
        </>
      ) : (
        <>
          <rect x={x + 1 * S} y={y + 1 * S} width={12 * S} height={2 * S} fill="#3d2c1e" />
          <rect x={x + 3 * S} y={y - S} width={8 * S} height={3 * S} fill="#4a3424" />
          <rect x={x + 4 * S} y={y - 2 * S} width={6 * S} height={S} fill="#6e5139" />
        </>
      )}

      <rect x={x + 3 * S} y={y + 2 * S} width={8 * S} height={7 * S} fill={skin} />
      <rect x={x + 4 * S} y={y + 5 * S} width={2 * S} height={2 * S} fill="#222" className={status === 'working' ? 'pixel-blink' : ''} />
      <rect x={x + 8 * S} y={y + 5 * S} width={2 * S} height={2 * S} fill="#222" className={status === 'working' ? 'pixel-blink' : ''} />
      <rect x={x + 4 * S} y={y + 5 * S} width={S} height={S} fill="rgba(255,255,255,0.5)" />
      <rect x={x + 8 * S} y={y + 5 * S} width={S} height={S} fill="rgba(255,255,255,0.5)" />
      {status === 'working' ? (
        <rect x={x + 5 * S} y={y + 7.5 * S} width={4 * S} height={S} fill="#d4937a" rx={S * 0.3} />
      ) : (
        <rect x={x + 6 * S} y={y + 7.5 * S} width={2 * S} height={S * 0.6} fill="#c9846b" />
      )}

      {/* Body by outfit */}
      {isMonalisa ? (
        <>
          <rect x={x + 2 * S} y={y + 9 * S} width={10 * S} height={5 * S} fill="#8b5e3c" />
          <rect x={x + 1 * S} y={y + 14 * S} width={12 * S} height={6 * S} fill="#6f4a30" />
          <rect x={x + 2 * S} y={y + 15 * S} width={10 * S} height={S} fill="#9a6a45" opacity={0.5} />
        </>
      ) : isShelby ? (
        <>
          <rect x={x + 2 * S} y={y + 9 * S} width={10 * S} height={7 * S} fill="#2f5fa9" />
          <rect x={x + 6 * S} y={y + 9 * S} width={2 * S} height={7 * S} fill="#dbe8ff" />
          <rect x={x + 5 * S} y={y + 10 * S} width={4 * S} height={2 * S} fill="#1f3f71" />
        </>
      ) : isSherlock ? (
        <>
          <rect x={x + 2 * S} y={y + 9 * S} width={10 * S} height={7 * S} fill="#5b4635" />
          <rect x={x + 4 * S} y={y + 9 * S} width={6 * S} height={7 * S} fill="#6d5541" />
          <rect x={x + 6 * S} y={y + 10 * S} width={2 * S} height={6 * S} fill="#d9c5a5" />
        </>
      ) : (
        <>
          <rect x={x + 2 * S} y={y + 9 * S} width={10 * S} height={7 * S} fill={color} />
          <rect x={x + 3 * S} y={y + 9 * S} width={8 * S} height={S} fill="rgba(255,255,255,0.2)" />
        </>
      )}

      <rect x={x} y={y + 10 * S} width={2 * S} height={5 * S} fill={isSherlock ? '#5b4635' : isShelby ? '#2f5fa9' : color}
        className={status === 'working' ? 'pixel-arm-left' : ''} />
      <rect x={x + 12 * S} y={y + 10 * S} width={2 * S} height={5 * S} fill={isSherlock ? '#5b4635' : isShelby ? '#2f5fa9' : color}
        className={status === 'working' ? 'pixel-arm-right' : ''} />
      <rect x={x} y={y + 14 * S} width={2 * S} height={2 * S} fill={skin} className={status === 'working' ? 'pixel-arm-left' : ''} />
      <rect x={x + 12 * S} y={y + 14 * S} width={2 * S} height={2 * S} fill={skin} className={status === 'working' ? 'pixel-arm-right' : ''} />

      <rect x={x + 3 * S} y={y + 16 * S} width={3 * S} height={4 * S} fill="#3d4450" className={isWalking ? 'pixel-leg-left' : ''} />
      <rect x={x + 8 * S} y={y + 16 * S} width={3 * S} height={4 * S} fill="#3d4450" className={isWalking ? 'pixel-leg-right' : ''} />
      <rect x={x + 2 * S} y={y + 20 * S} width={4 * S} height={2 * S} fill="#222" className={isWalking ? 'pixel-leg-left' : ''} />
      <rect x={x + 8 * S} y={y + 20 * S} width={4 * S} height={2 * S} fill="#222" className={isWalking ? 'pixel-leg-right' : ''} />

      {!isMini ? (
        <g>
          <rect x={cx - 34} y={y - 20} width={68} height={17} rx={4} fill="rgba(13,17,23,0.95)" stroke={color} strokeWidth={1.5} />
          <text x={cx} y={y - 8} textAnchor="middle" fill={color} fontSize={11} fontFamily="'JetBrains Mono', monospace" fontWeight="bold">
            {name}
          </text>
        </g>
      ) : (
        <g>
          <rect x={cx - 28} y={y - 14} width={56} height={13} rx={3} fill="rgba(13,17,23,0.95)" stroke="#39d353" strokeWidth={1} />
          <text x={cx} y={y - 4} textAnchor="middle" fill="#39d353" fontSize={8} fontFamily="'JetBrains Mono', monospace">
            sub-agent
          </text>
        </g>
      )}

      <circle cx={cx + w / 2 + 4} cy={y + 4} r={4.5} fill={status === 'working' ? '#3fb950' : status === 'standby' ? '#d29922' : '#f85149'} className={status === 'working' ? 'pixel-pulse' : ''} />
      {status === 'working' && (
        <circle cx={cx + w / 2 + 4} cy={y + 4} r={8} fill="none" stroke="#3fb950" strokeWidth={1} opacity={0.3} className="pixel-pulse" />
      )}
    </g>
  );
}

function Desk({ agent, status }: { agent: AgentConfig; status: AgentStatus }) {
  const { deskX: dx, deskY: dy, deskW: dw, deskH: dh, seatX, seatY, color, features } = agent;

  return (
    <g>
      <rect x={dx} y={dy} width={dw} height={dh} rx={3} fill="#3d3122" stroke="#5a4a32" strokeWidth={2} />
      <rect x={dx + 2} y={dy + 2} width={dw - 4} height={4} fill="#5a4a32" opacity={0.5} />
      <rect x={dx + 5} y={dy + dh} width={4} height={8} fill="#3d3122" />
      <rect x={dx + dw - 9} y={dy + dh} width={4} height={8} fill="#3d3122" />

      {features.includes('multi-monitor') ? (
        [0, 30, 60].map((off, i) => (
          <g key={i}>
            <rect x={dx + 10 + off} y={dy - 24} width={26} height={22} rx={2} fill="#161b22" stroke="#30363d" strokeWidth={1} />
            <rect x={dx + 12 + off} y={dy - 22} width={22} height={16} fill={status === 'working' ? '#0d3320' : '#0d1117'} className={status === 'working' ? 'pixel-screen-glow' : ''} />
            {status === 'working' && (
              <>
                <rect x={dx + 14 + off} y={dy - 20} width={14} height={1.5} fill="#3fb950" opacity={0.6} className="pixel-code-line" />
                <rect x={dx + 14 + off} y={dy - 17} width={9} height={1.5} fill="#58a6ff" opacity={0.4} className="pixel-code-line-2" />
                <rect x={dx + 14 + off} y={dy - 14} width={16} height={1.5} fill="#3fb950" opacity={0.5} className="pixel-code-line-3" />
              </>
            )}
            <rect x={dx + 21 + off} y={dy - 2} width={4} height={4} fill="#30363d" />
          </g>
        ))
      ) : (
        <g>
          <rect x={dx + dw / 2 - 18} y={dy - 26} width={36} height={24} rx={2} fill="#161b22" stroke="#30363d" strokeWidth={1} />
          <rect x={dx + dw / 2 - 16} y={dy - 24} width={32} height={18} fill={status === 'working' ? '#0d3320' : '#0d1117'} className={status === 'working' ? 'pixel-screen-glow' : ''} />
          {status === 'working' && (
            <>
              <rect x={dx + dw / 2 - 14} y={dy - 22} width={18} height={1.5} fill="#3fb950" opacity={0.6} className="pixel-code-line" />
              <rect x={dx + dw / 2 - 14} y={dy - 19} width={12} height={1.5} fill="#58a6ff" opacity={0.4} className="pixel-code-line-2" />
              <rect x={dx + dw / 2 - 14} y={dy - 16} width={22} height={1.5} fill="#3fb950" opacity={0.5} className="pixel-code-line-3" />
            </>
          )}
          <rect x={dx + dw / 2 - 3} y={dy - 2} width={6} height={4} fill="#30363d" />
        </g>
      )}

      {features.includes('whiteboard') && (
        <g>
          <rect x={dx + dw + 10} y={dy - 16} width={32} height={42} rx={2} fill="#ececec" stroke="#ccc" strokeWidth={1} />
          <rect x={dx + dw + 14} y={dy - 10} width={20} height={1.5} fill="#aaa" />
          <rect x={dx + dw + 14} y={dy - 6} width={14} height={1.5} fill="#aaa" />
          <rect x={dx + dw + 14} y={dy - 2} width={22} height={1.5} fill={color} />
          <text x={dx + dw + 16} y={dy + 16} fill="#666" fontSize={7} fontFamily="monospace">TODO</text>
        </g>
      )}

      {features.includes('charts') && (
        <g>
          <rect x={dx + 8} y={dy + 8} width={24} height={18} rx={1} fill="#161b22" stroke="#30363d" strokeWidth={0.5} />
          <rect x={dx + 12} y={dy + 20} width={4} height={4} fill="#3fb950" />
          <rect x={dx + 18} y={dy + 16} width={4} height={8} fill="#58a6ff" />
          <rect x={dx + 24} y={dy + 18} width={4} height={6} fill="#d29922" />
        </g>
      )}

      {features.includes('security-monitor') && (
        <g>
          <rect x={dx + dw - 30} y={dy + 6} width={24} height={18} rx={1} fill="#0d1117" stroke="#f85149" strokeWidth={0.5} />
          <circle cx={dx + dw - 18} cy={dy + 15} r={5} fill="none" stroke="#f85149" strokeWidth={0.5} opacity={0.5} />
          <text x={dx + dw - 26} y={dy + 22} fill="#f85149" fontSize={5} fontFamily="monospace" className="pixel-blink">REC</text>
        </g>
      )}

      {features.includes('art-supplies') && (
        <g>
          <ellipse cx={dx + 22} cy={dy + 18} rx={11} ry={9} fill="#8B7355" />
          <circle cx={dx + 16} cy={dy + 15} r={3} fill="#ff6b6b" />
          <circle cx={dx + 24} cy={dy + 14} r={3} fill="#4ecdc4" />
          <circle cx={dx + 19} cy={dy + 22} r={3} fill="#ffe66d" />
          <circle cx={dx + 27} cy={dy + 20} r={3} fill="#a371f7" />
        </g>
      )}

      {features.includes('small-energetic') && (
        <g>
          <rect x={dx + dw - 14} y={dy + 6} width={8} height={12} rx={1} fill="#ff8c00" />
          <text x={dx + dw - 13} y={dy + 16} fill="#fff" fontSize={5} fontWeight="bold">⚡</text>
        </g>
      )}

      {features.includes('big-desk') && (
        <g>
          <rect x={dx + dw - 18} y={dy + 8} width={10} height={12} rx={2} fill="#8b949e" />
          <rect x={dx + dw - 8} y={dy + 10} width={4} height={8} rx={2} fill="none" stroke="#8b949e" strokeWidth={1} />
          <rect x={dx + 8} y={dy + 8} width={34} height={12} rx={1} fill="#d4af37" />
          <text x={dx + 13} y={dy + 17} fill="#1a1a1a" fontSize={7} fontFamily="monospace" fontWeight="bold">EVE</text>
        </g>
      )}

      <rect x={seatX - 14} y={seatY - 8} width={28} height={22} rx={5} fill="#21262d" stroke="#30363d" strokeWidth={1} />
      <rect x={seatX - 12} y={seatY - 18} width={24} height={12} rx={4} fill="#282e36" stroke="#30363d" strokeWidth={1} />
      <rect x={seatX - 2} y={seatY + 14} width={4} height={6} fill="#30363d" />
      <circle cx={seatX - 8} cy={seatY + 22} r={2.5} fill="#30363d" />
      <circle cx={seatX + 8} cy={seatY + 22} r={2.5} fill="#30363d" />
    </g>
  );
}

export function PixelOffice() {
  const [agents, setAgents] = useState<AgentData[]>([]);
  const [positions, setPositions] = useState<Map<string, { cx: number; by: number }>>(new Map());
  const [walking, setWalking] = useState<Set<string>>(new Set());
  const [hasSubagents, setHasSubagents] = useState(false);
  const [subPos, setSubPos] = useState({ cx: DOOR.x, by: DOOR.y });
  const [subWalking, setSubWalking] = useState(false);
  const animStarted = useRef(false);

  const fetchAgents = useCallback(async () => {
    try {
      const res = await fetch('/api/agents');
      if (res.ok) setAgents(await res.json());
    } catch {}
  }, []);

  const fetchSubagents = useCallback(async () => {
    try {
      const res = await fetch('/api/openclaw/sessions?session_type=subagent&status=active');
      if (res.ok) {
        const sessions = await res.json();
        setHasSubagents(sessions.some((s: { label?: string }) => s.label?.includes('dexter')));
      }
    } catch {}
  }, []);

  useEffect(() => {
    fetchAgents();
    fetchSubagents();
    const iv = setInterval(() => { fetchAgents(); fetchSubagents(); }, 10000);
    return () => clearInterval(iv);
  }, [fetchAgents, fetchSubagents]);

  const getStatus = useCallback((name: string): AgentStatus => (
    agents.find(a => a.name.toLowerCase() === name.toLowerCase())?.status || 'offline'
  ), [agents]);

  const getTargetPositions = useCallback(() => {
    const standbyAgents = AGENTS.filter(agent => getStatus(agent.name) === 'standby');
    const standbySeatByName = new Map<string, { cx: number; by: number }>();

    standbyAgents.forEach((agent, idx) => {
      const seat = LOUNGE_SEATS[idx % LOUNGE_SEATS.length];
      standbySeatByName.set(agent.name, seat);
    });

    const target = new Map<string, { cx: number; by: number }>();
    AGENTS.forEach(agent => {
      const status = getStatus(agent.name);
      if (status === 'standby') {
        target.set(agent.name, standbySeatByName.get(agent.name) || { cx: agent.seatX, by: agent.seatY });
      } else {
        target.set(agent.name, { cx: agent.seatX, by: agent.seatY });
      }
    });
    return target;
  }, [getStatus]);

  useEffect(() => {
    if (agents.length === 0 || animStarted.current) return;
    animStarted.current = true;

    const init = new Map<string, { cx: number; by: number }>();
    const allWalk = new Set<string>();
    AGENTS.forEach(a => {
      init.set(a.name, { cx: DOOR.x, by: DOOR.y });
      allWalk.add(a.name);
    });
    setPositions(init);
    setWalking(allWalk);

    const targets = getTargetPositions();

    AGENTS.forEach((agent, idx) => {
      const delay = idx * 350;
      const dur = 1800;
      const t0 = performance.now() + delay;
      const target = targets.get(agent.name) || { cx: agent.seatX, by: agent.seatY };

      const step = (now: number) => {
        const elapsed = now - t0;
        if (elapsed < 0) { requestAnimationFrame(step); return; }
        const p = Math.min(elapsed / dur, 1);
        const e = 1 - Math.pow(1 - p, 3);

        setPositions(prev => {
          const next = new Map(prev);
          next.set(agent.name, {
            cx: DOOR.x + (target.cx - DOOR.x) * e,
            by: DOOR.y + (target.by - DOOR.y) * e,
          });
          return next;
        });

        if (p < 1) requestAnimationFrame(step);
        else setWalking(prev => {
          const n = new Set(prev);
          n.delete(agent.name);
          return n;
        });
      };
      requestAnimationFrame(step);
    });
  }, [agents, getTargetPositions]);

  useEffect(() => {
    if (!animStarted.current || positions.size === 0) return;

    const targets = getTargetPositions();

    AGENTS.forEach((agent, idx) => {
      const current = positions.get(agent.name);
      const target = targets.get(agent.name);
      if (!current || !target) return;

      const dist = Math.hypot(target.cx - current.cx, target.by - current.by);
      if (dist < 1) return;

      const delay = idx * 60;
      const dur = 1100;
      const t0 = performance.now() + delay;

      setWalking(prev => new Set(prev).add(agent.name));

      const step = (now: number) => {
        const elapsed = now - t0;
        if (elapsed < 0) { requestAnimationFrame(step); return; }
        const p = Math.min(elapsed / dur, 1);
        const e = 1 - Math.pow(1 - p, 3);

        setPositions(prev => {
          const pos = prev.get(agent.name) || current;
          const next = new Map(prev);
          next.set(agent.name, {
            cx: pos.cx + (target.cx - pos.cx) * e * 0.2,
            by: pos.by + (target.by - pos.by) * e * 0.2,
          });

          if (p >= 1) next.set(agent.name, target);
          return next;
        });

        if (p < 1) {
          requestAnimationFrame(step);
        } else {
          setWalking(prev => {
            const n = new Set(prev);
            n.delete(agent.name);
            return n;
          });
        }
      };

      requestAnimationFrame(step);
    });
  }, [agents, getTargetPositions, positions]);

  useEffect(() => {
    if (!hasSubagents) { setSubWalking(false); return; }
    setSubWalking(true);
    setSubPos({ cx: DOOR.x, by: DOOR.y });

    const dexter = AGENTS.find(a => a.name === 'Dexter');
    if (!dexter) return;

    const tx = dexter.seatX + 45;
    const ty = dexter.seatY + 5;
    const t0 = performance.now() + 500;
    const dur = 2000;

    const step = (now: number) => {
      const elapsed = now - t0;
      if (elapsed < 0) { requestAnimationFrame(step); return; }
      const p = Math.min(elapsed / dur, 1);
      const e = 1 - Math.pow(1 - p, 3);
      setSubPos({
        cx: DOOR.x + (tx - DOOR.x) * e,
        by: DOOR.y + (ty - DOOR.y) * e,
      });
      if (p < 1) requestAnimationFrame(step);
      else setSubWalking(false);
    };
    requestAnimationFrame(step);
  }, [hasSubagents]);

  const standbyCount = agents.filter(a => a.status === 'standby').length;

  return (
    <div className="relative w-full h-full min-h-screen bg-mc-bg flex flex-col items-center">
      <div className="w-full flex items-center justify-between px-6 py-3 bg-mc-bg-secondary border-b border-mc-border">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🏢</span>
          <h1 className="text-lg font-bold text-mc-text tracking-wider uppercase">Office View</h1>
          <span className="text-xs text-mc-text-secondary bg-mc-bg-tertiary px-2 py-0.5 rounded">8-BIT</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 text-xs text-mc-text-secondary">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-mc-accent-green animate-pulse" />Working</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-mc-accent-yellow" />Standby</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-mc-accent-red" />Offline</span>
          </div>
          <a href="/" className="text-sm text-mc-accent hover:text-mc-text transition-colors px-3 py-1 bg-mc-bg-tertiary rounded">
            ← Dashboard
          </a>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-4 w-full">
        <svg viewBox="0 0 860 580" className="w-full max-w-5xl border border-mc-border rounded-lg bg-[#0a0e14]" style={{ imageRendering: 'auto' }}>
          <defs>
            <pattern id="floor" width="40" height="40" patternUnits="userSpaceOnUse">
              <rect width="40" height="40" fill="#141a22" />
              <rect x="0" y="0" width="20" height="20" fill="#161e28" />
              <rect x="20" y="20" width="20" height="20" fill="#161e28" />
            </pattern>
            <filter id="glow"><feGaussianBlur stdDeviation="3" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
          </defs>

          <rect width="860" height="580" fill="url(#floor)" />

          <rect width="860" height="6" fill="#30363d" />
          <rect width="6" height="580" fill="#30363d" />
          <rect x="854" width="6" height="580" fill="#30363d" />
          <rect y="574" width="860" height="6" fill="#30363d" />

          <rect x={DOOR.x - 22} y="536" width="52" height="40" fill="#3d3122" rx={2} />
          <rect x={DOOR.x - 18} y="540" width="44" height="34" fill="#0d1117" />
          <circle cx={DOOR.x + 24} cy="557" r={2.5} fill="#d4af37" />
          <text x={DOOR.x} y="534" fill="#8b949e" fontSize={8} fontFamily="monospace" textAnchor="middle">ENTRANCE</text>

          <rect x="340" y="10" width="180" height="26" rx={5} fill="#161b22" stroke="#58a6ff" strokeWidth={1.2} />
          <text x="430" y="28" textAnchor="middle" fill="#58a6ff" fontSize={12} fontFamily="'JetBrains Mono', monospace" fontWeight="bold" filter="url(#glow)">
            MAYAKATI HQ
          </text>

          {[160, 430, 700].map((lx, i) => (
            <g key={`l${i}`}>
              <rect x={lx - 16} y={8} width={32} height={4} rx={1} fill="#30363d" />
              <rect x={lx - 9} y={12} width={18} height={2} fill="#58a6ff" opacity={0.3} />
              <ellipse cx={lx} cy={24} rx={50} ry={18} fill="#58a6ff" opacity={0.025} />
            </g>
          ))}

          {[{x:30,y:45},{x:815,y:45},{x:30,y:490},{x:815,y:490}].map((p,i) => (
            <g key={`p${i}`}>
              <rect x={p.x-7} y={p.y+12} width={14} height={16} rx={2} fill="#5a3825" />
              <circle cx={p.x} cy={p.y+8} r={9} fill="#2d5a27" />
              <circle cx={p.x-4} cy={p.y+4} r={6} fill="#3fb950" opacity={0.5} />
              <circle cx={p.x+5} cy={p.y+2} r={7} fill="#2d5a27" />
            </g>
          ))}

          {/* Lounge area */}
          <g>
            <rect x={500} y={455} width={310} height={108} rx={8} fill="#111923" stroke="#2a3544" strokeWidth={1.5} />
            <rect x={512} y={468} width={210} height={18} rx={3} fill="#2f4c7d" />
            <rect x={512} y={486} width={210} height={38} rx={4} fill="#3d66a3" />
            {[528, 566, 604, 642, 680].map(x => <rect key={x} x={x} y={491} width={18} height={28} rx={2} fill="#4c79bb" />)}
            <rect x={500} y={522} width={16} height={18} fill="#2f4c7d" />
            <rect x={706} y={522} width={16} height={18} fill="#2f4c7d" />

            <rect x={744} y={458} width={54} height={34} rx={3} fill="#111" stroke="#444" strokeWidth={1} />
            <rect x={748} y={462} width={46} height={24} fill="#1d2b3a" />
            <rect x={752} y={466} width={18} height={2} fill="#58a6ff" opacity={0.6} />
            <rect x={752} y={470} width={28} height={2} fill="#39d353" opacity={0.6} />
            <rect x={766} y={492} width={10} height={5} fill="#444" />

            <rect x={780} y={504} width={16} height={18} rx={2} fill="#6b4428" />
            <circle cx={788} cy={500} r={8} fill="#2f7a3a" />
            <circle cx={784} cy={497} r={5} fill="#3fb950" opacity={0.7} />

            <text x={516} y={450} fill="#8b949e" fontSize={8} fontFamily="monospace">LOUNGE · standby chill zone ({standbyCount})</text>
          </g>

          <rect x={785} y={250} width={18} height={32} rx={2} fill="#4a6fa5" />
          <rect x={787} y={240} width={14} height={12} rx={7} fill="#a8d0f0" opacity={0.5} />

          {AGENTS.map(a => <Desk key={`d-${a.name}`} agent={a} status={getStatus(a.name)} />)}

          {AGENTS.map(a => {
            const pos = positions.get(a.name);
            if (!pos) return null;
            return (
              <Agent key={a.name} cx={pos.cx} bottomY={pos.by} color={a.color} status={getStatus(a.name)} name={a.name} isWalking={walking.has(a.name)} />
            );
          })}

          {hasSubagents && (
            <Agent cx={subPos.cx} bottomY={subPos.by} color="#39d353" status="working" name="helper" isWalking={subWalking} isMini />
          )}

          {AGENTS.map(a => {
            const st = getStatus(a.name);
            const pos = positions.get(a.name);
            if (!pos) return null;

            if (st === 'working') {
              return (
                <text key={`t-${a.name}`} x={pos.cx + CHAR_W / 2 + 12} y={pos.by - CHAR_H + 10} fill={a.color} fontSize={9} fontFamily="monospace" opacity={0.8} className="pixel-typing-indicator" filter="url(#glow)">
                  ⌨️ clack
                </text>
              );
            }
            if (st === 'standby') {
              return (
                <text key={`z-${a.name}`} x={pos.cx + CHAR_W / 2 + 8} y={pos.by - CHAR_H + 5} fill="#8b949e" fontSize={16} className="pixel-zzz">
                  💤
                </text>
              );
            }
            return null;
          })}
        </svg>
      </div>

      <div className="w-full px-6 py-2 bg-mc-bg-secondary border-t border-mc-border flex items-center justify-between text-xs text-mc-text-secondary">
        <div className="flex items-center gap-4">
          <span>👥 {agents.filter(a => a.status === 'working').length} working</span>
          <span>😴 {standbyCount} standby</span>
          <span>⛔ {agents.filter(a => a.status === 'offline').length} offline</span>
          {hasSubagents && <span className="text-mc-accent-green">🤖 Dexter has active sub-agents</span>}
        </div>
        <span>Auto-refresh: 10s</span>
      </div>
    </div>
  );
}
