/**
 * Toolbox contract: the tool-seat declaration (runtime children table lives in
 * apply), the injected share of the toolbox column, and the composed component
 * props. Local structural types — the standalone plugin resolves no workspace
 * type packages; the seat is the interface every tool plugin uses.
 */

/** One ledger-projected row: existence drives the empty state; the label titles the card. */
export interface ToolRow {
  id: string
  order: number
  label: string
  /** Optional icon shown in the toolbox icon rail (string or a function returning JSX). */
  icon?: string | (() => unknown)
}

/** Bare observable source pair the inject hooks compartment carries. */
export interface ToolSource {
  getSnapshot(): readonly ToolRow[]
  subscribe(listener: () => void): () => void
}

/** Snapshot the layout controller publishes to the React sides. */
export interface ToolboxLayoutSnapshot {
  /** The appended column element (null until the frame attached). */
  columnEl: HTMLElement | null
  /** Current column width in px (0 while collapsed). */
  width: number
  /** True while the column is collapsed (kept mounted at zero width). */
  collapsed: boolean
}

/** The layout controller face the React sides subscribe to. */
export interface ToolboxLayoutController {
  getSnapshot(): ToolboxLayoutSnapshot
  subscribe(listener: () => void): () => void
  open(): void
  close(): void
  setWidth(px: number, persist?: boolean): void
  markMounted(): void
  markUnmounted(): void
  setRoot(root: string): void
  dispose(): void
}

/** Injected share of the toolbox column (assembled in the plugin's apply). */
export interface ToolboxInjected {
  /** Close the toolbox column (collapse to the narrow rail, kept mounted). */
  closeDetails: () => void
  hooks: {
    /** toolbox.tool ledger projected into ordered rows. */
    tools: ToolSource
  }
}

/** Full toolbox-column props: session kit, the tool seat, the bound rows hook, and locale. */
export interface ToolboxRootProps {
  /** Current session id (framework-standard). */
  sessionId: string
  /** Render one tool entry of the declared seat (title and body per row). */
  renderSlot: (name: 'toolbox.tool', owner?: Record<string, never>, options?: { only?: string }) => unknown
  /** Bound rows hook from the inject hooks compartment. */
  useTools: <S>(selector: (rows: readonly ToolRow[]) => S) => S
  /** Close the column (injected callback). */
  closeDetails: () => void
  /** Locale seat for the `toolbox` namespace. */
  t: (key: string) => string
}

/** The locale-service face the toolbox uses (optional, framework-provided). */
export interface LocaleFace {
  register(ns: string, dicts: Record<string, object>): () => void
  bind(ns: string): (key: string) => string
  getSnapshot(): { revision: number }
  subscribe(listener: () => void): () => void
}

/** The sessions-service face the toolbox uses for the per-project root. */
export interface SessionsFace {
  list: {
    getSnapshot(): {
      current?: string
      byId: Record<string, { cwd?: string } | undefined>
    }
    subscribe(listener: () => void): () => void
  }
}

/** Entry registration options the toolbox uses through ctx.slots. */
export interface RegisterOptions {
  name: string
  priority?: number
  id?: string
  order?: number
  label?: string | (() => string)
  locale?: string
  children?: Record<string, { kind: string; scope: string }>
  inject?: () => unknown
}

/** The slots-service face the toolbox uses (framework-provided). */
export interface SlotsFace {
  inject(name: string, callback: () => unknown): unknown
  register(options: RegisterOptions, component: unknown): () => void
  subscribe(key: string, listener: () => void): () => void
  getVersion(key: string): number
  entries(key: string): readonly {
    options: { id?: string; order?: number; label?: string | (() => string); icon?: string | (() => unknown) }
    component?: { icon?: string | (() => unknown) }
  }[]
}

/** The client context face the toolbox apply world reads (cordis, untyped at the boundary). */
export interface PluginContext {
  slots: SlotsFace
  sessions: SessionsFace
  get(name: string): unknown
  effect(fn: () => void | (() => void), name?: string): unknown
}
