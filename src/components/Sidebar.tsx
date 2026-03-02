'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  ChevronLeft,
  ChevronRight,
  Zap,
  Menu,
  X,
  Bot,
  ClipboardList,
  Newspaper,
  FileText,
  CheckSquare,
  Building2,
  Users,
  DollarSign,
  Clock,
  Wrench,
  ShoppingBag,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useMissionControl } from '@/lib/store';
import { staggerContainer, sidebarItemVariants } from '@/lib/animations';

interface SidebarProps {
  workspaceSlug: string;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const SIDEBAR_COLLAPSED_KEY = 'mc-sidebar-collapsed';

interface NavItem {
  id: string;
  label: string;
  emoji: string;
  icon: React.ReactNode;
  href?: string;
  comingSoon?: boolean;
}

const navItems: NavItem[] = [
  {
    id: 'agents',
    label: 'Agents',
    emoji: '🤖',
    icon: <Bot className="w-3.5 h-3.5" />,
  },
  {
    id: 'tasks',
    label: 'Task',
    emoji: '📋',
    icon: <ClipboardList className="w-3.5 h-3.5" />,
  },
  {
    id: 'content',
    label: 'Content',
    emoji: '📰',
    icon: <Newspaper className="w-3.5 h-3.5" />,
  },
  {
    id: 'docs',
    label: 'Document',
    emoji: '📄',
    icon: <FileText className="w-3.5 h-3.5" />,
  },
  {
    id: 'approval',
    label: 'Approval',
    emoji: '✅',
    icon: <CheckSquare className="w-3.5 h-3.5" />,
  },
  {
    id: 'office',
    label: 'Office',
    emoji: '🏢',
    icon: <Building2 className="w-3.5 h-3.5" />,
  },
  {
    id: 'team',
    label: 'Team',
    emoji: '👥',
    icon: <Users className="w-3.5 h-3.5" />,
  },
  {
    id: 'cost',
    label: 'Cost',
    emoji: '💰',
    icon: <DollarSign className="w-3.5 h-3.5" />,
  },
  {
    id: 'cron',
    label: 'Cron Jobs',
    emoji: '⏰',
    icon: <Clock className="w-3.5 h-3.5" />,
  },
  {
    id: 'skills',
    label: 'Skills',
    emoji: '🔧',
    icon: <Wrench className="w-3.5 h-3.5" />,
  },
  {
    id: 'intimo',
    label: 'Intimo BI',
    emoji: '💜',
    icon: <ShoppingBag className="w-3.5 h-3.5" />,
  },
];

function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2800);
    return () => clearTimeout(t);
  }, [onDone]);

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
        background: 'linear-gradient(135deg, #7c3aed, #c026d3, #ec4899)',
        color: '#fff',
        fontWeight: 700,
        fontSize: '14px',
        boxShadow: '0 8px 32px rgba(124,58,237,0.4)',
        border: '1px solid rgba(255,255,255,0.15)',
      }}
    >
      {message}
    </div>
  );
}

function ComingSoonToast({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 1800);
    return () => clearTimeout(t);
  }, [onDone]);

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
        background: '#1a1a2e',
        color: '#e2e8f0',
        fontWeight: 700,
        fontSize: '14px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        border: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      🚧 Coming Soon
    </div>
  );
}

export function Sidebar({ workspaceSlug, activeTab, onTabChange }: SidebarProps) {
  const router = useRouter();
  const { isOnline } = useMissionControl();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [pingLoading, setPingLoading] = useState(false);
  const [toast, setToast] = useState<'ping' | 'soon' | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
    if (stored === 'true') setIsCollapsed(true);
  }, []);

  const toggleCollapsed = () => {
    const next = !isCollapsed;
    setIsCollapsed(next);
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
  };

  const handleNavClick = (item: NavItem) => {
    if (item.href) {
      router.push(item.href);
    } else if (item.comingSoon) {
      setToast('soon');
    } else {
      onTabChange(item.id);
    }
    setIsMobileOpen(false);
  };

  const handlePingEve = useCallback(async () => {
    if (pingLoading) return;
    setPingLoading(true);
    try {
      await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'พี่เอก Ping มาค่ะ 👋', agent: 'main' }),
      });
    } catch {
      // silently ok
    } finally {
      setPingLoading(false);
      setToast('ping');
    }
  }, [pingLoading]);

  const sidebarContent = (
    <>
      {/* Header */}
      <div className="h-12 flex items-center border-b border-mc-border px-2.5 flex-shrink-0" style={{ background: 'var(--mc-gradient-header)' }}>
        {!isCollapsed && (
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Zap className="w-4 h-4 text-mc-accent-cyan flex-shrink-0" style={{ filter: 'drop-shadow(0 0 4px rgba(0, 212, 255, 0.5))' }} />
            <span className="font-semibold text-xs uppercase truncate" style={{ letterSpacing: '0.15em', fontSize: '11px', color: 'var(--mc-text-secondary)' }}>
              Mission Control
            </span>
          </div>
        )}
        <button
          onClick={toggleCollapsed}
          className="p-1 rounded hover:bg-mc-bg-tertiary text-mc-text-secondary hover:text-mc-text transition-colors flex-shrink-0 hidden lg:flex"
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? (
            <ChevronRight className="w-3.5 h-3.5" />
          ) : (
            <ChevronLeft className="w-3.5 h-3.5" />
          )}
        </button>
        <button
          onClick={() => setIsMobileOpen(false)}
          className="p-1 rounded hover:bg-mc-bg-tertiary text-mc-text-secondary lg:hidden"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Ping Eve Button */}
      <div className={`flex-shrink-0 ${isCollapsed ? 'px-1.5 pt-3 pb-2' : 'px-2 pt-3 pb-2'}`}>
        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={handlePingEve}
          disabled={pingLoading}
          title="Ping Eve"
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            borderRadius: '12px',
            fontWeight: 700,
            background: pingLoading ? 'rgba(0, 212, 255, 0.2)' : 'rgba(0, 212, 255, 0.1)',
            color: 'var(--mc-accent-cyan)',
            border: '1px solid rgba(0, 212, 255, 0.3)',
            cursor: pingLoading ? 'not-allowed' : 'pointer',
            opacity: pingLoading ? 0.7 : 1,
            padding: isCollapsed ? '8px 4px' : '8px 12px',
            fontSize: '11px',
            letterSpacing: '0.05em',
            boxShadow: pingLoading ? 'var(--mc-glow-cyan)' : 'none',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(0, 212, 255, 0.2)';
            e.currentTarget.style.boxShadow = 'var(--mc-glow-cyan)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = pingLoading ? 'rgba(0, 212, 255, 0.2)' : 'rgba(0, 212, 255, 0.1)';
            e.currentTarget.style.boxShadow = pingLoading ? 'var(--mc-glow-cyan)' : 'none';
          }}
        >
          <span style={{ fontSize: '16px', lineHeight: 1 }}>
            {pingLoading ? '⏳' : '🦋'}
          </span>
          {!isCollapsed && <span>Ping Eve</span>}
        </motion.button>
      </div>

      {/* Navigation */}
      <motion.nav
        className="flex-1 overflow-y-auto py-1 px-1.5 space-y-0.5"
        variants={staggerContainer}
        initial="hidden"
        animate="show"
      >
        {!isCollapsed && (
          <div className="px-2 py-1.5 text-[9px] font-semibold uppercase tracking-widest text-mc-text-secondary">
            Workspace
          </div>
        )}
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <motion.div key={`anim-${item.id}`} variants={sidebarItemVariants}>
            <button
              key={item.id}
              onClick={() => handleNavClick(item)}
              className={`w-full flex items-center gap-3 rounded-lg transition-all duration-150 group relative
                ${isCollapsed ? 'px-1.5 py-2 justify-center' : 'px-2 py-1.5'}
                ${
                  isActive
                    ? 'text-mc-accent border-l-2'
                    : 'text-mc-text-secondary border-l-2 border-transparent hover:text-mc-text'
                }
                ${item.comingSoon ? 'opacity-60 hover:opacity-80' : ''}
              `}
              style={isActive ? {
                borderLeftColor: 'var(--mc-accent-cyan)',
                background: 'rgba(0, 212, 255, 0.08)',
                color: 'var(--mc-accent-cyan)',
                boxShadow: 'inset 3px 0 10px rgba(0, 212, 255, 0.1)'
              } : {
                borderLeftColor: 'transparent',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = 'rgba(0, 212, 255, 0.05)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = 'transparent';
                }
              }}
              title={isCollapsed ? item.label : undefined}
            >
              <span className={`sidebar-icon flex-shrink-0 ${isActive ? 'text-mc-accent' : ''}`}>
                {item.icon}
              </span>
              {!isCollapsed && (
                <span
                  className={`text-[11px] font-medium truncate flex-1 text-left ${
                    isActive ? 'text-mc-accent' : ''
                  }`}
                >
                  {item.label}
                </span>
              )}
              {!isCollapsed && item.comingSoon && (
                <span className="text-[8px] text-mc-text-secondary/50 font-normal flex-shrink-0">
                  soon
                </span>
              )}

              {/* Tooltip for collapsed mode */}
              {isCollapsed && (
                <div className="absolute left-full ml-2 px-2 py-1 bg-mc-bg border border-mc-border text-mc-text text-xs rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 shadow-lg transition-opacity">
                  {item.label}
                  {item.comingSoon && (
                    <span className="ml-1 text-mc-text-secondary/60">soon</span>
                  )}
                </div>
              )}
            </button>
            </motion.div>
          );
        })}
      </motion.nav>

      {/* Status indicator at bottom */}
      <div className="border-t border-mc-border px-2 py-2 flex-shrink-0">
        <div
          className={`flex items-center gap-2 text-[11px] font-medium ${
            isCollapsed ? 'justify-center' : ''
          }`}
        >
          <span
            className={`w-2 h-2 rounded-full flex-shrink-0 ${
              isOnline ? 'bg-mc-accent-green animate-pulse' : 'bg-mc-accent-red'
            }`}
          />
          {!isCollapsed && (
            <span className={isOnline ? 'text-mc-accent-green' : 'text-mc-accent-red'}>
              {isOnline ? 'ONLINE' : 'OFFLINE'}
            </span>
          )}
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Toast notifications */}
      {toast === 'ping' && (
        <Toast message="Pinged Eve! 🦋" onDone={() => setToast(null)} />
      )}
      {toast === 'soon' && (
        <ComingSoonToast onDone={() => setToast(null)} />
      )}

      {/* Mobile hamburger button */}
      <button
        onClick={() => setIsMobileOpen(true)}
        className="fixed top-3 left-3 z-40 p-1.5 bg-mc-bg-secondary border border-mc-border rounded-lg lg:hidden"
      >
        <Menu className="w-4 h-4 text-mc-text" />
      </button>

      {/* Mobile overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          border-r border-mc-border flex flex-col flex-shrink-0
          transition-all duration-300 ease-in-out
          ${isCollapsed ? 'w-[50px]' : 'w-[200px]'}
          fixed lg:relative inset-y-0 left-0 z-50
          ${isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
        style={{
          background: 'var(--mc-gradient-sidebar)',
          borderRight: '1px solid var(--mc-glass-border)',
        }}
      >
        {sidebarContent}
      </aside>
    </>
  );
}
