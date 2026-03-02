/**
 * Sync Agent Models Script
 * 
 * Reads model.primary from openclaw.json and updates the SQLite database
 * to ensure consistency between config and stored data.
 * 
 * Usage: npx tsx src/lib/sync-agent-models.ts
 */

import { existsSync, readFileSync } from 'fs';
import { run, queryAll } from './db';

const OPENCLAW_JSON = '/Users/nithis4th/.openclaw/openclaw.json';

interface AgentConfig {
  id?: string;
  name?: string;
  model?: string | { primary?: string };
}

interface OpenClawConfig {
  agents?: {
    defaults?: {
      model?: {
        primary?: string;
      };
    };
    list?: AgentConfig[];
  };
}

function normalizeModelName(model: string): string {
  const trimmed = String(model || '').trim();
  if (!trimmed) return '';
  const parts = trimmed.split('/').filter(Boolean);
  return parts[parts.length - 1] || trimmed;
}

function getAgentsFromConfig(): { byId: Map<string, string>; byName: Map<string, string>; defaultModel: string } {
  const byId = new Map<string, string>();
  const byName = new Map<string, string>();
  let defaultModel = '';
  
  if (!existsSync(OPENCLAW_JSON)) {
    console.error('❌ openclaw.json not found at', OPENCLAW_JSON);
    return { byId, byName, defaultModel };
  }

  try {
    const raw = readFileSync(OPENCLAW_JSON, 'utf-8');
    const config: OpenClawConfig = JSON.parse(raw);
    
    // Get default model
    defaultModel = normalizeModelName(config.agents?.defaults?.model?.primary || '');
    
    for (const agent of config.agents?.list || []) {
      const id = String(agent.id || '').toLowerCase();
      const name = String(agent.name || '').toLowerCase();
      
      if (!id && !name) continue;

      let modelStr = '';
      if (typeof agent.model === 'string') {
        modelStr = agent.model;
      } else if (typeof agent.model === 'object' && agent.model?.primary) {
        modelStr = agent.model.primary;
      }

      const normalized = normalizeModelName(modelStr);
      if (normalized) {
        if (id) byId.set(id, normalized);
        if (name) byName.set(name, normalized);
      }
    }

    console.log('✓ Default model:', defaultModel);
    console.log('✓ Loaded', byId.size, 'agents from config');
  } catch (error) {
    console.error('❌ Failed to parse openclaw.json:', error);
  }

  return { byId, byName, defaultModel };
}

function syncModels() {
  console.log('🔄 Syncing agent models with openclaw.json...\n');
  
  const { byId, byName, defaultModel } = getAgentsFromConfig();
  
  if (byId.size === 0 && !defaultModel) {
    console.log('⚠️ No models found in config, skipping sync');
    return;
  }

  // Get current DB agents
  const dbAgents = queryAll<{ id: string; name: string; gateway_agent_id: string }>(
    'SELECT id, name, gateway_agent_id FROM agents'
  );

  console.log('📊 Current DB state before sync:');
  const beforeState = queryAll<{ name: string; model: string }>(
    'SELECT name, model FROM agents ORDER BY name'
  );
  for (const a of beforeState) {
    console.log(`  ${a.name.padEnd(10)} → ${a.model || '(empty)'}`);
  }
  console.log();

  let updated = 0;
  for (const agent of dbAgents) {
    // Try to match by gateway_agent_id first, then by name
    let modelToSet: string | null = null;
    
    if (agent.gateway_agent_id) {
      modelToSet = byId.get(agent.gateway_agent_id.toLowerCase()) || null;
    }
    
    if (!modelToSet) {
      modelToSet = byName.get(agent.name.toLowerCase()) ?? null;
    }

    // Fallback to default if still not found
    if (!modelToSet && defaultModel) {
      modelToSet = defaultModel;
    }

    if (modelToSet) {
      run('UPDATE agents SET model = ? WHERE id = ?', [modelToSet, agent.id]);
      updated++;
    }
  }

  console.log(`✓ Synced ${updated} agent models\n`);
  
  // Verify after sync
  console.log('📊 DB state after sync:');
  const afterState = queryAll<{ name: string; model: string }>(
    'SELECT name, model FROM agents ORDER BY name'
  );
  for (const a of afterState) {
    const configModel = byName.get(a.name.toLowerCase()) || byId.get(a.name.toLowerCase()) || defaultModel;
    const isCorrect = a.model === configModel ? '✅' : '❌';
    console.log(`  ${a.name.padEnd(10)} → ${a.model.padEnd(20)} ${isCorrect}`);
  }
  
  console.log('\n✅ Sync complete!');
}

// Run if executed directly
syncModels();
