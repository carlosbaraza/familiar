import { useEffect, useRef } from 'react'
import { Terminal as XTerm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebglAddon } from '@xterm/addon-webgl'
import { WebLinksAddon } from '@xterm/addon-web-links'
import '@xterm/xterm/css/xterm.css'

interface TerminalProps {
  sessionId: string
  onReady?: () => void
}

export function Terminal({ sessionId, onReady }: TerminalProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<XTerm | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const sessionIdRef = useRef(sessionId)
  sessionIdRef.current = sessionId

  useEffect(() => {
    if (!containerRef.current) return

    // Read CSS custom properties from the app's design system
    const rootStyles = getComputedStyle(document.documentElement)
    const cssVar = (name: string): string => rootStyles.getPropertyValue(name).trim()

    const term = new XTerm({
      theme: {
        background: cssVar('--bg-primary'),
        foreground: cssVar('--text-primary'),
        cursor: cssVar('--accent'),
        cursorAccent: cssVar('--bg-primary'),
        selectionBackground: cssVar('--accent-subtle'),
        selectionForeground: cssVar('--text-primary'),
        black: cssVar('--bg-surface'),
        red: cssVar('--status-archived'),
        green: cssVar('--status-done'),
        yellow: cssVar('--status-in-progress'),
        blue: cssVar('--accent'),
        magenta: '#b07cd8',
        cyan: '#56b6c2',
        white: cssVar('--text-primary'),
        brightBlack: cssVar('--text-tertiary'),
        brightRed: '#ff6b6b',
        brightGreen: '#2ecc71',
        brightYellow: '#f7dc6f',
        brightBlue: cssVar('--accent-hover'),
        brightMagenta: '#c49de8',
        brightCyan: '#6ec8d4',
        brightWhite: '#ffffff'
      },
      fontSize: 13,
      fontFamily: "'SF Mono', 'Fira Code', 'Cascadia Code', monospace",
      cursorBlink: true,
      cursorStyle: 'bar',
      scrollback: 0, // tmux manages scrollback, disable xterm's scrollbar
      overviewRuler: { width: 0 },
      allowProposedApi: true
    })

    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)

    term.open(containerRef.current)

    // Try WebGL renderer for better performance
    try {
      const webglAddon = new WebglAddon()
      term.loadAddon(webglAddon)
    } catch {
      console.warn('WebGL renderer not available, falling back to canvas')
    }

    // Enable clickable URLs — opens in default browser on click
    const webLinksAddon = new WebLinksAddon((_event, uri) => {
      window.api.openExternal(uri)
    })
    term.loadAddon(webLinksAddon)

    // Custom key event handler for keys that need special treatment
    term.attachCustomKeyEventHandler((e: KeyboardEvent) => {
      // Let Shift+Escape bubble up to the app (not consumed by xterm)
      // so users can close the task detail view from the terminal
      if (e.key === 'Escape' && e.shiftKey) return false

      // Shift+Enter: xterm.js 6.0 doesn't support the kitty keyboard protocol,
      // so it sends plain \r for both Enter and Shift+Enter. Intercept Shift+Enter
      // and manually send the CSI u escape sequence that Claude Code expects.
      // IMPORTANT: Return false for ALL event types (keydown, keypress, keyup).
      // xterm.js fires both keydown and keypress for Enter. If we only block keydown,
      // _keyDownHandled stays false and _keyPress still processes the event, leaking
      // a plain \r to the PTY alongside our CSI u sequence.
      if (e.key === 'Enter' && e.shiftKey) {
        if (e.type === 'keydown') {
          window.api.ptyWrite(sessionId, '\x1b[13;2u')
        }
        return false
      }

      return true
    })

    termRef.current = term
    fitAddonRef.current = fitAddon

    // Fit after DOM settles
    requestAnimationFrame(() => {
      fitAddon.fit()
    })
    // No auto-focus — use Cmd+Enter or click to focus terminal

    // Connect to PTY data
    const cleanup = window.api.onPtyData((sid: string, data: string) => {
      if (sid === sessionId) {
        term.write(data)
      }
    })

    // Send terminal input to PTY
    term.onData((data: string) => {
      window.api.ptyWrite(sessionId, data)
    })

    // Handle resize — notify PTY of new dimensions
    term.onResize(({ cols, rows }: { cols: number; rows: number }) => {
      window.api.ptyResize(sessionId, cols, rows)
    })

    // Intercept paste in capture phase (before xterm.js processes it).
    // When clipboard contains files or image data, paste the file path instead
    // of raw content. This enables Claude Code and CLI tools to receive usable paths.
    const handlePaste = async (e: ClipboardEvent): Promise<void> => {
      const clipData = e.clipboardData
      if (!clipData) return

      // Diagnostic: log clipboard content types so we can debug paste issues
      const types = clipData.types ?? []
      const fileCount = clipData.files?.length ?? 0
      const itemCount = clipData.items?.length ?? 0
      const itemDetails = clipData.items
        ? Array.from({ length: clipData.items.length }, (_, i) => {
            const it = clipData.items[i]
            return `${it.kind}:${it.type}`
          })
        : []
      const target = (e.target as HTMLElement)?.tagName ?? 'unknown'
      console.debug(`[paste] target=${target} types=${types} files=${fileCount} items=[${itemDetails}]`)

      // Case 1: Files with paths (e.g. copied from Finder)
      const files = clipData.files
      if (files && files.length > 0) {
        const paths: string[] = []
        for (let i = 0; i < files.length; i++) {
          const filePath = (files[i] as File & { path?: string }).path
          if (filePath) paths.push(filePath)
        }
        if (paths.length > 0) {
          e.preventDefault()
          e.stopImmediatePropagation()
          console.debug(`[paste] case 1: file paths → ${paths.join(' ')}`)
          window.api.ptyWrite(sessionIdRef.current, paths.join(' '))
          return
        }
      }

      // Case 2: Image data in clipboard (e.g. screenshot from clipboard manager)
      // No file path available — save to temp file, then paste that path.
      const items = clipData.items
      if (items) {
        for (let i = 0; i < items.length; i++) {
          const item = items[i]
          if (item.kind === 'file' && item.type.startsWith('image/')) {
            const blob = item.getAsFile()
            if (blob) {
              e.preventDefault()
              e.stopImmediatePropagation()
              try {
                const arrayBuffer = await blob.arrayBuffer()
                const savedPath = await window.api.clipboardSaveImage(arrayBuffer, item.type)
                console.debug(`[paste] case 2: image saved → ${savedPath}`)
                window.api.ptyWrite(sessionIdRef.current, savedPath)
              } catch (err) {
                console.error('[paste] Failed to save clipboard image:', err)
              }
              return
            }
          }
        }
      }
      // Text-only paste: let xterm.js handle it normally
      console.debug('[paste] fallthrough: text-only, letting xterm handle')
    }
    containerRef.current.addEventListener('paste', handlePaste, { capture: true })

    // ResizeObserver for container resize (debounced)
    let resizeTimer: ReturnType<typeof setTimeout>
    const resizeObserver = new ResizeObserver(() => {
      clearTimeout(resizeTimer)
      resizeTimer = setTimeout(() => {
        fitAddon.fit()
      }, 50)
    })
    resizeObserver.observe(containerRef.current)

    onReady?.()

    return (): void => {
      clearTimeout(resizeTimer)
      resizeObserver.disconnect()
      containerRef.current?.removeEventListener('paste', handlePaste, { capture: true })
      cleanup()
      term.dispose()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId])

  // Listen for focus requests from keyboard navigation (Cmd+Enter)
  useEffect(() => {
    const handleFocusRequest = (e: Event): void => {
      const target = (e as CustomEvent).detail
      if (target === 'terminal' && termRef.current) {
        termRef.current.focus()
      }
    }
    window.addEventListener('task-detail-focus', handleFocusRequest)
    return () => window.removeEventListener('task-detail-focus', handleFocusRequest)
  }, [])

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        padding: 6
      }}
      className="terminal-focus-container"
    >
      <div
        ref={containerRef}
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  )
}
