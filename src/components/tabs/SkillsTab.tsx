'use client';

import { useEffect, useState } from 'react';

type AgentSkills = {
  agentId: string;
  label: string;
  emoji: string;
  skills: string[];
};

const AGENT_META: Record<string, { label: string; emoji: string }> = {
  main:     { label: 'Eve',      emoji: '🦋' },
  dexter:   { label: 'Dexter',   emoji: '🤖' },
  sherlock: { label: 'Sherlock', emoji: '🔍' },
  shelby:   { label: 'Shelby',   emoji: '💼' },
  bluma:    { label: 'Bluma',    emoji: '🛡️' },
  goku:     { label: 'Goku',     emoji: '⚡' },
  monalisa: { label: 'Monalisa', emoji: '🎨' },
};

export function SkillsTab() {
  const [data, setData] = useState<AgentSkills[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['main', 'dexter']));

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/skills');
        if (res.ok) {
          const json = await res.json();
          setData(json);
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandAll = () => setExpanded(new Set(data.map((a) => a.agentId)));
  const collapseAll = () => setExpanded(new Set());

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-3 animate-pulse">🔧</div>
          <p className="text-mc-text-secondary text-sm">Loading skills...</p>
        </div>
      </div>
    );
  }

  const totalSkills = data.reduce((sum, a) => sum + a.skills.length, 0);

  return (
    <div className="flex-1 overflow-y-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold text-mc-text">Skills</h2>
          <p className="text-xs text-mc-text-secondary mt-0.5">
            {totalSkills} skills across {data.length} agents
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={expandAll}
            className="text-xs text-mc-text-secondary hover:text-mc-text px-2 py-1 rounded border border-mc-border hover:border-mc-accent/40 transition-colors"
          >
            Expand All
          </button>
          <button
            onClick={collapseAll}
            className="text-xs text-mc-text-secondary hover:text-mc-text px-2 py-1 rounded border border-mc-border hover:border-mc-accent/40 transition-colors"
          >
            Collapse All
          </button>
        </div>
      </div>

      {/* Accordion */}
      <div className="space-y-3">
        {data.map((agent) => {
          const isOpen = expanded.has(agent.agentId);
          return (
            <div
              key={agent.agentId}
              className="bg-mc-bg-secondary border border-mc-border rounded-xl glow-card overflow-hidden"
            >
              {/* Accordion Header */}
              <button
                onClick={() => toggleExpand(agent.agentId)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-mc-bg/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{agent.emoji}</span>
                  <div className="text-left">
                    <span className="text-sm font-semibold text-mc-text">{agent.label}</span>
                    <span className="text-xs text-mc-text-secondary ml-2">
                      {agent.skills.length} skill{agent.skills.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
                <span
                  className={`text-mc-text-secondary transition-transform duration-200 text-sm ${
                    isOpen ? 'rotate-180' : ''
                  }`}
                >
                  ▼
                </span>
              </button>

              {/* Accordion Body */}
              {isOpen && (
                <div className="px-4 pb-4 pt-1 border-t border-mc-border">
                  {agent.skills.length === 0 ? (
                    <p className="text-xs text-mc-text-secondary py-2 opacity-60">
                      No skills configured
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {agent.skills.map((skill) => (
                        <SkillBadge key={skill} skill={skill} />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {data.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-mc-text-secondary">
            <div className="text-5xl mb-4 opacity-40">🔧</div>
            <p className="text-sm">No skills found in openclaw.json</p>
          </div>
        )}
      </div>
    </div>
  );
}

function SkillBadge({ skill }: { skill: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-full bg-mc-accent/10 text-mc-accent border border-mc-accent/20 hover:bg-mc-accent/20 transition-colors cursor-default">
      <span className="opacity-70">⚡</span>
      {skill}
    </span>
  );
}
