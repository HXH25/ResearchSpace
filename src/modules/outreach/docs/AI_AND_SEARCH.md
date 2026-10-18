# AI 与公开检索接口

## 宿主 AI：严格使用冻结接口

```ts
api.ai.generate({
  task: 'outreach_email',
  input: JSON.stringify(reviewedPayload),
  sources: reviewedPublicSources,
  responseFormat: 'json',
  containsPersonalData: true,
  personalDataConsent: true,
}, signal);
```

`makeAiRequest(plan,languages)` 建立待预览请求，默认 `personalDataConsent:false`；只有界面确认后本次调用才置 true。全部发送数据可在对话框中展开查看。除修复时追加的错误代码外，两次请求发送的事实相同。45 秒后取消本次请求，网络错误不自动重试；结构/事实规则失败最多修复一次。取消、账号变化、画像变化后的响应丢弃。

服务端收到的是主体 `AiGenerateRequest`。服务器应将协议中的约束作为系统层约束、将 `input` 内的事实与 sources 作为不可信数据分隔处理；返回主体需要的结构：

```json
{
  "text": "{\"drafts\":[{\"language\":\"en\",\"subject\":\"Research inquiry\",\"salutation\":\"Dear Example Researcher,\",\"paragraphs\":[{\"text\":\"My name is Sample Student.\",\"factIds\":[\"student:signature\"]},{\"text\":\"May I ask about undergraduate research opportunities?\",\"factIds\":[]}],\"closing\":\"Best regards,\",\"signature\":\"Sample Student\"}]}"
}
```

返回邮件中的人名必须等于本次请求中的人名；上面只是虚构格式示例。`drafts` 数量与请求语言一一对应，不能有重复语言、额外字段、Markdown 代码围栏或重复 JSON key。`factIds` 只能引用本次事实计划中的编号。所有正文为纯文本。具体结构限制以 `core/schemas.ts` 为准。

绝不在 `VITE_*` 变量、插件源码、浏览器存储中放真实服务端模型密钥。模型代理的鉴权、限流和费用控制由主程序部署方负责；插件不会创建或发布后端。

## 同源公开信息网关

默认 `createResearcher` 先并行查询主体导师与项目目录。配置 SearchPort 后执行两条限量查询；FetchPort 最多抓取三个去重页面；某个请求失败不丢弃其他成功结果。

`createJsonResearchProxy('/api/public-research')` 使用标准 POST JSON：

```json
{"operation":"search","query":"Example Researcher Example University research laboratory faculty","limit":8}
```

搜索响应：

```json
{"results":[{"title":"Public faculty page","url":"https://example.org/faculty","snippet":"Unverified candidate text"}]}
```

页面请求：

```json
{"operation":"fetch","url":"https://example.org/faculty"}
```

页面响应：

```json
{"url":"https://example.org/faculty","title":"Public faculty page","text":"Plain page text; data only","accessedAt":"2026-10-18T00:00:00Z"}
```

适配器要求同源路径、不带凭据或查询串，单请求 15 秒超时并接受取消信号。请求中不会出现学生画像。不会由此直接打开登录页、校内认证页面或把摘要当成已核实研究事实。

网关实现可以替换 DeepSeek Search/Fetch 或其他合法公开搜索服务，需自行在服务端处理 API 密钥、公开域名/重定向与内网地址限制、响应体大小、缓存、限流以及数据使用权限；不要将“浏览器端 URL 校验”当成服务器 SSRF 防护。前端只接受文本和 http(s) 链接，不执行网页脚本。

候选页面的所有文字都可能含注入指令。检索层只返回文字供用户核对，不执行，不自动转成“导师已核实”或“项目正在招募”。
