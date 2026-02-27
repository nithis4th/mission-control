import { NextResponse } from 'next/server';
import { execSync } from 'child_process';

export const dynamic = 'force-dynamic';

type RawJob = {
  id: string;
  agentId: string;
  name: string;
  enabled: boolean;
  schedule?: { kind?: string; expr?: string; tz?: string };
  state?: { nextRunAtMs?: number; lastRunAtMs?: number; lastError?: string; lastStatus?: string };
  createdAtMs?: number;
  updatedAtMs?: number;
};

// GET /api/cron
export async function GET() {
  try {
    let rawOutput = '';
    try {
      rawOutput = execSync('openclaw cron list --json 2>/dev/null', {
        timeout: 10000,
        encoding: 'utf-8',
        env: { ...process.env, PATH: '/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:' + (process.env.PATH || '') },
      });
    } catch {
      return NextResponse.json({ jobs: [], error: 'openclaw unavailable' });
    }

    const parsed = JSON.parse(rawOutput);
    const rawJobs: RawJob[] = parsed.jobs || [];

    const jobs = rawJobs.map((job) => {
      const scheduleStr =
        job.schedule?.kind === 'cron'
          ? job.schedule.expr || ''
          : job.schedule?.kind === 'interval'
          ? `interval`
          : String(job.schedule?.expr || job.schedule?.kind || '');

      const lastStatus = job.state?.lastError
        ? 'error'
        : job.state?.lastStatus === 'ok'
        ? 'ok'
        : 'idle';

      return {
        id: job.id,
        name: job.name,
        agentId: job.agentId,
        enabled: job.enabled,
        schedule: scheduleStr,
        lastRunAt: job.state?.lastRunAtMs ? new Date(job.state.lastRunAtMs).toISOString() : null,
        lastStatus,
        nextRunAt: job.state?.nextRunAtMs ? new Date(job.state.nextRunAtMs).toISOString() : null,
      };
    });

    return NextResponse.json({ jobs });
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error, jobs: [] }, { status: 500 });
  }
}
