# HTTP API v1.0

基础路径与网页同源。错误为 `{"error":"说明"}`。UTF-8 JSON。无跨域 CORS 通配授权。推荐不保存请求体；不要在查询词中包含个人资料。

| 方法 | 路径 | 输入 | 输出/授权 |
|---|---|---|---|
| GET | /api/health | 无 | ok、version、private_mode |
| GET | /api/stats | 无 | total、public、private、open、reviewed、sources |
| GET | /api/projects | q、kind、region、source_id、institution、status、page、page_size | items、total、page、page_size、scope、global_coverage_complete=false |
| GET | /api/projects/{id} | 记录 ID | 项目详情；越权私有记录返回404 |
| POST | /api/recommend | profile 与可选 filters | 分页项目，每项附 match |
| GET | /api/sources | 无 | 来源列表、配置和各来源记录数 |
| POST | /api/collect | source_id、query、max_pages、reset | 202 + job；管理员 Bearer |
| GET | /api/jobs | 无 | 最近30项任务；管理员 Bearer |
| POST | /api/import | projects、visibility、confirm_public | 新增/更新/未变化计数；管理员 Bearer |
| GET | /api/export | 无 | schema_version、全部公开 projects；永不包含私有记录 |

`Authorization: Bearer <RESEARCHSPACE_ADMIN_TOKEN>` 只用于管理接口。搜索和推荐公开可读，但公开模式中永远不包含私有记录。导入默认 private；公开导入需 visibility=public 且 confirm_public=true。推荐 `filters.hide_conflicts` 是 JSON 布尔值，默认 true。

每IP每60秒最多120次 HTTP 请求，body 上限20MB，项目数组上限20000。分页最大100条，默认12。错误400/401/403/404/413/429；无效采集来源与已经运行的任务返回400。单次采集1–50页，任务错误保存在 jobs 内，不抛弃已有成功结果。

POST 示例：

```json
{
  "profile": {"institution":"清华大学","degree":"bachelor","interests":["机器人"],"skills":["Python"]},
  "filters": {"page":1,"page_size":12,"hide_conflicts":true,"kind":"project"}
}
```

推荐分数的服务端字段为 `match.score`、`match.components`、`match.reasons`、`match.conflicts`、`match.unknowns`、`match.preparations`、`match.eligibility`。查询参数 q 中空白/中英文逗号分开的词默认 AND；词表支持部分中英别名。
