'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  Bot,
  MessageSquare,
  BarChart3,
  ScrollText,
  Brain,
  ChevronLeft,
  ChevronRight,
  Zap,
  Menu,
  X,
} from 'lucide-react';
import { useMissionControl } from '@/lib/store';

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
  href?: string; // external route (navigates away)
}

const navItems: NavItem[] = [
  {
    id: 'agents',
    label: 'Agents',
    emoji: '🤖',
    icon: <Bot className="w-3.5 h-3.5" />,
  },
  {
    id: 'chat',
    label: 'Chat',
    emoji: '💬',
    icon: <MessageSquare className="w-3.5 h-3.5" />,
  },
  {
    id: 'activity',
    label: 'Activity',
    emoji: '📊',
    icon: <BarChart3 className="w-3.5 h-3.5" />,
  },
  {
    id: 'history',
    label: 'Chat History',
    emoji: '📜',
    icon: <ScrollText className="w-3.5 h-3.5" />,
  },
  {
    id: 'brain',
    label: 'Second Brain',
    emoji: '🧠',
    icon: <Brain className="w-3.5 h-3.5" />,
    href: '/brain',
  },
];

export function Sidebar({ workspaceSlug, activeTab, onTabChange }: SidebarProps) {
  const router = useRouter();
  const { isOnline } = useMissionControl();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // Load collapsed state from localStorage
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
    } else {
      onTabChange(item.id);
    }
    setIsMobileOpen(false);
  };

  const sidebarContent = (
    <>
      {/* Header */}
      <div className="h-12 flex items-center border-b border-mc-border px-2.5 flex-shrink-0">
        {!isCollapsed && (
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Zap className="w-4 h-4 text-mc-accent-cyan flex-shrink-0" />
            <span className="font-semibold text-xs uppercase tracking-wider truncate">
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
        {/* Mobile close button */}
        <button
          onClick={() => setIsMobileOpen(false)}
          className="p-1 rounded hover:bg-mc-bg-tertiary text-mc-text-secondary lg:hidden"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-1.5 px-1.5 space-y-0.5">
        {!isCollapsed && (
          <div className="px-2 py-1.5 text-[9px] font-semibold uppercase tracking-widest text-mc-text-secondary">
            Workspace
          </div>
        )}
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleNavClick(item)}
              className={`w-full flex items-center gap-3 rounded-lg transition-all duration-150 group relative
                ${isCollapsed ? 'px-1.5 py-2 justify-center' : 'px-2 py-1.5'}
                ${
                  isActive
                    ? 'bg-mc-accent/10 text-mc-accent border-l-2 border-mc-accent'
                    : 'text-mc-text-secondary hover:bg-mc-bg-tertiary hover:text-mc-text border-l-2 border-transparent'
                }
              `}
              title={isCollapsed ? item.label : undefined}
            >
              <span className={`flex-shrink-0 ${isActive ? 'text-mc-accent' : ''}`}>
                {item.icon}
              </span>
              {!isCollapsed && (
                <span className={`text-[11px] font-medium truncate ${isActive ? 'text-mc-accent' : ''}`}>
                  {item.label}
                </span>
              )}

              {/* Tooltip for collapsed mode */}
              {isCollapsed && (
                <div className="absolute left-full ml-2 px-2 py-1 bg-mc-bg border border-mc-border text-mc-text text-xs rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 shadow-lg transition-opacity">
                  {item.label}
                </div>
              )}
            </button>
          );
        })}
      </nav>

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
          bg-mc-bg-secondary border-r border-mc-border flex flex-col flex-shrink-0
          transition-all duration-300 ease-in-out
          ${isCollapsed ? 'w-[50px]' : 'w-[200px]'}
          fixed lg:relative inset-y-0 left-0 z-50
          ${isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {sidebarContent}
      </aside>
    </>
  );
}
