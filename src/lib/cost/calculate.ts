import { execSync } from 'child_process';

const MODEL_PRICES: Record<string, { input: number; output: number }> = {
  'claude-sonnet-4-6': { input: 3, output: 15 },
  'claude-sonnet-4-5': { input: 3, output: 15 },
  'claude-sonnet': { input: 3, output: 15 },
  'claude-opus-4.6': { input: 15, output: 75 },
  'claude-opus-4': { input: 15, output: 75 },
  'claude-opus': { input: 15, output: 75 },
  'claude-haiku': { input: 0.8, output: 4 },
  'kimi-k2.5': { input: 0.15, output: 0.6 },
  kimi: { input: 0.15, output: 0.6 },
  'gpt-5.3-codex': { input: 3, output: 15 },
  'gpt-5': { input: 3, output: 15 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'gpt-4o': { input: 2.5, output: 10 },
  'minimax-m2.5': { input: 0.05, output: 0.2 },
  minimax: { input: 0.05, output: 0.2 },
  'gemini-2.0-flash': { input: 0.1, output: 0.4 },
  gemini: { input: 1.25, output: 5 },
};

export function getPricing(model: string) {
  const m = model.toLowerCase();
  for (const [key, price] of Object.entries(MODEL_PRICES)) {
    if (m.includes(key)) return price;
  }
  return { input: 3, output: 15 };
}

export function calcCost(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = getPricing(model);
  return (inputTokens / 1_000_000) * pricing.input + (outputTokens / 1_000_000) * pricing.output;
}

type SessionData = {
  model?: string;
  modelProvider?: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  updatedAt?: number;
};

type StoreData = {
  sessions?: SessionData[];
};

export type CostResponse = {
  sessions: number;
  modelBreakdown: Array<{
    model: string;
    tokens: number;
    cost: number;
    count: number;
    inputTokens: number;
    outputTokens: number;
  }>;
  totalTokens: number;
  totalCost: number;
  todayTokens: number;
  todayCost: number;
  error?: string;
};

export async function computeCostData(): Promise<CostResponse> {
  let rawOutput = '';
  try {
    rawOutput = execSync('openclaw sessions --all-agents --json 2>/dev/null', {
      timeout: 10000,
      encoding: 'utf-8',
      env: {
        ...process.env,
        PATH: '/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:' + (process.env.PATH || ''),
        OPENCLAW_GATEWAY_TOKEN: process.env.OPENCLAW_GATEWAY_TOKEN || '',
      },
    });
  } catch {
    return {
      sessions: 0,
      modelBreakdown: [],
      totalTokens: 0,
      totalCost: 0,
      todayTokens: 0,
      todayCost: 0,
      error: 'openclaw unavailable',
    };
  }

  const parsed = JSON.parse(rawOutput);
  let allSessions: SessionData[] = [];

  if (Array.isArray(parsed.sessions)) {
    allSessions = parsed.sessions;
  } else if (Array.isArray(parsed.stores)) {
    for (const store of parsed.stores as StoreData[]) {
      if (Array.isArray(store.sessions)) {
        allSessions = allSessions.concat(store.sessions);
      }
    }
  }

  const now = Date.now();
  const DAY_MS = 24 * 60 * 60 * 1000;
  const todaySessions = allSessions.filter((s) => {
    const updatedAt = s.updatedAt || 0;
    const updatedAtMs = updatedAt < 1e12 ? updatedAt * 1000 : updatedAt;
    return now - updatedAtMs <= DAY_MS;
  });

  const modelMap = new Map<
    string,
    { tokens: number; cost: number; count: number; inputTokens: number; outputTokens: number }
  >();

  for (const session of allSessions) {
    const model = session.model || 'unknown';
    const provider = session.modelProvider || '';
    const fullModel = provider ? `${provider}/${model}` : model;
    const inputTokens = session.inputTokens || 0;
    const outputTokens = session.outputTokens || 0;
    const tokens = session.totalTokens || inputTokens + outputTokens;
    const cost = calcCost(model, inputTokens, outputTokens);

    const existing = modelMap.get(fullModel) || {
      tokens: 0,
      cost: 0,
      count: 0,
      inputTokens: 0,
      outputTokens: 0,
    };

    modelMap.set(fullModel, {
      tokens: existing.tokens + tokens,
      cost: existing.cost + cost,
      count: existing.count + 1,
      inputTokens: existing.inputTokens + inputTokens,
      outputTokens: existing.outputTokens + outputTokens,
    });
  }

  const modelBreakdown = Array.from(modelMap.entries())
    .map(([model, data]) => ({ model, ...data }))
    .sort((a, b) => b.tokens - a.tokens);

  const totalTokens = allSessions.reduce((s, x) => s + (x.totalTokens || 0), 0);
  const totalCost = allSessions.reduce((s, x) => {
    return s + calcCost(x.model || '', x.inputTokens || 0, x.outputTokens || 0);
  }, 0);

  const todayTokens = todaySessions.reduce((s, x) => s + (x.totalTokens || 0), 0);
  const todayCost = todaySessions.reduce((s, x) => {
    return s + calcCost(x.model || '', x.inputTokens || 0, x.outputTokens || 0);
  }, 0);

  return {
    sessions: allSessions.length,
    modelBreakdown,
    totalTokens,
    totalCost,
    todayTokens,
    todayCost,
  };
}
