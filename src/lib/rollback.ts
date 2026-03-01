import { execSync } from 'child_process';

const REPO_PATH = '/Users/nithis4th/mission-control';

export interface RollbackPoint {
  hash: string;
  timestamp: string;
  message: string;
}

function run(cmd: string): string {
  return execSync(cmd, { cwd: REPO_PATH, stdio: ['pipe', 'pipe', 'pipe'] }).toString().trim();
}

export function createRollbackPoint(note?: string): RollbackPoint {
  const status = run('git status --porcelain');
  const iso = new Date().toISOString();
  const msg = `rollback-point: ${iso}${note ? ` | ${note}` : ''}`;

  if (status) {
    run('git add -A');
    run(`git commit -m ${JSON.stringify(msg)}`);
  } else {
    // create an empty commit so restore points are still explicit
    run(`git commit --allow-empty -m ${JSON.stringify(msg)}`);
  }

  const hash = run('git rev-parse HEAD');
  return { hash, timestamp: iso, message: msg };
}

export function listRollbackPoints(limit = 30): RollbackPoint[] {
  const out = run(`git log --grep='^rollback-point:' --pretty=format:'%H|%cI|%s' -n ${Math.max(1, Math.min(limit, 200))}`);
  if (!out) return [];

  return out
    .split('\n')
    .map((line) => {
      const [hash, timestamp, message] = line.split('|');
      return { hash, timestamp, message };
    })
    .filter((p) => p.hash && p.timestamp && p.message);
}

export function restoreRollbackPoint(hash: string): { ok: boolean; beforeHash: string; restoredHash: string } {
  const beforeHash = run('git rev-parse HEAD');
  const verify = run(`git cat-file -t ${hash}`);
  if (verify !== 'commit') {
    throw new Error('Invalid rollback hash');
  }

  // Safety snapshot before restore
  createRollbackPoint(`pre-restore backup from ${beforeHash}`);

  run(`git reset --hard ${hash}`);
  const restoredHash = run('git rev-parse HEAD');
  return { ok: true, beforeHash, restoredHash };
}
