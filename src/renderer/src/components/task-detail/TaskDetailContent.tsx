import { useState, useEffect, useCallback, useRef } from 'react'
import type { Task, TaskPastedFile } from '@shared/types'
import { onFileChange } from '@renderer/lib/file-change-hub'
import { SplitPanel } from './SplitPanel'
import { ActivityPreview } from './ActivityPreview'
import { TaskDetailHeader } from './TaskDetailHeader'
import { TerminalPanel } from '@renderer/components/terminal/TerminalPanel'
import { BlockEditor } from '@renderer/components/editor'
import { PastedFileCard, PreviewDialog } from '@renderer/components/common'
import { TaskFiles } from './TaskFiles'
import { Tooltip } from '@renderer/components/common'
import { useUIStore } from '@renderer/stores/ui-store'
import { useTaskStore } from '@renderer/stores/task-store'
import styles from './TaskDetailContent.module.css'

function CopyDocumentButton({ taskId }: { taskId: string }): React.JSX.Element {
  const [copied, setCopied] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleCopy = useCallback(async () => {
    try {
      const content = await window.api.readTaskDocument(taskId)
      await navigator.clipboard?.writeText(content || '')
      setCopied(true)
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      timeoutRef.current = setTimeout(() => setCopied(false), 1500)
    } catch (err) {
      console.warn('Failed to copy document:', err)
    }
  }, [taskId])

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  return (
    <Tooltip placement="bottom" content={copied ? 'Copied!' : 'Copy as markdown'}>
      <button
        className={styles.copyDocumentButton}
        onClick={handleCopy}
        data-testid="copy-document-button"
      >
        {copied ? (
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path
              d="M3.5 8.5L6.5 11.5L12.5 4.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <rect
              x="5.5"
              y="5.5"
              width="8"
              height="8"
              rx="1.5"
              stroke="currentColor"
              strokeWidth="1.3"
            />
            <path
              d="M10.5 5.5V3.5C10.5 2.67 9.83 2 9 2H3.5C2.67 2 2 2.67 2 3.5V9C2 9.83 2.67 10.5 3.5 10.5H5.5"
              stroke="currentColor"
              strokeWidth="1.3"
            />
          </svg>
        )}
      </button>
    </Tooltip>
  )
}

interface TaskDetailContentProps {
  taskId: string
  task: Task
  onUpdate: (updates: Partial<Task>) => void
  onClose: () => void
  visible?: boolean
}

export function TaskDetailContent({ taskId, task, onUpdate, onClose }: TaskDetailContentProps): React.JSX.Element {
  const editorPanelWidth = useUIStore((s) => s.editorPanelWidth)
  const setEditorPanelWidth = useUIStore((s) => s.setEditorPanelWidth)
  const [documentContent, setDocumentContent] = useState<string | undefined>(undefined)
  const [documentLoaded, setDocumentLoaded] = useState(false)
  const [previewFile, setPreviewFile] = useState<TaskPastedFile | null>(null)

  const currentTask = useTaskStore((s) => s.getTaskById(taskId))
  const updateTask = useTaskStore((s) => s.updateTask)
  const pastedFiles = currentTask?.pastedFiles ?? []

  const handleRemovePastedFile = useCallback(
    async (filename: string) => {
      if (!currentTask) return
      try {
        await window.api.deletePastedFile(taskId, filename)
        const updated = (currentTask.pastedFiles ?? []).filter((f) => f.filename !== filename)
        await updateTask({ ...currentTask, pastedFiles: updated.length > 0 ? updated : undefined })
      } catch (err) {
        console.warn('Failed to delete pasted file:', err)
      }
    },
    [currentTask, taskId, updateTask]
  )

  // Load document content on mount / taskId change
  useEffect(() => {
    let cancelled = false

    async function loadDocument(): Promise<void> {
      try {
        const content = await window.api.readTaskDocument(taskId)
        if (!cancelled) {
          setDocumentContent(content || '')
          setDocumentLoaded(true)
        }
      } catch {
        // Document may not exist yet — that's fine
        if (!cancelled) {
          setDocumentContent('')
          setDocumentLoaded(true)
        }
      }
    }

    setDocumentLoaded(false)
    loadDocument()

    return () => {
      cancelled = true
    }
  }, [taskId])

  // Re-read document when external file changes are detected
  useEffect(() => {
    return onFileChange(async () => {
      try {
        const content = await window.api.readTaskDocument(taskId)
        setDocumentContent(content || '')
      } catch {
        // Ignore — task may have been deleted
      }
    })
  }, [taskId])

  return (
    <div className={styles.container}>
      <SplitPanel
        left={
          <div className={styles.leftPanel}>
            <div className={styles.stickyHeader}>
              <TaskDetailHeader task={task} onUpdate={onUpdate} onClose={onClose} />
            </div>
            <ActivityPreview taskId={taskId} />
            <div className={styles.scrollArea}>
              <div className={styles.editorSection}>
                <div className={styles.copyDocumentWrapper}>
                  <CopyDocumentButton taskId={taskId} />
                </div>
                {documentLoaded ? (
                  <BlockEditor
                    key={taskId}
                    taskId={taskId}
                    initialContent={documentContent}
                  />
                ) : (
                  <div className={styles.editorArea}>Loading...</div>
                )}
              </div>
              {task.parentTaskId && (() => {
                const parentTask = useTaskStore.getState().getTaskById(task.parentTaskId!)
                return (
                  <div
                    className={styles.parentLink}
                    onClick={() => {
                      const { openTaskDetail } = useUIStore.getState()
                      openTaskDetail(task.parentTaskId!)
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="12" y1="17" x2="12" y2="3" />
                      <path d="m5 10 7-7 7 7" />
                      <path d="M5 21h14" />
                    </svg>
                    <span>{parentTask?.title ?? task.parentTaskId}</span>
                    {!parentTask && (
                      <span className={styles.parentDeleted}>(deleted)</span>
                    )}
                  </div>
                )
              })()}
              <TaskFiles taskId={taskId} />
              {pastedFiles.length > 0 && (
                <div className={styles.pastedFilesSection}>
                  <div className={styles.pastedFilesHeader}>Pasted Files</div>
                  <div className={styles.pastedFilesList}>
                    {pastedFiles.map((pf) => (
                      <PastedFileCard
                        key={pf.filename}
                        file={pf}
                        onClick={() => setPreviewFile(pf)}
                        onRemove={() => handleRemovePastedFile(pf.filename)}
                      />
                    ))}
                  </div>
                </div>
              )}
              {task.subtaskIds && task.subtaskIds.length > 0 && (
                <div className={styles.subtasksSection}>
                  <div className={styles.subtasksSectionHeader}>
                    <span className={styles.subtasksSectionTitle}>Subtasks</span>
                    <button
                      className={styles.addSubtaskBtn}
                      onClick={() => {
                        useUIStore.getState().openCreateTaskModalForSubtask(task.id)
                      }}
                      type="button"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <line x1="5" y1="12" x2="19" y2="12" />
                      </svg>
                      Add Subtask
                    </button>
                  </div>
                  <div className={styles.subtasksList}>
                    {task.subtaskIds.map((subtaskId) => {
                      const subtask = useTaskStore.getState().getTaskById(subtaskId)
                      return (
                        <button
                          key={subtaskId}
                          className={styles.subtaskItem}
                          onClick={() => {
                            const { openTaskDetail } = useUIStore.getState()
                            openTaskDetail(subtaskId)
                          }}
                          type="button"
                        >
                          {subtask ? (
                            <>
                              <span className={`${styles.subtaskStatus} ${styles[`subtaskStatus_${subtask.status.replace('-', '_')}`] ?? ''}`}>
                                {subtask.status === 'in-progress' ? 'In Progress' :
                                 subtask.status === 'in-review' ? 'In Review' :
                                 subtask.status.charAt(0).toUpperCase() + subtask.status.slice(1)}
                              </span>
                              <span className={`${styles.subtaskName} ${subtask.status === 'done' ? styles.subtaskNameDone : ''}`}>
                                {subtask.title}
                              </span>
                              <span
                                className={styles.subtaskAgentDot}
                                style={{ backgroundColor: subtask.agentStatus === 'running' ? 'var(--agent-running)' : subtask.agentStatus === 'done' ? 'var(--agent-done)' : subtask.agentStatus === 'error' ? 'var(--agent-error)' : 'var(--agent-idle)' }}
                              />
                            </>
                          ) : (
                            <>
                              <span className={styles.subtaskName}>{subtaskId}</span>
                              <span className={styles.parentDeleted}>(deleted)</span>
                            </>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        }
        right={
          <TerminalPanel taskId={taskId} />
        }
        defaultLeftWidth={editorPanelWidth}
        minLeftWidth={300}
        maxLeftWidth={800}
        onWidthChange={setEditorPanelWidth}
      />
      {previewFile && (
        <PreviewDialog
          taskId={taskId}
          file={previewFile}
          onClose={() => setPreviewFile(null)}
        />
      )}
    </div>
  )
}
