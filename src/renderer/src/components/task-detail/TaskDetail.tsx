import { useEffect, useCallback } from 'react'
import type { Task } from '@shared/types'
import { useTaskStore } from '@renderer/stores/task-store'
import { useNotificationStore } from '@renderer/stores/notification-store'
import { TaskDetailContent } from './TaskDetailContent'
import styles from './TaskDetail.module.css'

interface TaskDetailProps {
  taskId: string
  visible: boolean
  onClose: () => void
}

export function TaskDetail({ taskId, visible, onClose }: TaskDetailProps): React.JSX.Element {
  const task = useTaskStore((s) => s.getTaskById(taskId))
  const updateTask = useTaskStore((s) => s.updateTask)
  const markReadByTaskId = useNotificationStore((s) => s.markReadByTaskId)
  const hasUnreadNotifications = useNotificationStore((s) =>
    s.notifications.some((n) => !n.read && n.taskId === taskId)
  )

  // Clear notifications when task is visible — reacts to both becoming visible
  // and new notifications arriving while already visible
  useEffect(() => {
    if (visible && hasUnreadNotifications) {
      markReadByTaskId(taskId)
    }
  }, [taskId, visible, hasUnreadNotifications, markReadByTaskId])

  // Close on Escape or Shift+Escape — only when visible
  // Shift+Escape is needed because plain Escape is consumed by xterm/Claude Code
  useEffect(() => {
    if (!visible) return
    function handleKeyDown(e: KeyboardEvent): void {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose, visible])

  const handleUpdate = useCallback(
    (updates: Partial<Task>) => {
      if (!task) return
      updateTask({ ...task, ...updates })
    },
    [task, updateTask]
  )

  return (
    <div
      className={styles.overlay}
      style={{
        visibility: visible ? 'visible' : 'hidden',
        pointerEvents: visible ? 'auto' : 'none'
      }}
    >
      {task ? (
        <div className={styles.inner}>
          <TaskDetailContent taskId={taskId} task={task} onUpdate={handleUpdate} onClose={onClose} />
        </div>
      ) : (
        <div className={styles.notFound}>
          Task not found
          <button onClick={onClose} style={{ marginLeft: 12 }}>
            Close
          </button>
        </div>
      )}
    </div>
  )
}
