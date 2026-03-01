'use client';

import { useEffect, useState } from 'react';

interface RollbackPoint {
  hash: string;
  timestamp: string;
  message: string;
}

export function DashboardTab() {
  const [points, setPoints] = useState<RollbackPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string>('');

  const loadPoints = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/rollback/points?limit=30');
      const data = await res.json();
      setPoints(data.points || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPoints();
  }, []);

  const createPoint = async () => {
    setMsg('');
    const res = await fetch('/api/rollback/points', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note: 'manual from dashboard' }),
    });
    const data = await res.json();
    if (res.ok) {
      setMsg(`✅ Created rollback point: ${data.point.hash.slice(0, 8)}`);
      loadPoints();
    } else {
      setMsg(`❌ ${data.error || 'failed'}`);
    }
  };

  const restorePoint = async (hash: string) => {
    if (!confirm(`Restore mission-control to ${hash.slice(0, 8)} ?`)) return;
    setMsg('');
    const res = await fetch('/api/rollback/restore', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hash }),
    });
    const data = await res.json();
    if (res.ok) {
      setMsg(`✅ Restored to ${data.restoredHash.slice(0, 8)} (from ${data.beforeHash.slice(0, 8)})`);
      loadPoints();
    } else {
      setMsg(`❌ ${data.error || 'restore failed'}`);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">Dashboard</h2>
            <p className="text-sm text-mc-text-secondary">Mission Board rollback control (mission-control only)</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadPoints}
              className="px-3 py-2 rounded bg-mc-bg-tertiary hover:bg-mc-border text-sm"
            >
              Refresh
            </button>
            <button
              onClick={createPoint}
              className="px-3 py-2 rounded bg-mc-accent text-mc-bg text-sm font-medium"
            >
              Save Rollback Point
            </button>
          </div>
        </div>

        {msg && <div className="text-sm p-3 rounded bg-mc-bg-secondary border border-mc-border">{msg}</div>}

        <div className="rounded-xl border border-mc-border bg-mc-bg-secondary overflow-hidden">
          <div className="px-4 py-3 border-b border-mc-border font-medium text-sm">Rollback Points</div>
          {loading ? (
            <div className="p-4 text-sm text-mc-text-secondary">Loading...</div>
          ) : points.length === 0 ? (
            <div className="p-4 text-sm text-mc-text-secondary">No rollback points yet</div>
          ) : (
            <div className="divide-y divide-mc-border">
              {points.map((p) => (
                <div key={p.hash} className="p-4 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="font-mono text-xs">{p.hash}</div>
                    <div className="text-sm truncate">{p.message}</div>
                    <div className="text-xs text-mc-text-secondary">{new Date(p.timestamp).toLocaleString()}</div>
                  </div>
                  <button
                    onClick={() => restorePoint(p.hash)}
                    className="px-3 py-2 rounded bg-red-500/20 hover:bg-red-500/30 text-red-300 text-sm"
                  >
                    Restore
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
