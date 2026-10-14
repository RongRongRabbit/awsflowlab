# AWS FlowLab v0.2 — AWS WAF Basics

日语 AWS WAF 初学者交互课程，适合约 5 分钟 LT 和自主学习。基于 React、TypeScript、Vite，无后端、AWS 账号或付费 API。

## Run locally

Requires Node.js 22.12+, 24.x, or 26+ (development verified with Node.js 24).

Vite 8 / React plugin 6 and Vitest 5 retain the existing framework; tool versions were updated to resolve audit findings.

```bash
npm ci
npm run dev
```

## Features

- 三章：AWS WAF とは？ / WAF ルールの仕組み / ルールを変えて試してみよう！
- 第二章为只读固定例讲解（Match / 终止、Count 继续、Default Action），仅保留功能讲解、流程与逐步操作，不显示 Web ACL 设置区或请求选择；第三章按顺序、Count、默认动作三个任务逐步引导；完整编辑在「詳しい設定を開く」中，教学例不受实验配置影响。
- 正常与攻击样本、Enabled、Allow / Block / Count、Priority、Default Action。
- 按优先级执行，Allow / Block 终止，Count 继续；重叠规则展示顺序影响。
- 执行快照驱动动画、Match / No Match、禁用与未评估状态。
- 默认突出一个学习点及当前步骤，术语、历史轨迹、上次详细设置按需展开。
- 自动播放、逐步执行、暂停、重新播放、重置、前次结果比较。
- Presenter Mode、Alt+Left/Right 章节切换、Esc 退出演讲布局。
- 桌面与手机浏览、减少动画偏好支持。

## Checks and build

```bash
npm test
npm run typecheck
npm run docs:check
npm run build
npm run preview
```

`build` 包含类型检查、App 打包及 Developer Guide 构建。`test:watch` 用于开发测试。

## Developer Guide

中文源文件：[docs/developer-guide.md](docs/developer-guide.md)。长期维护规范：[AGENTS.md](AGENTS.md)。

```bash
npm run docs:check
npm run docs:build
```

HTML 输出：`dist/developer-guide/index.html`。完整构建并运行 preview 后，访问其本地地址下的 `/developer-guide/`；App 侧栏也有入口。Markdown 是唯一文档源，生成 HTML 不提交 Git，不依赖 LLM。检查覆盖仓库全部 Markdown 的本地文件、链接、锚点，以及指南关键标识和实际文件清单。GitHub CI 自动运行测试和构建，不部署站点。

## Static hosting / GitHub Pages

Vite base 为 `./`。部署整个 `dist/`，保留 App 根入口与独立的 `developer-guide/`。当前仓库没有部署 workflow；本次不自动发布。公开 URL 仅在实际部署和验证后提供。

## Scope and accuracy

这是教学模型，**不是真实 AWS WAF**。条件来自预设样本，不解析或发送 HTTP、不进行真实攻击检测。Count 仅记录当前执行，不是持久指标。设置和前次结果仅保存在内存。全请求 Allow 规则是解释优先级的教学示例，不是生产配置建议。

未实现 SQLi、Managed Rules、Label、Rule Group、CAPTCHA 或 CloudFront 联动。条件与规则数量固定；仅启用、Action、Priority 和 Default Action 可编辑。

## Suggested LT sequence

1. Chapter 01：发送正常和攻击样本，再关闭检测规则。
2. Chapter 02：介绍 Web ACL、Condition、Match 与 Action，说明 Priority 数字越小越先执行。
3. Chapter 03：先点击「この練習を準備」，发送样本，再交换顺序并重发；进入下一任务，只修改 Count；最后一个任务只修改 Default Action。完整设置按需展开。

## Next version

v0.3 可加入具体请求字段、SQLi 示例与 Label，再逐步引入 Managed Rules 和 CloudFront 架构联动。
