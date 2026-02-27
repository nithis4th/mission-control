import { NextRequest, NextResponse } from 'next/server';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

const SOUL_PATHS: Record<string, string> = {
  main:     '/Users/nithis4th/.openclaw/workspace/SOUL.md',
  dexter:   '/Users/nithis4th/.openclaw/workspace-dexter/SOUL.md',
  bluma:    '/Users/nithis4th/.openclaw/workspace-bluma/SOUL.md',
  sherlock: '/Users/nithis4th/.openclaw/workspace-sherlock/SOUL.md',
  shelby:   '/Users/nithis4th/.openclaw/workspace-shelby/SOUL.md',
  goku:     '/Users/nithis4th/.openclaw/workspace-goku/SOUL.md',
  monalisa: '/Users/nithis4th/.openclaw/workspace-monalisa/SOUL.md',
};

// GET /api/soul?agent=<id>
export async function GET(request: NextRequest) {
  const agentId = request.nextUrl.searchParams.get('agent') || 'main';
  const soulPath = SOUL_PATHS[agentId];

  if (!soulPath) {
    return NextResponse.json({ error: `Unknown agent: ${agentId}` }, { status: 400 });
  }

  try {
    if (!existsSync(soulPath)) {
      return NextResponse.json({ agent: agentId, content: '', exists: false });
    }
    const content = readFileSync(soulPath, 'utf-8');
    return NextResponse.json({ agent: agentId, content, exists: true, path: soulPath });
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Failed to read SOUL.md';
    return NextResponse.json({ error }, { status: 500 });
  }
}

// POST /api/soul
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { agent, content } = body;

    if (!agent || content === undefined) {
      return NextResponse.json({ error: 'agent and content are required' }, { status: 400 });
    }

    const soulPath = SOUL_PATHS[agent];
    if (!soulPath) {
      return NextResponse.json({ error: `Unknown agent: ${agent}` }, { status: 400 });
    }

    // Ensure directory exists
    const dir = path.dirname(soulPath);
    const { mkdirSync } = await import('fs');
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    writeFileSync(soulPath, content, 'utf-8');
    return NextResponse.json({ ok: true, agent, path: soulPath });
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Failed to write SOUL.md';
    return NextResponse.json({ error }, { status: 500 });
  }
}
