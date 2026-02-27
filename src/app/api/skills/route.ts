import { NextResponse } from 'next/server';
import { readFileSync, existsSync } from 'fs';

export const dynamic = 'force-dynamic';

const OPENCLAW_JSON = '/Users/nithis4th/.openclaw/openclaw.json';

const AGENT_META: Record<string, { label: string; emoji: string }> = {
  main:     { label: 'Eve',      emoji: '🦋' },
  dexter:   { label: 'Dexter',   emoji: '🤖' },
  sherlock: { label: 'Sherlock', emoji: '🔍' },
  shelby:   { label: 'Shelby',   emoji: '💼' },
  bluma:    { label: 'Bluma',    emoji: '🛡️' },
  goku:     { label: 'Goku',     emoji: '⚡' },
  monalisa: { label: 'Monalisa', emoji: '🎨' },
};

// GET /api/skills
export async function GET() {
  try {
    if (!existsSync(OPENCLAW_JSON)) {
      return NextResponse.json({ error: 'openclaw.json not found' }, { status: 404 });
    }

    const raw = readFileSync(OPENCLAW_JSON, 'utf-8');
    const config = JSON.parse(raw);
    const agentsConfig = config.agents || {};

    const result = Object.entries(agentsConfig).map(([agentId, agentData]) => {
      const data = agentData as { skills?: Record<string, unknown> | string[] };
      let skills: string[] = [];

      if (Array.isArray(data.skills)) {
        skills = data.skills.map(String);
      } else if (data.skills && typeof data.skills === 'object') {
        skills = Object.keys(data.skills);
      }

      const meta = AGENT_META[agentId] || { label: agentId, emoji: '🤖' };

      return {
        agentId,
        label: meta.label,
        emoji: meta.emoji,
        skills: skills.sort(),
      };
    });

    // Sort: known agents first in defined order
    const ORDER = ['main', 'dexter', 'sherlock', 'shelby', 'bluma', 'goku', 'monalisa'];
    result.sort((a, b) => {
      const ai = ORDER.indexOf(a.agentId);
      const bi = ORDER.indexOf(b.agentId);
      if (ai >= 0 && bi >= 0) return ai - bi;
      if (ai >= 0) return -1;
      if (bi >= 0) return 1;
      return a.agentId.localeCompare(b.agentId);
    });

    return NextResponse.json(result);
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error }, { status: 500 });
  }
}
