# DSH 插件场景 TODO

本文件记录本会话中讨论过的 DSH 插件/功能场景，按优先级和依赖关系排列。

## 已完成

- [x] dsh-router：双角色 profile 路由（独立 CLI + DSH bundle 插件）
  - 光标选择器 TUI，Monokai 配色
  - 排除 `router` 自身
  - 支持 `--target <profile>` 绕过 `web` 子命令冲突
  - TS 源码 + `lib/` 构建
- [x] dsh-monokai：Monokai + Surtur 背景 client 皮肤
  - 独立 client 插件包（`dsh.client` + body attribute token 覆盖）
  - Monokai alias token 覆盖（深色/浅色）
  - Surtur 背景图通过 CSS 变量 `--dsh-monokai-bg-image` 注入（当前内嵌 data URL）

## 待实现

### 1. UI 风格：Monokai + Surtur 背景（后续增强）

- [ ] Surtur 背景图改为 Config 字段（当前仍是内嵌 data URL，未做成可配置）
- [ ] 持久化主题偏好（处理第三方 theme id 进程内限制）

### 2. 切换主题功能

- [ ] 将当前 Monokai + Surtur 拆分为独立的“主题”和“背景图”两个维度
- [ ] 支持多种主题（例如 Monokai、浅色/深色等）
- [ ] 支持多种背景图（例如 Surtur、无背景、自定义上传等）
- [ ] 在 WebUI 中提供主题/背景切换入口
- [ ] 持久化用户选择的主题与背景图

### 3. 逆向特化 Agent（IDA + Safari/iOS）

- [ ] `dsh-re-ida`：IDA 能力 seam（Service Definition）
- [ ] `dsh-re-ida-headless`：spawn `idat64/idat` + idapython JSON-lines 协议
- [ ] `dsh-re-tool-ida`：模型工具（open/wait/decompile/xref/rename/comment/run_script/kill）
- [ ] IDA 进程管控：会话注册表、超时、取消、多 DB、后台任务
- [ ] workflow/ralph 自动分析编排
- [ ] iOS/Safari：`idevicesyslog` provider
- [ ] iOS/Safari：WebKit Inspector / `ios_webkit_debug_proxy` provider
- [ ] 安全门禁：`tools/pre-execute` 审批 + 默认关闭

### 4. 多 Agent 仿酒馆

- [ ] 协调器 host 插件：continuable subagent 路由、轮转、抢话
- [ ] 角色卡/世界书存储（`dsh-storage` + session event 可见性）
- [ ] client 角色列表 sidebar slot
- [ ] keyed `conversation.chat.node` 角色气泡 UI
- [ ] 最小闭环：2 角色轮流群聊

### 5. 右侧边栏基座

- [x] 评估 client 右侧边栏 slot/布局机制：官方已有 `details` 右列（tool-details 面板）+ `ctx.layout` open/close API，但无可叠加挂载点
- [x] POC：`shell.overlay` 动态插件实现右停靠面板（无需改壳、可随时开关）——已验证：挂载点/容器/开关/切换/RPC 桥/主题联动全部可行，插件 `rpanel-1`（Run card 可见）
- [x] 正式基座：改造 `details` 列为可叠加面板 seat——`details.panel` list 槽位 + tab 轨道 + 自动 tab 规则 + 常驻挂载已实现并验收（`rpanel-1/pkg-4` 运行中，标签「工具区」）；入口由插件自备（`ctx.layout.openDetails()`），POC 采用右缘中央手拉开关（`shell.overlay` + `data-details-collapsed` 纯 CSS 显隐）
- [x] 工具区专属配色：新增 token `--dsw-specific-details-fill`（官方主题默认与基础背景一致、零视觉变化），monokai 覆写为更深的近实色（深色 `rgba(16,17,14,0.98)`），背景图不再透入右列
- [x] 列宽动态分配：`deriveDetailsWidth`——`w_right = max(⌊(w_all − w_left)/2⌋, DETAILS_MIN)`，**无绝对上限**（派生值即拖拽上限，保证 `w_right ≤ w_middle`）；开列/页面进入/resize/侧栏变化时自动重算；Agent Note `2026-08-15-details-column-derived-width`
- [x] 边栏容器：打开/关闭走 `ctx.layout`，面板切换与面板内状态保持已随基座实现
- [x] host RPC 桥接底座：`harness.handle`/`host.call` 私有 RPC 链路已在 POC 验证
- [x] 插件化（零 harness 改动版，aionui 路线）：`plugins/dsh-toolbox` 在官方三列 frame 上运行时追加工具区列（grid 轨道镜像同步 + 防回环判别），列内容经官方 `conversation.session.header.actions` 槽位 + React Portal 渲染；宽度策略/拖拽/双击复位/按项目持久化全部插件内实现（`src/client/layout.ts` 顶部常量即配置）；接口仍为 `toolbox.tool` 槽位
- [x] 双 profile：web 纯净（仅 + monokai）；`kidi-web`（base + web-app + monokai + toolbox）
- [ ] 旧方案存档：`web-toolbox-test` 分支（含 setDetails 接缝实验）；向上游提议 `ctx.layout.setDetails` 作为独立 PR 素材（记于本 TODO，不影响插件发布）
- [ ] 面板状态跨刷新/跨会话持久化（当前为内存态）
- [ ] 工具区前端 UI 打磨：标签页样式、空状态、工具页内容排版继续细化
- [ ] Git 可视化插件（挂载 `toolbox.tool`）

### 6. 工具区可视化工具

- [x] MCP 可视化：列出当前可用的 MCP 工具/服务，展示名称、描述、输入 schema（连接状态待补）
- [x] **MCP Adapter 插件（懒启动/手动激活）**：以纯插件形式实现，不修改 Harness 核心（基础版已实现）
  - [ ] 自持 MCP 客户端生命周期：不随 DSH 启动自动连接，默认 inactive
  - [ ] 支持手动激活/停用：在 MCP 面板点击 activate / deactivate 后再连接/注册工具
  - [ ] 激活后才把工具注册到 `ctx.tools`，避免 MCP schema 常驻上下文
  - [ ] 暴露统一状态查询：inactive / connecting / active / error
  - [ ] 与 MCP 可视化整合：同一个面板显示状态、工具数、激活按钮
  - [ ] 支持多 MCP server 独立控制
  - [ ] 复用 `@modelcontextprotocol/sdk` 或 stdio JSON-RPC，不依赖 `@deepseek-ai/dsh-mcp-client` 的启动即连接行为
  - [ ] 可选：首次调用自动激活 / 按会话过滤工具
- [ ] MCP 工具调用面板：从工具区直接调用/调试 MCP 工具，查看返回结果
- [ ] 文件树 + 预览：显示当前工作区文件树，点击文件在预览区查看内容；支持 Markdown / HTML / 代码 / diff / CSV / PDF / Office / 图片 / 文本等多格式预览，源码/预览/分屏模式与保存
- [ ] 文件改动预览：展示工作区未提交改动（git diff / 新增 / 删除 / 修改），支持 diff 视图
- [ ] Git 状态可视化：分支、暂存区、未跟踪文件一览
- [ ] 最近文件 / 快速打开：按最近访问或模糊搜索快速打开文件
- [ ] 文件内容搜索：在当前工作区内搜索文件名 / 文件内容
- [ ] 后台任务 / 日志面板：查看正在运行的任务、输出日志
- [ ] 环境信息面板：当前 session 工作目录、Node/Python 版本、关键环境变量

### 7. Git 可视化

- [ ] `dsh-git-tool`：log/diff/show/blame/status，规范 JSON 输出
- [ ] 持久 `git/graph` 会话事件
- [ ] ConversationNode SVG DAG 渲染（挂载右侧边栏）
- [ ] 评估上游 `card: 'git-graph'` render-intent 扩展

### 8. 其他

- [ ] MCP 服务器接入示例
- [ ] Claude Code / Codex hooks 桥接
- [ ] 自定义 LLM 适配器
- [ ] 跨会话 cron（host 插件 + timer + sessions）
- [ ] 编辑器 follow/locations 集成
