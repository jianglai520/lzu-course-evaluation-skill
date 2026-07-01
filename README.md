# LZU Course Evaluation Skill

Automate Lanzhou University teaching evaluation workflows from `my.lzu.edu.cn` into the LZU evaluation system with DOM/Playwright-style browser automation.

This skill is designed for agents that can inspect and operate a logged-in browser tab through the page DOM. It intentionally avoids Computer Use, coordinate clicking, screenshots, OCR, and image recognition, so the workflow is more portable and less dependent on visual model behavior.

## What It Does

- Opens or continues from the LZU teaching evaluation list.
- Starts from the PC portal entry: `http://my.lzu.edu.cn` -> `本科质量监测` -> `评教任务`.
- Guides the user through login and task-entry clicks when the portal state is ambiguous.
- Finds courses that are still marked `未评价` or have remaining teachers to evaluate.
- Enters each course through `授课教师`, not the course-level `评价` shortcut.
- Evaluates every teacher whose teacher-row operation is `评价`.
- Fills 13 radio questions with mostly `优秀` / `完全符合`, with a few varied `符合` choices.
- Writes two short, course-specific Chinese comments.
- Submits only when explicitly authorized by the user.
- Reloads after each course to recover cleanly from Element UI dialog issues.
- Verifies that all course rows end as `0 / 已评价 / 查看`.

## Files

- `SKILL.md`: the actual Codex skill instructions.
- `agents/openai.yaml`: UI metadata for Codex skill discovery.

## Usage

Install or place this folder under a Codex skills directory, then invoke:

```text
Use $lzu-course-evaluation to complete the open LZU course evaluation page with DOM/Playwright automation.
```

The user should first open or allow the agent to open `http://my.lzu.edu.cn` in Chrome or another browser session that the agent can control through DOM automation. The expected PC path is:

```text
信息服务门户 -> 本科质量监测 -> 评教任务 -> 当前评教任务
```

If the page shows login, CAPTCHA, or multiple ambiguous tasks, the agent should ask the user to complete that step or specify which task to open.

## Safety Notes

This skill should not bypass authentication, solve CAPTCHA without user approval, or submit evaluations unless the user explicitly asks it to submit. If the user asks only to preview, inspect, or draft comments, the agent should stop before clicking `提交`.

## License

No license has been specified yet.
