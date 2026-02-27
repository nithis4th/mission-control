'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { Sidebar } from '@/components/Sidebar';
import { MissionQueue } from '@/components/MissionQueue';
import { LiveFeed } from '@/components/LiveFeed';
import { PixelOffice } from '@/components/PixelOffice';
import { SSEDebugPanel } from '@/components/SSEDebugPanel';
import { ChatPanel } from '@/components/ChatPanel';
import { TeamTab } from '@/components/tabs/TeamTab';
import { SoulTab } from '@/components/tabs/SoulTab';
import { CostTab } from '@/components/tabs/CostTab';
import { CronTab } from '@/components/tabs/CronTab';
import { SkillsTab } from '@/components/tabs/SkillsTab';
import { TaskTab } from '@/components/tabs/TaskTab';
import { ContentTab } from '@/components/tabs/ContentTab';
import { DocTab } from '@/components/tabs/DocTab';
import { ApprovalTab } from '@/components/tabs/ApprovalTab';
import { useMissionControl } from '@/lib/store';
import { useSSE } from '@/hooks/useSSE';
import { debug } from '@/lib/debug';
import type { Task, Workspace } from '@/lib/types';

export default function WorkspacePage() {
  const params = useParams();
  const slug = params.slug as string;

  const {
    setAgents,
    setTasks,
    setEvents,
    setIsOnline,
    setIsLoading,
    isLoading,
  } = useMissionControl();

  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [activeTab, setActiveTab] = useState('agents');

  // Connect to SSE for real-time updates
  useSSE();

  // Load workspace data
  useEffect(() => {
    async function loadWorkspace() {
      try {
        const res = await fetch(`/api/workspaces/${slug}`);
        if (res.ok) {
          const data = await res.json();
          setWorkspace(data);
        } else if (res.status === 404) {
          setNotFound(true);
          setIsLoading(false);
          return;
        }
      } catch (error) {
        console.error('Failed to load workspace:', error);
        setNotFound(true);
        setIsLoading(false);
        return;
      }
    }

    loadWorkspace();
  }, [slug, setIsLoading]);

  // Load workspace-specific data
  useEffect(() => {
    if (!workspace) return;

    const workspaceId = workspace.id;

    async function loadData() {
      try {
        debug.api('Loading workspace data...', { workspaceId });

        // Fetch workspace-scoped data
        const [agentsRes, tasksRes, eventsRes] = await Promise.all([
          fetch(`/api/agents?workspace_id=${workspaceId}`),
          fetch(`/api/tasks?workspace_id=${workspaceId}`),
          fetch('/api/events'),
        ]);

        if (agentsRes.ok) setAgents(await agentsRes.json());
        if (tasksRes.ok) {
          const tasksData = await tasksRes.json();
          debug.api('Loaded tasks', { count: tasksData.length });
          setTasks(tasksData);
        }
        if (eventsRes.ok) setEvents(await eventsRes.json());
      } catch (error) {
        console.error('Failed to load data:', error);
      } finally {
        setIsLoading(false);
      }
    }

    // Check OpenClaw connection separately (non-blocking)
    async function checkOpenClaw() {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const openclawRes = await fetch('/api/openclaw/status', { signal: controller.signal });
        clearTimeout(timeoutId);

        if (openclawRes.ok) {
          const status = await openclawRes.json();
          setIsOnline(status.connected);
        }
      } catch {
        setIsOnline(false);
      }
    }

    loadData();
    checkOpenClaw();

    // SSE is the primary real-time mechanism - these are fallback polls
    const eventPoll = setInterval(async () => {
      try {
        const res = await fetch('/api/events?limit=20');
        if (res.ok) {
          setEvents(await res.json());
        }
      } catch (error) {
        console.error('Failed to poll events:', error);
      }
    }, 30000);

    const taskPoll = setInterval(async () => {
      try {
        const res = await fetch(`/api/tasks?workspace_id=${workspaceId}`);
        if (res.ok) {
          const newTasks: Task[] = await res.json();
          const currentTasks = useMissionControl.getState().tasks;

          const hasChanges =
            newTasks.length !== currentTasks.length ||
            newTasks.some((t) => {
              const current = currentTasks.find((ct) => ct.id === t.id);
              return !current || current.status !== t.status;
            });

          if (hasChanges) {
            debug.api('[FALLBACK] Task changes detected via polling, updating store');
            setTasks(newTasks);
          }
        }
      } catch (error) {
        console.error('Failed to poll tasks:', error);
      }
    }, 60000);

    const connectionCheck = setInterval(async () => {
      try {
        const res = await fetch('/api/openclaw/status');
        if (res.ok) {
          const status = await res.json();
          setIsOnline(status.connected);
        }
      } catch {
        setIsOnline(false);
      }
    }, 30000);

    return () => {
      clearInterval(eventPoll);
      clearInterval(connectionCheck);
      clearInterval(taskPoll);
    };
  }, [workspace, setAgents, setTasks, setEvents, setIsOnline, setIsLoading]);

  if (notFound) {
    return (
      <div className="h-full bg-mc-bg flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">🔍</div>
          <h1 className="text-2xl font-bold mb-2">Workspace Not Found</h1>
          <p className="text-mc-text-secondary mb-6">
            The workspace &ldquo;{slug}&rdquo; doesn&apos;t exist.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 bg-mc-accent text-mc-bg rounded-lg font-medium hover:bg-mc-accent/90"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  if (isLoading || !workspace) {
    return (
      <div className="h-full bg-mc-bg flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4 animate-pulse">🦞</div>
          <p className="text-mc-text-secondary">Loading {slug}...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex bg-mc-bg overflow-hidden">
      {/* Left Sidebar Navigation */}
      <Sidebar
        workspaceSlug={workspace.slug}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Tab Content */}
        {activeTab === 'agents' && (
          <div className="flex-1 flex overflow-hidden">
            {/* Mission Queue */}
            <MissionQueue workspaceId={workspace.id} />
            {/* Live Feed */}
            <LiveFeed />
          </div>
        )}

        {activeTab === 'chat' && (
          <div className="flex-1 overflow-hidden">
            <ChatPanel fullPage />
          </div>
        )}

        {activeTab === 'activity' && (
          <div className="flex-1 flex overflow-hidden">
            <div className="flex-1 overflow-y-auto">
              <LiveFeed expanded />
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="text-6xl mb-4">📜</div>
              <h2 className="text-xl font-bold mb-2">Chat History</h2>
              <p className="text-mc-text-secondary">
                Browse past conversations by topic.
              </p>
              <p className="text-mc-text-secondary text-xs mt-2">
                Coming soon...
              </p>
            </div>
          </div>
        )}

        {activeTab === 'team' && (
          <div className="flex-1 flex overflow-hidden">
            <TeamTab />
          </div>
        )}

        {activeTab === 'soul' && (
          <div className="flex-1 flex overflow-hidden">
            <SoulTab />
          </div>
        )}

        {activeTab === 'cost' && (
          <div className="flex-1 flex overflow-hidden">
            <CostTab />
          </div>
        )}

        {activeTab === 'cron' && (
          <div className="flex-1 flex overflow-hidden">
            <CronTab />
          </div>
        )}

        {activeTab === 'skills' && (
          <div className="flex-1 flex overflow-hidden">
            <SkillsTab />
          </div>
        )}

        {activeTab === 'tasks' && (
          <div className="flex-1 flex overflow-hidden">
            <TaskTab />
          </div>
        )}

        {activeTab === 'content' && (
          <div className="flex-1 flex overflow-hidden">
            <ContentTab />
          </div>
        )}

        {activeTab === 'docs' && (
          <div className="flex-1 flex overflow-hidden">
            <DocTab />
          </div>
        )}

        {activeTab === 'approval' && (
          <div className="flex-1 flex overflow-hidden">
            <ApprovalTab />
          </div>
        )}

        {/* Fallback for remaining comingSoon tabs */}
        {activeTab === 'office' && (
          <div className="flex-1 flex overflow-hidden min-h-0">
            <PixelOffice compact />
            <LiveFeed />
          </div>
        )}
      </div>

      {/* Debug Panel - only shows when debug mode enabled */}
      <SSEDebugPanel />

      {/* Floating Chat with Eve — only on non-chat tabs */}
      {activeTab !== 'chat' && <ChatPanel />}
    </div>
  );
}
