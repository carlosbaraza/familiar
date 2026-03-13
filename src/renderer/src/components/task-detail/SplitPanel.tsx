import { useRef, useState, useCallback, useEffect } from 'react'
import styles from './SplitPanel.module.css'

interface SplitPanelProps {
  left: React.ReactNode
  right: React.ReactNode
  defaultLeftWidth?: number // pixels, default 400
  minLeftWidth?: number // pixels, default 200
  maxLeftWidth?: number // pixels, default 800
  onWidthChange?: (width: number) => void
}

export function SplitPanel({
  left,
  right,
  defaultLeftWidth = 400,
  minLeftWidth = 200,
  maxLeftWidth = 800,
  onWidthChange
}: SplitPanelProps): React.JSX.Element {
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
      const clamped = Math.max(minLeftWidth, Math.min(maxLeftWidth, x))
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
      <div className={styles.left} style={{ width: `${leftWidth}px`, maxWidth: '45%' }} data-testid="split-left">
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
