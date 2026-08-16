# @dsh-external/dsh-client-ui-toolbox

工具区（Toolbox）基座插件：在 Web GUI 的官方三列框架**右侧追加一列**作为「工具区」——标签式工具页切换、右侧窄栏入口（类似左侧边栏）、拖拽调宽、按项目持久化。**零 harness 源码改动**：本插件通过 profile bundle 安装即可用，官方包与官方布局不受任何影响。

## 实现方式（无源码侵入）

- **运行时追加列**：布局控制器定位官方 frame grid（`[data-dsh-frame]`，缺失时退化为侧栏列的父元素），把自建列 div `appendChild` 进 grid，并在官方每次写 `grid-template-columns` 时镜像其三条轨道、追加自己的第四条轨道（轨道数量判别打破回环：官方写 3 条 → 镜像重拼；自己写 4 条 → 忽略）。
- **React Portal**：列内容（标题 + 标签栏 + 工具页/空状态）从官方 `conversation.session.header.actions` 槽位（会话级、常驻）经 `createPortal` 渲染进自建列；折叠时同一列渲染为右侧窄栏，顶部是一个图标展开按钮（类似左侧边栏），不再使用浮层手拉箭头或文字箭头。
- **宽度策略（插件内配置）**：`layout.ts` 顶部常量——`TOOLBOX_RAIL_WIDTH`、`TOOLBOX_MIN`、`TOOLBOX_MAX`、`SIDEBAR_ASSUMED`、`CENTER_RESERVE`。打开时 `w_right = max(300, ⌊(窗口宽 − 280)/2⌋)`（不挤占中间列预留），窗口缩放时列开着自动重算；拖拽把手调宽、双击复位、宽度与折叠状态按项目（会话 cwd）持久化到 localStorage。
- **官方 details 列不碰**：工具详情面板保持原样（本部署不使用它）。
- **配色**：列表面使用官方 token `--dsw-alias-bg-overlay`，皮肤（如 dsh-monokai）覆写该 token 即可让工具区融入主题。

## 工具插件接口：`toolbox.tool`

其他插件往工具区加工具，只需注册一个槽位条目——这是唯一接口：

```ts
export function apply(ctx: Context): void {
  ctx.slots.inject('toolbox.tool', () => ctx.slots.register(
    {
      name: 'toolbox.tool',
      id: 'my-tool',          // 必填，唯一 id（重复 id 会替换该工具页）
      order: 0,               // 可选，卡片排序（升序）
      label: '我的工具',       // 可选，工具标题
    },
    () => <MyToolPage />,     // 工具页内容组件，样式与交互自持
  ))
}
```

条目契约：

- **作用域** `session`：工具页组件自动获得框架会话套件（`sessionId`、`useSession`、`useSessions`、`useWorkspaces`、`useProjection`、`useInput`、`inputActions`），无 owner share。
- **工具页自持**：工具区只提供布局与切换；工具页的视觉、状态、交互（含与自身 host 半边经 `host.call` 的私有 RPC）完全由工具插件负责。
- **生命周期**：随槽位注册/注销自动挂载与卸载；插件停止或更新即移除。

## 安装

```sh
# 1. 构建（产出 lib/index.js 与 lib/client.js）
pnpm run build

# 2. 装入目标 profile（bundle patch 自动插入 ui-toolbox 插件行）
# 注意：仓库目录名是 plugins/dsh-toolbox；包名才是 @dsh-external/dsh-client-ui-toolbox
dsh plugin --profile <profile> add link:<仓库路径>/plugins/dsh-toolbox

# 3. 启动
dsh --profile <profile> web
```

## 备注

- 官方 DOM 结构若变化，本插件需随之适配（框架定位与轨道同步逻辑集中在 `src/client/layout.ts`）。
- 会话未打开时不显示工具区（按项目工作）。
- 已知取舍：侧栏宽度取固定假设值 280（框架无公开读接口）；如需精确值，可等待上游提供侧栏宽度读接口后在 `SIDEBAR_ASSUMED` 处替换。
