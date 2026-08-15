/**
 * Toolbox base plugin, browser half: appends its own 工具区 column to the
 * shipped three-column frame (runtime track append, no harness source
 * changes), portals the column UI from an always-mounted session-scoped seat,
 * and exposes the `toolbox.tool` seat — the interface every tool plugin uses
 * to add a card. The shipped tool-details column is never touched.
 */
import type { LocaleFace, PluginContext, ToolboxInjected, ToolRow } from './contract.ts'
import { ToolboxLayoutController } from './layout.ts'
import { ToolboxHandrail, ToolboxMount } from './ToolboxRoot.tsx'
import { en, NS, zh } from './locales.ts'

/** Services required by the toolbox plugin. */
export const inject = ['slots', 'sessions']

/**
 * Mount the toolbox column and its entry point.
 * @param ctx - client root context.
 */
export function apply(ctx: PluginContext): void {
  const slots = ctx.slots
  const locale = ctx.get('locale') as LocaleFace | undefined

  ctx.effect(() => locale?.register(NS, { zh, en }), 'toolbox: dictionaries')
  const t = locale?.bind(NS) ?? ((key: string) => (zh as Record<string, string>)[key] ?? key)

  const layout = new ToolboxLayoutController()
  layout.setCollapseLabel(t('collapse'))
  layout.mount()
  ctx.effect(() => layout.dispose, 'toolbox: layout controller')

  // The per-project root follows the active session's cwd; switching sessions
  // restores that project's persisted width/collapse.
  const bindRoot = (): void => {
    const snapshot = ctx.sessions.list.getSnapshot()
    const sessionId = snapshot.current
    const cwd = sessionId === undefined ? undefined : snapshot.byId[sessionId]?.cwd
    layout.setRoot(typeof cwd === 'string' && cwd !== '' ? cwd : '')
  }
  bindRoot()
  ctx.effect(() => ctx.sessions.list.subscribe(bindRoot), 'toolbox: project root')

  // Ledger → row projection for the empty state (uSES pair: getSnapshot
  // returns the cached rows until the ledger version moves).
  let version = -1
  let rows: readonly ToolRow[] = []
  const injectFactory = (): ToolboxInjected => ({
    closeDetails: () => { layout.close() },
    hooks: {
      tools: {
        getSnapshot: () => {
          const next = slots.getVersion('toolbox.tool')
          if (next !== version) {
            version = next
            rows = slots.entries('toolbox.tool')
              .map((e: { options: { id?: string; order?: number } }) => ({ id: e.options.id ?? '', order: e.options.order ?? 0 }))
              .sort((a: ToolRow, b: ToolRow) => a.order - b.order)
          }
          return rows
        },
        subscribe: (listener: () => void) => slots.subscribe('toolbox.tool', listener),
      },
    },
  })

  // The always-mounted session-scoped seat: renders nothing in its slot (the
  // column UI portals out), declares the tool seat, and carries the inject
  // face (close callback + tool rows). Tool cards receive the framework
  // session kit through this entry's scope.
  slots.inject('conversation.session.header.actions', () => slots.register({
    name: 'conversation.session.header.actions',
    id: 'toolbox-mount',
    order: 50,
    locale: NS,
    children: { 'toolbox.tool': { kind: 'list', scope: 'session' } },
    inject: injectFactory,
  }, (props: Record<string, unknown>) =>
    ToolboxMount({ ...(props as unknown as Parameters<typeof ToolboxMount>[0]), layout })))

  // Entry point: the right-edge handrail, shown while the column is collapsed.
  slots.inject('shell.overlay', () => slots.register(
    { name: 'shell.overlay', id: 'toolbox-handrail', order: 0, label: () => t('title') },
    () => ToolboxHandrail({ layout, label: t('open') }),
  ))
}
