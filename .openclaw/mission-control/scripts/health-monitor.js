#!/usr/bin/env node

/**
 * Mission Control Health Monitor
 * Check status of services and system metrics
 * 
 * Usage:
 *   node health-monitor.js              # Single check
 *   node health-monitor.js --watch      # Watch mode (every 30s)
 *   node health-monitor.js --json       # JSON output
 *   node health-monitor.js --help       # Show help
 */

const http = require('http');
const { execSync } = require('child_process');
const os = require('os');

// Configuration
const CONFIG = {
  missionControlPort: process.env.PORT || 3000,
  gatewayPort: process.env.GATEWAY_PORT || 18789,
  watchInterval: 30000, // 30 seconds
  services: [
    { name: 'Mission Control', port: process.env.PORT || 3000, path: '/api/health' },
    { name: 'OpenClaw Gateway', port: process.env.GATEWAY_PORT || 18789, path: '/' },
  ]
};

// Parse arguments
const args = process.argv.slice(2);
const flags = {
  watch: args.includes('--watch') || args.includes('-w'),
  json: args.includes('--json') || args.includes('-j'),
  help: args.includes('--help') || args.includes('-h'),
};

// Show help
if (flags.help) {
  console.log(`
Mission Control Health Monitor
===============================
Usage: node health-monitor.js [options]

Options:
  --watch, -w    Watch mode - check every 30 seconds
  --json, -j     Output as JSON
  --help, -h     Show this help message

Environment Variables:
  PORT           Mission Control port (default: 3000)
  GATEWAY_PORT   OpenClaw Gateway port (default: 18789)

Examples:
  node health-monitor.js
  node health-monitor.js --watch
  node health-monitor.js --json
  PORT=4000 node health-monitor.js --watch
`);
  process.exit(0);
}

/**
 * Get system metrics (CPU, Memory, Disk)
 */
function getSystemMetrics() {
  const cpus = os.cpus();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  
  // Calculate CPU usage
  let totalIdle = 0;
  let totalTick = 0;
  
  for (const cpu of cpus) {
    for (const type in cpu.times) {
      totalTick += cpu.times[type];
    }
    totalIdle += cpu.times.idle;
  }
  
  const cpuUsage = 100 - (100 * totalIdle / totalTick);
  const memoryUsage = ((totalMem - freeMem) / totalMem) * 100;
  
  // Get disk usage (macOS/Unix)
  let diskUsage = 0;
  try {
    const dfOutput = execSync('df -h / | tail -1', { encoding: 'utf8' });
    const match = dfOutput.match(/(\d+)%/);
    if (match) {
      diskUsage = parseInt(match[1], 10);
    }
  } catch (e) {
    // Fallback if df fails
    diskUsage = 0;
  }
  
  return {
    cpu: {
      usage: Math.round(cpuUsage * 10) / 10,
      cores: cpus.length,
      model: cpus[0]?.model || 'Unknown'
    },
    memory: {
      total: Math.round(totalMem / (1024 * 1024 * 1024) * 10) / 10, // GB
      used: Math.round((totalMem - freeMem) / (1024 * 1024 * 1024) * 10) / 10, // GB
      free: Math.round(freeMem / (1024 * 1024 * 1024) * 10) / 10, // GB
      usagePercent: Math.round(memoryUsage * 10) / 10
    },
    disk: {
      usage: diskUsage,
      path: '/'
    },
    uptime: os.uptime(),
    hostname: os.hostname(),
    platform: os.platform(),
    arch: os.arch()
  };
}

/**
 * Check a single service
 */
function checkService(service) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    
    const req = http.get(`http://127.0.0.1:${service.port}${service.path}`, { timeout: 5000 }, (res) => {
      const responseTime = Date.now() - startTime;
      const isHealthy = res.statusCode >= 200 && res.statusCode < 400;
      
      resolve({
        name: service.name,
        port: service.port,
        status: isHealthy ? 'up' : 'down',
        statusCode: res.statusCode,
        responseTime: responseTime,
        checkedAt: new Date().toISOString()
      });
    });
    
    req.on('error', (err) => {
      resolve({
        name: service.name,
        port: service.port,
        status: 'down',
        error: err.message,
        responseTime: Date.now() - startTime,
        checkedAt: new Date().toISOString()
      });
    });
    
    req.on('timeout', () => {
      req.destroy();
      resolve({
        name: service.name,
        port: service.port,
        status: 'down',
        error: 'Timeout',
        responseTime: 5000,
        checkedAt: new Date().toISOString()
      });
    });
  });
}

/**
 * Check all services
 */
async function checkAllServices() {
  const results = await Promise.all(CONFIG.services.map(checkService));
  return results;
}

/**
 * Format output as pretty table
 */
function formatAsTable(healthData) {
  const { services, metrics, timestamp } = healthData;
  
  let output = '\n';
  output += '═══════════════════════════════════════════════════════════════\n';
  output += '          MISSION CONTROL HEALTH MONITOR                      \n';
  output += '═══════════════════════════════════════════════════════════════\n\n';
  
  // Services Section
  output += '▸ SERVICES\n';
  output += '───────────────────────────────────────────────────────────────\n';
  output += `  ${'Service'.padEnd(25)} ${'Status'.padEnd(10)} ${'Port'.padEnd(8)} ${'Response'.padEnd(12)}\n`;
  output += '  '.padEnd(60, '─') + '\n';
  
  for (const svc of services) {
    const statusIcon = svc.status === 'up' ? '✓ UP  ' : '✗ DOWN';
    const statusColor = svc.status === 'up' ? '\x1b[32m' : '\x1b[31m';
    const reset = '\x1b[0m';
    
    output += `  ${svc.name.padEnd(25)} ${statusColor}${statusIcon}${reset} ${String(svc.port).padEnd(8)} ${svc.responseTime}ms\n`;
  }
  
  output += '\n';
  
  // System Metrics Section
  output += '▸ SYSTEM METRICS\n';
  output += '───────────────────────────────────────────────────────────────\n';
  output += `  CPU:     ${metrics.cpu.usage}% (${metrics.cpu.cores} cores - ${metrics.cpu.model})\n`;
  output += `  Memory:  ${metrics.memory.usagePercent}% (${metrics.memory.used}GB / ${metrics.memory.total}GB)\n`;
  output += `  Disk:    ${metrics.disk.usage}% used\n`;
  output += `  Uptime:  ${formatUptime(metrics.uptime)}\n`;
  output += `  Host:    ${metrics.hostname} (${metrics.platform}/${metrics.arch})\n`;
  
  output += '\n';
  output += `  Last Updated: ${timestamp}\n`;
  output += '═══════════════════════════════════════════════════════════════\n';
  
  return output;
}

/**
 * Format uptime in human readable format
 */
function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

/**
 * Main health check function
 */
async function runHealthCheck() {
  const [services, metrics] = await Promise.all([
    checkAllServices(),
    getSystemMetrics()
  ]);
  
  const healthData = {
    status: services.every(s => s.status === 'up') ? 'healthy' : 'degraded',
    services,
    metrics,
    timestamp: new Date().toISOString()
  };
  
  if (flags.json) {
    console.log(JSON.stringify(healthData, null, 2));
  } else {
    console.log(formatAsTable(healthData));
  }
  
  return healthData;
}

// Run health check
if (flags.watch) {
  console.log('🔄 Starting health monitor in watch mode (Ctrl+C to stop)...\n');
  
  // Run immediately
  runHealthCheck();
  
  // Then run every interval
  setInterval(runHealthCheck, CONFIG.watchInterval);
} else {
  runHealthCheck();
}
