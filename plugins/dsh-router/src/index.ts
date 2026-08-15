import {
  listProfiles,
  parseTarget,
  printUsage,
  resolveProfilesDir,
  runProfile,
  selectProfile,
} from './router-core.ts'

interface Context {
  get<T>(name: string): T | undefined
}

export const name = 'dsh-router'
export const inject = ['cmdlineArgs']

interface CmdlineArgs {
  get(): readonly string[]
}

export function apply(ctx: Context): void {
  const exit = ctx.get('appExit') as ((code: number) => void) | undefined
  const requestExit = (code: number): void => {
    if (exit) exit(code)
    else process.exit(code)
  }

  void (async () => {
    const args = [...((ctx.get('cmdlineArgs') as CmdlineArgs | undefined)?.get() ?? [])]

    if (args.includes('--help') || args.includes('-h')) {
      printUsage()
      requestExit(0)
      return
    }

    const currentProfile = currentProfileFromArgv()
    const allProfiles = listProfiles(resolveProfilesDir())
    const selectableProfiles = currentProfile
      ? allProfiles.filter((profile) => profile !== currentProfile)
      : allProfiles

    const target = parseTarget(args, allProfiles)
    if (target.error) {
      console.error(target.error)
      console.error(`可用: ${allProfiles.join(', ') || '(无)'}`)
      requestExit(1)
      return
    }

    let selected = target.selected
    let extra = target.extra

    if (selected === null) {
      if (selectableProfiles.length === 0) {
        console.error(`没有可路由的 profile: ${resolveProfilesDir()}`)
        requestExit(1)
        return
      }
      selected = await selectProfile(selectableProfiles)
      if (selected === null) {
        requestExit(1)
        return
      }
    }

    if (currentProfile && selected === currentProfile) {
      console.error(`不能路由到当前正在运行的 profile: ${selected}`)
      requestExit(1)
      return
    }

    const code = await runProfile(selected, extra)
    requestExit(code)
  })()
}

function currentProfileFromArgv(): string | null {
  const argv = process.argv
  const index = argv.indexOf('--profile')
  if (index !== -1 && argv[index + 1]) return argv[index + 1]!
  return null
}
