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
  export function useSyncExternalStore<S>(
    subscribe: (listener: () => void) => () => void,
    getSnapshot: () => S,
  ): S
}

declare module 'react-dom' {
  export function createPortal(children: unknown, container: Element): unknown
}
