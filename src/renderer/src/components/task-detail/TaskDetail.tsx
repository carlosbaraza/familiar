import { useEffect, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { Task } from '@shared/types'
import { useTaskStore } from '@renderer/stores/task-store'
import { TaskDetailHeader } from './TaskDetailHeader'
import { TaskDetailContent } from './TaskDetailContent'
import styles from './TaskDetail.module.css'

interface TaskDetailProps {
  taskId: string
  onClose: () => void
}

export function TaskDetail({ taskId, onClose }: TaskDetailProps): JSX.Element {
  const task = useTaskStore((s) => s.getTaskById(taskId))
  const updateTask = useTaskStore((s) => s.updateTask)

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent): void {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const handleUpdate = useCallback(
    (updates: Partial<Task>) => {
      if (!task) return
      updateTask({ ...task, ...updates })
    },
    [task, updateTask]
  )

  return (
    <AnimatePresence>
      <motion.div
        className={styles.overlay}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
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
      </motion.div>
    </AnimatePresence>
  )
}
