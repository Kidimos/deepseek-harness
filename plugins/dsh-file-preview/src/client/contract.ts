/** Local structural types for the file preview tool. */

/** Props passed by the toolbox.tool seat. */
export interface FilePreviewProps {
  /** Current session id (framework-standard). */
  sessionId: string
  /** Locale seat for the `filePreview` namespace. */
  t: (key: string) => string
}

/** The locale-service face (optional, framework-provided). */
export interface LocaleFace {
  register(ns: string, dicts: Record<string, object>): () => void
  bind(ns: string): (key: string) => string
}

/** The slots-service face used to register the tool. */
export interface SlotsFace {
  inject(name: string, callback: () => unknown): unknown
  register(options: {
    name: string
    id?: string
    order?: number
    label?: string | (() => string)
    icon?: string | (() => unknown)
    locale?: string
  }, component: unknown): () => void
}

/** The client context face this apply world reads. */
export interface PluginContext {
  slots: SlotsFace
  get(name: string): unknown
  effect(fn: () => void | (() => void), name?: string): unknown
}
