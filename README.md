# LZU Course Evaluation Skill

> **CDP Edition** — Controls Edge or Chrome via Playwright CDP.
> No browser extension required.

Automate Lanzhou University teaching evaluation from `my.lzu.edu.cn`
using [Playwright CDP](https://playwright.dev/docs/api/class-browsertype#browser-type-connect-over-cdp)
(Chrome DevTools Protocol). Connects to an **already-logged-in browser**,
reads the evaluation table, and fills out evaluations automatically.

No Computer Use, screenshots, OCR, or image recognition needed.

---

## How It Works

```
1. User starts Edge/Chrome with --remote-debugging-port=9222
2. User logs in to my.lzu.edu.cn -> 评教任务
3. Playwright connects via CDP (no extension!)
4. Script finds pending courses in the evaluation table
5. For each course:
   - Click "授课教师" -> teacher dialog
   - For each teacher with "评价":
     - Fill 13 radio questions
     - Write 2 Chinese comments
     - Submit (with user confirmation)
   - Reload page
6. Verify all courses show "已评价"
```

---

## Quick Start

### 1. Launch Browser with Remote Debugging

**Edge (Windows):**
```powershell
& "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --remote-debugging-port=9222
```

**Chrome (Windows):**
```powershell
& "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222
```

Verify: open `http://localhost:9222/json/version` — JSON means it's working.

### 2. Log In and Navigate

1. Go to `http://my.lzu.edu.cn`
2. Log in with credentials + CAPTCHA
3. Click: `本科质量监测 -> 评教任务 -> 当前评教任务`
4. Leave the evaluation list page open

### 3. Install Playwright and Run

```bash
cd lzu-course-evaluation-skill
npm install playwright

# Dry run — list pending courses only, no changes
node scripts/autoeval.js --dry-run

# Full automation — prompts before submitting
node scripts/autoeval.js
```

---

## Files

| File | Purpose |
|---|---|
| `SKILL.md` | Full skill instructions for AI agents |
| `scripts/autoeval.js` | Ready-to-run Playwright automation script |
| `agents/openai.yaml` | Codex skill discovery metadata |
| `README.md` | This file |
| `README.zh-CN.md` | Chinese version |

---

## Safety

- **No automatic submission**: script asks for confirmation before submitting
- **No login bypass**: user must log in manually
- **No Computer Use / screenshots**: all DOM-based via Playwright
- **Final verification**: checks all courses are `已评价` after completion

---

## Requirements

- Node.js 18+
- Playwright (`npm install playwright`)
- Edge or Chrome (latest version)
- Windows (primary; macOS/Linux also work with different browser paths)
