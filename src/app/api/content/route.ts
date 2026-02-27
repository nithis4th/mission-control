import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

const BRIEFS_DIR = '/Users/nithis4th/.openclaw/workspace/memory/briefs';

interface BriefItem {
  filename: string;
  title: string;
  summary: string;
  date: string;
  dateLabel: 'today' | 'yesterday' | 'earlier';
  content: string;
}

function parseMdTitle(content: string, filename: string): string {
  const h1 = content.match(/^#\s+(.+)/m);
  if (h1) return h1[1].trim();
  const bold = content.match(/\*\*(.+?)\*\*/);
  if (bold) return bold[1].trim();
  return filename
    .replace(/\.md$/, '')
    .replace(/[-_]/g, ' ')
    .replace(/^\d{4}-\d{2}-\d{2}\s*/, '')
    .trim() || filename;
}

function parseSummary(content: string): string {
  const lines = content
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#') && !l.startsWith('---'));

  const para = lines.slice(0, 3).join(' ').replace(/\*\*/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  return para.slice(0, 160) + (para.length > 160 ? '...' : '');
}

function getDateLabel(dateStr: string): 'today' | 'yesterday' | 'earlier' {
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  if (dateStr === todayStr) return 'today';
  if (dateStr === yesterdayStr) return 'yesterday';
  return 'earlier';
}

function extractDateFromFilename(filename: string): string {
  const match = filename.match(/(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : '';
}

export async function GET() {
  try {
    if (!fs.existsSync(BRIEFS_DIR)) {
      return NextResponse.json({ items: [], empty: true });
    }

    const files = fs
      .readdirSync(BRIEFS_DIR)
      .filter((f) => f.endsWith('.md'))
      .sort()
      .reverse();

    if (files.length === 0) {
      return NextResponse.json({ items: [], empty: true });
    }

    const items: BriefItem[] = files.map((filename) => {
      const fullPath = path.join(BRIEFS_DIR, filename);
      const content = fs.readFileSync(fullPath, 'utf-8');

      let dateStr = extractDateFromFilename(filename);
      if (!dateStr) {
        const stat = fs.statSync(fullPath);
        dateStr = stat.mtime.toISOString().slice(0, 10);
      }

      return {
        filename,
        title: parseMdTitle(content, filename),
        summary: parseSummary(content),
        date: dateStr,
        dateLabel: getDateLabel(dateStr),
        content,
      };
    });

    return NextResponse.json({ items, empty: false });
  } catch (error) {
    console.error('Failed to read briefs:', error);
    return NextResponse.json({ error: 'Failed to read content' }, { status: 500 });
  }
}
