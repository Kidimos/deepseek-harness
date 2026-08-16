/**
 * MCP view tool, browser half: registers a toolbox.tool entry with an M icon.
 * The card lists MCP tools from the host /dsh-mcp/tools route.
 */
import type { LocaleFace, PluginContext } from './contract.ts'
import { McpIcon } from './icons.tsx'
import { McpView } from './McpView.tsx'
import { en, NS, zh } from './locales.ts'

/** Services required by the MCP view plugin. */
export const inject = ['slots']

/**
 * Mount the MCP view tool.
 * @param ctx - client root context.
 */
export function apply(ctx: PluginContext): void {
  const slots = ctx.slots
  const locale = ctx.get('locale') as LocaleFace | undefined

  ctx.effect(() => locale?.register(NS, { zh, en }), 'mcp-view: dictionaries')
  const t = locale?.bind(NS) ?? ((key: string) => (zh as Record<string, string>)[key] ?? key)

  const McpViewTool = Object.assign(
    (props: Record<string, unknown>) => McpView({
      sessionId: String(props.sessionId ?? ''),
      t,
    }),
    { icon: McpIcon },
  )

  slots.inject('toolbox.tool', () => slots.register(
    {
      name: 'toolbox.tool',
      id: 'mcp-view',
      order: 20,
      label: () => t('title'),
      locale: NS,
    },
    McpViewTool,
  ))
}
