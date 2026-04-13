import { useEffect, useCallback } from 'react'
import { useUIStore } from '@renderer/stores/ui-store'
import { useTaskStore } from '@renderer/stores/task-store'
import { useBoardStore } from '@renderer/stores/board-store'
import { useNotificationStore } from '@renderer/stores/notification-store'
import type { Task, TaskStatus } from '@shared/types'

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

  const { updateTask, deleteTask, deleteTasks, reorderTask, moveTasks } =
    useTaskStore()
  const { selectedTaskIds, clearSelection, toggleTaskSelection } = useBoardStore()
  const notifications = useNotificationStore((s) => s.notifications)
  const markReadByTaskId = useNotificationStore((s) => s.markReadByTaskId)
  const markReadByTaskIds = useNotificationStore((s) => s.markReadByTaskIds)
  const markUnread = useNotificationStore((s) => s.markUnread)

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

      // When task detail is open, allow 1-4 for status change and Escape to close
      if (taskDetailOpen && e.key !== 'Escape' && !['1', '2', '3', '4'].includes(e.key)) {
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
          e.preventDefault()
          if (currentTasks.length > 0) {
            if (e.altKey && e.key === 'ArrowDown') {
              // Option+Down: move card one position down within column
              const task = getFocusedTask()
              if (task && focusedTaskIndex < currentTasks.length - 1) {
                reorderTask(task.id, focusedTaskIndex + 1)
                setFocusedTask(focusedTaskIndex + 1)
              }
            } else if (e.shiftKey && e.key === 'ArrowDown') {
              // Shift+Down: select current card and move focus down
              const task = getFocusedTask()
              if (task) {
                toggleTaskSelection(task.id, true)
              }
              const next = Math.min(focusedTaskIndex + 1, currentTasks.length - 1)
              setFocusedTask(next)
            } else {
              // Move down within column
              const next = Math.min(focusedTaskIndex + 1, currentTasks.length - 1)
              setFocusedTask(next)
            }
          }
          break
        }

        case 'k':
        case 'ArrowUp': {
          e.preventDefault()
          if (e.altKey && e.key === 'ArrowUp') {
            // Option+Up: move card one position up within column
            if (currentTasks.length > 0) {
              const task = getFocusedTask()
              if (task && focusedTaskIndex > 0) {
                reorderTask(task.id, focusedTaskIndex - 1)
                setFocusedTask(focusedTaskIndex - 1)
              }
            }
          } else if (e.shiftKey && e.key === 'ArrowUp') {
            // Shift+Up: select current card and move focus up
            if (currentTasks.length > 0) {
              const task = getFocusedTask()
              if (task) {
                toggleTaskSelection(task.id, true)
              }
              const prev = Math.max(focusedTaskIndex - 1, 0)
              setFocusedTask(prev)
            }
          } else {
            // Move up within column, or focus input when at top
            if (focusedTaskIndex === 0 && onFocusInput) {
              onFocusInput(focusedColumnIndex)
            } else if (currentTasks.length > 0) {
              const prev = Math.max(focusedTaskIndex - 1, 0)
              setFocusedTask(prev)
            }
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

        case ' ': {
          // Open focused task detail and focus the title for editing
          e.preventDefault()
          const spaceTask = getFocusedTask()
          if (spaceTask) {
            openTaskDetail(spaceTask.id)
            useUIStore.getState().setPendingDetailFocus('title')
          }
          break
        }

        case 'Enter': {
          // Open focused task detail and focus the terminal
          e.preventDefault()
          const task = getFocusedTask()
          if (task) {
            openTaskDetail(task.id)
            useUIStore.getState().setPendingDetailFocus('terminal')
          }
          break
        }

        case 'Escape': {
          // Layered dismiss:
          // 1. Close task detail if open
          // 2. Clear multi-selection if active
          // 3. Focus the create-task input
          e.preventDefault()
          if (taskDetailOpen) {
            closeTaskDetail()
          } else if (selectedTaskIds.size > 0) {
            clearSelection()
          } else if (onFocusInput) {
            setFocusedColumn(0)
            onFocusInput(0)
          }
          break
        }

        case 'c': {
          // Open create task input only in todo column
          e.preventDefault()
          if (onCreateTask && columnOrder[focusedColumnIndex] === 'todo') {
            onCreateTask(focusedColumnIndex)
          }
          break
        }

        case '1':
        case '2':
        case '3':
        case '4': {
          // Set status of focused/selected/opened task
          e.preventDefault()
          const statusMap: Record<string, TaskStatus> = {
            '1': 'todo',
            '2': 'in-progress',
            '3': 'in-review',
            '4': 'done'
          }
          const newStatus = statusMap[e.key]
          if (newStatus) {
            if (taskDetailOpen) {
              // Task detail is open — change the status of the opened task
              const { activeTaskId } = useUIStore.getState()
              const { projectState } = useTaskStore.getState()
              const openedTask = projectState?.tasks.find((t) => t.id === activeTaskId)
              if (openedTask) {
                updateTask({ ...openedTask, status: newStatus })
              }
            } else if (selectedTaskIds.size > 0) {
              // Multi-selection on board
              const effectiveIds = new Set(selectedTaskIds)
              const focused = getFocusedTask()
              if (focused) effectiveIds.add(focused.id)
              const { projectState } = useTaskStore.getState()
              const sortedIds = Array.from(effectiveIds).sort((a, b) => {
                const taskA = projectState?.tasks.find((t) => t.id === a)
                const taskB = projectState?.tasks.find((t) => t.id === b)
                return (taskA?.sortOrder ?? 0) - (taskB?.sortOrder ?? 0)
              })
              moveTasks(sortedIds, newStatus, 0)
              clearSelection()
            } else {
              // Single focused task on board
              const task = getFocusedTask()
              if (task) {
                updateTask({ ...task, status: newStatus })
              }
            }
          }
          break
        }

        case 'r': {
          // Toggle read/unread for focused task (or selected tasks)
          e.preventDefault()
          if (selectedTaskIds.size > 0) {
            const effectiveIds = new Set(selectedTaskIds)
            const focused = getFocusedTask()
            if (focused) effectiveIds.add(focused.id)
            const hasUnread = notifications.some(
              (n) => !n.read && n.taskId && effectiveIds.has(n.taskId)
            )
            if (hasUnread) {
              markReadByTaskIds(Array.from(effectiveIds))
            } else {
              const { projectState } = useTaskStore.getState()
              for (const id of effectiveIds) {
                const t = projectState?.tasks.find((tk) => tk.id === id)
                if (t) markUnread(id, t.title)
              }
            }
          } else {
            const task = getFocusedTask()
            if (task) {
              const hasUnread = notifications.some(
                (n) => !n.read && n.taskId === task.id
              )
              if (hasUnread) {
                markReadByTaskId(task.id)
              } else {
                markUnread(task.id, task.title)
              }
            }
          }
          break
        }

        case 'Backspace':
        case 'Delete': {
          // Delete selected tasks (multi-select) or focused task
          e.preventDefault()
          if (selectedTaskIds.size > 0) {
            // Include the focused task in the batch
            const effectiveIds = new Set(selectedTaskIds)
            const focused = getFocusedTask()
            if (focused) effectiveIds.add(focused.id)
            const count = effectiveIds.size
            const confirmed = window.confirm(
              `Delete ${count} selected task${count > 1 ? 's' : ''}?`
            )
            if (confirmed) {
              const idsToDelete = Array.from(effectiveIds)
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
    reorderTask,
    moveTasks,
    getFocusedTask,
    onCreateTask,
    onFocusInput,
    selectedTaskIds,
    clearSelection,
    toggleTaskSelection,
    notifications,
    markReadByTaskId,
    markReadByTaskIds,
    markUnread
  ])
}
