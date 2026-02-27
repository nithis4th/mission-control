import { NextResponse } from 'next/server';
import { listSessions, type GatewaySession } from '@/lib/openclaw/gateway-http';
import { queryOne } from '@/lib/db';
import type { Agent } from '@/lib/types';

interface RouteParams {
  params: Promise<{ id: string }>;
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
    const modelsUsed = new Set<string>();
    const sessionCount = agentSessions.length;

    for (const session of agentSessions) {
      if (typeof session.inputTokens === 'number') totalTokensInput += session.inputTokens;
      if (typeof session.outputTokens === 'number') totalTokensOutput += session.outputTokens;
      if (session.model && typeof session.model === 'string') {
        modelsUsed.add(session.model);
      }
    }

    if (modelsUsed.size === 0 && agent.model) {
      modelsUsed.add(agent.model);
    }

    const estimatedCost = estimateTokenCost(
      totalTokensInput,
      totalTokensOutput,
      Array.from(modelsUsed)[0],
    );

    return NextResponse.json({
      agentId: id,
      agentName: agent.name,
      sessionCount,
      totalTokens: totalTokensInput + totalTokensOutput,
      totalTokensInput,
      totalTokensOutput,
      estimatedCost: Math.round(estimatedCost * 10000) / 10000,
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

function estimateTokenCost(
  inputTokens: number,
  outputTokens: number,
  model?: string,
): number {
  const pricing: Record<string, [number, number]> = {
    'claude-sonnet-4-6': [3, 15],
    'claude-sonnet-4': [3, 15],
    'claude-opus-4': [15, 75],
    'claude-opus-4.6': [15, 75],
    'claude-3.5-sonnet': [3, 15],
    'claude-3-opus': [15, 75],
    'gpt-4o': [2.5, 10],
    'gpt-4o-mini': [0.15, 0.6],
    'minimax-m2.5': [0.5, 1.5],
  };

  let inputRate = 3;
  let outputRate = 15;

  if (model) {
    for (const [key, [iRate, oRate]] of Object.entries(pricing)) {
      if (model.includes(key)) {
        inputRate = iRate;
        outputRate = oRate;
        break;
      }
    }
  }

  return (inputTokens * inputRate + outputTokens * outputRate) / 1_000_000;
}
