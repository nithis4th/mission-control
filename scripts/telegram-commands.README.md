# Telegram Bot Command Registrar

ลงทะเบียน slash commands สำหรับ Telegram Bot ผ่าน setMyCommands API

## Commands ที่ลงทะเบียน

| Command | คำอธิบาย |
|---------|-----------|
| `/brief` | ขอ Morning Brief — สรุปงาน, crypto, และกิจกรรมวันนี้ |
| `/crypto` | ดูราคา BTC/ETH ล่าสุด พร้อม % เปลี่ยนแปลง 24h |
| `/tasks` | ดู Pending Tasks ทั้งหมดจาก Mission Control |
| `/remind` | เพิ่ม Reminder — ตัวอย่าง: `/remind 30m ประชุม Zoom` |
| `/weather` | ดูสภาพอากาศเชียงใหม่ — อุณหภูมิ, ความชื้น, คำแนะนำ |
| `/help` | แสดงคำสั่งทั้งหมดพร้อมคำอธิบาย |

## Setup

### 1. ได้รับ Bot Token

รับ token จาก [@BotFather](https://t.me/BotFather) บน Telegram:
```
/newbot → ตั้งชื่อ → ได้ token
```

### 2. ตั้งค่า Environment Variable

```bash
export TELEGRAM_BOT_TOKEN="your-bot-token-here"
```

หรือใส่ใน `.env` (อย่า commit .env ลง git)

### 3. รัน Script

```bash
# ลงทะเบียน commands
node scripts/telegram-commands.js

# ดูก่อนโดยไม่ส่งจริง
node scripts/telegram-commands.js --dry-run

# ดู commands ที่ลงทะเบียนอยู่
node scripts/telegram-commands.js --list

# ลบ commands ทั้งหมด
node scripts/telegram-commands.js --delete

# ความช่วยเหลือ
node scripts/telegram-commands.js --help
```

## GitHub Actions (Auto-update)

Workflow `.github/workflows/update-telegram-commands.yml` จะ trigger อัตโนมัติเมื่อ:
- push ไปยัง `main` และมีการแก้ไข `scripts/telegram-commands.js`
- trigger แบบ manual ผ่าน GitHub Actions UI

### ตั้งค่า Secret

ใน GitHub repository → Settings → Secrets and variables → Actions:
```
TELEGRAM_BOT_TOKEN = your-bot-token
```

## Environment Variables

| Variable | Required | Default | คำอธิบาย |
|----------|----------|---------|-----------|
| `TELEGRAM_BOT_TOKEN` | ✅ | — | Bot token จาก @BotFather |
| `TELEGRAM_SCOPE` | ❌ | `default` | Scope: `default`, `all_private_chats`, `all_group_chats` |

## เพิ่ม Commands ใหม่

แก้ไข array `COMMANDS` ใน `telegram-commands.js`:

```js
const COMMANDS = [
  {
    command: 'new_command',  // ไม่มี slash
    description: 'คำอธิบาย (max 256 chars)',
  },
  // ...
];
```

รัน script อีกครั้งเพื่อ update
