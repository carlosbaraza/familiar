import { useRef, useState, useCallback, useEffect } from 'react'
import styles from './SplitPanel.module.css'

interface SplitPanelProps {
  left: React.ReactNode
  right: React.ReactNode
  defaultLeftWidth?: number // percentage, default 50
  minLeftWidth?: number // percentage, default 20
  maxLeftWidth?: number // percentage, default 80
  onWidthChange?: (width: number) => void
}

export function SplitPanel({
  left,
  right,
  defaultLeftWidth = 50,
  minLeftWidth = 20,
  maxLeftWidth = 80,
  onWidthChange
}: SplitPanelProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const [leftWidth, setLeftWidth] = useState(defaultLeftWidth)
  const [dragging, setDragging] = useState(false)

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setDragging(true)
  }, [])

  useEffect(() => {
    if (!dragging) return

    function handleMouseMove(e: MouseEvent): void {
      if (!containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const x = e.clientX - rect.left
      const pct = (x / rect.width) * 100
      const clamped = Math.max(minLeftWidth, Math.min(maxLeftWidth, pct))
      setLeftWidth(clamped)
      onWidthChange?.(clamped)
    }

    function handleMouseUp(): void {
      setDragging(false)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    // Prevent text selection while dragging
    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'col-resize'

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
    }
  }, [dragging, minLeftWidth, maxLeftWidth, onWidthChange])

  return (
    <div className={styles.container} ref={containerRef} data-testid="split-panel">
      <div className={styles.left} style={{ width: `${leftWidth}%` }} data-testid="split-left">
        {left}
      </div>
      <div
        className={`${styles.handle} ${dragging ? styles.handleActive : ''}`}
        onMouseDown={handleMouseDown}
        data-testid="split-handle"
        role="separator"
        aria-orientation="vertical"
      />
      <div className={styles.right} data-testid="split-right">
        {right}
      </div>
    </div>
  )
}
