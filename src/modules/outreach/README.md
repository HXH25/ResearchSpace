# ResearchSpace 套瓷邮件模块 v2.1.0

本包是可直接安装到 ResearchSpace 的完整 `outreach` 插件，已基于 **ResearchSpace Host v0.1.2、冻结协议 1.0.0** 开发和联调。它替代早期独立 Python 演示包的前端业务用途，不需要第二套账号、数据库或服务器。

## 安装与启动

1. 打开已有的 ResearchSpace 主体根目录，即包含 `package.json` 的目录。
2. 将 `outreach-module-v2.1.0.zip` **直接解压到该根目录**。最终入口应是 `src/modules/outreach/module.tsx`，不要多套一层文件夹。
3. 主体尚未安装依赖时运行 `npm install`；已有依赖无需添加新包。
4. 运行 `npm run check`，然后 `npm run dev`。创建/选择本地账号并完成画像后进入“科研联系邮件”。

Windows PowerShell 示例：

```powershell
Set-Location '<your-local-project-directory>'
Expand-Archive -LiteralPath '.\outreach-module-v2.1.0.zip' -DestinationPath '.' -Force
npm install
npm run check
npm run dev
```

沿用主体 Node >=22 环境与其依赖管理。这个功能包不覆盖 `src/sdk`、`src/app`、`src/ui`、根级配置、其他模块或环境变量。部署时沿用主体的 HashRouter 与托管方式。

## 已完成的功能

- 从宿主画像选择并确认实际用于邮件的字段；学校默认值、兴趣、证据经历、时间、署名均可核对，不把技能问卷当作科研成果。
- 按姓名与机构查询 `HostCatalog` 导师/项目目录；支持 `facultyId`、`opportunityId` 深链接；目录缺失或查询失败时可以手动填写。
- 姓名、机构与公开主页由用户核对，保留同名候选，不自动将其合并。研究信息需有来源且经用户确认才进入事实计划。
- 支持科研咨询、正式项目申请、资格咨询、准备材料、公开活动和跟进六类目的；跟进需要确认既往联系日期。
- 中文、英文、德文、日文、法文的本地结构化模板；语气和长度可选，多语言共用一次事实计划，切换已有草稿不重新查询。
- 论文阅读分为看过介绍、读过摘要、通读全文、实际复现；分别生成相应措辞。
- 收件人、主题、称呼、正文、结束语、署名可查看；生成后编辑邮件，复制或导出 `.txt`。材料只列名称与可提供意愿，不伪称已附或已发送。
- 当前账号下保存、读取、重命名、删除草稿；手动标记准备中、已发送、已回复、不再联系。存储只经过 `api.storage`，实际由主体 IndexedDB 实现。
- 独立 `DefaultPanel`：无诊断时不显示入口；初始折叠；同一任务追加信息保持展开状态；新任务收起并清空旧诊断。查询故障详情只放在此面板内。
- AI 走宿主 `api.ai.generate`，每次调用前展示全部发送资料并要求当次勾选；输出严格 JSON；最多一次修复；每次请求 45 秒超时；失败保留原草稿。
- 账号、画像版本或深链接改变时，清空未保存编辑区与待授权数据并取消旧任务；旧请求即使迟到也不能进入新账号界面。
- 接受绑定当前画像的科研项目交接，分别检查联系许可、官方联系人、申请资格和招募状态。

## 实际联网能力与配置

默认即可使用**本地模板、手动资料、已安装目录 Provider 和宿主存储**。

AI 使用主体已有的 `VITE_AI_PROXY_URL`。在可信服务端配置模型与密钥，按主体 `AiGenerateRequest` 接收请求并返回 `{ "text": "结构化 JSON 字符串" }`。前端不需要也不接受模型密钥。请求与返回规范见 [docs/AI_AND_SEARCH.md](docs/AI_AND_SEARCH.md)。没有模型服务时本地功能完整可用。

公开搜索/网页抓取提供了独立的 `SearchPort`、`FetchPort` 和可运行的同源 HTTP 适配器；**没有预设任何付费搜索账户，也没有内置 DeepSeek 服务端**。默认查询真实来源取决于主体安装的导师/项目 Provider。要使用外网搜索，把已有可信网关接入两个端口即可，示例见 [examples/replacement.ts](examples/replacement.ts)。搜索只发送导师姓名、机构和公开主页，不发送学生画像。它收集候选链接和页面摘录，身份与事实仍需核对。

## 项目申请检查

“方向相关”“用户符合资格”“当前正在开放”“允许直接邮件联系”分别处理。

- 没有项目：可以普通科研咨询，不能作为正式项目申请。
- 普通 SDK 项目记录没有详细联系政策：需用户根据列出的官方来源核对邮箱、许可和资格。该核对标为**用户确认**，不伪装独立认证。
- 使用详细交接：按 `contactGate`、`contactPolicy`、允许 route、联系人证据和资格结论检查；`portal_only`、`no_direct_contact`、禁止联系、错账号、错版本、错项目均拒绝。
- 正式申请还要求非演示项目、`status === 'open_confirmed'`、90 天内的 `statusVerifiedAt` 和官方来源。若有截止时间，必须有明确偏移量和 `deadlineTimeZone`，且未过期；若有开始时间，必须已开始。
- 交接有效期为 7 天；截止时间或缺失的交接 status 不会被解释为“默认开放”。

协议封装与可直接复用的包装函数见 [docs/HANDOFF.md](docs/HANDOFF.md) 和 [examples/handoffEnvelope.ts](examples/handoffEnvelope.ts)。

## 可替换边界

| 职责 | 默认实现 | 替换点 |
|---|---|---|
| 公开检索与页面读取 | `providers/research.ts` / `jsonResearchProxy.ts` | `search`、`fetch`、`researcher` |
| 事实计划 | `core/plan.ts` | `planner` |
| 本地生成 | `core/template.ts` | `template` |
| 结构与约束检查 | `core/validate.ts` | `validator` |
| 账号内草稿存储 | `core/storage.ts` | `repository` |
| 模型服务 | 主体 `api.ai` | 主体统一代理 |
| 查询详情展示 | `components/DefaultPanel.tsx` | 独立 React 组件 |

`createOutreachModule(overrides)` 注入这些实现，默认导出仍是冻结 `ResearchModule`。公开纯函数 `buildEmailDraft(input, language)` 返回 `subject`、`body`、`attachmentSuggestions`、`caveats`，并附带结构化 `payload` 与事实 `plan`。组件不承担抓取与存储实现。

运行时依赖仅使用主体预置的 `react`、`react-router-dom`、`lucide-react`、`zod` 和浏览器标准 API；测试沿用主体的 Vitest 与 Testing Library。无需直接导入别的功能模块。

## 需要理解的边界

- 邮件不会自动发送；“已发送”只是用户手动记录。此工具没有 SMTP、Gmail 或群发接口。
- 本地模板的语言骨架已本地化，自由填写的经历、研究摘要、学校名等保留原文；英文或其他语言的完整自然翻译需人工修改或经授权调用 AI。
- 规则校验可以拒绝错误字段、未知事实编号、部分夸大、假附件和数字等，**不能证明每句生成文本都被证据逻辑蕴含**。所有最终邮件仍由用户核对，特别是 AI 翻译和手动改写。
- 用户手动编辑后显示“原生成检查不涵盖修改内容”。保存的是当前内容和原始事实快照；旧画像草稿打开时提示版本差异。
- 草稿单账号最多 200 封。支持 Web Locks 的浏览器会串行化跨标签页写入；不支持时，请避免同一账号在多个标签页同时编辑同一份草稿。
- 草稿格式损坏或账号不符时拒绝覆盖原数据。系统日志/诊断不显示原始异常、模型失败输出、凭据或完整画像。
- `fixtures/catalog.demo.json` 全部为虚构数据，未在生产入口自动加载。测试中模拟“官方开放”仅用于分支验证，不是真实科研机会。

测试记录与尚未实测事项见 [docs/VERIFICATION.md](docs/VERIFICATION.md)。本次开发状态见 [MEMORY.md](MEMORY.md)。
