import { useEffect, useCallback } from 'react'
import type { Task } from '@shared/types'
import { useTaskStore } from '@renderer/stores/task-store'
import { useNotificationStore } from '@renderer/stores/notification-store'
import { TaskDetailHeader } from './TaskDetailHeader'
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

  // Clear notifications only when task becomes visible (not just mounted)
  useEffect(() => {
    if (visible) {
      markReadByTaskId(taskId)
    }
  }, [taskId, visible, markReadByTaskId])

  // Close on Escape key — only when visible
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
          <TaskDetailHeader task={task} onUpdate={handleUpdate} onClose={onClose} />
          <TaskDetailContent taskId={taskId} />
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
