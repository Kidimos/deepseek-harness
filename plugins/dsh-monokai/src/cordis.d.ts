declare module '@deepseek-ai/cordis' {
  export interface Context {
    effect(fn: () => () => void, name?: string): unknown
  }
}
