/**
 * The toolbox React sides: the column content (header + tab switcher + the
 * active tool's page) portal-ed into the layout controller's appended column.
 * While collapsed the column stays mounted as a narrow right rail with an
 * expand button at the top, matching the left-sidebar interaction; while
 * expanded it shows the full toolbox surface. Tool pages stay mounted across
 * tab switches (hidden, not unmounted), so tool state survives switching.
 */
import { useEffect, useSyncExternalStore, useState } from 'react'
import { createPortal } from 'react-dom'
import type { ToolboxLayoutController, ToolboxRootProps } from './contract.ts'
import css from './ToolboxRoot.module.css'

/** The portal mount: renders nothing at its slot position. */
export function ToolboxMount(props: ToolboxRootProps & { layout: ToolboxLayoutController }) {
  const { layout, renderSlot, useTools, closeDetails, t } = props
  const state = useSyncExternalStore(layout.subscribe, layout.getSnapshot)
  const tools = useTools(s => s)
  const [activeId, setActiveId] = useState<string | null>(null)
  // A removed active tool falls back to the first remaining one.
  const active = tools.find(row => row.id === activeId) ?? tools[0]

  // Track mount state in the layout controller. If this session-scoped mount
  // goes away (new session / plugin stop), the appended column must not keep
  // the expanded layout behind it; it collapses back to the narrow rail until
  // the next toolbox UI actually mounts.
  useEffect(() => {
    layout.markMounted()
    return () => { layout.markUnmounted() }
  }, [layout])

  if (state.columnEl === null) return null

  // Collapsed: a slim right rail. The button sits at the top of the rail and
  // expands the toolbox like a sidebar.
  if (state.collapsed) {
    return createPortal(
      <div className={css.rail}>
        <button
          type="button"
          className={css.railBtn}
          title={t('open')}
          aria-label={t('open')}
          onClick={() => { layout.open() }}
        >
          <svg className={css.railIcon} viewBox="0 0 16 16" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
            <rect x="2" y="2" width="5" height="5" rx="1" />
            <rect x="9" y="2" width="5" height="5" rx="1" />
            <rect x="2" y="9" width="5" height="5" rx="1" />
            <rect x="9" y="9" width="5" height="5" rx="1" />
          </svg>
        </button>
      </div>,
      state.columnEl,
    )
  }

  return createPortal(
    <div className={css.root}>
      <div className={css.header}>
        <div className={css.title}>{t('title')}</div>
        <button type="button" className={css.close} aria-label={t('close')} onClick={closeDetails}>
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden>
            <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      {tools.length > 0 && (
        <div className={css.tabs} role="tablist" aria-label={t('tabsAria')}>
          {tools.map(row => (
            <button
              key={row.id}
              type="button"
              role="tab"
              aria-selected={row.id === active?.id}
              className={row.id === active?.id ? `${css.tab} ${css.activeTab}` : css.tab}
              onClick={() => { setActiveId(row.id) }}
            >
              {row.label}
            </button>
          ))}
        </div>
      )}
      <div className={css.body}>
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
