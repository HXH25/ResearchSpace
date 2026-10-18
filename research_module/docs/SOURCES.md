# 来源与扩展

## 已查阅的官方依据（2026-10-18）

- NIH API 官方字段、offset/limit 与访问频率说明：https://api.reporter.nih.gov/
- NSF 官方开发资源：https://www.nsf.gov/digital/developer
- NSF 官方 API 文档入口：https://resources.research.gov/common/webapi/awardapisearch-v1.htm （文档入口读取返回403；适配器另以实际 API 响应检验）
- HKUST 项目列表：https://urop.hkust.edu.hk/projects
- HKUST 通用资格：https://urop.hkust.edu.hk/For_Students
- ETH 申请说明：https://inf.ethz.ch/studies/summer-research-fellowship/how-to-apply.html
- ETH 计划介绍：https://inf.ethz.ch/studies/summer-research-fellowship.html
- EPFL 计划：https://summer.epfl.ch/
- 清华公开渠道：https://www.tsinghua.edu.cn/gjhz/info/1088/2769.htm

七条初始记录均含对应官方页面链接；四条 HKUST 的原始研究标题和导师保留，研究内容用简短中文整理。资助 API 返回的 PI 应视作项目负责人，不能认定为愿意接收学生的导师。页面阅读日期不代表机构修改日期。

## 新增公开高校来源

配置示意（示例域名不能直接采集）：

```json
{
  "id": "your_university",
  "name": "某高校公开科研项目",
  "type": "web",
  "allowed_hosts": ["research.example.edu"],
  "urls": ["https://research.example.edu/opportunities/"],
  "index_urls": ["https://research.example.edu/opportunities/"],
  "follow_prefixes": ["/opportunities/"],
  "institution": "某高校",
  "region": "中国大陆",
  "field_labels": {
    "description": "研究内容",
    "period_text": "研究周期",
    "team": "项目组信息",
    "eligibility_text": "申请条件",
    "application_method": "申请方式"
  }
}
```

字段标签解析只适用于独立标题节点；不是通用 AI 网页理解。先采样检查 HTML，再写/测试专用适配器。动态 JavaScript、PDF、验证码、登录页不在当前解析范围；应使用官方公开数据导出或人工整理标准 JSON。模板爬虫自动输出 lead、reviewed=false，不擅自确认招募。要保留精确的导师/周期，请在专用适配器中按实际结构解析。

队列最多保存50000条待访问链接；大型站点应拆分来源配置以控制规模。不要使用过宽前缀追踪整站；记录数量代表已入库数，并不代表来源总条数。`exhausted` 仅涵盖本次查询/发现的链接，不证明站点不存在其他未发现页面。

HKUST 列表当前资格要求本校全日制学位学生并已完成两个学期；页面还按不同UROP课程给出成绩及进阶要求。代码不将其他国家、地区或学校学生自动认定为可申请；用户需查完整通用规则。

## 网络与失败

- HTTPS 主机白名单、拒绝用户信息与非标准端口、最多3次重定向；重定向再次验主机。
- 直连时检验解析出的每个 IP 均为公网，并固定连接到已校验 IP、按原主机名验证 TLS。
- 支持管理员配置 `RESEARCHSPACE_HTTPS_PROXY` 或标准 `HTTPS_PROXY`。代理模式由可信代理解析 DNS，仍校验目标 HTTPS 主机白名单；代理应落实公网出口限制。
- 每主机至少1.1秒间隔；读取超时12秒；单响应最多8MB；429/5xx与瞬时网络错误有限重试。
- HTML 访问先读 robots；无法读取时保守暂停，robots 404视为无规则；拒绝规则不绕过。
- 失败不改旧记录、不伪造完整采集；成功页即存游标。解析标签或API结构变化会明确报错。
- 普通 API 的429重试当前使用1/2秒退避而非 Retry-After；长期大规模采集可扩展这一点。

人工审核标准记录后可使用同一 source_id/source_record_id 重新导入覆盖。自动重新抓取会将该条降为未审核；历史版本仍在 history 表中。公开传播前须按来源条款判断文本再分发范围，不因能抓取就视为获得无限授权。
