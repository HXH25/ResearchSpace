# ResearchSpace GitHub 公开版数据清理说明

本版本从用户提供的 `ResearchSpace_v0.3.1_Full(2).zip` 清理得到；不包含原始压缩包的任何 Git 历史。

## SRT
- 删除校内完整 SRT 项目 JSON/CSV、索引、SQLite、覆盖率和校验文件，以及包含真实 SRT 记录的 QA 截图。
- 清空教师 SQLite 中 550 份资料的 `srt_project_ids` 字段，及 SRT 导师匹配表和 SRT 项目关联表（保留空表结构）；清除单位中的 SRT 统计字段和 SQLite 空闲页残留。
- 删除旧报告中的 SRT 项目计数、原始编号和关联结论，更新当前前端说明。
- 保留导入契约、数据字典和字段表结构。项目由用户自己在本地导入；初始 SRT 项目数 0。

## 开发电脑
- 删除原有 Windows 平台、QA 截图、浏览器运行环境报告等开发机验证产物。
- 修改文档中固定的本地盘符路径为通用占位符，移除临时沙箱绝对路径。
- 只保留 `localhost` / `127.0.0.1` 这样的应用本机服务地址：这是产品工作原理，不是开发电脑的私人地址。
- 不包含 `.git` 历史、`.env`、`.runtime`、浏览器数据、真实 API key 或账户数据库。

## GitHub 提交边界
- `.gitignore` 明确禁止 SRT 数据、账号运行目录、密钥、缓存和机器特定文件入库。
- `dist/` 保留可运行的预构建前端；不使用 npm 也可以通过 `start-windows.cmd` 启动。
- 本包可提交到全新的 GitHub 仓库。**不要**复用此前曾包含不宜公开数据的 Git 历史。

## 当前版本实际检查

- 后端 Python 测试：`python -m pytest tests research_module/tests -q`，**68 passed**。
- 附带 JS 资源：通过 `node --check` 语法检查，旧版 SRT 内置数量说明已同步修改。
- 公开教师 SQLite：`PRAGMA integrity_check = ok`，教师记录 4,026，SRT 匹配 0，SRT 关联 0。
- 全部实际 SRT 数据 JSON/CSV/SQLite 已从发行包移除，原始 SRT 项目 ID/标题指纹扫描未发现残留。
- 前端源码的全量 `npm ci && npm run build` **未在此环境完成**：npm 依赖包未完整缓存，无法重新编译；沿用的预构建 JS 仅修改了两处公开版文案并进行语法检查。**因此未声称前端构建及浏览器 E2E 已重新验证。**
- 开源前请再次核对 README、许可和是否具有公开教师数据的再分发权。
