'use client';

import { useEffect, useState } from 'react';

type CronJob = {
  id: string;
  name: string;
  agentId: string;
  schedule: string;
  enabled: boolean;
  lastRunAt?: string | number | null;
  lastStatus?: 'ok' | 'error' | 'idle';
  nextRunAt?: string | number | null;
};

type CronData = {
  jobs: CronJob[];
};

function formatTime(ts: string | number | null | undefined): string {
  if (!ts) return '—';
  const d = new Date(typeof ts === 'number' ? ts : ts);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('th-TH', {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

const AGENT_EMOJIS: Record<string, string> = {
  main: '🦋', dexter: '🤖', sherlock: '🔍',
  shelby: '💼', bluma: '🛡️', goku: '⚡', monalisa: '🎨',
};

export function CronTab() {
  const [data, setData] = useState<CronData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const loadCron = async () => {
    try {
      const res = await fetch('/api/cron');
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
    loadCron();
    const interval = setInterval(loadCron, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-3 animate-pulse">⏰</div>
          <p className="text-mc-text-secondary text-sm">Loading cron jobs...</p>
        </div>
      </div>
    );
  }

  const jobs = data?.jobs ?? [];

  return (
    <div className="flex-1 overflow-y-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold text-mc-text">Cron Jobs</h2>
          <p className="text-xs text-mc-text-secondary mt-0.5">
            {jobs.length} scheduled job{jobs.length !== 1 ? 's' : ''}
            {lastUpdated && (
              <span className="ml-2 opacity-60">
                · {lastUpdated.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </p>
        </div>
        <button
          onClick={loadCron}
          className="text-xs text-mc-text-secondary hover:text-mc-text px-2 py-1 rounded border border-mc-border hover:border-mc-accent/40 transition-colors"
        >
          Refresh
        </button>
      </div>

      {jobs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-mc-text-secondary">
          <div className="text-5xl mb-4 opacity-40">⏰</div>
          <p className="text-sm">No cron jobs configured</p>
        </div>
      ) : (
        <div className="bg-mc-bg-secondary border border-mc-border rounded-xl glow-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-mc-border text-[10px] uppercase tracking-wider text-mc-text-secondary">
                <th className="text-left px-4 py-3 font-semibold">Name</th>
                <th className="text-left px-4 py-3 font-semibold">Agent</th>
                <th className="text-left px-4 py-3 font-semibold hidden md:table-cell">Schedule</th>
                <th className="text-left px-4 py-3 font-semibold hidden lg:table-cell">Last Run</th>
                <th className="text-left px-4 py-3 font-semibold">Status</th>
                <th className="text-left px-4 py-3 font-semibold hidden lg:table-cell">Next Run</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-mc-border">
              {jobs.map((job) => (
                <CronRow key={job.id} job={job} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function CronRow({ job }: { job: CronJob }) {
  const status = job.enabled
    ? (job.lastStatus || 'idle')
    : 'idle';

  const agentEmoji = AGENT_EMOJIS[job.agentId?.toLowerCase() || ''] || '🤖';

  return (
    <tr className="hover:bg-mc-bg/50 transition-colors">
      {/* Name */}
      <td className="px-4 py-3">
        <span className="text-xs font-mono text-mc-text font-medium">{job.name}</span>
      </td>

      {/* Agent */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5">
          <span className="text-sm">{agentEmoji}</span>
          <span className="text-xs text-mc-text-secondary capitalize">{job.agentId}</span>
        </div>
      </td>

      {/* Schedule */}
      <td className="px-4 py-3 hidden md:table-cell">
        <code className="text-[11px] text-mc-text-secondary bg-mc-bg px-2 py-0.5 rounded">
          {job.schedule}
        </code>
      </td>

      {/* Last Run */}
      <td className="px-4 py-3 hidden lg:table-cell">
        <span className="text-xs text-mc-text-secondary">{formatTime(job.lastRunAt)}</span>
      </td>

      {/* Status */}
      <td className="px-4 py-3">
        <StatusBadge status={status} enabled={job.enabled} />
      </td>

      {/* Next Run */}
      <td className="px-4 py-3 hidden lg:table-cell">
        <span className="text-xs text-mc-text-secondary">{formatTime(job.nextRunAt)}</span>
      </td>
    </tr>
  );
}

function StatusBadge({
  status, enabled,
}: {
  status: string; enabled: boolean;
}) {
  if (!enabled) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-mc-text-secondary/10 text-mc-text-secondary">
        <span className="w-1.5 h-1.5 rounded-full bg-mc-text-secondary/40" />
        Disabled
      </span>
    );
  }

  if (status === 'error') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-mc-accent-red/15 text-mc-accent-red">
        <span className="w-1.5 h-1.5 rounded-full bg-mc-accent-red" />
        Error
      </span>
    );
  }

  if (status === 'ok') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-mc-accent-green/15 text-mc-accent-green">
        <span className="w-1.5 h-1.5 rounded-full bg-mc-accent-green" />
        OK
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-mc-text-secondary/10 text-mc-text-secondary">
      <span className="w-1.5 h-1.5 rounded-full bg-mc-text-secondary/40" />
      Idle
    </span>
  );
}
