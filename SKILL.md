---
name: lzu-course-evaluation
description: Automate Lanzhou University teaching evaluation pages on jwqe.lzu.edu.cn using DOM/Playwright-style browser automation, without Computer Use, screenshots, OCR, or image recognition. Use when the user asks Codex or another agent to complete, submit, continue, or verify LZU midterm/final course evaluations, especially workflows with course rows, "授课教师" teacher dialogs, teacher-level "评价", 13 radio questions, 2 text comments, and final "已评价" verification.
---

# LZU Course Evaluation

## Scope

Automate the LZU teaching quality system at `https://jwqe.lzu.edu.cn/xssy` / `/hjjss` from an already authenticated browser session.

Use DOM or Playwright-style browser automation only. Do not use Computer Use, coordinate clicks, screenshots, OCR, or image recognition. If login, CAPTCHA, or account credentials are needed, ask the user to complete them in Chrome and continue only after the user says the evaluation page is ready.

Submit only when the user explicitly asks to complete or submit evaluations. If the user asks only to draft, preview, or inspect, fill or report the plan and stop before clicking `提交`.

## DOM Contracts

The current LZU evaluation page is an Element UI app. Prefer these stable DOM signals:

- Main course rows: `.el-table__body-wrapper > table > tbody > tr`, excluding rows inside `.el-dialog`.
- Pending course: row text contains `未评价`, or the "还需评价教师数" cell is a number greater than `0`.
- Course row cells are usually: course name, course type, `授课教师`, submit time, remaining teacher count, result, operation.
- Do not use the course operation `评价` link directly. For courses with one or few teachers it may show a prompt like "只能对教师进行评教". Always enter through `授课教师`.
- Teacher dialog: visible `.el-dialog` containing `教师工号` and table `#hjjs_skjs`.
- Teacher rows: `#hjjs_skjs .el-table__body-wrapper tbody tr`; each row has teacher number, teacher name, operation (`评价` or `查看`).
- Evaluation form dialog: visible `.el-dialog` containing `课程：`.
- Form questions: 65 `.el-radio` elements, 13 questions x 5 options.
- Text comments: exactly 2 `textarea` elements for questions 14 and 15.
- Submit button: button text `提交` inside the evaluation form dialog.
- Active Element UI message box: `.el-message-box__wrapper:not([style*="display: none"])`. Ignore stale hidden message boxes left in the DOM.

## Workflow

1. Use Chrome extension automation, Playwright, or equivalent DOM-capable browser control against the user's logged-in browser tab.
2. Navigate to `https://jwqe.lzu.edu.cn/xssy` if needed. If redirected to login, stop and ask the user to log in. The evaluation list is usually at `/hjjss`.
3. Read the main course table and build a pending list from rows with `未评价` or remaining teacher count greater than `0`.
4. For the next pending course, click that row's `a.skjs` / `授课教师` link.
5. Wait until `#hjjs_skjs .el-table__body-wrapper tbody tr` has at least one row. Some teacher dialogs load slowly; poll for several seconds instead of assuming failure after a fixed 1s sleep.
6. In the teacher dialog, loop over teacher rows whose operation contains `评价`:
   - Click that teacher row's `评价` link.
   - Wait for the evaluation form dialog containing `课程：`.
   - Fill and submit or preview the form according to user authorization.
   - After submission, accept any active Element UI confirmation/success message.
   - Re-read the teacher rows; continue until every teacher operation is `查看`.
7. After finishing one course, reload the page instead of relying on closing the Element UI teacher dialog. Reload clears stale dialogs reliably and preserves submitted data.
8. Repeat from the main course list until no pending rows remain.
9. Final verification must report all rows with remaining count `0`, result `已评价`, and operation `查看`; otherwise list the rows still pending.

## Form Filling

For the 13 radio questions, treat `.el-radio` as 13 groups of 5:

- Question 1: choose option index `0` (`优秀`) unless the user requests otherwise.
- Questions 2-13: choose option index `0` (`完全符合`) for most questions.
- Choose 2-4 varied questions as option index `1` (`符合`) to avoid a completely uniform response.
- Rotate second-best question sets across teachers, for example `[2,7,11]`, `[3,8,12]`, `[1,6,10]`, `[4,9,12]` using zero-based question indexes.
- Avoid low ratings unless the user explicitly requests them.

Before submitting, verify:

- radio count is at least `65`;
- two textareas are present and non-empty after filling;
- score is no longer `0` if the page exposes a score;
- the submit button is inside the form dialog, not in an unrelated dialog.

## Comment Style

Generate course-specific Chinese comments under 200 characters each.

- Q14: what was most satisfying, focusing on course content, teaching clarity, practice, examples, learning gains, or class atmosphere.
- Q15: mild, specific improvement suggestion, such as more cases, practice, discussion, review, feedback, or operation guidance.

Use these patterns:

```text
Theory: {course}课程内容安排较系统，教师讲解重点突出、条理清晰，能够结合实例帮助理解关键概念，对掌握课程知识和方法收获较大。
Theory suggestion: 建议今后适当增加典型案例、课堂练习和阶段性回顾，帮助同学更好地巩固重点内容。

Practicum: {course}注重实践过程和操作规范，教师对步骤、方法和注意事项讲解清晰，能帮助理解课程内容并提升动手与分析能力。
Practicum suggestion: 建议今后适当增加案例复盘和常见问题讲解，帮助同学更好地把握操作细节和结果分析方法。

Sports: 课程训练安排循序渐进，教师讲解动作要点清楚，能及时纠正练习中的问题，课堂氛围较好，对提升身体素质和运动习惯很有帮助。
Sports suggestion: 建议今后适当增加分层练习和动作反馈，让不同基础的同学都能更稳定地掌握技术要领。

Ideology/public: {course}内容紧扣理论与现实问题，教师讲解脉络清楚，案例贴近实际，有助于加深对课程重点和社会现实的理解。
Ideology/public suggestion: 建议今后适当增加课堂讨论和现实案例分析，帮助同学更主动地理解和运用相关理论。
```

## Implementation Pattern

Use equivalent helpers in the browser automation environment. In Codex Chrome plugin Playwright, prefer locators for clicks/fills and `evaluate` only for read-only DOM inspection.

```javascript
async function getPendingCourses(tab) {
  return await tab.playwright.evaluate(() => {
    const clean = s => (s || '').replace(/\s+/g, ' ').trim();
    return [...document.querySelectorAll('.el-table__body-wrapper > table > tbody > tr')]
      .filter(tr => !tr.closest('.el-dialog'))
      .map((tr, idx) => {
        const cells = [...tr.children].map(td => clean(td.innerText));
        return { idx, cells, text: clean(tr.innerText) };
      })
      .filter(r => r.cells.length >= 6)
      .map(r => ({
        idx: r.idx,
        course: r.cells[0],
        need: Number((r.cells[4] || '').match(/\d+/)?.[0] || 0),
        result: r.cells[5] || '',
        text: r.text
      }))
      .filter(r => r.need > 0 || r.result.includes('未评价'));
  });
}

async function closeActiveMessages(tab) {
  for (let i = 0; i < 5; i++) {
    const btn = tab.playwright.locator(
      '.el-message-box__wrapper:not([style*="display: none"]) .el-message-box button.el-button--primary'
    );
    const count = await btn.count();
    if (count === 0) return;
    if (count !== 1) throw new Error(`active message count=${count}`);
    await btn.click({});
  }
}

async function waitForTeacherRows(tab) {
  for (let i = 0; i < 25; i++) {
    const count = await tab.playwright.locator('#hjjs_skjs .el-table__body-wrapper tbody tr').count();
    if (count > 0) return count;
    await tab.playwright.waitForTimeout(400);
  }
  throw new Error('teacher rows did not load');
}
```

Use exact implementation details from the local browser API, but keep the control flow:

1. `getPendingCourses()`.
2. Click pending course row's `a.skjs`.
3. `waitForTeacherRows()`.
4. Read teacher rows and click teacher-level `评价`.
5. Fill `65` radios and `2` textareas.
6. Click form `提交` only if authorized.
7. Close active messages.
8. Reload page after each course.
9. Verify `getPendingCourses()` returns `[]`.

## Recovery

- If a direct course `评价` click creates a prompt, close the active message and use `授课教师`.
- If closing an Element UI dialog via its close or `确 定` button hangs, reload the page after successful teacher submissions and continue from the main list.
- If text-based locator filtering becomes slow, use CSS selectors plus `count()` and an index only after confirming the expected count.
- If a teacher dialog shows all teachers as `查看`, reload and verify the course row is `0 已评价 查看`.
- If the page structure differs from the selectors above, stop and inspect DOM snapshots/logs before submitting anything.
