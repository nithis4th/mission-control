'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { AgentStatus } from '@/lib/types';

// ─── Data types ───────────────────────────────────────────────────────────────

interface AgentData {
  id: string;
  name: string;
  status: AgentStatus;
  avatar_emoji: string;
  role: string;
}

interface ZoneConfig {
  id: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  icon: string;
}

interface AgentConfig {
  name: string;
  label: string;
  color: string;
  zone: string;          // zone id when working
  seatX: number;         // position inside zone (relative offset from zone origin)
  seatY: number;
  features: string[];
  emoji: string;
  gender?: 'male' | 'female';
  hairColor?: string;
  dressColor?: string;
  skin?: string;
}

// ─── Layout constants ─────────────────────────────────────────────────────────

const SVG_W = 960;
const SVG_H = 600;
const PX = 3;
const DOOR = { x: 480, y: 578 };

// ─── Role zones ── 7 distinct zones + 1 lounge ─────────────────────────────

const ZONES: ZoneConfig[] = [
  // Top row (3 zones)
  { id: 'app-factory',       label: 'App Factory',        x: 10,  y: 50,  w: 230, h: 200, color: '#58a6ff', icon: '🏭' },
  { id: 'qa-lab',            label: 'QA/Security Lab',    x: 250, y: 50,  w: 230, h: 200, color: '#f85149', icon: '🛡️' },
  { id: 'command-desk',      label: 'Command Desk',       x: 490, y: 50,  w: 230, h: 200, color: '#a371f7', icon: '🧠' },
  // Bottom row (4 zones)
  { id: 'strategy-studio',   label: 'Strategy Studio',    x: 10,  y: 270, w: 225, h: 190, color: '#d29922', icon: '📊' },
  { id: 'investigation-desk',label: 'Investigation Desk', x: 245, y: 270, w: 225, h: 190, color: '#3fb950', icon: '🔍' },
  { id: 'sprint-bay',        label: 'Mini Gym',           x: 480, y: 270, w: 225, h: 190, color: '#ff8c00', icon: '⚡' },
  { id: 'creative-lab',      label: 'Creative Lab',       x: 730, y: 50,  w: 220, h: 200, color: '#db61a2', icon: '🎨' },
  // Lounge
  { id: 'lounge',            label: 'Lounge',             x: 730, y: 270, w: 220, h: 190, color: '#8b949e', icon: '☕' },
];

const ZONE_MAP = new Map(ZONES.map(z => [z.id, z]));

// ─── Agent configs with role zone assignments ─────────────────────────────────

const AGENTS: AgentConfig[] = [
  {
    name: 'Dexter', label: 'CTO', color: '#58a6ff',
    zone: 'app-factory', seatX: 115, seatY: 150,
    features: ['multi-monitor'], emoji: '🤖',
  },
  {
    name: 'Bluma', label: 'CISO', color: '#f85149',
    zone: 'qa-lab', seatX: 115, seatY: 150,
    features: ['security-monitor'], emoji: '🛡️',
  },
  {
    name: 'Eve', label: 'COO', color: '#a371f7',
    zone: 'command-desk', seatX: 115, seatY: 150,
    features: ['big-desk'], emoji: '🧠',
    gender: 'female', hairColor: '#c8962a', dressColor: '#6b35a8',
  },
  {
    name: 'Shelby', label: 'Strategist', color: '#d29922',
    zone: 'strategy-studio', seatX: 112, seatY: 140,
    features: ['charts'], emoji: '📊',
    gender: 'female', hairColor: '#5c3317', dressColor: '#8b1a1a',
  },
  {
    name: 'Sherlock', label: 'CMO', color: '#3fb950',
    zone: 'investigation-desk', seatX: 112, seatY: 140,
    features: ['whiteboard'], emoji: '🔍',
  },
  {
    name: 'Goku', label: 'Trainer', color: '#ff8c00',
    zone: 'sprint-bay', seatX: 112, seatY: 140,
    features: [], emoji: '⚡',
  },
  {
    name: 'Monalisa', label: 'Artist', color: '#db61a2',
    zone: 'creative-lab', seatX: 110, seatY: 150,
    features: ['art-supplies'], emoji: '🎨',
    gender: 'female', hairColor: '#1a0a00', dressColor: '#1a4a2a', skin: '#c49a6c',
  },
];

// Lounge seat positions (offsets within lounge zone)
const LOUNGE_OFFSETS = [
  { dx: 55,  dy: 80 },
  { dx: 140, dy: 80 },
  { dx: 55,  dy: 140 },
  { dx: 140, dy: 140 },
  { dx: 95,  dy: 110 },
  { dx: 170, dy: 110 },
  { dx: 95,  dy: 155 },
];

// ─── Pixel character renderer ─────────────────────────────────────────────────

function PixelAgent({
  cx, bottomY, color, status, name, isWalking, isMini,
  gender, hairColor, dressColor, agentSkin,
}: {
  cx: number; bottomY: number; color: string; status: AgentStatus;
  name: string; isWalking: boolean; isMini?: boolean;
  gender?: 'male' | 'female'; hairColor?: string; dressColor?: string; agentSkin?: string;
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
      {/* Glow under character */}
      <ellipse cx={cx} cy={bottomY - h / 2} rx={w * 0.8} ry={h * 0.55} fill={color} opacity={0.12} filter="url(#glow)" />
      <ellipse cx={cx} cy={bottomY + 2} rx={w * 0.4} ry={S * 1.5} fill="rgba(0,0,0,0.3)" />

      {/* Female long hair behind head */}
      {isFemale && hairColor && (
        <rect x={x + 2 * S} y={y - 2 * S} width={10 * S} height={14 * S} fill={hairColor} opacity={0.9} />
      )}

      {/* Hair / Hat */}
      {!isSherlock ? (
        <>
          <rect x={x + 3 * S} y={y} width={8 * S} height={2 * S} fill={isMonalisa ? '#5b3b2b' : hairColor || color} />
          <rect x={x + 2 * S} y={y + S} width={10 * S} height={2 * S} fill={isMonalisa ? '#6a4330' : hairColor || color} />
        </>
      ) : (
        <>
          <rect x={x + 1 * S} y={y + 1 * S} width={12 * S} height={2 * S} fill="#3d2c1e" />
          <rect x={x + 3 * S} y={y - S} width={8 * S} height={3 * S} fill="#4a3424" />
          <rect x={x + 4 * S} y={y - 2 * S} width={6 * S} height={S} fill="#6e5139" />
        </>
      )}

      {/* Head */}
      <rect x={x + 3 * S} y={y + 2 * S} width={8 * S} height={7 * S} fill={skin} />
      {/* Eyes */}
      <rect x={x + 4 * S} y={y + 5 * S} width={2 * S} height={2 * S} fill="#222" className={status === 'working' ? 'pixel-blink' : ''} />
      <rect x={x + 8 * S} y={y + 5 * S} width={2 * S} height={2 * S} fill="#222" className={status === 'working' ? 'pixel-blink' : ''} />
      <rect x={x + 4 * S} y={y + 5 * S} width={S} height={S} fill="rgba(255,255,255,0.5)" />
      <rect x={x + 8 * S} y={y + 5 * S} width={S} height={S} fill="rgba(255,255,255,0.5)" />
      {/* Mouth */}
      {status === 'working' ? (
        <rect x={x + 5 * S} y={y + 7.5 * S} width={4 * S} height={S} fill="#d4937a" rx={S * 0.3} />
      ) : (
        <rect x={x + 6 * S} y={y + 7.5 * S} width={2 * S} height={S * 0.6} fill="#c9846b" />
      )}

      {/* Body */}
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

      {/* Arms */}
      <rect x={x} y={y + 10 * S} width={2 * S} height={5 * S}
        fill={isSherlock ? '#5b4635' : isShelby ? '#2f5fa9' : color}
        className={status === 'working' ? 'pixel-arm-left' : ''} />
      <rect x={x + 12 * S} y={y + 10 * S} width={2 * S} height={5 * S}
        fill={isSherlock ? '#5b4635' : isShelby ? '#2f5fa9' : color}
        className={status === 'working' ? 'pixel-arm-right' : ''} />
      <rect x={x} y={y + 14 * S} width={2 * S} height={2 * S} fill={skin}
        className={status === 'working' ? 'pixel-arm-left' : ''} />
      <rect x={x + 12 * S} y={y + 14 * S} width={2 * S} height={2 * S} fill={skin}
        className={status === 'working' ? 'pixel-arm-right' : ''} />

      {/* Female dress */}
      {isFemale && dressColor && (
        <polygon
          points={`${x + 2 * S},${y + 16 * S} ${x + 12 * S},${y + 16 * S} ${x + 14 * S},${y + 22 * S} ${x},${y + 22 * S}`}
          fill={dressColor} opacity={0.9}
        />
      )}

      {/* Legs */}
      <rect x={x + 3 * S} y={y + 16 * S} width={3 * S} height={4 * S}
        fill={isFemale && dressColor ? dressColor : '#3d4450'}
        opacity={isFemale ? 0.5 : 1} className={isWalking ? 'pixel-leg-left' : ''} />
      <rect x={x + 8 * S} y={y + 16 * S} width={3 * S} height={4 * S}
        fill={isFemale && dressColor ? dressColor : '#3d4450'}
        opacity={isFemale ? 0.5 : 1} className={isWalking ? 'pixel-leg-right' : ''} />
      {/* Shoes */}
      <rect x={x + 2 * S} y={y + 20 * S} width={4 * S} height={2 * S} fill="#222" className={isWalking ? 'pixel-leg-left' : ''} />
      <rect x={x + 8 * S} y={y + 20 * S} width={4 * S} height={2 * S} fill="#222" className={isWalking ? 'pixel-leg-right' : ''} />

      {/* Name tag */}
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

      {/* Status dot */}
      <circle cx={cx + w / 2 + 4} cy={y + 4} r={4.5}
        fill={status === 'working' ? '#3fb950' : status === 'standby' ? '#d29922' : '#f85149'}
        className={status === 'working' ? 'pixel-pulse' : ''} />
      {status === 'working' && (
        <circle cx={cx + w / 2 + 4} cy={y + 4} r={8} fill="none" stroke="#3fb950" strokeWidth={1} opacity={0.3} className="pixel-pulse" />
      )}
    </g>
  );
}

// ─── Zone furniture renderer ──────────────────────────────────────────────────

function ZoneFurniture({ zone, agentStatus }: { zone: ZoneConfig; agentStatus: AgentStatus }) {
  const { x, y, w, h, id, color } = zone;
  const isActive = agentStatus === 'working';

  switch (id) {
    case 'app-factory': {
      // Dexter's zone: 3 monitors, server rack
      const deskX = x + 30;
      const deskY = y + 90;
      return (
        <g>
          {/* Desk */}
          <rect x={deskX} y={deskY} width={170} height={40} rx={3} fill="#3d3122" stroke="#5a4a32" strokeWidth={2} />
          <rect x={deskX + 5} y={deskY + 40} width={4} height={8} fill="#3d3122" />
          <rect x={deskX + 161} y={deskY + 40} width={4} height={8} fill="#3d3122" />
          {/* 3 monitors */}
          {[0, 38, 76].map((off, i) => (
            <g key={i}>
              <rect x={deskX + 12 + off} y={deskY - 28} width={32} height={26} rx={2} fill="#161b22" stroke="#30363d" strokeWidth={1} />
              <rect x={deskX + 14 + off} y={deskY - 26} width={28} height={20} fill={isActive ? '#0d3320' : '#0d1117'} className={isActive ? 'pixel-screen-glow' : ''} />
              {isActive && (
                <>
                  <rect x={deskX + 16 + off} y={deskY - 24} width={16} height={1.5} fill="#3fb950" opacity={0.6} className="pixel-code-line" />
                  <rect x={deskX + 16 + off} y={deskY - 21} width={10} height={1.5} fill="#58a6ff" opacity={0.4} className="pixel-code-line-2" />
                  <rect x={deskX + 16 + off} y={deskY - 18} width={20} height={1.5} fill="#3fb950" opacity={0.5} className="pixel-code-line-3" />
                </>
              )}
              <rect x={deskX + 26 + off} y={deskY - 2} width={4} height={4} fill="#30363d" />
            </g>
          ))}
          {/* Server rack */}
          <rect x={x + w - 35} y={y + 60} width={22} height={50} rx={2} fill="#161b22" stroke="#30363d" strokeWidth={1} />
          {[0, 10, 20, 30].map((off, i) => (
            <rect key={i} x={x + w - 32} y={y + 65 + off} width={16} height={6} rx={1} fill="#0d1117" />
          ))}
          {isActive && (
            <>
              <circle cx={x + w - 18} cy={y + 68} r={1.5} fill="#3fb950" className="pixel-pulse" />
              <circle cx={x + w - 18} cy={y + 78} r={1.5} fill="#58a6ff" className="pixel-pulse" />
            </>
          )}
          {/* Chair */}
          <rect x={x + 95} y={y + 145} width={28} height={22} rx={5} fill="#21262d" stroke="#30363d" strokeWidth={1} />
          <rect x={x + 97} y={y + 135} width={24} height={12} rx={4} fill="#282e36" stroke="#30363d" strokeWidth={1} />
        </g>
      );
    }

    case 'qa-lab': {
      // Bluma's zone: security monitors, shield logo
      const deskX = x + 30;
      const deskY = y + 90;
      return (
        <g>
          <rect x={deskX} y={deskY} width={170} height={40} rx={3} fill="#3d3122" stroke="#5a4a32" strokeWidth={2} />
          <rect x={deskX + 5} y={deskY + 40} width={4} height={8} fill="#3d3122" />
          <rect x={deskX + 161} y={deskY + 40} width={4} height={8} fill="#3d3122" />
          {/* 2 monitors */}
          {[0, 55].map((off, i) => (
            <g key={i}>
              <rect x={deskX + 20 + off} y={deskY - 28} width={40} height={26} rx={2} fill="#161b22" stroke={isActive ? '#f85149' : '#30363d'} strokeWidth={1} />
              <rect x={deskX + 22 + off} y={deskY - 26} width={36} height={20} fill={isActive ? '#1a0808' : '#0d1117'} className={isActive ? 'zone-screen-alert' : ''} />
              {isActive && (
                <>
                  <circle cx={deskX + 40 + off} cy={deskY - 16} r={6} fill="none" stroke="#f85149" strokeWidth={0.8} opacity={0.6} />
                  <text x={deskX + 40 + off} y={deskY - 10} textAnchor="middle" fill="#f85149" fontSize={5} fontFamily="monospace" className="pixel-blink">SCAN</text>
                </>
              )}
              <rect x={deskX + 38 + off} y={deskY - 2} width={4} height={4} fill="#30363d" />
            </g>
          ))}
          {/* Shield emblem on wall */}
          <path d={`M${x + w - 30},${y + 25} l10,-12 l10,12 l0,14 l-10,8 l-10,-8 z`} fill="none" stroke="#f85149" strokeWidth={1.5} opacity={0.5} />
          {/* Chair */}
          <rect x={x + 95} y={y + 145} width={28} height={22} rx={5} fill="#21262d" stroke="#30363d" strokeWidth={1} />
          <rect x={x + 97} y={y + 135} width={24} height={12} rx={4} fill="#282e36" stroke="#30363d" strokeWidth={1} />
        </g>
      );
    }

    case 'command-desk': {
      // Eve's zone: large central desk, nameplate, big monitor
      const deskX = x + 25;
      const deskY = y + 90;
      return (
        <g>
          <rect x={deskX} y={deskY} width={180} height={45} rx={4} fill="#3d3122" stroke="#5a4a32" strokeWidth={2} />
          <rect x={deskX + 5} y={deskY + 45} width={4} height={8} fill="#3d3122" />
          <rect x={deskX + 171} y={deskY + 45} width={4} height={8} fill="#3d3122" />
          {/* Nameplate */}
          <rect x={deskX + 10} y={deskY + 6} width={40} height={14} rx={1} fill="#d4af37" />
          <text x={deskX + 30} y={deskY + 16} textAnchor="middle" fill="#1a1a1a" fontSize={7} fontFamily="monospace" fontWeight="bold">EVE</text>
          {/* Large monitor */}
          <rect x={deskX + 55} y={deskY - 32} width={70} height={30} rx={2} fill="#161b22" stroke="#30363d" strokeWidth={1} />
          <rect x={deskX + 57} y={deskY - 30} width={66} height={24} fill={isActive ? '#0d1830' : '#0d1117'} className={isActive ? 'pixel-screen-glow' : ''} />
          {isActive && (
            <>
              <rect x={deskX + 62} y={deskY - 27} width={30} height={2} fill="#a371f7" opacity={0.6} className="pixel-code-line" />
              <rect x={deskX + 62} y={deskY - 23} width={45} height={2} fill="#58a6ff" opacity={0.4} className="pixel-code-line-2" />
              <rect x={deskX + 62} y={deskY - 19} width={25} height={2} fill="#3fb950" opacity={0.5} className="pixel-code-line-3" />
            </>
          )}
          <rect x={deskX + 87} y={deskY - 2} width={6} height={4} fill="#30363d" />
          {/* Phone */}
          <rect x={deskX + 145} y={deskY + 6} width={20} height={14} rx={2} fill="#8b949e" />
          <rect x={deskX + 147} y={deskY + 8} width={16} height={8} rx={1} fill="#0d1117" />
          {/* Chair */}
          <rect x={x + 95} y={y + 150} width={30} height={24} rx={6} fill="#21262d" stroke="#30363d" strokeWidth={1} />
          <rect x={x + 97} y={y + 138} width={26} height={14} rx={5} fill="#282e36" stroke="#30363d" strokeWidth={1} />
        </g>
      );
    }

    case 'strategy-studio': {
      // Shelby's zone: whiteboard with charts, small desk
      const deskX = x + 25;
      const deskY = y + 80;
      return (
        <g>
          <rect x={deskX} y={deskY} width={150} height={35} rx={3} fill="#3d3122" stroke="#5a4a32" strokeWidth={2} />
          <rect x={deskX + 5} y={deskY + 35} width={4} height={8} fill="#3d3122" />
          <rect x={deskX + 141} y={deskY + 35} width={4} height={8} fill="#3d3122" />
          {/* Whiteboard on wall */}
          <rect x={x + 15} y={y + 18} width={80} height={50} rx={2} fill="#ececec" stroke="#ccc" strokeWidth={1} />
          <text x={x + 55} y={y + 34} textAnchor="middle" fill="#666" fontSize={6} fontFamily="monospace">STRATEGY</text>
          {/* Chart bars on whiteboard */}
          <rect x={x + 25} y={y + 50} width={8} height={12} fill="#d29922" opacity={0.7} />
          <rect x={x + 38} y={y + 44} width={8} height={18} fill="#3fb950" opacity={0.7} />
          <rect x={x + 51} y={y + 40} width={8} height={22} fill="#58a6ff" opacity={0.7} />
          <rect x={x + 64} y={y + 46} width={8} height={16} fill="#a371f7" opacity={0.7} />
          {/* Monitor */}
          <rect x={deskX + 40} y={deskY - 24} width={36} height={22} rx={2} fill="#161b22" stroke="#30363d" strokeWidth={1} />
          <rect x={deskX + 42} y={deskY - 22} width={32} height={16} fill={isActive ? '#1a1a08' : '#0d1117'} />
          {isActive && (
            <>
              <rect x={deskX + 48} y={deskY - 18} width={6} height={8} fill="#d29922" opacity={0.6} />
              <rect x={deskX + 56} y={deskY - 14} width={6} height={4} fill="#3fb950" opacity={0.6} />
              <rect x={deskX + 64} y={deskY - 20} width={6} height={10} fill="#58a6ff" opacity={0.6} />
            </>
          )}
          <rect x={deskX + 56} y={deskY - 2} width={4} height={4} fill="#30363d" />
          {/* Chair */}
          <rect x={x + 92} y={y + 130} width={28} height={22} rx={5} fill="#21262d" stroke="#30363d" strokeWidth={1} />
          <rect x={x + 94} y={y + 120} width={24} height={12} rx={4} fill="#282e36" stroke="#30363d" strokeWidth={1} />
        </g>
      );
    }

    case 'investigation-desk': {
      // Sherlock's zone: magnifying glass, evidence board, detective desk
      const deskX = x + 30;
      const deskY = y + 80;
      return (
        <g>
          <rect x={deskX} y={deskY} width={150} height={35} rx={3} fill="#3d3122" stroke="#5a4a32" strokeWidth={2} />
          <rect x={deskX + 5} y={deskY + 35} width={4} height={8} fill="#3d3122" />
          <rect x={deskX + 141} y={deskY + 35} width={4} height={8} fill="#3d3122" />
          {/* Evidence board */}
          <rect x={x + 20} y={y + 15} width={70} height={50} rx={2} fill="#2a1f10" stroke="#5a4a32" strokeWidth={1} />
          {/* Pinned notes */}
          <rect x={x + 25} y={y + 22} width={18} height={14} fill="#d29922" opacity={0.7} rx={1} />
          <rect x={x + 48} y={y + 20} width={18} height={14} fill="#f85149" opacity={0.7} rx={1} />
          <rect x={x + 30} y={y + 42} width={18} height={14} fill="#3fb950" opacity={0.7} rx={1} />
          <rect x={x + 55} y={y + 40} width={18} height={14} fill="#58a6ff" opacity={0.7} rx={1} />
          {/* Lines connecting notes */}
          <line x1={x + 34} y1={y + 36} x2={x + 57} y2={y + 27} stroke="#8b949e" strokeWidth={0.5} opacity={0.5} />
          <line x1={x + 66} y1={y + 34} x2={x + 57} y2={y + 40} stroke="#8b949e" strokeWidth={0.5} opacity={0.5} />
          {/* Monitor */}
          <rect x={deskX + 45} y={deskY - 24} width={36} height={22} rx={2} fill="#161b22" stroke="#30363d" strokeWidth={1} />
          <rect x={deskX + 47} y={deskY - 22} width={32} height={16} fill={isActive ? '#0d2010' : '#0d1117'} className={isActive ? 'pixel-screen-glow' : ''} />
          {isActive && (
            <>
              <rect x={deskX + 50} y={deskY - 20} width={18} height={1.5} fill="#3fb950" opacity={0.6} className="pixel-code-line" />
              <rect x={deskX + 50} y={deskY - 17} width={12} height={1.5} fill="#d29922" opacity={0.4} className="pixel-code-line-2" />
            </>
          )}
          <rect x={deskX + 61} y={deskY - 2} width={4} height={4} fill="#30363d" />
          {/* Magnifying glass on desk */}
          <circle cx={deskX + 20} cy={deskY + 12} r={8} fill="none" stroke="#8b949e" strokeWidth={1.5} />
          <line x1={deskX + 26} y1={deskY + 18} x2={deskX + 32} y2={deskY + 24} stroke="#8b949e" strokeWidth={2} />
          {/* Chair */}
          <rect x={x + 92} y={y + 130} width={28} height={22} rx={5} fill="#21262d" stroke="#30363d" strokeWidth={1} />
          <rect x={x + 94} y={y + 120} width={24} height={12} rx={4} fill="#282e36" stroke="#30363d" strokeWidth={1} />
        </g>
      );
    }

    case 'sprint-bay': {
      // Goku's zone: mini gym equipment
      return (
        <g>
          {/* Punching bag */}
          <rect x={x + 20} y={y + 15} width={2} height={20} fill="#5a4a32" />
          <ellipse cx={x + 21} cy={y + 45} rx={10} ry={16} fill="#8b1a1a" />
          <ellipse cx={x + 21} cy={y + 45} rx={8} ry={14} fill="#a52a2a" />
          {/* Barbell */}
          <rect x={x + 60} y={y + 140} width={80} height={4} rx={2} fill="#5a4a32" />
          <rect x={x + 55} y={y + 134} width={12} height={16} rx={2} fill="#3d3122" />
          <rect x={x + 133} y={y + 134} width={12} height={16} rx={2} fill="#3d3122" />
          {/* Timer / scoreboard */}
          <rect x={x + 130} y={y + 15} width={60} height={30} rx={3} fill="#161b22" stroke={isActive ? '#ff8c00' : '#30363d'} strokeWidth={1} />
          <text x={x + 160} y={y + 35} textAnchor="middle" fill={isActive ? '#ff8c00' : '#8b949e'} fontSize={12} fontFamily="monospace" fontWeight="bold" className={isActive ? 'pixel-typing-indicator' : ''}>
            {isActive ? 'GO!' : 'RDY'}
          </text>
          {/* Speed lines when active */}
          {isActive && (
            <g className="zone-speed-lines">
              <line x1={x + 50} y1={y + 85} x2={x + 80} y2={y + 85} stroke="#ff8c00" strokeWidth={1} opacity={0.4} />
              <line x1={x + 45} y1={y + 95} x2={x + 85} y2={y + 95} stroke="#ff8c00" strokeWidth={1} opacity={0.3} />
              <line x1={x + 55} y1={y + 105} x2={x + 75} y2={y + 105} stroke="#ff8c00" strokeWidth={1} opacity={0.2} />
            </g>
          )}
          {/* Floor mat */}
          <rect x={x + 50} y={y + 80} width={100} height={50} rx={4} fill="#1a2a1a" stroke="#2d4a2d" strokeWidth={1} />
        </g>
      );
    }

    case 'creative-lab': {
      // Monalisa's zone: easel, paint palette, art desk
      const deskX = x + 20;
      const deskY = y + 95;
      return (
        <g>
          <rect x={deskX} y={deskY} width={150} height={35} rx={3} fill="#3d3122" stroke="#5a4a32" strokeWidth={2} />
          <rect x={deskX + 5} y={deskY + 35} width={4} height={8} fill="#3d3122" />
          <rect x={deskX + 141} y={deskY + 35} width={4} height={8} fill="#3d3122" />
          {/* Easel */}
          <line x1={x + w - 50} y1={y + 30} x2={x + w - 60} y2={y + 100} stroke="#5a4a32" strokeWidth={2} />
          <line x1={x + w - 50} y1={y + 30} x2={x + w - 40} y2={y + 100} stroke="#5a4a32" strokeWidth={2} />
          <rect x={x + w - 70} y={y + 25} width={40} height={50} rx={2} fill="#ececec" stroke="#ccc" strokeWidth={1} />
          {/* Painting on easel */}
          <rect x={x + w - 67} y={y + 28} width={34} height={44} fill="#1a0a20" />
          <circle cx={x + w - 58} cy={y + 40} r={6} fill="#db61a2" opacity={0.7} />
          <rect x={x + w - 48} y={y + 50} width={14} height={14} fill="#a371f7" opacity={0.6} rx={1} />
          {/* Paint palette on desk */}
          <ellipse cx={deskX + 30} cy={deskY + 14} rx={16} ry={10} fill="#8B7355" />
          <circle cx={deskX + 22} cy={deskY + 11} r={3} fill="#ff6b6b" />
          <circle cx={deskX + 32} cy={deskY + 10} r={3} fill="#4ecdc4" />
          <circle cx={deskX + 26} cy={deskY + 18} r={3} fill="#ffe66d" />
          <circle cx={deskX + 36} cy={deskY + 16} r={3} fill="#a371f7" />
          {/* Monitor */}
          <rect x={deskX + 55} y={deskY - 26} width={36} height={24} rx={2} fill="#161b22" stroke="#30363d" strokeWidth={1} />
          <rect x={deskX + 57} y={deskY - 24} width={32} height={18} fill={isActive ? '#1a0818' : '#0d1117'} />
          {isActive && (
            <rect x={deskX + 62} y={deskY - 20} width={22} height={12} rx={2} fill="#db61a2" opacity={0.15} />
          )}
          <rect x={deskX + 71} y={deskY - 2} width={4} height={4} fill="#30363d" />
          {/* Chair */}
          <rect x={x + 90} y={y + 145} width={28} height={22} rx={5} fill="#21262d" stroke="#30363d" strokeWidth={1} />
          <rect x={x + 92} y={y + 135} width={24} height={12} rx={4} fill="#282e36" stroke="#30363d" strokeWidth={1} />
        </g>
      );
    }

    case 'lounge': {
      // Shared lounge: sofas, coffee table, plant
      return (
        <g>
          {/* Sofa (horizontal) */}
          <rect x={x + 15} y={y + 52} width={140} height={14} rx={4} fill="#1a1228" />
          <rect x={x + 15} y={y + 64} width={140} height={45} rx={6} fill="#2a1f3d" />
          <rect x={x + 19} y={y + 68} width={132} height={30} rx={4} fill="#3d2d5a" />
          <rect x={x + 85} y={y + 68} width={2} height={30} fill="#2a1f3d" opacity={0.5} />
          {/* Coffee table */}
          <rect x={x + 60} y={y + 120} width={70} height={30} rx={3} fill="#1e1e2e" stroke="#2a2a4a" strokeWidth={1} />
          <rect x={x + 64} y={y + 124} width={62} height={22} rx={2} fill="#252535" />
          {/* Coffee cup */}
          <circle cx={x + 80} cy={y + 135} r={4} fill="#3d3d5a" />
          <rect x={x + 100} y={y + 128} width={16} height={12} rx={2} fill="#2d4a2d" opacity={0.8} />
          {/* Floor chair */}
          <rect x={x + 30} y={y + 120} width={20} height={20} rx={4} fill="#1e2d1e" />
          <rect x={x + 150} y={y + 120} width={20} height={20} rx={4} fill="#1e2d1e" />
          {/* Plant */}
          <rect x={x + w - 28} y={y + h - 40} width={10} height={18} rx={2} fill="#5a3825" />
          <circle cx={x + w - 23} cy={y + h - 48} r={10} fill="#2d5a27" />
          <circle cx={x + w - 27} cy={y + h - 54} r={6} fill="#3fb950" opacity={0.6} />
        </g>
      );
    }

    default:
      return null;
  }
}

// ─── Zone border/label renderer ───────────────────────────────────────────────

function ZonePanel({ zone, isActive }: { zone: ZoneConfig; isActive: boolean }) {
  const { x, y, w, h, label, color, icon } = zone;

  return (
    <g>
      {/* Zone background */}
      <rect x={x} y={y} width={w} height={h} rx={6}
        fill={isActive ? `${color}08` : '#0a0e14'}
        stroke={isActive ? color : '#1a1f28'}
        strokeWidth={isActive ? 1.5 : 1}
        strokeDasharray={isActive ? 'none' : '4 2'}
        opacity={isActive ? 1 : 0.7}
      />

      {/* Active glow border */}
      {isActive && (
        <rect x={x} y={y} width={w} height={h} rx={6}
          fill="none" stroke={color} strokeWidth={1} opacity={0.15}
          className="zone-glow-border"
        />
      )}

      {/* Zone label badge */}
      <rect x={x + 6} y={y + 4} width={label.length * 7 + 26} height={16} rx={3}
        fill="rgba(13,17,23,0.92)" stroke={isActive ? color : '#30363d'} strokeWidth={1} />
      <text x={x + 22} y={y + 15} fill={isActive ? color : '#8b949e'} fontSize={8}
        fontFamily="'JetBrains Mono', monospace" fontWeight="bold">
        {icon} {label}
      </text>

      {/* Active indicator dot */}
      {isActive && (
        <circle cx={x + w - 12} cy={y + 12} r={3} fill={color} className="pixel-pulse" />
      )}
    </g>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function PixelOffice({ compact = false }: { compact?: boolean } = {}) {
  const [agents, setAgents] = useState<AgentData[]>([]);
  const [positions, setPositions] = useState<Map<string, { cx: number; by: number }>>(new Map());
  const [hasSubagents, setHasSubagents] = useState(false);
  const [subPos, setSubPos] = useState({ cx: DOOR.x, by: DOOR.y });
  const [subWalking, setSubWalking] = useState(false);
  const animStarted = useRef(false);

  const fetchAgents = useCallback(async () => {
    try {
      const res = await fetch('/api/agents');
      if (res.ok) setAgents(await res.json());
    } catch { /* silent */ }
  }, []);

  const fetchSubagents = useCallback(async () => {
    try {
      const res = await fetch('/api/openclaw/sessions?session_type=subagent&status=active');
      if (res.ok) {
        const sessions = await res.json();
        setHasSubagents(sessions.some((s: { label?: string }) => s.label?.includes('dexter')));
      }
    } catch { /* silent */ }
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

  // Compute absolute target positions
  const getTargetPositions = useCallback(() => {
    const target = new Map<string, { cx: number; by: number }>();
    const lounge = ZONE_MAP.get('lounge')!;
    let loungeIdx = 0;

    AGENTS.forEach(agent => {
      const status = getStatus(agent.name);
      if (status === 'working') {
        const zone = ZONE_MAP.get(agent.zone);
        if (zone) {
          target.set(agent.name, { cx: zone.x + agent.seatX, by: zone.y + agent.seatY });
        }
      } else {
        // standby / offline → lounge zone
        const off = LOUNGE_OFFSETS[loungeIdx++ % LOUNGE_OFFSETS.length];
        target.set(agent.name, { cx: lounge.x + off.dx, by: lounge.y + off.dy });
      }
    });
    return target;
  }, [getStatus]);

  // Walk-in animation
  useEffect(() => {
    if (agents.length === 0 || animStarted.current) return;
    animStarted.current = true;

    const init = new Map<string, { cx: number; by: number }>();
    AGENTS.forEach(a => init.set(a.name, { cx: DOOR.x, by: DOOR.y }));
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
          const tgt = target.get(a.name) || { cx: DOOR.x, by: DOOR.y };
          next.set(a.name, {
            cx: DOOR.x + (tgt.cx - DOOR.x) * e,
            by: DOOR.y + (tgt.by - DOOR.y) * e,
          });
        });
        return next;
      });
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [agents, getTargetPositions]);

  // Smooth status-change transitions (after initial walk-in)
  useEffect(() => {
    if (!animStarted.current || agents.length === 0) return;
    const target = getTargetPositions();
    const t0 = performance.now();
    const dur = 800;

    const step = (now: number) => {
      const elapsed = now - t0;
      const p = Math.min(elapsed / dur, 1);
      const e = 1 - Math.pow(1 - p, 3);
      setPositions(prev => {
        const next = new Map(prev);
        AGENTS.forEach(a => {
          const current = prev.get(a.name);
          const tgt = target.get(a.name);
          if (!current || !tgt) return;
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agents.map(a => `${a.name}:${a.status}`).join(',')]);

  // Subagent animation
  useEffect(() => {
    if (!hasSubagents) { setSubWalking(false); return; }
    setSubWalking(true);
    setSubPos({ cx: DOOR.x, by: DOOR.y });
    const dexter = AGENTS.find(a => a.name === 'Dexter');
    if (!dexter) return;
    const zone = ZONE_MAP.get(dexter.zone);
    if (!zone) return;
    const tx = zone.x + dexter.seatX + 15;
    const ty = zone.y + dexter.seatY + 5;
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

  const workingCount = agents.filter(a => a.status === 'working').length;
  const standbyCount = agents.filter(a => a.status === 'standby').length;

  return (
    <div className={`relative w-full h-full bg-mc-bg flex flex-col ${compact ? 'min-h-0' : 'min-h-screen'}`}>
      <div className={`flex-1 w-full ${compact ? 'p-0' : 'p-2'}`}>
        <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="w-full h-full bg-[#06080c]" style={{ imageRendering: 'auto' }} preserveAspectRatio="xMidYMid slice">
          <defs>
            <pattern id="floor16" width="32" height="32" patternUnits="userSpaceOnUse">
              <rect width="32" height="32" fill="#0a0e14" />
              <rect x="0" y="0" width="16" height="16" fill="#0c1018" />
              <rect x="16" y="16" width="16" height="16" fill="#0c1018" />
            </pattern>
            <filter id="glow">
              <feGaussianBlur stdDeviation="3" result="b" />
              <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>

          {/* Full floor */}
          <rect width={SVG_W} height={SVG_H} fill="url(#floor16)" />

          {/* Outer walls */}
          <rect width={SVG_W} height={4} fill="#21262d" />
          <rect width={4} height={SVG_H} fill="#21262d" />
          <rect x={SVG_W - 4} width={4} height={SVG_H} fill="#21262d" />
          <rect y={SVG_H - 4} width={SVG_W} height={4} fill="#21262d" />

          {/* Header sign */}
          <rect x={SVG_W / 2 - 100} y={8} width={200} height={24} rx={4} fill="#161b22" stroke="#58a6ff" strokeWidth={1} />
          <text x={SVG_W / 2} y={25} textAnchor="middle" fill="#58a6ff" fontSize={11} fontFamily="monospace" fontWeight="bold" filter="url(#glow)">
            MAYAKATI HQ ─ 16-BIT
          </text>

          {/* Ceiling lights */}
          {[120, 360, 600, 840].map((lx, i) => (
            <g key={`lamp${i}`}>
              <rect x={lx - 2} y={4} width={4} height={12} fill="#30363d" />
              <ellipse cx={lx} cy={18} rx={35} ry={10} fill={['#58a6ff', '#a371f7', '#3fb950', '#db61a2'][i]} opacity={0.04} />
            </g>
          ))}

          {/* ── Zone panels ─────────────────────────────── */}
          {ZONES.map(zone => {
            const agent = AGENTS.find(a => a.zone === zone.id);
            const isActive = agent ? getStatus(agent.name) === 'working' : false;
            // Lounge is active if any standby agent exists
            const isLoungeActive = zone.id === 'lounge' && standbyCount > 0;
            return (
              <ZonePanel key={zone.id} zone={zone} isActive={zone.id === 'lounge' ? isLoungeActive : isActive} />
            );
          })}

          {/* ── Zone furniture ──────────────────────────── */}
          {ZONES.map(zone => {
            const agent = AGENTS.find(a => a.zone === zone.id);
            const status = agent ? getStatus(agent.name) : 'offline';
            return <ZoneFurniture key={`f-${zone.id}`} zone={zone} agentStatus={status} />;
          })}

          {/* ── Entrance ───────────────────────────────── */}
          <rect x={DOOR.x - 24} y={SVG_H - 38} width={56} height={38} rx={3} fill="#1e2d22" stroke="#3fb950" strokeWidth={1} />
          <rect x={DOOR.x - 19} y={SVG_H - 33} width={46} height={31} rx={2} fill="#0d1a10" />
          <circle cx={DOOR.x + 18} cy={SVG_H - 18} r={2.5} fill="#d4af37" />
          <text x={DOOR.x} y={SVG_H - 40} textAnchor="middle" fill="#3fb950" fontSize={7} fontFamily="monospace" opacity={0.7}>ENTRANCE</text>

          {/* ── Render agents ──────────────────────────── */}
          {AGENTS.map(a => {
            const pos = positions.get(a.name);
            if (!pos) return null;
            return (
              <PixelAgent
                key={a.name}
                cx={pos.cx}
                bottomY={pos.by}
                color={a.color}
                status={getStatus(a.name)}
                name={a.name}
                isWalking={false}
                gender={a.gender}
                hairColor={a.hairColor}
                dressColor={a.dressColor}
                agentSkin={a.skin}
              />
            );
          })}

          {/* Sub-agent indicator */}
          {hasSubagents && (
            <PixelAgent cx={subPos.cx} bottomY={subPos.by} color="#ff8c00" status="working" name="?" isWalking={subWalking} isMini />
          )}

          {/* Status bar */}
          <rect x={6} y={SVG_H - 28} width={260} height={22} rx={3} fill="#161b22" opacity={0.85} />
          <text x={12} y={SVG_H - 13} fill="#8b949e" fontSize={7} fontFamily="monospace">
            🏢 {ZONES.length - 1} zones  |  🟢 {workingCount} working  😴 {standbyCount} standby  |  Auto: 10s
          </text>
        </svg>
      </div>
    </div>
  );
}
