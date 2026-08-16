---
name: dsh-mcp-adapter
description: Use when registering or managing MCP servers through the dsh-mcp-adapter toolbox plugin — lazy lifecycle, activation/deactivation, status query, and future MCP tool improvements.
whenToUse: Add a new MCP server to the DSH toolbox, change MCP activation behavior, debug MCP context occupation, or extend the MCP adapter plugin.
---

# MCP Adapter：MCP 服务器注册与生命周期

`plugins/dsh-mcp-adapter`（`@dsh-external/dsh-client-ui-mcp-adapter`）是 toolbox 上的 MCP 工具插件。它不只是“查看 MCP 工具”，而是 **MCP 服务器生命周期控制器**：

- 默认 **inactive**，不连接、不注册工具
- 手动激活后才连接 MCP server 并注册工具到 `ctx.tools`
- 停用后注销工具并断开子进程
- 因此 MCP 工具 schema 不会常驻模型上下文

## MCP 服务器注册方式

在 profile 的 `cordis.patch.yml` 中注册一个 adapter 实例，并在 `servers` 下列出要管理的 MCP 服务器：

```yaml
- insert:
    - id: mcp-adapter
      name: '@dsh-external/dsh-client-ui-mcp-adapter'
      config:
        servers:
          - serverName: gmail
            command: npx
            args:
              - -y
              - '@gongrzhe/server-gmail-autoauth-mcp'
          - serverName: my-server
            command: my-mcp-server
            args: []
            env:
              TOKEN: !!js process.env.MY_MCP_TOKEN
            cwd: /path/to/workdir
```

字段说明：

| 字段 | 必填 | 说明 |
|---|---|---|
| `serverName` | 是 | 工具命名空间，最终工具名形如 `mcp__<serverName>__<rawName>` |
| `command` | 是 | 要 spawn 的可执行文件，例如 `npx` |
| `args` | 是 | 命令行参数 |
| `env` | 否 | 额外环境变量，合并到父进程环境之上 |
| `cwd` | 否 | 子进程工作目录 |

## 生命周期

```
inactive ──activate──▶ connecting ──成功──▶ active
   ▲                    │                    │
   │                    │ 失败               │ deactivate
   └────────────────────┴────────────────────┘
                       error
```

- `inactive`：默认，不占上下文
- `connecting`：正在 spawn + 握手 + tools/list
- `active`：已注册工具，工具进入模型上下文
- `error`：连接失败或进程退出，工具已注销

## Host 路由

| 路由 | 方法 | 说明 |
|---|---|---|
| `/dsh-mcp/servers` | GET | 查询所有 server 状态、工具数、工具列表 |
| `/dsh-mcp/activate` | POST | 激活指定 server，body `{ serverName }` |
| `/dsh-mcp/deactivate` | POST | 停用指定 server，body `{ serverName }` |
| `/dsh-mcp/tools` | GET | 返回当前已激活的所有 MCP 工具 |

## 技术特点

1. **懒启动**：默认不 spawn、不注册，避免 MCP schema 常驻上下文
2. **手动控制**：通过 UI 或 HTTP 路由激活/停用
3. **自持 MCP 客户端**：不依赖 `@deepseek-ai/dsh-mcp-client` 的启动即连接行为
4. **纯插件**：只使用 `ctx.tools`、`ctx.webServer`、`toolbox.tool` 等公共面，不改 Harness
5. **多 server 独立控制**：每个 server 有独立状态和工具注册
6. **状态可视化**：toolbox 面板显示 `inactive / connecting / active / error`
7. **进程清理**：停用/卸载时 kill 子进程并注销全部工具

## 实现位置

| 文件 | 职责 |
|---|---|
| `plugins/dsh-mcp-adapter/src/index.ts` | host 半边：MCP 生命周期管理 + HTTP 路由 |
| `plugins/dsh-mcp-adapter/src/client/McpView.tsx` | 工具面板：状态、激活/停用、工具列表 |
| `plugins/dsh-mcp-adapter/src/client/McpView.module.css` | 面板样式 |
| `plugins/dsh-mcp-adapter/src/client/index.ts` | 注册 `toolbox.tool` 并挂 M 图标 |
| `plugins/dsh-mcp-adapter/cordis.patch.yml` | bundle 插件行 |

## 当前限制与未来改进

- **协议能力较基础**：当前实现了 `initialize` / `notifications/initialized` / `tools/list` / `tools/call` 的 stdio JSON-RPC 子集
- **未实现分页拉取**：`tools/list` 的 `nextCursor` 分页尚未处理
- **未实现 outputSchema 校验**：工具结果未按 MCP outputSchema 做严格校验
- **未实现自动重连**：断线后目前进入 error，需要手动重新激活
- **未实现“首次调用自动激活”**：目前只能手动激活；未来可做成模型第一次调用该工具时自动激活
- **未实现按会话/按工具过滤**：未来可只暴露当前会话需要的 MCP 工具，进一步减少上下文
- **未实现 MCP 工具调用面板**：目前只展示工具，后续可加入直接从 UI 调用/调试工具
- **Office/二进制等 MCP 结果展示**：可扩展更丰富的 result 渲染

## 验证方法

1. 启动 DSH 后打开 MCP 面板，确认 server 为 `inactive`
2. 点击激活，确认状态变为 `active`，工具数量正确
3. 查看 session.jsonl，确认激活前 `request/header` 没有 `mcp__*` 工具
4. 停用后，确认 `request/header` 中 MCP 工具消失
5. 多 server 场景下，确认每个 server 独立控制
