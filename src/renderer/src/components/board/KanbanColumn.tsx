import { useState, useCallback, useRef, useEffect } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import type { Task, TaskStatus, Snippet } from '@shared/types'
import { COLUMN_LABELS } from '@shared/constants'
import { useUIStore } from '@renderer/stores/ui-store'
import { useContextMenu } from '@renderer/hooks/useContextMenu'
import { ContextMenu } from '@renderer/components/common'
import type { ContextMenuItem } from '@renderer/components/common'
import { CreateTaskInput } from '@renderer/components/common/CreateTaskInput'
import type { CreateTaskInputHandle, PendingImage, PendingPastedFile } from '@renderer/components/common/CreateTaskInput'
import type { DropIndicator } from './KanbanBoard'
import { TaskCard } from './TaskCard'
import styles from './KanbanColumn.module.css'

interface KanbanColumnProps {
  status: TaskStatus
  tasks: Task[]
  onTaskClick: (taskId: string) => void
  onMultiSelect: (taskId: string, append: boolean) => void
  onCreateTask: (title: string, document?: string, enabledSnippets?: Snippet[], pendingImages?: PendingImage[], pendingPastedFiles?: PendingPastedFile[]) => void
  selectedTaskId?: string | null
  multiSelectedIds?: Set<string>
  draggedTaskId?: string | null
  dragSourceColumn?: TaskStatus | null
  dropIndicator?: DropIndicator | null
  focusedTaskIndex?: number
  isFocusedColumn?: boolean
  showCreateInput?: boolean
  onCreateInputShown?: () => void
  headerAction?: React.ReactNode
  dashboardSnippets?: Snippet[]
  allSnippets?: Snippet[]
  alwaysShowInput?: boolean
  onInputExit?: () => void
}

const STATUS_COLORS: Record<TaskStatus, string> = {
  todo: 'var(--status-todo)',
  'in-progress': 'var(--status-in-progress)',
  'in-review': 'var(--status-in-review)',
  done: 'var(--status-done)',
  archived: 'var(--status-archived)'
}

export function KanbanColumn({
  status,
  tasks,
  onTaskClick,
  onMultiSelect,
  onCreateTask,
  selectedTaskId,
  multiSelectedIds,
  draggedTaskId,
  dragSourceColumn = null,
  dropIndicator,
  focusedTaskIndex = -1,
  isFocusedColumn = false,
  showCreateInput = false,
  onCreateInputShown,
  headerAction,
  dashboardSnippets = [],
  allSnippets = [],
  alwaysShowInput = false,
  onInputExit
}: KanbanColumnProps): React.JSX.Element {
  const draftKey = `familiar-draft-${status}`
  const [isCreating, setIsCreating] = useState(false)
  const inputRef = useRef<CreateTaskInputHandle>(null)
  const contextMenu = useContextMenu()

  const { isOver, setNodeRef } = useDroppable({
    id: `column-${status}`,
    data: { type: 'column', status }
  })

  const taskIds = tasks.map((t) => t.id)

  // Show create input when triggered externally (keyboard shortcut)
  useEffect(() => {
    if (showCreateInput && !isCreating) {
      setIsCreating(true)
      onCreateInputShown?.()
    }
  }, [showCreateInput, isCreating, onCreateInputShown])

  // Auto-focus input when creating
  useEffect(() => {
    if (isCreating && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isCreating])

  // Listen for focus-new-task-input event (triggered by Cmd+N)
  useEffect(() => {
    if (!alwaysShowInput) return
    const handleFocus = (): void => {
      useUIStore.getState().setFocusedColumn(-1)
      inputRef.current?.focus()
    }
    window.addEventListener('focus-new-task-input', handleFocus)
    return () => window.removeEventListener('focus-new-task-input', handleFocus)
  }, [alwaysShowInput])

  // Listen for focus-column-input event (triggered by ArrowUp from first task)
  useEffect(() => {
    if (!alwaysShowInput && !isCreating) return
    const handleFocusColumn = (e: Event): void => {
      const detail = (e as CustomEvent<{ status: string }>).detail
      if (detail.status === status) {
        useUIStore.getState().setFocusedColumn(-1)
        inputRef.current?.focus()
      }
    }
    window.addEventListener('focus-column-input', handleFocusColumn)
    return () => window.removeEventListener('focus-column-input', handleFocusColumn)
  }, [alwaysShowInput, isCreating, status])

  const handleInputFocus = useCallback(() => {
    useUIStore.getState().setFocusedColumn(-1)
  }, [])

  const handleInputCancel = useCallback(() => {
    if (!alwaysShowInput) {
      setIsCreating(false)
    }
  }, [alwaysShowInput])

  const columnContextItems: ContextMenuItem[] = [
    ...(status === 'todo'
      ? [
          {
            label: 'Create task',
            onClick: () => setIsCreating(true),
            shortcut: 'C'
          },
          { label: '', onClick: () => {}, divider: true } as ContextMenuItem
        ]
      : []),
    {
      label: `Clear column (${tasks.length})`,
      onClick: () => {},
      danger: tasks.length > 0
    }
  ]

  // Build the task list with drop indicator inserted at the right position
  const renderTasks = (): React.ReactNode => {
    if (tasks.length === 0 && !isCreating && !dropIndicator) {
      return (
        <div className={styles.empty}>
          <span style={{ opacity: 0.6 }}>No tasks</span>
        </div>
      )
    }

    const indicator = (
      <div
        key="drop-indicator"
        className={styles.dropIndicator}
      />
    )

    const elements: React.ReactNode[] = []

    // If there are no tasks but we have a drop indicator, just show the indicator
    if (tasks.length === 0 && dropIndicator) {
      return indicator
    }

    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i]

      // Insert drop indicator before this task if needed
      if (dropIndicator && dropIndicator.index === i && task.id !== draggedTaskId) {
        elements.push(indicator)
      }

      elements.push(
        <TaskCard
          key={task.id}
          task={task}
          onClick={() => onTaskClick(task.id)}
          onMultiSelect={onMultiSelect}
          isSelected={selectedTaskId === task.id}
          isMultiSelected={multiSelectedIds?.has(task.id) ?? false}
          isFocused={isFocusedColumn && focusedTaskIndex === i}
          dashboardSnippets={dashboardSnippets}
        />
      )
    }

    // Drop indicator at the end (after all cards)
    if (dropIndicator && dropIndicator.index >= tasks.length) {
      elements.push(indicator)
    }

    return elements
  }

  // Only highlight column as a drop target for cross-column drags
  const isCrossColumnDrag = isOver && dragSourceColumn !== null && dragSourceColumn !== status

  return (
    <div
      ref={setNodeRef}
      className={`${styles.column} ${alwaysShowInput ? styles.columnWide : ''} ${isCrossColumnDrag ? styles.columnDragOver : ''}`}
      onContextMenu={contextMenu.open}
    >
      <div className={styles.header}>
        <span
          className={styles.statusDot}
          style={{ backgroundColor: STATUS_COLORS[status] }}
        />
        <span className={styles.statusName}>{COLUMN_LABELS[status]}</span>
        <span className={styles.taskCount}>{tasks.length}</span>
        {headerAction}
      </div>

      {(alwaysShowInput || isCreating) && (
        <CreateTaskInput
          ref={inputRef}
          variant="square"
          onSubmit={onCreateTask}
          onCancel={handleInputCancel}
          onInputExit={onInputExit}
          onFocus={handleInputFocus}
          allSnippets={allSnippets}
          draftKey={draftKey}
        />
      )}

      <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
        <div className={`${styles.taskList} ${isCrossColumnDrag ? styles.dropTarget : ''}`}>
          {renderTasks()}
        </div>
      </SortableContext>

      {contextMenu.isOpen && (
        <ContextMenu
          items={columnContextItems}
          position={contextMenu.position}
          onClose={contextMenu.close}
        />
      )}
    </div>
  )
}
