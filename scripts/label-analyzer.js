#!/usr/bin/env node
/**
 * label-analyzer.js
 * Analyzes GitHub issue title + body using AI (Anthropic Claude / OpenAI GPT)
 * and applies appropriate labels via GitHub API.
 *
 * Supports Thai + English content.
 *
 * Labels applied:
 *   - bug             -> Bug reports / error / crash
 *   - feature         -> New feature requests
 *   - enhancement     -> Improvements to existing functionality
 *   - documentation   -> Docs-related
 *   - good first issue -> Beginner-friendly tasks
 *
 * Env vars (GitHub Secrets):
 *   ANTHROPIC_API_KEY or OPENAI_API_KEY  - at least one required
 *   GITHUB_TOKEN                          - for applying labels
 *   ISSUE_NUMBER                          - from GitHub Action context
 *   ISSUE_TITLE                           - from GitHub Action context
 *   ISSUE_BODY                            - from GitHub Action context
 *   REPO_OWNER                            - from GitHub Action context
 *   REPO_NAME                             - from GitHub Action context
 */

import { fileURLToPath } from 'url';

// ─── Config ──────────────────────────────────────────────────────────────────

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const ISSUE_NUMBER = process.env.ISSUE_NUMBER;
const ISSUE_TITLE = process.env.ISSUE_TITLE || '';
const ISSUE_BODY = process.env.ISSUE_BODY || '';
const REPO_OWNER = process.env.REPO_OWNER;
const REPO_NAME = process.env.REPO_NAME;

// Available labels (must exist in the GitHub repo)
const VALID_LABELS = ['bug', 'feature', 'enhancement', 'documentation', 'good first issue'];

// ─── Validation ───────────────────────────────────────────────────────────────

function validateEnv() {
  const missing = [];
  if (!GITHUB_TOKEN) missing.push('GITHUB_TOKEN');
  if (!ISSUE_NUMBER) missing.push('ISSUE_NUMBER');
  if (!REPO_OWNER) missing.push('REPO_OWNER');
  if (!REPO_NAME) missing.push('REPO_NAME');
  if (!ANTHROPIC_API_KEY && !OPENAI_API_KEY) {
    missing.push('ANTHROPIC_API_KEY or OPENAI_API_KEY');
  }

  if (missing.length > 0) {
    console.error('[label-analyzer] MISSING ENV: ' + missing.join(', '));
    process.exit(1);
  }
}

// ─── AI Analysis ──────────────────────────────────────────────────────────────

function buildPrompt(title, body) {
  return `You are an expert GitHub issue categorizer. Analyze the following GitHub issue and return the appropriate labels.

Available labels:
- "bug" -> Bug reports, errors, crashes, something broken / problem / issue / บัก ปัญหา ข้อผิดพลาด
- "feature" -> New feature requests, new capability / ฟีเจอร์ใหม่ คุณสมบัติใหม่
- "enhancement" -> Improvements to existing features, optimizations / ปรับปรุง เพิ่มประสิทธิภาพ
- "documentation" -> Docs, README, guides, API docs / เอกสาร คู่มือ README
- "good first issue" -> Simple, beginner-friendly tasks / งานง่าย เหมาะสำหรับผู้เริ่มต้น

Issue Title: ${title}
Issue Body:
${body || '(no description provided)'}

Rules:
1. Return ONLY a JSON array of label strings. No explanation.
2. You may return multiple labels if appropriate e.g. ["bug", "good first issue"]
3. Return an empty array [] if the issue is unclear or does not fit any category
4. Support both Thai and English content
5. Be conservative, only apply labels you are confident about

Response format: ["label1", "label2"]`;
}

async function analyzeWithAnthropic(title, body) {
  console.log('[label-analyzer] Using Anthropic Claude for analysis...');
  const { default: fetch } = await import('node-fetch');

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 256,
      messages: [{ role: 'user', content: buildPrompt(title, body) }],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error('Anthropic API error ' + response.status + ': ' + errorText);
  }

  const data = await response.json();
  const content = data.content?.[0]?.text?.trim();
  return parseLabels(content);
}

async function analyzeWithOpenAI(title, body) {
  console.log('[label-analyzer] Using OpenAI GPT for analysis...');
  const { default: fetch } = await import('node-fetch');

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + OPENAI_API_KEY,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      max_tokens: 256,
      temperature: 0,
      messages: [
        {
          role: 'system',
          content: 'You are a GitHub issue categorizer. Always respond with a valid JSON array of label strings only.',
        },
        { role: 'user', content: buildPrompt(title, body) },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error('OpenAI API error ' + response.status + ': ' + errorText);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content?.trim();
  return parseLabels(content);
}

function parseLabels(rawResponse) {
  if (!rawResponse) {
    console.warn('[label-analyzer] Empty AI response, defaulting to no labels.');
    return [];
  }

  try {
    const jsonMatch = rawResponse.match(/\[[\s\S]*?\]/);
    if (!jsonMatch) {
      console.warn('[label-analyzer] Could not extract JSON array from response: ' + rawResponse);
      return [];
    }

    const parsed = JSON.parse(jsonMatch[0]);

    if (!Array.isArray(parsed)) {
      console.warn('[label-analyzer] Parsed value is not an array.');
      return [];
    }

    return parsed.filter((label) => {
      const isValid = VALID_LABELS.includes(label);
      if (!isValid) {
        console.warn('[label-analyzer] Ignoring unknown label: "' + label + '"');
      }
      return isValid;
    });
  } catch (err) {
    console.error('[label-analyzer] Failed to parse AI response: ' + err.message);
    console.error('[label-analyzer] Raw response: ' + rawResponse);
    return [];
  }
}

// ─── GitHub API ───────────────────────────────────────────────────────────────

async function getExistingLabels(issueNumber) {
  const { default: fetch } = await import('node-fetch');
  const url = 'https://api.github.com/repos/' + REPO_OWNER + '/' + REPO_NAME + '/issues/' + issueNumber + '/labels';

  const response = await fetch(url, {
    headers: {
      Authorization: 'Bearer ' + GITHUB_TOKEN,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });

  if (!response.ok) {
    console.warn('[label-analyzer] Could not fetch existing labels: ' + response.status);
    return [];
  }

  const data = await response.json();
  return data.map((l) => l.name);
}

async function applyLabels(issueNumber, labels) {
  if (labels.length === 0) {
    console.log('[label-analyzer] No labels to apply.');
    return;
  }

  const { default: fetch } = await import('node-fetch');

  const existingLabels = await getExistingLabels(issueNumber);
  const newLabels = labels.filter((l) => !existingLabels.includes(l));

  if (newLabels.length === 0) {
    console.log('[label-analyzer] All suggested labels already applied.');
    return;
  }

  console.log('[label-analyzer] Applying labels: ' + newLabels.join(', '));

  const url = 'https://api.github.com/repos/' + REPO_OWNER + '/' + REPO_NAME + '/issues/' + issueNumber + '/labels';
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + GITHUB_TOKEN,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ labels: newLabels }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error('GitHub API error ' + response.status + ': ' + errorText);
  }

  console.log('[label-analyzer] Labels applied: ' + newLabels.join(', '));
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export async function analyzeIssue(titleOverride, bodyOverride) {
  const title = titleOverride !== undefined ? titleOverride : ISSUE_TITLE;
  const body = bodyOverride !== undefined ? bodyOverride : ISSUE_BODY;

  console.log('[label-analyzer] Analyzing issue: "' + title + '"');
  console.log('[label-analyzer] Body length: ' + body.length + ' chars');

  let labels = [];

  if (ANTHROPIC_API_KEY) {
    try {
      labels = await analyzeWithAnthropic(title, body);
    } catch (err) {
      console.warn('[label-analyzer] Anthropic failed: ' + err.message);
      if (OPENAI_API_KEY) {
        console.log('[label-analyzer] Falling back to OpenAI...');
        labels = await analyzeWithOpenAI(title, body);
      }
    }
  } else if (OPENAI_API_KEY) {
    labels = await analyzeWithOpenAI(title, body);
  }

  console.log('[label-analyzer] Suggested labels: ' + (labels.length > 0 ? labels.join(', ') : 'none'));
  return labels;
}

const isMain = process.argv[1] && process.argv[1] === fileURLToPath(import.meta.url);

if (isMain) {
  validateEnv();

  analyzeIssue()
    .then(async (labels) => {
      await applyLabels(ISSUE_NUMBER, labels);
    })
    .catch((err) => {
      console.error('[label-analyzer] Fatal error: ' + err.message);
      process.exit(1);
    });
}
