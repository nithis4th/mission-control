'use client';

import { useState } from 'react';
import { Plus, ChevronRight, GripVertical } from 'lucide-react';
import { PixelOffice } from '@/components/PixelOffice';
import { useMissionControl } from '@/lib/store';
import { triggerAutoDispatch, shouldTriggerAutoDispatch } from '@/lib/auto-dispatch';
import type { Task, TaskStatus } from '@/lib/types';
import { TaskModal } from './TaskModal';
import { formatDistanceToNow } from 'date-fns';

interface MissionQueueProps {
  workspaceId?: string;
}

const COLUMNS: { id: TaskStatus; label: string; color: string }[] = [
  { id: 'planning', label: '📋 PLANNING', color: 'border-t-mc-accent-purple' },
  { id: 'inbox', label: 'INBOX', color: 'border-t-mc-accent-pink' },
  { id: 'assigned', label: 'ASSIGNED', color: 'border-t-mc-accent-yellow' },
  { id: 'in_progress', label: 'IN PROGRESS', color: 'border-t-mc-accent' },
  { id: 'testing', label: 'TESTING', color: 'border-t-mc-accent-cyan' },
  { id: 'review', label: 'REVIEW', color: 'border-t-mc-accent-purple' },
  { id: 'done', label: 'DONE', color: 'border-t-mc-accent-green' },
];

export function MissionQueue({ workspaceId }: MissionQueueProps) {
  const { tasks, updateTaskStatus, addEvent } = useMissionControl();
  const [activeTab, setActiveTab] = useState<'queue' | 'office'>('queue');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);

  const getTasksByStatus = (status: TaskStatus) =>
    tasks.filter((task) => task.status === status);

  const handleDragStart = (e: React.DragEvent, task: Task) => {
    setDraggedTask(task);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: React.DragEvent, targetStatus: TaskStatus) => {
    e.preventDefault();
    if (!draggedTask || draggedTask.status === targetStatus) {
      setDraggedTask(null);
      return;
    }

    // Optimistic update
    updateTaskStatus(draggedTask.id, targetStatus);

    // Persist to API
    try {
      const res = await fetch(`/api/tasks/${draggedTask.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: targetStatus }),
      });

      if (res.ok) {
        // Add event
        addEvent({
          id: crypto.randomUUID(),
          type: targetStatus === 'done' ? 'task_completed' : 'task_status_changed',
          task_id: draggedTask.id,
          message: `Task "${draggedTask.title}" moved to ${targetStatus}`,
          created_at: new Date().toISOString(),
        });

        // Check if auto-dispatch should be triggered and execute it
        if (shouldTriggerAutoDispatch(draggedTask.status, targetStatus, draggedTask.assigned_agent_id)) {
          const result = await triggerAutoDispatch({
            taskId: draggedTask.id,
            taskTitle: draggedTask.title,
            agentId: draggedTask.assigned_agent_id,
            agentName: draggedTask.assigned_agent?.name || 'Unknown Agent',
            workspaceId: draggedTask.workspace_id
          });

          if (!result.success) {
            console.error('Auto-dispatch failed:', result.error);
            // Optionally show error to user here if needed
          }
        }
      }
    } catch (error) {
      console.error('Failed to update task status:', error);
      // Revert on error
      updateTaskStatus(draggedTask.id, draggedTask.status);
    }

    setDraggedTask(null);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-3 border-b border-mc-border flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <ChevronRight className="w-4 h-4 text-mc-text-secondary shrink-0" />
          <div className="flex items-center gap-1 p-1 rounded-lg bg-mc-bg-tertiary/60 border border-mc-border/60">
            <button
              type="button"
              onClick={() => setActiveTab('queue')}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                activeTab === 'queue'
                  ? 'bg-mc-bg text-mc-text'
                  : 'text-mc-text-secondary hover:text-mc-text hover:bg-mc-bg/60'
              }`}
            >
              📋 Mission Queue
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('office')}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                activeTab === 'office'
                  ? 'bg-mc-bg text-mc-text'
                  : 'text-mc-text-secondary hover:text-mc-text hover:bg-mc-bg/60'
              }`}
            >
              🎮 Pixel Office
            </button>
          </div>
        </div>

        {activeTab === 'queue' && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-mc-accent-pink text-mc-bg rounded text-xs font-medium hover:bg-mc-accent-pink/90 shrink-0"
          >
            <Plus className="w-4 h-4" />
            New Task
          </button>
        )}
      </div>

      {activeTab === 'queue' ? (
        <>
          {/* Kanban Columns - Responsive for iPad Pro 11" */}
          {/* iPad landscape (>=1024px): 5 columns, iPad portrait (<1024px): scroll */}
          <div className="flex-1 min-h-0 flex gap-3 p-4 overflow-x-auto">
            {COLUMNS.map((column) => {
              const columnTasks = getTasksByStatus(column.id);
              return (
                <div
                  key={column.id}
                  className="flex-1 min-w-[180px] max-w-[20%] flex flex-col bg-mc-bg rounded-lg border border-mc-border/50 border-t-2"
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, column.id)}
                >
                  {/* Column Header - Compact */}
                  <div className="px-3 py-2 border-b border-mc-border flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wide text-mc-text-secondary">
                      {column.label}
                    </span>
                    <span className="text-[11px] bg-mc-bg-tertiary px-1.5 py-0.5 rounded text-mc-text-secondary font-medium">
                      {columnTasks.length}
                    </span>
                  </div>

                  {/* Tasks - Compact with vertical scroll */}
                  <div className="flex-1 overflow-y-auto p-2 space-y-2">
                    {columnTasks.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        onDragStart={handleDragStart}
                        onClick={() => setEditingTask(task)}
                        isDragging={draggedTask?.id === task.id}
                        showMoveButtons={true}
                        allColumns={COLUMNS}
                        currentColumn={column.id}
                        onMoveTask={(taskId, newStatus) => {
                          // Handle move without drag - use updateTaskStatus function
                          const taskToMove = tasks.find(t => t.id === taskId);
                          if (taskToMove) {
                            updateTaskStatus(taskToMove.id, newStatus as TaskStatus);
                          }
                        }}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Modals */}
          {showCreateModal && (
            <TaskModal onClose={() => setShowCreateModal(false)} workspaceId={workspaceId} />
          )}
          {editingTask && (
            <TaskModal task={editingTask} onClose={() => setEditingTask(null)} workspaceId={workspaceId} />
          )}
        </>
      ) : (
        <div className="flex-1 min-h-0 overflow-hidden p-3">
          <div className="h-full overflow-hidden rounded border border-mc-border/60 bg-mc-bg-secondary/30">
            <PixelOffice />
          </div>
        </div>
      )}
    </div>
  );
}

interface TaskCardProps {
  task: Task;
  onDragStart: (e: React.DragEvent, task: Task) => void;
  onClick: () => void;
  isDragging: boolean;
  showMoveButtons?: boolean;
  allColumns?: typeof COLUMNS;
  currentColumn?: string;
  onMoveTask?: (taskId: string, newStatus: string) => void;
}

function TaskCard({ task, onDragStart, onClick, isDragging, showMoveButtons, allColumns, currentColumn, onMoveTask }: TaskCardProps) {
  const priorityStyles = {
    low: 'text-mc-text-secondary',
    normal: 'text-mc-accent',
    high: 'text-mc-accent-yellow',
    urgent: 'text-mc-accent-red',
  };

  const priorityDots = {
    low: 'bg-mc-text-secondary/40',
    normal: 'bg-mc-accent',
    high: 'bg-mc-accent-yellow',
    urgent: 'bg-mc-accent-red',
  };

  const isPlanning = task.status === 'planning';

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, task)}
      onClick={onClick}
      className={`group bg-mc-bg-secondary border rounded-lg cursor-pointer transition-all hover:shadow-lg hover:shadow-black/20 ${
        isDragging ? 'opacity-50 scale-95' : ''
      } ${isPlanning ? 'border-purple-500/40 hover:border-purple-500' : 'border-mc-border/50 hover:border-mc-accent/40'}`}
    >
      {/* Drag handle bar - visible on hover (desktop) */}
      <div className="flex items-center justify-center py-1 border-b border-mc-border/30 opacity-0 group-hover:opacity-100 transition-opacity">
        <GripVertical className="w-3.5 h-3.5 text-mc-text-secondary/50 cursor-grab" />
      </div>

      {/* Card content - Compact */}
      <div className="p-3">
        {/* Title */}
        <h4 className="text-sm font-medium leading-snug line-clamp-2 mb-2">
          {task.title}
        </h4>
        
        {/* Description - max 2 lines */}
        {task.description && (
          <p className="text-xs text-mc-text-secondary line-clamp-2 mb-2">
            {task.description}
          </p>
        )}
        
        {/* Planning mode indicator */}
        {isPlanning && (
          <div className="flex items-center gap-2 mb-2 py-1.5 px-2 bg-purple-500/10 rounded-md border border-purple-500/20">
            <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse flex-shrink-0" />
            <span className="text-xs text-purple-400 font-medium">Continue planning</span>
          </div>
        )}

        {/* Assigned agent */}
        {task.assigned_agent && (
          <div className="flex items-center gap-2 mb-2 py-1 px-2 bg-mc-bg-tertiary/50 rounded">
            <span className="text-sm">{(task.assigned_agent as unknown as { avatar_emoji: string }).avatar_emoji}</span>
            <span className="text-xs text-mc-text-secondary truncate">
              {(task.assigned_agent as unknown as { name: string }).name}
            </span>
          </div>
        )}

        {/* Footer: priority + timestamp */}
        <div className="flex items-center justify-between pt-2 border-t border-mc-border/20">
          <div className="flex items-center gap-1.5">
            <div className={`w-1.5 h-1.5 rounded-full ${priorityDots[task.priority]}`} />
            <span className={`text-[11px] capitalize ${priorityStyles[task.priority]}`}>
              {task.priority}
            </span>
          </div>
          <span className="text-[10px] text-mc-text-secondary/60">
            {formatDistanceToNow(new Date(task.created_at), { addSuffix: true })}
          </span>
        </div>
      </div>

      {/* Move buttons - Touch friendly (visible on touch devices or always on mobile) */}
      {showMoveButtons && allColumns && currentColumn && onMoveTask && (
        <div className="flex items-center justify-between px-2 py-2 border-t border-mc-border/20 bg-mc-bg-tertiary/30 rounded-b-lg">
          {/* Move Left */}
          {allColumns.findIndex(c => c.id === currentColumn) > 0 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                const currentIdx = allColumns.findIndex(c => c.id === currentColumn);
                if (currentIdx > 0) {
                  onMoveTask(task.id, allColumns[currentIdx - 1].id);
                }
              }}
              className="flex items-center justify-center w-9 h-9 rounded bg-mc-bg-secondary hover:bg-mc-accent/20 hover:text-mc-accent transition-colors text-xs"
              title="Move left"
            >
              ◀️
            </button>
          )}
          <span className="text-[10px] text-mc-text-secondary/50">move</span>
          {/* Move Right */}
          {allColumns.findIndex(c => c.id === currentColumn) < allColumns.length - 1 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                const currentIdx = allColumns.findIndex(c => c.id === currentColumn);
                if (currentIdx < allColumns.length - 1) {
                  onMoveTask(task.id, allColumns[currentIdx + 1].id);
                }
              }}
              className="flex items-center justify-center w-9 h-9 rounded bg-mc-bg-secondary hover:bg-mc-accent/20 hover:text-mc-accent transition-colors text-xs"
              title="Move right"
            >
              ▶️
            </button>
          )}
        </div>
      )}
    </div>
  );
}
