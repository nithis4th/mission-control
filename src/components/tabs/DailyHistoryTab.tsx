'use client';

import { useState, useEffect } from 'react';
import { Calendar, Search, MessageCircle, Bot, User, ChevronDown, ChevronRight } from 'lucide-react';

interface HistoryMessage {
  id: string;
  agentId: string;
  sessionKey: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
}

interface DailyHistoryTabProps {
  workspaceId: string;
}

export default function DailyHistoryTab({ workspaceId }: DailyHistoryTabProps) {
  const [agents, setAgents] = useState<string[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string>('all');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [searchQuery, setSearchQuery] = useState('');
  const [messages, setMessages] = useState<HistoryMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAgentPicker, setShowAgentPicker] = useState(false);
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set());

  // Fetch available agents
  useEffect(() => {
    fetch('/api/agents?workspace_id=' + workspaceId, { headers: { 'Referer': 'http://localhost:4000/' } })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data.agents)) {
          setAgents(data.agents.map((a: any) => a.name?.toLowerCase() || a.id));
        }
      })
      .catch(console.error);
  }, [workspaceId]);

  // Fetch history when date or agent changes
  useEffect(() => {
    fetchHistory();
  }, [selectedDate, selectedAgent]);

  const fetchHistory = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const agentParam = selectedAgent === 'all' ? '' : selectedAgent;
      const url = `/api/history/archive?agent=${agentParam}&date=${selectedDate}&limit=500`;
    const response = await fetch(url, { headers: { 'Referer': 'http://localhost:4000/' } });
    const data = await response.json();
      
      
      if (data.ok) {
        // Filter by search query
        let filtered = data.rows || [];
        if (searchQuery) {
          filtered = filtered.filter((m: HistoryMessage) => 
            m.text.toLowerCase().includes(searchQuery.toLowerCase())
          );
        }
        setMessages(filtered);
      } else {
        setError(data.error || 'Failed to load history');
      }
    } catch (e) {
      setError('Failed to load history');
    } finally {
      setLoading(false);
    }
  };

  // Group messages by session
  const groupedMessages = messages.reduce((acc, msg) => {
    const sessionKey = msg.sessionKey || 'unknown';
    if (!acc[sessionKey]) acc[sessionKey] = [];
    acc[sessionKey].push(msg);
    return acc;
  }, {} as Record<string, HistoryMessage[]>);

  // Get daily summary
  const dailySummary = {
    totalMessages: messages.length,
    userMessages: messages.filter(m => m.role === 'user').length,
    assistantMessages: messages.filter(m => m.role === 'assistant').length,
    sessions: Object.keys(groupedMessages).length,
  };

  const toggleSession = (sessionKey: string) => {
    const newExpanded = new Set(expandedSessions);
    if (newExpanded.has(sessionKey)) {
      newExpanded.delete(sessionKey);
    } else {
      newExpanded.add(sessionKey);
    }
    setExpandedSessions(newExpanded);
  };

  const formatTime = (timestamp: string) => {
    try {
      return new Date(timestamp).toLocaleTimeString('th-TH', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    } catch {
      return '';
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr + 'T00:00:00+07:00').toLocaleDateString('th-TH', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="h-full flex flex-col bg-mc-bg">
      {/* Header with filters */}
      <div className="p-4 border-b border-mc-border space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-mc-text flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            ประวัติการสนทนา
          </h2>
          <span className="text-sm text-mc-text-secondary">
            {formatDate(selectedDate)}
          </span>
        </div>

        {/* Filters Row */}
        <div className="flex gap-2 flex-wrap">
          {/* Date Picker */}
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="bg-mc-bg border border-mc-border rounded px-3 py-1.5 text-sm text-mc-text focus:outline-none focus:border-mc-accent"
          />

          {/* Agent Filter */}
          <div className="relative">
            <button
              onClick={() => setShowAgentPicker(!showAgentPicker)}
              className="bg-mc-bg border border-mc-border rounded px-3 py-1.5 text-sm text-mc-text flex items-center gap-2 hover:border-mc-accent"
            >
              <Bot className="w-4 h-4" />
              {selectedAgent === 'all' ? 'ทุก Agent' : selectedAgent}
              <ChevronDown className="w-4 h-4" />
            </button>
            {showAgentPicker && (
              <div className="absolute top-full left-0 mt-1 bg-mc-bg border border-mc-border rounded shadow-lg z-10 min-w-[150px]">
                <button
                  onClick={() => { setSelectedAgent('all'); setShowAgentPicker(false); }}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-mc-border text-mc-text"
                >
                  ทุก Agent
                </button>
                {agents.map(agent => (
                  <button
                    key={agent}
                    onClick={() => { setSelectedAgent(agent); setShowAgentPicker(false); }}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-mc-border text-mc-text capitalize"
                  >
                    {agent}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Search */}
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-mc-text-secondary" />
              <input
                type="text"
                placeholder="ค้นหาข้อความ..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-mc-bg border border-mc-border rounded pl-9 pr-3 py-1.5 text-sm text-mc-text placeholder:text-mc-text-secondary focus:outline-none focus:border-mc-accent"
              />
            </div>
          </div>
        </div>

        {/* Daily Summary */}
        <div className="flex gap-4 text-sm text-mc-text-secondary">
          <span className="flex items-center gap-1">
            <MessageCircle className="w-4 h-4" />
            {dailySummary.totalMessages} ข้อความ
          </span>
          <span className="flex items-center gap-1">
            <User className="w-4 h-4" />
            {dailySummary.userMessages} จาก user
          </span>
          <span className="flex items-center gap-1">
            <Bot className="w-4 h-4" />
            {dailySummary.assistantMessages} จาก agent
          </span>
          <span>
            {dailySummary.sessions} conversations
          </span>
        </div>
      </div>

      {/* Messages List */}
      <div className="flex-1 overflow-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin w-6 h-6 border-2 border-mc-accent border-t-transparent rounded-full" />
          </div>
        ) : error ? (
          <div className="text-center text-red-400 py-8">{error}</div>
        ) : messages.length === 0 ? (
          <div className="text-center text-mc-text-secondary py-8">
            ไม่มีข้อความในวันที่เลือก
          </div>
        ) : (
          <div className="space-y-2">
            {Object.entries(groupedMessages).map(([sessionKey, msgs]) => (
              <div key={sessionKey} className="bg-mc-bg border border-mc-border rounded-lg overflow-hidden">
                <button
                  onClick={() => toggleSession(sessionKey)}
                  className="w-full px-4 py-2 flex items-center justify-between hover:bg-mc-border/50"
                >
                  <span className="text-sm text-mc-text-secondary truncate max-w-md">
                    {sessionKey.split(':').slice(2).join(':') || sessionKey}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-mc-text-secondary">
                      {msgs.length} ข้อความ
                    </span>
                    {expandedSessions.has(sessionKey) ? (
                      <ChevronDown className="w-4 h-4 text-mc-text-secondary" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-mc-text-secondary" />
                    )}
                  </div>
                </button>
                
                {expandedSessions.has(sessionKey) && (
                  <div className="border-t border-mc-border">
                    {msgs.map((msg) => (
                      <div
                        key={msg.id}
                        className={`px-4 py-2 border-b border-mc-border/50 last:border-0 ${
                          msg.role === 'user' ? 'bg-mc-accent/5' : ''
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          {msg.role === 'user' ? (
                            <User className="w-3 h-3 text-blue-400" />
                          ) : (
                            <Bot className="w-3 h-3 text-green-400" />
                          )}
                          <span className="text-xs text-mc-text-secondary">
                            {formatTime(msg.timestamp)}
                          </span>
                        </div>
                        <p className="text-sm text-mc-text whitespace-pre-wrap break-words">
                          {msg.text.length > 500 ? msg.text.slice(0, 500) + '...' : msg.text}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
