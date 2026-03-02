#!/usr/bin/env node
/**
 * telegram-commands.js
 * CLI สำหรับลงทะเบียน Telegram Bot Commands ผ่าน setMyCommands API
 *
 * Usage:
 *   TELEGRAM_BOT_TOKEN=xxx node scripts/telegram-commands.js
 *   TELEGRAM_BOT_TOKEN=xxx node scripts/telegram-commands.js --dry-run
 *   TELEGRAM_BOT_TOKEN=xxx node scripts/telegram-commands.js --delete
 *   TELEGRAM_BOT_TOKEN=xxx node scripts/telegram-commands.js --list
 *
 * Environment Variables:
 *   TELEGRAM_BOT_TOKEN  (required) — Telegram Bot API token จาก @BotFather
 *   TELEGRAM_SCOPE      (optional) — "default" | "all_private_chats" | "all_group_chats"
 */

'use strict';

const https = require('https');

// ─── Config ──────────────────────────────────────────────────────────────────

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const SCOPE_TYPE = process.env.TELEGRAM_SCOPE || 'default';
const API_BASE = `https://api.telegram.org/bot${BOT_TOKEN}`;

// ─── Command Definitions ─────────────────────────────────────────────────────

const COMMANDS = [
  {
    command: 'brief',
    description: 'ขอ Morning Brief สรุปงาน, crypto, และกิจกรรมวันนี้',
  },
  {
    command: 'crypto',
    description: 'ดูราคา BTC/ETH ล่าสุด พร้อม % เปลี่ยนแปลง 24h',
  },
  {
    command: 'tasks',
    description: 'ดู Pending Tasks ทั้งหมดจาก Mission Control',
  },
  {
    command: 'remind',
    description: 'เพิ่ม Reminder ตัวอย่าง: /remind 30m ประชุม Zoom',
  },
  {
    command: 'weather',
    description: 'ดูสภาพอากาศเชียงใหม่ อุณหภูมิ, ความชื้น, คำแนะนำ',
  },
  {
    command: 'help',
    description: 'แสดงคำสั่งทั้งหมดพร้อมคำอธิบาย',
  },
];

// ─── Logger ──────────────────────────────────────────────────────────────────

function timestamp() {
  return new Date().toISOString().replace('T', ' ').slice(0, 19);
}

const log = {
  info:  (msg, ...a) => console.log(`[INFO]  ${timestamp()} ${msg}`, ...a),
  ok:    (msg, ...a) => console.log(`[OK]    ${timestamp()} ${msg}`, ...a),
  warn:  (msg, ...a) => console.warn(`[WARN]  ${timestamp()} ${msg}`, ...a),
  error: (msg, ...a) => console.error(`[ERROR] ${timestamp()} ${msg}`, ...a),
};

// ─── Telegram API ─────────────────────────────────────────────────────────────

function telegramRequest(method, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const options = {
      hostname: 'api.telegram.org',
      path: `/bot${BOT_TOKEN}/${method}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (!parsed.ok) {
            reject(new Error(`Telegram API error [${parsed.error_code}]: ${parsed.description}`));
          } else {
            resolve(parsed);
          }
        } catch {
          reject(new Error(`Failed to parse response: ${data}`));
        }
      });
    });

    req.on('error', (err) => reject(new Error(`Network error: ${err.message}`)));
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Request timed out after 10s'));
    });

    req.write(payload);
    req.end();
  });
}

// ─── Core Functions ───────────────────────────────────────────────────────────

async function validateToken() {
  const res = await telegramRequest('getMe', {});
  const bot = res.result;
  log.ok(`Bot: @${bot.username} (${bot.first_name}) id=${bot.id}`);
  return bot;
}

async function setCommands(commands, scope) {
  log.info(`ลงทะเบียน ${commands.length} commands (scope: ${scope.type})...`);

  // ลงทะเบียนสำหรับ Thai
  await telegramRequest('setMyCommands', {
    commands,
    scope,
    language_code: 'th',
  });

  // ลงทะเบียนเป็น default (fallback ทุกภาษา)
  const result = await telegramRequest('setMyCommands', {
    commands,
    scope,
  });

  return result;
}

async function getCommands(scope) {
  return telegramRequest('getMyCommands', { scope });
}

async function deleteCommands(scope) {
  log.warn(`กำลังลบ commands (scope: ${scope.type})...`);
  return telegramRequest('deleteMyCommands', { scope });
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');
  const isDelete = args.includes('--delete');
  const isList   = args.includes('--list');
  const showHelp = args.includes('--help') || args.includes('-h');

  if (showHelp) {
    console.log(`
Telegram Bot Command Registrar
-------------------------------
Usage: TELEGRAM_BOT_TOKEN=<token> node scripts/telegram-commands.js [options]

Options:
  (none)       ลงทะเบียน commands ทั้งหมด
  --dry-run    แสดง commands ที่จะลงทะเบียนโดยไม่ส่ง API จริง
  --list       แสดง commands ที่ลงทะเบียนอยู่แล้ว
  --delete     ลบ commands ทั้งหมด
  --help, -h   แสดงข้อความนี้

Environment:
  TELEGRAM_BOT_TOKEN  (required) Bot API token จาก @BotFather
  TELEGRAM_SCOPE      (optional) default | all_private_chats | all_group_chats
`);
    process.exit(0);
  }

  // ── Validate required env ──
  if (!BOT_TOKEN) {
    log.error('TELEGRAM_BOT_TOKEN is not set!');
    log.error('  export TELEGRAM_BOT_TOKEN="your-bot-token"');
    process.exit(1);
  }

  const SCOPE = { type: SCOPE_TYPE };

  // ── Dry Run ──
  if (isDryRun) {
    log.info('=== DRY RUN MODE ===');
    log.info(`Token: ${BOT_TOKEN.slice(0, 6)}...${BOT_TOKEN.slice(-4)}`);
    log.info(`Scope: ${SCOPE_TYPE}`);
    log.info(`\nCommands ที่จะลงทะเบียน (${COMMANDS.length} รายการ):`);
    COMMANDS.forEach((cmd, i) => {
      console.log(`  ${i + 1}. /${cmd.command}`);
      console.log(`     ${cmd.description}`);
    });
    log.ok('Dry run complete — ไม่มี API call');
    return;
  }

  try {
    log.info('ตรวจสอบ Bot Token...');
    await validateToken();

    // ── List ──
    if (isList) {
      log.info('กำลังดึง commands ที่ลงทะเบียนอยู่...');
      const res = await getCommands(SCOPE);
      const cmds = res.result;
      if (cmds.length === 0) {
        log.warn('ยังไม่มี commands ลงทะเบียน');
      } else {
        log.ok(`พบ ${cmds.length} commands:`);
        cmds.forEach((cmd) => console.log(`  /${cmd.command} — ${cmd.description}`));
      }
      return;
    }

    // ── Delete ──
    if (isDelete) {
      await deleteCommands(SCOPE);
      log.ok('ลบ commands ทั้งหมดเรียบร้อย');
      return;
    }

    // ── Register ──
    await setCommands(COMMANDS, SCOPE);
    log.ok(`ลงทะเบียน ${COMMANDS.length} commands สำเร็จ!`);

    // ── Verify ──
    log.info('ตรวจสอบ commands ที่ลงทะเบียน...');
    const registered = await getCommands(SCOPE);
    const cmds = registered.result;

    if (cmds.length === 0) {
      log.warn('ไม่พบ commands — อาจมีปัญหา scope หรือ propagation delay');
    } else {
      log.ok(`ยืนยัน: ${cmds.length} commands พร้อมใช้งาน:`);
      cmds.forEach((cmd) => console.log(`  ✓ /${cmd.command} — ${cmd.description}`));
    }

  } catch (err) {
    log.error(err.message);

    if (err.message.includes('401') || err.message.includes('Unauthorized')) {
      log.error('Token ไม่ถูกต้อง — ตรวจสอบ TELEGRAM_BOT_TOKEN');
    } else if (err.message.includes('Network') || err.message.includes('timed out')) {
      log.error('ไม่สามารถเชื่อมต่อ Telegram API — ตรวจสอบ internet connection');
    }

    process.exit(1);
  }
}

main();
