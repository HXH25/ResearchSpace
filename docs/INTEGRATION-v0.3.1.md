# ResearchSpace v0.3.1 — GitHub 公开数据清理版

此公开发行基于 v0.3.1，**不包含任何原始校内 SRT 项目数据**，保留原有的完整导入、搜索、筛选、推荐、详情、邮件交接 API 与 UI。

## 数据边界

- 初始 SRT 数据：0 条。原始索引、项目详情 CSV/JSON、SQLite、统计/校验和、QA 项目截图均已删除。
- 初始公共科研项目：7 条（`research_module/data/public_seed.json`）。
- 教师官网记录：4,026 条，保留公开研究来源；数据库中 SRT 项目编号、链接表内容及统计信息已经清空。相关链接接口仍存在，默认返回空列表。
- 导入私有 SRT：用户自行选择 ZIP 或 JSON，经 `POST /api/import/srt` 写入当前账号 `.runtime/`，不会出现在源码目录或公共导出中。
- `data/thu_srt/` 只保留数据结构描述、CLI 查询工具和导入说明。没有需要启动时读取的数据文件。

## 接口

保留 `GET /api/projects`、`POST /api/recommend`、`GET /api/projects/{id}`、`GET /api/faculty/{faculty_id}/projects`、`GET /api/sources`、`POST /api/import`、`POST /api/import/srt` 及研究联系邮件的全部现有边界。SRT 教师/学生立项筛选在没有用户导入记录时返回零条。

## 开发环境和配置

不包含工作电脑的绝对路径、实际密钥、个人浏览器本地数据、运行期 SQLite 或内部 QA 截图。使用 Python 3.11+ 执行 `start-windows.cmd`；源码构建需要 Node.js 22.12+ 与 `npm ci && npm run build`。

已更新测试以验证空 SRT 初始化、私有导入和账户隔离；构建/测试以当前实际运行输出为准，不沿用旧版包含 SRT 数据的验证统计。
