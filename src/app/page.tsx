'use client';

import { WorkspaceDashboard } from '@/components/WorkspaceDashboard';
import { PixelOffice } from '@/components/PixelOffice';

export default function HomePage() {
  return (
    <div className="h-full overflow-hidden grid grid-cols-1 xl:grid-cols-[1fr_420px]">
      <WorkspaceDashboard />
      <section className="hidden xl:flex flex-col border-l border-mc-border bg-mc-bg-secondary/40 min-h-0">
        <div className="px-3 py-2 border-b border-mc-border flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-mc-text-secondary">
            Pixel Office
          </h2>
          <span className="text-[10px] text-mc-text-secondary">Live</span>
        </div>
        <div className="flex-1 min-h-0 overflow-hidden">
          <PixelOffice compact />
        </div>
      </section>
    </div>
  );
}
