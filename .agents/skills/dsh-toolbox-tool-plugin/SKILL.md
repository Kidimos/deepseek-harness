---
name: dsh-toolbox-tool-plugin
description: Use when developing a tool plugin for the dsh-toolbox 工具区 — registering toolbox.tool tools, wiring host/client halves, packaging the bundle, installing into a profile, or debugging the toolbox itself.
whenToUse: Add a new tool (MCP adapter, file tree, Git visualization, …) to the right-side 工具区 of a DSH web profile that mounts dsh-toolbox; also use when reading or modifying the toolbox base plugin.
---

# Toolbox 工具插件接入

本 Skill 面向“往工具区里加工具”的后续开发。工具插件只需要懂**接口**一节；实现原理与坑位是排查和改基座时的索引。

## 工具箱是什么

`plugins/dsh-toolbox`（`@dsh-external/dsh-client-ui-toolbox`）是一个**零 harness 改动**的右侧栏基座插件：

- 在官方三列 frame 右侧**运行时追加一列**「工具区」
- 折叠时是一条**窄栏**，顶部是工具区开关图标，下面是已安装工具的图标
- 展开后左侧仍然是图标导航栏，右侧为当前工具内容
- 图标太多时支持**分页**（`ICON_PAGE_SIZE`，当前每页 6 个）
- 宽度策略、拖拽调宽、按项目持久化都在 `layout.ts` 内
- 工具通过 **`toolbox.tool` 槽位**注册——这是工具插件的**唯一接口**

## 当前架构（重要）

```
官方 frame grid（3 轨道）
   │ 布局控制器：镜像官方 inline grid-template-columns，追加第 4 轨道
   ▼
[侧栏 | 中间 | details | 工具区列]
                        ▲
   shell.overlay（root 作用域，始终挂载）
      └─ ToolboxMount createPortal(列内容, 自建列 div)
            ├─ 图标导航栏（开关图标 + 工具图标 + 分页）
            └─ renderSlot('toolbox.tool', {}, { only: id })  ← 当前工具页
```

- **挂载点**：`shell.overlay`（root 作用域），所以新会话还没发第一句话时右侧栏就已存在
- **工具槽位作用域**：`toolbox.tool` 使用 `session-maybe`
  - 有会话时工具组件能拿到 `sessionId` 等会话套件
  - 没有会话时也能渲染（例如 MCP Adapter 需要在第一句话之前激活）
- **工具图标**：slots 核心不会透传任意 `options` 字段，所以图标必须挂在**组件静态属性**上：

```ts
const MyTool = Object.assign(
  (props) => <MyToolPage {...props} />,
  { icon: MyIcon },
)
```

- **折叠/展开**：折叠时只显示图标导航栏；展开时左侧图标栏 + 右侧工具页
- **激活高亮**：当前使用的工具图标会高亮，配色使用 Monokai 红 `#f92672`

## 接口：`toolbox.tool`

### 注册

```ts
export function apply(ctx: Context): void {
  ctx.slots.inject('toolbox.tool', () => ctx.slots.register(
    {
      name: 'toolbox.tool',
      id: 'my-tool',          // 必填，唯一
      order: 0,               // 可选，升序
      label: () => t('title'),// 可选，标题；建议 thunk 跟随 locale
      locale: 'myTool',       // 可选
    },
    MyTool,                   // 组件，记得挂 icon
  ))
}
```

### 组件 props

工具组件会收到框架套件，例如：

| prop | 说明 |
|---|---|
| `sessionId` | 当前会话 id；无会话时可能为 `''` |
| `useSession` / `useSessions` / `useWorkspaces` | 会话/工作区选择器 |
| `useProjection` / `useInput` / `inputActions` | 宿主投影与输入机 |

- 工具页**自持**：视觉、状态、交互全部自己实现
- 与 host 半边通信走私有 RPC 或自己的 `/xxx/*` HTTP 路由
- 生命周期随注册/注销挂载/卸载

## 工具插件最小骨架

```
plugins/dsh-<tool>/
  package.json
  cordis.patch.yml
  tsconfig.json
  tsdown.config.ts
  build/tsdown.client.ts + build/web-platform.ts
  src/index.ts          # host 半边
  src/client/index.ts   # client 半边：注册 toolbox.tool
  src/client/*.tsx      # 工具页 + module.css
  src/jsx.d.ts / css-modules.d.ts
```

关键点：

- `src/client/index.ts` 注册工具时用 `Object.assign(Component, { icon })`
- host 半边可以注册 HTTP 路由（`webServer.register`）和/或私有 RPC
- 构建用 `clientBundle('<package>', ['src/index.ts'], { portableCssModuleIds: true })`
- 安装用 `dsh plugin --profile <profile> add link:<仓库>/plugins/dsh-<tool>`

## 安装与验证

```sh
cd plugins/dsh-<tool> && pnpm run build
dsh plugin --profile kidi-web add link:<仓库>/plugins/dsh-<tool>
dsh --profile kidi-web
```

验证清单：

- 新会话一开始右侧窄栏就存在
- 工具图标出现在图标栏
- 点击图标能展开/切换到对应工具页
- 折叠后图标仍可见
- 工具页与 host 通信正常
- 切会话后仍可用（session-maybe）

## 坑位清单

- **不要依赖 `options.icon`**：slots 核心会丢弃自定义 options 字段，图标必须挂组件静态属性
- **不要在 `conversation.session.header.actions` 挂载**：新会话首条消息前不渲染；用 `shell.overlay`
- **工具槽位用 `session-maybe`**：否则没有会话时工具页无法渲染
- **改基座后必须重建**：`pnpm run build`
- **label 多语言**：`label: () => t('…')` + locale 命名空间
- **启动命令**：`dsh --profile <profile>`，不要拼 `web`
- **工具状态持久化**：工具自己负责；基座只持久化宽度/折叠

## 参考实现

- `plugins/dsh-mcp-adapter`：MCP 服务器生命周期控制 + 可视化，是当前最完整的工具插件示例
- `plugins/dsh-file-preview`：文件树 + 预览，展示 host 路由 + 工具页组合
