import { useState, useEffect, useRef, useCallback } from 'react'
import { nanoid } from 'nanoid'
import type { ActivityEntry } from '@shared/types'
import { ActivityEntryComponent } from './ActivityEntry'
import styles from './ActivityTimeline.module.css'

interface ActivityTimelineProps {
  taskId: string
}

export function ActivityTimeline({ taskId }: ActivityTimelineProps): React.JSX.Element {
  const [entries, setEntries] = useState<ActivityEntry[]>([])
  const [noteText, setNoteText] = useState('')
  const [sending, setSending] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)

  // Load activity on mount
  useEffect(() => {
    let cancelled = false
    async function load(): Promise<void> {
      try {
        const data = await window.api.readTaskActivity(taskId)
        if (!cancelled) {
          setEntries(data)
        }
      } catch {
        // Activity file may not exist yet
        if (!cancelled) setEntries([])
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [taskId])

  // Auto-scroll to bottom when entries change — scroll the parent scroll area
  useEffect(() => {
    if (listRef.current) {
      const scrollParent = listRef.current.closest('[class*="scrollArea"]')
      if (scrollParent) {
        scrollParent.scrollTop = scrollParent.scrollHeight
      }
    }
  }, [entries])

  const handleAddNote = useCallback(async () => {
    const trimmed = noteText.trim()
    if (!trimmed) return

    setSending(true)
    const entry: ActivityEntry = {
      id: nanoid(8),
      timestamp: new Date().toISOString(),
      type: 'note',
      message: trimmed
    }

    try {
      await window.api.appendActivity(taskId, entry)
      setEntries((prev) => [...prev, entry])
      setNoteText('')
    } catch (err) {
      console.error('Failed to add note:', err)
    } finally {
      setSending(false)
    }
  }, [noteText, taskId])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleAddNote()
      }
    },
    [handleAddNote]
  )

  return (
    <div className={styles.container}>
      <div className={styles.header}>Activity</div>
      <div className={styles.list} ref={listRef}>
        {entries.length === 0 ? (
          <div className={styles.empty}>No activity yet</div>
        ) : (
          entries.map((entry) => <ActivityEntryComponent key={entry.id} entry={entry} />)
        )}
      </div>
      <div className={styles.inputArea}>
        <input
          className={styles.noteInput}
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add a note..."
          disabled={sending}
        />
        <button
          className={styles.sendButton}
          onClick={handleAddNote}
          disabled={sending || !noteText.trim()}
        >
          Send
        </button>
      </div>
    </div>
  )
}
