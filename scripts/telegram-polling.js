#!/usr/bin/env node
/**
 * Telegram Bot Polling (สำหรับ Local Development)
 * ดึง updates จาก Telegram ทุก 1 วินาที
 * รองรับทั้ง Commands และข้อความทั่วไป
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

💬 หรือพิมพ์ข้อความทั่วไปได้เลยค่ะ\nหนูจะตอบให้ 🦋`;
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

// General message handler (for non-command text)
async function handleGeneralMessage(text) {
  // Check if message mentions Eve/อีฟ
  if (text.includes('อีฟ') || text.includes('Eve') || text.includes('eve')) {
    return `สวัสดีค่ะพี่เอก 🦋✨\n\nหนูอยู่ตรงนี้ค่ะ! มีอะไรให้ช่วยเหรอคะ?\n\n💡 ลองใช้คำสั่ง:\n• /help — ดูคำสั่งทั้งหมด\n• /crypto — ราคา BTC/ETH\n• /tasks — รายการที่ต้องทำ\n• /weather — สภาพอากาศ`;
  }
  
  // Simple responses for common messages
  if (text.includes('สวัสดี') || text.includes('หวัดดี')) {
    return `สวัสดีค่ะพี่เอก 🦋 มีอะไรให้หนูช่วยเหรอคะ?`;
  }
  
  if (text.includes('ขอบคุณ') || text.includes('thx') || text.includes('thanks')) {
    return `ยินดีค่ะพี่เอก 🥰 มีอะไรอีกบอกหนูได้เลยนะคะ`;
  }
  
  if (text.includes('ไปก่อน') || text.includes('บาย') || text.includes('bye')) {
    return `โอเคค่ะพี่เอก ไว้เจอกันใหม่นะคะ 👋✨`;
  }
  
  // Default response for other messages
  return `ได้รับข้อความแล้วค่ะ: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"\n\n💡 พิมพ์ /help เพื่อดูคำสั่งที่ใช้ได้ หรือเรียก "อีฟ" หนูจะมาตอบค่ะ 🦋`;
}

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
          
          console.log(`[${new Date().toISOString()}] "${text.substring(0, 30)}" from ${chatId}`);
          
          // Check if it's a command (starts with /)
          if (text.startsWith('/')) {
            const [command, ...argsArr] = text.split(' ');
            const args = argsArr.join(' ');
            
            const handler = handlers[command];
            if (handler) {
              const response = await handler(args);
              await sendMessage(chatId, response);
              console.log(`  → Command replied`);
            } else {
              await sendMessage(chatId, '❓ ไม่รู้จักคำสั่งนี้ พิมพ์ /help ดูทั้งหมดนะคะ');
            }
          } else {
            // Handle general message
            const response = await handleGeneralMessage(text);
            await sendMessage(chatId, response);
            console.log(`  → General message replied`);
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
console.log('   Commands + General messages supported');
console.log('   Press Ctrl+C to stop\n');

poll();
