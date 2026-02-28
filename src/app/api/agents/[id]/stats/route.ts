import { NextResponse } from 'next/server';
import { listSessions, type GatewaySession } from '@/lib/openclaw/gateway-http';
import { queryOne } from '@/lib/db';
import { execSync } from 'child_process';
import { calcCost, getPricing } from '@/lib/cost/calculate';
import type { Agent } from '@/lib/types';

interface RouteParams {
  params: Promise<{ id: string }>;
}

function toMs(ts?: number): number {
  if (!ts) return 0;
  return ts < 1e12 ? ts * 1000 : ts;
}


type CliSession = {
  key?: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  updatedAt?: number;
};

function readCliSessionsMap(): Map<string, CliSession> {
  try {
    const raw = execSync('openclaw sessions --all-agents --json 2>/dev/null', {
      timeout: 8000,
      encoding: 'utf-8',
      env: {
        ...process.env,
        PATH: '/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:' + (process.env.PATH || ''),
        OPENCLAW_GATEWAY_TOKEN: process.env.OPENCLAW_GATEWAY_TOKEN || '',
      },
    });
    const parsed = JSON.parse(raw) as { sessions?: CliSession[]; stores?: Array<{ sessions?: CliSession[] }> };
    const out = new Map<string, CliSession>();
    const all: CliSession[] = [];
    if (Array.isArray(parsed.sessions)) all.push(...parsed.sessions);
    if (Array.isArray(parsed.stores)) {
      for (const st of parsed.stores) {
        if (Array.isArray(st.sessions)) all.push(...st.sessions);
      }
    }
    for (const s of all) {
      if (s.key) out.set(s.key, s);
    }
    return out;
  } catch {
    return new Map();
  }
}

/**
 * GET /api/agents/[id]/stats — Token usage & cost stats for an agent
 */
export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;

    const agent = queryOne<Agent>('SELECT * FROM agents WHERE id = ?', [id]);
    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    const allSessions = await listSessions();
    const cliSessionsByKey = readCliSessionsMap();

    // Filter sessions for this agent
    const agentName = agent.name.toLowerCase();
    const gatewayAgentId = agent.gateway_agent_id;

    const agentSessions = allSessions.filter((s: GatewaySession) => {
      const key = (s.key || '').toLowerCase();
      if (gatewayAgentId && key.includes(gatewayAgentId.toLowerCase())) return true;
      if (key.includes(`agent:${agentName}`)) return true;
      return false;
    });

    let totalTokensInput = 0;
    let totalTokensOutput = 0;
    let todayTokensInput = 0;
    let todayTokensOutput = 0;
    let lastActiveAtMs = 0;
    const modelsUsed = new Set<string>();
    const sessionCount = agentSessions.length;
    const DAY_MS = 24 * 60 * 60 * 1000;
    const now = Date.now();

    for (const session of agentSessions) {
      const cli = cliSessionsByKey.get(session.key);
      const input =
        typeof session.inputTokens === 'number'
          ? session.inputTokens
          : typeof cli?.inputTokens === 'number'
            ? cli.inputTokens
            : 0;
      const output =
        typeof session.outputTokens === 'number'
          ? session.outputTokens
          : typeof cli?.outputTokens === 'number'
            ? cli.outputTokens
            : 0;
      const total =
        typeof session.totalTokens === 'number'
          ? session.totalTokens
          : typeof cli?.totalTokens === 'number'
            ? cli.totalTokens
            : input + output;

      // fallback when only totalTokens exists (estimate split to avoid undercounting cost)
      const hasOnlyTotal = input === 0 && output === 0 && total > 0;
      const estimatedOutput = hasOnlyTotal ? Math.round(total * 0.15) : output;
      const estimatedInput = hasOnlyTotal ? Math.max(0, total - estimatedOutput) : input;
      const fixedInput = estimatedInput;
      const fixedOutput = estimatedOutput;

      totalTokensInput += fixedInput;
      totalTokensOutput += fixedOutput;

      const updatedAtMs = toMs(Number(session.updatedAt || cli?.updatedAt || 0));
      if (updatedAtMs > lastActiveAtMs) lastActiveAtMs = updatedAtMs;
      if (updatedAtMs && now - updatedAtMs <= DAY_MS) {
        todayTokensInput += fixedInput;
        todayTokensOutput += fixedOutput;
      }

      if (session.model && typeof session.model === 'string') {
        modelsUsed.add(session.model);
      }
    }

    if (modelsUsed.size === 0 && agent.model) {
      modelsUsed.add(agent.model);
    }

    let estimatedCost = 0;
    let todayCost = 0;
    for (const session of agentSessions) {
      const cli = cliSessionsByKey.get(session.key);
      const model = (session.model as string) || (cli as any)?.model || Array.from(modelsUsed)[0] || 'unknown';

      const input =
        typeof session.inputTokens === 'number'
          ? session.inputTokens
          : typeof cli?.inputTokens === 'number'
            ? cli.inputTokens
            : 0;
      const output =
        typeof session.outputTokens === 'number'
          ? session.outputTokens
          : typeof cli?.outputTokens === 'number'
            ? cli.outputTokens
            : 0;
      const total =
        typeof session.totalTokens === 'number'
          ? session.totalTokens
          : typeof cli?.totalTokens === 'number'
            ? cli.totalTokens
            : input + output;

      const hasOnlyTotal = input === 0 && output === 0 && total > 0;
      const estimatedOutput = hasOnlyTotal ? Math.round(total * 0.15) : output;
      const estimatedInput = hasOnlyTotal ? Math.max(0, total - estimatedOutput) : input;

      let sessionCost = calcCost(model, estimatedInput, estimatedOutput);

      // Include estimated cache-read cost when totalTokens > totalTokensFresh.
      // OpenClaw CLI does not expose per-session cacheRead directly, so estimate from the gap.
      const totalTokens =
        typeof session.totalTokens === 'number'
          ? session.totalTokens
          : typeof cli?.totalTokens === 'number'
            ? cli.totalTokens
            : estimatedInput + estimatedOutput;
      const totalFresh =
        typeof (session as any).totalTokensFresh === 'number'
          ? Number((session as any).totalTokensFresh)
          : totalTokens;
      const cacheReadTokens = Math.max(0, totalTokens - totalFresh);
      if (cacheReadTokens > 0) {
        const pricing = getPricing(String(model));
        // Heuristic: cache-read priced at ~10% of input token rate.
        sessionCost += (cacheReadTokens / 1_000_000) * (pricing.input * 0.10);
      }

      estimatedCost += sessionCost;

      const updatedAtMs = toMs(Number(session.updatedAt || cli?.updatedAt || 0));
      if (updatedAtMs && now - updatedAtMs <= DAY_MS) {
        todayCost += sessionCost;
      }
    }

    return NextResponse.json({
      agentId: id,
      agentName: agent.name,
      sessionCount,
      totalTokens: totalTokensInput + totalTokensOutput,
      totalTokensInput,
      totalTokensOutput,
      estimatedCost: Math.round(estimatedCost * 10000) / 10000,
      todayTokens: todayTokensInput + todayTokensOutput,
      todayCost: Math.round(todayCost * 10000) / 10000,
      lastActiveAt: lastActiveAtMs || null,
      models: Array.from(modelsUsed),
      sessions: agentSessions.map((s: GatewaySession) => ({
        id: s.key,
        channel: s.channel || s.kind || '',
        model: s.model || '',
        status: s.kind || 'unknown',
        displayName: s.displayName || '',
      })),
    });
  } catch (error) {
    console.error('Failed to get agent stats:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
