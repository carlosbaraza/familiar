import { useState, useCallback, useRef, useEffect, useImperativeHandle, forwardRef } from 'react'
import type { Snippet, TaskPastedFile } from '@shared/types'
import type { AgentProfile } from '@shared/types/settings'
import { isLargePaste, createPastedFileMeta } from '@renderer/lib/paste-utils'
import { AgentIcon } from './AgentIcons'
import styles from './CreateTaskInput.module.css'

/** A pasted file (image or any other file) stored in temp, pending task creation */
export interface PendingAttachment {
  tempPath: string
  fileName: string
  mimeType: string
  size: number
}

/** @deprecated Use PendingAttachment instead */
export type PendingImage = PendingAttachment

/** A large pasted text pending task creation */
export interface PendingPastedFile {
  meta: TaskPastedFile
  content: string
}

export interface CreateTaskInputHandle {
  focus: () => void
  clear: () => void
}

export interface CreateTaskInputProps {
  /** Visual variant */
  variant: 'square' | 'rounded'
  /** Called when the user submits a new task */
  onSubmit: (
    title: string,
    document?: string,
    enabledSnippets?: Snippet[],
    pendingImages?: PendingAttachment[],
    pendingPastedFiles?: PendingPastedFile[]
  ) => void
  /** Called when the user presses Escape */
  onCancel?: () => void
  /** Called when ArrowDown exits the input (kanban navigation) */
  onInputExit?: () => void
  /** Called when the input receives focus */
  onFocus?: () => void
  /** Called when the input loses focus */
  onBlur?: () => void
  /** Snippets to show as toggles */
  allSnippets?: Snippet[]
  /** Parent task ID — if set, show parent badge */
  parentId?: string | null
  /** Parent task title for display */
  parentTitle?: string | null
  /** Called when user clears the parent selection */
  onClearParent?: () => void
  /** Whether to copy the agent session when creating a subtask */
  copySession?: boolean
  /** Called when the copy session toggle changes */
  onCopySessionChange?: (value: boolean) => void
  /** Placeholder text */
  placeholder?: string
  /** Persist draft to localStorage under this key */
  draftKey?: string
  /** Number of default rows */
  rows?: number
  /** Available agent profiles for the agent selector. Pass undefined to hide the control. */
  agents?: AgentProfile[]
  /** ID of the currently active agent */
  activeAgentId?: string
  /** Called when the user changes the active agent */
  onAgentChange?: (agentId: string) => void
}

export const CreateTaskInput = forwardRef<CreateTaskInputHandle, CreateTaskInputProps>(
  function CreateTaskInput(
    {
      variant,
      onSubmit,
      onCancel,
      onInputExit,
      onFocus,
      onBlur,
      allSnippets = [],
      parentId,
      parentTitle,
      onClearParent,
      copySession,
      onCopySessionChange,
      placeholder = 'Task title... (Shift+Enter for notes, paste images)',
      draftKey,
      rows = 3,
      agents,
      activeAgentId,
      onAgentChange
    },
    ref
  ) {
    const [title, setTitle] = useState(() => (draftKey ? localStorage.getItem(draftKey) ?? '' : ''))
    const [agentDropdownOpen, setAgentDropdownOpen] = useState(false)
    const agentDropdownRef = useRef<HTMLDivElement>(null)
    const [enabledSnippetIndices, setEnabledSnippetIndices] = useState<Set<number>>(
      () => new Set(allSnippets.map((_, i) => i))
    )
    const [pendingImages, setPendingImages] = useState<PendingAttachment[]>([])
    const [pendingPastedFiles, setPendingPastedFiles] = useState<PendingPastedFile[]>([])
    const inputRef = useRef<HTMLTextAreaElement>(null)

    useImperativeHandle(ref, () => ({
      focus: () => inputRef.current?.focus(),
      clear: () => {
        updateDraft('')
        setPendingImages([])
        setPendingPastedFiles([])
      }
    }))

    const updateDraft = useCallback(
      (value: string) => {
        setTitle(value)
        if (draftKey) {
          if (value) {
            localStorage.setItem(draftKey, value)
          } else {
            localStorage.removeItem(draftKey)
          }
        }
      },
      [draftKey]
    )

    // Sync enabled snippet indices when allSnippets length changes
    useEffect(() => {
      setEnabledSnippetIndices(new Set(allSnippets.map((_, i) => i)))
    }, [allSnippets.length])

    // Close agent dropdown on outside click
    useEffect(() => {
      if (!agentDropdownOpen) return
      function handleClickOutside(e: MouseEvent): void {
        if (agentDropdownRef.current && !agentDropdownRef.current.contains(e.target as Node)) {
          setAgentDropdownOpen(false)
        }
      }
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [agentDropdownOpen])

    const toggleSnippet = useCallback((index: number) => {
      setEnabledSnippetIndices((prev) => {
        const next = new Set(prev)
        if (next.has(index)) {
          next.delete(index)
        } else {
          next.add(index)
        }
        return next
      })
    }, [])

    // Auto-resize textarea
    const resizeTextarea = useCallback(() => {
      const el = inputRef.current
      if (el) {
        el.style.height = 'auto'
        const minHeight = parseFloat(getComputedStyle(el).minHeight) || 0
        el.style.height = `${Math.max(el.scrollHeight, minHeight)}px`
      }
    }, [])

    useEffect(() => {
      resizeTextarea()
    }, [title, resizeTextarea])

    const doSubmit = useCallback(() => {
      if (!title.trim() && pendingImages.length === 0 && pendingPastedFiles.length === 0) return
      const lines = title.trim().split('\n')
      const taskTitle = lines[0].trim() || 'Untitled'
      const document = lines.slice(1).join('\n').trim() || undefined
      const enabled = allSnippets.filter((_, i) => enabledSnippetIndices.has(i))
      onSubmit(
        taskTitle,
        document,
        enabled.length > 0 ? enabled : undefined,
        pendingImages.length > 0 ? pendingImages : undefined,
        pendingPastedFiles.length > 0 ? pendingPastedFiles : undefined
      )
      updateDraft('')
      setPendingImages([])
      setPendingPastedFiles([])
    }, [title, pendingImages, pendingPastedFiles, onSubmit, allSnippets, enabledSnippetIndices, updateDraft])

    const handlePaste = useCallback(
      async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
        // Check for file paste (images and other files)
        const items = e.clipboardData.items
        for (let i = 0; i < items.length; i++) {
          const item = items[i]
          if (item.kind === 'file') {
            e.preventDefault()
            const blob = item.getAsFile()
            if (!blob) continue
            const arrayBuffer = await blob.arrayBuffer()
            const mimeType = item.type || 'application/octet-stream'

            let tempPath: string
            let fileName: string

            if (mimeType.startsWith('image/')) {
              tempPath = await window.api.clipboardSaveImage(arrayBuffer, mimeType)
              const ext = mimeType === 'image/png' ? 'png' : mimeType === 'image/jpeg' ? 'jpg' : 'png'
              fileName = `paste-${Date.now()}.${ext}`
            } else {
              // Use the original file name from the blob, or generate one
              fileName = blob.name || `paste-${Date.now()}`
              tempPath = await window.api.clipboardSaveFile(arrayBuffer, fileName)
            }

            setPendingImages((prev) => [...prev, { tempPath, fileName, mimeType, size: blob.size }])
            return
          }
        }

        // Check for large text paste
        const text = e.clipboardData.getData('text/plain')
        if (text && isLargePaste(text)) {
          e.preventDefault()
          const meta = createPastedFileMeta(text)
          setPendingPastedFiles((prev) => [...prev, { meta, content: text }])
        }
      },
      []
    )

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault()
          doSubmit()
        }
        if (e.key === 'Escape') {
          e.stopPropagation()
          updateDraft('')
          setPendingImages([])
          setPendingPastedFiles([])
          onCancel?.()
          ;(e.target as HTMLTextAreaElement).blur()
        }
        // ArrowDown at last visual line: exit input and start navigating tasks
        if (e.key === 'ArrowDown' && onInputExit) {
          const textarea = e.target as HTMLTextAreaElement
          const { selectionStart, selectionEnd } = textarea
          const isCollapsed = selectionStart === selectionEnd
          if (isCollapsed) {
            const posBefore = selectionEnd
            requestAnimationFrame(() => {
              if (textarea.selectionStart === posBefore && textarea.selectionEnd === posBefore) {
                textarea.blur()
                onInputExit()
              }
            })
          }
        }
      },
      [doSubmit, onCancel, onInputExit, updateDraft]
    )

    const hasContent = title.trim() || pendingImages.length > 0 || pendingPastedFiles.length > 0

    const containerClassName = `${styles.container} ${variant === 'rounded' ? styles.rounded : styles.square}`

    return (
      <div className={containerClassName}>
        {parentId && (
          <div className={styles.parentBadge}>
            <div className={styles.parentBadgeContent}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="17" x2="12" y2="3" />
                <path d="m5 10 7-7 7 7" />
                <path d="M5 21h14" />
              </svg>
              <span className={styles.parentBadgeLabel}>CREATING SUBTASKS FOR</span>
              <span className={styles.parentBadgeTitle}>{parentTitle ?? parentId}</span>
            </div>
            {onClearParent && (
              <button className={styles.parentBadgeClear} onClick={onClearParent} type="button">
                Clear
              </button>
            )}
          </div>
        )}
        <textarea
          ref={inputRef}
          className={styles.input}
          placeholder={placeholder}
          value={title}
          onChange={(e) => updateDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onFocus={onFocus}
          onBlur={onBlur}
          rows={rows}
        />
        {(pendingImages.length > 0 || pendingPastedFiles.length > 0) && (
          <div className={styles.pendingAttachments}>
            {pendingImages.map((att, i) => (
              <div key={i} className={styles.pendingAttachmentRow}>
                <div className={styles.pendingAttachmentInfo}>
                  {att.mimeType.startsWith('image/') ? (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <polyline points="21 15 16 10 5 21" />
                    </svg>
                  ) : (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                  )}
                  <span className={styles.pendingAttachmentName}>{att.fileName}</span>
                </div>
                <button
                  className={styles.pendingAttachmentRemove}
                  onClick={() => setPendingImages((prev) => prev.filter((_, idx) => idx !== i))}
                  type="button"
                  aria-label="Remove attachment"
                >
                  &times;
                </button>
              </div>
            ))}
            {pendingPastedFiles.map((pf, i) => (
              <div key={pf.meta.filename} className={styles.pendingAttachmentRow}>
                <div className={styles.pendingAttachmentInfo}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                  <span className={styles.pendingAttachmentName}>{pf.meta.label}</span>
                  <span className={styles.pendingAttachmentMeta}>
                    {pf.meta.lineCount} lines
                  </span>
                </div>
                <button
                  className={styles.pendingAttachmentRemove}
                  onClick={() => setPendingPastedFiles((prev) => prev.filter((_, idx) => idx !== i))}
                  type="button"
                  aria-label="Remove pasted file"
                >
                  &times;
                </button>
              </div>
            ))}
          </div>
        )}
        {allSnippets.length > 0 && (
          <div className={styles.snippetToggles}>
            <span className={styles.snippetTogglesLabel}>Auto-run on create:</span>
            {allSnippets.map((snippet, i) => (
              <button
                key={i}
                className={`${styles.snippetToggle} ${enabledSnippetIndices.has(i) ? styles.snippetToggleOn : ''}`}
                onClick={() => toggleSnippet(i)}
                title={`${snippet.command}${enabledSnippetIndices.has(i) ? ' (enabled)' : ' (disabled)'}`}
                type="button"
              >
                <span className={styles.snippetToggleCheck}>
                  {enabledSnippetIndices.has(i) ? '✓' : ''}
                </span>
                {snippet.title}
              </button>
            ))}
          </div>
        )}
        {parentId && onCopySessionChange && (
          <div className={styles.copySessionRow}>
            <button
              type="button"
              className={`${styles.snippetToggle} ${copySession ? styles.snippetToggleOn : ''}`}
              onClick={() => onCopySessionChange(!copySession)}
              title={copySession ? 'Will copy the parent agent session' : 'Will start with a fresh agent session'}
            >
              <span className={styles.snippetToggleCheck}>
                {copySession ? '✓' : ''}
              </span>
              Copy agent session
            </button>
          </div>
        )}
        <div className={styles.footer}>
          {agents !== undefined && agents.length > 0 && (
            <div className={styles.agentSelect} ref={agentDropdownRef}>
              <button
                type="button"
                className={styles.agentSelectButton}
                onClick={() => setAgentDropdownOpen((v) => !v)}
                aria-label="Select coding agent"
              >
                <AgentIcon
                  agentType={agents.find((a) => a.id === activeAgentId)?.type ?? 'other'}
                  size={14}
                />
                <span className={styles.agentSelectLabel}>
                  {agents.find((a) => a.id === activeAgentId)?.name ?? 'Select agent'}
                </span>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
              {agentDropdownOpen && (
                <div className={styles.agentDropdownMenu}>
                  {agents.map((agent) => (
                    <button
                      key={agent.id}
                      type="button"
                      className={`${styles.agentDropdownItem} ${agent.id === activeAgentId ? styles.agentDropdownItemActive : ''}`}
                      onClick={() => {
                        onAgentChange?.(agent.id)
                        setAgentDropdownOpen(false)
                      }}
                    >
                      <AgentIcon agentType={agent.type} size={14} />
                      <span>{agent.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {agents !== undefined && agents.length === 0 && (
            <div className={styles.agentWarning} title="No agents configured — go to Settings">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
          )}
          <span className={styles.hint}>Enter to create</span>
          <button
            type="button"
            className={styles.createButton}
            disabled={!hasContent}
            onClick={doSubmit}
          >
            {parentId ? 'Create Subtask' : 'Create Task'}
          </button>
        </div>
      </div>
    )
  }
)
