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

The evaluation page uses **Uni-app** (cross-platform Vue framework) on LZU's
teaching quality system (`jwqe.lzu.edu.cn:8080`). Content is loaded inside an
iframe on the portal's service-iframe page.

**Note:** An older version used Element UI. The current Uni-app version has
completely different DOM structure.

### Locating the Evaluation Content

- Portal page: `my.lzu.edu.cn/mylzu/service-iframe?service_name=听评课`
- Iframe (name `service-iframe`): `jwqe.lzu.edu.cn:8080`
- Course list hash: `#/pages/student/evalutationTeach/pj?taskid=XX`
- Evaluation form hash: `#/pages/student/evalutationTeach/evalute`

### Course List

- **Course name**: `.box-hjjs-middle-1`
- **Remaining count**: `.box-hjjs-middle-xpj` ("还需评价X位教师")
- **Evaluation button**: `.box-hjjs-footer-jspj` ("教师评价")
- **Course type**: `.box-hjjs-footer-1` ("课程类型：理论课")
- **Status**: text `未评价` (pending) or `已评价` (done)
- **Wrapper card**: `.box-hjjs-middle`

### Teacher Selection Popup (Multi-Teacher Courses)

- **Overlay**: `.pop_modal`
- **Content**: "教师选择 教师名（工号）评价"
- **Action**: click element with exact text `评价` inside `.pop_modal`

### Evaluation Form

- **Question containers**: 15 `.box3-1-2-2` elements
- **Radio options**: `.uni-list-cell` inside each `.box3-1-2-2`
  - Q1: 优秀 / 良好 / 一般 / 较差 / 差
  - Q2-Q13: 完全符合 / 符合 / 一般 / 不符合 / 完全不符合
- **Text areas**: `.uni-textarea-textarea` or `textarea` (×2)
- **Submit button**: `.box3-1` (text: 提交)
- **Confirm dialog**: `.uni-modal__btn_primary` (text: OK)

---

## Workflow

### Phase 1: Connect and Survey

1. Connect via Playwright CDP.
2. Find the portal page with `service-iframe` URL.
3. Locate the child frame named `service-iframe` (jwqe.lzu.edu.cn:8080).
4. Navigate to course list: `#/pages/student/evalutationTeach/pj?taskid=94`.
5. Read pending courses: `.box-hjjs-middle-1` (names) + `.box-hjjs-middle-xpj` (counts).
6. Report pending courses to the user.

### Phase 2: Per-Course Evaluation (While Loop)

Process the first pending course each iteration:

1. Navigate to course list, dismiss any popups.
2. Click `.box-hjjs-footer-jspj` via JavaScript (avoids overlay interception).
3. If `.pop_modal` with "教师选择" appears (multi-teacher course):
   - Click the element with exact text `评价` inside the popup.
4. Wait for `.box3-1-2-2` to appear (poll up to 15s).
5. Fill 13 radios: click `.uni-list-cell` at index 0 (优秀/完全符合)
   with 2-4 questions at index 1 (符合) for variety.
6. Fill 2 textareas with course-specific Chinese comments.
7. Click `.box3-1` (提交), then `.uni-modal__btn_primary` (确认).
8. Navigate back to course list.
9. Repeat until no pending courses remain.

### Phase 3: Final Verification

1. Re-read the course list.
2. Verify no "还需评价" text remains for any course.
3. Report results.

---

## Form Filling

### Radios (13 questions)

In each `.box3-1-2-2` container, `.uni-list-cell` elements are the radio
options. Click the `.uni-list-cell` directly.

- Q1 (优秀/良好/一般/较差/差): select index `0` (优秀).
- Q2-Q13 (完全符合/符合/一般/不符合/完全不符合):
  - Mostly index `0` (完全符合), 2-4 at index `1` (符合) for variety.
  - Rotate varied sets across teachers:
    `[1,6,11]`, `[2,7,10]`, `[0,5,9]`, `[3,8,12]` (zero-based).

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
- 15 `.box3-1-2-2` containers present (13 radio + 2 text)
- Both textareas non-empty after filling

---

## Reference Script

A complete implementation is at `scripts/autoeval.js`:

```bash
# One-time setup: install Playwright
cd lzu-course-evaluation-skill
npm install playwright

# Dry run (list pending courses only)
node scripts/autoeval.js --dry-run

# Full automation (auto-submit, no questions asked)
node scripts/autoeval.js --yes

# Full automation (prompt before first submission)
node scripts/autoeval.js
```

The script implements:
- CDP connection and page discovery (handles iframe)
- Course list reading (Uni-app `.box-hjjs-*` classes)
- Teacher selection popup handling (`.pop_modal`)
- 13-radio question filling (`.uni-list-cell`)
- 2-textarea comment filling
- User confirmation prompt (`--yes` to skip)
- Auto-return to course list after each submission
- Multi-teacher course support (while loop)

---

## Recovery

| Problem | Solution |
|---|---|
| Form not loaded after clicking | Wait longer; check if popup overlay is blocking |
| Click intercepted by overlay | Use JavaScript `.click()` instead of Playwright locator |
| Course list shows wrong task | Navigate with correct `taskid=XX` in URL |
| CDP connection fails | Check `localhost:9222/json/version` |
| Can't find eval page | Look for `service-iframe` named frame |

---

## Note

This skill works with **Edge** and **Chrome** on Windows. On macOS/Linux,
the `--remote-debugging-port` approach works the same way; only the browser
executable path differs. Requires Node.js 18+ and Playwright.
