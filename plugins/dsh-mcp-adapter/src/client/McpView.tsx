/**
 * MCP Adapter tool card. Shows configured MCP servers with lazy lifecycle:
 * inactive servers do not register tools and do not occupy model context.
 * Users can activate/deactivate servers from this panel.
 */
import { useEffect, useMemo, useState } from 'react'
import type { McpViewProps } from './contract.ts'
import css from './McpView.module.css'

type ServerStatus = 'inactive' | 'connecting' | 'active' | 'error'

interface McpTool {
  name: string
  description: string
  parameters: Record<string, unknown>
  serverName?: string
  rawName?: string
}

interface McpServerInfo {
  serverName: string
  status: ServerStatus
  error?: string
  toolCount: number
  tools: McpTool[]
}

interface ServersResponse {
  servers: McpServerInfo[]
}

interface ActionResponse {
  ok: boolean
  error?: string
}

async function post<T>(route: string, body: unknown): Promise<T> {
  const response = await fetch(route, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!response.ok) throw new Error(await response.text())
  return await response.json() as T
}

async function fetchServers(): Promise<McpServerInfo[]> {
  const response = await fetch('/dsh-mcp/servers')
  if (!response.ok) throw new Error(await response.text())
  const data = await response.json() as ServersResponse
  return data.servers
}

export function McpView({ t }: McpViewProps) {
  const [servers, setServers] = useState<McpServerInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [expandedServers, setExpandedServers] = useState<Set<string>>(new Set())
  const [expandedTools, setExpandedTools] = useState<Set<string>>(new Set())
  const [busyServer, setBusyServer] = useState<string | null>(null)

  const load = async (): Promise<void> => {
    setLoading(true)
    setError('')
    try {
      setServers(await fetchServers())
    } catch {
      setError(t('error'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (q === '') return servers
    return servers.filter(server =>
      server.serverName.toLowerCase().includes(q)
      || server.tools.some(tool =>
        tool.name.toLowerCase().includes(q)
        || tool.description.toLowerCase().includes(q)
        || (tool.rawName ?? '').toLowerCase().includes(q),
      ),
    )
  }, [servers, query])

  const toggleServer = (server: string): void => {
    setExpandedServers(prev => {
      const next = new Set(prev)
      if (next.has(server)) next.delete(server)
      else next.add(server)
      return next
    })
  }

  const toggleTool = (name: string): void => {
    setExpandedTools(prev => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  const activate = async (serverName: string): Promise<void> => {
    setBusyServer(serverName)
    setError('')
    try {
      await post<ActionResponse>('/dsh-mcp/activate', { serverName })
      await load()
      setExpandedServers(prev => new Set(prev).add(serverName))
    } catch {
      setError(t('error'))
    } finally {
      setBusyServer(null)
    }
  }

  const deactivate = async (serverName: string): Promise<void> => {
    setBusyServer(serverName)
    setError('')
    try {
      await post<ActionResponse>('/dsh-mcp/deactivate', { serverName })
      await load()
      setExpandedServers(prev => {
        const next = new Set(prev)
        next.delete(serverName)
        return next
      })
    } catch {
      setError(t('error'))
    } finally {
      setBusyServer(null)
    }
  }

  return (
    <div className={css.root}>
      <div className={css.toolbar}>
        <input
          className={css.search}
          type="search"
          placeholder={t('search')}
          value={query}
          onChange={(event: { target: { value: string } }) => setQuery(event.target.value)}
        />
        <button type="button" className={css.refresh} onClick={() => { void load() }}>
          {t('refresh')}
        </button>
      </div>
      <div className={css.body}>
        {loading && <div className={css.hint}>{t('loading')}</div>}
        {!loading && error !== '' && <div className={css.hint}>{error}</div>}
        {!loading && error === '' && filtered.length === 0 && <div className={css.hint}>{t('empty')}</div>}
        {!loading && filtered.map(server => {
          const serverExpanded = expandedServers.has(server.serverName)
          const isActive = server.status === 'active'
          const isBusy = busyServer === server.serverName
          return (
            <section key={server.serverName} className={css.group}>
              <div className={css.serverCard}>
                <button type="button" className={css.serverMain} onClick={() => toggleServer(server.serverName)}>
                  <span className={css.serverName}>{server.serverName}</span>
                  <span className={`${css.statusBadge} ${css[server.status]}`}>
                    {t(server.status === 'error' ? 'statusError' : server.status)}
                  </span>
                  <span className={css.groupCount}>{server.toolCount}</span>
                  <span className={css.chevron} aria-hidden>{serverExpanded ? '▾' : '▸'}</span>
                </button>
                <button
                  type="button"
                  className={css.actionBtn}
                  disabled={isBusy || server.status === 'connecting'}
                  onClick={() => { void (isActive ? deactivate(server.serverName) : activate(server.serverName)) }}
                >
                  {isBusy ? t('loading') : (isActive ? t('deactivate') : t('activate'))}
                </button>
              </div>
              {server.error && server.status === 'error' && <div className={css.serverError}>{server.error}</div>}
              {serverExpanded && isActive && (
                <div className={css.toolList}>
                  {server.tools.map(tool => (
                    <div key={tool.name} className={css.toolRow}>
                      <button type="button" className={css.toolHeader} onClick={() => toggleTool(tool.name)}>
                        <span className={css.toolName}>{tool.rawName ?? tool.name}</span>
                        <span className={css.toolFullName}>{tool.name}</span>
                      </button>
                      <p className={css.toolDescription}>{tool.description}</p>
                      {expandedTools.has(tool.name) && (
                        <pre className={css.schema}>{JSON.stringify(tool.parameters, null, 2)}</pre>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          )
        })}
      </div>
    </div>
  )
}
