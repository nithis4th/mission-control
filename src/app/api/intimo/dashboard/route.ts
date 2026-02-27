import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// ============================================================
//  Types
// ============================================================

export type ShopifyOrder = {
  id: number;
  created_at: string;
  total_price: string;
  currency: string;
  financial_status: string;
  line_items: ShopifyLineItem[];
};

export type ShopifyLineItem = {
  product_id: number;
  title: string;
  quantity: number;
};

export type ShopifyProduct = {
  id: number;
  title: string;
  variants: ShopifyVariant[];
};

export type ShopifyVariant = {
  id: number;
  inventory_quantity: number;
  title: string;
};

export type TopProduct = {
  productId: number;
  title: string;
  unitsSold: number;
};

export type InventoryAlert = {
  productId: number;
  variantId: number;
  productTitle: string;
  variantTitle: string;
  inventoryQuantity: number;
};

export type DashboardMetrics = {
  today: {
    orders: number;
    revenue: number;
    currency: string;
  };
  yesterday: {
    orders: number;
    revenue: number;
    currency: string;
  };
  revenueChange: number;
  ordersChange: number;
  topProducts: TopProduct[];
  inventoryAlerts: InventoryAlert[];
  lastUpdated: string;
};

// ============================================================
//  Simple in-memory cache (5 minutes)
// ============================================================

type CacheEntry = {
  data: DashboardMetrics;
  expiresAt: number;
};

let cache: CacheEntry | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000;

// ============================================================
//  Shopify helpers
// ============================================================

function getShopifyConfig() {
  const domain = process.env.SHOPIFY_SHOP_DOMAIN;
  const token = process.env.SHOPIFY_ADMIN_API_TOKEN;
  return { domain, token, configured: Boolean(domain && token) };
}

async function shopifyFetch(path: string, domain: string, token: string) {
  const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const url = `https://${cleanDomain}/admin/api/2024-01${path}`;

  const res = await fetch(url, {
    headers: {
      'X-Shopify-Access-Token': token,
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) {
    throw new Error(`Shopify API error ${res.status} for ${path}`);
  }

  return res.json();
}

// ============================================================
//  Date helpers (Bangkok UTC+7)
// ============================================================

function getBangkokDayRange(daysAgo: number) {
  const nowUtc = new Date();
  const bangkokOffset = 7 * 60; // minutes
  const bangkokNow = new Date(nowUtc.getTime() + bangkokOffset * 60 * 1000);

  const startOfDay = new Date(bangkokNow);
  startOfDay.setUTCHours(0, 0, 0, 0);
  startOfDay.setUTCDate(startOfDay.getUTCDate() - daysAgo);

  const endOfDay = new Date(startOfDay);
  endOfDay.setUTCHours(23, 59, 59, 999);

  const utcStart = new Date(startOfDay.getTime() - bangkokOffset * 60 * 1000);
  const utcEnd = new Date(endOfDay.getTime() - bangkokOffset * 60 * 1000);

  return {
    start: utcStart.toISOString(),
    end: utcEnd.toISOString(),
  };
}

function getSevenDaysAgoIso() {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString();
}

// ============================================================
//  Data fetching
// ============================================================

async function fetchOrdersForRange(
  domain: string,
  token: string,
  start: string,
  end: string,
): Promise<ShopifyOrder[]> {
  const params = new URLSearchParams({
    status: 'any',
    financial_status: 'paid',
    created_at_min: start,
    created_at_max: end,
    limit: '250',
    fields: 'id,created_at,total_price,currency,financial_status,line_items',
  });

  const data = await shopifyFetch(`/orders.json?${params}`, domain, token);
  return (data.orders as ShopifyOrder[]) || [];
}

async function fetchTopProducts(domain: string, token: string): Promise<TopProduct[]> {
  const since = getSevenDaysAgoIso();
  const params = new URLSearchParams({
    status: 'any',
    financial_status: 'paid',
    created_at_min: since,
    limit: '250',
    fields: 'line_items',
  });

  const data = await shopifyFetch(`/orders.json?${params}`, domain, token);
  const orders: ShopifyOrder[] = data.orders || [];

  const productMap = new Map<number, { title: string; units: number }>();
  for (const order of orders) {
    for (const item of order.line_items || []) {
      const existing = productMap.get(item.product_id) || { title: item.title, units: 0 };
      productMap.set(item.product_id, {
        title: item.title,
        units: existing.units + item.quantity,
      });
    }
  }

  return Array.from(productMap.entries())
    .map(([productId, { title, units }]) => ({ productId, title, unitsSold: units }))
    .sort((a, b) => b.unitsSold - a.unitsSold)
    .slice(0, 5);
}

async function fetchInventoryAlerts(domain: string, token: string): Promise<InventoryAlert[]> {
  const data = await shopifyFetch(
    '/products.json?limit=250&fields=id,title,variants',
    domain,
    token,
  );
  const products: ShopifyProduct[] = data.products || [];

  const alerts: InventoryAlert[] = [];
  for (const product of products) {
    for (const variant of product.variants || []) {
      if (variant.inventory_quantity < 10 && variant.inventory_quantity >= 0) {
        alerts.push({
          productId: product.id,
          variantId: variant.id,
          productTitle: product.title,
          variantTitle: variant.title,
          inventoryQuantity: variant.inventory_quantity,
        });
      }
    }
  }

  return alerts.sort((a, b) => a.inventoryQuantity - b.inventoryQuantity).slice(0, 20);
}

// ============================================================
//  Compute metrics from orders
// ============================================================

function summariseOrders(orders: ShopifyOrder[]) {
  const count = orders.length;
  const revenue = orders.reduce((sum, o) => sum + parseFloat(o.total_price || '0'), 0);
  const currency = orders[0]?.currency || 'THB';
  return { orders: count, revenue, currency };
}

function pctChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100 * 10) / 10;
}

// ============================================================
//  Main handler
// ============================================================

export async function GET() {
  try {
    const { domain, token, configured } = getShopifyConfig();

    if (!configured) {
      return NextResponse.json(
        {
          error: 'NOT_CONFIGURED',
          message:
            'Shopify credentials are not set. Add SHOPIFY_SHOP_DOMAIN and SHOPIFY_ADMIN_API_TOKEN to your .env.local file.',
        },
        { status: 200 },
      );
    }

    if (cache && Date.now() < cache.expiresAt) {
      return NextResponse.json({ ...cache.data, cached: true });
    }

    const todayRange = getBangkokDayRange(0);
    const yesterdayRange = getBangkokDayRange(1);

    const [todayOrders, yesterdayOrders, topProducts, inventoryAlerts] = await Promise.all([
      fetchOrdersForRange(domain!, token!, todayRange.start, todayRange.end),
      fetchOrdersForRange(domain!, token!, yesterdayRange.start, yesterdayRange.end),
      fetchTopProducts(domain!, token!),
      fetchInventoryAlerts(domain!, token!),
    ]);

    const todaySummary = summariseOrders(todayOrders);
    const yesterdaySummary = summariseOrders(yesterdayOrders);

    const metrics: DashboardMetrics = {
      today: todaySummary,
      yesterday: yesterdaySummary,
      revenueChange: pctChange(todaySummary.revenue, yesterdaySummary.revenue),
      ordersChange: pctChange(todaySummary.orders, yesterdaySummary.orders),
      topProducts,
      inventoryAlerts,
      lastUpdated: new Date().toISOString(),
    };

    cache = { data: metrics, expiresAt: Date.now() + CACHE_TTL_MS };

    return NextResponse.json(metrics);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[/api/intimo/dashboard] Error:', message);
    return NextResponse.json(
      { error: 'FETCH_ERROR', message },
      { status: 500 },
    );
  }
}
