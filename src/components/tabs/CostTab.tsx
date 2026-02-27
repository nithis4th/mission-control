'use client';

import { useEffect, useState } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

const MODEL_PRICES: Record<string, { input: number; output: number }> = {
  'claude-sonnet':  { input: 3,    output: 15   },
  'claude-opus':    { input: 15,   output: 75   },
  'kimi':           { input: 0.15, output: 0.6  },
  'gpt-5':          { input: 3,    output: 15   },
  'gpt-4':          { input: 10,   output: 30   },
  'gemini':         { input: 1.25, output: 5    },
  'default':        { input: 3,    output: 15   },
};

const CHART_COLORS = [
  '#7c3aed', '#c026d3', '#ec4899', '#f59e0b',
  '#10b981', '#3b82f6', '#ef4444', '#8b5cf6',
];

function getModelPricing(model: string): { input: number; output: number } {
  const m = model.toLowerCase();
  for (const [key, price] of Object.entries(MODEL_PRICES)) {
    if (m.includes(key)) return price;
  }
  return MODEL_PRICES['default'];
}

type SessionEntry = {
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  agentId?: string;
};

type CostData = {
  sessions: SessionEntry[];
  modelBreakdown: Array<{ model: string; tokens: number; cost: number; count: number }>;
  totalTokens: number;
  totalCost: number;
  todayTokens: number;
  todayCost: number;
};

export function CostTab() {
  const [data, setData] = useState<CostData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const loadCost = async () => {
    try {
      const res = await fetch('/api/cost');
      if (res.ok) {
        const json = await res.json();
        setData(json);
        setLastUpdated(new Date());
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCost();
  }, []);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-3 animate-pulse">💰</div>
          <p className="text-mc-text-secondary text-sm">Calculating costs...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center opacity-60">
          <div className="text-4xl mb-3">💸</div>
          <p className="text-mc-text-secondary text-sm">No cost data available</p>
        </div>
      </div>
    );
  }

  const chartData = (data.modelBreakdown || [])
    .filter((m) => m.tokens > 0)
    .map((m) => ({ name: m.model, value: m.tokens, cost: m.cost }));

  return (
    <div className="flex-1 overflow-y-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold text-mc-text">Cost & Usage</h2>
          <p className="text-xs text-mc-text-secondary mt-0.5">
            Token usage and estimated cost across all agents
            {lastUpdated && (
              <span className="ml-2 opacity-60">
                · {lastUpdated.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </p>
        </div>
        <button
          onClick={loadCost}
          className="text-xs text-mc-text-secondary hover:text-mc-text px-2 py-1 rounded border border-mc-border hover:border-mc-accent/40 transition-colors"
        >
          Refresh
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Total Tokens"
          value={formatTokens(data.totalTokens)}
          emoji="🔢"
          sub="all time"
        />
        <StatCard
          label="Est. Cost"
          value={`$${data.totalCost.toFixed(4)}`}
          emoji="💵"
          sub="all time"
        />
        <StatCard
          label="Today Tokens"
          value={formatTokens(data.todayTokens)}
          emoji="📊"
          sub="last 24h"
          highlight
        />
        <StatCard
          label="Today Cost"
          value={`$${data.todayCost.toFixed(4)}`}
          emoji="💸"
          sub="last 24h"
          highlight
        />
      </div>

      {/* Chart + Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pie Chart */}
        <div className="bg-mc-bg-secondary border border-mc-border rounded-xl p-5">
          <h3 className="text-sm font-semibold mb-4 text-mc-text">Model Distribution (tokens)</h3>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={chartData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  innerRadius={50}
                  paddingAngle={2}
                  label={({ name, percent }) =>
                    `${(name ?? '').split('/').pop()?.split('-').slice(0, 2).join('-')} ${((percent ?? 0) * 100).toFixed(0)}%`
                  }
                  labelLine={false}
                >
                  {chartData.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(value: any, name: any) => [
                    `${formatTokens(value)} tokens`,
                    name,
                  ]}
                  contentStyle={{
                    background: '#1a1a2e',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Legend
                  formatter={(value) =>
                    value.split('/').pop()?.split('-').slice(0, 3).join('-') || value
                  }
                  wrapperStyle={{ fontSize: '11px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[260px] flex items-center justify-center text-mc-text-secondary text-sm">
              No usage data
            </div>
          )}
        </div>

        {/* Model Breakdown Table */}
        <div className="bg-mc-bg-secondary border border-mc-border rounded-xl p-5">
          <h3 className="text-sm font-semibold mb-4 text-mc-text">Model Breakdown</h3>
          <div className="space-y-2">
            {(data.modelBreakdown || []).map((m, i) => (
              <div
                key={m.model}
                className="flex items-center justify-between py-2 border-b border-mc-border last:border-0"
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
                  />
                  <span className="text-xs text-mc-text truncate font-mono">
                    {m.model.split('/').pop() || m.model}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs text-mc-text-secondary flex-shrink-0">
                  <span>{formatTokens(m.tokens)}t</span>
                  <span className="text-mc-accent-green font-semibold">${m.cost.toFixed(4)}</span>
                  <span className="opacity-50">{m.count}s</span>
                </div>
              </div>
            ))}
            {(!data.modelBreakdown || data.modelBreakdown.length === 0) && (
              <div className="text-center py-8 text-mc-text-secondary text-sm opacity-60">
                No data
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Price Reference */}
      <div className="mt-6 p-4 bg-mc-bg-secondary border border-mc-border rounded-xl">
        <h3 className="text-xs font-semibold text-mc-text-secondary uppercase tracking-wide mb-3">
          Price Reference (per 1M tokens)
        </h3>
        <div className="flex flex-wrap gap-3">
          {[
            { name: 'Claude Sonnet', input: '$3', output: '$15' },
            { name: 'Claude Opus',   input: '$15', output: '$75' },
            { name: 'Kimi K2.5',     input: '$0.15', output: '$0.6' },
            { name: 'GPT-5 Codex',   input: '$3', output: '$15' },
          ].map((p) => (
            <div
              key={p.name}
              className="text-[11px] bg-mc-bg border border-mc-border rounded-lg px-3 py-1.5"
            >
              <span className="text-mc-text font-semibold">{p.name}</span>
              <span className="text-mc-text-secondary ml-2">
                in: {p.input} / out: {p.output}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label, value, emoji, sub, highlight,
}: {
  label: string; value: string; emoji: string; sub: string; highlight?: boolean;
}) {
  return (
    <div
      className={`bg-mc-bg-secondary border rounded-xl p-4 ${
        highlight ? 'border-mc-accent/30' : 'border-mc-border'
      }`}
    >
      <div className="flex items-center gap-2 mb-1">
        <span className="text-lg">{emoji}</span>
        <span className="text-xs text-mc-text-secondary">{label}</span>
      </div>
      <div className={`text-xl font-bold ${highlight ? 'text-mc-accent' : 'text-mc-text'}`}>
        {value}
      </div>
      <div className="text-[10px] text-mc-text-secondary mt-0.5 opacity-70">{sub}</div>
    </div>
  );
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export { getModelPricing };
