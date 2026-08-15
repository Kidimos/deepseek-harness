import { spawn } from 'node:child_process'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { selectProfile } from './router-selector.ts'

export { selectProfile }

export function defaultDshHome(): string {
  return process.env.DSH_HOME || join(homedir(), '.dsh')
}

export function resolveProfilesDir(dshHome: string = defaultDshHome()): string {
  return join(dshHome, 'profiles')
}

export function listProfiles(profilesDir: string = resolveProfilesDir()): string[] {
  if (!existsSync(profilesDir)) return []
  return readdirSync(profilesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory()
      && entry.name !== 'node_modules'
      && entry.name !== 'router'
      && !entry.name.startsWith('.'))
    .map((entry) => entry.name)
    .sort()
}

export interface LaunchCommand {
  command: string
  args: string[]
}

export function resolveLaunchCommand(cwd: string = process.cwd()): LaunchCommand {
  const envCommand = process.env.DSH_ROUTER_COMMAND
  if (envCommand) {
    const parts = envCommand.trim().split(/\s+/)
    if (parts.length === 0) throw new Error('DSH_ROUTER_COMMAND is empty')
    return { command: parts[0]!, args: parts.slice(1) }
  }

  let dir = cwd
  for (;;) {
    const packagePath = join(dir, 'package.json')
    if (existsSync(packagePath)) {
      try {
        const pkg = JSON.parse(readFileSync(packagePath, 'utf8')) as {
          scripts?: { dsh?: string }
        }
        if (typeof pkg.scripts?.dsh === 'string') {
          return { command: 'pnpm', args: ['dsh'] }
        }
      } catch {
        // Not a readable package.json; keep walking upward.
      }
    }
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }

  return { command: 'dsh', args: [] }
}

export interface Target {
  selected: string | null
  extra: string[]
  error?: string
}

export function parseTarget(args: readonly string[], profiles: readonly string[]): Target {
  const copy = [...args]

  if (copy[0] === '--target' && copy[1]) {
    const name = copy[1]!
    if (!profiles.includes(name)) {
      return { selected: null, extra: copy.slice(2), error: `未知 profile: ${name}` }
    }
    return { selected: name, extra: copy.slice(2) }
  }

  if (copy[0]?.startsWith('--target=')) {
    const name = copy[0].slice('--target='.length)
    if (!profiles.includes(name)) {
      return { selected: null, extra: copy.slice(1), error: `未知 profile: ${name}` }
    }
    return { selected: name, extra: copy.slice(1) }
  }

  if (copy.length > 0 && !copy[0]!.startsWith('-')) {
    const name = copy[0]!
    if (!profiles.includes(name)) {
      return { selected: null, extra: copy.slice(1), error: `未知 profile: ${name}` }
    }
    return { selected: name, extra: copy.slice(1) }
  }

  return { selected: null, extra: copy }
}

export function runProfile(
  profile: string,
  extraArgs: readonly string[] = [],
  cwd: string = process.cwd(),
): Promise<number> {
  const launch = resolveLaunchCommand(cwd)
  const args = [...launch.args, '--profile', profile, ...extraArgs]
  return new Promise((resolve) => {
    const child = spawn(launch.command, args, { cwd, stdio: 'inherit', env: process.env })
    child.on('error', (error) => {
      console.error(`无法启动 ${launch.command}: ${error.message}`)
      resolve(1)
    })
    child.on('exit', (code, signal) => {
      resolve(signal === null ? (code ?? 1) : 1)
    })
  })
}

export function printUsage(): void {
  console.log(`用法:
  dsh-router [profile] [dsh 参数...]
  dsh-router --target <profile> [dsh 参数...]
  dsh-router --help

环境变量:
  DSH_HOME              Harness home（默认 ~/.dsh）
  DSH_ROUTER_COMMAND    覆盖启动命令，例如 "pnpm dsh" 或 "dsh"
`)
}
