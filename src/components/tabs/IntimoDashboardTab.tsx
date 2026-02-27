'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  ShoppingBag,
  Package,
  AlertTriangle,
  RefreshCw,
  ShoppingCart,
  ExternalLink,
} from 'lucide-react';

// ============================================================
//  Types (mirrored from API)
// ============================================================

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
};

type ApiResponse =
  | (DashboardMetrics & { error?: undefined })
  | { error: 'NOT_CONFIGURED'; message: string }
  | { error: 'FETCH_ERROR'; message: string };

// ============================================================
//  Helpers
// ============================================================

function formatCurrency(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString()}`;
  }
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('th-TH', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Bangkok',
  });
}

function TrendIcon({ pct }: { pct: number }) {
  if (pct > 0) return <TrendingUp className="w-4 h-4 text-mc-accent-green" />;
  if (pct < 0) return <TrendingDown className="w-4 h-4 text-mc-accent-red" />;
  return <Minus className="w-4 h-4 text-mc-text-secondary" />;
}

function TrendBadge({ pct }: { pct: number }) {
  const color =
    pct > 0 ? 'text-mc-accent-green bg-mc-accent-green/10' :
    pct < 0 ? 'text-mc-accent-red bg-mc-accent-red/10' :
    'text-mc-text-secondary bg-mc-border/30';
  const sign = pct > 0 ? '+' : '';
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${color}`}>
      <TrendIcon pct={pct} />
      {sign}{pct}% vs kemarin
    </span>
  );
}

// ============================================================
//  Sub-components
// ============================================================

function MetricCard({
  emoji,
  label,
  value,
  sub,
  pct,
  highlight,
}: {
  emoji: string;
  label: string;
  value: string;
  sub?: string;
  pct?: number;
  highlight?: boolean;
}) {
  return (
    <div
      className={`bg-mc-bg-secondary border rounded-xl p-5 flex flex-col gap-3 transition-all hover:shadow-lg ${
        highlight ? 'border-mc-accent/30' : 'border-mc-border'
      }`}
    >
      <div className="flex items-center gap-2">
        <span className="text-2xl">{emoji}</span>
        <span className="text-xs text-mc-text-secondary font-medium uppercase tracking-wide">{label}</span>
      </div>
      <div className={`text-2xl font-bold ${highlight ? 'text-mc-accent' : 'text-mc-text'}`}>
        {value}
      </div>
      {sub && <div className="text-xs text-mc-text-secondary">{sub}</div>}
      {pct !== undefined && <TrendBadge pct={pct} />}
    </div>
  );
}

function TopProductsCard({ products }: { products: TopProduct[] }) {
  return (
    <div className="bg-mc-bg-secondary border border-mc-border rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <Package className="w-4 h-4 text-mc-accent-purple" />
        <h3 className="text-sm font-semibold text-mc-text">Top สินค้า (7 วันล่าสุด)</h3>
      </div>
      {products.length === 0 ? (
        <p className="text-mc-text-secondary text-sm">ยังไม่มีข้อมูล</p>
      ) : (
        <div className="space-y-3">
          {products.map((p, i) => (
            <div key={p.productId} className="flex items-center gap-3">
              {/* Rank badge */}
              <span
                className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${
                  i === 0
                    ? 'bg-yellow-500/20 text-yellow-400'
                    : i === 1
                    ? 'bg-slate-400/20 text-slate-300'
                    : i === 2
                    ? 'bg-orange-700/20 text-orange-400'
                    : 'bg-mc-bg-tertiary text-mc-text-secondary'
                }`}
              >
                {i + 1}
              </span>
              {/* Product name */}
              <div className="flex-1 min-w-0">
                <p className="text-xs text-mc-text font-medium truncate">{p.title}</p>
              </div>
              {/* Units sold */}
              <div className="flex items-center gap-1 flex-shrink-0">
                <ShoppingCart className="w-3 h-3 text-mc-text-secondary" />
                <span className="text-xs text-mc-accent font-bold">{p.unitsSold}</span>
                <span className="text-[10px] text-mc-text-secondary">ชิ้น</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function InventoryAlertsCard({ alerts }: { alerts: InventoryAlert[] }) {
  if (alerts.length === 0) {
    return (
      <div className="bg-mc-bg-secondary border border-mc-border rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="w-4 h-4 text-mc-accent-green" />
          <h3 className="text-sm font-semibold text-mc-text">Stock Alert</h3>
        </div>
        <div className="flex items-center gap-2 text-mc-accent-green text-sm">
          <span>✅</span>
          <span>ทุกสินค้า stock ปกติ</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-mc-bg-secondary border border-mc-accent-yellow/30 rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <AlertTriangle className="w-4 h-4 text-mc-accent-yellow" />
        <h3 className="text-sm font-semibold text-mc-text">Stock Alert</h3>
        <span className="ml-auto text-[10px] bg-mc-accent-yellow/15 text-mc-accent-yellow px-2 py-0.5 rounded-full font-bold">
          {alerts.length} รายการ
        </span>
      </div>
      <div className="space-y-2">
        {alerts.map((a) => (
          <div
            key={`${a.productId}-${a.variantId}`}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg border ${
              a.inventoryQuantity === 0
                ? 'bg-mc-accent-red/5 border-mc-accent-red/20'
                : 'bg-mc-accent-yellow/5 border-mc-accent-yellow/15'
            }`}
          >
            <span className="text-base">{a.inventoryQuantity === 0 ? '🚫' : '⚠️'}</span>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-mc-text font-medium truncate">{a.productTitle}</p>
              {a.variantTitle !== 'Default Title' && (
                <p className="text-[10px] text-mc-text-secondary truncate">{a.variantTitle}</p>
              )}
            </div>
            <span
              className={`text-xs font-bold flex-shrink-0 ${
                a.inventoryQuantity === 0 ? 'text-mc-accent-red' : 'text-mc-accent-yellow'
              }`}
            >
              {a.inventoryQuantity === 0 ? 'หมด' : `เหลือ ${a.inventoryQuantity}`}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
//  Not Configured Prompt
// ============================================================

function NotConfiguredPrompt() {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="max-w-md text-center">
        <div className="text-6xl mb-4">🛍️</div>
        <h2 className="text-lg font-bold text-mc-text mb-2">เชื่อมต่อ Shopify Store</h2>
        <p className="text-mc-text-secondary text-sm mb-6">
          เพิ่ม Shopify credentials ใน <code className="bg-mc-bg-tertiary px-1.5 py-0.5 rounded text-mc-accent text-xs">.env.local</code> เพื่อดูข้อมูล Intimo Life
        </p>

        <div className="bg-mc-bg-secondary border border-mc-border rounded-xl p-5 text-left space-y-3 mb-6">
          <p className="text-xs font-semibold text-mc-text-secondary uppercase tracking-wide mb-2">
            ตั้งค่าใน .env.local
          </p>
          <div className="space-y-1">
            <code className="block text-xs text-mc-accent font-mono">
              SHOPIFY_SHOP_DOMAIN=intimo-life.myshopify.com
            </code>
            <code className="block text-xs text-mc-accent font-mono">
              SHOPIFY_ADMIN_API_TOKEN=shpat_xxxxxxxxxxxx
            </code>
          </div>
        </div>

        <div className="bg-mc-bg-secondary border border-mc-border rounded-xl p-5 text-left space-y-2">
          <p className="text-xs font-semibold text-mc-text-secondary uppercase tracking-wide mb-2">
            วิธีรับ Admin API Token
          </p>
          <ol className="space-y-1.5 text-xs text-mc-text-secondary list-decimal list-inside">
            <li>เข้า Shopify Admin → Settings → Apps and sales channels</li>
            <li>คลิก &ldquo;Develop apps&rdquo; → &ldquo;Create an app&rdquo;</li>
            <li>ตั้งชื่อ เช่น &ldquo;Mission Control&rdquo;</li>
            <li>Configure Admin API scopes: <span className="text-mc-accent">read_orders, read_products, read_inventory</span></li>
            <li>Install app → copy &ldquo;Admin API access token&rdquo;</li>
          </ol>
        </div>

        <a
          href="https://admin.shopify.com/store/intimo-life/settings/apps"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 mt-4 text-xs text-mc-accent hover:underline"
        >
          เปิด Shopify Admin <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </div>
  );
}

// ============================================================
//  Main component
// ============================================================

export function IntimoDashboardTab() {
  const [data, setData] = useState<DashboardMetrics | null>(null);
  const [notConfigured, setNotConfigured] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    setError(null);

    try {
      const res = await fetch('/api/intimo/dashboard');
      const json: ApiResponse = await res.json();

      if ('error' in json && json.error === 'NOT_CONFIGURED') {
        setNotConfigured(true);
        setData(null);
      } else if ('error' in json && json.error === 'FETCH_ERROR') {
        setError(json.message || 'เกิดข้อผิดพลาดในการดึงข้อมูล Shopify');
      } else {
        setNotConfigured(false);
        setData(json as DashboardMetrics);
      }
    } catch {
      setError('ไม่สามารถเชื่อมต่อ API ได้');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    // Auto-refresh every 5 minutes
    const interval = setInterval(() => loadData(true), 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [loadData]);

  // ── Loading ──────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-3 animate-pulse">💜</div>
          <p className="text-mc-text-secondary text-sm">กำลังโหลดข้อมูล Intimo Life...</p>
        </div>
      </div>
    );
  }

  // ── Not Configured ────────────────────────────────────────

  if (notConfigured) {
    return <NotConfiguredPrompt />;
  }

  // ── Error ─────────────────────────────────────────────────

  if (error && !data) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center max-w-sm">
          <div className="text-5xl mb-3">❌</div>
          <h2 className="text-base font-semibold text-mc-text mb-2">เชื่อมต่อ Shopify ไม่ได้</h2>
          <p className="text-mc-text-secondary text-sm mb-4">{error}</p>
          <button
            onClick={() => loadData()}
            className="px-4 py-2 bg-mc-accent text-mc-bg rounded-lg text-sm font-medium hover:bg-mc-accent/90"
          >
            ลองอีกครั้ง
          </button>
        </div>
      </div>
    );
  }

  // ── Dashboard ─────────────────────────────────────────────

  if (!data) return null;

  const todayDateStr = new Date().toLocaleDateString('th-TH', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Bangkok',
  });

  return (
    <div className="flex-1 overflow-y-auto p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xl">💜</span>
            <h2 className="text-lg font-bold text-mc-text">Intimo Life</h2>
            <span className="text-xs bg-mc-accent-purple/15 text-mc-accent-purple px-2 py-0.5 rounded-full font-medium">
              Business Intelligence
            </span>
          </div>
          <p className="text-xs text-mc-text-secondary">{todayDateStr}</p>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          {/* Cache indicator */}
          {data.cached && (
            <span className="text-[10px] text-mc-text-secondary/60">⚡ cached</span>
          )}
          {/* Last updated */}
          {data.lastUpdated && (
            <span className="text-[10px] text-mc-text-secondary/60">
              อัพเดต {formatTime(data.lastUpdated)}
            </span>
          )}
          {/* Refresh */}
          <button
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 text-xs text-mc-text-secondary hover:text-mc-text px-2 py-1 rounded border border-mc-border hover:border-mc-accent/40 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          {/* Shopify link */}
          <a
            href="https://admin.shopify.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-mc-text-secondary hover:text-mc-accent px-2 py-1 rounded border border-mc-border hover:border-mc-accent/40 transition-colors"
          >
            <ShoppingBag className="w-3 h-3" />
            Shopify
            <ExternalLink className="w-2.5 h-2.5" />
          </a>
        </div>
      </div>

      {/* Error banner (non-fatal) */}
      {error && (
        <div className="mb-4 px-4 py-2.5 bg-mc-accent-red/10 border border-mc-accent-red/20 rounded-lg text-xs text-mc-accent-red">
          ⚠️ {error} — กำลังแสดงข้อมูล cache เก่า
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <MetricCard
          emoji="💰"
          label="รายได้วันนี้"
          value={formatCurrency(data.today.revenue, data.today.currency)}
          sub={`เมื่อวาน ${formatCurrency(data.yesterday.revenue, data.yesterday.currency)}`}
          pct={data.revenueChange}
          highlight
        />
        <MetricCard
          emoji="📦"
          label="ออเดอร์วันนี้"
          value={`${data.today.orders} ออเดอร์`}
          sub={`เมื่อวาน ${data.yesterday.orders} ออเดอร์`}
          pct={data.ordersChange}
        />
      </div>

      {/* Bottom grid: Top Products + Inventory Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TopProductsCard products={data.topProducts} />
        <InventoryAlertsCard alerts={data.inventoryAlerts} />
      </div>

      {/* Footer note */}
      <div className="mt-6 text-[10px] text-mc-text-secondary/50 text-center">
        ข้อมูลจาก Shopify Admin API · cache ทุก 5 นาที · timezone Asia/Bangkok
      </div>
    </div>
  );
}
