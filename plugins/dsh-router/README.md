# dsh-router

DeepSeek Harness profile router。同一个包提供两种形态：

- **CLI**：`dsh-router`，在 profile 启动前列出 `$DSH_HOME/profiles` 并选择。
- **DSH bundle 插件**：安装到 `router` profile 后，`dsh --profile router` 启动时显示同一个 TUI。

## 开发与构建

```sh
# 开发时直接跑 TS 源码（仓库根）
pnpm router
# 编译到 lib/
pnpm --dir plugins/dsh-router run build
# 跑编译产物
node plugins/dsh-router/lib/bin.js
```

## CLI 用法

```sh
pnpm router
# 或从包目录
pnpm --dir plugins/dsh-router start
# 直接指定目标 profile，跳过 TUI（web 是 DSH 子命令，需用 --target）
node plugins/dsh-router/lib/bin.js --target web
# 非子命令名也可用位置参数
node plugins/dsh-router/lib/bin.js headless
# 透传 DSH 参数
node plugins/dsh-router/lib/bin.js --target web --port 3080
```

## 作为 DSH 插件使用

```sh
dsh plugin --profile router add ./plugins/dsh-router
dsh --profile router
# 也可直接指定目标 profile，跳过 TUI
dsh --profile router --target web
```

`dsh-router` 插件会读取 `ctx.cmdlineArgs`；`--target <profile>` 指定目标，其余参数透传给子进程。由于 `web` 是 DSH CLI 的硬编码子命令，作为 router 插件的 app 参数时必须用 `--target web`，不能直接写成 `dsh --profile router web`。

## 行为

- 读取 `$DSH_HOME/profiles`（默认 `~/.dsh/profiles`），排除 `node_modules` 和隐藏目录。
- 启动命令自动探测：向上查找含 `package.json` 且带 `scripts.dsh` 的目录时用 `pnpm dsh`，否则用 `dsh`。
- 通过 `DSH_ROUTER_COMMAND` 可覆盖启动命令，例如 `pnpm dsh` 或 `dsh`。
- 防止路由到当前正在运行的 profile，避免 `dsh --profile router` 自递归。

## 环境变量

| 变量 | 默认 | 含义 |
|---|---|---|
| `DSH_HOME` | `~/.dsh` | Harness home |
| `DSH_ROUTER_COMMAND` | 自动探测 | 覆盖启动命令 |
