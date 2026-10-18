# ResearchSpace GitHub 公开版
这个项目是耗时4个小时在hackerson上开发出来的。旨在解决学生选科研方向/找导师/找科研项目这一亘古难题。
这个项目的主要用户对象是面向清华大学的。
这个项目的闭源版本是包括清华大学所有的SRT项目数据的，但是公开版本出于保护个人信息的考虑，将这些数据移除了。
目前做的非常粗糙，但是由于我太懒了所以以后未必会更新（除非有人给我打钱）
本项目的拓展性非常好，每一个功能都是以插件的形式插进去的，所以更新/替换功能模块或者插入新功能是很容易的。这也是苯人为了多人开发想出的小巧思。

## Windows 直接运行（不需要 npm）

1. 完整解压 ZIP，进入 `ResearchSpace` 文件夹，不要只解压某个模块。
2. 安装 Python 3.11 或更高版本。
3. 双击根目录 `start-windows.cmd`。第一次会创建 `.venv` 并下载 Python 依赖，需要联网。
4. 打开 **http://127.0.0.1:8000**。终端保持开启；按 Ctrl+C 关闭服务。

已经附带本次源码实际构建出的 `dist/`，日常使用不需要 Node.js/npm。

也可以手动启动：

```powershell
python -m venv .venv
.venv\Scripts\python.exe -m pip install -r requirements.txt
.venv\Scripts\python.exe run.py
```

端口占用时运行 `python run.py --port 8010`。Linux/macOS 可运行 `bash start.sh`。

请始终使用同一个浏览器和相同地址。`localhost`、`127.0.0.1`、不同端口属于不同浏览器存储空间。若从原来的 Vite 地址迁移，先在旧页面导出画像/草稿，再在新地址导入。

## API 设置选项卡

完成画像后进入左侧“设置与隐私”。

| 选项卡 | 功能 |
| --- | --- |
| AI 服务 | OpenAI/GPT、DeepSeek、Claude、Gemini、Qwen、Kimi、SiliconFlow、Ollama、自定义 OpenAI 兼容服务 |
| 搜索服务 | OpenAlex 学术搜索、Tavily、Brave Search、Serper、SerpAPI、Exa、自定义 JSON 搜索服务 |
| 数据源与 SRT | 六类官方来源采集、任务诊断、标准项目 JSON 与 SRT ZIP/JSON 导入 |
| 外观与语言 | 五种主题色、中英主界面，字体优先微软雅黑 |
| 数据与模块 | 画像/草稿备份、账号删除、模块状态 |

每家服务都有独立配置，切换服务商不会把上一家的密钥带入下一家。填好自己的 API key 后，点击“保存并设为默认”；“仅保存”不会切换默认服务。AI 的 Base URL、模型 ID、最大输出长度，以及搜索的 endpoint、结果数都可修改。SiliconFlow 和 Ollama 需要填写你实际可用的模型 ID。

“测试连接”使用已保存配置发起极小真实请求，可能消耗额度；保存本身不会联网调用服务商。未填写密钥时，项目库和本地邮件模板仍可用。各服务需使用自己的 API 凭据，不提供共享密钥，也无需同时配置全部服务。模型可用性和具体额度以各服务账户为准。

## 已串通的使用路径

- 导师探索 → 清华官网教师数据库 / OpenAlex 学术搜索 / 公开网页搜索 → 来源详情、收藏 → 联系邮件。
- 科研机会 → 本机画像推荐 / 项目库检索 → 研究内容、周期、导师、团队、申请方式 → 邮件助手。
- 科研机会 → 联网搜索 → 保存为待核查项目线索 → 返回项目库。
- 联系邮件 → 目录与公开信息查询 → 用户核对事实 → 本地多语言模板或 AI 生成 → 编辑 / 保存 / 下载。

AI 发送个人资料前仍有逐次完整预览与同意。邮件只生成草稿，不自动发送。搜索结果与采集得到的资助线索不会自动变成“已核实招募”。

## 数据与密钥

- 画像、收藏和邮件草稿：浏览器 IndexedDB。
- 服务配置与导入项目：本地 `.runtime/`，按当前本地账号及浏览器连接凭据隔离。
- API key：默认只留在 Python 服务内存，关闭服务后需要重填。勾选“在本机加密保存”后使用 Fernet 加密落盘，重启可用。
- 页面不读取或回显已保存 key；画像 JSON 备份不带 provider key 或本地服务访问凭据。
- 本机加密不是操作系统级保密：有权同时读取 `.runtime/master.key` 和配置文件的人仍可解密。不要把 `.runtime` 放进公开仓库或代码包。
- 切换账号分别使用对应的 AI/搜索默认配置；删除账号会先删除对应的本地服务配置和导入项目，再删除浏览器资料。
- 清空浏览器站点数据会丢失本地连接凭据，旧的服务资料不会自动绑定到新档案。本版不提供跨设备账号认证或同步。

服务只监听 `127.0.0.1`，并校验 Host、Origin 和本地账户凭据。它是个人电脑应用，不是面向公网的多用户托管服务。

## SRT 与原有数据

本公开包 **不附带任何 SRT 项目**，首次启动时 SRT 为 0 条，保留原有 7 条公开来源项目。用户导入的 SRT 数据仅写入本机当前账号的 `.runtime/`，不进入公开项目导出；切换账号互不影响。由于清除了原导师库的 SRT 关联编号，导入项目后不会自动恢复旧版的强关联名单。

需要校内 SRT 数据时，可在“数据源与 SRT”选择自己有权限使用、含 `project_details.json` 的 ZIP 或原始 JSON，导入当前账户；公开源码不提供或下载受限数据。标准项目 JSON 格式参考 `research_module/data/project.template.json`。GitHub SRT 仓库预留为标准 JSON 导入边界：仓库确定后，可下载其标准 JSON 并导入；没有虚构仓库地址。

官方采集适配器包含 HKUST UROP、NIH RePORTER、NSF、ETH、EPFL 和清华公开通知。只有点击“采集 / 续传”才访问对应来源；原站访问失败会显示任务诊断和来源链接。

## 源码开发与检查

只在修改前端源码时需要 Node.js 22.12+ 和 npm。所有命令都在包含 `package.json` 的 **ResearchSpace 根目录**运行，不要拿旧的独立模块 ZIP 运行 npm。

```bash
npm ci
npm run check
python -m pip install -r requirements-dev.txt
python -m pytest tests research_module/tests -q
```

开发时一个终端执行 `python run.py`，另一个执行 `npm run dev`，Vite 将 `/api` 转发给本机 Python 服务。改完前端必须执行 `npm run build` 才会更新 Python 启动所用页面。

可选浏览器回归：

```bash
npx playwright install chromium
npm run test:e2e
```

测试使用合成账号和模拟 provider 响应，不使用真实付费密钥。Python API 文档见运行后的 `http://127.0.0.1:8000/docs`；接口与架构说明见 `docs/INTEGRATION-v0.3.1.md`，清理版的验证结果请以本包当前测试和审计报告为准。

## 当前边界

本版实际接入三个模块：faculty、opportunities、outreach。导师目录读取清华官网数据库与 OpenAlex 学术资料，网页搜索返回待核查链接；不会根据论文署名或网页摘要推断招生名额、指导关系或未公开的联系方式。原导师和邮件模块中的部分操作文案仍为中文；新增设置、项目页面和宿主导航支持中英切换，邮件草稿支持中英德日法五种语言。

`research_module/docs`、`research_module/web` 和 `research_module/integration` 保留原独立搜索包的参考文件；当前启动和统一 API 以根目录本说明与 `server/` 为准。
