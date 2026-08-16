/**
 * File tree + preview host half: exposes /dsh-file-preview routes that read
 * the active session workspace through node fs. The browser tool calls these
 * routes to list directories and read file contents for preview.
 */
import { readFile, readdir, writeFile } from 'node:fs/promises'
import { extname, join, relative, resolve, sep } from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'

/** The sessions-service face (official service, injected). */
interface SessionsFace {
  get(id: string): { header: { cwd?: string } } | undefined
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
  sessions: SessionsFace
  effect(fn: () => void | (() => void), name?: string): unknown
}

/** Services required by the file preview plugin. */
export const inject = ['webServer', 'sessions']

/** Route prefix owned by this plugin. */
const BASE = '/dsh-file-preview'

/** Binary extensions served as base64 for browser preview. */
const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.zip', '.tar', '.gz', '.mp3', '.mp4', '.mov',
])

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

/** Resolve a user-supplied path inside the session workspace; null if escape. */
function resolveInWorkspace(cwd: string, requestPath: unknown): string | null {
  if (typeof requestPath !== 'string' || requestPath === '') return cwd
  const abs = resolve(cwd, requestPath)
  const rel = relative(cwd, abs)
  if (rel === '..' || rel.startsWith(`..${sep}`) || rel.startsWith('../')) return null
  return abs
}

/**
 * Mount the file tree/preview routes.
 * @param ctx - host root context.
 */
export function apply(ctx: PluginContext): void {
  const webServer = ctx.webServer
  const sessions = ctx.sessions

  const treeHandler = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const body = await readJson(req)
    const sessionId = body?.sessionId
    if (typeof sessionId !== 'string') {
      res.writeHead(400)
      res.end('bad request')
      return
    }
    const cwd = sessions.get(sessionId)?.header.cwd
    if (typeof cwd !== 'string' || cwd === '') {
      res.writeHead(404)
      res.end('no workspace')
      return
    }
    const target = resolveInWorkspace(cwd, body?.path)
    if (target === null) {
      res.writeHead(400)
      res.end('path outside workspace')
      return
    }
    try {
      const entries = await readdir(target, { withFileTypes: true })
      const list = entries
        .map(entry => ({
          name: entry.name,
          path: relative(cwd, join(target, entry.name)).split(sep).join('/'),
          type: entry.isDirectory() ? 'directory' : entry.isFile() ? 'file' : 'other',
        }))
        .sort((a, b) => {
          if (a.type === 'directory' && b.type !== 'directory') return -1
          if (a.type !== 'directory' && b.type === 'directory') return 1
          return a.name.localeCompare(b.name)
        })
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        path: relative(cwd, target).split(sep).join('/') || '.',
        entries: list,
      }))
    } catch (error) {
      res.writeHead(500)
      res.end(error instanceof Error ? error.message : 'read directory failed')
    }
  }

  const readHandler = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const body = await readJson(req)
    const sessionId = body?.sessionId
    if (typeof sessionId !== 'string' || typeof body?.path !== 'string' || body.path === '') {
      res.writeHead(400)
      res.end('bad request')
      return
    }
    const cwd = sessions.get(sessionId)?.header.cwd
    if (typeof cwd !== 'string' || cwd === '') {
      res.writeHead(404)
      res.end('no workspace')
      return
    }
    const target = resolveInWorkspace(cwd, body.path)
    if (target === null) {
      res.writeHead(400)
      res.end('path outside workspace')
      return
    }
    try {
      const ext = extname(target).toLowerCase()
      if (BINARY_EXTENSIONS.has(ext)) {
        const buffer = await readFile(target)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ content: buffer.toString('base64'), encoding: 'base64' }))
        return
      }
      const content = await readFile(target, 'utf8')
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ content, encoding: 'utf8' }))
    } catch (error) {
      res.writeHead(500)
      res.end(error instanceof Error ? error.message : 'read file failed')
    }
  }

  const writeHandler = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const body = await readJson(req)
    const sessionId = body?.sessionId
    if (typeof sessionId !== 'string' || typeof body?.path !== 'string' || body.path === '' || typeof body?.content !== 'string') {
      res.writeHead(400)
      res.end('bad request')
      return
    }
    const cwd = sessions.get(sessionId)?.header.cwd
    if (typeof cwd !== 'string' || cwd === '') {
      res.writeHead(404)
      res.end('no workspace')
      return
    }
    const target = resolveInWorkspace(cwd, body.path)
    if (target === null) {
      res.writeHead(400)
      res.end('path outside workspace')
      return
    }
    try {
      await writeFile(target, body.content, 'utf8')
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: true }))
    } catch (error) {
      res.writeHead(500)
      res.end(error instanceof Error ? error.message : 'write file failed')
    }
  }

  const disposeRoutes = [
    webServer.register({ kind: 'exact', path: `${BASE}/tree`, handler: treeHandler }),
    webServer.register({ kind: 'exact', path: `${BASE}/read`, handler: readHandler }),
    webServer.register({ kind: 'exact', path: `${BASE}/write`, handler: writeHandler }),
  ]
  ctx.effect(() => () => {
    for (const dispose of disposeRoutes) dispose()
  }, 'dsh-file-preview: routes')
}
