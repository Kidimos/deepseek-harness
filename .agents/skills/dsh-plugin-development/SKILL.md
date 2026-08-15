---
name: dsh-plugin-development
description: Use when developing, packaging, verifying, publishing, or installing DeepSeek Harness plugins — deciding host vs preset vs client placement, writing tools/UI/bundles, following official docs, using the cordis AI preset, or planning plugin scenarios.
whenToUse: Create or modify an out-of-tree DSH plugin bundle, a client UI plugin, an agent preset, or a DSH distribution package; also use when planning multi-scenario plugin work.
---

# DSH 插件开发

本 Skill 总结当前会话中关于 DeepSeek Harness 插件开发的关键结论，作为开发时的快速索引。详细机制以官方文档为准，本文只给流程和坑位。

## 核心模型

- DSH 是"一切都是插件"的 Cordis 应用：没有特权内核，agent loop、工具、LLM 适配器、UI 都是插件。
- 组合顺序：空根 → profile.bundles[] 各 bundle patch → profile cordis.patch.yml → home cordis.patch.yml → `--patch` overlay。后层按行 id 覆盖，**patch 替换整行 config，不深合并**。
- 两个平面 + client 名册：
  - Host：跨会话服务/注册表/sandbox/approval/model route/subagent registry。
  - Agent preset：单会话工具/persona/prompt section；发布服务的行必须放在 `isolate` realm 组。
  - Client：浏览器 UI 插件，通过 `dsh.client` manifest 进入 web bundle。
- 能力 seam 必须完整：Service Definition / Service Provider / Consumer。换 provider 即可换执行世界。
- 不变量：注册即副作用、可逆；模型可见 ⟺ 已写 session log；可调参数必须 Config，禁止硬编码；UI 走 slot/token，不碰 document.body。

## 官方文档地图

- 入门：`docs/cordis-tutorial/`
- 产品教程：`docs/user/develop/basic/{index,tool,config,publish}.zh.md`
- 框架：`docs/user/develop/framework/`、`docs/user/develop/practice/`
- 参考：`docs/cookbook/adding-a-tool.zh.md`、`adding-a-package.zh.md`、`extension-cookbook.zh.md`、`adding-a-conversation-node.zh.md`
- Web：`docs/web-styling.zh.md`、`packages/client/AGENTS.md`
- CLI/profile：`apps/cli/reference/README.zh.md`
- 可运行示例：`examples/*/cordis.yml`

## 开发流程

1. 本地原型：`scratch-plugin/src/my-plugin.ts` + `--patch ./scratch-plugin/cordis.yml`，用 `pnpm dsh web --patch ...` 验证。
2. 定平面：跨会话服务 → Host bundle；单会话工具/persona → agent preset；浏览器 UI → client 插件。
3. 打包：
   - `package.json` 声明 `dsh.bundle.patch` 指向 `cordis.patch.yml`。
   - client 插件还要 `dsh.client` manifest、`exports["./client"]`、node half。
   - TS 源码用 `.ts` 相对导入；tsconfig 使用 `rewriteRelativeImportExtensions`，产物为 `lib/`。
4. 验证：
   - `dsh --profile <name> --dump-config`
   - 启动 smoke
   - `pnpm --dir <pkg> run build`
   - `pnpm pack --dry-run` 检查产物清单
5. 发布：
   - npm 预构建产物（推荐）
   - `pnpm pack` tarball
   - git 直装：作者提供自包含 `prepare`，用户 `allowBuilds` + 锁 commit

## AI 辅助路径

- 使用 `cordis` agent preset（创造模式）。
- 先 `cordis_inspect` 查真实 services/events/slots/tokens，再 `cordis_define` + `cordis_run` 做临时动态插件。
- 动态插件进程内、不跨重启；验证后提升为真实静态包。
- 编辑 composition 用 `editing-cordis-compositions` skill；永不改 shipped preset，copy 后改。
- 用户 preset 在 `${DSH_HOME}/.agent-presets/`，用 `agentPresets.copy()` + `standingKeyFor()` 验证。

## 常见坑

- `web` 是 DSH CLI 硬编码子命令，作为 app 参数时必须用 `--target web` 或 TUI，不能直接 `dsh --profile router web`。
- `lib/` 被根 `.gitignore` 忽略，源码仓库不提交构建产物；clone 后需 `pnpm --dir <pkg> run build`。
- 嵌套 pnpm 会导致 Ctrl+C 出现多条 `[ELIFECYCLE]`；想减少就避免 pnpm 层。
- router 类插件应排除当前 profile，避免自递归。
- 函数插件命名导出 `name/inject/Config/apply`，不能混 default export。
- 依赖 Service Definition，不依赖具体 provider。

## 场景映射

| 场景 | 推荐机制 |
|---|---|
| Monokai/主题/背景 | client 插件 + `ctx.theme.register()` + 插件自身 CSS |
| 逆向特化 Agent（IDA/Safari/iOS） | 新能力 seam：Definition/Provider/Consumer + `ctx.subprocess` + workflow/ralph 编排 |
| 多 Agent 仿酒馆 | subagent continuable + 协调器 host 插件 + client ConversationNode 角色 UI |
| 内部终端 | 现有 `ctx.terminals` + client slot + host RPC；Ghostty 只能弹窗，不能嵌网页 |
| Git 可视化 | `dsh-git-tool` + 会话事件 + ConversationNode SVG；或上游扩展 render-intent union |
| 其他 | MCP、hooks、LLM adapter、skills、cron、editor locations 等按 architecture 映射表 |

## 当前示例：dsh-router

- 双角色 npm 包：`bin`（独立 CLI）+ `dsh.bundle`（DSH 插件）。
- 源码在 `plugins/dsh-router/src/`，TS 编译到 `lib/`。
- 根脚本：`pnpm router`（tsx 开发态）。
- 插件内排除当前 profile；独立 CLI 也排除 `router`。
- TUI 用 raw mode + ANSI 原地重绘，Monokai 配色。
