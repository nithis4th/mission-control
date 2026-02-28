'use client';

import { useEffect, useState, useCallback } from 'react';

const AGENTS = [
  { id: 'main',     label: 'Eve 🦋' },
  { id: 'dexter',   label: 'Dexter 🤖' },
  { id: 'sherlock', label: 'Sherlock 🔍' },
  { id: 'shelby',   label: 'Shelby 💼' },
  { id: 'bluma',    label: 'Bluma 🛡️' },
  { id: 'goku',     label: 'Goku ⚡' },
  { id: 'monalisa', label: 'Monalisa 🎨' },
];

export function SoulTab() {
  const [selectedAgent, setSelectedAgent] = useState('main');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [dirty, setDirty] = useState(false);

  const loadSoul = useCallback(async (agentId: string) => {
    setLoading(true);
    setDirty(false);
    try {
      const res = await fetch(`/api/soul?agent=${agentId}`);
      if (res.ok) {
        const data = await res.json();
        setContent(data.content || '');
      } else {
        setContent('');
      }
    } catch {
      setContent('');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    try {
      const preferred = localStorage.getItem('mc.soul.selectedAgent');
      if (preferred && AGENTS.some((a) => a.id === preferred)) {
        setSelectedAgent(preferred);
      }
      localStorage.removeItem('mc.soul.selectedAgent');
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    loadSoul(selectedAgent);
  }, [selectedAgent, loadSoul]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/soul', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent: selectedAgent, content }),
      });
      if (res.ok) {
        setDirty(false);
        setToast({ type: 'success', msg: '✅ SOUL.md saved!' });
      } else {
        const data = await res.json();
        setToast({ type: 'error', msg: `❌ ${data.error || 'Save failed'}` });
      }
    } catch {
      setToast({ type: 'error', msg: '❌ Network error' });
    } finally {
      setSaving(false);
      setTimeout(() => setToast(null), 3000);
    }
  };

  const handleChange = (val: string) => {
    setContent(val);
    setDirty(true);
  };

  const currentAgent = AGENTS.find((a) => a.id === selectedAgent);

  return (
    <div className="flex-1 flex flex-col overflow-hidden p-6 gap-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <h2 className="text-lg font-bold text-mc-text">Soul Editor</h2>
          <p className="text-xs text-mc-text-secondary mt-0.5">Edit agent identity files (SOUL.md)</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Agent Dropdown */}
          <select
            value={selectedAgent}
            onChange={(e) => setSelectedAgent(e.target.value)}
            className="bg-mc-bg-secondary border border-mc-border rounded-lg px-3 py-1.5 text-sm text-mc-text focus:outline-none focus:border-mc-accent cursor-pointer"
          >
            {AGENTS.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </select>
          {/* Save Button */}
          <button
            onClick={handleSave}
            disabled={saving || loading || !dirty}
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${
              dirty && !saving && !loading
                ? 'bg-mc-accent text-mc-bg hover:bg-mc-accent/90 shadow-sm shadow-mc-accent/30'
                : 'bg-mc-bg-secondary text-mc-text-secondary border border-mc-border cursor-not-allowed opacity-60'
            }`}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {/* Agent Info Bar */}
      <div className="flex-shrink-0 flex items-center gap-2 px-3 py-2 bg-mc-bg-secondary rounded-lg border border-mc-border text-xs text-mc-text-secondary">
        <span className="font-semibold text-mc-text">{currentAgent?.label}</span>
        <span className="opacity-40">·</span>
        <span className="font-mono opacity-70">SOUL.md</span>
        {dirty && (
          <>
            <span className="opacity-40">·</span>
            <span className="text-mc-accent-yellow font-semibold">unsaved changes</span>
          </>
        )}
      </div>

      {/* Editor */}
      <div className="flex-1 relative min-h-0">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="text-3xl mb-2 animate-pulse">🧠</div>
              <p className="text-mc-text-secondary text-sm">Loading SOUL.md...</p>
            </div>
          </div>
        ) : (
          <textarea
            value={content}
            onChange={(e) => handleChange(e.target.value)}
            className="w-full h-full bg-mc-bg border border-mc-border rounded-xl p-4 font-mono text-sm text-mc-text resize-none focus:outline-none focus:border-mc-accent/60 leading-relaxed"
            placeholder="# SOUL.md&#10;&#10;Agent identity file is empty or not found..."
            spellCheck={false}
          />
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl text-sm font-semibold shadow-lg ${
            toast.type === 'success'
              ? 'bg-mc-accent-green/20 text-mc-accent-green border border-mc-accent-green/30'
              : 'bg-mc-accent-red/20 text-mc-accent-red border border-mc-accent-red/30'
          }`}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}
