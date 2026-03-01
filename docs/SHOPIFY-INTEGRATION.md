# 🛍️ Shopify Analytics Integration — คู่มือการตั้งค่า

> **สำหรับ:** Intimo Life Shopify Store  
> **เครื่องมือ:** `scripts/shopify-analytics.js`  
> **ใช้งาน:** ดึงข้อมูลยอดขาย, ออเดอร์, สต็อกสินค้า แบบ realtime

---

## 📋 สารบัญ

1. [ข้อกำหนดเบื้องต้น](#1-ข้อกำหนดเบื้องต้น)
2. [วิธีสร้าง Shopify Private App](#2-วิธีสร้าง-shopify-private-app)
3. [วิธีรับ Access Token](#3-วิธีรับ-access-token)
4. [การตั้งค่า Environment Variables](#4-การตั้งค่า-environment-variables)
5. [วิธีใช้งาน Script](#5-วิธีใช้งาน-script)
6. [ตัวอย่าง Output](#6-ตัวอย่าง-output)
7. [GitHub Action — Daily Report อัตโนมัติ](#7-github-action--daily-report-อัตโนมัติ)
8. [Troubleshooting](#8-troubleshooting)

---

## 1. ข้อกำหนดเบื้องต้น

| รายการ | รายละเอียด |
|--------|-----------|
| Node.js | v18 หรือใหม่กว่า |
| Shopify Plan | Basic ขึ้นไป (ต้องการ Admin API access) |
| สิทธิ์ | Owner หรือ Staff ที่มี **Apps** permission |

---

## 2. วิธีสร้าง Shopify Private App

### ขั้นตอนที่ 1 — เข้า App Settings

1. Login เข้า **Shopify Admin**: `https://admin.shopify.com/store/YOUR_STORE_NAME`
2. ไปที่ **Settings** (⚙️ ที่มุมล่างซ้าย)
3. คลิก **Apps and sales channels**
4. คลิก **Develop apps** (ถ้าไม่เห็นให้คลิก "Allow custom app development" ก่อน)

### ขั้นตอนที่ 2 — สร้าง App

1. คลิก **Create an app**
2. ตั้งชื่อ App: `Mission Control Analytics`
3. App developer: เลือก email ของตัวเอง
4. คลิก **Create app**

### ขั้นตอนที่ 3 — กำหนด API Scopes

1. ใน App ที่สร้าง คลิก tab **Configuration**
2. ใต้ **Admin API integration** คลิก **Configure**
3. เปิด scopes ต่อไปนี้:

   | Scope | ใช้สำหรับ |
   |-------|----------|
   | `read_orders` | ดึงข้อมูล orders และยอดขาย |
   | `read_products` | ดึงข้อมูลสินค้าและ variants |
   | `read_inventory` | ดูสต็อกสินค้า |

4. คลิก **Save**

---

## 3. วิธีรับ Access Token

1. กลับไปที่ App overview คลิก **Install app**
2. ยืนยัน permissions → คลิก **Install**
3. ไปที่ tab **API credentials**
4. ใต้ **Admin API access token** คลิก **Reveal token once**

> ⚠️ **สำคัญมาก:** Token แสดงได้ **ครั้งเดียวเท่านั้น** — Copy ทันทีและเก็บใน `.env.local` หรือ Password Manager  
> ถ้าพลาด ต้องลบ App และสร้างใหม่

Token จะขึ้นต้นด้วย `shpat_` เช่น:
```
shpat_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
```

---

## 4. การตั้งค่า Environment Variables

```bash
# Copy template
cp .env.example .env.local

# แก้ไขค่าใน .env.local
```

เปิดไฟล์ `.env.local` และใส่ค่า:

```env
# URL ของ store (รวม https://)
SHOPIFY_STORE_URL=https://intimo-life.myshopify.com

# Access Token ที่ copy จาก Shopify
SHOPIFY_ACCESS_TOKEN=shpat_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

> 🔒 `.env.local` อยู่ใน `.gitignore` — **ไม่ถูก commit** ขึ้น GitHub

---

## 5. วิธีใช้งาน Script

### Basic Usage

```bash
# ดูยอดขาย 7 วันล่าสุด (default)
node scripts/shopify-analytics.js

# กำหนด date range เอง
node scripts/shopify-analytics.js --range 7     # last 7 days
node scripts/shopify-analytics.js --range 30    # last 30 days
node scripts/shopify-analytics.js --range 90    # last 90 days

# ดูสินค้าที่สต็อกต่ำกว่า X ชิ้น
node scripts/shopify-analytics.js --low-stock 10

# Output เป็น JSON (สำหรับ pipe ไปยัง tool อื่น)
node scripts/shopify-analytics.js --range 30 --json

# รวม options
node scripts/shopify-analytics.js --range 14 --low-stock 5 --json
```

### npm Script (ถ้าเพิ่มใน package.json)

```json
"scripts": {
  "shopify:report": "node scripts/shopify-analytics.js --range 7",
  "shopify:monthly": "node scripts/shopify-analytics.js --range 30",
  "shopify:json": "node scripts/shopify-analytics.js --json"
}
```

---

## 6. ตัวอย่าง Output

### Terminal (Pretty-print)

```
🔄 กำลังดึงข้อมูลจาก Shopify...
   Store   : https://intimo-life.myshopify.com
   Period  : Last 7 days

┌──────────────────────────────────────────────────┐
│  📊  INTIMO LIFE — SHOPIFY ANALYTICS  (Last 7 days)
├──────────────────────────────────────────────────┤
│  Total Orders          : 42
│  Paid Orders           : 38
│  Cancelled Orders      : 4
│  Total Revenue         : THB 85,400.00
│  Average Order Value   : THB 2,247.37
│  Total Items Sold      : 67
│  Fulfilled             : 31
│  Pending Fulfillment   : 7
└──────────────────────────────────────────────────┘

  📅  Daily Breakdown

  ──────────────────────────────────────────────────────
  Date         Orders   Items Sold   Revenue
  ──────────────────────────────────────────────────────
  2026-02-24        5           9    THB 11,200.00
  2026-02-25        6          11    THB 13,450.00
  2026-02-26        4           7    THB  9,800.00
  2026-02-27        7          12    THB 15,750.00
  2026-02-28        6          10    THB 13,500.00
  2026-03-01        5           9    THB 11,300.00
  2026-03-02        5           9    THB 10,400.00
  ──────────────────────────────────────────────────────

  ⚠️   Low Stock Products (≤ 5 units)

  ──────────────────────────────────────────────────────────────────────
  Product                          SKU          Stock   Price
  ──────────────────────────────────────────────────────────────────────
  Intimate Massage Oil (50ml)  OIL-50ML        0      ฿890.00 🚨
  Couple Kit Premium           KIT-PREM        2      ฿2,490.00 ⚠️
  Scented Candle Set           CNDL-SET        3      ฿650.00 ⚠️
  Body Lotion Lavender         LOT-LAV         5      ฿490.00
  ──────────────────────────────────────────────────────────────────────

  Total: 4 variant(s) ต้องการเติมสต็อก

✅ ดึงข้อมูลสำเร็จ — 2 มีนาคม 2569 เวลา 10:15:32
```

### JSON Output

```json
{
  "generated_at": "2026-03-02T03:15:32.000Z",
  "range_days": 7,
  "summary": {
    "total_orders": 42,
    "paid_orders": 38,
    "cancelled_orders": 4,
    "total_revenue": 85400.00,
    "average_order_value": 2247.37,
    "total_items_sold": 67,
    "fulfilled_orders": 31,
    "pending_fulfillment": 7,
    "currency": "THB"
  },
  "daily_breakdown": [
    { "date": "2026-02-24", "orders": 5, "revenue": 11200.00, "items_sold": 9 },
    { "date": "2026-02-25", "orders": 6, "revenue": 13450.00, "items_sold": 11 }
  ],
  "low_stock_products": [
    {
      "product_id": 123456789,
      "product_title": "Intimate Massage Oil",
      "variant_title": "50ml",
      "sku": "OIL-50ML",
      "inventory_quantity": 0,
      "price": "890.00"
    }
  ]
}
```

---

## 7. GitHub Action — Daily Report อัตโนมัติ

ดูไฟล์: [`.github/workflows/shopify-daily-report.yml`](../.github/workflows/shopify-daily-report.yml)

### วิธีตั้งค่า Secrets

1. ไปที่ GitHub Repository → **Settings** → **Secrets and variables** → **Actions**
2. คลิก **New repository secret** และเพิ่ม:

   | Secret Name | ค่า |
   |-------------|-----|
   | `SHOPIFY_STORE_URL` | `https://intimo-life.myshopify.com` |
   | `SHOPIFY_ACCESS_TOKEN` | `shpat_xxxx...` |
   | `TELEGRAM_BOT_TOKEN` | Bot token จาก @BotFather |
   | `TELEGRAM_CHAT_ID` | Chat ID ที่ต้องการส่ง report |

### วิธีรับ Telegram Bot Token

1. เปิด Telegram → คุยกับ **@BotFather**
2. พิมพ์ `/newbot` → ตั้งชื่อ bot
3. Copy token ที่ได้ (รูปแบบ: `1234567890:ABCdefGHI...`)

### วิธีหา Telegram Chat ID

```bash
# ส่งข้อความถึง bot ก่อน 1 ครั้ง แล้วรันคำสั่งนี้
curl "https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates" | python3 -m json.tool
# หา "chat" → "id" ใน response
```

### Schedule

Action จะรันทุกวัน **เวลา 09:00 น. (ICT)** = 02:00 UTC โดยอัตโนมัติ  
สามารถ trigger manual ได้ผ่าน **Actions** tab → **Run workflow**

---

## 8. Troubleshooting

### ❌ `401 Unauthorized`

```
Error: HTTP 401: {"errors":"[API] Invalid API key or access token"}
```

**สาเหตุ:** Access token ผิดหรือหมดอายุ  
**วิธีแก้:**
1. ตรวจสอบ `SHOPIFY_ACCESS_TOKEN` ใน `.env.local`
2. ตรวจสอบว่า App ถูก Install แล้ว (ไม่ใช่แค่ Create)
3. ถ้า token ไม่มีแล้ว → สร้าง App ใหม่

### ❌ `404 Not Found`

```
Error: HTTP 404
```

**สาเหตุ:** Store URL ผิด  
**วิธีแก้:** ตรวจสอบ `SHOPIFY_STORE_URL` — ต้องเป็น `https://xxx.myshopify.com`

### ❌ `403 Forbidden`

**สาเหตุ:** Scopes ไม่ครบ  
**วิธีแก้:**
1. ไปที่ App → Configuration → Admin API scopes
2. เปิด `read_orders`, `read_products`, `read_inventory`
3. Save → **Reinstall app**

### ❌ ข้อมูลไม่ครบ (ออเดอร์น้อยกว่าความจริง)

หากมี orders มากกว่า 250 รายการในช่วงที่เลือก script ปัจจุบันดึงได้ 250 รายการต่อ request  
**แนวทางแก้:** ในเวอร์ชันต่อไปจะเพิ่ม cursor-based pagination สมบูรณ์ หรือเปลี่ยนไปใช้ GraphQL API

---

## 📞 ติดต่อ

หากพบปัญหาหรือต้องการเพิ่ม feature เปิด Issue บน GitHub หรือติดต่อทีม Mission Control
