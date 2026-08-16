/**
 * File tree + preview tool, browser half: registers a toolbox.tool entry with
 * a file icon. The card renders the tree/preview UI backed by host routes.
 */
import type { LocaleFace, PluginContext } from './contract.ts'
import { FilePreview } from './FilePreview.tsx'
import { FolderIcon } from './icons.tsx'
import { en, NS, zh } from './locales.ts'

/** Services required by the file preview plugin. */
export const inject = ['slots']

/**
 * Mount the file preview tool.
 * @param ctx - client root context.
 */
export function apply(ctx: PluginContext): void {
  const slots = ctx.slots
  const locale = ctx.get('locale') as LocaleFace | undefined

  ctx.effect(() => locale?.register(NS, { zh, en }), 'file-preview: dictionaries')
  const t = locale?.bind(NS) ?? ((key: string) => (zh as Record<string, string>)[key] ?? key)

  const FilePreviewTool = Object.assign(
    (props: Record<string, unknown>) => FilePreview({
      sessionId: String(props.sessionId ?? ''),
      t,
    }),
    { icon: FolderIcon },
  )

  slots.inject('toolbox.tool', () => slots.register(
    {
      name: 'toolbox.tool',
      id: 'file-preview',
      order: 10,
      label: () => t('title'),
      locale: NS,
    },
    FilePreviewTool,
  ))
}
