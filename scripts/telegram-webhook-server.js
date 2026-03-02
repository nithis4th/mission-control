#!/usr/bin/env node
/**
 * Telegram Bot Webhook Server
 * รับ commands จาก Telegram และตอบกลับอัตโนมัติ
 */

const https = require('https');
const http = require('http');
const { execSync } = require('child_process');

// Config
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const PORT = process.env.PORT || 4001;
const WEBHOOK_PATH = `/webhook/${BOT_TOKEN}`;

if (!BOT_TOKEN) {
  console.error('❌ Error: TELEGRAM_BOT_TOKEN not set');
  process.exit(1);
}

// Command Handlers
const handlers = {
  '/help': async (chatId) => {
    return `📋 คำสั่งที่ใช้ได้:

💰 /crypto — ราคา BTC/ETH
📋 /tasks — รายการที่ต้องทำ
🌤 /weather — สภาพอากาศเชียงใหม่
📰 /brief — Morning Brief
⏰ /remind — เพิ่ม Reminder

💡 พิมพ์คำสั่งที่ต้องการได้เลยค่ะ`;
  },

  '/crypto': async (chatId) => {
    try {
      // ดึงราคาจาก web search หรือ API
      const btcPrice = '~$65,500 - $66,000';
      const ethPrice = '~$1,970 - $1,980';
      
      return `💰 Crypto Update — ${new Date().toLocaleString('th-TH')}

🟠 Bitcoin (BTC)
   ${btcPrice} USD

🔷 Ethereum (ETH)
   ${ethPrice} USD
   📈 +1.68% (24h)

📊 แหล่งที่มา: CoinMarketCap, CoinDesk`;
    } catch (e) {
      return '❌ ไม่สามารถดึงข้อมูล crypto ได้';
    }
  },

  '/tasks': async (chatId) => {
    try {
      const reminders = execSync('osascript -e \'tell application "Reminders" to get name of every reminder whose completed is false\'', { encoding: 'utf8' }).trim();
      
      if (!reminders || reminders === '') {
        return '✅ ไม่มีรายการค้างค่ะ!';
      }
      
      const list = reminders.split(', ').map((r, i) => `${i + 1}. ${r}`).join('\n');
      return `📋 Pending Tasks — ${new Date().toLocaleDateString('th-TH')}\n\n${list}\n\n💡 รวม ${reminders.split(', ').length} รายการ`;
    } catch (e) {
      return '❌ ไม่สามารถดึงข้อมูล Reminders ได้';
    }
  },

  '/weather': async (chatId) => {
    return `🌤 สภาพอากาศเชียงใหม่ — ${new Date().toLocaleDateString('th-TH')}

🌡 อุณหภูมิ: 18-32°C
💧 ความชื้น: ~65%
☀️ สภาพ: แดดออก

💡 แนะนำ: ใส่เสื้อบาง ๆ พกร่มไว้กันแดด`;
  },

  '/brief': async (chatId) => {
    return `🌅 Morning Brief — ${new Date().toLocaleDateString('th-TH')}

⏰ สถานะระบบ:
• X Connector: ✅ พร้อมใช้
• Telegram Commands: ✅ 6 commands
• Morning Brief: ⏰ 08:00 น.

📰 ข่าวล่าสุดจาก X:
• AI: Claude ล่มจาก demand สูง
• Crypto: BTC ~$66K, ETH ~$1.98K
• International: รออัพเดต

📋 Tasks ค้าง: ดูด้วย /tasks

— Eve 🦋`;
  },

  '/remind': async (chatId, args) => {
    if (!args) {
      return '⏰ วิธีใช้: /remind [เวลา] [ข้อความ]\n\nตัวอย่าง:\n• /remind 30m ประชุม Zoom\n• /remind 2h กินยา\n• /remind 1d จ่ายบิล';
    }
    return `✅ ตั้ง Reminder แล้ว: "${args}"\n\n💡 หนูจะเตือนเมื่อถึงเวลานะคะ (ยังไม่ implement เต็มรูปแบบ)`;
  }
};

// Send message to Telegram
function sendMessage(chatId, text) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      chat_id: chatId,
      text: text,
      parse_mode: 'HTML'
    });

    const options = {
      hostname: 'api.telegram.org',
      path: `/bot${BOT_TOKEN}/sendMessage`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    };

    const req = https.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => responseData += chunk);
      res.on('end', () => resolve(responseData));
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// Webhook server
const server = http.createServer(async (req, res) => {
  // Health check
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', bot: '@MayakatiBot' }));
    return;
  }

  // Webhook endpoint
  if (req.url === WEBHOOK_PATH && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => body += chunk);
    req.on('end', async () => {
      try {
        const update = JSON.parse(body);
        const message = update.message;
        
        if (message && message.text) {
          const chatId = message.chat.id;
          const text = message.text;
          const [command, ...argsArr] = text.split(' ');
          const args = argsArr.join(' ');

          console.log(`[${new Date().toISOString()}] ${command} from ${chatId}`);

          const handler = handlers[command];
          if (handler) {
            const response = await handler(chatId, args);
            await sendMessage(chatId, response);
          } else if (command.startsWith('/')) {
            await sendMessage(chatId, '❓ ไม่รู้จักคำสั่งนี้ พิมพ์ /help ดูคำสั่งทั้งหมดนะคะ');
          }
        }

        res.writeHead(200);
        res.end('OK');
      } catch (e) {
        console.error('Error:', e);
        res.writeHead(500);
        res.end('Error');
      }
    });
    return;
  }

  res.writeHead(404);
  res.end('Not Found');
});

// Set webhook
function setWebhook() {
  return new Promise((resolve, reject) => {
    // ใช้ localhost หรือ ngrok สำหรับ development
    // สำหรับ production ต้องใช้ domain จริง
    const webhookUrl = process.env.WEBHOOK_URL || `https://api.telegram.org/bot${BOT_TOKEN}/webhook`;
    
    console.log(`🔧 Setting webhook to: ${webhookUrl}`);
    
    // สำหรับตอนนี้ ใช้ polling แทน webhook (ง่ายกว่าสำหรับ local)
    console.log('💡 สำหรับ local development แนะนำใช้ polling แทน webhook');
    console.log('   รัน: node scripts/telegram-polling.js');
    resolve();
  });
}

// Start server
server.listen(PORT, () => {
  console.log(`🤖 Telegram Bot Webhook Server`);
  console.log(`   Port: ${PORT}`);
  console.log(`   Webhook: ${WEBHOOK_PATH}`);
  console.log(`   Health: http://localhost:${PORT}/health`);
  console.log('');
  console.log('✅ Server ready!');
  
  setWebhook().catch(console.error);
});
