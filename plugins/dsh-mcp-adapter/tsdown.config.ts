import { clientBundle } from './build/tsdown.client.ts'

export default clientBundle('@dsh-external/dsh-client-ui-mcp-adapter', ['src/index.ts'], {
  portableCssModuleIds: true,
})
