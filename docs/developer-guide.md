# AWS FlowLab Playground 开发指南

本指南是长期维护的工程文档。App 面向日语初学者；此处面向维护代码的开发者。所有检测均为预设的确定性教学模拟，不解析 HTTP，不发送攻击，不连接 AWS。

## 技术栈与运行

React 18 管理 UI，TypeScript 严格检查类型，Vite 8 构建静态站点，lucide-react 提供图标。Vitest 5 + Testing Library + jsdom 验证引擎和组件。marked 转换 Markdown，highlight.js 高亮代码；流程图由文档脚本直接生成内联 SVG，无网络、LLM 或浏览器依赖。构建工具升级用于修复实际依赖审计问题；支持 Node.js 22.12+、24.x 或 26+（Vitest 5 不支持奇数版 Node）。

```bash
npm ci
npm run dev
npm test
npm run typecheck
npm run build
npm run docs:check
npm run preview
```

完整生产构建先检查类型，再打包 App，最后生成文档。单独运行 `npm run docs:build` 也会先检查 Markdown。输出为 `dist/developer-guide/index.html`；该文件是可再生成的产物，不提交 Git。Vite 开发服务器主要用于 App；文档用完整构建后的 preview 查看。

## 实际项目文件树

下列清单包括版本控制文件与文档，排除依赖、Git 内部文件、缓存和构建产物。文档检查器会与磁盘实际文件清单比对。

<!-- project-tree -->
```text
.github/workflows/checks.yml
.github/workflows/pages.yml
.gitignore
AGENTS.md
README.md
docs/developer-guide.md
index.html
package-lock.json
package.json
scripts/docs.mjs
scripts/docs.test.mjs
src/App.test.tsx
src/App.tsx
src/components/Playground.tsx
src/components/RequestFlow.tsx
src/main.tsx
src/services/waf/playback.ts
src/services/waf/wafEngine.test.ts
src/services/waf/wafEngine.ts
src/styles/app.css
tsconfig.json
vite.config.ts
```

## 项目架构

```flow
App.tsx：场景、介绍模式、请求、规则配置、执行状态
playback.ts / createExecution：冻结本次请求与 Web ACL
wafEngine.ts / evaluateWaf：按 Priority 生成执行事件
RequestFlow / ExecutionTrace：按当前事件渲染路径、状态与解释
app.css：方向粒子、动作颜色、演讲与响应式布局
```

[App.tsx](../src/App.tsx) 是协调组件；[规则引擎](../src/services/waf/wafEngine.ts) 无 React 依赖；[播放模型](../src/services/waf/playback.ts) 创建执行快照并限制步数；[展示组件](../src/components/RequestFlow.tsx) 只接收执行数据。没有 URL 路由，场景和模式由内存状态切换。刷新会清空配置和历史结果。

## 单页 Playground 与介绍模式

<!-- code-ref:src/App.tsx#createScenario -->
<!-- code-ref:src/App.tsx#loadScenario -->
<!-- code-ref:src/App.tsx#send -->
<!-- code-ref:src/App.tsx#changePriority -->
<!-- code-ref:src/components/Playground.tsx#ServiceOverview -->
<!-- code-ref:src/components/Playground.tsx#PlaygroundPanel -->
<!-- code-ref:src/components/Playground.tsx#KnowledgeCards -->

原三章的功能与知识已迁移：第一章架构、正常/攻击样本和规则开关进入概览、动画及基础操作；第二章 Match、终止、Count 和 Default Action 进入真实执行轨迹及六张知识卡；第三章顺序、动作、默认动作实验进入四个可自由选择的场景和折叠高级配置。没有前置章节或任务解锁。

ServiceOverview 提供服务身份与架构关系；PlaygroundPanel 统一可视化、操作和知识区域容器；KnowledgeCards 使用原生 details/summary，支持键盘展开与收起。这些是轻量展示组件，不包含 WAF 模拟语义。未来服务可复用这些容器并保留独立引擎。

`createScenario` 每次创建独立配置：正常、攻击 Block、攻击 Count 后继续 Allow、全请求 Allow 提前执行。`loadScenario` 只加载配置并清空播放及比较，不自动发送。基础操作展示请求类型、检测规则开关和 Action；高级区提供两条规则启用、条件说明、Priority、第二条 Action 和 Default Action。收起高级区保留配置。修改配置暂停旧执行并标记 dirty，旧快照仍可重播；必须重新发送才计算新结果。

```flow
选择场景（仅加载配置）或修改请求 / 规则
点击发送 → send(true) → createExecution 冻结配置
 evaluateWaf 按 Priority 生成真实事件
每 950ms 推进一步 → RequestFlow 展示当前状态
到达 destination → 显示最终动作与本次 Count
修改一个设置 → 重新发送 → 展开前次结果比较
```

`send` 在上次完成时保存请求、动作和完整规则摘要用于比较。`changePriority` 仅接受非负安全整数，重复值交换两条规则的 Priority。重置恢复默认正常请求、默认规则，并清除轨迹、比较和 dirty；模式、投影状态不受重置影响。折叠播放区保留手动逐步、暂停、快照重播和历史事件。

Hands-on 介绍模式重置到正常示例，只显示架构、三个场景及简化三节点动画；隐藏配置和知识卡，保留真实引擎结果、Count、步骤说明和重置。建议 3～5 分钟依次演示正常、攻击 Block、可选 Count，不重复实操细节。返回 Playground 同样恢复初始配置。Presenter Mode 放大动画节点与当前解释，是布局模式而非浏览器全屏；Esc 退出。Alt + 左右循环选择可见场景，Tab / Enter / Space 使用原生控件完成导航与展开。

## 规则模型与执行语义

<!-- code-ref:src/services/waf/wafEngine.ts#createDefaultAcl -->
<!-- code-ref:src/services/waf/wafEngine.ts#validateAcl -->
<!-- code-ref:src/services/waf/wafEngine.ts#matchesCondition -->

| 字段 | 作用 |
| --- | --- |
| Rule.id | 稳定标识，连接执行事件与规则卡 |
| enabled | 关闭时不检查条件，显示 DISABLED |
| condition | attack 匹配攻击样本；all 匹配全部样本 |
| action | ALLOW、BLOCK 或 COUNT |
| priority | 唯一非负整数，越小越先执行 |
| defaultAction | 未产生终止动作时应用 ALLOW 或 BLOCK |

默认攻击检测 Priority 10 / Block，全请求匹配 Priority 20 / Allow，Default Allow。攻击同时符合两条规则：交换顺序后，全请求 Allow 提前终止，攻击检测不会再执行。该宽泛 Allow 是教学反例，不能理解为生产安全建议。

Count 记录的是当前请求匹配过的规则 ID，不是持久化 CloudWatch 指标。禁用、No Match、终止后未评估是三种不同状态。未评估规则不会产生伪造的 Match / No Match 事件。

AWS 语义参考：[规则动作](https://docs.aws.amazon.com/waf/latest/developerguide/web-acl-rule-actions.html)、[Default Action](https://docs.aws.amazon.com/waf/latest/developerguide/web-acl-default-action.html)。

## 关键函数 Code Walkthrough

<!-- code-ref:src/services/waf/wafEngine.ts#evaluateWaf -->

`evaluateWaf(kind, acl)` 先验证配置，再复制并按 Priority 排序规则，不修改输入。每条规则产生一个事件；禁用或不匹配则继续，Count 收集 ID 并继续，Allow / Block 设置最终动作并 break。没有终止动作时追加 default 事件，最后追加 destination 事件。

下面是逻辑摘录；不是完整函数：

```typescript
if (!matched) continue;
if (rule.action === 'COUNT') {
  countedRuleIds.push(rule.id);
  continue;
}
action = rule.action;
terminatingRuleId = rule.id;
break;
```

<!-- code-ref:src/services/waf/playback.ts#createExecution -->
<!-- code-ref:src/services/waf/playback.ts#advanceStep -->

`createExecution` 复制每张规则卡并立即计算结果。配置编辑不会改变这份快照。`advanceStep` 的上限来自 `result.events.length - 1`，不再硬编码四步。App 的计时 effect 使用同一推进函数，结束、暂停、编辑配置或卸载时清除计时器。

<!-- code-ref:src/components/RequestFlow.tsx#RequestFlow -->
<!-- code-ref:src/components/RequestFlow.tsx#ExecutionTrace -->

`RequestFlow` 介绍模式直接渲染三个同级节点（User / WAF / Website），只显示一个 WAF 标题，避免嵌套 flex 卡片撑出容器或连线穿过节点。完整 Playground 使用 Web ACL 容器，规则卡和容器禁止收缩，详细流程按内容宽度布局；窄屏在流程区域内横向滚动。它按本次执行的顺序排列卡片，仅显示已执行事件的状态。当前 ruleId 高亮对应卡片；终止后剩余卡片显示未评估。界面默认只突出当前事件的一句说明；历史轨迹在折叠区域中。`ExecutionTrace` 只显示 `events.slice(0, step + 1)`，不会提前泄露最终答案。移动粒子由当前事件激活，单次播放，不持续循环；发送和重播通过新的组件 key 重启动画；最终 Allow 只播放一次通往网站的动画。

## 测试与质量检查

[引擎测试](../src/services/waf/wafEngine.test.ts) 覆盖 v0.1 四组合、终止、Count 后继续、Priority 重叠、Default Allow / Block、禁用、No Match、空规则、配置校验、输入不变性和执行快照。[组件测试](../src/App.test.tsx) 覆盖场景独立加载且不自动执行、终止后未评估、规则开关、Count、Default Action、重复 Priority 交换及非法数值、折叠卡片、介绍模式、键盘场景导航、Presenter、暂停、自动推进、快照重播、结果比较及完整重置。旧章节测试随交互迁移而重写，引擎测试完整保留。

[文档生成器测试](../scripts/docs.test.mjs) 验证重复构建字节一致，以及缺失本地链接、章节锚点、代码标识和过期文件树会失败。GitHub CI 执行相同检查；独立 Pages workflow 仅在 main 更新后构建并部署。

jsdom 不计算真实布局，也不播放 CSS。组件测试验证当前事件与渲染状态的对应关系；桌面和手机视觉仍需可用浏览器检查。减少动画偏好会关闭 CSS 动画，保留步骤与文本。

[文档脚本](../scripts/docs.mjs) 检查仓库所有 Markdown 链接、本地文件、章节锚点、`code-ref` 指定的 AST 标识及实际文件树。外部 HTTP 链接只检查格式，不进行网络可用性检查；AST 标识存在不代表说明正确，维护者必须人工检查代码流程。

## Developer Guide 维护与发布

[AGENTS.md](../AGENTS.md) 是长期规范，[README](../README.md) 提供用户入口。每次代码变更评估文档影响，同步更新此 Markdown、流程说明与文件树，然后执行文档和项目检查，再把代码、测试及 Markdown 一起提交。

```bash
npm run docs:check
npm run docs:build
```

文档含独立章节导航、SVG 架构与执行流程、代码高亮、深浅主题和响应式布局。主题仅保存在浏览器 localStorage，失败时不影响阅读。HTML 中源码链接指向长期维护的 main 分支；本 feature 合并前 main 尚不包含新组件。

## GitHub Pages 发布

已有 checks.yml 保留质量检查，新增 pages.yml 只监听 main push，不接受 feature 或 PR 部署。build job 执行测试、类型检查、Vite 与文档构建及文档检查，上传整个 dist；deploy job 仅获得 pages:write 和 id-token:write，使用 github-pages environment 和官方 deploy-pages action。发布串行执行，避免取消正在部署的任务。

真实远程仓库为 RongRongRabbit/awsflowlab，Vite base 固定 `/awsflowlab/`。App 根入口保持 dist/index.html，资源为 /awsflowlab/assets/，指南为 dist/developer-guide/index.html，App 链接指向 /awsflowlab/developer-guide/，指南通过 ../ 返回 App。使用 `npm run preview` 时也访问 /awsflowlab/。

维护者需在仓库 Settings → Pages → Build and deployment 选择 GitHub Actions，并检查 Actions 权限、github-pages environment 是否仅允许 main（如有审批需人工通过）。本次只提交配置并创建 PR，不合并或提前部署。README 在线入口标明待首次部署验证；只有 main 合并后 workflow 成功，再完成 HTTP 与浏览器检查才可确认正式 URL。公开产物不应包含凭据；项目没有 AWS/API 客户端或环境配置需求。不要在前端或 VITE_ 变量中存放密钥。

## 扩展方向与边界

当前 Condition 只有 attack / all；新增 SQLi 等类型时扩展 Condition 联合类型和 matchesCondition，并加入测试与日语样本解释。Managed Rules、Label、CloudFront 联动需独立建模，不要通过硬编码动画模拟评估结果。复杂条件会需要递归表达式；当前快照复制对现有扁平对象足够，扩展嵌套数据时改为深复制。

未实现真实 HTTP、真实威胁识别、AWS API、持久化、Rule Group、CAPTCHA、Label、Managed Rules、指标服务。没有 LLM 或付费 API。当前界面提供两条固定条件的规则，可编辑启用、动作与优先级，不能任意创建规则。
