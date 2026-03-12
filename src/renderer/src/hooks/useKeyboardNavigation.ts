import { useEffect, useCallback, useRef } from 'react'
import { useUIStore } from '@renderer/stores/ui-store'
import { useTaskStore } from '@renderer/stores/task-store'
import { useBoardStore } from '@renderer/stores/board-store'
import { useNotificationStore } from '@renderer/stores/notification-store'
import type { Task, TaskStatus, Priority } from '@shared/types'

interface UseKeyboardNavigationOptions {
  tasksByStatus: Record<string, Task[]>
  columnOrder: TaskStatus[]
  onCreateTask?: (columnIndex: number) => void
  onFocusInput?: (columnIndex: number) => void
}

export function useKeyboardNavigation({
  tasksByStatus,
  columnOrder,
  onCreateTask,
  onFocusInput
}: UseKeyboardNavigationOptions): void {
  const {
    focusedColumnIndex,
    focusedTaskIndex,
    setFocusedColumn,
    setFocusedTask,
    openTaskDetail,
    closeTaskDetail,
    taskDetailOpen
  } = useUIStore()

  const { updateTask, deleteTask, deleteTasks } = useTaskStore()
  const { selectedTaskIds, clearSelection } = useBoardStore()
  const markReadByTaskId = useNotificationStore((s) => s.markReadByTaskId)

  // Track 's' key prefix for status-change chord (s + 1-5)
  const statusPending = useRef(false)
  const statusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const getFocusedTask = useCallback((): Task | undefined => {
    const column = columnOrder[focusedColumnIndex]
    if (!column) return undefined
    const tasks = tasksByStatus[column]
    if (!tasks || tasks.length === 0) return undefined
    return tasks[focusedTaskIndex]
  }, [columnOrder, focusedColumnIndex, tasksByStatus, focusedTaskIndex])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      // Don't intercept when typing in inputs
      const target = e.target as HTMLElement
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable
      ) {
        return
      }

      // Handle status chord: if 's' was pressed, next key 1-5 sets status
      if (statusPending.current) {
        statusPending.current = false
        if (statusTimeoutRef.current) clearTimeout(statusTimeoutRef.current)
        const statusMap: Record<string, TaskStatus> = {
          '1': 'todo',
          '2': 'in-progress',
          '3': 'in-review',
          '4': 'done',
          '5': 'archived'
        }
        const newStatus = statusMap[e.key]
        if (newStatus) {
          e.preventDefault()
          const task = getFocusedTask()
          if (task) {
            updateTask({ ...task, status: newStatus })
          }
          return
        }
        // If key wasn't 1-5, fall through to normal handling
      }

      // When task detail is open, only allow Escape to close it
      if (taskDetailOpen && e.key !== 'Escape') {
        return
      }

      // When no card is focused yet (-1), activate focus on first navigation key
      if (focusedColumnIndex < 0 || focusedTaskIndex < 0) {
        const navKeys = ['j', 'k', 'h', 'l', 'ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight']
        if (navKeys.includes(e.key)) {
          e.preventDefault()
          setFocusedColumn(0)
          setFocusedTask(0)
          return
        }
      }

      const currentColumn = columnOrder[focusedColumnIndex]
      const currentTasks = currentColumn ? (tasksByStatus[currentColumn] ?? []) : []

      switch (e.key) {
        case 'j':
        case 'ArrowDown': {
          // Move down within column
          e.preventDefault()
          if (currentTasks.length > 0) {
            const next = Math.min(focusedTaskIndex + 1, currentTasks.length - 1)
            setFocusedTask(next)
          }
          break
        }

        case 'k':
        case 'ArrowUp': {
          // Move up within column, or focus input when at top
          e.preventDefault()
          if (focusedTaskIndex === 0 && onFocusInput) {
            onFocusInput(focusedColumnIndex)
          } else if (currentTasks.length > 0) {
            const prev = Math.max(focusedTaskIndex - 1, 0)
            setFocusedTask(prev)
          }
          break
        }

        case 'h':
        case 'ArrowLeft': {
          // Move to previous column
          e.preventDefault()
          if (focusedColumnIndex > 0) {
            setFocusedColumn(focusedColumnIndex - 1)
          }
          break
        }

        case 'l':
        case 'ArrowRight': {
          // Move to next column
          e.preventDefault()
          if (focusedColumnIndex < columnOrder.length - 1) {
            setFocusedColumn(focusedColumnIndex + 1)
          }
          break
        }

        case 'Enter': {
          // Open focused task detail
          e.preventDefault()
          const task = getFocusedTask()
          if (task) {
            openTaskDetail(task.id)
          }
          break
        }

        case 'Escape': {
          // Close task detail / deselect
          // Shift+Escape also works (needed when terminal has focus)
          e.preventDefault()
          if (taskDetailOpen) {
            closeTaskDetail()
          }
          break
        }

        case 'c': {
          // Open create task input in focused column
          e.preventDefault()
          if (onCreateTask) {
            onCreateTask(focusedColumnIndex)
          }
          break
        }

        case '1':
        case '2':
        case '3':
        case '4': {
          // Set priority of focused task
          e.preventDefault()
          const task = getFocusedTask()
          if (task) {
            const priorityMap: Record<string, Priority> = {
              '1': 'urgent',
              '2': 'high',
              '3': 'medium',
              '4': 'low'
            }
            const newPriority = priorityMap[e.key]
            if (newPriority) {
              updateTask({ ...task, priority: newPriority })
            }
          }
          break
        }

        case 'r': {
          // Mark focused task (or selected tasks) notifications as read
          e.preventDefault()
          if (selectedTaskIds.size > 0) {
            for (const id of selectedTaskIds) {
              markReadByTaskId(id)
            }
          } else {
            const task = getFocusedTask()
            if (task) {
              markReadByTaskId(task.id)
            }
          }
          break
        }

        case 's': {
          // Start status-change chord: s + 1-5
          e.preventDefault()
          const task = getFocusedTask()
          if (task) {
            statusPending.current = true
            if (statusTimeoutRef.current) clearTimeout(statusTimeoutRef.current)
            statusTimeoutRef.current = setTimeout(() => {
              statusPending.current = false
            }, 1500)
          }
          break
        }

        case 'Backspace':
        case 'Delete': {
          // Delete selected tasks (multi-select) or focused task
          e.preventDefault()
          if (selectedTaskIds.size > 0) {
            const count = selectedTaskIds.size
            const confirmed = window.confirm(
              `Delete ${count} selected task${count > 1 ? 's' : ''}?`
            )
            if (confirmed) {
              const idsToDelete = Array.from(selectedTaskIds)
              clearSelection()
              deleteTasks(idsToDelete)
            }
          } else {
            const task = getFocusedTask()
            if (task) {
              const confirmed = window.confirm(
                `Delete task "${task.title}"?`
              )
              if (confirmed) {
                deleteTask(task.id)
              }
            }
          }
          break
        }

        default:
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    columnOrder,
    focusedColumnIndex,
    focusedTaskIndex,
    tasksByStatus,
    taskDetailOpen,
    setFocusedColumn,
    setFocusedTask,
    openTaskDetail,
    closeTaskDetail,
    updateTask,
    deleteTask,
    deleteTasks,
    getFocusedTask,
    onCreateTask,
    onFocusInput,
    selectedTaskIds,
    clearSelection,
    markReadByTaskId
  ])
}
