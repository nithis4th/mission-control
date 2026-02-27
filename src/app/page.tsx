'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AgentsSidebar } from '@/components/AgentsSidebar';
import { MissionQueue } from '@/components/MissionQueue';
import { LiveFeed } from '@/components/LiveFeed';
import { PixelOffice } from '@/components/PixelOffice';
import { SSEDebugPanel } from '@/components/SSEDebugPanel';
import { ChatPanel } from '@/components/ChatPanel';
import { useSSE } from '@/hooks/useSSE';
import { useMissionControl } from '@/lib/store';

const DEFAULT_WORKSPACE_ID = 'default';

export default function HomePage() {
  const { setAgents, setTasks, setEvents, setIsOnline, setIsLoading } = useMissionControl();

  useSSE();

  useEffect(() => {
    async function loadData() {
      try {
        const [agentsRes, tasksRes, eventsRes] = await Promise.all([
          fetch(`/api/agents?workspace_id=${DEFAULT_WORKSPACE_ID}`),
          fetch(`/api/tasks?workspace_id=${DEFAULT_WORKSPACE_ID}`),
          fetch('/api/events?limit=20'),
        ]);

        if (agentsRes.ok) setAgents(await agentsRes.json());
        if (tasksRes.ok) setTasks(await tasksRes.json());
        if (eventsRes.ok) setEvents(await eventsRes.json());
      } finally {
        setIsLoading(false);
      }
    }

    async function checkOpenClaw() {
      try {
        const res = await fetch('/api/openclaw/status');
        if (res.ok) {
          const status = await res.json();
          setIsOnline(status.connected);
        }
      } catch {
        setIsOnline(false);
      }
    }

    loadData();
    checkOpenClaw();

    const eventsPoll = setInterval(async () => {
      try {
        const res = await fetch('/api/events?limit=20');
        if (res.ok) setEvents(await res.json());
      } catch {}
    }, 30000);

    const tasksPoll = setInterval(async () => {
      try {
        const res = await fetch(`/api/tasks?workspace_id=${DEFAULT_WORKSPACE_ID}`);
        if (res.ok) setTasks(await res.json());
      } catch {}
    }, 60000);

    const connPoll = setInterval(checkOpenClaw, 30000);

    return () => {
      clearInterval(eventsPoll);
      clearInterval(tasksPoll);
      clearInterval(connPoll);
    };
  }, [setAgents, setEvents, setIsLoading, setIsOnline, setTasks]);

  return (
    <div className="h-full overflow-hidden flex flex-col bg-mc-bg">
      <section className="h-[230px] min-h-[230px] border-b border-mc-border bg-mc-bg-secondary/40 overflow-hidden">
        <div className="h-full p-2 md:p-3">
          <div className="flex items-center justify-between px-1 pb-1">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-mc-text-secondary">Pixel Office</h2>
            <Link href="/office" className="text-[10px] text-mc-text-secondary hover:text-mc-text transition-colors">
              Full office
            </Link>
          </div>
          <div className="h-[calc(100%-20px)] overflow-hidden rounded border border-mc-border/60">
            <PixelOffice compact />
          </div>
        </div>
      </section>

      <section className="flex-1 min-h-0 flex overflow-hidden">
        <AgentsSidebar workspaceId={DEFAULT_WORKSPACE_ID} />
        <MissionQueue workspaceId={DEFAULT_WORKSPACE_ID} />
        <LiveFeed />
      </section>

      <SSEDebugPanel />
      <ChatPanel />
    </div>
  );
}
