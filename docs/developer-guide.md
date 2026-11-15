# AWS FlowLab Playground 开发指南

本指南是长期维护的工程文档。App 面向日语初学者；此处面向维护代码的开发者。所有评估均为预设的确定性教学模拟，不解析 HTTP，不发送攻击，不连接 AWS。

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
src/components/AlbFlow.tsx
src/components/AlbPlayground.test.tsx
src/components/AlbPlayground.tsx
src/components/CloudFrontFlow.tsx
src/components/CloudFrontPlayground.test.tsx
src/components/CloudFrontPlayground.tsx
src/components/Playground.tsx
src/components/RequestFlow.tsx
src/components/WafPlayground.tsx
src/main.tsx
src/services/alb/albEngine.test.ts
src/services/alb/albEngine.ts
src/services/alb/playback.ts
src/services/cloudfront/cloudfrontEngine.test.ts
src/services/cloudfront/cloudfrontEngine.ts
src/services/cloudfront/playback.ts
src/services/cloudfront/scenarios.ts
src/services/waf/playback.ts
src/services/waf/wafEngine.test.ts
src/services/waf/wafEngine.ts
src/styles/app.css
tsconfig.json
vite.config.ts
```

## 项目架构

```flow
App.tsx：服务选择与共享顶栏
WafPlayground / AlbPlayground / CloudFrontPlayground：各自的场景、配置与播放状态
playback.ts / createExecution：冻结本次请求与 Web ACL
wafEngine.ts / evaluateWaf：按 Priority 生成执行事件
RequestFlow / AlbFlow / CloudFrontFlow：按各自引擎的当前事件渲染路径、状态与解释
app.css：方向粒子、动作颜色与响应式布局
```

[App.tsx](../src/App.tsx) 只管理 WAF / ALB / CloudFront 服务选择及顶栏；[WafPlayground](../src/components/WafPlayground.tsx) 管理原 WAF 场景、规则和播放。[规则引擎](../src/services/waf/wafEngine.ts) 无 React 依赖；[播放模型](../src/services/waf/playback.ts) 创建执行快照并限制步数；[展示组件](../src/components/RequestFlow.tsx) 只接收执行数据。没有 URL 路由，默认进入 WAF。切换服务会卸载旧服务，清除其计时器和键盘监听，再初始化新服务；界面明确提示配置和执行历史将重置。刷新同样清空状态。服务选择按钮支持 Tab 与 Enter / Space。

## 统一单页 Playground

<!-- code-ref:src/components/WafPlayground.tsx#createScenario -->
<!-- code-ref:src/components/WafPlayground.tsx#loadScenario -->
<!-- code-ref:src/components/WafPlayground.tsx#send -->
<!-- code-ref:src/components/WafPlayground.tsx#changePriority -->
<!-- code-ref:src/components/Playground.tsx#ServiceOverview -->
<!-- code-ref:src/components/Playground.tsx#PlaygroundPanel -->
<!-- code-ref:src/components/Playground.tsx#KnowledgeCards -->

原三章的功能与知识已迁移：第一章架构、正常/攻击样本和规则开关进入概览、动画及基础操作；第二章 Match、终止、Count 和 Default Action 进入真实执行轨迹及六张知识卡；第三章顺序、动作、默认动作实验进入四个可自由选择的场景和折叠高级配置。没有前置章节或任务解锁。

ServiceOverview 接收 title、category、description、architecture 和 icon，提供服务身份与架构关系，默认值保持 WAF 展示；PlaygroundPanel 统一可视化、操作和知识区域容器；KnowledgeCards 使用原生 details/summary，支持键盘展开与收起。这些是 WAF、ALB 与 CloudFront 共用的轻量展示组件，不包含服务模拟语义；三个服务使用独立引擎、快照和可视化，没有通用模拟框架。

`createScenario` 每次创建独立配置：正常、攻击 Block、攻击 Count 后继续 Allow、全请求 Allow 提前执行。`loadScenario` 只加载配置并清空播放及比较，不自动发送。基础操作展示请求类型、检测规则开关和 Action；高级区提供两条规则启用、条件说明、Priority、第二条 Action 和 Default Action。收起高级区保留配置。修改配置暂停旧执行并标记 dirty，旧快照仍可重播；必须重新发送才计算新结果。

```flow
选择场景（仅加载配置）或修改请求 / 规则
点击发送 → send(true) → createExecution 冻结配置
 evaluateWaf 按 Priority 生成真实事件
每 950ms 推进一步 → RequestFlow 展示当前状态
到达 destination → 显示最终动作与本次 Count
修改一个设置 → 重新发送 → 展开前次结果比较
```

`send` 在上次完成时保存请求、动作和完整规则摘要用于比较。`changePriority` 仅接受非负安全整数，重复值交换两条规则的 Priority。重置恢复默认正常请求、默认规则，并清除轨迹、比较和 dirty。折叠播放区保留手动逐步、暂停、快照重播和历史事件。

界面统一为 Playground，移除独立 Hands-on 介绍模式与 Presenter Mode，不再存在模式切换、模式导致的配置重置或专用投影样式。四个场景、规则动画、基础配置、折叠高级配置与知识卡始终在同一页面。默认提示先发送正常请求；现场可依次选正常、攻击 Block、Count，无需切换界面。需要大屏展示时使用浏览器缩放或全屏。Alt + 左右循环选择四个场景，Tab / Enter / Space 使用原生控件完成导航与展开。

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

`createExecution` 复制每张规则卡并立即计算结果。配置编辑不会改变这份快照。`advanceStep` 的上限来自 `result.events.length - 1`，不再硬编码四步。WafPlayground 的计时 effect 使用同一推进函数，结束、暂停、编辑配置或卸载时清除计时器。

<!-- code-ref:src/components/RequestFlow.tsx#RequestFlow -->
<!-- code-ref:src/components/RequestFlow.tsx#ExecutionTrace -->

`RequestFlow` 在 Playground 中始终使用详细 Web ACL 容器；组件原有简化三节点渲染分支仍保留，但当前页面不调用。规则卡和容器禁止收缩，详细流程按内容宽度布局；窄屏在流程区域内横向滚动。它按本次执行的顺序排列卡片，仅显示已执行事件的状态。当前 ruleId 高亮对应卡片；终止后剩余卡片显示未评估。界面默认只突出当前事件的一句说明；历史轨迹在折叠区域中。`ExecutionTrace` 只显示 `events.slice(0, step + 1)`，不会提前泄露最终答案。移动粒子由当前事件激活，单次播放，不持续循环；发送和重播通过新的组件 key 重启动画；最终 Allow 只播放一次通往网站的动画。

## ALB 路径转发 Playground

<!-- code-ref:src/components/AlbPlayground.tsx#createAlbScenario -->
<!-- code-ref:src/components/AlbPlayground.tsx#AlbPlayground -->
<!-- code-ref:src/services/alb/albEngine.ts#createDefaultListener -->
<!-- code-ref:src/services/alb/albEngine.ts#validateListener -->
<!-- code-ref:src/services/alb/albEngine.ts#matchesPath -->
<!-- code-ref:src/services/alb/albEngine.ts#evaluateAlb -->
<!-- code-ref:src/services/alb/playback.ts#createAlbExecution -->
<!-- code-ref:src/services/alb/playback.ts#advanceAlbStep -->
<!-- code-ref:src/components/AlbFlow.tsx#AlbFlow -->

[AlbPlayground](../src/components/AlbPlayground.tsx) 提供四个只加载配置的场景：默认 Web、API 路径、图片路径、全路径规则抢先匹配。基础控制为预设请求路径和三个规则 ON/OFF；高级区折叠 Priority、各规则转发目标及 Default Rule 的目标。六张日语卡片说明 ALB、Listener、Path、Priority、Target Group 和默认规则。没有恢复介绍或发表模式。

[ALB 引擎](../src/services/alb/albEngine.ts) 的模型如下：

| 对象 | 约束与默认值 |
| --- | --- |
| Listener | HTTP :80；默认转发至 web |
| API 规则 | /api/*，Priority 10，启用，转发 api |
| Images 规则 | /images/*，Priority 20，启用，转发 images |
| 全路径规则 | /*，Priority 30，默认关闭，转发 web |
| Target Group | web / api / images，每组一个始终正常的教学应用 |
| Priority | 唯一整数 1～50000，与 WAF 的非负 Priority 区分 |

`evaluateAlb` 先验证 Listener、唯一 ID、Priority、固定路径模式和目标，再校验简单的绝对路径输入。仅接受 ASCII 字母、数字、斜线、下划线、点和连字符，并拒绝点路径段、查询串和完整 URL。`matchesPath` 对三个固定的尾部星号模式做区分大小写的前缀匹配：/api/* 匹配 /api/ 和 /api/users，不匹配 /api 或 /API/users。没有声称支持所有 AWS 通配符、URL 正规化或完整 HTTP 解析。用户只能选取预设路径。

规则副本按 Priority 升序排列。关闭规则产生 DISABLED 事件；不匹配产生 NO MATCH；首个 MATCH 确定转发目标并立即停止规则评估。没有匹配时才追加 Default Rule 事件。最后追加 forward 和 destination 事件；转发不会修改请求路径。Default Rule 没有可编辑条件或 Priority。ON/OFF 是在教学模型中将规则排除出评估的操作，不是 AWS 原生的启用属性。Priority 重复输入时交换两条规则数值，非法输入保持原值。

```flow
服务选择 ALB → 挂载独立 AlbPlayground
选择场景或修改路径 / 规则（暂停并标记 dirty）
点击发送 → createAlbExecution 复制 Listener
 evaluateAlb → 按 Priority 检查到首个 Match，否则使用 Default Rule
每 950ms 推进事件 → AlbFlow 更新规则与定向粒子
forward → 目标组高亮 → destination → 最终应用
修改后重新发送 → 使用新配置；重播仍使用旧快照
```

[ALB 播放模型](../src/services/alb/playback.ts) 复制规则和 Listener 后立即执行纯引擎。修改当前配置不改变正在展示的旧快照，dirty 提示要求重新发送；暂停、逐步、重播与完整重置沿用 WAF 的操作形式，但不共用语义类型。`advanceAlbStep` 上限为事件列表末尾。播放结束、编辑、重置、服务切换或卸载时清理计时器；Alt + 左右仅控制当前服务的四个场景。

[AlbFlow](../src/components/AlbFlow.tsx) 展示利用者、ALB Listener 中的规则、三个 Target Group 及各自应用。只读取已推进的事件，转发阶段之前不高亮最终目标；提前终止后其余规则显示未评估。图中的粒子由当前 request / forward 事件触发，单次运行；重播通过新 key 重启。窄屏将横向滚动限制在图内，设置和知识卡换行；减少动画偏好仍保留文本与事件状态。

范围限于 Forward 与路径路由，不包含健康检查、多实例负载分配、HTTPS/TLS、Redirect、Fixed Response、Host Header、权重、Stickiness 或 WAF/ALB 联动。不会将这三个组的分流冒充为组内的多台负载均衡。

语义核对：[Listener 规则与默认规则](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/listener-rules.html)、[Priority 范围](https://docs.aws.amazon.com/elasticloadbalancing/latest/APIReference/API_CreateRule.html)、[路径条件](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/rule-condition-types.html)。

## CloudFront 缓存 Playground

<!-- code-ref:src/services/cloudfront/cloudfrontEngine.ts#createDistribution -->
<!-- code-ref:src/services/cloudfront/cloudfrontEngine.ts#createEdgeState -->
<!-- code-ref:src/services/cloudfront/cloudfrontEngine.ts#selectBehavior -->
<!-- code-ref:src/services/cloudfront/cloudfrontEngine.ts#createCacheKey -->
<!-- code-ref:src/services/cloudfront/cloudfrontEngine.ts#evaluateCloudFront -->
<!-- code-ref:src/services/cloudfront/cloudfrontEngine.ts#advanceTime -->
<!-- code-ref:src/services/cloudfront/cloudfrontEngine.ts#updateOrigin -->
<!-- code-ref:src/services/cloudfront/cloudfrontEngine.ts#invalidateCache -->
<!-- code-ref:src/services/cloudfront/playback.ts#createCloudFrontExecution -->
<!-- code-ref:src/services/cloudfront/playback.ts#advanceCloudFrontStep -->
<!-- code-ref:src/services/cloudfront/scenarios.ts#createCloudFrontScenario -->
<!-- code-ref:src/components/CloudFrontPlayground.tsx#CloudFrontPlayground -->
<!-- code-ref:src/components/CloudFrontFlow.tsx#CloudFrontFlow -->

[CloudFrontPlayground](../src/components/CloudFrontPlayground.tsx) 将缓存基础与策略探索合为一个页面，无章节或独立模式。复用概览、容器、知识卡。默认操作包含固定路径、lang、发送、时间 +10秒、当前路径源站更新、Invalidation 和重置；「キャッシュの設定」折叠区提供各 Behavior 的 TTL 和 lang 是否加入缓存键。缓存表列出键、保存内容语言/版本及剩余 TTL；已过期对象保留展示，直到同键重新取得或手动失效。

[场景模型](../src/services/cloudfront/scenarios.ts) 提供六个场景：空缓存的首次/再次请求；缓存 v1 而源站 v2；缓存 v1 已经过20秒而 TTL 为30秒；已保存 JA 内容、当前请求 EN；API 默认不缓存并可切换图片；预热 v1 且源站 v2 以比较失效前后。预热只用于构造明确说明的初始状态，不启动动画、当前结果或自动发送。每个场景及重置均创建独立数据，切换服务清空会话。

[纯引擎](../src/services/cloudfront/cloudfrontEngine.ts) 使用单个边缘节点和一个源站，固定路径为 /index.html、/images/logo.png、/api/users，语言只有 ja/en。源站版本按路径递增，一次更新同时代表该路径的两种语言内容更新，但不修改缓存。状态中的 now 仅由 advanceTime 按非负整数推进；真实等待和950ms播放计时不会让 TTL 流逝。

| Behavior 固定匹配顺序 | 初始 TTL | lang 纳入缓存键 |
| --- | --- | --- |
| /images/* | 60秒 | 否 |
| /api/* | 0秒（禁用缓存） | 否 |
| Default (*) | 30秒 | 否 |

`selectBehavior` 只看路径，按固定顺序选取策略。`createCacheKey` 为 path 或 path?lang=ja/en，隐含固定 Distribution，不模拟跨域缓存。所有请求的 lang 始终被转发到源站：这是固定的 Origin Request Policy 假设，不能把“未加入缓存键”错误解释成“不会转发”。因此先缓存 JA 后用 EN 请求同键，会返回 JA；开启 lang 键后才分别缓存。

`evaluateCloudFront` 验证请求和策略后复制状态。TTL=0 时始终回源且不写缓存，显示教学标签 BYPASS；否则同键对象满足 now < expiresAt 才为 HIT。HIT 不回源、不写缓存、不续期。对象缺失或恰好到期为 MISS，取得当前源站版本并以 now + TTL 写入，替换同键旧值。假设固定 GET / 200 且源站没有 Cache-Control / Expires 或验证器，因此到期后直接完整重新取得，不模拟304。TTL 输入0～3600秒是教材约束，不代表 AWS 的上限。修改 TTL 不重写已有对象期限；改为0则下一次请求跳过已有缓存，重新启用时仍按当前键和对象有效期判断。

```flow
选择场景（仅准备状态）或编辑请求 / 策略
send → createCloudFrontExecution 冻结请求、策略和之前的边缘状态
 evaluateCloudFront → 选择 Behavior → 计算 Key → HIT / MISS / BYPASS
HIT 直接响应；MISS / BYPASS 回源，MISS 保存新对象
送信时一次性提交 nextState；缓存表展示送信后的状态
950ms 按事件播放 CloudFrontFlow；再生只重播快照，不再请求
手动推进时间 / 更新源站 / 失效缓存 → 暂停并标记 dirty → 再送信
```

[播放模型](../src/services/cloudfront/playback.ts) 冻结请求、三份策略及之前的缓存/源站状态，计算不可变结果。UI 在发送时提交 nextState，缓存表明确标为送信后状态；播放只是该次请求的记录。动画和最终响应使用同一结果，HIT 没有 origin/store 事件，转发阶段之前不泄露响应版本。重播不会再次写缓存、续期或推进时钟。设置或世界状态变化暂停播放，保留旧结果并提示重新发送。关闭播放、重置、场景/服务切换和卸载清理计时器与监听。

`invalidateCache` 接受 /index.html*、/images/*、/api/* 或 /*，以末尾星号做区分大小写的缓存键前缀匹配。/index.html* 会覆盖 lang 变体；不修改时钟或源站，也不主动取新内容。UI 显示失效数量并明确“即時完了の簡易モデル”。真实 CloudFront 失效传播并非立即完成。请求、策略、时间和失效操作不连接 AWS、不产生费用。

[CloudFrontFlow](../src/components/CloudFrontFlow.tsx) 展示利用者、边缘缓存和 Origin，按当前事件分别激活利用者到边缘、边缘到源站的请求、源站返回及边缘响应方向的粒子。Hit 的响应绕过源站，最终将源站节点置为淡色。知识卡说明 Hit/Miss、TTL、Cache Key、Behavior、Invalidation 及单边缘限制。窄屏的图和缓存表各自横向滚动，页面控件换行，减少动画偏好关闭动画但保留事件信息。

暂不包含多边缘、浏览器缓存、Cookie、请求头、304再验证、错误缓存、非GET请求、缓存淘汰、源站失败、配置传播及 WAF/ALB 联动。不要将 BYPASS 标签或简化 TTL 控件当成 AWS 控制台/响应头的精确复制。

语义参考：[缓存键](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/controlling-the-cache-key.html)、[Behavior 匹配](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/DownloadDistValuesCacheBehavior.html)、[TTL 与缓存策略](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/cache-key-understand-cache-policy.html)、[Invalidation 路径与查询参数](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/invalidation-specifying-objects.html)。

## 测试与质量检查

[引擎测试](../src/services/waf/wafEngine.test.ts) 覆盖 v0.1 四组合、终止、Count 后继续、Priority 重叠、Default Allow / Block、禁用、No Match、空规则、配置校验、输入不变性和执行快照。[组件测试](../src/App.test.tsx) 覆盖场景独立加载且不自动执行、终止后未评估、规则开关、Count、Default Action、重复 Priority 交换及非法数值、折叠卡片、统一界面与旧模式入口移除、键盘场景循环导航、暂停、自动推进、快照重播、结果比较及完整重置。旧章节测试随交互迁移而重写，引擎测试完整保留。

[ALB 引擎测试](../src/services/alb/albEngine.test.ts) 覆盖默认/API/图片转发、大小写和路径边界、首次匹配终止、重叠 Priority、禁用、空规则、默认目标、非法配置、输入不变性、快照和播放步数上限。[ALB 组件测试](../src/components/AlbPlayground.test.tsx) 验证四场景不自动执行、路径选择、规则开关、目标与 Priority 编辑、快照重播、重置、折叠卡片、键盘循环、切换服务后清理计时器及 WAF 回归。

[CloudFront 引擎测试](../src/services/cloudfront/cloudfrontEngine.test.ts) 覆盖首次Miss/随后Hit、不续期、源站更新后的旧缓存、TTL精确边界、语言键碰撞与隔离、Behavior选择、禁用缓存、TTL编辑、按路径/语言失效、输入不变性、快照、手动时间、非法配置及六场景独立性。[CloudFront 组件测试](../src/components/CloudFrontPlayground.test.tsx) 覆盖场景仅准备状态、Hit/Miss/过期、语言键、API与图片差异、策略编辑、Invalidation、动画/暂停/重播、知识卡与设置展开、快捷键、重置及三服务切换清理。原 WAF / ALB 测试继续运行。

[文档生成器测试](../scripts/docs.test.mjs) 验证重复构建字节一致，以及缺失本地链接、章节锚点、代码标识和过期文件树会失败。GitHub CI 执行相同检查；独立 Pages workflow 仅在 main 更新后构建并部署。

jsdom 不计算真实布局，也不播放 CSS。组件测试验证当前事件与渲染状态的对应关系；桌面和手机视觉仍需可用浏览器检查。减少动画偏好会关闭 CSS 动画，保留步骤与文本。

[文档脚本](../scripts/docs.mjs) 检查仓库所有 Markdown 链接、本地文件、章节锚点、`code-ref` 指定的 AST 标识及实际文件树。外部 HTTP 链接只检查格式，不进行网络可用性检查；AST 标识存在不代表说明正确，维护者必须人工检查代码流程。

## Developer Guide 维护与发布

[AGENTS.md](../AGENTS.md) 是长期规范，[README](../README.md) 使用日语提供用户入口、本地运行、WAF / ALB / CloudFront 功能、验证及发布说明，不记录修订过程；本指南继续使用中文。每次代码变更评估文档影响，同步更新此 Markdown、流程说明与文件树，然后执行文档和项目检查，再把代码、测试及 Markdown 一起提交。

```bash
npm run docs:check
npm run docs:build
```

文档含独立章节导航、SVG 架构与执行流程、代码高亮、深浅主题和响应式布局。主题仅保存在浏览器 localStorage，失败时不影响阅读。HTML 中源码链接指向长期维护的 main 分支；本 feature 合并前 main 尚不包含新组件。

## GitHub Pages 发布

已有 checks.yml 保留质量检查，新增 pages.yml 只监听 main push，不接受 feature 或 PR 部署。build job 执行测试、类型检查、Vite 与文档构建及文档检查，上传整个 dist；deploy job 仅获得 pages:write 和 id-token:write，使用 github-pages environment 和官方 deploy-pages action。发布串行执行，避免取消正在部署的任务。

真实远程仓库为 RongRongRabbit/awsflowlab，Vite base 固定 `/awsflowlab/`。App 根入口保持 dist/index.html，资源为 /awsflowlab/assets/，指南为 dist/developer-guide/index.html，App 链接指向 /awsflowlab/developer-guide/，指南通过 ../ 返回 App。使用 `npm run preview` 时也访问 /awsflowlab/。

维护者需在仓库 Settings → Pages → Build and deployment 选择 GitHub Actions，并检查 Actions 权限、github-pages environment 是否仅允许 main（如有审批需人工通过）。WAF 与 ALB 已部署并完成 HTTP 与资源检查，公开入口见 README；新增 CloudFront 需合并对应 PR 后由 main 的 workflow 发布，不在 feature 分支直接部署。每次部署成功后应复核 HTTP、资源及可用浏览器的交互。公开产物不应包含凭据；项目没有 AWS/API 客户端或环境配置需求。不要在前端或 VITE_ 变量中存放密钥。

## 扩展方向与边界

WAF 的 Condition 只有 attack / all；新增 SQLi 等类型时扩展 Condition 联合类型和 matchesCondition，并加入测试与日语样本解释。Managed Rules、Label、CloudFront 联动需独立建模，不要通过硬编码动画模拟评估结果。复杂条件会需要递归表达式；当前快照复制对现有扁平对象足够，扩展嵌套数据时改为深复制。

未实现真实 HTTP、真实威胁识别、AWS API、持久化、Rule Group、CAPTCHA、Label、Managed Rules、指标服务。没有 LLM 或付费 API。WAF 提供两条固定条件规则，ALB 提供三个固定路径规则，CloudFront 提供三个固定路径及对应缓存策略；可修改各服务支持的配置，不能任意创建规则或资源。
