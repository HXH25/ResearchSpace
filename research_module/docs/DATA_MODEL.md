# 数据模型 v1.0

每条项目记录保存在 SQLite 的 `projects.payload` JSON 中，`id / visibility / source_id` 独立索引。`history` 保留每次覆盖前的版本；`state` 保存采集游标；`jobs` 保存采集结果。画像不在数据库内。

| 字段 | 类型 | 含义 |
|---|---|---|
| id | string | 服务端按 source_id + source_record_id 生成 SHA-256 前24位 |
| title / description | string | 标题、研究内容；网页正文片段不自动当成研究摘要 |
| institution / department / region | string | 机构、院系、地区 |
| kind | enum | project / program / funded_research / funding_call / lead |
| mentors | string[] | 官方明确的导师或 PI 名称；资助记录 PI 不保证招学生 |
| mentor_background / team | string | 导师背景、公开项目组介绍；未公布保留空字符串 |
| period_text | string | 原文周期说明，能保留“暂定”“年度惯例”等不确定性 |
| start_date / end_date | ISO date or empty | 项目/资助日期，不自动作为学生必须参与的日期 |
| required_start / required_end | ISO date or empty | 仅当公告明确要求学生全程在场时填入，参与硬条件核对 |
| deadline | ISO date or empty | 明确的申请截止日；不从年度惯例生成 |
| eligibility_text | string | 官方资格原文或明确标注的简要整理 |
| required_institution / excluded_institution | string | 本校限定或本校排除要求 |
| allowed_degrees | string[] | 明确支持的学历，bachelor / master / phd |
| min_year / min_hours | number or null | 当前年级/每周小时的明确要求；“开始时年级”不直接填当前年级 |
| required_language | string | 工作语言；不推断语言成绩要求 |
| application_method / application_url | string | 申请步骤、官方申请说明或入口 |
| status | enum | unknown / open / closed / upcoming / rolling，原始已整理状态 |
| effective_status | enum | API 动态派生；过期核验会降级，见下 |
| source_status | string | 来源原文状态，例如校内采集时的“报名中” |
| status_verified_at / status_evidence | string | 招募核对日及依据；只有采集日不够 |
| reviewed | boolean | 是否经过人工核对；自动采集默认 false |
| tags / skills / work_types / goals | string[] | 有依据的研究主题、技能关联及参与方式 |
| visibility | enum | public / private |
| source_id / source_record_id / source_url | string | 来源注册 ID、原生记录 ID、官方链接 |
| collected_at | ISO timestamp or date | 实际采集/核对时间 |
| evidence | object[] | field、url、checked_at、method、可选 excerpt |
| warnings | string[] | 资格/周期/来源边界等提醒 |
| missing_fields | string[] | API 动态派生的关键缺失字段 |

空字符串表示未填入可靠信息；空数组表示没有可靠条目。不会自动补全导师、团队、周期、名额或申请步骤。

招募状态：明确截止已过 → closed；funded_research / lead → unknown；没有人工核对、证据或最近30天内的有效核对日期 → unknown。其余返回保存的状态。日期按服务器日期判断，正式部署应设置合适时区；精确到小时及跨时区截止日期目前没有实现。`rolling` 不等于确认有名额；旧 `closed/upcoming` 同样会过期为 unknown。

返回的 `match` 中 eligibility 仅有 `conflict` 与 `needs_check`，不自动声称所有资格已满足。分数按当前有限词表计算，未做结果校准。推荐没有随机性。原生 ID 相同才直接覆盖；跨来源同名对象保留，防止误合并。

统一导入必须有 title、source_url；其他字段允许缺失。未知顶层字段不会入库，请通过 evidence/warnings 保存必要说明。每批全部验证成功才事务写入。重跑采集会更新 collected_at；因时间字段不同可能产生历史版本，这是可追溯设计，不是新增重复项目。
