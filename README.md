# AWS FlowLab — AWS WAF Playground

无需章节顺序的日语 AWS WAF 交互 Playground。选一个例子，点击发送，即可观察规则与最终结果。React / TypeScript / Vite 静态应用，不需要后端、AWS 账号或付费 API。

## 在线体验

[打开 AWS FlowLab（待 main 合并后首次部署与验证）](https://RongRongRabbit.github.io/awsflowlab/)。当前不宣称站点已经上线。

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
- 六张日语知识卡自由展开；Hands-on 介绍模式提供 3～5 分钟架构与正常/攻击/Count 演示。
- Presenter Mode、Esc 退出、Alt + 左右选择场景、键盘操作、响应式布局及减少动画偏好支持。

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
