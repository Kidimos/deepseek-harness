/**
 * The toolbox layout controller: appends ONE trailing track (the 工具区
 * column) to the shipped three-column frame grid by mirroring the shell's
 * inline grid-template-columns and re-appending our track on every shell
 * update (MutationObserver). Owns the drag handle, the collapse-as-zero-width
 * keep-mounted behavior, the width policy, and per-project persistence —
 * everything here is plugin-owned; no harness code changes.
 *
 * The shell's own write carries 3 tracks; our write carries 4. The observer
 * treats a 3-track string as a shell update (mirror + re-append) and a
 * 4-track string as our own echo (ignore), which breaks the feedback loop.
 * @module dsh-toolbox/client/layout
 */

import type { ToolboxLayoutSnapshot } from './contract.ts'

/** Width policy constants — the plugin's configuration surface. */
export const TOOLBOX_MIN = 300
export const TOOLBOX_MAX = 1200
/** Assumed sidebar width in px (w_left); the frame exposes no live read. */
export const SIDEBAR_ASSUMED = 280
/** Center-column floor the toolbox never eats into. */
export const CENTER_RESERVE = 320

/** Column element class (also the portal + drag-handle anchor). */
export const TOOLBOX_COL_CLASS = 'dsh-toolbox-col'
export const TOOLBOX_HANDLE_CLASS = 'dsh-toolbox-handle'
export const TOOLBOX_COLLAPSE_CLASS = 'dsh-toolbox-collapse'

const PERSIST_WIDTH = 'dsh-toolbox:width:'
const PERSIST_COLLAPSED = 'dsh-toolbox:collapsed:'

/** Parse an inline grid-template-columns string into its tracks (parens may contain spaces). */
export function parseGridTracks(input: string): string[] {
  const tracks: string[] = []
  let depth = 0
  let current = ''
  for (const char of input) {
    if (char === '(') depth += 1
    if (char === ')') depth = Math.max(0, depth - 1)
    if (char === ' ' && depth === 0) {
      if (current !== '') {
        tracks.push(current)
        current = ''
      }
      continue
    }
    current += char
  }
  if (current !== '') tracks.push(current)
  return tracks
}

/** Extract a px width from one track (0 for fr/minmax/non-px tracks). */
export function trackPx(track: string): number {
  const match = /^(-?[\d.]+)px$/.exec(track.trim())
  return match === null ? 0 : Number(match[1])
}

/** Clamp a toolbox width into the contract range. */
export function clampToolboxWidth(px: number): number {
  return Math.min(TOOLBOX_MAX, Math.max(TOOLBOX_MIN, Math.round(px)))
}

/**
 * Derive the toolbox allocation: w_right = max(300, floor((w_all - 280) / 2)),
 * capped by the contract range, and never eating the center's reserve. The
 * half rule makes w_right <= w_middle by construction.
 * @param frameWidth - the frame's rendered width in px.
 * @returns the derived width.
 */
export function derivedToolboxWidth(frameWidth: number): number {
  const available = Math.max(0, frameWidth - SIDEBAR_ASSUMED)
  let width = clampToolboxWidth(Math.floor(available / 2))
  if (available - width < CENTER_RESERVE) {
    width = Math.max(TOOLBOX_MIN, available - CENTER_RESERVE)
  }
  return clampToolboxWidth(width)
}

/** Read one persisted number, best-effort (private mode / cleared storage). */
function readStored(key: string): number | null {
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return null
    const value = Number(raw)
    return Number.isFinite(value) ? value : null
  } catch {
    return null
  }
}

/** Write one persisted number, best-effort. */
function writeStored(key: string, value: number): void {
  try {
    localStorage.setItem(key, String(value))
  } catch {
    // best-effort
  }
}

/** Locate the shipped frame grid (the element whose inline grid we extend). */
function findFrame(): HTMLElement | null {
  const stamped = document.querySelector<HTMLElement>('[data-dsh-frame]')
  if (stamped !== null) return stamped
  // rc.6-native fallback: the frame grid is the parent of the sidebar column.
  return document.querySelector<HTMLElement>('[class*="sidebarCol"]')?.parentElement ?? null
}

/** The layout controller (single instance, owned by apply). */
export class ToolboxLayoutController {
  private listeners = new Set<() => void>()
  private state: ToolboxLayoutSnapshot = { columnEl: null, width: 0, collapsed: true }
  private frame: HTMLElement | null = null
  private column: HTMLDivElement | null = null
  private handle: HTMLDivElement | null = null
  private collapseBtn: HTMLButtonElement | null = null
  private styleObserver: MutationObserver | null = null
  private waitObserver: MutationObserver | null = null
  private sizeObserver: ResizeObserver | null = null
  private shellTracks: string[] = []
  private frameWidth = 0
  private root = ''

  getSnapshot = (): ToolboxLayoutSnapshot => this.state

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  private emit(): void {
    for (const listener of [...this.listeners]) listener()
  }

  /** Start watching for the frame and attach once it appears. Never throws. */
  mount(): void {
    const tryAttach = (): void => {
      if (this.frame !== null) return
      const frame = findFrame()
      if (frame === null) return
      try {
        this.attach(frame)
      } catch {
        // The panels degrade, never the GUI boot.
      }
    }
    this.waitObserver = new MutationObserver(() => { tryAttach() })
    this.waitObserver.observe(document.body, { childList: true, subtree: true })
    tryAttach()
  }

  private attach(frame: HTMLElement): void {
    this.frame = frame
    this.frameWidth = frame.getBoundingClientRect().width

    const column = document.createElement('div')
    column.className = TOOLBOX_COL_CLASS
    column.style.minWidth = '0'
    column.style.overflow = 'hidden'
    column.style.display = 'flex'
    column.style.flexDirection = 'column'
    frame.appendChild(column)
    this.column = column

    const handle = document.createElement('div')
    handle.className = TOOLBOX_HANDLE_CLASS
    handle.style.position = 'absolute'
    handle.style.top = '0'
    handle.style.bottom = '0'
    handle.style.zIndex = '30'
    handle.style.cursor = 'col-resize'
    handle.style.touchAction = 'none'
    handle.style.width = '12px'
    handle.style.marginLeft = '-12px'
    handle.addEventListener('pointerdown', (event: PointerEvent) => { this.onHandleDown(event) })
    handle.addEventListener('dblclick', () => {
      this.setWidth(derivedToolboxWidth(this.frameWidth), true)
    })
    frame.appendChild(handle)
    this.handle = handle

    // The collapse pill: a frame-level sibling of the handle (z-index above
    // it) straddling the column's LEFT edge, so it never covers tool content
    // and never gets clipped by the column's overflow.
    const collapse = document.createElement('button')
    collapse.type = 'button'
    collapse.className = TOOLBOX_COLLAPSE_CLASS
    collapse.textContent = '▶'
    collapse.style.position = 'absolute'
    collapse.style.top = '40%'
    collapse.style.zIndex = '40'
    collapse.style.transform = 'translateX(-50%)'
    collapse.style.display = 'none'
    collapse.style.width = '22px'
    collapse.style.height = '44px'
    collapse.style.padding = '0'
    collapse.style.border = '1px solid var(--dsw-alias-border-l1)'
    collapse.style.borderRadius = '8px'
    collapse.style.background = 'var(--dsw-alias-bg-overlay)'
    collapse.style.color = 'var(--dsw-alias-label-secondary)'
    collapse.style.cursor = 'pointer'
    collapse.style.fontSize = '10px'
    collapse.style.lineHeight = '1'
    collapse.addEventListener('click', () => { this.close() })
    frame.appendChild(collapse)
    this.collapseBtn = collapse

    // Sync the shell's inline grid: a 3-track write is the shell's own
    // (mirror + re-append); a 4-track write is our echo (ignore).
    const syncGrid = (): void => {
      const el = this.frame
      if (el === null) return
      const inline = el.style.gridTemplateColumns
      if (inline === '') return
      const tracks = parseGridTracks(inline)
      if (tracks.length === 3) {
        this.shellTracks = tracks
        this.applyGrid()
        return
      }
      if (tracks.length === 4 && this.shellTracks.length === 3) return
    }
    this.styleObserver = new MutationObserver(syncGrid)
    this.styleObserver.observe(frame, { attributes: true, attributeFilter: ['style'] })

    this.sizeObserver = new ResizeObserver(() => {
      if (this.frame === null) return
      this.frameWidth = this.frame.getBoundingClientRect().width
      // Re-derive while open, so the allocation follows the window (the
      // user's dragged width is not overwritten in persistence).
      if (!this.state.collapsed) this.setWidth(derivedToolboxWidth(this.frameWidth), false)
    })
    this.sizeObserver.observe(frame)

    // Initial sync: mirror the shell's own tracks if it already wrote them.
    const initial = frame.style.gridTemplateColumns
    if (initial !== '') {
      const tracks = parseGridTracks(initial)
      if (tracks.length === 3) this.shellTracks = tracks
    }

    this.state = { ...this.state, columnEl: column }
    this.emit()
    this.applyGrid()
  }

  /** Bind the project root: per-project width/collapse restore + persist. */
  setRoot(root: string): void {
    this.root = root
    let storedCollapsed: string | null = null
    try {
      storedCollapsed = localStorage.getItem(PERSIST_COLLAPSED + root)
    } catch {
      // best-effort (private mode / cleared storage)
    }
    const collapsed = storedCollapsed !== 'expanded'
    const storedWidth = readStored(PERSIST_WIDTH + root)
    this.state = {
      ...this.state,
      collapsed,
      width: collapsed ? 0 : clampToolboxWidth(storedWidth ?? derivedToolboxWidth(this.frameWidth)),
    }
    this.emit()
    this.applyGrid()
  }

  /** Open at the derived allocation (or the persisted width, once it exists). */
  open(): void {
    const stored = readStored(PERSIST_WIDTH + this.root)
    this.state = {
      ...this.state,
      collapsed: false,
      width: clampToolboxWidth(stored ?? derivedToolboxWidth(this.frameWidth)),
    }
    try {
      localStorage.setItem(PERSIST_COLLAPSED + this.root, 'expanded')
    } catch {
      // best-effort
    }
    this.emit()
    this.applyGrid()
  }

  /** Collapse to zero width (kept mounted). */
  close(): void {
    this.state = { ...this.state, collapsed: true, width: 0 }
    try {
      localStorage.setItem(PERSIST_COLLAPSED + this.root, 'collapsed')
    } catch {
      // best-effort
    }
    this.emit()
    this.applyGrid()
  }

  /** Set the collapse pill's accessible label (locale-following). */
  setCollapseLabel(label: string): void {
    if (this.collapseBtn !== null) {
      this.collapseBtn.title = label
      this.collapseBtn.setAttribute('aria-label', label)
    }
  }

  /** Set the live width (clamped). `persist` records it as the user's choice. */
  setWidth(px: number, persist = true): void {
    const width = clampToolboxWidth(px)
    if (this.state.width === width) return
    this.state = { ...this.state, width }
    if (persist) writeStored(PERSIST_WIDTH + this.root, width)
    this.emit()
    this.applyGrid()
  }

  private applyGrid(): void {
    const el = this.frame
    if (el === null || this.shellTracks.length === 0) return
    const ourTrack = `${this.state.collapsed ? 0 : this.state.width}px`
    el.style.gridTemplateColumns = [...this.shellTracks, ourTrack].join(' ')
    // The handle straddles the column's LEFT edge (the resize boundary):
    // position it at frame width minus our track, hidden while collapsed.
    if (this.handle !== null) {
      this.handle.style.display = this.state.collapsed ? 'none' : 'block'
      this.handle.style.left = `${this.frameWidth - (this.state.collapsed ? 0 : this.state.width)}px`
    }
    if (this.collapseBtn !== null) {
      this.collapseBtn.style.display = this.state.collapsed ? 'none' : 'block'
      this.collapseBtn.style.left = `${this.frameWidth - (this.state.collapsed ? 0 : this.state.width)}px`
    }
  }

  private onHandleDown(event: PointerEvent): void {
    const handle = this.handle
    if (handle === null) return
    event.preventDefault()
    handle.setPointerCapture(event.pointerId)
    const startWidth = this.state.width
    const origin = event.clientX
    let latestX = origin
    let raf: number | null = null
    // The shell eases grid-template-columns; while dragging, the track must
    // follow the pointer instantly. Restore the previous inline transition on
    // pointer up (the stylesheet transition resumes for ordinary open/close).
    const frame = this.frame
    const previousTransition = frame?.style.transition ?? ''
    if (frame !== null) frame.style.transition = 'none'
    const onMove = (move: PointerEvent): void => {
      if (!handle.hasPointerCapture(move.pointerId)) return
      latestX = move.clientX
      if (raf !== null) return
      raf = requestAnimationFrame(() => {
        raf = null
        // Dragging left (negative dx) widens: the handle sits on the left edge.
        this.setWidth(startWidth - (latestX - origin), false)
      })
    }
    const onUp = (up: PointerEvent): void => {
      if (!handle.hasPointerCapture(up.pointerId)) return
      handle.releasePointerCapture(up.pointerId)
      handle.removeEventListener('pointermove', onMove)
      handle.removeEventListener('pointerup', onUp)
      if (frame !== null) frame.style.transition = previousTransition
      this.setWidth(startWidth - (up.clientX - origin), true)
    }
    handle.addEventListener('pointermove', onMove)
    handle.addEventListener('pointerup', onUp)
  }

  /** Remove every DOM trace and observer. */
  dispose(): void {
    this.waitObserver?.disconnect()
    this.styleObserver?.disconnect()
    this.sizeObserver?.disconnect()
    if (this.frame !== null && this.shellTracks.length > 0) {
      this.frame.style.gridTemplateColumns = this.shellTracks.join(' ')
    }
    this.column?.remove()
    this.handle?.remove()
    this.collapseBtn?.remove()
    this.column = null
    this.handle = null
    this.collapseBtn = null
    this.frame = null
    this.listeners.clear()
  }
}
