import { useCallback, useRef, useEffect } from 'react'
import type { TaskPastedFile } from '@shared/types'
import { useUIStore } from '@renderer/stores/ui-store'
import { useTaskStore } from '@renderer/stores/task-store'
import { CreateTaskInput } from './CreateTaskInput'
import type { CreateTaskInputHandle, PendingPastedFile } from './CreateTaskInput'

export function CreateTaskModal(): React.JSX.Element | null {
  const open = useUIStore((s) => s.createTaskModalOpen)
  const parentId = useUIStore((s) => s.createTaskParentId)
  const closeModal = useUIStore((s) => s.closeCreateTaskModal)
  const addTask = useTaskStore((s) => s.addTask)
  const createSubtask = useTaskStore((s) => s.createSubtask)
  const inputRef = useRef<CreateTaskInputHandle>(null)

  useEffect(() => {
    if (open) {
      inputRef.current?.clear()
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [open])

  const handleSubmit = useCallback(
    async (
      title: string,
      document?: string,
      _enabledSnippets?: unknown,
      _pendingImages?: unknown,
      pendingPastedFiles?: PendingPastedFile[]
    ) => {
      let task: import('@shared/types').Task
      if (parentId) {
        task = await createSubtask(parentId, title, { documentContent: document })
      } else {
        task = await addTask(title)
        if (document) {
          await window.api.writeTaskDocument(task.id, document)
        }
      }
      // Save pasted files
      if (pendingPastedFiles && pendingPastedFiles.length > 0) {
        const pastedFiles: TaskPastedFile[] = []
        for (const pf of pendingPastedFiles) {
          await window.api.savePastedFile(task.id, pf.meta.filename, pf.content)
          pastedFiles.push(pf.meta)
        }
        const { updateTask } = useTaskStore.getState()
        await updateTask({ ...task, pastedFiles })
      }
      closeModal()

      // Open the subtask in detail view
      if (parentId) {
        useUIStore.getState().openTaskDetail(task.id)
      }
    },
    [addTask, createSubtask, parentId, closeModal]
  )

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        closeModal()
      }
    },
    [closeModal]
  )

  if (!open) return null

  return (
    <div style={overlayStyle} onClick={handleOverlayClick}>
      <div style={wrapperStyle}>
        <div style={headerStyle}>{parentId ? 'Create Subtask' : 'New Task'}</div>
        <CreateTaskInput
          ref={inputRef}
          variant="rounded"
          onSubmit={handleSubmit}
          onCancel={closeModal}
          parentId={parentId}
          placeholder="Task title... (Shift+Enter for notes, paste images)"
        />
      </div>
    </div>
  )
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.5)',
  backdropFilter: 'blur(8px)',
  WebkitBackdropFilter: 'blur(8px)',
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'center',
  paddingTop: '20vh',
  zIndex: 500,
  animation: 'cmdkFadeIn 120ms ease'
}

const wrapperStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: 480,
  borderRadius: 8,
  border: '1px solid var(--border)',
  backgroundColor: 'var(--bg-surface)',
  boxShadow: 'var(--shadow-lg)',
  overflow: 'hidden'
}

const headerStyle: React.CSSProperties = {
  padding: '12px 18px',
  fontSize: 13,
  fontWeight: 500,
  color: 'var(--text-secondary)',
  borderBottom: '1px solid var(--border)',
  fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
}
