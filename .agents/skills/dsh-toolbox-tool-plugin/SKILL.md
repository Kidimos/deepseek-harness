---
name: dsh-toolbox-tool-plugin
description: Use when developing a tool plugin for the dsh-toolbox 工具区 — registering toolbox.tool cards, wiring host/client halves, packaging the bundle, installing into a profile, or debugging the toolbox column itself.
whenToUse: Add a new tool (terminal, Git visualization, …) to the right-side 工具区 of a DSH web profile that mounts dsh-toolbox; also use when reading or modifying the toolbox base plugin's layout controller or seat.
---

# Toolbox 工具插件接入

本 Skill 面向"往工具区里加工具"的后续开发。工具插件只需要懂**接口**一节；实现原理与坑位是排查和改基座时的索引。

## 工具箱是什么

`plugins/dsh-toolbox`（`@dsh-external/dsh-client-ui-toolbox`，v0.0.2）是一个**零 harness 改动**的右侧栏基座插件：

- 在官方三列 frame 右侧**运行时追加一列**「工具区」，右缘「◀」手拉打开、左缘「▶」胶囊收起
- 宽度策略：打开 = `max(300, ⌊(窗口宽−280)/2⌋)`（插件内常量 `layout.ts` 顶部），窗口缩放重算，拖左缘调宽、双击复位，宽度/折叠按项目（会话 cwd）持久化
- 工具卡片经 **`toolbox.tool` 槽位**注册——这是工具插件的**唯一接口**

## 实现原理（了解即可，工具插件不依赖这些细节）

```
官方 frame grid（3 轨道）
   │ 布局控制器：镜像官方 inline grid-template-columns，追加第 4 轨道
   ▼
[侧栏 | 中间 | details(0px) | 工具区列(appendChild 的 div)]
                              ▲
  官方 conversation.session.header.actions 槽位（会话级常驻、原位渲染为空）
      └─ ToolboxMount 组件 createPortal(列内容, 自建列 div)
            └─ renderSlot('toolbox.tool', {})  ← 工具卡片渲染点
```

- **轨道同步防回环**：官方写 3 轨道 → 镜像并重拼；自己写 4 轨道 → 忽略
- **列常驻挂载**：折叠 = 轨道 0px，Portal 内容与卡片组件**不卸载**（卡片状态在开合间保留）
- **拖拽即时跟手**：拖拽期间内联暂停 frame 的 grid 过渡，松手恢复
- **层叠**：拖拽把手 z=30、收起胶囊 z=40，均骑在列左缘；胶囊在列外（不遮内容、不被 overflow 裁剪）
- **零官方依赖**：不碰 details 列、不用任何非公开 API；官方 DOM 结构变化时只需适配 `layout.ts` 的 `findFrame`

## 接口（唯一契约）：`toolbox.tool` 槽位

### 注册

```ts
// 工具插件的 client 半边
export function apply(ctx: Context): void {
  ctx.slots.inject('toolbox.tool', () => ctx.slots.register(
    {
      name: 'toolbox.tool',
      id: 'my-tool',          // 必填，唯一；重复 id 替换该单元格
      order: 0,               // 可选，升序排卡
      label: '我的工具',       // 可选，卡片标题；也接受 () => string（跟随 locale）
      locale: 'my-tool-ns',   // 可选，注册 locale 后 label 可用 thunk
    },
    (props) => <MyToolCard {...props} />,   // 卡片组件
  ))
}
```

### 卡片组件收到的 props（框架会话套件，无 owner share）

| prop | 说明 |
|---|---|
| `sessionId` | 当前会话 id（会话级作用域） |
| `useSession` | 会话快照选择器 hook |
| `useSessions` / `useWorkspaces` | 全局列表选择器 hook |
| `useProjection` / `useInput` / `inputActions` | 宿主投影与输入机 |

- **卡片自持**：网格只给布局；卡片的视觉、状态、交互全部自己实现（用主题 token 配色，不硬编码颜色）
- **私有 RPC**：与自身 host 半边通信走 `host.call(method, args)`（Package 私有 JSON RPC），`harness.handle` 注册
- **生命周期**：随注册/注销挂载与卸载；崩溃的卡片会被槽位系统隔离（不影响其他卡片与工具箱）
- **折叠存活**：工具区折叠时卡片仍挂载（0px 隐藏）——卡片内部的订阅/定时器继续运行，昂贵资源（PTY 流等）自己按需降级
- **会话切换**：卡片随会话重挂载（mount 入口是会话级）

## 工具插件最小骨架（发布级）

```
plugins/dsh-<tool>/
  package.json          # dsh.client.inject（信息性边）+ dsh.bundle.patch 指向 cordis.patch.yml
  cordis.patch.yml      # - insert: [{id: ui-<tool>, name: '@dsh-external/…'}]
  tsconfig.json         # 复制 dsh-toolbox 的（jsx: react-jsx）
  tsdown.config.ts      # clientBundle('<package>', ['src/index.ts'], {portableCssModuleIds: true})
  build/tsdown.client.ts + build/web-platform.ts   # 复制 dsh-toolbox/build/
  src/index.ts          # node 半边（host 服务 + harness.handle）
  src/client/index.ts   # client 半边（注册 toolbox.tool 卡片）
  src/client/*.tsx      # 卡片组件 + module.css（CSS Modules，构建时自动注入 style 标签）
  src/jsx.d.ts          # 复制 dsh-toolbox 的最小 JSX/react 环境声明（类型检查用）
  tests/ + vitest.config.ts
```

关键代码形态：

```ts
// src/index.ts（host）
export const inject = ['…需要的官方服务…']
export function apply(ctx: Context): void {
  ctx.effect(() => harness.handle('ping', async (args) => ({ ok: true, echo: args })))
}

// src/client/index.ts（client）
export const inject = ['slots']
export function apply(ctx: Context): void {
  ctx.slots.inject('toolbox.tool', () => ctx.slots.register(
    { name: 'toolbox.tool', id: 'my-tool', order: 0, label: '我的工具' },
    (props) => <Card {...props} onPing={() => host.call('ping', { at: Date.now() })} />,
  ))
}
```

- Host 能力**复用官方服务**（`fs`、`bash`/`subprocess`、`sessions`…），不要自己造；需要经 `ctx.get()` 可选读取
- 类型化从简：插件是独立包，用本地结构化类型（参照 `dsh-toolbox/src/client/contract.ts`），不 import workspace 类型

## 安装与验证

```sh
cd plugins/dsh-<tool> && pnpm run build        # typecheck + test 后构建
dsh plugin --profile kidi-web add link:<仓库>/plugins/dsh-<tool>
dsh --profile kidi-web                          # 注意：没有多余参数（dsh --profile kidi-web web 会报错）
```

验证清单：手拉打开工具区 → 新卡片出现在网格（按 order）→ 卡片交互与 host RPC 正常 → 折叠/展开状态保留 → 切会话后卡片重挂载 → `pnpm dsh web`（纯净 profile）无此卡片。

## 坑位清单

- **官方 DOM 别碰**：工具插件只注册槽位卡片；一切列/轨道/宽度归基座插件。官方结构升级只影响 `dsh-toolbox/src/client/layout.ts` 一处
- **宽度不用管**：卡片随列宽自适应（网格 `auto-fill minmax(150px,1fr)`）
- **改基座后必须重建**：`pnpm run build`（`lib/client.js` 是服务端按包服务的产物）；改完硬刷新页面
- **注册时机**：`slots.inject('toolbox.tool', …)` 等待声明（基座未挂载时自然等待，不会报错）
- **label 多语言**：`label: () => t('…')` thunk + 自己的 locale 命名空间注册
- **启动命令**：`dsh --profile <profile>`，别再拼 `web`
- **持久化约定**：工具自身的状态持久化自己负责（基座只持久化宽度/折叠）

## 文件索引（基座插件）

| 文件 | 职责 |
|---|---|
| `src/client/layout.ts` | 布局控制器：轨道追加/防回环、把手、胶囊、宽度策略常量、按项目持久化 |
| `src/client/index.ts` | apply：控制器生命周期、项目根绑定、mount 入口与手拉注册 |
| `src/client/ToolboxRoot.tsx` | Portal 列内容（标题/网格/空状态）+ 手拉组件 |
| `src/client/contract.ts` | 本地结构化类型（ToolRow、控制器面、插件上下文面） |
| `tests/layout.spec.ts` | 纯函数测试（轨道解析、宽度公式、钳制） |
