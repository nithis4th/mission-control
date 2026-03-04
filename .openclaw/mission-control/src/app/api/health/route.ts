import { NextResponse } from 'next/server';
import os from 'os';
import { execSync } from 'child_process';
import http from 'http';

/**
 * GET /api/health
 * Returns health status of all services and system metrics
 */
export async function GET() {
  try {
    const [services, metrics] = await Promise.all([
      checkServices(),
      getSystemMetrics()
    ]);

    const allUp = services.every((s: { status: string }) => s.status === 'up');

    return NextResponse.json({
      status: allUp ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      services,
      metrics
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

/**
 * Check all configured services
 */
async function checkServices() {
  const serviceConfigs = [
    { name: 'Mission Control Web', port: parseInt(process.env.PORT || '3000', 10), path: '/' },
    { name: 'OpenClaw Gateway', port: parseInt(process.env.OPENCLAW_GATEWAY_PORT || '18789', 10), path: '/' },
  ];

  const results = await Promise.all(
    serviceConfigs.map(async (config) => {
      const startTime = Date.now();
      
      try {
        const result = await checkPort(config.port, config.path);
        const responseTime = Date.now() - startTime;
        
        return {
          name: config.name,
          port: config.port,
          status: result.healthy ? 'up' : 'down',
          statusCode: result.statusCode,
          responseTime,
          checkedAt: new Date().toISOString()
        };
      } catch (error) {
        return {
          name: config.name,
          port: config.port,
          status: 'down',
          error: error instanceof Error ? error.message : 'Unknown error',
          responseTime: Date.now() - startTime,
          checkedAt: new Date().toISOString()
        };
      }
    })
  );

  return results;
}

/**
 * Check if a port is responding
 */
function checkPort(port: number, path: string): Promise<{ healthy: boolean; statusCode: number }> {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${port}${path}`, { timeout: 5000 }, (res) => {
      const isHealthy: boolean = !!(res.statusCode && res.statusCode >= 200 && res.statusCode < 400);
      resolve({ healthy: isHealthy, statusCode: res.statusCode || 0 });
    });

    req.on('error', () => {
      resolve({ healthy: false, statusCode: 0 });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({ healthy: false, statusCode: 0 });
    });
  });
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
    const times = cpu.times as unknown as Record<string, number>;
    totalTick += Object.values(times).reduce((a, b) => a + b, 0);
    totalIdle += cpu.times.idle;
  }

  const cpuUsage = 100 - (100 * totalIdle / totalTick);

  // Get disk usage (macOS/Unix)
  let diskUsage = 0;
  try {
    const dfOutput = execSync('df -h / | tail -1', { encoding: 'utf8' });
    const match = dfOutput.match(/(\d+)%/);
    if (match) {
      diskUsage = parseInt(match[1], 10);
    }
  } catch {
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
      total: Math.round(totalMem / (1024 * 1024 * 1024) * 10) / 10,
      used: Math.round((totalMem - freeMem) / (1024 * 1024 * 1024) * 10) / 10,
      free: Math.round(freeMem / (1024 * 1024 * 1024) * 10) / 10,
      usagePercent: Math.round(((totalMem - freeMem) / totalMem) * 100 * 10) / 10
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
