# AWS FlowLab v0.2 开发指南

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
App.tsx：章节、请求、规则配置、执行状态
playback.ts / createExecution：冻结本次请求与 Web ACL
wafEngine.ts / evaluateWaf：按 Priority 生成执行事件
RequestFlow / ExecutionTrace：按当前事件渲染路径、状态与解释
app.css：方向粒子、动作颜色、演讲与响应式布局
```

[App.tsx](../src/App.tsx) 是协调组件；[规则引擎](../src/services/waf/wafEngine.ts) 无 React 依赖；[播放模型](../src/services/waf/playback.ts) 创建执行快照并限制步数；[展示组件](../src/components/RequestFlow.tsx) 只接收执行数据。没有 URL 路由，章节由内存状态切换。刷新会清空配置和历史结果。

## 三章教学与操作流程

<!-- code-ref:src/App.tsx#chapters -->

Chapter 01 使用原有 User → WAF → Website 关系，固定 Block 检测和 Default Allow，保留请求选择与规则开关。Chapter 02 是只读规则讲解，提供 Match / 终止、Count 继续、Default Action 三个固定例，用逐步按钮展示事件，不显示独立的 Web ACL 设置区、只读设置卡或请求选择控件；仅保留固定示例、规则流程与执行解释。createLessonAcl 为每个例子创建独立配置，实验修改不会改变教学例。第二章默认仅突出当前例子的一个学习点，术语表及历史步骤按需展开。Chapter 03 默认通过三个任务依次练习顺序、Count、默认动作；先发送基线，再修改一个设置，重新执行后才解锁下一任务。任务之间重建独立示例并清空比较记录。「この練習を準備（設定を初期化）」明确恢复当前任务基线。「詳しい設定を開く」才开放完整 Enabled、Action、Priority、Default Action 编辑和请求选择；收起设置时仍保留配置。原第四章总结已合并到第三章末尾。总讲解时间约 4.5～5 分钟，这是内容预算，不是实际计时器。

```flow
用户选择请求 / 修改 Enabled、Action、Priority、Default Action
标记 dirty，暂停旧执行；旧配置快照仍可回放
点击「リクエストを送信」→ send(true)
createExecution → evaluateWaf → 保存事件，step = 0
每 950ms 推进一个事件；也可暂停、逐步、重新播放
到达 destination → 停止计时，展示最终动作与本次 Count 数
```

<!-- code-ref:src/App.tsx#createLessonAcl -->
<!-- code-ref:src/App.tsx#prepareTask -->
<!-- code-ref:src/App.tsx#send -->
<!-- code-ref:src/App.tsx#changePriority -->
<!-- code-ref:src/App.tsx#goChapter -->

`send` 在第三章上次执行已结束时保存其请求、规则动作、优先级和默认动作，用于与新结果比较。默认只显示前次请求及结果，完整配置按需展开。第三章引导模式固定发送攻击样本；高级模式使用所选请求。`changePriority` 保证输入非负整数；若与另一条规则相同则交换两者数值。`goChapter` 重置播放，但保留请求和实验规则配置。第二章固定使用攻击样本，切换示例时重置播放，不改变第一、三章的请求选择。第二章从「例を確認」开始，仅手动逐步，最初から回到第一事件；第一、三章保留自动播放。Alt + 左右切换章节，Esc 退出 Presenter Mode。Presenter Mode 是布局切换，并非浏览器全屏。

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

`RequestFlow` 第一章直接渲染三个同级节点（User / WAF / Website），只显示一个 WAF 标题，避免嵌套 flex 卡片撑出容器或连线穿过节点。第二、三章使用 Web ACL 容器，规则卡和容器禁止收缩，详细流程按内容宽度布局；窄屏在流程区域内横向滚动。它按本次执行的顺序排列卡片，仅显示已执行事件的状态。当前 ruleId 高亮对应卡片；终止后剩余卡片显示未评估。界面默认只突出当前事件的一句说明；历史轨迹在折叠区域中。`ExecutionTrace` 只显示 `events.slice(0, step + 1)`，不会提前泄露最终答案。移动粒子由当前事件激活，单次播放，不持续循环；发送和重播通过新的组件 key 重启动画；最终 Allow 只播放一次通往网站的动画。

## 测试与质量检查

[引擎测试](../src/services/waf/wafEngine.test.ts) 覆盖 v0.1 四组合、终止、Count 后继续、Priority 重叠、Default Allow / Block、禁用、No Match、空规则、配置校验、输入不变性和执行快照。[组件测试](../src/App.test.tsx) 覆盖三个章节、第二章无设置区和请求编辑入口、固定例与第三章配置隔离、任务逐步解锁、Count 与默认动作任务、按需术语/轨迹、高级编辑保留、快捷键、Presenter、规则开关、顺序反转、Count、默认动作、自动推进、重播与重置。

[文档生成器测试](../scripts/docs.test.mjs) 验证重复构建字节一致，以及缺失本地链接、章节锚点、代码标识和过期文件树会失败。GitHub CI 执行相同检查，不部署站点。

jsdom 不计算真实布局，也不播放 CSS。组件测试验证当前事件与渲染状态的对应关系；桌面和手机视觉仍需可用浏览器检查。减少动画偏好会关闭 CSS 动画，保留步骤与文本。

[文档脚本](../scripts/docs.mjs) 检查仓库所有 Markdown 链接、本地文件、章节锚点、`code-ref` 指定的 AST 标识及实际文件树。外部 HTTP 链接只检查格式，不进行网络可用性检查；AST 标识存在不代表说明正确，维护者必须人工检查代码流程。

## Developer Guide 维护与发布

[AGENTS.md](../AGENTS.md) 是长期规范，[README](../README.md) 提供用户入口。每次代码变更评估文档影响，同步更新此 Markdown、流程说明与文件树，然后执行文档和项目检查，再把代码、测试及 Markdown 一起提交。

```bash
npm run docs:check
npm run docs:build
```

文档含独立章节导航、SVG 架构与执行流程、代码高亮、深浅主题和响应式布局。主题仅保存在浏览器 localStorage，失败时不影响阅读。HTML 中源码链接指向当前 feature 分支，合并或删除分支时需将文档脚本链接改为长期维护分支。

仓库当前没有 GitHub Pages workflow 或部署配置文件。构建输出在同一个 dist 下，App 为根 index.html，文档为 developer-guide/index.html；Vite 相对 base 适配仓库子路径。授权部署时上传整个 dist，可同时发布两个入口；本次不添加自动部署、不提供未经验证的公开 URL。

## 扩展方向与边界

当前 Condition 只有 attack / all；新增 SQLi 等类型时扩展 Condition 联合类型和 matchesCondition，并加入测试与日语样本解释。Managed Rules、Label、CloudFront 联动需独立建模，不要通过硬编码动画模拟评估结果。复杂条件会需要递归表达式；当前快照复制对现有扁平对象足够，扩展嵌套数据时改为深复制。

未实现真实 HTTP、真实威胁识别、AWS API、持久化、Rule Group、CAPTCHA、Label、Managed Rules、指标服务。没有 LLM 或付费 API。当前界面提供两条固定条件的规则，可编辑启用、动作与优先级，不能任意创建规则。
