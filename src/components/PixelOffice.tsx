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
  gender?: 'male' | 'female';
  hairColor?: string;
  dressColor?: string;
  skin?: string;
}

const AGENTS: AgentConfig[] = [
  // ===== LEFT HALF — WORK ZONE (x: 20-410) =====
  // แถวบน: Eve + Dexter (หันลง)
  {
    name: 'Eve',
    label: 'COO',
    color: '#a371f7',
    seatX: 60, seatY: 180,
    deskX: 30, deskY: 100, deskW: 140, deskH: 50,
    features: ['big-desk', 'nameplate'],
    emoji: '🧠',
    gender: 'female', hairColor: '#c8962a', dressColor: '#6b35a8',
  },
  {
    name: 'Dexter',
    label: 'CTO',
    color: '#58a6ff',
    seatX: 240, seatY: 180,
    deskX: 210, deskY: 100, deskW: 140, deskH: 50,
    features: ['multi-monitor'],
    emoji: '🤖',
  },
  // แถวล่าง: Sherlock + Bluma (หันขึ้น — facing แถวบน)
  {
    name: 'Sherlock',
    label: 'CMO',
    color: '#3fb950',
    seatX: 60, seatY: 300,
    deskX: 30, deskY: 300, deskW: 140, deskH: 50,
    features: ['whiteboard'],
    emoji: '🔍',
  },
  {
    name: 'Bluma',
    label: 'CISO',
    color: '#f85149',
    seatX: 240, seatY: 300,
    deskX: 210, deskY: 300, deskW: 140, deskH: 50,
    features: ['security-monitor'],
    emoji: '🛡️',
  },
  // ===== RIGHT HALF — LOUNGE ZONE (x: 450-840) =====
  {
    name: 'Shelby',
    label: 'Strategist',
    color: '#d29922',
    seatX: 520, seatY: 380,
    deskX: 460, deskY: 100, deskW: 0, deskH: 0,
    features: [],
    emoji: '📊',
    gender: 'female', hairColor: '#5c3317', dressColor: '#8b1a1a',
  },
  {
    name: 'Monalisa',
    label: 'Artist',
    color: '#db61a2',
    seatX: 630, seatY: 380,
    deskX: 460, deskY: 100, deskW: 0, deskH: 0,
    features: [],
    emoji: '🎨',
    gender: 'female', hairColor: '#1a0a00', dressColor: '#1a4a2a', skin: '#c49a6c',
  },
  {
    name: 'Goku',
    label: 'Trainer',
    color: '#ff8c00',
    seatX: 490, seatY: 280,
    deskX: 460, deskY: 100, deskW: 0, deskH: 0,
    features: [],
    emoji: '⚡',
  },
];

// ===== LAYOUT CONSTANTS =====
// SVG viewBox: 0 0 860 580
// LEFT HALF (x: 0-430) = WORK ZONE
// RIGHT HALF (x: 430-860) = LOUNGE ZONE

const DOOR = { x: 214, y: 558 };
const PX = 3;
const CHAR_W = 14 * PX;
const CHAR_H = 22 * PX;

// Work zone agents — โต๊ะ 2 แถว facing กัน
// แถวบน: Eve (บนซ้าย) + Dexter (บนขวา) หันลง (seatY > deskY)
// แถวล่าง: Sherlock (ล่างซ้าย) + Bluma (ล่างขวา) หันขึ้น (seatY < deskY)

// Lounge seats — ที่นั่งเมื่อ standby
const LOUNGE_SEATS = [
  { cx: 540, by: 440 },  // โซฟาแนวนอน ซ้าย (Shelby)
  { cx: 650, by: 440 },  // โซฟาแนวนอน ขวา (Monalisa)
  { cx: 495, by: 320 },  // เก้าอี้ 1 (Goku)
  { cx: 590, by: 310 },  // เก้าอี้ 2
  { cx: 755, by: 380 },  // โซฟาแนวตั้ง
  { cx: 595, by: 440 },  // โซฟาแนวนอน กลาง
];

function Agent({
  cx,
  bottomY,
  color,
  status,
  name,
  isWalking,
  isMini,
  gender,
  hairColor,
  dressColor,
  agentSkin,
}: {
  cx: number;
  bottomY: number;
  color: string;
  status: AgentStatus;
  name: string;
  isWalking: boolean;
  isMini?: boolean;
  gender?: 'male' | 'female';
  hairColor?: string;
  dressColor?: string;
  agentSkin?: string;
}) {
  const S = isMini ? 2 : PX;
  const w = 14 * S;
  const h = 22 * S;
  const x = cx - w / 2;
  const y = bottomY - h;
  const skin = agentSkin || '#ffd5b8';
  const isFemale = gender === 'female';

  const isSherlock = name === 'Sherlock';
  const isMonalisa = name === 'Monalisa';
  const isShelby = name === 'Shelby';

  return (
    <g className={isWalking ? 'pixel-walk' : status === 'working' ? 'pixel-typing' : 'pixel-idle'}>
      <ellipse cx={cx} cy={bottomY - h / 2} rx={w * 0.8} ry={h * 0.55} fill={color} opacity={0.12} filter="url(#glow)" />
      <ellipse cx={cx} cy={bottomY + 2} rx={w * 0.4} ry={S * 1.5} fill="rgba(0,0,0,0.3)" />

      {/* Female long hair (rendered behind head) */}
      {isFemale && hairColor && (
        <rect x={x + 2 * S} y={y - 2 * S} width={10 * S} height={14 * S} fill={hairColor} opacity={0.9} />
      )}

      {/* Hair / Hat */}
      {!isSherlock ? (
        <>
          <rect x={x + 3 * S} y={y} width={8 * S} height={2 * S} fill={isMonalisa ? '#5b3b2b' : hairColor || (isFemale ? color : color)} />
          <rect x={x + 2 * S} y={y + S} width={10 * S} height={2 * S} fill={isMonalisa ? '#6a4330' : hairColor || color} />
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

      {/* Female dress / skirt */}
      {isFemale && dressColor && (
        <polygon
          points={`${x + 2 * S},${y + 16 * S} ${x + 12 * S},${y + 16 * S} ${x + 14 * S},${y + 22 * S} ${x},${y + 22 * S}`}
          fill={dressColor}
          opacity={0.9}
        />
      )}

      <rect x={x + 3 * S} y={y + 16 * S} width={3 * S} height={4 * S} fill={isFemale && dressColor ? dressColor : '#3d4450'} opacity={isFemale ? 0.5 : 1} className={isWalking ? 'pixel-leg-left' : ''} />
      <rect x={x + 8 * S} y={y + 16 * S} width={3 * S} height={4 * S} fill={isFemale && dressColor ? dressColor : '#3d4450'} opacity={isFemale ? 0.5 : 1} className={isWalking ? 'pixel-leg-right' : ''} />
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

export function PixelOffice({ compact = false }: { compact?: boolean } = {}) {
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
    const target = new Map<string, { cx: number; by: number }>();
    let loungeIdx = 0;
    AGENTS.forEach(agent => {
      const status = getStatus(agent.name);
      // Work agents: ถ้า standby ให้ไปนั่ง lounge seat ฝั่งขวา
      const isWorkAgent = ['Eve', 'Dexter', 'Sherlock', 'Bluma'].includes(agent.name);
      if (status === 'standby' && isWorkAgent) {
        target.set(agent.name, LOUNGE_SEATS[loungeIdx++ % LOUNGE_SEATS.length]);
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
    AGENTS.forEach(a => { init.set(a.name, { cx: DOOR.x, by: DOOR.y }); });
    setPositions(init);

    const target = getTargetPositions();
    const t0 = performance.now() + 300;
    const dur = 1800;

    const step = (now: number) => {
      const elapsed = now - t0;
      if (elapsed < 0) { requestAnimationFrame(step); return; }
      const p = Math.min(elapsed / dur, 1);
      const e = 1 - Math.pow(1 - p, 3);
      setPositions(prev => {
        const next = new Map(prev);
        AGENTS.forEach(a => {
          const current = prev.get(a.name) || { cx: DOOR.x, by: DOOR.y };
          const tgt = target.get(a.name) || { cx: a.seatX, by: a.seatY };
          next.set(a.name, {
            cx: current.cx + (tgt.cx - current.cx) * e,
            by: current.by + (tgt.by - current.by) * e,
          });
        });
        return next;
      });
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [agents, getTargetPositions]);

  useEffect(() => {
    if (!hasSubagents) { setSubWalking(false); return; }
    setSubWalking(true);
    setSubPos({ cx: DOOR.x, by: DOOR.y });
    const dexter = AGENTS.find(a => a.name === 'Dexter');
    if (!dexter) return;
    const tx = dexter.seatX + 10;
    const ty = dexter.seatY + 5;
    const t0 = performance.now() + 500;
    const dur = 2000;
    const step = (now: number) => {
      const elapsed = now - t0;
      if (elapsed < 0) { requestAnimationFrame(step); return; }
      const p = Math.min(elapsed / dur, 1);
      const e = 1 - Math.pow(1 - p, 3);
      setSubPos({ cx: DOOR.x + (tx - DOOR.x) * e, by: DOOR.y + (ty - DOOR.y) * e });
      if (p < 1) requestAnimationFrame(step);
      else setSubWalking(false);
    };
    requestAnimationFrame(step);
  }, [hasSubagents]);

  const standbyCount = agents.filter(a => a.status === 'standby').length;

  return (
    <div className={`relative w-full h-full bg-mc-bg flex flex-col ${compact ? "min-h-0" : "min-h-screen"}`}>
      <div className={`flex-1 w-full ${compact ? "p-0" : "p-2"}`}>
        <svg viewBox="0 0 860 580" className="w-full h-full bg-[#0a0e14]" style={{ imageRendering: 'auto' }} preserveAspectRatio="xMidYMid slice">
          <defs>
            <pattern id="floorL" width="40" height="40" patternUnits="userSpaceOnUse">
              <rect width="40" height="40" fill="#0d1117" />
              <rect x="0" y="0" width="20" height="20" fill="#0f1520" />
              <rect x="20" y="20" width="20" height="20" fill="#0f1520" />
            </pattern>
            <pattern id="floorR" width="40" height="40" patternUnits="userSpaceOnUse">
              <rect width="40" height="40" fill="#0d0d1a" />
              <rect x="0" y="0" width="20" height="20" fill="#0f0f22" />
              <rect x="20" y="20" width="20" height="20" fill="#0f0f22" />
            </pattern>
            <filter id="glow"><feGaussianBlur stdDeviation="3" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
            <linearGradient id="tvGlow" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#4488ff" stopOpacity="0.5"/>
              <stop offset="100%" stopColor="#0033cc" stopOpacity="0.1"/>
            </linearGradient>
          </defs>

          {/* พื้น 2 โซน */}
          <rect x={0} y={0} width={430} height={580} fill="url(#floorL)" />
          <rect x={430} y={0} width={430} height={580} fill="url(#floorR)" />

          {/* ขอบห้อง */}
          <rect width="860" height="5" fill="#21262d" />
          <rect width="5" height="580" fill="#21262d" />
          <rect x="855" width="5" height="580" fill="#21262d" />
          <rect y="575" width="860" height="5" fill="#21262d" />

          {/* Divider กลาง */}
          <rect x={428} y={0} width={4} height={560} fill="#21262d" />
          <rect x={428} y={0} width={4} height={560} fill="#58a6ff" opacity={0.15} />

          {/* Zone Labels */}
          <text x={214} y={40} textAnchor="middle" fill="#3a4a3a" fontSize={9} fontFamily="monospace" letterSpacing={3} fontWeight="bold">WORK ZONE</text>
          <text x={644} y={40} textAnchor="middle" fill="#3a3a4a" fontSize={9} fontFamily="monospace" letterSpacing={3} fontWeight="bold">LOUNGE ZONE</text>

          {/* Header sign */}
          <rect x={330} y={8} width={200} height={24} rx={4} fill="#161b22" stroke="#58a6ff" strokeWidth={1}/>
          <text x={430} y={25} textAnchor="middle" fill="#58a6ff" fontSize={11} fontFamily="monospace" fontWeight="bold" filter="url(#glow)">MAYAKATI HQ</text>

          {/* ไฟ ceiling */}
          {[110, 320, 540, 750].map((lx, i) => (
            <g key={`lamp${i}`}>
              <rect x={lx-2} y={5} width={4} height={15} fill="#30363d" />
              <ellipse cx={lx} cy={22} rx={40} ry={14} fill={i < 2 ? "#58a6ff" : "#a371f7"} opacity={0.04}/>
            </g>
          ))}

          {/* ===== WORK ZONE (ซ้าย x:0-430) ===== */}

          {/* ผนังด้านบนซ้าย — แขวนรูปภาพ/กระดาน */}
          <rect x={20} y={60} width={80} height={50} rx={3} fill="#161b22" stroke="#30363d" strokeWidth={1}/>
          <text x={60} y={82} textAnchor="middle" fill="#3fb950" fontSize={6} fontFamily="monospace">SPRINT</text>
          <rect x={25} y={85} width={70} height={3} rx={1} fill="#3fb950" opacity={0.6}/>
          <rect x={25} y={92} width={50} height={3} rx={1} fill="#3fb950" opacity={0.3}/>
          <rect x={25} y={99} width={60} height={3} rx={1} fill="#f85149" opacity={0.4}/>

          <rect x={120} y={60} width={60} height={50} rx={3} fill="#161b22" stroke="#30363d" strokeWidth={1}/>
          <text x={150} y={80} textAnchor="middle" fill="#d29922" fontSize={6} fontFamily="monospace">Q2 OKR</text>
          <rect x={125} y={85} width={50} height={3} rx={1} fill="#d29922" opacity={0.5}/>
          <rect x={125} y={92} width={35} height={3} rx={1} fill="#d29922" opacity={0.3}/>

          {/* ต้นไม้มุมซ้าย */}
          <rect x={12} y={480} width={12} height={24} rx={2} fill="#5a3825"/>
          <circle cx={18} cy={472} r={12} fill="#2d5a27"/>
          <circle cx={13} cy={466} r={8} fill="#3fb950" opacity={0.6}/>
          <circle cx={24} cy={464} r={9} fill="#2d5a27"/>

          {/* Desk row ===== */}
          {AGENTS.map(a => a.deskW > 0 && (
            <Desk key={`d-${a.name}`} agent={a} status={getStatus(a.name)} />
          ))}

          {/* ===== LOUNGE ZONE (ขวา x:430-860) ===== */}

          {/* TV ผนังขวาบน */}
          <rect x={800} y={100} width={52} height={85} rx={4} fill="#0d0d0d" stroke="#333" strokeWidth={2}/>
          <rect x={805} y={105} width={42} height={68} rx={2} fill="#050518"/>
          <rect x={805} y={105} width={42} height={68} rx={2} fill="url(#tvGlow)" opacity={0.8}/>
          <rect x={815} y={175} width={22} height={10} fill="#222"/>
          {/* TV glow on wall */}
          <ellipse cx={824} cy={140} rx={35} ry={25} fill="#4488ff" opacity={0.05}/>
          {/* TV content lines */}
          <rect x={809} y={112} width={10} height={2} rx={1} fill="#58a6ff" opacity={0.6}/>
          <rect x={809} y={117} width={30} height={2} rx={1} fill="#58a6ff" opacity={0.3}/>
          <rect x={809} y={122} width={20} height={2} rx={1} fill="#39d353" opacity={0.4}/>

          {/* ต้นไม้มุมขวา */}
          <rect x={836} y={480} width={12} height={24} rx={2} fill="#5a3825"/>
          <circle cx={842} cy={472} r={12} fill="#2d5a27"/>
          <circle cx={837} cy={466} r={8} fill="#3fb950" opacity={0.6}/>
          <circle cx={848} cy={464} r={9} fill="#2d5a27"/>

          {/* พรม */}
          <ellipse cx={640} cy={410} rx={190} ry={100} fill="#14142a" opacity={0.8}/>
          <ellipse cx={640} cy={410} rx={175} ry={86} fill="none" stroke="#2a2a4a" strokeWidth={2}/>

          {/* โซฟา L-shape แนวนอน (bottom) */}
          {/* พนักพิงหลัง */}
          <rect x={472} y={398} width={295} height={18} rx={4} fill="#1a1228"/>
          {/* เบาะ */}
          <rect x={472} y={413} width={295} height={65} rx={8} fill="#2a1f3d"/>
          {/* เบาะนั่ง texture */}
          <rect x={476} y={417} width={287} height={40} rx={5} fill="#3d2d5a"/>
          {/* เส้นแบ่งเบาะ */}
          <rect x={570} y={417} width={2} height={40} fill="#2a1f3d" opacity={0.5}/>
          <rect x={668} y={417} width={2} height={40} fill="#2a1f3d" opacity={0.5}/>

          {/* โซฟา L-shape แนวตั้ง (right arm) */}
          <rect x={720} y={280} width={18} height={200} rx={4} fill="#1a1228"/>
          <rect x={735} y={280} width={60} height={200} rx={8} fill="#2a1f3d"/>
          <rect x={738} y={284} width={40} height={192} rx={5} fill="#3d2d5a"/>
          {/* เส้นแบ่งเบาะแนวตั้ง */}
          <rect x={738} y={380} width={40} height={2} fill="#2a1f3d" opacity={0.5}/>

          {/* เก้าอี้ 1 (สำหรับ Goku) */}
          <rect x={460} y={298} width={55} height={55} rx={6} fill="#1e2d1e"/>
          <rect x={460} y={288} width={55} height={14} rx={5} fill="#162416"/>
          <rect x={463} y={302} width={49} height={40} rx={4} fill="#253525"/>

          {/* เก้าอี้ 2 (ว่าง) */}
          <rect x={580} y={278} width={55} height={55} rx={6} fill="#1e2d1e"/>
          <rect x={580} y={268} width={55} height={14} rx={5} fill="#162416"/>
          <rect x={583} y={282} width={49} height={40} rx={4} fill="#253525"/>

          {/* โต๊ะกลาง coffee table */}
          <rect x={590} y={368} width={90} height={35} rx={4} fill="#1e1e2e" stroke="#2a2a4a" strokeWidth={1}/>
          <rect x={595} y={373} width={80} height={25} rx={2} fill="#252535"/>
          {/* ของบนโต๊ะ */}
          <circle cx={615} cy={385} r={4} fill="#3d3d5a"/>
          <rect x={625} y={378} width={20} height={14} rx={2} fill="#2d4a2d" opacity={0.8}/>

          {/* Entrance ประตู */}
          <rect x={DOOR.x - 24} y={540} width={56} height={38} rx={3} fill="#1e2d22" stroke="#3fb950" strokeWidth={1}/>
          <rect x={DOOR.x - 19} y={545} width={46} height={31} rx={2} fill="#0d1a10"/>
          <circle cx={DOOR.x + 18} cy={560} r={2.5} fill="#d4af37"/>
          <text x={DOOR.x} y={538} textAnchor="middle" fill="#3fb950" fontSize={7} fontFamily="monospace" opacity={0.7}>ENTRANCE</text>

          {/* Render agents */}
          {AGENTS.map(a => {
            const pos = positions.get(a.name);
            if (!pos) return null;
            return (
              <Agent
                key={a.name}
                cx={pos.cx}
                bottomY={pos.by}
                color={a.color}
                status={getStatus(a.name)}
                name={a.name}
                isWalking={walking.has(a.name)}
                gender={a.gender}
                hairColor={a.hairColor}
                dressColor={a.dressColor}
                agentSkin={a.skin}
              />
            );
          })}

          {/* Subagent indicator */}
          {hasSubagents && (
            <Agent cx={subPos.cx} bottomY={subPos.by} color="#ff8c00" status="working" name="?" isWalking={subWalking} />
          )}

          {/* Status bar */}
          <rect x={6} y={550} width={200} height={22} rx={3} fill="#161b22" opacity={0.8}/>
          <text x={12} y={565} fill="#8b949e" fontSize={7} fontFamily="monospace">
            👥 {agents.filter(a => a.status === 'working').length} working  😴 {standbyCount} standby  Auto-refresh: 10s
          </text>
        </svg>
      </div>
    </div>
  );
}
