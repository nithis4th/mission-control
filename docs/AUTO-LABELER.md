# GitHub Issues Auto-Labeler

ระบบ label issue อัตโนมัติสำหรับ Mission Control โดยใช้ AI วิเคราะห์ issue title + description

รองรับทั้ง **ภาษาไทย** และ **ภาษาอังกฤษ**

---

## Labels ที่รองรับ

| Label | ใช้เมื่อ |
|-------|---------|
| `bug` | bug report, ข้อผิดพลาด, ปัญหา, crash |
| `feature` | ขอ feature ใหม่, คุณสมบัติใหม่ |
| `enhancement` | ปรับปรุง feature เดิม, เพิ่มประสิทธิภาพ |
| `documentation` | เกี่ยวกับ docs, README, คู่มือ |
| `good first issue` | งานง่าย เหมาะสำหรับผู้เริ่มต้น |

---

## วิธี Setup

### 1. สร้าง Labels ใน GitHub Repository

ไปที่ **Issues > Labels > New label** และสร้าง labels เหล่านี้:

```
bug
feature
enhancement
documentation
good first issue
```

หรือรัน script สร้างทีเดียว (ต้องติดตั้ง `gh` CLI ก่อน):

```bash
gh label create "bug" --color "d73a4a" --description "Bug reports"
gh label create "feature" --color "0075ca" --description "New feature requests"
gh label create "enhancement" --color "a2eeef" --description "Improvements to existing features"
gh label create "documentation" --color "0075ca" --description "Documentation related"
gh label create "good first issue" --color "7057ff" --description "Good for newcomers"
```

### 2. ตั้ง GitHub Secrets

ไปที่ **Settings > Secrets and variables > Actions** แล้วเพิ่ม secrets:

| Secret | ค่า | หมายเหตุ |
|--------|-----|---------|
| `ANTHROPIC_API_KEY` | `sk-ant-...` | **แนะนำ** ใช้เป็นหลัก |
| `OPENAI_API_KEY` | `sk-...` | Fallback ถ้า Anthropic ล้มเหลว |

> ต้องมีอย่างน้อยหนึ่ง key  
> `GITHUB_TOKEN` มีให้อัตโนมัติโดย GitHub Actions ไม่ต้องเพิ่มเอง

### 3. เปิดใช้งาน GitHub Actions

GitHub Action จะถูก trigger อัตโนมัติเมื่อมี issue ใหม่หรือแก้ไข issue  
ไม่ต้องทำอะไรเพิ่ม

---

## วิธีทำงาน

```
Issue opened/edited
        ↓
GitHub Action trigger (.github/workflows/auto-label.yml)
        ↓
scripts/label-analyzer.js รัน
        ↓
ส่ง issue title + body ให้ Claude (Anthropic API)
        ↓
ถ้า Anthropic fail → fallback ไป OpenAI GPT
        ↓
Parse response เป็น label array
        ↓
Apply labels ผ่าน GitHub API
```

---

## ทดสอบ Local

```bash
cd scripts
npm install

# ทดสอบโดยไม่ apply labels จริง (dry run)
ANTHROPIC_API_KEY="sk-ant-..." \
GITHUB_TOKEN="ghp_..." \
ISSUE_NUMBER="1" \
ISSUE_TITLE="แอปแครชตอน login" \
ISSUE_BODY="กด login แล้วแอปดับเลย ไม่มี error message" \
REPO_OWNER="nithis4th" \
REPO_NAME="mission-control" \
node label-analyzer.js
```

---

## AI Models ที่ใช้

| Provider | Model | หมายเหตุ |
|----------|-------|---------|
| Anthropic | `claude-3-5-haiku-20241022` | หลัก — เร็ว ถูก แม่น |
| OpenAI | `gpt-4o-mini` | Fallback |

---

## Error Handling

- ถ้า Anthropic API ล้มเหลว → fallback ไป OpenAI อัตโนมัติ
- ถ้า AI response parse ไม่ได้ → ไม่ apply label (safe default)
- ถ้า label ที่ AI แนะนำไม่อยู่ใน valid list → ถูกกรองออก
- GitHub Action ไม่ fail workflow ถ้า labeling error (แค่ log warning)

---

## Files

```
.github/
  workflows/
    auto-label.yml     - GitHub Action definition
scripts/
  label-analyzer.js   - AI analyzer + GitHub API caller
  package.json        - Node.js dependencies
docs/
  AUTO-LABELER.md     - This file
```

---

*Last updated: 2026-03-01 by Dexter (CTO)*
