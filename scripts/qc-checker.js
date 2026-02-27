#!/usr/bin/env node
/**
 * QC Checker — Eve's automated QC tool for Agent work verification
 *
 * Usage:
 *   node qc-checker.js --agent <name> --type <task-type> [options]
 *
 * Task types:
 *   code    → checks git log, commit hash, branch, PR status
 *   skill   → checks that skill files exist in expected locations
 *   config  → validates JSON/TOML config files
 *   file    → checks file existence and size
 *
 * Options:
 *   --agent    <name>       Agent name (e.g. dexter, shelby)
 *   --type     <type>       Task type: code | skill | config | file
 *   --repo     <owner/repo> GitHub repo (for code checks)
 *   --branch   <name>       Branch name to check (for code checks)
 *   --commit   <hash>       Commit hash to verify
 *   --skill    <name>       Skill name (for skill checks)
 *   --file     <path>       File path (for file/config checks)
 *   --min-size <bytes>      Minimum expected file size (for file checks)
 *   --format   json|md      Output format (default: md)
 *   --dir      <path>       Working directory (default: cwd)
 *
 * Examples:
 *   node qc-checker.js --agent dexter --type code --repo nithis4th/mission-control --branch feat/qc-checker
 *   node qc-checker.js --agent dexter --type skill --skill openclaw-debugger
 *   node qc-checker.js --agent dexter --type config --file ~/.openclaw/config.json
 *   node qc-checker.js --agent dexter --type file --file /path/to/file.txt --min-size 100
 */

'use strict';

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// ─── CLI Arg Parser ───────────────────────────────────────────────────────────
function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      const key = argv[i].slice(2);
      const val = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : true;
      args[key] = val;
      if (val !== true) i++;
    }
  }
  return args;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function run(cmd, opts = {}) {
  try {
    return {
      ok: true,
      out: execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], ...opts }).trim(),
    };
  } catch (e) {
    return { ok: false, out: '', err: (e.stderr || e.message || '').trim() };
  }
}

function gh(args) {
  return run(`gh ${args}`);
}

function expandHome(p) {
  if (p && p.startsWith('~')) return path.join(os.homedir(), p.slice(1));
  return p;
}

// ─── Check Types ──────────────────────────────────────────────────────────────

/**
 * CODE check — git log, commit, branch, PR status
 */
function checkCode({ repo, branch, commit, dir }) {
  const checks = [];
  const workdir = dir ? expandHome(dir) : process.cwd();

  // 1. Git repo exists
  const gitCheck = run('git rev-parse --is-inside-work-tree', { cwd: workdir });
  checks.push({
    name: 'Git repo exists',
    pass: gitCheck.ok,
    detail: gitCheck.ok ? workdir : `Not a git repo: ${workdir}`,
    fix: gitCheck.ok ? null : 'Run `git init` or navigate to correct directory',
  });

  if (!gitCheck.ok) {
    return checks;
  }

  // 2. Latest commit hash
  const latestCommit = run('git log -1 --format="%H %s" --no-color', { cwd: workdir });
  const commitLine = latestCommit.out;
  checks.push({
    name: 'Latest commit exists',
    pass: latestCommit.ok && commitLine.length > 0,
    detail: latestCommit.ok ? `commit: ${commitLine}` : 'No commits found',
    fix: latestCommit.ok ? null : 'Make at least one commit before reporting done',
  });

  // 3. Verify specific commit if provided
  if (commit) {
    const verifyCommit = run(`git cat-file -e ${commit}^{commit}`, { cwd: workdir });
    checks.push({
      name: `Commit ${commit.slice(0, 8)} exists`,
      pass: verifyCommit.ok,
      detail: verifyCommit.ok ? `Found in repo` : `Commit not found`,
      fix: verifyCommit.ok ? null : 'Check commit hash — may be wrong or not pushed yet',
    });
  }

  // 4. Branch check
  const currentBranch = run('git branch --show-current', { cwd: workdir });
  const branchName = currentBranch.out;
  if (branch) {
    checks.push({
      name: `Branch is ${branch}`,
      pass: branchName === branch,
      detail: `Current branch: ${branchName}`,
      fix: branchName !== branch ? `Run: git checkout ${branch}` : null,
    });
  } else {
    checks.push({
      name: 'Not on main/master branch (PR expected)',
      pass: !['main', 'master'].includes(branchName),
      detail: `Current branch: ${branchName}`,
      fix: ['main', 'master'].includes(branchName)
        ? 'Create a feature branch and open a PR instead of pushing directly to main'
        : null,
    });
  }

  // 5. No unstaged changes
  const status = run('git status --porcelain', { cwd: workdir });
  const hasUnstaged = status.ok && status.out.length > 0;
  checks.push({
    name: 'Working tree clean (all committed)',
    pass: !hasUnstaged,
    detail: hasUnstaged ? `Uncommitted changes:\n${status.out}` : 'All changes committed',
    fix: hasUnstaged ? 'Run: git add . && git commit -m "your message"' : null,
  });

  // 6. PR status (if repo provided)
  if (repo) {
    const prList = gh(
      `pr list --repo ${repo} --head ${branchName} --json number,title,state,url --limit 1`
    );
    let prPass = false;
    let prDetail = '';
    let prFix = null;

    if (prList.ok) {
      try {
        const prs = JSON.parse(prList.out);
        if (prs.length > 0) {
          const pr = prs[0];
          prPass = true;
          prDetail = `PR #${pr.number}: "${pr.title}" — ${pr.state}\n${pr.url}`;
        } else {
          prDetail = `No PR found for branch: ${branchName}`;
          prFix = `Run: gh pr create --repo ${repo} --title "feat: ..." --body "..."`;
        }
      } catch {
        prDetail = `Could not parse PR response`;
        prFix = 'Check `gh auth status` and repo access';
      }
    } else {
      prDetail = `gh CLI error: ${prList.err}`;
      prFix = 'Ensure gh is authenticated: gh auth login';
    }

    checks.push({
      name: 'Pull Request opened',
      pass: prPass,
      detail: prDetail,
      fix: prFix,
    });
  }

  return checks;
}

/**
 * SKILL check — verify skill files exist in correct locations
 */
function checkSkill({ skill }) {
  if (!skill) {
    return [{ name: 'Skill name provided', pass: false, detail: 'Missing --skill argument', fix: 'Pass --skill <name>' }];
  }

  const checks = [];
  const possibleLocations = [
    path.join(os.homedir(), `.openclaw/workspace-dexter/skills/${skill}`),
    path.join(os.homedir(), `.openclaw/workspace-shelby/skills/${skill}`),
    path.join(os.homedir(), `.openclaw/skills/${skill}`),
    `/opt/homebrew/lib/node_modules/openclaw/skills/${skill}`,
  ];

  // 1. Find skill directory
  const foundDir = possibleLocations.find((p) => fs.existsSync(p));
  checks.push({
    name: `Skill directory exists (${skill})`,
    pass: !!foundDir,
    detail: foundDir
      ? `Found at: ${foundDir}`
      : `Not found in any expected location:\n${possibleLocations.join('\n')}`,
    fix: foundDir
      ? null
      : `Install skill or check spelling. Expected one of:\n${possibleLocations.join('\n')}`,
  });

  if (!foundDir) return checks;

  // 2. SKILL.md exists
  const skillMdPath = path.join(foundDir, 'SKILL.md');
  const hasMd = fs.existsSync(skillMdPath);
  checks.push({
    name: 'SKILL.md present',
    pass: hasMd,
    detail: hasMd ? skillMdPath : `Missing: ${skillMdPath}`,
    fix: hasMd ? null : 'Create SKILL.md with frontmatter (name, description)',
  });

  if (hasMd) {
    // 3. SKILL.md has valid frontmatter
    const content = fs.readFileSync(skillMdPath, 'utf8');
    const hasFrontmatter = content.startsWith('---');
    const hasName = /^name:/m.test(content);
    const hasDescription = /^description:/m.test(content);

    checks.push({
      name: 'SKILL.md has valid frontmatter',
      pass: hasFrontmatter && hasName && hasDescription,
      detail: hasFrontmatter && hasName && hasDescription
        ? 'Frontmatter OK (name + description found)'
        : `Issues: frontmatter=${hasFrontmatter}, name=${hasName}, description=${hasDescription}`,
      fix:
        hasFrontmatter && hasName && hasDescription
          ? null
          : 'Add frontmatter block with name: and description: fields',
    });
  }

  // 4. Skill registered in skills-lock.json
  const lockPaths = [
    path.join(os.homedir(), '.openclaw/workspace-dexter/skills-lock.json'),
    path.join(os.homedir(), '.openclaw/workspace-shelby/skills-lock.json'),
  ];

  for (const lockPath of lockPaths) {
    if (fs.existsSync(lockPath)) {
      try {
        const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
        const registered = Array.isArray(lock)
          ? lock.some((s) => (typeof s === 'string' ? s === skill : s.name === skill))
          : Object.keys(lock).includes(skill);
        checks.push({
          name: `Registered in ${path.basename(path.dirname(lockPath))}/skills-lock.json`,
          pass: registered,
          detail: registered ? `Found in skills-lock` : `Not in skills-lock.json`,
          fix: registered ? null : `Add "${skill}" to ${lockPath}`,
        });
      } catch {
        checks.push({
          name: `skills-lock.json readable (${path.basename(path.dirname(lockPath))})`,
          pass: false,
          detail: `Could not parse ${lockPath}`,
          fix: 'Fix JSON syntax in skills-lock.json',
        });
      }
    }
  }

  return checks;
}

/**
 * CONFIG check — validate JSON (or detect TOML/YAML and report)
 */
function checkConfig({ file }) {
  if (!file) {
    return [{ name: 'File path provided', pass: false, detail: 'Missing --file argument', fix: 'Pass --file <path>' }];
  }

  const filePath = expandHome(file);
  const checks = [];

  // 1. File exists
  const exists = fs.existsSync(filePath);
  checks.push({
    name: 'Config file exists',
    pass: exists,
    detail: exists ? filePath : `Not found: ${filePath}`,
    fix: exists ? null : `Check path: ${filePath}`,
  });

  if (!exists) return checks;

  // 2. File readable + not empty
  const stat = fs.statSync(filePath);
  checks.push({
    name: 'File not empty',
    pass: stat.size > 0,
    detail: `Size: ${stat.size} bytes`,
    fix: stat.size === 0 ? 'File is empty — write config content' : null,
  });

  if (stat.size === 0) return checks;

  const ext = path.extname(filePath).toLowerCase();
  const content = fs.readFileSync(filePath, 'utf8');

  // 3. JSON validation
  if (ext === '.json' || ext === '') {
    try {
      const parsed = JSON.parse(content);
      const keys = typeof parsed === 'object' && parsed !== null ? Object.keys(parsed).length : 0;
      checks.push({
        name: 'Valid JSON',
        pass: true,
        detail: `JSON valid — ${keys} top-level key(s)`,
        fix: null,
      });
    } catch (e) {
      checks.push({
        name: 'Valid JSON',
        pass: false,
        detail: `JSON parse error: ${e.message}`,
        fix: "Fix JSON syntax. Use: node -e \"JSON.parse(require('fs').readFileSync('file.json','utf8'))\"",
      });
    }
  } else if (ext === '.toml') {
    checks.push({
      name: 'Config format',
      pass: true,
      detail: `TOML file detected (${stat.size} bytes) — manual validation needed`,
      fix: null,
    });
  } else if (ext === '.yaml' || ext === '.yml') {
    checks.push({
      name: 'Config format',
      pass: true,
      detail: `YAML file detected (${stat.size} bytes) — install js-yaml for validation`,
      fix: null,
    });
  } else {
    // Try JSON anyway
    try {
      JSON.parse(content);
      checks.push({ name: 'Valid JSON (no extension)', pass: true, detail: 'Parsed OK', fix: null });
    } catch {
      checks.push({
        name: 'Config parseable',
        pass: true,
        detail: `Non-JSON file (${ext}) — content present, manual review needed`,
        fix: null,
      });
    }
  }

  return checks;
}

/**
 * FILE check — existence and size
 */
function checkFile(args) {
  const file = args['file'];
  const minSizeRaw = args['min-size'];

  if (!file) {
    return [{ name: 'File path provided', pass: false, detail: 'Missing --file argument', fix: 'Pass --file <path>' }];
  }

  const filePath = expandHome(file);
  const minSize = minSizeRaw ? parseInt(minSizeRaw, 10) : 0;
  const checks = [];

  // 1. File exists
  const exists = fs.existsSync(filePath);
  checks.push({
    name: 'File exists',
    pass: exists,
    detail: exists ? filePath : `Not found: ${filePath}`,
    fix: exists ? null : `Verify path. Expected: ${filePath}`,
  });

  if (!exists) return checks;

  const stat = fs.statSync(filePath);
  const isDir = stat.isDirectory();

  // 2. Is it a file (not a dir)?
  checks.push({
    name: 'Is a regular file (not directory)',
    pass: !isDir,
    detail: isDir ? 'Path is a directory' : `Regular file`,
    fix: isDir ? 'Provide a file path, not a directory' : null,
  });

  // 3. Size
  const sizeOk = stat.size >= minSize;
  checks.push({
    name: minSize > 0 ? `File size >= ${minSize} bytes` : 'File not empty',
    pass: minSize > 0 ? sizeOk : stat.size > 0,
    detail: `Size: ${stat.size} bytes (${(stat.size / 1024).toFixed(2)} KB)`,
    fix:
      stat.size === 0
        ? 'File is empty — was the agent task completed?'
        : !sizeOk
        ? `File is ${stat.size}B but expected >=${minSize}B. May be incomplete.`
        : null,
  });

  // 4. Modified recently (within 24h)
  const now = Date.now();
  const mtime = new Date(stat.mtime).getTime();
  const ageHours = (now - mtime) / 3600000;
  const recentlyModified = ageHours < 24;
  checks.push({
    name: 'Modified within last 24 hours',
    pass: recentlyModified,
    detail: `Last modified: ${new Date(stat.mtime).toLocaleString('th-TH')} (${ageHours.toFixed(1)}h ago)`,
    fix: recentlyModified ? null : `File was modified ${ageHours.toFixed(0)}h ago — confirm this is the right file`,
  });

  return checks;
}

// ─── Report Formatter ─────────────────────────────────────────────────────────
function formatMarkdown(agent, taskType, checks, meta) {
  const now = new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' });
  const allPass = checks.every((c) => c.pass);
  const passCount = checks.filter((c) => c.pass).length;

  let out = `# QC Report — ${agent} / ${taskType}\n\n`;
  out += `**Date:** ${now}\n`;
  out += `**Agent:** ${agent}\n`;
  out += `**Task type:** ${taskType}\n`;
  if (meta.repo) out += `**Repo:** ${meta.repo}\n`;
  if (meta.branch) out += `**Branch:** ${meta.branch}\n`;
  if (meta.commit) out += `**Commit:** ${meta.commit}\n`;
  out += `\n---\n\n`;
  out += `## Result: ${allPass ? 'PASS' : 'FAIL'} (${passCount}/${checks.length})\n\n`;
  out += `| # | Check | Status | Detail |\n`;
  out += `|---|-------|--------|--------|\n`;

  checks.forEach((c, i) => {
    const icon = c.pass ? 'PASS' : 'FAIL';
    const detail = c.detail.replace(/\n/g, ' ');
    out += `| ${i + 1} | ${c.name} | ${icon} | ${detail} |\n`;
  });

  const failures = checks.filter((c) => !c.pass);
  if (failures.length > 0) {
    out += `\n---\n\n## Issues & Fixes\n\n`;
    failures.forEach((c, i) => {
      out += `### ${i + 1}. FAIL: ${c.name}\n`;
      out += `**Problem:** ${c.detail}\n\n`;
      if (c.fix) out += `**Fix:** ${c.fix}\n\n`;
    });
  } else {
    out += `\n---\n\n## All checks passed! Work is ready.\n`;
  }

  return out;
}

function formatJSON(agent, taskType, checks, meta) {
  const allPass = checks.every((c) => c.pass);
  return JSON.stringify(
    {
      qc: {
        agent,
        taskType,
        timestamp: new Date().toISOString(),
        ...meta,
        result: allPass ? 'PASS' : 'FAIL',
        passCount: checks.filter((c) => c.pass).length,
        totalCount: checks.length,
      },
      checks: checks.map((c, i) => ({
        index: i + 1,
        name: c.name,
        pass: c.pass,
        detail: c.detail,
        fix: c.fix || null,
      })),
    },
    null,
    2
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    console.log(`QC Checker — Eve's automated QC tool for Agent work verification

Usage:
  node qc-checker.js --agent <name> --type <task-type> [options]

Task types:
  code    Check git repo, commits, branch, PR status
  skill   Check skill installation and SKILL.md validity
  config  Validate JSON/TOML/YAML config files
  file    Check file existence, size, and recency

Common options:
  --agent     Agent name (required)
  --type      Task type (required): code | skill | config | file
  --format    Output format: md (default) | json
  --dir       Working directory (for code checks, default: cwd)

Code-specific:
  --repo      GitHub repo owner/repo (for PR check)
  --branch    Expected branch name
  --commit    Expected commit hash

Skill-specific:
  --skill     Skill name to check

Config/File-specific:
  --file      Path to file (supports ~/... paths)
  --min-size  Minimum file size in bytes (for file checks)

Examples:
  node qc-checker.js --agent dexter --type code --repo nithis4th/mission-control --branch feat/qc-checker
  node qc-checker.js --agent dexter --type skill --skill openclaw-debugger
  node qc-checker.js --agent dexter --type config --file ~/.openclaw/config.json
  node qc-checker.js --agent dexter --type file --file /path/to/output.txt --min-size 500
  node qc-checker.js --agent shelby --type code --format json`);
    process.exit(0);
  }

  if (!args.agent || !args.type) {
    console.error('Error: --agent and --type are required.');
    console.error('Run with --help for usage.');
    process.exit(1);
  }

  const agent = args.agent;
  const taskType = args.type;
  const format = args.format || 'md';

  let checks = [];

  switch (taskType) {
    case 'code':
      checks = checkCode(args);
      break;
    case 'skill':
      checks = checkSkill(args);
      break;
    case 'config':
      checks = checkConfig(args);
      break;
    case 'file':
      checks = checkFile(args);
      break;
    default:
      console.error(`Unknown task type: "${taskType}". Use: code | skill | config | file`);
      process.exit(1);
  }

  const meta = {};
  if (args.repo) meta.repo = args.repo;
  if (args.branch) meta.branch = args.branch;
  if (args.commit) meta.commit = args.commit;

  let output;
  if (format === 'json') {
    output = formatJSON(agent, taskType, checks, meta);
  } else {
    output = formatMarkdown(agent, taskType, checks, meta);
  }

  console.log(output);

  const allPass = checks.every((c) => c.pass);
  process.exit(allPass ? 0 : 1);
}

main();
