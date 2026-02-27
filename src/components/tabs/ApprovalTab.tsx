'use client';

import { useEffect, useState } from 'react';
import type { Task } from '@/lib/types';

type TaskWithJoined = Task & { assigned_agent_emoji?: string; assigned_agent_name?: string };

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: 'numeric' });
}

function ApprovalCard({
  task,
  onApprove,
  onReject,
  processing,
}: {
  task: TaskWithJoined;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  processing: string | null;
}) {
  const isProcessing = processing === task.id;

  return (
    <div className={`bg-mc-bg-secondary border border-mc-border rounded-xl p-5 transition-all duration-200 ${isProcessing ? 'opacity-60 pointer-events-none' : 'hover:border-mc-accent-yellow/30'}`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-mc-text leading-snug">{task.title}</h3>
          {task.description && (
            <p className="text-xs text-mc-text-secondary mt-1 leading-relaxed line-clamp-2">
              {task.description}
            </p>
          )}
        </div>
        <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-mc-accent-yellow/10 text-mc-accent-yellow flex-shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-mc-accent-yellow animate-pulse" />
          รอ Approve
        </span>
      </div>

      <div className="flex items-center gap-3 mb-4 text-xs text-mc-text-secondary">
        {task.assigned_agent_name ? (
          <span className="flex items-center gap-1">
            <span>{task.assigned_agent_emoji || '🤖'}</span>
            <span>{task.assigned_agent_name}</span>
          </span>
        ) : (
          <span className="italic opacity-60">ยังไม่มี agent</span>
        )}
        <span className="opacity-40">·</span>
        <span>{formatDate(task.created_at)}</span>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => onApprove(task.id)}
          disabled={isProcessing}
          className="flex-1 flex items-center justify-center gap-2 py-2 px-4 bg-mc-accent-green/15 hover:bg-mc-accent-green/25 text-mc-accent-green border border-mc-accent-green/30 rounded-lg text-xs font-semibold transition-colors"
        >
          {isProcessing ? (
            <span className="animate-pulse">กำลังดำเนินการ...</span>
          ) : (
            <>✅ Approve</>
          )}
        </button>
        <button
          onClick={() => onReject(task.id)}
          disabled={isProcessing}
          className="flex-1 flex items-center justify-center gap-2 py-2 px-4 bg-mc-accent-red/15 hover:bg-mc-accent-red/25 text-mc-accent-red border border-mc-accent-red/30 rounded-lg text-xs font-semibold transition-colors"
        >
          {isProcessing ? (
            <span className="animate-pulse">กำลังดำเนินการ...</span>
          ) : (
            <>❌ Reject</>
          )}
        </button>
      </div>
    </div>
  );
}

type ToastType = 'approve' | 'reject' | null;

function Toast({ type, onDone }: { type: ToastType; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2500);
    return () => clearTimeout(t);
  }, [onDone]);

  if (!type) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        zIndex: 200,
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '10px 18px',
        borderRadius: '14px',
        background: type === 'approve' ? 'rgba(63,185,80,0.2)' : 'rgba(248,81,73,0.2)',
        color: type === 'approve' ? '#3fb950' : '#f85149',
        fontWeight: 700,
        fontSize: '14px',
        border: `1px solid ${type === 'approve' ? '#3fb950' : '#f85149'}`,
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      }}
    >
      {type === 'approve' ? '✅ Approved!' : '❌ Rejected'}
    </div>
  );
}

export function ApprovalTab() {
  const [tasks, setTasks]         = useState<TaskWithJoined[]>([]);
  const [loading, setLoading]     = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [toast, setToast]         = useState<ToastType>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const loadApprovals = async () => {
    try {
      // Fetch tasks with status = pending_approval
      const res = await fetch('/api/tasks?status=pending_approval');
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
    loadApprovals();
    const interval = setInterval(loadApprovals, 30000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleApprove = async (id: string) => {
    setProcessing(id);
    try {
      const res = await fetch(`/api/tasks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'approved' }),
      });
      if (res.ok) {
        setTasks((prev) => prev.filter((t) => t.id !== id));
        setToast('approve');
      }
    } catch {
      // ignore
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (id: string) => {
    setProcessing(id);
    try {
      const res = await fetch(`/api/tasks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'rejected' }),
      });
      if (res.ok) {
        setTasks((prev) => prev.filter((t) => t.id !== id));
        setToast('reject');
      }
    } catch {
      // ignore
    } finally {
      setProcessing(null);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-3 animate-pulse">✅</div>
          <p className="text-mc-text-secondary text-sm">Loading approvals...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex-shrink-0 px-6 pt-6 pb-4 border-b border-mc-border">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-mc-text">Approval</h2>
              <p className="text-xs text-mc-text-secondary mt-0.5">
                {tasks.length} รายการรอ Approve
                {lastUpdated && (
                  <span className="ml-2 opacity-60">
                    · updated {lastUpdated.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </p>
            </div>
            <button
              onClick={loadApprovals}
              className="text-xs text-mc-text-secondary hover:text-mc-text px-2 py-1 rounded border border-mc-border hover:border-mc-accent/40 transition-colors"
            >
              Refresh
            </button>
          </div>
        </div>

        {/* Approval List */}
        <div className="flex-1 overflow-y-auto p-6">
          {tasks.length === 0 ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <div className="text-5xl mb-4">✅</div>
                <p className="text-sm font-semibold text-mc-text">ไม่มีงานรออนุมัติ</p>
                <p className="text-xs text-mc-text-secondary mt-1">งานที่รอ Approve จะปรากฏที่นี่</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {tasks.map((task) => (
                <ApprovalCard
                  key={task.id}
                  task={task}
                  onApprove={handleApprove}
                  onReject={handleReject}
                  processing={processing}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Toast */}
      {toast && <Toast type={toast} onDone={() => setToast(null)} />}
    </>
  );
}
