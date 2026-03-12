import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useContextMenu } from './useContextMenu'

function createMouseEvent(x: number, y: number): React.MouseEvent {
  return {
    clientX: x,
    clientY: y,
    preventDefault: () => {},
    stopPropagation: () => {}
  } as unknown as React.MouseEvent
}

describe('useContextMenu', () => {
  beforeEach(() => {
    // Set viewport dimensions
    Object.defineProperty(window, 'innerWidth', { value: 1024, writable: true })
    Object.defineProperty(window, 'innerHeight', { value: 768, writable: true })
  })

  it('starts closed with position at 0,0', () => {
    const { result } = renderHook(() => useContextMenu())
    expect(result.current.isOpen).toBe(false)
    expect(result.current.position).toEqual({ x: 0, y: 0 })
  })

  it('opens at the mouse position', () => {
    const { result } = renderHook(() => useContextMenu())

    act(() => {
      result.current.open(createMouseEvent(100, 200))
    })

    expect(result.current.isOpen).toBe(true)
    expect(result.current.position).toEqual({ x: 100, y: 200 })
  })

  it('clamps x position to keep menu within viewport', () => {
    const { result } = renderHook(() => useContextMenu())

    // Click near right edge: 1024 - 200 = 824, so x should be clamped to 824
    act(() => {
      result.current.open(createMouseEvent(900, 100))
    })

    expect(result.current.position.x).toBe(824) // 1024 - 200
    expect(result.current.position.y).toBe(100)
  })

  it('clamps y position to keep menu within viewport', () => {
    const { result } = renderHook(() => useContextMenu())

    // Click near bottom edge: 768 - 200 = 568, so y should be clamped to 568
    act(() => {
      result.current.open(createMouseEvent(100, 700))
    })

    expect(result.current.position.x).toBe(100)
    expect(result.current.position.y).toBe(568) // 768 - 200
  })

  it('clamps both x and y when near corner', () => {
    const { result } = renderHook(() => useContextMenu())

    act(() => {
      result.current.open(createMouseEvent(950, 700))
    })

    expect(result.current.position).toEqual({ x: 824, y: 568 })
  })

  it('does not clamp when position fits within viewport', () => {
    const { result } = renderHook(() => useContextMenu())

    act(() => {
      result.current.open(createMouseEvent(400, 300))
    })

    expect(result.current.position).toEqual({ x: 400, y: 300 })
  })

  it('close() sets isOpen to false but preserves position', () => {
    const { result } = renderHook(() => useContextMenu())

    act(() => {
      result.current.open(createMouseEvent(100, 200))
    })
    expect(result.current.isOpen).toBe(true)

    act(() => {
      result.current.close()
    })
    expect(result.current.isOpen).toBe(false)
    expect(result.current.position).toEqual({ x: 100, y: 200 })
  })

  // --- Auto-close listeners ---

  it('closes on window click when open', () => {
    const { result } = renderHook(() => useContextMenu())

    act(() => {
      result.current.open(createMouseEvent(100, 200))
    })
    expect(result.current.isOpen).toBe(true)

    act(() => {
      window.dispatchEvent(new Event('click'))
    })
    expect(result.current.isOpen).toBe(false)
  })

  it('closes on Escape key when open', () => {
    const { result } = renderHook(() => useContextMenu())

    act(() => {
      result.current.open(createMouseEvent(100, 200))
    })
    expect(result.current.isOpen).toBe(true)

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    })
    expect(result.current.isOpen).toBe(false)
  })

  it('closes on scroll when open', () => {
    const { result } = renderHook(() => useContextMenu())

    act(() => {
      result.current.open(createMouseEvent(100, 200))
    })
    expect(result.current.isOpen).toBe(true)

    act(() => {
      window.dispatchEvent(new Event('scroll'))
    })
    expect(result.current.isOpen).toBe(false)
  })

  it('does not add listeners when closed', () => {
    const { result } = renderHook(() => useContextMenu())

    // Menu is closed — dispatching events should not cause issues
    act(() => {
      window.dispatchEvent(new Event('click'))
      window.dispatchEvent(new Event('scroll'))
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    })

    expect(result.current.isOpen).toBe(false)
  })

  it('does not close on non-Escape keys', () => {
    const { result } = renderHook(() => useContextMenu())

    act(() => {
      result.current.open(createMouseEvent(100, 200))
    })

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
    })

    expect(result.current.isOpen).toBe(true)
  })

  it('can reopen after closing', () => {
    const { result } = renderHook(() => useContextMenu())

    act(() => {
      result.current.open(createMouseEvent(100, 200))
    })
    act(() => {
      result.current.close()
    })
    expect(result.current.isOpen).toBe(false)

    act(() => {
      result.current.open(createMouseEvent(300, 400))
    })
    expect(result.current.isOpen).toBe(true)
    expect(result.current.position).toEqual({ x: 300, y: 400 })
  })

  it('preventDefault and stopPropagation are called on open', () => {
    const { result } = renderHook(() => useContextMenu())

    const preventDefault = vi.fn()
    const stopPropagation = vi.fn()

    act(() => {
      result.current.open({
        clientX: 100,
        clientY: 200,
        preventDefault,
        stopPropagation
      } as unknown as React.MouseEvent)
    })

    expect(preventDefault).toHaveBeenCalled()
    expect(stopPropagation).toHaveBeenCalled()
  })
})

// Need vi import for the last test
import { vi } from 'vitest'
