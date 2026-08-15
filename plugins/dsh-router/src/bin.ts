#!/usr/bin/env node
import {
  listProfiles,
  parseTarget,
  printUsage,
  resolveProfilesDir,
  runProfile,
  selectProfile,
} from './router-core.ts'

async function main(): Promise<number> {
  const args = process.argv.slice(2)

  if (args.includes('--help') || args.includes('-h')) {
    printUsage()
    return 0
  }

  const profiles = listProfiles(resolveProfilesDir())
  const target = parseTarget(args, profiles)
  if (target.error) {
    console.error(target.error)
    console.error(`可用: ${profiles.join(', ') || '(无)'}`)
    return 1
  }

  let selected = target.selected
  let extra = target.extra

  if (selected === null) {
    if (profiles.length === 0) {
      console.error(`没有找到 profile: ${resolveProfilesDir()}`)
      return 1
    }
    selected = await selectProfile(profiles)
    if (selected === null) return 1
  }

  return runProfile(selected, extra)
}

main().then((code) => process.exit(code))
