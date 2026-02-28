import fs from 'fs/promises';
import path from 'path';
import { calcCost } from '@/lib/cost/calculate';

type SessionPoint = {
  key: string;
  agentId: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  updatedAt?: number;
};

type LastState = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  model: string;
  agentId: string;
  updatedAt?: number;
};

type StateFile = {
  sessions: Record<string, LastState>;
};

type DailyAgentUsage = {
  tokens: number;
  inputTokens: number;
  outputTokens: number;
  cost: number;
};

type DailyFile = {
  date: string;
  agents: Record<string, DailyAgentUsage>;
};

const LEDGER_DIR = path.join(process.env.HOME || '', '.openclaw', 'workspace', 'agent-usage-ledger');
const STATE_PATH = path.join(LEDGER_DIR, 'state.json');

function todayBangkok() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function dayPath(date: string) {
  return path.join(LEDGER_DIR, `${date}.json`);
}

async function ensureDir() {
  await fs.mkdir(LEDGER_DIR, { recursive: true });
}

async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(file, 'utf-8');
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function writeJson(file: string, obj: unknown) {
  await fs.writeFile(file, JSON.stringify(obj, null, 2), 'utf-8');
}

function splitFromTotal(total: number) {
  const output = Math.round(total * 0.15);
  const input = Math.max(0, total - output);
  return { input, output };
}

export async function updateUsageLedger(points: SessionPoint[]) {
  await ensureDir();
  const state = await readJson<StateFile>(STATE_PATH, { sessions: {} });

  const date = todayBangkok();
  const daily = await readJson<DailyFile>(dayPath(date), { date, agents: {} });

  for (const p of points) {
    if (!p.key || !p.agentId) continue;

    const prev = state.sessions[p.key];

    let deltaInput = 0;
    let deltaOutput = 0;
    let deltaTotal = 0;

    const hasSplit = p.inputTokens > 0 || p.outputTokens > 0;

    if (prev) {
      if (hasSplit) {
        deltaInput = Math.max(0, p.inputTokens - prev.inputTokens);
        deltaOutput = Math.max(0, p.outputTokens - prev.outputTokens);
        deltaTotal = deltaInput + deltaOutput;
      } else {
        const dt = Math.max(0, p.totalTokens - prev.totalTokens);
        deltaTotal = dt;
        const s = splitFromTotal(dt);
        deltaInput = s.input;
        deltaOutput = s.output;
      }
    } else {
      if (hasSplit) {
        deltaInput = p.inputTokens;
        deltaOutput = p.outputTokens;
        deltaTotal = p.inputTokens + p.outputTokens;
      } else {
        const s = splitFromTotal(p.totalTokens);
        deltaInput = s.input;
        deltaOutput = s.output;
        deltaTotal = p.totalTokens;
      }
    }

    if (deltaTotal > 0) {
      const key = p.agentId.toLowerCase();
      const ag = daily.agents[key] || { tokens: 0, inputTokens: 0, outputTokens: 0, cost: 0 };
      ag.tokens += deltaTotal;
      ag.inputTokens += deltaInput;
      ag.outputTokens += deltaOutput;
      ag.cost += calcCost(p.model || 'unknown', deltaInput, deltaOutput);
      daily.agents[key] = ag;
    }

    state.sessions[p.key] = {
      inputTokens: p.inputTokens,
      outputTokens: p.outputTokens,
      totalTokens: p.totalTokens,
      model: p.model,
      agentId: p.agentId,
      updatedAt: p.updatedAt,
    };
  }

  await writeJson(STATE_PATH, state);
  await writeJson(dayPath(date), daily);
}

export async function getTodayAgentUsage(agentId: string): Promise<DailyAgentUsage> {
  await ensureDir();
  const date = todayBangkok();
  const daily = await readJson<DailyFile>(dayPath(date), { date, agents: {} });
  return daily.agents[agentId.toLowerCase()] || {
    tokens: 0,
    inputTokens: 0,
    outputTokens: 0,
    cost: 0,
  };
}
