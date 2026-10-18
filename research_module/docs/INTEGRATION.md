# 接入 ResearchSpace 主程序

本次附件仅有长期备忘录和SRT数据，没有 `src/sdk/contracts.ts`、`docs/模块集成协议.md` 或宿主源代码。以下是实际可用的独立接入层，不宣称是未见过的冻结SDK实现。

1. 启动 Python 后端，反向代理 `/api/*` 到后端，确保与 React 宿主同源。
2. 复制 `integration/client.ts` 与 `ResearchProjectsPanel.tsx` 到你自己的 `src/modules/opportunities/` 下。
3. 阅读已有冻结协议，按实际 HostApi 将当前用户画像映射为 `ResearchProfile`，把组件 `onSave` 接到该账号隔离的存储。
4. 在已有 `module.tsx` 中用正确的 `ResearchModule` 导出包装此组件，保留原协议，不覆盖宿主SDK。
5. 主题样式在宿主侧添加；组件不引入新的 CSS 框架，也不修改账户或全局路由。

```tsx
<ResearchProjectsPanel
  profile={mappedProfile}
  base="/api"
  onSave={saveToCurrentAccount}
/>
```

这两个变量由你的真实宿主实现提供，示例不是虚构的 HostApi 方法。组件仅在用户点击“使用当前画像推荐”时发送画像。实际账户隔离应由宿主提供，服务端不持久化画像。

Vite 开发代理示意：

```ts
server: { proxy: { '/api': 'http://127.0.0.1:8000' } }
```

Python 本地服务校验Host；Vite代理默认保留宿主的localhost Host可用；如果使用其他开发域名，代理应配置 `changeOrigin: true`。跨域CORS没有自动开放。

`ResearchProjectsPanel.tsx` 为React/TypeScript源代码接入示例，独立包启动不编译它。需要在已有React19项目的真实类型/构建环境中核验。`faculty`/`community`/`outreach` 不在本次科研搜索推荐范围内，未伪装实现。
