# 原科研搜索/推荐引擎参考资料

当前统一应用的启动说明以项目根目录README为准。本目录保留原独立模块的数据模板、公开种子、配置、历史文档、前端和旧集成组件供参考。真正被宿主调用的Python核心在 ../research/；新的统一路由在 ../server/，新的机会页面在 ../src/modules/opportunities/。

原独立HTTP实现仍保留在research/server.py供向后兼容测试，新程序使用FastAPI，不使用旧管理员令牌模式。
