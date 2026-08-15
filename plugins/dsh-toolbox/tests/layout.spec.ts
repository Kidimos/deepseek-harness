// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import {
  CENTER_RESERVE, TOOLBOX_MAX, TOOLBOX_MIN,
  clampToolboxWidth, derivedToolboxWidth, parseGridTracks, trackPx,
} from '../src/client/layout.ts'

beforeEach(() => { localStorage.clear() })

describe('parseGridTracks', () => {
  it('splits tracks without breaking on parens with spaces', () => {
    expect(parseGridTracks('280px minmax(0, 1fr) 0px')).toEqual(['280px', 'minmax(0, 1fr)', '0px'])
  })

  it('handles the empty string and extra whitespace', () => {
    expect(parseGridTracks('')).toEqual([])
    expect(parseGridTracks('  280px  1fr ')).toEqual(['280px', '1fr'])
  })
})

describe('trackPx', () => {
  it('reads px tracks and zeroes non-px tracks', () => {
    expect(trackPx('280px')).toBe(280)
    expect(trackPx('-12.5px')).toBe(-12.5)
    expect(trackPx('minmax(0, 1fr)')).toBe(0)
  })
})

describe('clampToolboxWidth', () => {
  it('clamps into the contract range and rounds', () => {
    expect(clampToolboxWidth(1)).toBe(TOOLBOX_MIN)
    expect(clampToolboxWidth(99999)).toBe(TOOLBOX_MAX)
    expect(clampToolboxWidth(500.4)).toBe(500)
  })
})

describe('derivedToolboxWidth', () => {
  it('allocates half of the non-sidebar space (w_right <= w_middle by construction)', () => {
    const derived = derivedToolboxWidth(1920)
    expect(derived).toBe(Math.floor((1920 - 280) / 2))
    expect(derived).toBeLessThanOrEqual(1920 - 280 - derived)
  })

  it('never eats the center reserve on narrow frames', () => {
    const derived = derivedToolboxWidth(1000)
    expect(1000 - 280 - derived).toBeGreaterThanOrEqual(CENTER_RESERVE - 1)
  })

  it('floors at TOOLBOX_MIN and caps at TOOLBOX_MAX', () => {
    expect(derivedToolboxWidth(700)).toBe(TOOLBOX_MIN)
    expect(derivedToolboxWidth(4000)).toBe(TOOLBOX_MAX)
  })
})
