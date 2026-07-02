# 兰州大学评教自动化 Skill（CDP 版）

> **CDP Edition** — 通过 Playwright CDP 控制 Edge 或 Chrome 浏览器完成评教。
> **无需安装任何浏览器扩展。**

本技能通过 [Playwright CDP](https://playwright.dev/docs/api/class-browsertype#browser-type-connect-over-cdp)
（Chrome DevTools 协议）连接您已登录的浏览器，自动读取评教表格并逐课程逐教师完成评教。
完全不依赖 Computer Use、屏幕坐标点击、截图、OCR 或图像识别。

---

## 快速上手

### 1. 启动浏览器（带远程调试端口）

**Edge 浏览器：**
```powershell
& “C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe” --remote-debugging-port=9222
```

**Chrome 浏览器：**
```powershell
& “C:\Program Files\Google\Chrome\Application\chrome.exe” --remote-debugging-port=9222
```

验证：访问 `http://localhost:9222/json/version`，看到 JSON 响应即表示成功。

### 2. 登录并进入评教页面

1. 打开 `http://my.lzu.edu.cn`
2. 输入账号密码 + 验证码登录
3. 点击：`本科质量监测 -> 评教任务 -> 当前评教任务`
4. 停留在该页面

### 3. 安装 Playwright 并运行

```bash
cd lzu-course-evaluation-skill
npm install playwright

# 预览模式 — 只列出待评课程，不做任何修改
node scripts/autoeval.js --dry-run

# 全自动评教 — 提交前会请求确认
node scripts/autoeval.js
```

---

## 文件说明

| 文件 | 用途 |
|---|---|
| `SKILL.md` | 供 AI Agent 阅读的完整操作指南 |
| `scripts/autoeval.js` | 可直接运行的 Playwright 自动化脚本 |
| `agents/openai.yaml` | Codex 技能发现系统的元数据 |
| `README.md` | 英文说明文档 |
| `README.zh-CN.md` | 本文件（中文说明） |

---

## 安全机制

- **不会自动提交**：提交第一个教师前会请求您的确认
- **不绕过登录**：必须您手动登录后才能继续
- **不依赖视觉识别**：全部基于 DOM 元素操作
- **完成后校验**：自动检查所有课程是否已变为「已评价」

---

## 环境要求

- **Node.js 18+**
- **Playwright**（运行 `npm install playwright` 安装）
- **Edge 或 Chrome** 浏览器（最新版）
- **Windows** 系统（主支持；macOS/Linux 亦可，浏览器路径不同）
- 可正常访问 `my.lzu.edu.cn` 和 `jwqe.lzu.edu.cn`
