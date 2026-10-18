# SRT 数据导入接口（无内置项目数据）

**此公开发行包不包含任何校内 SRT 项目记录**：没有项目详情、项目索引、项目数据库、立项人资料或关联编号。新用户启动后的 SRT 项目数为零。

保留的只有字段说明 `data_dictionary.json`、可选的表结构 `schema.sql`、数据库查询工具 `query.py` 和已有的前后端导入接口。`query.py` 需要用户自己提供的 SQLite 文件；未提供时不会自动创建带数据的数据库。

## 如需使用自己有权限使用的 SRT 数据

运行 ResearchSpace，打开“设置与隐私 → 数据源与 SRT → 导入 SRT ZIP / JSON”。支持导入包含唯一 `project_details.json` 的 ZIP，或者项目对象组成的 JSON 数组。导入后的记录写入本机当前账号的私有数据目录 `.runtime/`，不会加入仓库或公共导出。不要在提交代码时复制私人数据库、登录信息或导入文件。

接口保持：`POST /api/import/srt`，认证、字段映射、项目筛选（teacher/student）、搜索、推荐、详情、邮件交接均保留。直接执行 `research.importers.srt_records` 也可把用户自己的 SRT 文件转换成标准项目记录。

**使用、导出和传播校内资料前，请自行确认相应权限。**
