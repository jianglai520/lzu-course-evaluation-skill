# LZU Course Evaluation

> 自动化完成兰州大学本科教学评教。通过 Playwright CDP 控制 Edge/Chrome 浏览器，**无需安装任何扩展**。

---

## 适用人群

**兰州大学本科生**，需要在每学期末完成「本科质量监测 → 评教任务」中的课程评价。

---

## 环境要求

| 项目 | 要求 |
|---|---|
| 操作系统 | Windows（主支持），macOS/Linux 也可 |
| 浏览器 | Edge 或 Chrome（最新版） |
| Node.js | 18+（[下载](https://nodejs.org/)） |
| npm | 随 Node.js 自带 |

---

## 快速开始（3 步）

### 第 1 步：获取项目并安装依赖

```bash
git clone https://github.com/jianglai520/lzu-course-evaluation-skill.git
cd lzu-course-evaluation-skill
npm install playwright
```

### 第 2 步：启动浏览器 + 登录评教系统

**先关闭所有 Edge/Chrome 窗口**，然后按 `Win + R`，输入：

**Edge 用户：**
```
"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --remote-debugging-port=9222
```

**Chrome 用户：**
```
"C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222
```

在打开的浏览器中：
1. 访问 `http://my.lzu.edu.cn`
2. 输入学号/密码 + 验证码 **登录**
3. 依次点击：**本科质量监测 → 评教任务 → 当前评教任务**
4. 停留在该页面不动

> ✅ 验证：访问 `http://localhost:9222/json/version`，看到 JSON 即成功。

### 第 3 步：运行评教

```bash
# 先预览有哪些未评课程（不会做任何修改）
node scripts/autoeval.js --dry-run

# 全自动评教（提交前会询问确认，适合首次使用）
node scripts/autoeval.js

# 全自动评教（跳过确认，直接提交所有课程）
node scripts/autoeval.js --yes
```

---

## 运行选项

| 参数 | 作用 |
|---|---|
| `--dry-run` | 只列出待评课程，**不做任何修改** |
| `--yes` | 自动提交，**不需要手动确认** |
| `--no-submit` | 填表但停在提交前，用于检查 |
| `--port=9222` | 指定 CDP 端口（默认 9222） |

---

## 它会做什么

```
扫描课程列表 → 找出所有「未评价」课程
  → 逐门课程：
    ├ 点击「教师评价」
    ├ 如果有多位教师 → 弹出选择窗口 → 自动选第一位
    ├ 填写 13 道单选题（优秀/完全符合为主，少量选符合）
    ├ 填写 2 条中文评语（根据课程类型自动生成）
    └ 点击「提交」→ 确认 → 返回列表 → 继续下一门
→ 全部完成后输出结果
```

---

## 常见问题

### Q: 提示"无法连接到浏览器"？
> 检查浏览器是否以 `--remote-debugging-port=9222` 启动。
> 访问 `http://localhost:9222/json/version` 确认端口已开启。

### Q: CDP 端口被占用？
> 换一个端口：
> ```bash
# 启动浏览器
"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --remote-debugging-port=9223
# 运行脚本
node scripts/autoeval.js --port=9223
```

### Q: 评教页面显示异常？
> 按 F5 刷新页面，确保完全加载后再运行脚本。

### Q: 提交时卡住了？
> 可能是弹窗遮挡，手动关掉多余的弹窗再重试。

### Q: 脚本报错 "Playwright not found"？
> 运行 `npm install playwright`，然后重试。

### Q: 想修改评语内容？
> 编辑 `scripts/autoeval.js` 中的 `fillForm` 函数，找到 `c1` 和 `c2` 变量修改即可。

---

## 安全说明

- **不会泄露密码**：你手动登录，脚本只操作已登录的页面
- **不会擅自提交**：默认模式会先让你确认（`--yes` 除外）
- **不依赖截图/OCR**：全部通过 DOM 元素操作
- **不修改系统设置**：只读取和填写评教表单

---

## 项目文件

| 文件 | 说明 |
|---|---|
| `scripts/autoeval.js` | **主脚本** — 运行这个 |
| `SKILL.md` | 供 AI Agent 参考的详细操作文档 |
| `README.md` | 英文说明 |
| `README.zh-CN.md` | 本文件 |

---

## License

MIT
