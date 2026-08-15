import { emitKeypressEvents } from 'node:readline'
import { stdin, stdout } from 'node:process'

const RESET = '\x1b[0m'
const BOLD = '\x1b[1m'
const MONOKAI_FOREGROUND = '\x1b[38;2;248;248;242m'
const MONOKAI_RED = '\x1b[38;2;249;38;114m'
const MONOKAI_PURPLE = '\x1b[38;2;174;129;255m'
const MONOKAI_GRAY = '\x1b[38;2;166;166;158m'

function render(profiles: readonly string[], index: number, first = false) {
    const menuHeight = profiles.length + 4

    if (!first) {
        stdout.write(`\r\x1b[${menuHeight}A`)
    }

    stdout.write('\x1b[2K')
    stdout.write(`${MONOKAI_PURPLE}Deepseek Harness Profile Router Selector${RESET}\n`)
    stdout.write('\x1b[2K\n')
    profiles.forEach((name, i) => {
        stdout.write('\x1b[2K')
        if (i === index) {
            stdout.write(`${BOLD}${MONOKAI_RED}> ${name}${RESET}\n`)
        } else {
            stdout.write(`${MONOKAI_FOREGROUND}  ${name}${RESET}\n`)
        }
    })
    stdout.write('\x1b[2K\n')
    stdout.write('\x1b[2K')
    stdout.write(`${MONOKAI_GRAY}↑/↓ 选择，Enter 确认，q 退出${RESET}\n`)
}

export function selectProfile(profiles: readonly string[]): Promise<string | null> {
    return new Promise((resolve) => {
        let index = 0

        const onKeyPress = (str: string, key: { name?: string; ctrl?: boolean }) => {
            if (key.name === 'up') {
                index = (index - 1 + profiles.length) % profiles.length
                render(profiles, index)
            } else if (key.name === 'down') {
                index = (index + 1) % profiles.length
                render(profiles, index)
            } else if (key.name === 'return') {
                cleanup()
                resolve(profiles[index]!)
            } else if (key.name === 'q' || (key.ctrl && key.name === 'c')) {
                cleanup()
                resolve(null)
            }
        }
        const cleanup = () => {
            stdin.setRawMode(false)
            stdin.pause()
            stdin.off('keypress', onKeyPress)
            stdout.write('\x1b[?25h')
        }

        emitKeypressEvents(stdin)
        stdin.setRawMode(true)
        stdin.resume()
        stdin.on('keypress', onKeyPress)
        stdout.write('\x1b[?25l')             // 隐藏光标
        render(profiles, index, true)

    })
}
