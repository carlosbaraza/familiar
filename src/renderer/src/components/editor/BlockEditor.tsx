import { useEffect, useRef, useCallback } from 'react'
import { useCreateBlockNote } from '@blocknote/react'
import { BlockNoteView } from '@blocknote/mantine'
import type { TaskPastedFile } from '@shared/types'
import { useTaskStore } from '@renderer/stores/task-store'
import { useUIStore } from '@renderer/stores/ui-store'
import { resolveThemeId, isDarkTheme } from '@renderer/lib/theme'
import { isLargePaste, createPastedFileMeta } from '@renderer/lib/paste-utils'
import '@blocknote/core/fonts/inter.css'
import '@blocknote/mantine/style.css'
import styles from './BlockEditor.module.css'

function getFirstTextNode(node: Node): Node | null {
  if (node.nodeType === Node.TEXT_NODE) return node
  for (let i = 0; i < node.childNodes.length; i++) {
    const result = getFirstTextNode(node.childNodes[i])
    if (result) return result
  }
  return null
}

interface BlockEditorProps {
  taskId: string
  initialContent?: string // markdown content
  onChange?: (markdown: string) => void
  onPastedFileAdded?: (file: TaskPastedFile) => void
}

export function BlockEditor({ taskId, initialContent, onChange, onPastedFileAdded }: BlockEditorProps): React.JSX.Element {
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const taskIdRef = useRef(taskId)
  const isLoadingContentRef = useRef(false)
  const editorWrapperRef = useRef<HTMLDivElement>(null)
  const lastSavedMarkdownRef = useRef<string | null>(null)
  const hasLoadedInitialContentRef = useRef(false)
  taskIdRef.current = taskId

  const uploadFile = useCallback(
    async (file: File): Promise<string> => {
      const timestamp = Date.now()
      const fileName = `${timestamp}-${file.name}`
      const arrayBuffer = await file.arrayBuffer()
      const savedName = await window.api.saveAttachment(taskIdRef.current, fileName, arrayBuffer)
      // Return a custom protocol URL so the editor can display the image inline
      // file:// URLs are blocked by Electron's security policy in the renderer
      // Use task-relative URL format for portability across project renames
      return `familiar-attachment://task/${taskIdRef.current}/attachments/${savedName}`
    },
    []
  )

  const editor = useCreateBlockNote(
    {
      uploadFile,
    },
    [uploadFile]
  )

  // Load initial content from markdown
  useEffect(() => {
    if (!editor || initialContent === undefined) return
    // Skip loading if content is empty — editor default state is fine
    if (initialContent === '') return

    // After the first load, skip reloads that would clobber in-flight edits.
    // Two cases:
    //   1. The new content matches what the editor itself last wrote to disk
    //      (file-watcher echo of our own save).
    //   2. A debounced save is pending — the editor has unsaved changes and the
    //      file-watcher read stale content from disk.
    if (hasLoadedInitialContentRef.current) {
      const isOwnSaveEcho = lastSavedMarkdownRef.current !== null && initialContent === lastSavedMarkdownRef.current
      const hasPendingSave = saveTimerRef.current !== null
      if (isOwnSaveEcho || hasPendingSave) {
        return
      }
    }

    let cancelled = false

    async function loadContent(): Promise<void> {
      try {
        isLoadingContentRef.current = true
        const blocks = await editor.tryParseMarkdownToBlocks(initialContent!)
        if (!cancelled && blocks.length > 0) {
          editor.replaceBlocks(editor.document, blocks)
          hasLoadedInitialContentRef.current = true
        }
      } catch (err) {
        console.error('Failed to parse markdown into blocks:', err)
      } finally {
        // Delay clearing the flag so the onChange triggered by replaceBlocks is suppressed
        setTimeout(() => {
          isLoadingContentRef.current = false
        }, 0)
      }
    }

    loadContent()
    return () => {
      cancelled = true
    }
  }, [editor, initialContent])

  const handleChange = useCallback(async () => {
    if (!editor || isLoadingContentRef.current) return

    // Clear any pending save timer
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
    }

    // Debounce: wait 1 second before saving
    saveTimerRef.current = setTimeout(async () => {
      try {
        const markdown = await editor.blocksToMarkdownLossy(editor.document)
        lastSavedMarkdownRef.current = markdown
        onChange?.(markdown)
        await window.api.writeTaskDocument(taskIdRef.current, markdown)
      } catch (err) {
        console.error('Failed to save document:', err)
      }
    }, 1000)
  }, [editor, onChange])

  // Intercept large pastes in the editor
  useEffect(() => {
    const wrapper = editorWrapperRef.current
    if (!wrapper) return

    const handlePaste = async (e: ClipboardEvent): Promise<void> => {
      const text = e.clipboardData?.getData('text/plain')
      if (!text || !isLargePaste(text)) return

      e.preventDefault()
      e.stopPropagation()

      const meta = createPastedFileMeta(text)
      try {
        await window.api.savePastedFile(taskIdRef.current, meta.filename, text)
        const task = useTaskStore.getState().getTaskById(taskIdRef.current)
        if (task) {
          const pastedFiles = [...(task.pastedFiles ?? []), meta]
          await useTaskStore.getState().updateTask({ ...task, pastedFiles })
        }
        onPastedFileAdded?.(meta)
      } catch (err) {
        console.warn('Failed to save pasted file from editor:', err)
      }
    }

    wrapper.addEventListener('paste', handlePaste, { capture: true })
    return () => wrapper.removeEventListener('paste', handlePaste, { capture: true })
  }, [onPastedFileAdded])

  // Listen for focus requests from keyboard navigation
  useEffect(() => {
    const handleFocusRequest = (e: Event): void => {
      const target = (e as CustomEvent).detail
      if (target === 'editor' && editor) {
        // Focus and move cursor to the start of the document
        editor.focus()
        const firstBlock = editor.document[0]
        if (firstBlock) {
          editor.setTextCursorPosition(firstBlock, 'start')
        }
      }
    }
    window.addEventListener('task-detail-focus', handleFocusRequest)
    return () => window.removeEventListener('task-detail-focus', handleFocusRequest)
  }, [editor])

  // Handle ArrowUp at top of editor → move focus to title
  useEffect(() => {
    const wrapper = editorWrapperRef.current
    if (!wrapper) return

    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'ArrowUp' && !e.shiftKey && !e.metaKey && !e.altKey && !e.ctrlKey) {
        // Check if cursor is at the very beginning of the editor
        const selection = window.getSelection()
        if (!selection || selection.rangeCount === 0) return

        const range = selection.getRangeAt(0)
        if (!range.collapsed) return

        // Check if we're in the first block and at offset 0
        const editorEl = wrapper.querySelector('[contenteditable]')
        if (!editorEl) return

        // Get the first text-containing block
        const firstBlock = editorEl.querySelector('[data-node-type="blockContent"]') || editorEl.firstElementChild
        if (!firstBlock) return

        // Check if the cursor is within the first block
        if (firstBlock.contains(range.startContainer)) {
          // Check if we're at the very start (offset 0 of the first text node)
          const isAtStart = range.startOffset === 0 && (
            range.startContainer === firstBlock ||
            range.startContainer === firstBlock.firstChild ||
            (range.startContainer.nodeType === Node.TEXT_NODE && range.startContainer === getFirstTextNode(firstBlock))
          )
          if (isAtStart) {
            e.preventDefault()
            window.dispatchEvent(new CustomEvent('task-detail-focus', { detail: 'title' }))
          }
        }
      }
    }

    wrapper.addEventListener('keydown', handleKeyDown)
    return () => wrapper.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
      }
    }
  }, [])

  const themeMode = useUIStore((s) => s.themeMode)
  const darkTheme = useUIStore((s) => s.darkTheme)
  const lightTheme = useUIStore((s) => s.lightTheme)
  const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  const resolvedId = resolveThemeId(themeMode, darkTheme, lightTheme, systemPrefersDark)
  const editorTheme = isDarkTheme(resolvedId) ? 'dark' : 'light'

  return (
    <div ref={editorWrapperRef} className={styles.editorWrapper} data-testid="block-editor">
      <BlockNoteView
        editor={editor}
        theme={editorTheme}
        onChange={handleChange}
      />
    </div>
  )
}
