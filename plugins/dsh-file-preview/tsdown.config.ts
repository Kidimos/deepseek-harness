import { clientBundle } from './build/tsdown.client.ts'

export default clientBundle('@dsh-external/dsh-client-ui-file-preview', ['src/index.ts'], {
  portableCssModuleIds: true,
})
