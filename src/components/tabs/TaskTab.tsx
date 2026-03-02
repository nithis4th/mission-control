'use client';
import VisualWorkflowBoard from './VisualWorkflowBoard';

import { useEffect, useState } from 'react';
import type { Task } from '@/lib/types';

type FilterType = 'all' | 'in_progress' | 'pending' | 'done';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  pending:     { label: 'Pending',     color: 'text-mc-accent-yellow', bg: 'bg-mc-accent-yellow/10', dot: 'bg-mc-accent-yellow' },
  inbox:       { label: 'Inbox',       color: 'text-mc-accent-yellow', bg: 'bg-mc-accent-yellow/10', dot: 'bg-mc-accent-yellow' },
  planning:    { label: 'Planning',    color: 'text-mc-accent-yellow', bg: 'bg-mc-accent-yellow/10', dot: 'bg-mc-accent-yellow' },
  in_progress: { label: 'In Progress', color: 'text-mc-accent',        bg: 'bg-mc-accent/10',        dot: 'bg-mc-accent' },
  assigned:    { label: 'Assigned',    color: 'text-mc-accent',        bg: 'bg-mc-accent/10',        dot: 'bg-mc-accent' },
  testing:     { label: 'Testing',     color: 'text-mc-accent',        bg: 'bg-mc-accent/10',        dot: 'bg-mc-accent' },
  review:      { label: 'Review',      color: 'text-mc-accent-purple', bg: 'bg-mc-accent-purple/10', dot: 'bg-mc-accent-purple' },
  done:        { label: 'Done',        color: 'text-mc-accent-green',  bg: 'bg-mc-accent-green/10',  dot: 'bg-mc-accent-green' },
  error:       { label: 'Error',       color: 'text-mc-accent-red',    bg: 'bg-mc-accent-red/10',    dot: 'bg-mc-accent-red' },
};

const FILTER_TABS: { id: FilterType; label: string }[] = [
  { id: 'all',         label: 'All' },
  { id: 'in_progress', label: 'In Progress' },
  { id: 'pending',     label: 'Pending' },
  { id: 'done',        label: 'Done' },
];

function filterTasks(tasks: Task[], filter: FilterType): Task[] {
  if (filter === 'all')         return tasks;
  if (filter === 'in_progress') return tasks.filter(t => ['in_progress', 'assigned', 'testing', 'review'].includes(t.status));
  if (filter === 'pending')     return tasks.filter(t => ['inbox', 'planning', 'pending'].includes(t.status));
  if (filter === 'done')        return tasks.filter(t => t.status === 'done');
  return tasks;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: 'numeric' });
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG['pending'];
  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

type TaskWithJoined = Task & { assigned_agent_emoji?: string; assigned_agent_name?: string };

function TaskRow({ task }: { task: TaskWithJoined }) {
  return (
    <div className="flex items-start justify-between gap-3 py-3.5 px-4 hover:bg-mc-bg-tertiary/40 transition-colors border-b border-mc-border last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-mc-text truncate">{task.title}</p>
        {task.description && (
          <p className="text-xs text-mc-text-secondary mt-0.5 truncate">{task.description}</p>
        )}
        <div className="flex items-center gap-3 mt-1.5">
          {task.assigned_agent_name ? (
            <span className="text-[11px] text-mc-text-secondary flex items-center gap-1">
              <span>{task.assigned_agent_emoji || '🤖'}</span>
              <span>{task.assigned_agent_name}</span>
            </span>
          ) : (
            <span className="text-[11px] text-mc-text-secondary/50 italic">ยังไม่ได้มอบหมาย</span>
          )}
          <span className="text-[10px] text-mc-text-secondary/40">
            {formatDate(task.created_at)}
          </span>
        </div>
      </div>
      <div className="flex-shrink-0 pt-0.5">
        <StatusBadge status={task.status} />
      </div>
    </div>
  );
}

function EmptyState({ filter }: { filter: FilterType }) {
  const msgs: Record<FilterType, { emoji: string; title: string; sub: string }> = {
    all:         { emoji: '📋', title: 'ยังไม่มีงาน', sub: 'งานใหม่จะปรากฏที่นี่เมื่อถูกสร้าง' },
    in_progress: { emoji: '⚡', title: 'ไม่มีงานที่กำลังทำ', sub: 'งานที่อยู่ระหว่างดำเนินการจะแสดงที่นี่' },
    pending:     { emoji: '⏳', title: 'ไม่มีงานรอ', sub: 'งานใหม่ที่ยังไม่เริ่มจะแสดงที่นี่' },
    done:        { emoji: '✅', title: 'ยังไม่มีงานเสร็จ', sub: 'งานที่ทำเสร็จแล้วจะปรากฏที่นี่' },
  };
  const m = msgs[filter];
  return (
    <div className="flex-1 flex items-center justify-center py-20">
      <div className="text-center">
        <div className="text-5xl mb-3">{m.emoji}</div>
        <p className="text-sm font-medium text-mc-text">{m.title}</p>
        <p className="text-xs text-mc-text-secondary mt-1">{m.sub}</p>
      </div>
    </div>
  );
}

export function TaskTab() {
  const [tasks, setTasks]     = useState<TaskWithJoined[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState<FilterType>('all');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const loadTasks = async () => {
    try {
      const res = await fetch('/api/tasks');
      if (res.ok) {
        setTasks(await res.json());
        setLastUpdated(new Date());
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();
    const interval = setInterval(loadTasks, 30000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = filterTasks(tasks, filter);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-3 animate-pulse">📋</div>
          <p className="text-mc-text-secondary text-sm">Loading tasks...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 px-6 pt-6 pb-4 border-b border-mc-border">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-mc-text">Tasks</h2>
            <p className="text-xs text-mc-text-secondary mt-0.5">
              {tasks.length} งานทั้งหมด
              {lastUpdated && (
                <span className="ml-2 opacity-60">
                  · updated {lastUpdated.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </p>
          </div>
          <button
            onClick={loadTasks}
            className="text-xs text-mc-text-secondary hover:text-mc-text px-2 py-1 rounded border border-mc-border hover:border-mc-accent/40 transition-colors"
          >
            Refresh
          </button>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-1">
          {FILTER_TABS.map((tab) => {
            const count = filterTasks(tasks, tab.id).length;
            const isActive = filter === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setFilter(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-mc-accent/15 text-mc-accent border border-mc-accent/30'
                    : 'text-mc-text-secondary hover:text-mc-text hover:bg-mc-bg-tertiary border border-transparent'
                }`}
              >
                {tab.label}
                <span className={`text-[10px] px-1 rounded-full ${isActive ? 'bg-mc-accent/20 text-mc-accent' : 'bg-mc-bg text-mc-text-secondary'}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Task List */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <EmptyState filter={filter} />
        ) : (
          <div>
            {filtered.map((task) => (
              <TaskRow key={task.id} task={task} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
