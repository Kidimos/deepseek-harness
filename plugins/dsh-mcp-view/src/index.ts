/**
 * MCP visualization host half: exposes /dsh-mcp/tools so the browser tool can
 * list the MCP tools currently registered on ctx.tools.
 */
import type { IncomingMessage, ServerResponse } from 'node:http'

/** The tool registry face (official service, injected). */
interface ToolsFace {
  schemas(): readonly ToolSchema[]
}

interface ToolSchema {
  name: string
  description: string
  parameters: Record<string, unknown>
}

/** The webserver route face (official service, injected). */
interface WebServerFace {
  register(route: {
    kind: 'exact'
    path: string
    handler: (req: IncomingMessage, res: ServerResponse) => void | Promise<void>
  }): () => void
}

/** The host context face this apply world reads. */
interface PluginContext {
  webServer: WebServerFace
  tools: ToolsFace
  effect(fn: () => void | (() => void), name?: string): unknown
}

/** Services required by the MCP view plugin. */
export const inject = ['webServer', 'tools']

/** Route prefix owned by this plugin. */
const BASE = '/dsh-mcp'

/** Parse a public MCP tool name into server and raw tool name. */
function parseMcpName(name: string): { serverName: string; rawName: string } | null {
  if (!name.startsWith('mcp__')) return null
  const rest = name.slice('mcp__'.length)
  const separator = rest.indexOf('__')
  if (separator === -1) return null
  return {
    serverName: rest.slice(0, separator),
    rawName: rest.slice(separator + 2),
  }
}

/**
 * Mount the MCP tool list route.
 * @param ctx - host root context.
 */
export function apply(ctx: PluginContext): void {
  const webServer = ctx.webServer

  const toolsHandler = (_req: IncomingMessage, res: ServerResponse): void => {
    const schemas = ctx.tools.schemas()
    const tools = schemas
      .filter(schema => schema.name.startsWith('mcp__'))
      .map(schema => {
        const parsed = parseMcpName(schema.name)
        return {
          name: schema.name,
          description: schema.description,
          parameters: schema.parameters,
          serverName: parsed?.serverName,
          rawName: parsed?.rawName,
        }
      })
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ tools }))
  }

  const disposeRoutes = [
    webServer.register({ kind: 'exact', path: `${BASE}/tools`, handler: toolsHandler }),
  ]
  ctx.effect(() => () => {
    for (const dispose of disposeRoutes) dispose()
  }, 'dsh-mcp-view: routes')
}
