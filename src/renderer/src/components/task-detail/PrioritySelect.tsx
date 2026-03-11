import { useState, useRef, useEffect } from 'react'
import type { Priority } from '@shared/types'
import { PRIORITY_COLORS } from '@shared/constants'
import styles from './PrioritySelect.module.css'

const PRIORITIES: Priority[] = ['urgent', 'high', 'medium', 'low', 'none']

const PRIORITY_LABELS: Record<Priority, string> = {
  urgent: 'Urgent',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
  none: 'None'
}

interface PrioritySelectProps {
  value: Priority
  onChange: (priority: Priority) => void
}

export function PrioritySelect({ value, onChange }: PrioritySelectProps): JSX.Element {
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent): void {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [open])

  return (
    <div className={styles.wrapper} ref={wrapperRef}>
      <button className={styles.trigger} onClick={() => setOpen(!open)}>
        <span className={styles.dot} style={{ backgroundColor: PRIORITY_COLORS[value] }} />
        {PRIORITY_LABELS[value]}
      </button>
      {open && (
        <div className={styles.dropdown}>
          {PRIORITIES.map((p) => (
            <button
              key={p}
              className={`${styles.option} ${p === value ? styles.optionActive : ''}`}
              onClick={() => {
                onChange(p)
                setOpen(false)
              }}
            >
              <span className={styles.dot} style={{ backgroundColor: PRIORITY_COLORS[p] }} />
              {PRIORITY_LABELS[p]}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
