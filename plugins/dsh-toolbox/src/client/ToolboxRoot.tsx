/**
 * The toolbox React sides: a vertical icon rail (like a sidebar) plus the
 * active tool's page. The rail is present in both collapsed and expanded
 * states: the top icon toggles the toolbox, and the icons below select tool
 * plugins. When there are more tool icons than fit, the rail paginates them.
 */
import { useEffect, useSyncExternalStore, useState } from 'react'
import { createPortal } from 'react-dom'
import type { ToolboxLayoutController, ToolboxRootProps, ToolRow } from './contract.ts'
import css from './ToolboxRoot.module.css'

/** How many tool icons fit on one rail page before pagination kicks in. */
const ICON_PAGE_SIZE = 6

/** The shared vertical icon rail: toggle button + tool icons + pager. */
function ToolIconRail(props: {
  collapsed: boolean
  tools: readonly ToolRow[]
  activeId: string | null
  page: number
  pageCount: number
  onToggle: () => void
  onSelect: (id: string) => void
  onPageChange: (page: number) => void
  t: (key: string) => string
}) {
  const {
    collapsed,
    tools,
    activeId,
    page,
    pageCount,
    onToggle,
    onSelect,
    onPageChange,
    t,
  } = props
  const start = page * ICON_PAGE_SIZE
  const visibleTools = tools.slice(start, start + ICON_PAGE_SIZE)

  return (
    <div className={collapsed ? css.rail : css.iconRail}>
      <button
        type="button"
        className={collapsed ? css.railBtn : css.collapseBtn}
        title={collapsed ? t('open') : t('close')}
        aria-label={collapsed ? t('open') : t('close')}
        onClick={onToggle}
      >
        <svg className={css.railIcon} viewBox="0 0 16 16" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
          <rect x="2" y="2" width="5" height="5" rx="1" />
          <rect x="9" y="2" width="5" height="5" rx="1" />
          <rect x="2" y="9" width="5" height="5" rx="1" />
          <rect x="9" y="9" width="5" height="5" rx="1" />
        </svg>
      </button>

      <div className={css.toolIcons}>
        {visibleTools.map(tool => (
          <button
            key={tool.id}
            type="button"
            className={tool.id === activeId ? `${css.toolIcon} ${css.activeToolIcon}` : css.toolIcon}
            title={tool.label}
            aria-label={tool.label}
            onClick={() => onSelect(tool.id)}
          >
            {typeof tool.icon === 'function' ? tool.icon() : (tool.icon ?? tool.label.slice(0, 1))}
          </button>
        ))}
      </div>

      {pageCount > 1 && (
        <div className={css.iconPager}>
          <button
            type="button"
            className={css.iconPagerBtn}
            disabled={page <= 0}
            aria-label="Previous tools"
            onClick={() => onPageChange(page - 1)}
          >
            ▲
          </button>
          <span className={css.iconPagerInfo}>{page + 1}/{pageCount}</span>
          <button
            type="button"
            className={css.iconPagerBtn}
            disabled={page >= pageCount - 1}
            aria-label="Next tools"
            onClick={() => onPageChange(page + 1)}
          >
            ▼
          </button>
        </div>
      )}
    </div>
  )
}

/** The portal mount: renders nothing at its slot position. */
export function ToolboxMount(props: ToolboxRootProps & { layout: ToolboxLayoutController }) {
  const { layout, renderSlot, useTools, closeDetails, t } = props
  const state = useSyncExternalStore(layout.subscribe, layout.getSnapshot)
  const tools = useTools(s => s)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [iconPage, setIconPage] = useState(0)
  // A removed active tool falls back to the first remaining one.
  const active = tools.find(row => row.id === activeId) ?? tools[0]

  const pageCount = Math.max(1, Math.ceil(tools.length / ICON_PAGE_SIZE))
  const safePage = Math.min(iconPage, pageCount - 1)

  // Keep the active tool's icon visible when the tool set or selection changes.
  useEffect(() => {
    if (active === undefined) return
    const index = tools.findIndex(row => row.id === active.id)
    if (index < 0) return
    const page = Math.floor(index / ICON_PAGE_SIZE)
    if (page !== safePage) setIconPage(page)
  }, [active?.id, tools.length, safePage])

  // Track mount state in the layout controller. If this session-scoped mount
  // goes away (new session / plugin stop), the appended column must not keep
  // the expanded layout behind it; it collapses back to the narrow rail until
  // the next toolbox UI actually mounts.
  useEffect(() => {
    layout.markMounted()
    return () => { layout.markUnmounted() }
  }, [layout])

  if (state.columnEl === null) return null

  const handleSelectTool = (id: string): void => {
    setActiveId(id)
    if (state.collapsed) layout.open()
  }

  const iconRail = (
    <ToolIconRail
      collapsed={state.collapsed}
      tools={tools}
      activeId={active?.id ?? null}
      page={safePage}
      pageCount={pageCount}
      onToggle={() => { if (state.collapsed) layout.open(); else closeDetails() }}
      onSelect={handleSelectTool}
      onPageChange={setIconPage}
      t={t}
    />
  )

  // Collapsed: the icon rail is the whole narrow right column.
  if (state.collapsed) {
    return createPortal(iconRail, state.columnEl)
  }

  // Expanded: the icon rail stays on the left; the active tool fills the rest.
  return createPortal(
    <div className={css.root}>
      {iconRail}
      <div className={css.content}>
        {tools.length === 0
          ? (
            <div className={css.empty}>
              <div>{t('empty')}</div>
              <div className={css.emptyHint}>{t('emptyHint')}</div>
            </div>
          )
          : (
            <div className={css.pages}>
              {tools.map(row => (
                <div key={row.id} className={css.page} style={{ display: row.id === active?.id ? undefined : 'none' }}>
                  {renderSlot('toolbox.tool', {}, { only: row.id })}
                </div>
              ))}
            </div>
          )}
      </div>
    </div>,
    state.columnEl,
  )
}
