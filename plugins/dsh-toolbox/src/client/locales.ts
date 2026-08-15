/** `toolbox` namespace dictionaries. */

/** Dictionary namespace owned by this plugin. */
export const NS = 'toolbox'

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'title': '工具区',
  'close': '关闭工具区',
  'collapse': '收起工具区',
  'open': '打开工具区',
  'empty': '暂无工具插件',
  'emptyHint': '工具插件通过 toolbox.tool 槽位挂载，安装后自动出现在这里。',
} satisfies Record<string, string>

/** The toolbox namespace key union. */
export type ToolboxKey = keyof typeof zh

/** English dictionary, checked complete against the zh key set. */
export const en = {
  'title': 'Toolbox',
  'close': 'Close toolbox',
  'collapse': 'Collapse toolbox',
  'open': 'Open toolbox',
  'empty': 'No tool plugins installed',
  'emptyHint': 'Tool plugins mount through the toolbox.tool slot and appear here automatically.',
} satisfies Record<ToolboxKey, string>
