/** `mcpAdapter` namespace dictionaries. */

/** Dictionary namespace owned by this plugin. */
export const NS = 'mcpAdapter'

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
  'inactive': '未激活',
  'connecting': '连接中',
  'statusError': '错误',
  'activate': '激活',
  'deactivate': '停用',
} satisfies Record<string, string>

/** The namespace key union. */
export type McpAdapterKey = keyof typeof zh

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
  'inactive': 'inactive',
  'connecting': 'connecting',
  'statusError': 'error',
  'activate': 'Activate',
  'deactivate': 'Deactivate',
} satisfies Record<McpAdapterKey, string>
