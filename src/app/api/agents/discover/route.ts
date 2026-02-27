import { NextResponse } from 'next/server';
import { queryAll } from '@/lib/db';
import { listAgents } from '@/lib/openclaw/gateway-http';
import type { Agent, DiscoveredAgent } from '@/lib/types';

// This route must always be dynamic - it queries live Gateway state + DB
export const dynamic = 'force-dynamic';

// GET /api/agents/discover - Discover existing agents from the OpenClaw Gateway
export async function GET() {
  try {
    const gatewayAgents = await listAgents();

    if (!Array.isArray(gatewayAgents)) {
      return NextResponse.json(
        { error: 'Unexpected response from Gateway agents list' },
        { status: 502 },
      );
    }

    // Get all agents already imported from the gateway
    const existingAgents = queryAll<Agent>(
      'SELECT * FROM agents WHERE gateway_agent_id IS NOT NULL',
    );
    const importedGatewayIds = new Map(
      existingAgents.map((a) => [a.gateway_agent_id, a.id]),
    );

    const discovered: DiscoveredAgent[] = gatewayAgents.map((ga) => {
      const gatewayId = ga.id || ga.name || '';
      const alreadyImported = importedGatewayIds.has(gatewayId);
      return {
        id: gatewayId,
        name: ga.name || ga.label || gatewayId,
        label: ga.label,
        model: ga.model,
        channel: undefined,
        status: undefined,
        already_imported: alreadyImported,
        existing_agent_id: alreadyImported
          ? importedGatewayIds.get(gatewayId)
          : undefined,
      };
    });

    return NextResponse.json({
      agents: discovered,
      total: discovered.length,
      already_imported: discovered.filter((a) => a.already_imported).length,
    });
  } catch (error) {
    console.error('Failed to discover agents:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: `Failed to discover agents from Gateway: ${msg}` },
      { status: 500 },
    );
  }
}
