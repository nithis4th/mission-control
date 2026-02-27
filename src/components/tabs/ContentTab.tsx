'use client';

import { useEffect, useState } from 'react';

interface BriefItem {
  filename: string;
  title: string;
  summary: string;
  date: string;
  dateLabel: 'today' | 'yesterday' | 'earlier';
  content: string;
}

interface ContentData {
  items: BriefItem[];
  empty: boolean;
}

const DATE_LABEL_MAP = {
  today:     { label: 'Today',     color: 'text-mc-accent-green' },
  yesterday: { label: 'Yesterday', color: 'text-mc-accent-yellow' },
  earlier:   { label: 'Earlier',   color: 'text-mc-text-secondary' },
};

function formatDateDisplay(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function BriefCard({ item, onOpen }: { item: BriefItem; onOpen: (item: BriefItem) => void }) {
  return (
    <div
      className="bg-mc-bg-secondary border border-mc-border rounded-xl p-4 hover:border-mc-accent/30 hover:shadow-md hover:-translate-y-0.5 transition-all duration-150 cursor-pointer group"
      onClick={() => onOpen(item)}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <h3 className="text-sm font-semibold text-mc-text group-hover:text-mc-accent transition-colors line-clamp-2 flex-1">
          {item.title}
        </h3>
        <span className="text-[10px] text-mc-text-secondary/60 flex-shrink-0 mt-0.5 font-mono">
          {new Date(item.date + 'T00:00:00').toLocaleDateString('th-TH', { day: '2-digit', month: 'short' })}
        </span>
      </div>
      {item.summary && (
        <p className="text-xs text-mc-text-secondary line-clamp-2 leading-relaxed">{item.summary}</p>
      )}
      <div className="mt-3 flex items-center justify-between">
        <span className="text-[10px] text-mc-text-secondary/50 font-mono">{item.filename}</span>
        <span className="text-[10px] text-mc-accent opacity-0 group-hover:opacity-100 transition-opacity">อ่านต่อ →</span>
      </div>
    </div>
  );
}

function ContentModal({ item, onClose }: { item: BriefItem; onClose: () => void }) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-mc-bg-secondary border border-mc-border rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-mc-border flex-shrink-0">
          <div className="flex-1 min-w-0 pr-4">
            <h2 className="text-base font-bold text-mc-text truncate">{item.title}</h2>
            <p className="text-xs text-mc-text-secondary mt-0.5">{formatDateDisplay(item.date)}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-mc-bg-tertiary text-mc-text-secondary hover:text-mc-text transition-colors flex-shrink-0 text-lg leading-none"
          >
            ×
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          <pre className="text-xs text-mc-text font-mono leading-relaxed whitespace-pre-wrap break-words">
            {item.content}
          </pre>
        </div>
      </div>
    </div>
  );
}

type Section = 'today' | 'yesterday' | 'earlier';

const SECTIONS: Section[] = ['today', 'yesterday', 'earlier'];

export function ContentTab() {
  const [data, setData]       = useState<ContentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [openItem, setOpenItem] = useState<BriefItem | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const loadContent = async () => {
    try {
      const res = await fetch('/api/content');
      if (res.ok) {
        setData(await res.json());
        setLastUpdated(new Date());
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadContent();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-3 animate-pulse">📰</div>
          <p className="text-mc-text-secondary text-sm">Loading content...</p>
        </div>
      </div>
    );
  }

  if (!data || data.empty || data.items.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center max-w-sm mx-auto">
          <div className="text-5xl mb-4">📭</div>
          <p className="text-sm font-medium text-mc-text mb-2">ยังไม่มีข้อมูล</p>
          <p className="text-xs text-mc-text-secondary leading-relaxed">
            content จะแสดงหลัง morning-brief รัน
          </p>
          <p className="text-[10px] text-mc-text-secondary/50 mt-3 font-mono">
            /Users/nithis4th/.openclaw/workspace/memory/briefs/
          </p>
        </div>
      </div>
    );
  }

  const grouped: Record<Section, BriefItem[]> = {
    today:     data.items.filter((i) => i.dateLabel === 'today'),
    yesterday: data.items.filter((i) => i.dateLabel === 'yesterday'),
    earlier:   data.items.filter((i) => i.dateLabel === 'earlier'),
  };

  return (
    <>
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex-shrink-0 px-6 pt-6 pb-4 border-b border-mc-border">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-mc-text">Content</h2>
              <p className="text-xs text-mc-text-secondary mt-0.5">
                {data.items.length} briefs
                {lastUpdated && (
                  <span className="ml-2 opacity-60">
                    · updated {lastUpdated.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </p>
            </div>
            <button
              onClick={loadContent}
              className="text-xs text-mc-text-secondary hover:text-mc-text px-2 py-1 rounded border border-mc-border hover:border-mc-accent/40 transition-colors"
            >
              Refresh
            </button>
          </div>
        </div>

        {/* Content Sections */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {SECTIONS.map((section) => {
            const items = grouped[section];
            if (items.length === 0) return null;
            const cfg = DATE_LABEL_MAP[section];
            return (
              <div key={section}>
                <div className="flex items-center gap-3 mb-3">
                  <h3 className={`text-xs font-bold uppercase tracking-wider ${cfg.color}`}>
                    {cfg.label}
                  </h3>
                  <div className="flex-1 h-px bg-mc-border" />
                  <span className="text-[10px] text-mc-text-secondary">{items.length}</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {items.map((item) => (
                    <BriefCard key={item.filename} item={item} onOpen={setOpenItem} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal */}
      {openItem && (
        <ContentModal item={openItem} onClose={() => setOpenItem(null)} />
      )}
    </>
  );
}
