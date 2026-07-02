---
name: lzu-course-evaluation
description: >-
  Automate Lanzhou University teaching evaluation from the LZU portal
  my.lzu.edu.cn using Playwright CDP (Chrome DevTools Protocol) to control
  Edge or Chrome browser. No extension required.
---

# LZU Course Evaluation (CDP Edition)

## Scope

Automate the LZU teaching evaluation flow from `http://my.lzu.edu.cn`
to the teaching quality system. The PC entry path is:

    my.lzu.edu.cn -> 本科质量监测 -> 评教任务 -> 当前评教任务

This skill uses **Playwright CDP** to connect to the user's already-logged-in
browser (Edge or Chrome on Windows). **No browser extension is required.**

Do not use Computer Use, coordinate clicks, screenshots, OCR, or image
recognition. All automation uses DOM element selectors via Playwright.

Submit only when the user explicitly asks. If the user asks only to preview
or inspect, stop before clicking `提交`.

---

## Browser Setup (Edge/Chrome via CDP)

The user must launch their browser with remote debugging enabled.

### Edge (Windows)

Close all Edge windows first, then run:

**PowerShell:**
```powershell
& "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --remote-debugging-port=9222
```

**Git Bash / WSL:**
```bash
"/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" --remote-debugging-port=9222 &
```

### Chrome (Windows)
```powershell
& "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222
```

### Verify CDP Is Active

Open `http://localhost:9222/json/version` in any browser. If JSON appears
with `webSocketDebuggerUrl`, CDP is active.

### User Steps After Launch

1. Navigate to `http://my.lzu.edu.cn`
2. Log in with credentials + CAPTCHA
3. Click `本科质量监测 -> 评教任务 -> 当前评教任务`
4. Leave the evaluation list page open

---

## CDP Connection (Playwright)

```javascript
const { chromium } = require('playwright');
const browser = await chromium.connectOverCDP('http://localhost:9222');
const context = browser.contexts()[0];      // shared browser context
const page = context.pages().find(p =>
  p.url().includes('hjjss') || p.url().includes('jwqe.lzu.edu.cn')
) || context.pages()[0];
```

### CDP vs Extension Playwright

| Aspect | CDP Connection |
|---|---|
| Browser launch | User manually starts with `--remote-debugging-port` |
| Session/cookies | User's existing login session is preserved |
| Multiple tabs | All tabs accessible via `context.pages()` |
| Locator API | Works identically to normal Playwright |
| `page.evaluate()` | Works identically |

---

## DOM Contracts

The evaluation page uses Element UI on LZU's teaching quality system
(commonly `jwqe.lzu.edu.cn`, `/hjjss` endpoints).

### Course Table

- **Rows**: `.el-table__body-wrapper > table > tbody > tr` (exclude rows inside `.el-dialog`)
- **Columns**: course name, type, `授课教师`, submit time, remaining count, result, operation
- **Pending**: text contains `未评价`, or remaining count > 0
- **Teacher entry**: `<a class="skjs">` (授课教师) in the course row
- **Warning**: do NOT click the course-level `评价` link directly; it may trigger
  "只能对教师进行评教". Always enter through `授课教师`.

### Teacher Dialog

- **Container**: visible `.el-dialog` with `教师工号` text
- **Teacher table**: `#hjjs_skjs .el-table__body-wrapper tbody tr`
- **Columns**: teacher number, name, operation (`评价` or `查看`)
- **Target rows**: rows with operation containing `评价`

### Evaluation Form

- **Container**: visible `.el-dialog` containing `课程：`
- **Radio questions**: 65 `.el-radio` = 13 questions x 5 options
- **Text comments**: exactly 2 `textarea` elements (Q14, Q15)
- **Submit**: button with text `提交` inside the form dialog

### Message Box

- **Selector**: `.el-message-box__wrapper:not([style*="display: none"])`
- **Primary button**: `.el-message-box button.el-button--primary`
- Always check for `display: none` before interacting (stale hidden boxes
  may remain in DOM)

---

## Workflow

### Phase 1: Connect and Survey

1. Connect to the running browser via Playwright CDP
2. Find the evaluation page (search for `hjjss`/`jwqe.lzu.edu.cn`/`评教` in URLs)
3. Read the course table using `page.evaluate()`:
   - Extract rows from `.el-table__body-wrapper > table > tbody > tr` (not in `.el-dialog`)
   - Filter rows with `未评价` or remaining teacher count > 0
4. Report pending courses to the user. If user hasn't explicitly said "start",
   ask for confirmation before proceeding.

### Phase 2: Per-Course Evaluation

For each pending course:

1. **Enter teacher dialog**
   - Click `a.skjs` (授课教师) in the course row
   - Wait for teacher dialog: poll `#hjjs_skjs tbody tr` (15s timeout, 400ms interval)

2. **Read teacher list**
   - Extract teacher rows where operation text contains `评价`
   - Report how many teachers need evaluation

3. **Per-teacher loop**
   - For each teacher with `评价` action:
     a. Click the `评价` link in that teacher's row
     b. Wait for evaluation form (poll visible `.el-dialog` for `课程：` text, 10s timeout)
     c. Fill 65 radios (13 questions; mostly top rating, 2-4 varied)
     d. Fill 2 textareas with course-specific Chinese comments
     e. Verify: radio count >= 65, both textareas non-empty
     f. Ask user for confirmation on the first teacher (if not already authorized).
        Subsequent teachers in same course auto-submit.
     g. Click `提交`
     h. Handle confirmation/success message boxes
     i. Re-read teacher rows; continue if more `评价` rows remain

4. **After course completes**
   - **Reload the page** (preferred over closing dialogs; clears Element UI state)
   - Wait 2s for table to re-render

### Phase 3: Final Verification

1. Re-read the course table
2. Verify all courses show: remaining `0`, result `已评价`, operation `查看`
3. Report to user: all done, or list still-pending courses

---

## Form Filling

### Radios (13 questions)

65 `.el-radio` elements = 13 groups of 5 (0-indexed):
- Option 0: `优秀` / `完全符合` (top)
- Option 1: `符合`
- Options 2-4: lower ratings (avoid unless requested)

**Strategy:**
- Q1: always option 0
- Q2-13: mostly option 0, with 2-4 questions at option 1 for variety
- Rotate varied sets across teachers: `[1,6,11]`, `[2,7,10]`, `[0,5,9]`, `[3,8,12]`
  (zero-based question indexes)

### Comments (2 textareas)

Generate course-specific Chinese comments under 200 chars each.

- Q14: strengths — course content, teaching clarity, practice, atmosphere
- Q15: mild improvement suggestion — more cases, practice, discussion, review

**Patterns by course type:**

```text
Theory:  {course}课程内容安排较系统，教师讲解重点突出、条理清晰，
         能够结合实例帮助理解关键概念，对掌握课程知识和方法收获较大。
Theory suggestion: 建议今后适当增加典型案例、课堂练习和阶段性回顾，
                   帮助同学更好地巩固重点内容。

Practicum: {course}注重实践过程和操作规范，教师对步骤、方法和注意
           事项讲解清晰，能帮助理解课程内容并提升动手与分析能力。
Practicum suggestion: 建议今后适当增加案例复盘和常见问题讲解，
                      帮助同学更好地把握操作细节和结果分析方法。

Sports: 课程训练安排循序渐进，教师讲解动作要点清楚，能及时纠正练习
        中的问题，课堂氛围较好，对提升身体素质和运动习惯很有帮助。
Sports suggestion: 建议今后适当增加分层练习和动作反馈，让不同基础的
                   同学都能更稳定地掌握技术要领。

Ideology/public: {course}内容紧扣理论与现实问题，教师讲解脉络清楚，
                 案例贴近实际，有助于加深对课程重点和社会现实的理解。
Ideology/public suggestion: 建议今后适当增加课堂讨论和现实案例分析，
                            帮助同学更主动地理解和运用相关理论。
```

**Pre-submit check:**
- Radio count >= 65
- Both textareas non-empty after filling
- Score not 0 (if page exposes a visible score)
- Submit button is inside form dialog

---

## Reference Script

A complete implementation is at `scripts/autoeval.js`:

```bash
# One-time setup: install Playwright
cd lzu-course-evaluation-skill
npm install playwright

# Dry run (list pending courses only)
node scripts/autoeval.js --dry-run

# Full automation (user is prompted before first submission)
node scripts/autoeval.js
```

The script implements:
- CDP connection and page discovery
- Course table reading
- Teacher dialog navigation
- 13-radio + 2-textarea form filling
- User confirmation prompt
- Page reload between courses
- Final verification

---

## Recovery

| Problem | Solution |
|---|---|
| Direct `评价` shows "只能对教师进行评教" | Close message, use `授课教师` link |
| Dialog close button hangs | Reload page; submitted data is preserved |
| All teachers show `查看` already | Reload and verify course row |
| CDP connection fails | Check `localhost:9222/json/version` |
| Can't find eval page | List all pages; ask user which to use |
| Form doesn't appear after clicking `评价` | Poll 10s with 300ms intervals |

If DOM selectors don't match the current page, stop and inspect the DOM.
Ask the user for the relevant HTML snippet before continuing.

---

## Note

This skill works with **Edge** and **Chrome** on Windows. On macOS/Linux,
the `--remote-debugging-port` approach works the same way; only the browser
executable path differs. Requires Node.js 18+ and Playwright.
