import { NextRequest, NextResponse } from 'next/server';
import { execSync } from 'child_process';
import { getCurrentBranch, listVersions } from '@/lib/versions';

export const dynamic = 'force-dynamic';

const REPO_PATH = '/Users/nithis4th/mission-control';

function run(cmd: string): string {
  return execSync(cmd, { cwd: REPO_PATH, stdio: ['pipe', 'pipe', 'pipe'] }).toString().trim();
}

function slug(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'version';
}

export async function GET(request: NextRequest) {
  try {
    const limit = Number(request.nextUrl.searchParams.get('limit') || '100');
    const versions = listVersions(limit);
    const currentBranch = getCurrentBranch();
    return NextResponse.json({ versions, currentBranch });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  let usedStash = false;
  let stashPopWarning: string | null = null;

  try {
    const body = await request.json().catch(() => ({}));
    const label = typeof body?.label === 'string' ? body.label : '';
    if (!label.trim()) {
      return NextResponse.json({ error: 'label is required' }, { status: 400 });
    }

    const status = run('git status --porcelain');
    if (status) {
      run('git stash push -m "auto-stash before snapshot"');
      usedStash = true;
    }

    const safeLabel = slug(label);
    const ts = new Date();
    const y = String(ts.getFullYear());
    const mo = String(ts.getMonth() + 1).padStart(2, '0');
    const d = String(ts.getDate()).padStart(2, '0');
    const h = String(ts.getHours()).padStart(2, '0');
    const mi = String(ts.getMinutes()).padStart(2, '0');
    const s = String(ts.getSeconds()).padStart(2, '0');
    const stamp = `${y}${mo}${d}-${h}${mi}${s}`;
    const tag = `v-${safeLabel}-${stamp}`;

    run('git add -A');
    run(`git commit --allow-empty -m ${JSON.stringify(`snapshot: ${safeLabel}`)}`);
    run(`git tag ${tag}`);

    const hash = run('git rev-parse HEAD');
    const shortHash = run('git rev-parse --short HEAD');

    if (usedStash) {
      try {
        run('git stash pop');
      } catch (error) {
        stashPopWarning = (error as Error).message || 'git stash pop conflict';
      }
    }

    return NextResponse.json(
      {
        version: {
          label: safeLabel,
          tag,
          hash,
          shortHash,
          timestamp: new Date().toISOString(),
          message: `snapshot: ${safeLabel}`,
        },
        autoStashed: usedStash,
        stashPopWarning,
      },
      { status: 201 }
    );
  } catch (error) {
    if (usedStash) {
      try {
        run('git stash pop');
      } catch (popErr) {
        return NextResponse.json(
          {
            error: (error as Error).message,
            stashPopWarning: (popErr as Error).message,
          },
          { status: 500 }
        );
      }
    }
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
