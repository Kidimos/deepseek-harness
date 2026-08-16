/** Minimal JSX/React ambient surface for the standalone plugin (no react types in scope).
 *  Typecheck-only: the build transform (rolldown, jsx: react-jsx) emits the automatic
 *  runtime imports; the runtime values resolve from the shell module table. */
declare namespace JSX {
  type Element = unknown
  interface IntrinsicElements {
    [elemName: string]: Record<string, unknown>
  }
}

declare module 'react/jsx-runtime' {
  export function jsx(type: unknown, props?: unknown, key?: unknown): unknown
  export function jsxs(type: unknown, props?: unknown, key?: unknown): unknown
  export const Fragment: unknown
}

declare module 'react' {
  export function useEffect(effect: () => void | (() => void), deps?: readonly unknown[]): void
  export function useMemo<T>(factory: () => T, deps: readonly unknown[]): T
  export function useState<S>(initial: S | (() => S)): [S, (next: S | ((previous: S) => S)) => void]
  export function useSyncExternalStore<S>(
    subscribe: (listener: () => void) => () => void,
    getSnapshot: () => S,
  ): S
}

declare module 'react-dom' {
  export function createPortal(children: unknown, container: Element): unknown
}

declare module '@deepseek-ai/dsh-client-ui-slots' {
  /** Resolve a slot label option (string or locale thunk) to its display text. */
  export function resolveSlotLabel(label: unknown): string | undefined
}
