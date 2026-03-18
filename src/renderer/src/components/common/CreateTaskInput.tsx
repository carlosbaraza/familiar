import { useState, useCallback, useRef, useEffect, useImperativeHandle, forwardRef } from 'react'
import type { Snippet, TaskPastedFile } from '@shared/types'
import { isLargePaste, createPastedFileMeta } from '@renderer/lib/paste-utils'
import styles from './CreateTaskInput.module.css'

/** A pasted image stored in temp, pending task creation */
export interface PendingImage {
  tempPath: string
  fileName: string
  mimeType: string
  dataUrl: string // for preview
}

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
    pendingImages?: PendingImage[],
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
  /** Fork badge — if set, show fork indicator */
  parentId?: string | null
  /** Placeholder text */
  placeholder?: string
  /** Persist draft to localStorage under this key */
  draftKey?: string
  /** Number of default rows */
  rows?: number
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
      placeholder = 'Task title... (Shift+Enter for notes, paste images)',
      draftKey,
      rows = 3
    },
    ref
  ) {
    const [title, setTitle] = useState(() => (draftKey ? localStorage.getItem(draftKey) ?? '' : ''))
    const [enabledSnippetIndices, setEnabledSnippetIndices] = useState<Set<number>>(
      () => new Set(allSnippets.map((_, i) => i))
    )
    const [pendingImages, setPendingImages] = useState<PendingImage[]>([])
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
        // Check for image paste first
        const items = e.clipboardData.items
        for (let i = 0; i < items.length; i++) {
          const item = items[i]
          if (item.kind === 'file' && item.type.startsWith('image/')) {
            e.preventDefault()
            const blob = item.getAsFile()
            if (!blob) continue
            const arrayBuffer = await blob.arrayBuffer()
            const mimeType = item.type
            const tempPath = await window.api.clipboardSaveImage(arrayBuffer, mimeType)
            const ext = mimeType === 'image/png' ? 'png' : mimeType === 'image/jpeg' ? 'jpg' : 'png'
            const fileName = `paste-${Date.now()}.${ext}`

            // Create data URL for preview
            const base64 = btoa(
              new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
            )
            const dataUrl = `data:${mimeType};base64,${base64}`

            setPendingImages((prev) => [...prev, { tempPath, fileName, mimeType, dataUrl }])
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
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="18" r="3" />
              <circle cx="6" cy="6" r="3" />
              <circle cx="18" cy="6" r="3" />
              <path d="M18 9v2c0 .6-.4 1-1 1H7c-.6 0-1-.4-1-1V9" />
              <path d="M12 12v3" />
            </svg>
            Subtask of {parentId}
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
        {pendingImages.length > 0 && (
          <div className={styles.pendingImages}>
            {pendingImages.map((img, i) => (
              <div key={i} className={styles.pendingImageThumb}>
                <img src={img.dataUrl} alt={img.fileName} />
                <button
                  className={styles.pendingImageRemove}
                  onClick={() => setPendingImages((prev) => prev.filter((_, idx) => idx !== i))}
                  type="button"
                  aria-label="Remove image"
                >
                  &times;
                </button>
              </div>
            ))}
          </div>
        )}
        {pendingPastedFiles.length > 0 && (
          <div className={styles.pendingPastedFiles}>
            {pendingPastedFiles.map((pf, i) => (
              <div key={pf.meta.filename} className={styles.pendingPastedCard}>
                <div className={styles.pendingPastedInfo}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                  <span className={styles.pendingPastedLabel}>{pf.meta.label}</span>
                  <span className={styles.pendingPastedMeta}>
                    {pf.meta.lineCount} lines
                  </span>
                </div>
                <button
                  className={styles.pendingImageRemove}
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
        <div className={styles.footer}>
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
