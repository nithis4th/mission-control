'use client';

import { useState, useEffect } from 'react';

interface Service {
  name: string;
  port: number;
  status: 'up' | 'down';
  statusCode?: number;
  responseTime?: number;
  error?: string;
  checkedAt: string;
}

interface Metrics {
  cpu: {
    usage: number;
    cores: number;
    model: string;
  };
  memory: {
    total: number;
    used: number;
    free: number;
    usagePercent: number;
  };
  disk: {
    usage: number;
    path: string;
  };
  uptime: number;
  hostname: string;
  platform: string;
  arch: string;
}

interface HealthData {
  status: 'healthy' | 'degraded' | 'error';
  timestamp: string;
  services: Service[];
  metrics: Metrics;
}

export default function HealthDashboard() {
  const [healthData, setHealthData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchHealth = async () => {
    try {
      const res = await fetch('/api/health', { 
        cache: 'no-store',
        signal: AbortSignal.timeout(10000)
      });
      const data = await res.json();
      setHealthData(data);
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch health data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchHealth, 30000);
    
    return () => clearInterval(interval);
  }, []);

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const getUsageColor = (percent: number) => {
    if (percent < 50) return 'text-green-500';
    if (percent < 80) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getUsageBarColor = (percent: number) => {
    if (percent < 50) return 'bg-green-500';
    if (percent < 80) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  if (loading && !healthData) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error && !healthData) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
        <h3 className="text-red-800 font-semibold mb-2">⚠️ Error Loading Health Data</h3>
        <p className="text-red-600">{error}</p>
        <button 
          onClick={fetchHealth}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!healthData) return null;

  const { services, metrics, status, timestamp } = healthData;
  const allServicesUp = services.every(s => s.status === 'up');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold">Health Monitor</h2>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
            status === 'healthy' 
              ? 'bg-green-100 text-green-800' 
              : status === 'degraded'
              ? 'bg-yellow-100 text-yellow-800'
              : 'bg-red-100 text-red-800'
          }`}>
            {status === 'healthy' ? '✓ All Systems Operational' : 
             status === 'degraded' ? '⚠️ Degraded' : '❌ Error'}
          </span>
        </div>
        <div className="text-sm text-gray-500">
          {lastUpdated && `Updated: ${lastUpdated.toLocaleTimeString()}`}
        </div>
      </div>

      {/* Services Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {services.map((service, index) => (
          <div 
            key={index}
            className={`p-4 rounded-lg border-2 transition-all ${
              service.status === 'up' 
                ? 'border-green-200 bg-green-50' 
                : 'border-red-200 bg-red-50'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className={`w-3 h-3 rounded-full ${
                  service.status === 'up' ? 'bg-green-500' : 'bg-red-500'
                }`}></span>
                <span className="font-semibold">{service.name}</span>
              </div>
              <span className={`px-2 py-1 rounded text-xs font-medium ${
                service.status === 'up' 
                  ? 'bg-green-200 text-green-800' 
                  : 'bg-red-200 text-red-800'
              }`}>
                {service.status === 'up' ? 'UP' : 'DOWN'}
              </span>
            </div>
            
            <div className="text-sm text-gray-600 space-y-1">
              <div className="flex justify-between">
                <span>Port:</span>
                <span className="font-mono">{service.port}</span>
              </div>
              <div className="flex justify-between">
                <span>Response:</span>
                <span className="font-mono">
                  {service.responseTime ? `${service.responseTime}ms` : 'N/A'}
                </span>
              </div>
              {service.error && (
                <div className="text-red-600 mt-2">
                  Error: {service.error}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* System Metrics */}
      <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
        <h3 className="text-lg font-semibold mb-4">📊 System Metrics</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* CPU */}
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600">CPU</span>
              <span className={`font-bold ${getUsageColor(metrics.cpu.usage)}`}>
                {metrics.cpu.usage}%
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
              <div 
                className={`h-2 rounded-full transition-all ${getUsageBarColor(metrics.cpu.usage)}`}
                style={{ width: `${Math.min(metrics.cpu.usage, 100)}%` }}
              ></div>
            </div>
            <div className="text-xs text-gray-500">
              {metrics.cpu.cores} cores • {metrics.cpu.model}
            </div>
          </div>

          {/* Memory */}
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600">Memory</span>
              <span className={`font-bold ${getUsageColor(metrics.memory.usagePercent)}`}>
                {metrics.memory.usagePercent}%
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
              <div 
                className={`h-2 rounded-full transition-all ${getUsageBarColor(metrics.memory.usagePercent)}`}
                style={{ width: `${Math.min(metrics.memory.usagePercent, 100)}%` }}
              ></div>
            </div>
            <div className="text-xs text-gray-500">
              {metrics.memory.used}GB / {metrics.memory.total}GB
            </div>
          </div>

          {/* Disk */}
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600">Disk</span>
              <span className={`font-bold ${getUsageColor(metrics.disk.usage)}`}>
                {metrics.disk.usage}%
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
              <div 
                className={`h-2 rounded-full transition-all ${getUsageBarColor(metrics.disk.usage)}`}
                style={{ width: `${Math.min(metrics.disk.usage, 100)}%` }}
              ></div>
            </div>
            <div className="text-xs text-gray-500">
              {metrics.disk.path}
            </div>
          </div>
        </div>

        {/* System Info */}
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Uptime:</span>
              <span className="ml-2 font-medium">{formatUptime(metrics.uptime)}</span>
            </div>
            <div>
              <span className="text-gray-500">Host:</span>
              <span className="ml-2 font-medium">{metrics.hostname}</span>
            </div>
            <div>
              <span className="text-gray-500">Platform:</span>
              <span className="ml-2 font-medium">{metrics.platform}</span>
            </div>
            <div>
              <span className="text-gray-500">Architecture:</span>
              <span className="ml-2 font-medium">{metrics.arch}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Timestamp */}
      <div className="text-center text-sm text-gray-400">
        Last check: {new Date(timestamp).toLocaleString()}
      </div>
    </div>
  );
}
