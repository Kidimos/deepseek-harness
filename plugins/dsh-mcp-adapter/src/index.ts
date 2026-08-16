/**
 * MCP Adapter host half: manages MCP servers lazily. Servers are inactive by
 * default and only connect/register tools when explicitly activated. This
 * keeps MCP tool schemas out of the model context until needed.
 */
import { spawn, type ChildProcess } from 'node:child_process'
import type { IncomingMessage, ServerResponse } from 'node:http'

/** One MCP server configured for this adapter. */
interface ServerConfig {
  serverName: string
  command: string
  args: string[]
  env?: Record<string, string>
  cwd?: string
}

/** Adapter plugin config. */
interface AdapterConfig {
  servers?: ServerConfig[]
}

type ServerStatus = 'inactive' | 'connecting' | 'active' | 'error'

interface ManagedServer {
  config: ServerConfig
  status: ServerStatus
  error?: string
  child?: ChildProcess
  nextId: number
  buffer: string
  pending: Map<number, (message: Record<string, unknown>) => void>
  disposers: Map<string, () => void>
  tools: Array<{
    name: string
    description: string
    parameters: Record<string, unknown>
    rawName: string
  }>
}

/** The tool registry face (official service, injected). */
interface ToolsFace {
  schemas(): readonly ToolSchema[]
  register(definition: unknown): () => void
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

/** Services required by the MCP adapter plugin. */
export const inject = ['webServer', 'tools']

/** Route prefix owned by this plugin. */
const BASE = '/dsh-mcp'

/** Default per-request timeout for MCP JSON-RPC calls. */
const REQUEST_TIMEOUT_MS = 30_000

/** Read a JSON body with a hard byte cap; null on malformed/oversized input. */
async function readJson(req: IncomingMessage): Promise<Record<string, unknown> | null> {
  const chunks: Buffer[] = []
  let total = 0
  for await (const chunk of req) {
    const buffer = chunk as Buffer
    total += buffer.byteLength
    if (total > 4 * 1024 * 1024) return null
    chunks.push(buffer)
  }
  try {
    const value: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    return typeof value === 'object' && value !== null ? value as Record<string, unknown> : null
  } catch {
    return null
  }
}

/** Build the model-facing public name for an MCP tool. */
function publicToolName(serverName: string, rawName: string): string {
  return `mcp__${serverName}__${rawName}`
}

/** Send one JSON-RPC request to a managed MCP server and await its response. */
function sendRequest(server: ManagedServer, method: string, params: unknown): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const id = server.nextId++
    const timer = setTimeout(() => {
      server.pending.delete(id)
      reject(new Error(`MCP request timed out: ${method}`))
    }, REQUEST_TIMEOUT_MS)
    server.pending.set(id, (message) => {
      clearTimeout(timer)
      if (message.error !== undefined) {
        reject(new Error(JSON.stringify(message.error)))
      } else {
        resolve(message.result as Record<string, unknown>)
      }
    })
    const payload = {
      jsonrpc: '2.0',
      id,
      method,
      ...(params === undefined ? {} : { params }),
    }
    server.child?.stdin?.write(`${JSON.stringify(payload)}\n`)
  })
}

/** Send a JSON-RPC notification (no response). */
function sendNotification(server: ManagedServer, method: string, params?: unknown): void {
  const payload = {
    jsonrpc: '2.0',
    method,
    ...(params === undefined ? {} : { params }),
  }
  server.child?.stdin?.write(`${JSON.stringify(payload)}\n`)
}

/** Create a ToolDefinition-shaped object for ctx.tools.register. */
function createToolDefinition(
  server: ManagedServer,
  tool: { rawName: string; description: string; parameters: Record<string, unknown> },
): unknown {
  const publicName = publicToolName(server.config.serverName, tool.rawName)
  return {
    name: publicName,
    description: tool.description,
    parameters: tool.parameters,
    output: {
      schema: {
        type: 'object',
        properties: {
          content: { type: 'array', items: {} },
          structuredContent: {},
        },
        required: ['content'],
        additionalProperties: false,
      },
      render: () => [{ type: 'text', text: `[mcp:${server.config.serverName}:${tool.rawName}]` }],
    },
    execute: async (args: unknown) => {
      const result = await sendRequest(server, 'tools/call', {
        name: tool.rawName,
        arguments: args ?? {},
      })
      return { content: result.content ?? [], structuredContent: result.structuredContent }
    },
  }
}

/**
 * Mount the MCP adapter.
 * @param ctx - host root context.
 * @param config - adapter configuration.
 */
export function apply(ctx: PluginContext, config: AdapterConfig = {}): void {
  const webServer = ctx.webServer
  const servers = new Map<string, ManagedServer>()

  for (const serverConfig of config.servers ?? []) {
    if (!servers.has(serverConfig.serverName)) {
      servers.set(serverConfig.serverName, {
        config: serverConfig,
        status: 'inactive',
        nextId: 1,
        buffer: '',
        pending: new Map(),
        disposers: new Map(),
        tools: [],
      })
    }
  }

  const unregisterAll = (server: ManagedServer): void => {
    for (const dispose of server.disposers.values()) dispose()
    server.disposers.clear()
    server.tools = []
  }

  const teardownChild = (server: ManagedServer): void => {
    if (server.child) {
      server.child.kill('SIGTERM')
      server.child = undefined
    }
    server.pending.clear()
  }

  const setStatus = (server: ManagedServer, status: ServerStatus, error?: string): void => {
    server.status = status
    server.error = error
  }

  const activate = async (serverName: string): Promise<void> => {
    const server = servers.get(serverName)
    if (!server) throw new Error(`unknown MCP server: ${serverName}`)
    if (server.status === 'active' || server.status === 'connecting') return

    unregisterAll(server)
    teardownChild(server)
    setStatus(server, 'connecting')

    try {
      const child = spawn(server.config.command, server.config.args, {
        cwd: server.config.cwd,
        env: { ...process.env as Record<string, string>, ...(server.config.env ?? {}) },
        stdio: ['pipe', 'pipe', 'pipe'],
      })
      server.child = child

      child.stderr?.on('data', (chunk: Buffer) => {
        const text = chunk.toString()
        if (text.trim() !== '') console.error(`[mcp-adapter:${serverName}] ${text.trim()}`)
      })

      child.stdout?.on('data', (chunk: Buffer) => {
        server.buffer += chunk.toString()
        let newlineIndex: number
        while ((newlineIndex = server.buffer.indexOf('\n')) !== -1) {
          const line = server.buffer.slice(0, newlineIndex).trim()
          server.buffer = server.buffer.slice(newlineIndex + 1)
          if (line === '') continue
          try {
            const message = JSON.parse(line) as Record<string, unknown>
            if (typeof message.id === 'number') {
              const pending = server.pending.get(message.id)
              if (pending) {
                server.pending.delete(message.id)
                pending(message)
              }
            }
          } catch {
            // ignore non-JSON lines from the MCP server
          }
        }
      })

      child.on('error', (error) => {
        setStatus(server, 'error', error.message)
        unregisterAll(server)
        teardownChild(server)
      })

      child.on('exit', (code, signal) => {
        if (server.status === 'active' || server.status === 'connecting') {
          setStatus(server, 'error', `MCP server exited (code=${code ?? 'null'}, signal=${signal ?? 'null'})`)
          unregisterAll(server)
          teardownChild(server)
        }
      })

      // MCP handshake: initialize -> initialized -> tools/list
      await sendRequest(server, 'initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'dsh-mcp-adapter', version: '0.0.1' },
      })
      sendNotification(server, 'notifications/initialized')

      const listed = await sendRequest(server, 'tools/list', {})
      const rawTools = (listed.tools ?? []) as Array<{
        name: string
        description?: string
        inputSchema?: Record<string, unknown>
      }>

      for (const raw of rawTools) {
        const tool = {
          rawName: raw.name,
          description: raw.description ?? '',
          parameters: raw.inputSchema ?? {},
        }
        const definition = createToolDefinition(server, tool)
        const dispose = ctx.tools.register(definition)
        server.disposers.set(publicToolName(server.config.serverName, raw.name), dispose)
        server.tools.push({
          name: publicToolName(server.config.serverName, raw.name),
          description: tool.description,
          parameters: tool.parameters,
          rawName: raw.name,
        })
      }

      setStatus(server, 'active')
    } catch (error) {
      setStatus(server, 'error', error instanceof Error ? error.message : 'activation failed')
      unregisterAll(server)
      teardownChild(server)
    }
  }

  const deactivate = (serverName: string): void => {
    const server = servers.get(serverName)
    if (!server) return
    unregisterAll(server)
    teardownChild(server)
    setStatus(server, 'inactive')
  }

  const serversHandler = (_req: IncomingMessage, res: ServerResponse): void => {
    const list = [...servers.values()].map(server => ({
      serverName: server.config.serverName,
      status: server.status,
      error: server.error,
      toolCount: server.tools.length,
      tools: server.tools,
    }))
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ servers: list }))
  }

  const activateHandler = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const body = await readJson(req)
    const serverName = body?.serverName
    if (typeof serverName !== 'string') {
      res.writeHead(400)
      res.end('bad request')
      return
    }
    try {
      await activate(serverName)
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: true }))
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : 'activation failed' }))
    }
  }

  const deactivateHandler = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const body = await readJson(req)
    const serverName = body?.serverName
    if (typeof serverName !== 'string') {
      res.writeHead(400)
      res.end('bad request')
      return
    }
    deactivate(serverName)
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: true }))
  }

  const toolsHandler = (_req: IncomingMessage, res: ServerResponse): void => {
    const tools: Array<Record<string, unknown>> = []
    for (const server of servers.values()) {
      for (const tool of server.tools) {
        tools.push({
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters,
          serverName: server.config.serverName,
          rawName: tool.rawName,
        })
      }
    }
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ tools }))
  }

  const disposeRoutes = [
    webServer.register({ kind: 'exact', path: `${BASE}/servers`, handler: serversHandler }),
    webServer.register({ kind: 'exact', path: `${BASE}/activate`, handler: activateHandler }),
    webServer.register({ kind: 'exact', path: `${BASE}/deactivate`, handler: deactivateHandler }),
    webServer.register({ kind: 'exact', path: `${BASE}/tools`, handler: toolsHandler }),
  ]
  ctx.effect(() => () => {
    for (const server of servers.values()) {
      unregisterAll(server)
      teardownChild(server)
    }
    for (const dispose of disposeRoutes) dispose()
  }, 'dsh-mcp-adapter: teardown')
}
