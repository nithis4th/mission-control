import fs from 'fs/promises';
import path from 'path';

export type CostSnapshot = {
  date: string;
  takenAt: string;
  totalTokens: number;
  totalCost: number;
  todayTokens: number;
  todayCost: number;
  modelBreakdown: Array<{
    model: string;
    tokens: number;
    cost: number;
    count: number;
    inputTokens: number;
    outputTokens: number;
  }>;
};

const HISTORY_DIR = path.join(process.env.HOME || '', '.openclaw', 'workspace', 'cost-history');

export function getBangkokDate(date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function getHistoryDir() {
  return HISTORY_DIR;
}

export async function ensureHistoryDir() {
  await fs.mkdir(HISTORY_DIR, { recursive: true });
}

export function snapshotPathByDate(date: string): string {
  return path.join(HISTORY_DIR, `${date}.json`);
}

export async function writeSnapshot(snapshot: CostSnapshot): Promise<string> {
  await ensureHistoryDir();
  const filePath = snapshotPathByDate(snapshot.date);
  await fs.writeFile(filePath, JSON.stringify(snapshot, null, 2), 'utf-8');
  return filePath;
}

export async function readSnapshot(date: string): Promise<CostSnapshot | null> {
  try {
    const filePath = snapshotPathByDate(date);
    const raw = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(raw) as CostSnapshot;
  } catch {
    return null;
  }
}

export async function listRecentSnapshots(days: number): Promise<CostSnapshot[]> {
  await ensureHistoryDir();
  const files = await fs.readdir(HISTORY_DIR);
  const jsonFiles = files.filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort();
  const selected = jsonFiles.slice(-days);
  const snapshots: CostSnapshot[] = [];

  for (const file of selected) {
    try {
      const raw = await fs.readFile(path.join(HISTORY_DIR, file), 'utf-8');
      snapshots.push(JSON.parse(raw) as CostSnapshot);
    } catch {
      // skip bad file
    }
  }

  return snapshots.sort((a, b) => a.date.localeCompare(b.date));
}
