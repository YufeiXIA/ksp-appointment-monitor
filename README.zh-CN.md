# KSP 预约监控

> [English](README.md) | 简体中文

一个基于 Playwright 的小型监控工具，用于监控 Kentucky State Police（肯塔基州州警）驾考预约名额。

支持两个 Louisville/Bowman 考场档案：

- `written`：笔试（written permit test）
- `road`：路考（driver license road test）

当目标考场卡片出现预约入口时，监控程序会播放提示音、弹出 Windows 弹窗，并停止轮询、保持浏览器打开，以便你自己查看页面。

## 它做什么

- 默认每 30 秒检查一次 KSP 预约网站。
- 脚本启动时提示你选择笔试或路考。
- 只关注选中的目标考场卡片。
- 当该卡片显示 `Select In Person Appointment`、`Check Earliest Availability`，或显示可用数量行（如 `May 05, 1 available.`）时发出提醒。
- 提醒后保持浏览器打开。

## 它不做什么

- 不绕过 CAPTCHA、频率限制、资格规则或确认步骤。
- 提醒后不进入预约流程点击。
- 不填写申请人信息。
- 不提交或确认预约。
- 不需要任何个人信息。

## 环境要求

- Node.js 与 npm
- Git
- Windows PowerShell（用于弹窗提醒）

监控本身可在任何能运行 Playwright Chromium 的地方运行，但弹窗辅助是 Windows 专属的。在其他平台上，终端提示音仍然有效。

## 快速开始

```powershell
git clone https://github.com/YufeiXIA/ksp-appointment-monitor.git
cd ksp-appointment-monitor
npm install
npx playwright install chromium
Copy-Item .env.example .env
npm start
```

`.env` 文件是可选的。复制它只是为了给你一个方便修改默认档案、刷新间隔或浏览器设置的地方。

## 配置

如需修改默认值，编辑 `.env`：

```env
APPOINTMENT_PROFILE=
POLL_SECONDS=30
HEADLESS=false
SLOW_MO_MS=75
```

| 设置项 | 用途 |
| --- | --- |
| `APPOINTMENT_PROFILE` | 可选。填 `written` 或 `road` 可跳过启动时的选择提示；留空则交互式选择。 |
| `POLL_SECONDS` | 默认刷新间隔。低于 30 的值会被提升为 30。脚本启动时也可以选择。 |
| `HEADLESS` | 填 `true` 则以无界面方式运行（不显示浏览器窗口）。 |
| `SLOW_MO_MS` | 浏览器操作之间的小延迟，便于观察、提升稳定性。 |

该监控不使用姓名、生日、电话号码、邮箱、驾照号或地址。

## 运行

在项目目录下：

```powershell
npm start
```

你会看到：

```text
Choose appointment type to monitor:
  1) Written permit test - Louisville (Bowman) Regional Test Site-Written Test
  2) Road test - Louisville(Bowman) Regional Test Site - Road Test
Select 1 or 2 [1]:
Refresh interval in seconds, minimum 30 [30]:
```

暂无名额时，日志大致如下：

```text
Target location is listed, but currently shows No Availability: Louisville (Bowman) Regional Test Site-Written Test
```

当出现名额时，监控程序会：

1. 播放终端提示音。
2. 弹出 Windows 弹窗。
3. 停止轮询并保持浏览器打开。

此时请自行查看页面并手动继续操作。

## 测试

```powershell
npm test
node --check src\appointment-utils.js
node --check src\ksp-appointment-helper.js
```

## 文件

- `src/ksp-appointment-helper.js`：浏览器工作流与提醒。
- `src/appointment-utils.js`：匹配、配置与弹窗辅助。
- `test/appointment-utils.test.js`：针对匹配与配置的聚焦测试。
- `.env.example`：可选的本地配置模板。

## 隐私

- `.env` 已被 Git 忽略。
- `node_modules/` 与本地临时输出目录已被 Git 忽略。
- 监控程序不收集、不传输个人信息。

## 贡献者

- YufeiXIA
- Codex
