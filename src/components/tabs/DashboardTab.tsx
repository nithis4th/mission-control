'use client';

import { Pencil } from 'lucide-react';
import { useEffect, useState } from 'react';

interface VersionItem {
  label: string;
  tag: string;
  hash: string;
  shortHash: string;
  timestamp: string;
  message: string;
}

export function DashboardTab() {
  const [versions, setVersions] = useState<VersionItem[]>([]);
  const [currentBranch, setCurrentBranch] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [label, setLabel] = useState('');
  const [busyRef, setBusyRef] = useState<string | null>(null);
  const [diffOpen, setDiffOpen] = useState(false);
  const [diffTitle, setDiffTitle] = useState('');
  const [diffFiles, setDiffFiles] = useState<string[]>([]);
  const [diffText, setDiffText] = useState('');
  const [editingTag, setEditingTag] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState('');

  const loadVersions = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/versions?limit=100');
      const data = await res.json();
      setVersions(data.versions || []);
      setCurrentBranch(data.currentBranch || '');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVersions();
  }, []);

  const saveVersion = async () => {
    setMsg('');
    const v = label.trim();
    if (!v) {
      setMsg('❌ Please enter a version label');
      return;
    }

    const res = await fetch('/api/versions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: v }),
    });
    const data = await res.json();

    if (res.ok) {
      setMsg(`✅ Saved version ${data.version.tag}`);
      setLabel('');
      loadVersions();
    } else {
      setMsg(`❌ ${data.error || 'save failed'}`);
    }
  };

  const previewDiff = async (ref: string) => {
    setBusyRef(ref);
    setMsg('');
    try {
      const res = await fetch(`/api/versions/${encodeURIComponent(ref)}/diff`);
      const data = await res.json();
      if (res.ok) {
        setDiffTitle(ref);
        setDiffFiles(data.files || []);
        setDiffText(data.diffText || '');
        setDiffOpen(true);
      } else {
        setMsg(`❌ ${data.error || 'diff failed'}`);
      }
    } finally {
      setBusyRef(null);
    }
  };

  const restore = async (ref: string, lbl: string) => {
    if (!confirm(`Restore ${lbl} (${ref}) ใช่ไหม?`)) return;
    setBusyRef(ref);
    setMsg('');
    try {
      const res = await fetch(`/api/versions/${encodeURIComponent(ref)}/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: lbl }),
      });
      const data = await res.json();
      if (res.ok) {
        setMsg(`✅ Switched to ${data.switchedToBranch || data.branch}`);
        await loadVersions();
      } else {
        setMsg(`❌ ${data.error || 'restore failed'}`);
      }
    } finally {
      setBusyRef(null);
    }
  };

  const removeVersion = async (tag: string, lbl: string) => {
    if (!confirm(`ลบ ${lbl} ใช่ไหม?`)) return;
    setBusyRef(tag);
    setMsg('');
    try {
      const res = await fetch(`/api/versions/${encodeURIComponent(tag)}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        setMsg(`✅ Deleted ${data.deletedTag}`);
        await loadVersions();
      } else {
        setMsg(`❌ ${data.error || 'delete failed'}`);
      }
    } finally {
      setBusyRef(null);
    }
  };

  const startEdit = (v: VersionItem) => {
    setEditingTag(v.tag);
    setEditingLabel(v.label);
  };

  const saveEdit = async (tag: string) => {
    const newLabel = editingLabel.trim();
    if (!newLabel) {
      setMsg('❌ new label required');
      return;
    }
    setBusyRef(tag);
    setMsg('');
    try {
      const res = await fetch(`/api/versions/${encodeURIComponent(tag)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newLabel }),
      });
      const data = await res.json();
      if (res.ok) {
        setMsg(`✅ Renamed to ${data.newTag}`);
        setEditingTag(null);
        setEditingLabel('');
        await loadVersions();
      } else {
        setMsg(`❌ ${data.error || 'rename failed'}`);
      }
    } finally {
      setBusyRef(tag);
      setBusyRef(null);
    }
  };

  const isActiveVersion = (v: VersionItem) => currentBranch.includes(v.shortHash);

  // Version Control is disabled - redirect to agents instead
  const showVersionControl = false;
  if (!showVersionControl) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center text-mc-text-secondary">
          <p>Version Control is disabled.</p>
          <p className="text-sm mt-2">Use the sidebar to navigate to other sections.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold">Version Control</h2>
            <p className="text-sm text-mc-text-secondary">Git-based named versions for safe rollback</p>
            <p className="text-xs text-mc-text-secondary mt-1">Current branch: <span className="font-mono">{currentBranch || '-'}</span></p>
          </div>
          <div className="flex items-center gap-2">
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="px-3 py-2 rounded bg-mc-bg border border-mc-border text-sm min-w-64"
              placeholder="version label"
            />
            <button onClick={saveVersion} className="px-3 py-2 rounded bg-mc-accent text-mc-bg text-sm font-medium">
              Save Current Version
            </button>
            <button onClick={loadVersions} className="px-3 py-2 rounded bg-mc-bg-tertiary hover:bg-mc-border text-sm">
              Refresh
            </button>
          </div>
        </div>

        {msg && <div className="text-sm p-3 rounded bg-mc-bg-secondary border border-mc-border">{msg}</div>}

        <div className="rounded-xl border border-mc-border bg-mc-bg-secondary overflow-hidden">
          <div className="px-4 py-3 border-b border-mc-border font-medium text-sm">Rollback Points</div>

          {loading ? (
            <div className="p-4 text-sm text-mc-text-secondary">Loading...</div>
          ) : versions.length === 0 ? (
            <div className="p-4 text-sm text-mc-text-secondary">No versions yet</div>
          ) : (
            <div className="divide-y divide-mc-border">
              {versions.map((v) => (
                <div
                  key={v.tag}
                  className={`p-4 flex items-center justify-between gap-4 ${isActiveVersion(v) ? 'border-l-4 border-green-400 bg-green-500/5' : ''}`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      {editingTag === v.tag ? (
                        <>
                          <input
                            value={editingLabel}
                            onChange={(e) => setEditingLabel(e.target.value)}
                            className="px-2 py-1 rounded bg-mc-bg border border-mc-border text-sm"
                          />
                          <button onClick={() => saveEdit(v.tag)} className="text-xs px-2 py-1 rounded bg-mc-accent/20">Save</button>
                          <button onClick={() => setEditingTag(null)} className="text-xs px-2 py-1 rounded bg-mc-bg-tertiary">Cancel</button>
                        </>
                      ) : (
                        <>
                          <div className="text-sm font-semibold truncate">{v.label}</div>
                          <button onClick={() => startEdit(v)} title="Edit label" className="p-1 rounded hover:bg-mc-bg-tertiary">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          {isActiveVersion(v) && <span className="text-[10px] px-2 py-0.5 rounded bg-green-500/20 text-green-300">ACTIVE</span>}
                        </>
                      )}
                    </div>
                    <div className="text-xs text-mc-text-secondary">{new Date(v.timestamp).toLocaleString()} · {v.shortHash}</div>
                    <div className="text-[11px] text-mc-text-secondary truncate">{v.tag}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => previewDiff(v.tag)}
                      disabled={busyRef === v.tag}
                      className="px-3 py-2 rounded bg-mc-bg-tertiary hover:bg-mc-border text-sm disabled:opacity-50"
                    >
                      Preview Diff
                    </button>
                    <button
                      onClick={() => restore(v.tag, v.label)}
                      disabled={busyRef === v.tag}
                      className="px-3 py-2 rounded bg-red-500/20 hover:bg-red-500/30 text-red-300 text-sm disabled:opacity-50"
                    >
                      Restore
                    </button>
                    <button
                      onClick={() => removeVersion(v.tag, v.label)}
                      disabled={busyRef === v.tag}
                      className="px-3 py-2 rounded bg-red-900/30 hover:bg-red-900/50 text-red-200 text-sm disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {diffOpen && (
          <div className="rounded-xl border border-mc-border bg-mc-bg-secondary overflow-hidden">
            <div className="px-4 py-3 border-b border-mc-border font-medium text-sm flex items-center justify-between">
              <span>Diff Preview · {diffTitle}</span>
              <button onClick={() => setDiffOpen(false)} className="text-xs px-2 py-1 rounded bg-mc-bg-tertiary">Close</button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <div className="text-xs font-semibold mb-1 text-mc-text-secondary">Changed Files ({diffFiles.length})</div>
                <div className="flex flex-wrap gap-2">
                  {diffFiles.map((f) => (
                    <span key={f} className="px-2 py-1 text-xs rounded bg-mc-bg border border-mc-border font-mono">{f}</span>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-xs font-semibold mb-1 text-mc-text-secondary">Diff</div>
                <pre className="text-xs whitespace-pre-wrap break-words max-h-[420px] overflow-y-auto bg-mc-bg p-3 rounded border border-mc-border">{diffText || 'No differences.'}</pre>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
