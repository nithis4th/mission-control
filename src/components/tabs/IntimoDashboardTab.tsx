'use client';

import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Package, ShoppingBag, AlertTriangle, RefreshCw } from 'lucide-react';

type TopProduct = {
  productId: number;
  title: string;
  unitsSold: number;
};

type InventoryAlert = {
  productId: number;
  variantId: number;
  productTitle: string;
  variantTitle: string;
  inventoryQuantity: number;
};

type DashboardMetrics = {
  today: { orders: number; revenue: number; currency: string };
  yesterday: { orders: number; revenue: number; currency: string };
  revenueChange: number;
  ordersChange: number;
  topProducts: TopProduct[];
  inventoryAlerts: InventoryAlert[];
  lastUpdated: string;
  cached?: boolean;
  error?: string;
};

export function IntimoDashboardTab() {
  const [data, setData] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/intimo/dashboard');
      if (res.ok) {
        const json = await res.json();
        if (json.error === 'NOT_CONFIGURED') {
          setError('NOT_CONFIGURED');
        } else if (json.error) {
          setError(json.message || 'Failed to load dashboard');
        } else {
          setData(json);
          setLastUpdated(new Date());
        }
      } else {
        setError('Failed to load dashboard');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
    const interval = setInterval(loadDashboard, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (loading && !data) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-3 animate-pulse">🛍️</div>
          <p className="text-mc-text-secondary text-sm">Loading Intimo Life dashboard...</p>
        </div>
      </div>
    );
  }

  if (error === 'NOT_CONFIGURED') {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <div className="text-5xl mb-4">🔌</div>
          <h3 className="text-lg font-bold text-mc-text mb-2">Connect Your Shopify Store</h3>
          <p className="text-sm text-mc-text-secondary mb-6">
            To view your Intimo Life dashboard, you need to connect your Shopify store.
          </p>
          <div className="bg-mc-bg-secondary border border-mc-border rounded-xl glow-card p-4 text-left">
            <p className="text-xs font-semibold text-mc-text-secondary uppercase tracking-wide mb-3">
              Setup Instructions
            </p>
            <ol className="text-xs text-mc-text-secondary space-y-2 list-decimal list-inside">
              <li>Go to Shopify Admin → Settings → Apps and sales channels</li>
              <li>Click &quot;Develop apps&quot; → &quot;Create an app&quot;</li>
              <li>Enable Admin API access for: Orders, Products</li>
              <li>Install the app and copy the Admin API access token</li>
              <li>Add to your .env.local file</li>
              <li>Restart Mission Control</li>
            </ol>
          </div>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center">
          <div className="text-4xl mb-3">⚠️</div>
          <p className="text-mc-text-secondary text-sm mb-4">{error}</p>
          <button
            onClick={loadDashboard}
            className="text-xs text-mc-accent hover:text-mc-accent/80 px-3 py-1.5 rounded border border-mc-accent/30"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const currency = data?.today.currency || 'THB';

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold text-mc-text flex items-center gap-2">
            <span>🛍️</span>
            Intimo Life Dashboard
          </h2>
          <p className="text-xs text-mc-text-secondary mt-0.5">
            Daily business metrics for your Shopify store
            {lastUpdated && (
              <span className="ml-2 opacity-60">
                · Updated {lastUpdated.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                {data?.cached && ' (cached)'}
              </span>
            )}
          </p>
        </div>
        <button
          onClick={loadDashboard}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs text-mc-text-secondary hover:text-mc-text px-2 py-1 rounded border border-mc-border hover:border-mc-accent/40 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Today's Revenue" value={formatCurrency(data?.today.revenue || 0, currency)} emoji="💰" change={data?.revenueChange} />
        <StatCard label="Today's Orders" value={String(data?.today.orders || 0)} emoji="📦" change={data?.ordersChange} />
        <StatCard label="Yesterday's Revenue" value={formatCurrency(data?.yesterday.revenue || 0, currency)} emoji="📈" muted />
        <StatCard label="Yesterday's Orders" value={String(data?.yesterday.orders || 0)} emoji="🛒" muted />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-mc-bg-secondary border border-mc-border rounded-xl glow-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-mc-accent" />
            <h3 className="text-sm font-semibold text-mc-text">Top Products (Last 7 Days)</h3>
          </div>
          <div className="space-y-2">
            {(data?.topProducts || []).length > 0 ? (
              data?.topProducts.map((product, index) => (
                <div key={product.productId} className="flex items-center justify-between py-2.5 border-b border-mc-border last:border-0">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <span className="w-5 h-5 rounded-full bg-mc-accent/10 text-mc-accent text-xs flex items-center justify-center font-semibold flex-shrink-0">
                      {index + 1}
                    </span>
                    <span className="text-sm text-mc-text truncate" title={product.title}>{product.title}</span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-mc-text-secondary flex-shrink-0">
                    <ShoppingBag className="w-3 h-3" />
                    <span>{product.unitsSold} sold</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-mc-text-secondary text-sm opacity-60">No sales data available</div>
            )}
          </div>
        </div>

        <div className="bg-mc-bg-secondary border border-mc-border rounded-xl glow-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-yellow-500" />
              <h3 className="text-sm font-semibold text-mc-text">Low Stock Alerts</h3>
            </div>
            {(data?.inventoryAlerts || []).length > 0 && (
              <span className="text-xs bg-yellow-500/10 text-yellow-500 px-2 py-0.5 rounded-full">{data?.inventoryAlerts.length} items</span>
            )}
          </div>
          <div className="space-y-2 max-h-[280px] overflow-y-auto">
            {(data?.inventoryAlerts || []).length > 0 ? (
              data?.inventoryAlerts.map((alert) => (
                <div key={`${alert.productId}-${alert.variantId}`} className="flex items-center justify-between py-2.5 border-b border-mc-border last:border-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-mc-text truncate" title={alert.productTitle}>{alert.productTitle}</p>
                    {alert.variantTitle !== 'Default Title' && <p className="text-xs text-mc-text-secondary">{alert.variantTitle}</p>}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs flex-shrink-0">
                    <Package className="w-3 h-3 text-mc-text-secondary" />
                    <span className={`font-semibold ${alert.inventoryQuantity <= 3 ? 'text-red-500' : 'text-yellow-500'}`}>
                      {alert.inventoryQuantity} left
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-mc-text-secondary text-sm opacity-60">
                <Package className="w-8 h-8 mx-auto mb-2 opacity-40" />
                All products are well-stocked
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, emoji, change, muted = false }: { label: string; value: string; emoji: string; change?: number; muted?: boolean }) {
  const isPositive = (change || 0) > 0;
  const isNegative = (change || 0) < 0;

  return (
    <div className={`bg-mc-bg-secondary border rounded-xl p-4 ${muted ? 'border-mc-border/50' : 'border-mc-border'}`}>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-lg">{emoji}</span>
        <span className={`text-xs ${muted ? 'text-mc-text-secondary/60' : 'text-mc-text-secondary'}`}>{label}</span>
      </div>
      <div className={`text-xl font-bold ${muted ? 'text-mc-text-secondary' : 'text-mc-text'}`}>{value}</div>
      {change !== undefined && (
        <div className={`flex items-center gap-1 mt-1 text-xs ${isPositive ? 'text-green-500' : isNegative ? 'text-red-500' : 'text-mc-text-secondary'}`}>
          {isPositive ? <TrendingUp className="w-3 h-3" /> : isNegative ? <TrendingDown className="w-3 h-3" /> : null}
          <span>{isPositive ? '+' : ''}{change}% vs yesterday</span>
        </div>
      )}
    </div>
  );
}

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('th-TH', { style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
}
