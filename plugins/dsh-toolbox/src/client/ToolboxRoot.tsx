/**
 * The toolbox React sides: the column content (header + tool grid or empty
 * state) portal-ed into the layout controller's appended column, and the
 * right-edge handrail entry point. Both subscribe to the controller through
 * useSyncExternalStore; the column stays mounted (hidden at zero width) while
 * collapsed, so tool-card state survives open/close.
 */
import { useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import type { ToolboxLayoutController, ToolboxRootProps } from './contract.ts'
import css from './ToolboxRoot.module.css'

/** The portal mount: renders nothing at its slot position. */
export function ToolboxMount(props: ToolboxRootProps & { layout: ToolboxLayoutController }) {
  const { layout, renderSlot, useTools, closeDetails, t } = props
  const state = useSyncExternalStore(layout.subscribe, layout.getSnapshot)
  const tools = useTools(s => s)

  if (state.columnEl === null) return null
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
      <div className={css.body}>
        {tools.length === 0
          ? (
            <div className={css.empty}>
              <div>{t('empty')}</div>
              <div className={css.emptyHint}>{t('emptyHint')}</div>
            </div>
          )
          : <div className={css.grid}>{renderSlot('toolbox.tool', {})}</div>}
      </div>
    </div>,
    state.columnEl,
  )
}

/**
 * The right-edge handrail entry point: visible only while the column is
 * collapsed (the controller's state), so an open column hides the opener and
 * the header ✕ is the closer.
 */
export function ToolboxHandrail(props: { layout: ToolboxLayoutController; label: string }) {
  const state = useSyncExternalStore(props.layout.subscribe, props.layout.getSnapshot)
  if (!state.collapsed) return null
  return (
    <div className={css.handrail}>
      <button type="button" className={css.handrailBtn} title={props.label} onClick={() => { props.layout.open() }}>
        ◀
      </button>
    </div>
  )
}
