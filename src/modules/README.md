# 模块安装槽

把各 Agent 交付的 ZIP **直接解压到项目根目录**，确保出现：
- `src/modules/faculty/module.tsx`
- `src/modules/opportunities/module.tsx`
- `src/modules/community/module.tsx`
- `src/modules/outreach/module.tsx`

主程序将使用 Vite import.meta.glob 自动发现并注册模块；缺失模块时有清晰占位页。
请阅读 `../sdk/contracts.ts` 和 `../../docs/模块集成协议.md`。
