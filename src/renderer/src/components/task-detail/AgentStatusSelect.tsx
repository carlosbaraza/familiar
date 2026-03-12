import { useState, useRef, useEffect } from 'react'
import type { AgentStatus } from '@shared/types'
import { useDropdownPosition } from '@renderer/hooks/useDropdownPosition'
import styles from './StatusSelect.module.css'

const AGENT_STATUS_COLORS: Record<AgentStatus, string> = {
  idle: '#5c5c6e',
  running: '#5e6ad2',
  done: '#27ae60',
  error: '#e74c3c'
}

const AGENT_STATUS_LABELS: Record<AgentStatus, string> = {
  idle: 'Idle',
  running: 'Running',
  done: 'Done',
  error: 'Error'
}

const AGENT_STATUSES: AgentStatus[] = ['idle', 'running', 'done', 'error']

interface AgentStatusSelectProps {
  value: AgentStatus
  onChange: (status: AgentStatus) => void
}

export function AgentStatusSelect({ value, onChange }: AgentStatusSelectProps): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  useDropdownPosition(dropdownRef, open)

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
        <span className={styles.dot} style={{ backgroundColor: AGENT_STATUS_COLORS[value] }} />
        {AGENT_STATUS_LABELS[value]}
      </button>
      {open && (
        <div ref={dropdownRef} className={styles.dropdown}>
          {AGENT_STATUSES.map((status) => (
            <button
              key={status}
              className={`${styles.option} ${status === value ? styles.optionActive : ''}`}
              onClick={() => {
                onChange(status)
                setOpen(false)
              }}
            >
              <span className={styles.dot} style={{ backgroundColor: AGENT_STATUS_COLORS[status] }} />
              {AGENT_STATUS_LABELS[status]}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
