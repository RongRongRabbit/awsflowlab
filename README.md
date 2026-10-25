# AWS FlowLab — AWS Service Playground

无需章节顺序的日语 AWS WAF / ALB 交互 Playground。选一个例子，点击发送，即可观察规则与最终结果。React / TypeScript / Vite 静态应用，不需要后端、AWS 账号或付费 API。

## 在线体验

[打开 AWS FlowLab](https://RongRongRabbit.github.io/awsflowlab/)。WAF 已上线；新增 ALB 内容在对应 PR 合并部署后可用。

## 本地运行

Node.js 22.12+、24.x 或 26+。

```bash
npm ci
npm run dev
```

访问开发服务器的 `/awsflowlab/`。

## 功能

- 单页服务概览、User → WAF → Application 架构、真实模拟事件驱动的请求动画。
- 四个场景仅加载配置：正常、攻击 Block、Block 改 Count、Priority 反转；由用户手动发送。
- 基础请求选择、Rule ON/OFF、Action；高级折叠区提供 Priority、第二条规则与 Default Action。
- Allow / Block 终止，Count 继续，较小 Priority 优先；Match、No Match、禁用及未评估有独立状态。
- 自动播放、逐步、暂停、重播、前次结果比较、一键完整重置。
- 六张日语知识卡自由展开；统一 Playground，可直接演示正常、攻击 Block 和 Count 场景。
- Alt + 左右选择场景、键盘操作、响应式布局及减少动画偏好支持。

## ALB Playground

服务选择区切换 AWS WAF / ALB；切换会初始化配置和历史，避免后台播放。ALB 提供默认 Web、API 路径、图片路径与 Priority 重叠四个场景；选例不自动发送。

- 选择 /、/api/users、/images/logo.png 等预设路径。
- 观察按 Priority 执行的 Match / No Match、未评估规则、Forward 和最终应用。
- 开关规则，在折叠高级设置中修改 Priority（1～50000）、规则目标与默认目标。
- 自动播放、逐步、暂停、快照重播、完整重置、键盘场景切换及六张日语知识卡。

纯本地路径路由模型，不发送 HTTP。每个 Target Group 只有一个正常应用；暂不模拟健康检查、多实例负载分配、TLS 或 WAF 联动。OFF 是教学操作。WAF 引擎和 ALB 引擎各自独立。

## 验证与文档

```bash
npm test
npm run typecheck
npm run build
npm run docs:check
npm run preview
```

构建包含文档生成；preview 下访问 `/awsflowlab/` 和 `/awsflowlab/developer-guide/`。

[中文 Developer Guide](docs/developer-guide.md) 是文档源，[AGENTS.md](AGENTS.md) 是维护规范。单独构建使用 `npm run docs:build`；生成 HTML 不手工编辑、不提交。

## GitHub Pages

现有 Quality checks 检查 feature 分支与 PR。新增 Pages workflow 仅在 main 更新后构建、验证并发布整个 dist，包含 App 与 developer-guide/。Vite base 与实际仓库 awsflowlab 对应，为 `/awsflowlab/`。

首次发布前，在 Settings → Pages → Build and deployment 选择 **GitHub Actions**，允许仓库运行 Actions；如 github-pages 环境需要审批，由维护者审批。合并 PR 后检查 Deploy GitHub Pages 成功，并验证桌面、手机交互与指南入口。正式可用性以实际部署和访问验证为准。

## 模拟范围

这是教育用简化模型，不是真实 AWS WAF。不解析或发送 HTTP、不检测真实攻击、不连接 AWS。两条固定条件规则可编辑启用、动作与优先级。Count 只记录本次执行；设置仅存内存。全请求 Allow 是解释顺序的教学例，不是生产建议。未实现 SQLi、Managed Rules、Label、Rule Group、CAPTCHA、持久化指标或其他 AWS 服务。
