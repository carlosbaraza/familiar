import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { Terminal } from './Terminal'

// Track mock instances
const mockWrite = vi.fn()
const mockDispose = vi.fn()
const mockOpen = vi.fn()
const mockLoadAddon = vi.fn()
const mockFocus = vi.fn()
const mockOnData = vi.fn().mockReturnValue({ dispose: vi.fn() })
const mockOnResize = vi.fn().mockReturnValue({ dispose: vi.fn() })
const mockAttachCustomKeyEventHandler = vi.fn()

// Must use a class for `new XTerm(...)` to work
vi.mock('@xterm/xterm', () => {
  return {
    Terminal: class MockTerminal {
      write = mockWrite
      dispose = mockDispose
      open = mockOpen
      loadAddon = mockLoadAddon
      focus = mockFocus
      onData = mockOnData
      onResize = mockOnResize
      attachCustomKeyEventHandler = mockAttachCustomKeyEventHandler
      options: Record<string, unknown>
      constructor(opts: Record<string, unknown>) {
        this.options = opts
      }
    }
  }
})

// Mock FitAddon
const mockFit = vi.fn()
vi.mock('@xterm/addon-fit', () => ({
  FitAddon: class MockFitAddon {
    fit = mockFit
  }
}))

// Mock WebglAddon
vi.mock('@xterm/addon-webgl', () => ({
  WebglAddon: class MockWebglAddon {}
}))

// Mock CSS import
vi.mock('@xterm/xterm/css/xterm.css', () => ({}))

// Mock window.api
const mockPtyDataCleanup = vi.fn()
const mockOnPtyData = vi.fn().mockReturnValue(mockPtyDataCleanup)

const mockApi = {
  onPtyData: mockOnPtyData,
  ptyWrite: vi.fn().mockResolvedValue(undefined),
  ptyResize: vi.fn().mockResolvedValue(undefined),
  clipboardSaveImage: vi.fn().mockResolvedValue('/tmp/image.png')
}

;(window as any).api = mockApi

// Mock ResizeObserver
const mockObserve = vi.fn()
const mockDisconnect = vi.fn()

class MockResizeObserver {
  observe = mockObserve
  disconnect = mockDisconnect
  unobserve = vi.fn()
  constructor(public callback: ResizeObserverCallback) {}
}

;(window as any).ResizeObserver = MockResizeObserver

// Mock getComputedStyle to return CSS variables
vi.spyOn(window, 'getComputedStyle').mockReturnValue({
  getPropertyValue: vi.fn().mockReturnValue('#1a1a27')
} as unknown as CSSStyleDeclaration)

// Mock requestAnimationFrame
vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
  cb(0)
  return 0
})

describe('Terminal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders a container div', () => {
    const { container } = render(<Terminal sessionId="test-session" />)
    expect(container.querySelector('div')).toBeTruthy()
  })

  it('opens the terminal in the container element', () => {
    render(<Terminal sessionId="test-session" />)
    expect(mockOpen).toHaveBeenCalledOnce()
  })

  it('loads FitAddon and WebglAddon', () => {
    render(<Terminal sessionId="test-session" />)
    // Should load at least 2 addons: FitAddon + WebglAddon
    expect(mockLoadAddon).toHaveBeenCalledTimes(2)
  })

  it('calls fit and focus after mount via requestAnimationFrame', () => {
    render(<Terminal sessionId="test-session" />)
    expect(mockFit).toHaveBeenCalled()
    expect(mockFocus).toHaveBeenCalled()
  })

  it('registers onPtyData listener for the session', () => {
    render(<Terminal sessionId="test-session" />)
    expect(mockOnPtyData).toHaveBeenCalledOnce()
    expect(mockOnPtyData).toHaveBeenCalledWith(expect.any(Function))
  })

  it('writes incoming PTY data to xterm when session matches', () => {
    render(<Terminal sessionId="test-session" />)

    const dataCallback = mockOnPtyData.mock.calls[0][0]
    dataCallback('test-session', 'hello world')
    expect(mockWrite).toHaveBeenCalledWith('hello world')
  })

  it('ignores PTY data for other sessions', () => {
    render(<Terminal sessionId="test-session" />)

    const dataCallback = mockOnPtyData.mock.calls[0][0]
    dataCallback('other-session', 'should not show')
    expect(mockWrite).not.toHaveBeenCalled()
  })

  it('sends terminal input to PTY via ptyWrite', () => {
    render(<Terminal sessionId="test-session" />)

    const inputCallback = mockOnData.mock.calls[0][0]
    inputCallback('user input')
    expect(mockApi.ptyWrite).toHaveBeenCalledWith('test-session', 'user input')
  })

  it('notifies PTY of resize events', () => {
    render(<Terminal sessionId="test-session" />)

    const resizeCallback = mockOnResize.mock.calls[0][0]
    resizeCallback({ cols: 120, rows: 40 })
    expect(mockApi.ptyResize).toHaveBeenCalledWith('test-session', 120, 40)
  })

  it('sets up ResizeObserver on the container', () => {
    render(<Terminal sessionId="test-session" />)
    expect(mockObserve).toHaveBeenCalledOnce()
  })

  it('attaches a custom key handler to pass Shift+Escape through', () => {
    render(<Terminal sessionId="test-session" />)

    expect(mockAttachCustomKeyEventHandler).toHaveBeenCalledOnce()
    const handler = mockAttachCustomKeyEventHandler.mock.calls[0][0]

    // Shift+Escape should return false (not handled by xterm)
    expect(handler({ key: 'Escape', shiftKey: true })).toBe(false)
    // Regular Escape should return true (handled by xterm)
    expect(handler({ key: 'Escape', shiftKey: false })).toBe(true)
    // Other keys should return true
    expect(handler({ key: 'a', shiftKey: false })).toBe(true)
  })

  it('calls onReady callback after initialization', () => {
    const onReady = vi.fn()
    render(<Terminal sessionId="test-session" onReady={onReady} />)
    expect(onReady).toHaveBeenCalledOnce()
  })

  it('cleans up on unmount: disposes terminal, disconnects observer, removes PTY listener', () => {
    const { unmount } = render(<Terminal sessionId="test-session" />)
    unmount()

    expect(mockDispose).toHaveBeenCalledOnce()
    expect(mockDisconnect).toHaveBeenCalledOnce()
    expect(mockPtyDataCleanup).toHaveBeenCalledOnce()
  })

  it('handles WebGL addon failure gracefully', () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    // Make loadAddon succeed for FitAddon but throw for WebglAddon
    let callCount = 0
    mockLoadAddon.mockImplementation(() => {
      callCount++
      if (callCount === 2) throw new Error('WebGL not supported')
    })

    // Should not throw
    expect(() => render(<Terminal sessionId="test-session" />)).not.toThrow()

    consoleSpy.mockRestore()
  })
})
