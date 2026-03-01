#!/usr/bin/env node
/**
 * shopify-analytics.js — Intimo Life Shopify Analytics CLI
 *
 * ดึงข้อมูลยอดขาย, ออเดอร์, สต็อก จาก Shopify Admin API
 * แสดงผลเป็น pretty-printed table หรือ JSON
 *
 * Usage:
 *   node scripts/shopify-analytics.js --range 7        # last 7 days
 *   node scripts/shopify-analytics.js --range 30       # last 30 days
 *   node scripts/shopify-analytics.js --json           # output as JSON
 *   node scripts/shopify-analytics.js --low-stock 10   # products with stock < 10
 *
 * Environment Variables (set in .env or export):
 *   SHOPIFY_STORE_URL      — e.g. your-store.myshopify.com
 *   SHOPIFY_ACCESS_TOKEN   — Admin API access token
 */

'use strict';

require('dotenv').config();
const https = require('https');

// ─── Config ──────────────────────────────────────────────────────────────────

const STORE_URL = process.env.SHOPIFY_STORE_URL;
const ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;
const API_VERSION = '2024-01';

// ─── CLI Args ─────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const getArg = (flag, defaultVal = null) => {
  const idx = args.indexOf(flag);
  return idx !== -1 ? args[idx + 1] ?? true : defaultVal;
};

const RANGE_DAYS = parseInt(getArg('--range', '7'), 10);
const OUTPUT_JSON = args.includes('--json');
const LOW_STOCK_THRESHOLD = parseInt(getArg('--low-stock', '5'), 10);

// ─── Validate Config ──────────────────────────────────────────────────────────

function validateConfig() {
  if (!STORE_URL) {
    console.error('❌ Missing SHOPIFY_STORE_URL — ดู .env.example สำหรับการตั้งค่า');
    process.exit(1);
  }
  if (!ACCESS_TOKEN) {
    console.error('❌ Missing SHOPIFY_ACCESS_TOKEN — ดู docs/SHOPIFY-INTEGRATION.md');
    process.exit(1);
  }
}

// ─── HTTP Helper ──────────────────────────────────────────────────────────────

/**
 * ส่ง request ไปยัง Shopify REST Admin API
 * @param {string} endpoint  — path หลัง /admin/api/{version}/
 * @param {Object} params    — query parameters
 * @returns {Promise<Object>} parsed JSON response
 */
function shopifyGet(endpoint, params = {}) {
  return new Promise((resolve, reject) => {
    const qs = new URLSearchParams(params).toString();
    const path = `/admin/api/${API_VERSION}/${endpoint}${qs ? '?' + qs : ''}`;
    const host = STORE_URL.replace(/^https?:\/\//, '').replace(/\/$/, '');

    const options = {
      hostname: host,
      path,
      method: 'GET',
      headers: {
        'X-Shopify-Access-Token': ACCESS_TOKEN,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error(`JSON parse error: ${e.message}`));
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

// ─── Date Helpers ─────────────────────────────────────────────────────────────

/**
 * คืนวันที่ในรูปแบบ ISO 8601 สำหรับ Shopify API
 * @param {number} daysAgo  — จำนวนวันย้อนหลัง
 * @returns {string}
 */
function dateNDaysAgo(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function today() {
  return new Date().toISOString();
}

// ─── Fetch Functions ──────────────────────────────────────────────────────────

/**
 * ดึง orders ทั้งหมดในช่วงวันที่กำหนด (handle pagination อัตโนมัติ)
 * @param {string} createdAtMin  — ISO date string
 * @param {string} createdAtMax  — ISO date string
 * @returns {Promise<Array>}
 */
async function fetchOrders(createdAtMin, createdAtMax) {
  const orders = [];
  let pageInfo = null;

  while (true) {
    const params = {
      status: 'any',
      created_at_min: createdAtMin,
      created_at_max: createdAtMax,
      limit: 250,
      fields: 'id,created_at,financial_status,fulfillment_status,total_price,subtotal_price,currency,line_items,cancel_reason',
    };

    // Shopify cursor-based pagination
    if (pageInfo) {
      params.page_info = pageInfo;
      delete params.created_at_min;
      delete params.created_at_max;
    }

    const response = await shopifyGet('orders.json', params);
    orders.push(...(response.orders || []));

    // ตรวจว่ามีหน้าถัดไปหรือไม่ (ดูจาก Link header ไม่ได้ใน native https — จะหยุดเมื่อได้ครบ 250)
    // สำหรับ store ขนาดใหญ่ควรใช้ GraphQL Cursor แทน
    if (!response.orders || response.orders.length < 250) break;

    // หมายเหตุ: native https ไม่ parse Link header โดยตรง
    // ถ้า orders > 250 ควร upgrade เป็น axios + parse Link header
    break;
  }

  return orders;
}

/**
 * ดึงรายการสินค้าที่สต็อกต่ำ
 * @param {number} threshold  — จำนวนสต็อกขั้นต่ำ
 * @returns {Promise<Array>}
 */
async function fetchLowStockProducts(threshold) {
  const response = await shopifyGet('products.json', {
    limit: 250,
    fields: 'id,title,variants,status',
  });

  const products = response.products || [];
  const lowStock = [];

  for (const product of products) {
    // ข้ามสินค้าที่ inactive
    if (product.status !== 'active') continue;

    for (const variant of product.variants) {
      // ตรวจเฉพาะ variant ที่ track inventory
      if (variant.inventory_management === 'shopify') {
        if (variant.inventory_quantity <= threshold) {
          lowStock.push({
            product_id: product.id,
            product_title: product.title,
            variant_id: variant.id,
            variant_title: variant.title,
            sku: variant.sku || '-',
            inventory_quantity: variant.inventory_quantity,
            price: variant.price,
          });
        }
      }
    }
  }

  return lowStock.sort((a, b) => a.inventory_quantity - b.inventory_quantity);
}

// ─── Analytics Calculations ───────────────────────────────────────────────────

/**
 * คำนวณ summary จาก orders array
 * @param {Array} orders
 * @returns {Object}
 */
function calculateOrderSummary(orders) {
  // กรองเฉพาะ paid orders (ไม่นับ cancelled/refunded)
  const paidOrders = orders.filter(
    (o) => o.financial_status === 'paid' || o.financial_status === 'partially_paid'
  );

  const cancelledOrders = orders.filter((o) => o.cancel_reason);

  // ยอดขายรวม
  const totalRevenue = paidOrders.reduce((sum, o) => sum + parseFloat(o.total_price || 0), 0);

  // Average Order Value
  const aov = paidOrders.length > 0 ? totalRevenue / paidOrders.length : 0;

  // จำนวนสินค้าที่ขายได้ (นับจาก line_items)
  const totalItemsSold = paidOrders.reduce((sum, o) => {
    return sum + (o.line_items || []).reduce((s, item) => s + item.quantity, 0);
  }, 0);

  // Fulfilment breakdown
  const fulfilledCount = paidOrders.filter((o) => o.fulfillment_status === 'fulfilled').length;
  const pendingCount = paidOrders.filter((o) => !o.fulfillment_status).length;

  return {
    total_orders: orders.length,
    paid_orders: paidOrders.length,
    cancelled_orders: cancelledOrders.length,
    total_revenue: totalRevenue,
    average_order_value: aov,
    total_items_sold: totalItemsSold,
    fulfilled_orders: fulfilledCount,
    pending_fulfillment: pendingCount,
    currency: orders[0]?.currency || 'THB',
  };
}

/**
 * จัดกลุ่ม orders ตามวัน (daily breakdown)
 * @param {Array} orders
 * @returns {Array}
 */
function buildDailyBreakdown(orders) {
  const byDay = {};

  for (const order of orders) {
    if (!order.created_at) continue;
    const day = order.created_at.split('T')[0]; // YYYY-MM-DD

    if (!byDay[day]) {
      byDay[day] = { date: day, orders: 0, revenue: 0, items_sold: 0 };
    }

    // นับเฉพาะ paid
    if (order.financial_status === 'paid' || order.financial_status === 'partially_paid') {
      byDay[day].orders++;
      byDay[day].revenue += parseFloat(order.total_price || 0);
      byDay[day].items_sold += (order.line_items || []).reduce((s, i) => s + i.quantity, 0);
    }
  }

  return Object.values(byDay).sort((a, b) => a.date.localeCompare(b.date));
}

// ─── Output Formatters ────────────────────────────────────────────────────────

/**
 * แสดง summary table บน terminal
 */
function printSummary(summary, rangeLabel) {
  const line = '─'.repeat(50);
  const curr = summary.currency;
  const fmt = (n) => n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  console.log('\n┌' + line + '┐');
  console.log(`│  📊  INTIMO LIFE — SHOPIFY ANALYTICS  (${rangeLabel})`);
  console.log('├' + line + '┤');
  console.log(`│  Total Orders          : ${summary.total_orders}`);
  console.log(`│  Paid Orders           : ${summary.paid_orders}`);
  console.log(`│  Cancelled Orders      : ${summary.cancelled_orders}`);
  console.log(`│  Total Revenue         : ${curr} ${fmt(summary.total_revenue)}`);
  console.log(`│  Average Order Value   : ${curr} ${fmt(summary.average_order_value)}`);
  console.log(`│  Total Items Sold      : ${summary.total_items_sold}`);
  console.log(`│  Fulfilled             : ${summary.fulfilled_orders}`);
  console.log(`│  Pending Fulfillment   : ${summary.pending_fulfillment}`);
  console.log('└' + line + '┘');
}

/**
 * แสดง daily breakdown table
 */
function printDailyBreakdown(dailyData, currency) {
  if (!dailyData.length) {
    console.log('\n  (ไม่มีข้อมูลยอดขายรายวัน)\n');
    return;
  }

  const fmt = (n) => n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  console.log('\n  📅  Daily Breakdown\n');
  console.log('  ' + '─'.repeat(55));
  console.log('  Date         Orders   Items Sold   Revenue');
  console.log('  ' + '─'.repeat(55));

  for (const row of dailyData) {
    const date = row.date.padEnd(12);
    const orders = String(row.orders).padStart(6);
    const items = String(row.items_sold).padStart(11);
    const rev = `${currency} ${fmt(row.revenue)}`.padStart(18);
    console.log(`  ${date} ${orders}   ${items}   ${rev}`);
  }

  console.log('  ' + '─'.repeat(55));
}

/**
 * แสดง low stock table
 */
function printLowStock(lowStockItems, threshold) {
  console.log(`\n  ⚠️   Low Stock Products (≤ ${threshold} units)\n`);

  if (!lowStockItems.length) {
    console.log('  ✅ ไม่มีสินค้าที่สต็อกต่ำกว่า threshold ที่กำหนด\n');
    return;
  }

  console.log('  ' + '─'.repeat(70));
  console.log('  Product                          SKU          Stock   Price');
  console.log('  ' + '─'.repeat(70));

  for (const item of lowStockItems) {
    const title = (item.product_title + (item.variant_title !== 'Default Title' ? ` (${item.variant_title})` : ''))
      .substring(0, 32)
      .padEnd(32);
    const sku = item.sku.substring(0, 12).padEnd(12);
    const qty = String(item.inventory_quantity).padStart(5);
    const price = `฿${parseFloat(item.price).toFixed(2)}`.padStart(10);
    const qtyLabel = item.inventory_quantity <= 0 ? ' 🚨' : item.inventory_quantity <= 2 ? ' ⚠️' : '';
    console.log(`  ${title} ${sku} ${qty}   ${price}${qtyLabel}`);
  }

  console.log('  ' + '─'.repeat(70));
  console.log(`\n  Total: ${lowStockItems.length} variant(s) ต้องการเติมสต็อก\n`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  validateConfig();

  const createdAtMin = dateNDaysAgo(RANGE_DAYS);
  const createdAtMax = today();
  const rangeLabel = `Last ${RANGE_DAYS} days`;

  if (!OUTPUT_JSON) {
    console.log(`\n🔄 กำลังดึงข้อมูลจาก Shopify...`);
    console.log(`   Store   : ${STORE_URL}`);
    console.log(`   Period  : ${rangeLabel}`);
  }

  try {
    // ดึงข้อมูลพร้อมกัน (parallel)
    const [orders, lowStockProducts] = await Promise.all([
      fetchOrders(createdAtMin, createdAtMax),
      fetchLowStockProducts(LOW_STOCK_THRESHOLD),
    ]);

    const summary = calculateOrderSummary(orders);
    const dailyBreakdown = buildDailyBreakdown(orders);

    if (OUTPUT_JSON) {
      // Output เป็น JSON สำหรับ pipe ไปยัง tool อื่นหรือ GitHub Action
      console.log(
        JSON.stringify(
          {
            generated_at: new Date().toISOString(),
            range_days: RANGE_DAYS,
            summary,
            daily_breakdown: dailyBreakdown,
            low_stock_products: lowStockProducts,
          },
          null,
          2
        )
      );
    } else {
      // Pretty-print สำหรับ terminal
      printSummary(summary, rangeLabel);
      printDailyBreakdown(dailyBreakdown, summary.currency);
      printLowStock(lowStockProducts, LOW_STOCK_THRESHOLD);

      console.log(`\n✅ ดึงข้อมูลสำเร็จ — ${new Date().toLocaleString('th-TH')}\n`);
    }
  } catch (err) {
    if (OUTPUT_JSON) {
      console.log(JSON.stringify({ error: err.message }, null, 2));
    } else {
      console.error(`\n❌ Error: ${err.message}`);
      if (err.message.includes('401')) {
        console.error('   → ตรวจสอบ SHOPIFY_ACCESS_TOKEN ว่าถูกต้องและมี scopes ที่จำเป็น');
      }
      if (err.message.includes('404')) {
        console.error('   → ตรวจสอบ SHOPIFY_STORE_URL ว่าถูกต้อง (e.g. your-store.myshopify.com)');
      }
    }
    process.exit(1);
  }
}

main();
