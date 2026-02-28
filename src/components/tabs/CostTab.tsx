'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
} from 'recharts';

const MODEL_PRICES: Record<string, { input: number; output: number }> = {
  'claude-sonnet': { input: 3, output: 15 },
  'claude-opus': { input: 15, output: 75 },
  kimi: { input: 0.15, output: 0.6 },
  'gpt-5': { input: 3, output: 15 },
  'gpt-4': { input: 10, output: 30 },
  gemini: { input: 1.25, output: 5 },
  default: { input: 3, output: 15 },
};

const CHART_COLORS = ['#7c3aed', '#c026d3', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#8b5cf6'];

type CostData = {
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
};

type CostSnapshot = {
  date: string;
  takenAt: string;
  totalTokens: number;
  totalCost: number;
  todayTokens: number;
  todayCost: number;
  modelBreakdown: Array<{
    model: string;
    tokens: number;
    cost: number;
    count: number;
    inputTokens: number;
    outputTokens: number;
  }>;
};

type HistoryResponse = {
  date: string;
  snapshot: CostSnapshot | null;
  trend: CostSnapshot[];
  error?: string;
};

function toBangkokDateInput(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function dateMinusDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return toBangkokDateInput(d);
}

function getModelPricing(model: string): { input: number; output: number } {
  const m = model.toLowerCase();
  for (const [key, price] of Object.entries(MODEL_PRICES)) {
    if (m.includes(key)) return price;
  }
  return MODEL_PRICES.default;
}

export function CostTab() {
  const [liveData, setLiveData] = useState<CostData | null>(null);
  const [history, setHistory] = useState<HistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showRefreshDone, setShowRefreshDone] = useState(false);
  const [refreshingTick, setRefreshingTick] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(toBangkokDateInput(new Date()));
  const [rangeMode, setRangeMode] = useState<'date' | 'last7'>('date');

  const loadCost = async () => {
    try {
      const res = await fetch('/api/cost');
      if (res.ok) {
        const json = await res.json();
        setLiveData(json);
        setLastUpdated(new Date());
      }
    } catch {
      // ignore
    }
  };

  const loadHistory = async (date: string) => {
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/cost/history?date=${encodeURIComponent(date)}`);
      if (res.ok) {
        const json = await res.json();
        setHistory(json);
      } else {
        const json = await res.json().catch(() => ({}));
        setHistory({ date, snapshot: null, trend: [], error: json.error || 'No snapshot found' });
      }
    } catch {
      setHistory({ date, snapshot: null, trend: [], error: 'Failed to load history' });
    } finally {
      setHistoryLoading(false);
      setLoading(false);
    }
  };

  const refreshAll = async (manual = false) => {
    const startedAt = Date.now();
    if (manual) {
      setIsRefreshing(true);
      setRefreshingTick((x) => x + 1);
      setShowRefreshDone(false);
    }

    setLoading(true);
    await Promise.all([loadCost(), loadHistory(selectedDate)]);
    setLoading(false);

    if (manual) {
      const elapsed = Date.now() - startedAt;
      const minVisibleMs = 450;
      const waitMs = Math.max(0, minVisibleMs - elapsed);
      if (waitMs > 0) await new Promise((resolve) => setTimeout(resolve, waitMs));

      setIsRefreshing(false);
      setShowRefreshDone(true);
      setTimeout(() => setShowRefreshDone(false), 900);
    }
  };

  useEffect(() => {
    refreshAll(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadHistory(selectedDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  const activeData = useMemo(() => {
    if (rangeMode === 'last7' && history?.trend?.length) {
      const totalTokens = history.trend.reduce((sum, x) => sum + (x.todayTokens || 0), 0);
      const totalCost = history.trend.reduce((sum, x) => sum + (x.todayCost || 0), 0);
      return {
        modelBreakdown: [],
        totalTokens,
        totalCost,
        todayTokens: totalTokens,
        todayCost: totalCost,
      };
    }

    if (history?.snapshot) {
      return {
        modelBreakdown: history.snapshot.modelBreakdown,
        totalTokens: history.snapshot.totalTokens,
        totalCost: history.snapshot.totalCost,
        todayTokens: history.snapshot.todayTokens,
        todayCost: history.snapshot.todayCost,
      };
    }

    return liveData;
  }, [history, liveData, rangeMode]);

  if (loading && !liveData) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-3 animate-pulse">💰</div>
          <p className="text-mc-text-secondary text-sm">Calculating costs...</p>
        </div>
      </div>
    );
  }

  if (!activeData) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center opacity-60">
          <div className="text-4xl mb-3">💸</div>
          <p className="text-mc-text-secondary text-sm">No cost data available</p>
        </div>
      </div>
    );
  }

  const chartData = (activeData.modelBreakdown || [])
    .filter((m) => m.tokens > 0)
    .map((m) => ({ name: m.model, value: m.tokens, cost: m.cost }));

  const trendData = (history?.trend || []).map((d) => ({
    date: d.date.slice(5),
    fullDate: d.date,
    cost: Number(d.todayCost.toFixed(4)),
    tokens: d.todayTokens,
  }));

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="flex flex-col gap-3 mb-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-lg font-bold text-mc-text">Cost & Usage</h2>
          <p className="text-xs text-mc-text-secondary mt-0.5">
            Token usage and estimated cost across all agents
            {lastUpdated && (
              <span className="ml-2 opacity-60">
                · {lastUpdated.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => {
              setRangeMode('date');
              setSelectedDate(e.target.value);
            }}
            className="text-xs px-2 py-1.5 rounded border border-mc-border bg-mc-bg text-mc-text"
          />
          <button
            onClick={() => {
              setRangeMode('date');
              setSelectedDate(toBangkokDateInput(new Date()));
            }}
            className="text-xs px-2 py-1 rounded border border-mc-border text-mc-text-secondary hover:text-mc-text"
          >
            Today
          </button>
          <button
            onClick={() => {
              setRangeMode('date');
              setSelectedDate(dateMinusDays(1));
            }}
            className="text-xs px-2 py-1 rounded border border-mc-border text-mc-text-secondary hover:text-mc-text"
          >
            Yesterday
          </button>
          <button
            onClick={() => setRangeMode('last7')}
            className={`text-xs px-2 py-1 rounded border ${
              rangeMode === 'last7'
                ? 'border-mc-accent/50 text-mc-accent'
                : 'border-mc-border text-mc-text-secondary hover:text-mc-text'
            }`}
          >
            Last 7 days
          </button>
          <button
            onClick={() => refreshAll(true)}
            disabled={isRefreshing}
            className="text-xs px-2.5 py-1 rounded border transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-60 border-mc-border hover:border-mc-accent/40 text-mc-text-secondary hover:text-mc-text"
          >
            <span
              className={`inline-flex items-center gap-1.5 transition-all duration-300 ${isRefreshing ? 'text-mc-accent' : showRefreshDone ? 'text-green-400' : ''}`}
            >
              <span className={`inline-flex items-center justify-center w-3.5 h-3.5 rounded-full transition-all duration-300 ${isRefreshing ? 'bg-mc-accent/20' : showRefreshDone ? 'bg-green-400/20' : 'bg-mc-text-secondary/15'}`}>
                <span key={refreshingTick} className={`block w-1.5 h-1.5 rounded-full transition-all duration-300 ${isRefreshing ? 'bg-mc-accent animate-spin' : showRefreshDone ? 'bg-green-400' : 'bg-mc-text-secondary/60'}`} />
              </span>
              {isRefreshing ? 'Refreshing...' : showRefreshDone ? 'Updated' : 'Refresh'}
            </span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Tokens" value={formatTokens(activeData.totalTokens)} emoji="🔢" sub={rangeMode === 'last7' ? 'last 7 days' : selectedDate} />
        <StatCard label="Est. Cost" value={`$${activeData.totalCost.toFixed(4)}`} emoji="💵" sub={rangeMode === 'last7' ? 'last 7 days' : selectedDate} />
        <StatCard label="Daily Tokens" value={formatTokens(activeData.todayTokens)} emoji="📊" sub={rangeMode === 'last7' ? 'sum(7d)' : 'snapshot'} highlight />
        <StatCard label="Daily Cost" value={`$${activeData.todayCost.toFixed(4)}`} emoji="💸" sub={rangeMode === 'last7' ? 'sum(7d)' : 'snapshot'} highlight />
      </div>

      {(historyLoading || history?.error) && (
        <div className="mb-6 rounded-lg border border-mc-border bg-mc-bg-secondary px-3 py-2 text-xs text-mc-text-secondary">
          {historyLoading ? 'Loading history…' : `History note: ${history?.error}`}
        </div>
      )}

      <div className="bg-mc-bg-secondary border border-mc-border rounded-xl p-5 mb-6">
        <h3 className="text-sm font-semibold mb-4 text-mc-text">Cost Trend (Last 7 Days)</h3>
        {trendData.length > 0 ? (
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
              <XAxis dataKey="date" tick={{ fill: '#a1a1aa', fontSize: 11 }} />
              <YAxis tick={{ fill: '#a1a1aa', fontSize: 11 }} />
              <Tooltip
                formatter={(value: number | string | Array<number | string> | undefined, name: string | undefined) => {
                  const numeric = Number(Array.isArray(value) ? value[0] : value ?? 0);
                  return name === 'cost'
                    ? [`$${numeric.toFixed(4)}`, 'Cost']
                    : [formatTokens(numeric), 'Tokens'];
                }}
                labelFormatter={(label, payload) => {
                  const item = payload?.[0]?.payload as { fullDate?: string } | undefined;
                  return item?.fullDate || label;
                }}
                contentStyle={{
                  background: '#1a1a2e',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
              />
              <Line type="monotone" dataKey="cost" stroke="#c026d3" strokeWidth={2.5} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[240px] flex items-center justify-center text-mc-text-secondary text-sm">No trend data yet</div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                  formatter={(value: number | undefined, name: string | undefined) => [`${formatTokens(Number(value || 0))} tokens`, name || 'model']}
                  contentStyle={{
                    background: '#1a1a2e',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Legend
                  formatter={(value) => value.split('/').pop()?.split('-').slice(0, 3).join('-') || value}
                  wrapperStyle={{ fontSize: '11px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[260px] flex items-center justify-center text-mc-text-secondary text-sm">No usage data</div>
          )}
        </div>

        <div className="bg-mc-bg-secondary border border-mc-border rounded-xl p-5">
          <h3 className="text-sm font-semibold mb-4 text-mc-text">Model Breakdown</h3>
          <div className="space-y-2">
            {(activeData.modelBreakdown || []).map((m, i) => (
              <div key={m.model} className="flex items-center justify-between py-2 border-b border-mc-border last:border-0">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                  <span className="text-xs text-mc-text truncate font-mono">{m.model.split('/').pop() || m.model}</span>
                </div>
                <div className="flex items-center gap-4 text-xs text-mc-text-secondary flex-shrink-0">
                  <span>{formatTokens(m.tokens)}t</span>
                  <span className="text-mc-accent-green font-semibold">${m.cost.toFixed(4)}</span>
                  <span className="opacity-50">{m.count}s</span>
                </div>
              </div>
            ))}
            {(!activeData.modelBreakdown || activeData.modelBreakdown.length === 0) && (
              <div className="text-center py-8 text-mc-text-secondary text-sm opacity-60">No data</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  emoji,
  sub,
  highlight,
}: {
  label: string;
  value: string;
  emoji: string;
  sub: string;
  highlight?: boolean;
}) {
  return (
    <div className={`bg-mc-bg-secondary border rounded-xl p-4 ${highlight ? 'border-mc-accent/30' : 'border-mc-border'}`}>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-lg">{emoji}</span>
        <span className="text-xs text-mc-text-secondary">{label}</span>
      </div>
      <div className={`text-xl font-bold ${highlight ? 'text-mc-accent' : 'text-mc-text'}`}>{value}</div>
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
