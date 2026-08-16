/** `mcpView` namespace dictionaries. */

/** Dictionary namespace owned by this plugin. */
export const NS = 'mcpView'

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'title': 'MCP',
  'tools': 'MCP 工具',
  'empty': '没有可用的 MCP 工具',
  'loading': '加载中…',
  'error': '加载失败',
  'server': '服务',
  'description': '描述',
  'parameters': '参数',
  'refresh': '刷新',
  'search': '搜索工具…',
  'active': 'active',
} satisfies Record<string, string>

/** The namespace key union. */
export type McpViewKey = keyof typeof zh

/** English dictionary, checked complete against the zh key set. */
export const en = {
  'title': 'MCP',
  'tools': 'MCP Tools',
  'empty': 'No MCP tools available',
  'loading': 'Loading…',
  'error': 'Failed to load',
  'server': 'Server',
  'description': 'Description',
  'parameters': 'Parameters',
  'refresh': 'Refresh',
  'search': 'Search tools…',
  'active': 'active',
} satisfies Record<McpViewKey, string>
