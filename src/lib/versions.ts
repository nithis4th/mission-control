import { execSync } from 'child_process';

const REPO_PATH = '/Users/nithis4th/mission-control';
const VERSION_TAG_PREFIX = 'v-';
const KEEP_MIN = 10;

export interface VersionItem {
  label: string;
  tag: string;
  hash: string;
  shortHash: string;
  timestamp: string;
  message: string;
}

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

export function ensureCleanWorkingTree() {
  const status = run('git status --porcelain');
  if (status) throw new Error('Working tree is dirty. Please commit/stash changes first.');
}

function parseTagLine(line: string): VersionItem | null {
  const [tag, hash, shortHash, timestamp, message] = line.split('|');
  if (!tag || !hash || !shortHash || !timestamp) return null;

  const label = tag.replace(new RegExp(`^${VERSION_TAG_PREFIX}`), '').replace(/-\d{8}-\d{6}$/, '');
  return {
    label,
    tag,
    hash,
    shortHash,
    timestamp,
    message: message || '',
  };
}

export function listVersions(limit = 100): VersionItem[] {
  const n = Math.max(1, Math.min(limit, 300));
  const out = run(`git for-each-ref refs/tags/${VERSION_TAG_PREFIX}* --sort=-creatordate --format='%(refname:short)|%(objectname)|%(objectname:short)|%(creatordate:iso8601)|%(subject)'`);
  if (!out) return [];

  return out
    .split('\n')
    .map(parseTagLine)
    .filter((v): v is VersionItem => !!v)
    .slice(0, n);
}

export function getCurrentBranch(): string {
  return run('git branch --show-current');
}

export function deleteVersionTag(ref: string): { ok: true; deletedTag: string } {
  const tag = decodeURIComponent(ref);
  run(`git rev-parse --verify refs/tags/${tag}`);
  run(`git tag -d ${tag}`);
  return { ok: true, deletedTag: tag };
}

export function renameVersionTag(ref: string, newLabel: string): { ok: true; oldTag: string; newTag: string } {
  const oldTag = decodeURIComponent(ref);
  run(`git rev-parse --verify refs/tags/${oldTag}`);

  const safeLabel = slug(newLabel);
  if (!safeLabel) throw new Error('newLabel is required');

  const tsMatch = oldTag.match(/-(\d{8}-\d{6})$/);
  const stamp = tsMatch
    ? tsMatch[1]
    : (() => {
        const t = new Date();
        const y = String(t.getFullYear());
        const mo = String(t.getMonth() + 1).padStart(2, '0');
        const d = String(t.getDate()).padStart(2, '0');
        const h = String(t.getHours()).padStart(2, '0');
        const mi = String(t.getMinutes()).padStart(2, '0');
        const s = String(t.getSeconds()).padStart(2, '0');
        return `${y}${mo}${d}-${h}${mi}${s}`;
      })();

  const newTag = `${VERSION_TAG_PREFIX}${safeLabel}-${stamp}`;
  run(`git rev-parse --verify ${oldTag}`);
  run(`git tag ${newTag} ${oldTag}`);
  run(`git tag -d ${oldTag}`);

  return { ok: true, oldTag, newTag };
}

function cleanupOldVersionTags() {
  const versions = listVersions(500);
  if (versions.length <= KEEP_MIN) return;

  // Keep at least latest KEEP_MIN tags; delete very old beyond 200 to avoid unbounded growth.
  const toDelete = versions.slice(200);
  for (const v of toDelete) {
    try {
      run(`git tag -d ${v.tag}`);
    } catch {
      // ignore cleanup failures
    }
  }
}

export function createVersion(label: string): VersionItem {
  ensureCleanWorkingTree();

  const safeLabel = slug(label);
  if (!safeLabel) throw new Error('label is required');

  run('git add -A');
  const msg = `snapshot: ${safeLabel}`;

  // Allow empty commit so versioning is explicit even when no file changed.
  run(`git commit --allow-empty -m ${JSON.stringify(msg)}`);

  const ts = new Date();
  const y = String(ts.getFullYear());
  const mo = String(ts.getMonth() + 1).padStart(2, '0');
  const d = String(ts.getDate()).padStart(2, '0');
  const h = String(ts.getHours()).padStart(2, '0');
  const mi = String(ts.getMinutes()).padStart(2, '0');
  const s = String(ts.getSeconds()).padStart(2, '0');
  const stamp = `${y}${mo}${d}-${h}${mi}${s}`;

  const tag = `${VERSION_TAG_PREFIX}${safeLabel}-${stamp}`;
  run(`git tag ${tag}`);

  cleanupOldVersionTags();

  const hash = run('git rev-parse HEAD');
  const shortHash = run('git rev-parse --short HEAD');

  return {
    label: safeLabel,
    tag,
    hash,
    shortHash,
    timestamp: new Date().toISOString(),
    message: msg,
  };
}

export function getDiff(ref: string): { files: string[]; diffText: string } {
  const filesOut = run(`git diff --name-only ${ref}..HEAD || true`);
  const diffText = run(`git diff ${ref}..HEAD || true`);
  const files = filesOut ? filesOut.split('\n').filter(Boolean) : [];
  return { files, diffText };
}

export function createRestoreBranchFromRef(
  ref: string,
  label?: string
): {
  branch: string;
  hash: string;
  shortHash: string;
  fromRef: string;
  autoStashed: boolean;
  discardedChanges: boolean;
  stashRef: string | null;
} {
  let autoStashed = false;
  let stashRef: string | null = null;

  const status = run('git status --porcelain');
  if (status) {
    run('git stash push -m "auto-stash before restore"');
    autoStashed = true;
    stashRef = run('git stash list --format="%gd" -n 1');
  }

  const hash = run(`git rev-parse ${ref}`);
  const shortHash = hash.slice(0, 8);

  run(`git worktree prune`);
  run(`git checkout ${hash} -- . ':!src/lib/versions.ts' ':!src/app/api/versions'`);

  return {
    hash,
    shortHash,
    fromRef: ref,
    autoStashed,
    discardedChanges: autoStashed,
    stashRef,
    strategy: 'checkout-files',
  };
}

export function switchBranch(branch: string): { branch: string } {
  ensureCleanWorkingTree();
  run(`git checkout ${branch}`);
  return { branch };
}
