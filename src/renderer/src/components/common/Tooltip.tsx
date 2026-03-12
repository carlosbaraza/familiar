import { useState, useRef, useCallback, useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

export type TooltipPlacement = 'top' | 'bottom' | 'left' | 'right'

export interface TooltipProps {
  /** The element that triggers the tooltip on hover */
  children: ReactNode
  /** Content rendered inside the tooltip — can be any JSX */
  content: ReactNode
  /** Placement relative to the trigger element */
  placement?: TooltipPlacement
  /** Delay in ms before showing */
  delay?: number
  /** Whether the tooltip is disabled */
  disabled?: boolean
}

export function Tooltip({
  children,
  content,
  placement = 'top',
  delay = 150,
  disabled = false
}: TooltipProps): React.JSX.Element {
  const [visible, setVisible] = useState(false)
  const [coords, setCoords] = useState<{ top: number; left: number }>({ top: 0, left: 0 })
  const triggerRef = useRef<HTMLDivElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const show = useCallback(() => {
    if (disabled) return
    timerRef.current = setTimeout(() => {
      setVisible(true)
    }, delay)
  }, [delay, disabled])

  const hide = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    setVisible(false)
  }, [])

  // Position the tooltip after it becomes visible
  useEffect(() => {
    if (!visible || !triggerRef.current) return

    const updatePosition = (): void => {
      const trigger = triggerRef.current
      const tooltip = tooltipRef.current
      if (!trigger || !tooltip) return

      const rect = trigger.getBoundingClientRect()
      const tipRect = tooltip.getBoundingClientRect()
      const gap = 8

      let top = 0
      let left = 0

      switch (placement) {
        case 'top':
          top = rect.top - tipRect.height - gap
          left = rect.left + rect.width / 2 - tipRect.width / 2
          break
        case 'bottom':
          top = rect.bottom + gap
          left = rect.left + rect.width / 2 - tipRect.width / 2
          break
        case 'left':
          top = rect.top + rect.height / 2 - tipRect.height / 2
          left = rect.left - tipRect.width - gap
          break
        case 'right':
          top = rect.top + rect.height / 2 - tipRect.height / 2
          left = rect.right + gap
          break
      }

      // Clamp to viewport
      const pad = 8
      left = Math.max(pad, Math.min(left, window.innerWidth - tipRect.width - pad))
      top = Math.max(pad, Math.min(top, window.innerHeight - tipRect.height - pad))

      setCoords({ top, left })
    }

    // Run on next frame so tooltip is measured
    requestAnimationFrame(updatePosition)
  }, [visible, placement])

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={show}
        onMouseLeave={hide}
        style={{ display: 'inline-flex' }}
      >
        {children}
      </div>
      {visible &&
        createPortal(
          <div
            ref={tooltipRef}
            style={{
              ...styles.tooltip,
              top: coords.top,
              left: coords.left
            }}
            onMouseEnter={hide}
          >
            <div style={styles.arrow} data-placement={placement} />
            {content}
          </div>,
          document.body
        )}
    </>
  )
}

const styles: Record<string, React.CSSProperties> = {
  tooltip: {
    position: 'fixed',
    zIndex: 10000,
    padding: '8px 12px',
    borderRadius: '8px',
    backgroundColor: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    boxShadow: '0 8px 30px rgba(0, 0, 0, 0.45), 0 0 1px rgba(255,255,255,0.05)',
    fontSize: '12px',
    lineHeight: 1.5,
    color: 'var(--text-secondary)',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    maxWidth: '280px',
    pointerEvents: 'none',
    animation: 'tooltip-fade-in 0.15s ease-out'
  },
  arrow: {
    display: 'none'
  }
}

// Inject keyframe animation once
if (typeof document !== 'undefined') {
  const id = 'familiar-tooltip-keyframes'
  if (!document.getElementById(id)) {
    const style = document.createElement('style')
    style.id = id
    style.textContent = `
      @keyframes tooltip-fade-in {
        from { opacity: 0; transform: translateY(4px); }
        to { opacity: 1; transform: translateY(0); }
      }
    `
    document.head.appendChild(style)
  }
}
