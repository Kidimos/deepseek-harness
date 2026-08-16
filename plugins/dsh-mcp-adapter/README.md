# @dsh-external/dsh-client-ui-mcp-adapter

MCP Adapter 工具插件，挂载到 dsh-toolbox 的 `toolbox.tool` 槽位。

- 默认不激活 MCP server，避免工具 schema 常驻上下文
- 支持手动激活 / 停用
- 显示 server 状态：inactive / connecting / active / error
- 激活后才注册工具并展示工具列表
- 支持多 MCP server 独立控制
- 通过 host 路由：
  - `GET /dsh-mcp/servers`
  - `POST /dsh-mcp/activate`
  - `POST /dsh-mcp/deactivate`
  - `GET /dsh-mcp/tools`
