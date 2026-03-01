import fs from 'fs';
import path from 'path';

const HOME = process.env.HOME || '/Users/nithis4th';
const WORKSPACE_DIR = path.join(HOME, '.openclaw', 'workspace');
const SNAPSHOT_ROOT = path.join(WORKSPACE_DIR, 'mission-control', 'snapshots');
const MAX_SNAPSHOTS = 20;
const MIN_KEEP = 3;

const WORKSPACE_FILES = [
  'SOUL.md',
  'HEARTBEAT.md',
  'AGENTS.md',
  'MEMORY.md',
  'USER.md',
  'TOOLS.md',
];

export interface SnapshotInfo {
  id: string;
  timestamp: string;
  label: string;
  files: string[];
}

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function safeLabel(label?: string) {
  const raw = (label || 'manual snapshot').trim();
  return raw.slice(0, 120);
}

function snapshotDir(id: string) {
  return path.join(SNAPSHOT_ROOT, id);
}

function workspaceFilePath(rel: string) {
  return path.join(WORKSPACE_DIR, rel);
}

function metadataPath(id: string) {
  return path.join(snapshotDir(id), 'meta.json');
}

function filesFromWorkspace(): string[] {
  return WORKSPACE_FILES.filter((f) => fs.existsSync(workspaceFilePath(f)));
}

function writeJson(p: string, data: unknown) {
  fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf-8');
}

function readJson<T>(p: string): T {
  return JSON.parse(fs.readFileSync(p, 'utf-8')) as T;
}

function applyRetentionPolicy() {
  ensureDir(SNAPSHOT_ROOT);
  const dirs = fs
    .readdirSync(SNAPSHOT_ROOT, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort((a, b) => b.localeCompare(a));

  if (dirs.length <= MAX_SNAPSHOTS) return;

  const keep = dirs.slice(0, MAX_SNAPSHOTS);
  const latestMandatory = dirs.slice(0, Math.min(MIN_KEEP, dirs.length));
  const keepSet = new Set([...keep, ...latestMandatory]);

  for (const id of dirs) {
    if (!keepSet.has(id)) {
      fs.rmSync(snapshotDir(id), { recursive: true, force: true });
    }
  }
}

export function createSnapshot(label?: string): SnapshotInfo {
  ensureDir(SNAPSHOT_ROOT);

  const timestamp = new Date().toISOString();
  const id = timestamp.replace(/[:.]/g, '-');
  const dir = snapshotDir(id);
  ensureDir(dir);

  const files = filesFromWorkspace();

  for (const rel of files) {
    const src = workspaceFilePath(rel);
    const dst = path.join(dir, rel);
    ensureDir(path.dirname(dst));
    fs.copyFileSync(src, dst);
  }

  const info: SnapshotInfo = {
    id,
    timestamp,
    label: safeLabel(label),
    files,
  };

  writeJson(metadataPath(id), info);
  applyRetentionPolicy();
  return info;
}

export function listSnapshots(limit = 30): SnapshotInfo[] {
  ensureDir(SNAPSHOT_ROOT);
  const n = Math.max(1, Math.min(limit, 200));

  const ids = fs
    .readdirSync(SNAPSHOT_ROOT, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort((a, b) => b.localeCompare(a))
    .slice(0, n);

  const out: SnapshotInfo[] = [];
  for (const id of ids) {
    const meta = metadataPath(id);
    if (!fs.existsSync(meta)) continue;
    try {
      out.push(readJson<SnapshotInfo>(meta));
    } catch {
      // skip broken meta
    }
  }
  return out;
}

export function getSnapshot(id: string): SnapshotInfo & { contents: Record<string, string> } {
  const dir = snapshotDir(id);
  if (!fs.existsSync(dir)) throw new Error('Snapshot not found');

  const meta = metadataPath(id);
  if (!fs.existsSync(meta)) throw new Error('Snapshot metadata not found');

  const info = readJson<SnapshotInfo>(meta);
  const contents: Record<string, string> = {};

  for (const rel of info.files) {
    const p = path.join(dir, rel);
    if (!fs.existsSync(p)) continue;
    contents[rel] = fs.readFileSync(p, 'utf-8');
  }

  return { ...info, contents };
}

function validateRestoreTarget(rel: string) {
  if (rel.includes('..') || rel.startsWith('/')) {
    throw new Error('Invalid file path');
  }
}

function restoreFileFromSnapshot(id: string, rel: string) {
  validateRestoreTarget(rel);

  const src = path.join(snapshotDir(id), rel);
  if (!fs.existsSync(src)) throw new Error(`File not found in snapshot: ${rel}`);

  const content = fs.readFileSync(src, 'utf-8');
  if (!content.trim()) throw new Error(`Refuse to restore empty file: ${rel}`);

  const dst = workspaceFilePath(rel);
  ensureDir(path.dirname(dst));

  const tmp = `${dst}.tmp-${Date.now()}`;
  fs.writeFileSync(tmp, content, 'utf-8');

  const check = fs.readFileSync(tmp, 'utf-8');
  if (!check.trim()) {
    fs.rmSync(tmp, { force: true });
    throw new Error(`Validation failed for file: ${rel}`);
  }

  fs.renameSync(tmp, dst);
}

export function restoreSnapshotAll(id: string): { ok: true; restored: string[] } {
  const info = getSnapshot(id);
  const restored: string[] = [];

  for (const rel of info.files) {
    restoreFileFromSnapshot(id, rel);
    restored.push(rel);
  }

  return { ok: true, restored };
}

export function restoreSnapshotOne(id: string, rel: string): { ok: true; restored: string } {
  restoreFileFromSnapshot(id, rel);
  return { ok: true, restored: rel };
}

export function workspaceCurrentFile(rel: string): string {
  validateRestoreTarget(rel);
  const p = workspaceFilePath(rel);
  if (!fs.existsSync(p)) return '';
  return fs.readFileSync(p, 'utf-8');
}
