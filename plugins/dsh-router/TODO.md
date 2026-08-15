# DSH 插件场景 TODO

本文件记录本会话中讨论过的 DSH 插件/功能场景，按优先级和依赖关系排列。

## 已完成

- [x] dsh-router：双角色 profile 路由（独立 CLI + DSH bundle 插件）
  - 光标选择器 TUI，Monokai 配色
  - 排除 `router` 自身
  - 支持 `--target <profile>` 绕过 `web` 子命令冲突
  - TS 源码 + `lib/` 构建

## 待实现

### 1. UI 风格：Monokai + 动漫背景

- [ ] 发布为独立 client 插件包（`dsh.client` + `ctx.theme.register()`）
- [ ] 提供 Monokai alias token 覆盖
- [ ] 动漫背景图作为可配置 CSS（Config 字段，不硬编码）
- [ ] 持久化主题偏好（处理第三方 theme id 进程内限制）

### 2. 逆向特化 Agent（IDA + Safari/iOS）

- [ ] `dsh-re-ida`：IDA 能力 seam（Service Definition）
- [ ] `dsh-re-ida-headless`：spawn `idat64/idat` + idapython JSON-lines 协议
- [ ] `dsh-re-tool-ida`：模型工具（open/wait/decompile/xref/rename/comment/run_script/kill）
- [ ] IDA 进程管控：会话注册表、超时、取消、多 DB、后台任务
- [ ] workflow/ralph 自动分析编排
- [ ] iOS/Safari：`idevicesyslog` provider
- [ ] iOS/Safari：WebKit Inspector / `ios_webkit_debug_proxy` provider
- [ ] 安全门禁：`tools/pre-execute` 审批 + 默认关闭

### 3. 多 Agent 仿酒馆

- [ ] 协调器 host 插件：continuable subagent 路由、轮转、抢话
- [ ] 角色卡/世界书存储（`dsh-storage` + session event 可见性）
- [ ] client 角色列表 sidebar slot
- [ ] keyed `conversation.chat.node` 角色气泡 UI
- [ ] 最小闭环：2 角色轮流群聊

### 4. 内部终端

- [ ] 评估并实现 xterm.js 嵌入面板（client slot + host RPC）
- [ ] 处理 `ctx.terminals` 的 Agent owner 语义
- [ ] Ghostty "弹出到外部窗口" 作为补充功能

### 5. Git 可视化

- [ ] `dsh-git-tool`：log/diff/show/blame/status，规范 JSON 输出
- [ ] 持久 `git/graph` 会话事件
- [ ] ConversationNode SVG DAG 渲染
- [ ] 评估上游 `card: 'git-graph'` render-intent 扩展

### 6. 其他

- [ ] MCP 服务器接入示例
- [ ] Claude Code / Codex hooks 桥接
- [ ] 自定义 LLM 适配器
- [ ] 跨会话 cron（host 插件 + timer + sessions）
- [ ] 编辑器 follow/locations 集成
