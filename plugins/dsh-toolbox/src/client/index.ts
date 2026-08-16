/**
 * Toolbox base plugin, browser half: appends its own 工具区 column to the
 * shipped three-column frame (runtime track append, no harness source
 * changes), portals the column UI from an always-mounted session-scoped seat,
 * and exposes the `toolbox.tool` seat — the interface every tool plugin uses
 * to add a card. The shipped tool-details column is never touched.
 */
import { resolveSlotLabel } from '@deepseek-ai/dsh-client-ui-slots'
import type { LocaleFace, PluginContext, ToolboxInjected, ToolRow } from './contract.ts'
import { ToolboxLayoutController } from './layout.ts'
import { ToolboxMount } from './ToolboxRoot.tsx'
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
  layout.mount()
  ctx.effect(() => layout.dispose, 'toolbox: layout controller')

  // The per-project root follows the active session's cwd; switching sessions
  // restores that project's persisted width/collapse.
  const bindRoot = (): void => {
    const snapshot = ctx.sessions.list.getSnapshot()
    const sessionId = snapshot.current
    const cwd = sessionId === undefined ? undefined : snapshot.byId[sessionId]?.cwd
    if (sessionId === undefined || typeof cwd !== 'string' || cwd === '') {
      // No usable session workspace yet (e.g. a fresh session is being
      // created): never leave the conversation squeezed by an expanded toolbox
      // column while the toolbox UI is absent.
      layout.close()
      return
    }
    layout.setRoot(cwd)
  }
  bindRoot()
  ctx.effect(() => ctx.sessions.list.subscribe(bindRoot), 'toolbox: project root')

  // Ledger → row projection for the tab strip + empty state (uSES pair: the
  // cached rows survive until the ledger version or the locale revision moves
  // — labels may be locale-following thunks).
  let version = -1
  let revision = -1
  let rows: readonly ToolRow[] = []
  const injectFactory = (): ToolboxInjected => ({
    closeDetails: () => { layout.close() },
    hooks: {
      tools: {
        getSnapshot: () => {
          const nextVersion = slots.getVersion('toolbox.tool')
          const nextRevision = locale?.getSnapshot().revision ?? -1
          if (nextVersion !== version || nextRevision !== revision) {
            version = nextVersion
            revision = nextRevision
            rows = slots.entries('toolbox.tool')
              .map((e: { options: { id?: string; order?: number; label?: string | (() => string) } }) => ({
                id: e.options.id ?? '',
                order: e.options.order ?? 0,
                label: resolveSlotLabel(e.options.label) ?? e.options.id ?? '',
              }))
              .sort((a: ToolRow, b: ToolRow) => a.order - b.order)
          }
          return rows
        },
        subscribe: (listener: () => void) => {
          const offLedger = slots.subscribe('toolbox.tool', listener)
          const offLocale = locale === undefined ? () => {} : locale.subscribe(listener)
          return () => {
            offLedger()
            offLocale()
          }
        },
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

}
