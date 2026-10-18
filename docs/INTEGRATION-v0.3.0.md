# ResearchSpace v0.3.0

## 真实数据库

`data/thu_faculty/faculty.sqlite` 来自用户提供的 THU_faculty_research_2026-10-18.zip，保留原始数据库、说明、字典、摘要和来源校验资料。只读取 faculty_profiles 中的 4,026 条已收录来源记录，不把待核验候选混入目录。原包的“核验”是自动结构/身份证据检查及抽查，不是逐条人工核验、全校覆盖证明或当前在职认证。

没有邮箱、论文、团队或招生证据时保持缺失。院系来自 primary_unit；发现资料的目录另列，不能当作正式任职。研究领域分类用于导航与本地兴趣匹配，是系统关键词分类。原始研究方向与证据片段在详情中展示。

科研机会读取公开项目 SQLite 与当前账户导入库，不使用虚构记录。发行包带 7 条公开来源种子记录。公开发行中的教师数据库已移除原始 SRT 关联编号。SRT 项目须由用户自行导入有权限使用的数据；对应项目、导师和邮件接口继续存在，但没有预置的强关联记录。同名记录不合并。

## 搜索服务

在“设置与隐私 → 搜索服务 → OpenAlex · 学术搜索”填写自己的 API Key，Base URL 为 `https://api.openalex.org`。“仅保存”即可用于导师 OpenAlex 搜索；“保存并设为默认”还会让通用联网搜索使用它。每家服务独立保存，沿用内存密钥/可选本机加密与账号隔离。

- 导师本地库：无需搜索 Key；姓名、单位、方向、片段、中英文常见别名、多关键词 AND 和受限错字匹配。
- OpenAlex 姓名：GET /authors，显示作者及学术记录中的机构信息，不据此认定导师职务。
- OpenAlex 研究主题：GET /works，从命中论文选取第一/末位/通讯作者作为探索线索，不推断指导关系。结果总数是论文数，每页作者数单列。常见中文主题转换为英文检索词并在页面显示实际检索词。
- 科研机会联网搜索：可使用默认网页服务，或明确选择 OpenAlex；后者只返回论文线索，保存后 kind=lead、status=unknown，仍需核实招募公告。

本地模糊搜索优先准确匹配；支持至少 4 字母英文词的近似拼写，以及至少 4 个汉字的单字替换。不对两个字的姓名进行错字匹配，不是向量语义搜索或任意拼音搜索。OpenAlex 搜索依赖其上游检索规则。

OpenAlex 请求经本机后端发出，Key 用官方 api_key 参数传递，不返回浏览器、不写访问日志、不进入画像备份。资料缓存存于当前账户目录的 faculty_cache.sqlite；缓存属于此前取得的资料，不宣称实时更新。请求失败不会换用虚构数据或自动切换付费服务。

## 接口与集成

- `GET /api/faculty`：source=local/openalex、q、search_mode=name/research、分页、学校/院系/领域/状态、fuzzy、sort、收藏 ids。
- `GET /api/faculty/{id}`：真实清华记录或当前账户 OpenAlex 缓存。
- `GET /api/faculty/{id}/projects`：当前账户已导入且强关联的 SRT 记录。
- `POST /api/search`：可选 provider；省略则使用当前账户默认服务。
- `GET /api/sources`：附带当前教师/项目数据库条数。
- 原项目搜索、导入、推荐和邮件接口继续兼容，目录筛选在分页前执行。

SDK 合同仍为 1.0.0，两个合同文件保持一致。旧 community 类型保留用于读取历史备份兼容；产品无公共 Space 导航、模块页面或跳转，Giscus 依赖已移除。

## 验证与启动

在项目根目录执行 `npm run check`、`.venv/Scripts/python.exe -m pytest tests research_module/tests -q`。浏览器测试 `npm run test:e2e` 使用真实本地数据库和接口，外部 OpenAlex 由 tests/browser_server.py 模拟，不调用付费服务。

`python run.py` 或 start-windows.cmd 启动本目录 dist；改前端后必须 build，改后端后必须重启。另一目录的旧 Vite 预览不会自动更新。使用同一个地址与浏览器以保留账户；本次不复制或删除现有 .runtime 里的用户配置。
