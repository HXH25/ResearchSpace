# 统一集成接口 v0.2.0

## 合并来源

- 宿主：ResearchSpace_Host_v0.1.3_Complete_Source。
- 导师：ResearchSpace-Complete-2026-10-18 中的 faculty 模块。
- 邮件：outreach-module-v2.1.0，保留事实校验、逐次授权和草稿保存。
- 科研搜索：ResearchSpace_Search_Recommendation_v1.0 的 model / matching / store / collectors / network / importers。

冻结的 `sdk/contracts.ts` 和 `src/sdk/contracts.ts` 保持 0.1.3 原样且字节一致，CONTRACT_VERSION 仍为1.0.0。账号私有项目 Provider 在宿主装配时绑定，SDK 本身没有增加隐式当前用户参数。

## 分层

- `server/presets.py`：服务商默认配置与官方文档入口。
- `server/settings.py`：用户隔离、内存密钥与可选 Fernet 保留。
- `server/providers.py`：AI 与搜索请求适配、响应归一化、大小限制与脱敏错误。
- `server/projects.py`：原科研引擎与宿主画像/机会合同的映射。
- `server/app.py`：FastAPI 路由、本地边界与 dist 静态文件服务。
- `src/integrations/client.ts`：同源调用和用户服务状态；不保存 provider key。
- `src/integrations/projects.ts`：响应验证及按用户绑定的目录 Provider。
- `src/app/components/ServiceSettings.tsx`：主分类与服务商两层选项卡，独立密钥表单。
- `src/modules/opportunities/module.tsx`：推荐、搜索、详情、收藏、邮件交接。

## 本地请求约定

除 `/api/health` 和 `/api/presets` 外，应用请求带 `X-ResearchSpace-User` 与 `X-ResearchSpace-Token`。浏览器为每个账户生成256位随机本地凭据，独立存储在 IndexedDB serviceCredentials 表，不进入画像导出。后端用二者的 SHA256 作为配置与数据目录的 scope。知道一个用户 UUID 不足以访问其配置。此机制用于本机账户隔离，不是学校/云端身份认证。

| 路径 | 用途 |
| --- | --- |
| GET /api/presets | AI、搜索、官方数据源预设，不含密钥 |
| GET /api/settings | 当前账户配置；密钥仅以 has_key/ready 状态表示 |
| PUT /api/settings/{ai或search}/{provider} | 保存服务配置，make_active 控制是否设默认；空 key 保留旧值 |
| DELETE /api/settings/{kind}/{provider}/key | 删除内存与加密密钥 |
| POST /api/settings/{kind}/{provider}/test | 使用已保存的该服务发起极小真实请求 |
| POST /api/ai/generate | 原 HostApi AiGenerateRequest，返回 text/mode/provider/createdAt |
| POST /api/search | {query,limit} → {results:[{title,url,snippet}],provider,searched_at} |
| POST /api/research | {operation:fetch,url}，HTTPS公开页面摘录，受robots/DNS/大小限制 |
| GET /api/projects | 目录筛选、分页，含规范化 contract 字段 |
| POST /api/recommend | {profile,filters}，本机可解释推荐 |
| GET /api/projects/{id} | 当前用户可见项目详情 |
| GET /api/sources、GET /api/jobs、POST /api/collect | 原来源适配器与本地采集任务 |
| POST /api/import | {projects:[…]}，保存到当前账号私有项目库 |
| POST /api/import/srt | 原始 ZIP/JSON bytes；X-Filename 表示后缀 |
| GET /api/export | 仅公开项目；私有SRT不在其中 |
| DELETE /api/account | 删除当前连接对应的服务配置与导入数据；有采集任务时拒绝删除 |

自定义 AI 采用 OpenAI Chat Completions 协议；自定义搜索采用 POST JSON `{query,limit}`、Bearer key，返回 `{results:[{title,url,snippet}]}`。AI Base URL 不包括 `/chat/completions`。Claude 使用独立 Messages 协议。没有自动回退到其他付费服务，也没有重试可能收费的模型调用。

## 数据边界与兼容

所有 key 只发给本机服务，由服务端调用用户选择的 provider。更改已保存服务地址时必须重填 key，防止旧密钥被默默转发到新地址。下游错误正文、验证错误输入不会回传给页面。保持TLS校验，拒绝自动带认证头跟随重定向。

SRT 导入仍使用原 source identity 去重；资格和招募状态分别映射，资助记录不自动映射为开放岗位。项目到邮件使用既有 opportunityId 与 HostCatalog，沿用邮件模块的来源和资格人工核对。

保留的独立搜索包文档是历史参考，其旧管理员令牌与旧启动方式不用于当前统一应用。现行配置以本文件和 README 为准。
