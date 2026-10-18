# 导师探索 · 正式数据版

本模块随 ResearchSpace v0.3.0 集成运行，SDK 1.0.0 保持兼容。

- 清华官网教师数据：`data/thu_faculty/faculty.sqlite`，4,026 条来源记录；可能一人多页，不按姓名合并。
- `/api/faculty` 支持分页、姓名/单位/研究关键词、领域和招募状态筛选、别名与模糊搜索。
- `/api/faculty/{id}` 读取真实详情，保留来源、采集时间、目录关联、信息缺口和历史 SRT 编号。
- OpenAlex 按主题从论文发现作者，或按姓名检索作者；Key 在宿主设置与隐私中配置。
- OpenAlex 结果缓存到当前账户，收藏和邮件助手能重新读取；不会替换同名的清华记录。
- 正式数据的招募状态保持未知，直到有独立的近期招募证据。
- HTTP 客户端与 HostCatalog Provider 位于 `src/integrations/faculty.ts`，由宿主按账户绑定。
- 旧虚构资料仅用于 `__tests__` 测试；生产模块不导入演示仓库，不在请求失败时回退到虚构资料。

从项目根目录运行 Python 服务；前端修改后执行 `npm run build`。详细配置与测试见根目录文档。
