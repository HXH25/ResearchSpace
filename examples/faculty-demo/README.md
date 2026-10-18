# 插件联调示例（不默认安装）

这一模块仅用于验证宿主的模块自动发现、路由、个人画像传入、HostCatalog 查询等。
其导师为**虚构示例**，`isDemo: true` 且 `recruitmentStatus: unknown`，不可作为真实导师信息使用。

将 `examples/faculty-demo/src/modules/faculty` 复制到宿主根目录的 `src/modules/faculty`，
重启 `npm run dev`，页面中的“导师探索”将从占位状态切换到示例模块。

验证后删除 `src/modules/faculty` 中的示例文件夹，再放入由 faculty Agent 开发的正式 ZIP。
如果已存在正式导师模块，不要执行覆盖。请勿将示例导师数据合并到真实数据集。
