/** `filePreview` namespace dictionaries. */

/** Dictionary namespace owned by this plugin. */
export const NS = 'filePreview'

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'title': '文件',
  'files': '文件树',
  'preview': '预览',
  'selectFile': '选择一个文件以预览',
  'loading': '加载中…',
  'empty': '目录为空',
  'error': '加载失败',
  'source': '源码',
  'split': '分屏',
  'save': '保存',
  'saving': '保存中…',
  'modeTabs': '预览模式',
  'binaryPreviewUnavailable': '该格式暂不支持内嵌预览',
} satisfies Record<string, string>

/** The namespace key union. */
export type FilePreviewKey = keyof typeof zh

/** English dictionary, checked complete against the zh key set. */
export const en = {
  'title': 'Files',
  'files': 'Files',
  'preview': 'Preview',
  'selectFile': 'Select a file to preview',
  'loading': 'Loading…',
  'empty': 'Directory is empty',
  'error': 'Failed to load',
  'source': 'Source',
  'split': 'Split',
  'save': 'Save',
  'saving': 'Saving…',
  'modeTabs': 'Preview mode',
  'binaryPreviewUnavailable': 'Inline preview is not available for this format',
} satisfies Record<FilePreviewKey, string>
