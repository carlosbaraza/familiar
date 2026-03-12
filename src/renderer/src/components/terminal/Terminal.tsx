import { useEffect, useRef } from 'react'
import { Terminal as XTerm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebglAddon } from '@xterm/addon-webgl'
import '@xterm/xterm/css/xterm.css'

interface TerminalProps {
  sessionId: string
  onReady?: () => void
}

export function Terminal({ sessionId, onReady }: TerminalProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<XTerm | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)

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

    termRef.current = term
    fitAddonRef.current = fitAddon

    // Fit after DOM settles and focus the terminal
    requestAnimationFrame(() => {
      fitAddon.fit()
      term.focus()
    })

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
          window.api.ptyWrite(sessionId, paths.join(' '))
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
              const arrayBuffer = await blob.arrayBuffer()
              const savedPath = await window.api.clipboardSaveImage(arrayBuffer, item.type)
              window.api.ptyWrite(sessionId, savedPath)
              return
            }
          }
        }
      }
      // Text-only paste: let xterm.js handle it normally
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

  return (
    <div style={{ width: '100%', height: '100%', overflow: 'hidden', padding: 8 }}>
      <div
        ref={containerRef}
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  )
}
