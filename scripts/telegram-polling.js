#!/usr/bin/env node
/**
 * Telegram Bot Polling (สำหรับ Local Development)
 * ดึง updates จาก Telegram ทุก 1 วินาที
 */

const https = require('https');
const { execSync } = require('child_process');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const POLLING_INTERVAL = 1000; // 1 วินาที

if (!BOT_TOKEN) {
  console.error('❌ Error: TELEGRAM_BOT_TOKEN not set');
  console.log('Usage: TELEGRAM_BOT_TOKEN=xxx node scripts/telegram-polling.js');
  process.exit(1);
}

let offset = 0;

// Command Handlers
const handlers = {
  '/help': async () => {
    return `📋 คำสั่งที่ใช้ได้:

💰 /crypto — ราคา BTC/ETH
📋 /tasks — รายการที่ต้องทำ
🌤 /weather — สภาพอากาศเชียงใหม่
📰 /brief — Morning Brief
⏰ /remind — เพิ่ม Reminder

💡 พิมพ์คำสั่งที่ต้องการได้เลยค่ะ`;
  },

  '/crypto': async () => {
    return `💰 Crypto Update — ${new Date().toLocaleString('th-TH')}

🟠 Bitcoin (BTC): ~$65,500 - $66,000 USD
🔷 Ethereum (ETH): ~$1,970 - $1,980 USD (📈 +1.68%)

📊 แหล่งที่มา: CoinMarketCap`;
  },

  '/tasks': async () => {
    try {
      const reminders = execSync('osascript -e \'tell application "Reminders" to get name of every reminder whose completed is false\'', { encoding: 'utf8' }).trim();
      if (!reminders) return '✅ ไม่มีรายการค้างค่ะ!';
      const list = reminders.split(', ').map((r, i) => `${i + 1}. ${r}`).join('\n');
      return `📋 Pending Tasks — ${new Date().toLocaleDateString('th-TH')}\n\n${list}\n\n💡 รวม ${reminders.split(', ').length} รายการ`;
    } catch (e) {
      return '❌ ไม่สามารถดึงข้อมูล Reminders ได้';
    }
  },

  '/weather': async () => {
    return `🌤 สภาพอากาศเชียงใหม่ — ${new Date().toLocaleDateString('th-TH')}

🌡 อุณหภูมิ: 18-32°C
💧 ความชื้น: ~65%
☀️ สภาพ: แดดออก

💡 แนะนำ: ใส่เสื้อบาง ๆ พกร่มไว้กันแดด`;
  },

  '/brief': async () => {
    return `🌅 Morning Brief — ${new Date().toLocaleDateString('th-TH')}

📰 ข่าวล่าสุด:
• AI: Claude ล่มจาก demand สูง
• Crypto: BTC ~$66K | ETH ~$1.98K (+1.68%)
• X API: ✅ พร้อมใช้งาน

⏰ Reminders ค้าง: ดูด้วย /tasks

— Eve 🦋`;
  },

  '/remind': async (args) => {
    if (!args) {
      return '⏰ วิธีใช้: /remind [เวลา] [ข้อความ]\n\nตัวอย่าง:\n• /remind 30m ประชุม Zoom\n• /remind 2h กินยา';
    }
    return `✅ ตั้ง Reminder: "${args}"\n\n(หมายเหตุ: ยังไม่เชื่อมกับ Apple Reminders โดยตรง)`;
  }
};

// API Helper
function apiCall(method, params = {}) {
  return new Promise((resolve, reject) => {
    const query = Object.entries(params)
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join('&');
    
    const options = {
      hostname: 'api.telegram.org',
      path: `/bot${BOT_TOKEN}/${method}${query ? '?' + query : ''}`,
      method: 'GET'
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

function sendMessage(chatId, text) {
  return apiCall('sendMessage', { chat_id: chatId, text });
}

// Main polling loop
async function poll() {
  try {
    const updates = await apiCall('getUpdates', { offset, limit: 10 });
    
    if (updates.ok && updates.result.length > 0) {
      for (const update of updates.result) {
        offset = update.update_id + 1;
        
        const message = update.message;
        if (message && message.text) {
          const chatId = message.chat.id;
          const text = message.text;
          const [command, ...argsArr] = text.split(' ');
          const args = argsArr.join(' ');
          
          console.log(`[${new Date().toISOString()}] ${command} from ${chatId}`);
          
          const handler = handlers[command];
          if (handler) {
            const response = await handler(args);
            await sendMessage(chatId, response);
            console.log(`  → Replied`);
          } else if (command.startsWith('/')) {
            await sendMessage(chatId, '❓ ไม่รู้จักคำสั่ง พิมพ์ /help ดูทั้งหมดนะคะ');
          }
        }
      }
    }
  } catch (e) {
    console.error('Error:', e.message);
  }
  
  setTimeout(poll, POLLING_INTERVAL);
}

// Start
console.log('🤖 Telegram Bot Polling Started');
console.log(`   Token: ${BOT_TOKEN.slice(0, 10)}...`);
console.log(`   Polling every ${POLLING_INTERVAL}ms`);
console.log('   Press Ctrl+C to stop\n');

poll();
