/**
 * MCP visualization tool card. Lists MCP tools registered on the host,
 * grouped by server, with descriptions and expandable input schemas.
 */
import { useEffect, useMemo, useState } from 'react'
import type { McpViewProps } from './contract.ts'
import css from './McpView.module.css'

interface McpTool {
  name: string
  description: string
  parameters: Record<string, unknown>
  serverName?: string
  rawName?: string
}

interface ToolsResponse {
  tools: McpTool[]
}

async function fetchTools(): Promise<McpTool[]> {
  const response = await fetch('/dsh-mcp/tools')
  if (!response.ok) throw new Error(await response.text())
  const data = await response.json() as ToolsResponse
  return data.tools
}

export function McpView({ t }: McpViewProps) {
  const [tools, setTools] = useState<McpTool[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [expandedServers, setExpandedServers] = useState<Set<string>>(new Set())
  const [expandedTools, setExpandedTools] = useState<Set<string>>(new Set())

  const load = async (): Promise<void> => {
    setLoading(true)
    setError('')
    try {
      setTools(await fetchTools())
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
    if (q === '') return tools
    return tools.filter(tool =>
      tool.name.toLowerCase().includes(q)
      || tool.description.toLowerCase().includes(q)
      || (tool.serverName ?? '').toLowerCase().includes(q)
      || (tool.rawName ?? '').toLowerCase().includes(q),
    )
  }, [tools, query])

  const groups = useMemo(() => {
    const map = new Map<string, McpTool[]>()
    for (const tool of filtered) {
      const key = tool.serverName ?? 'default'
      const list = map.get(key)
      if (list) list.push(tool)
      else map.set(key, [tool])
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [filtered])

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
        {!loading && groups.map(([server, serverTools]) => {
            const serverExpanded = expandedServers.has(server)
            return (
              <section key={server} className={css.group}>
                <button type="button" className={css.serverCard} onClick={() => toggleServer(server)}>
                  <span className={css.serverName}>{server}</span>
                  <span className={css.groupCount}>{serverTools.length}</span>
                  <span className={css.activeBadge}>{t('active')}</span>
                  <span className={css.chevron} aria-hidden>{serverExpanded ? '▾' : '▸'}</span>
                </button>
                {serverExpanded && (
                  <div className={css.toolList}>
                    {serverTools.map(tool => (
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
