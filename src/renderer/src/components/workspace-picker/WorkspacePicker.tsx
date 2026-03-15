import { useState, useCallback, useEffect, useRef, type MouseEvent } from 'react'
import type { Workspace } from '@shared/types'
import { useWorkspaceStore } from '@renderer/stores/workspace-store'
import { useTaskStore } from '@renderer/stores/task-store'
import { formatRelativeTime } from '@renderer/lib/format-time'
import styles from './WorkspacePicker.module.css'

/** Deterministic avatar colors derived from workspace name */
const AVATAR_COLORS = [
  '#5e6ad2', // accent purple
  '#e89b3e', // amber
  '#27ae60', // green
  '#e74c3c', // red
  '#3498db', // blue
  '#9b59b6', // violet
  '#1abc9c', // teal
  '#f39c12'  // orange
]

function avatarColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

export function WorkspacePicker(): React.JSX.Element {
  const workspaces = useWorkspaceStore((s) => s.workspaces)
  const loadWorkspaces = useWorkspaceStore((s) => s.loadWorkspaces)
  const openWorkspace = useWorkspaceStore((s) => s.openWorkspace)
  const openSingleProject = useWorkspaceStore((s) => s.openSingleProject)
  const createWorkspace = useWorkspaceStore((s) => s.createWorkspace)
  const deleteWorkspace = useWorkspaceStore((s) => s.deleteWorkspace)
  const loadProjectState = useTaskStore((s) => s.loadProjectState)

  const [selectedIndex, setSelectedIndex] = useState(0)
  const [showNewForm, setShowNewForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newPaths, setNewPaths] = useState<string[]>([])
  const nameInputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Sort workspaces by lastOpenedAt descending
  const sorted = [...workspaces].sort(
    (a, b) => new Date(b.lastOpenedAt).getTime() - new Date(a.lastOpenedAt).getTime()
  )

  // Load workspaces on mount
  useEffect(() => {
    loadWorkspaces()
  }, [loadWorkspaces])

  // Clamp selected index when list changes
  useEffect(() => {
    if (selectedIndex >= sorted.length) {
      setSelectedIndex(Math.max(0, sorted.length - 1))
    }
  }, [sorted.length, selectedIndex])

  // Focus name input when form opens
  useEffect(() => {
    if (showNewForm) {
      setTimeout(() => nameInputRef.current?.focus(), 0)
    }
  }, [showNewForm])

  const handleOpenWorkspace = useCallback(
    async (ws: Workspace) => {
      await openWorkspace(ws.id)
      await loadProjectState()
    },
    [openWorkspace, loadProjectState]
  )

  const handleOpenSingleProject = useCallback(async () => {
    const selectedPath = await window.api.openDirectory()
    if (!selectedPath) return
    await openSingleProject(selectedPath)
    await loadProjectState()
  }, [openSingleProject, loadProjectState])

  const handleAddFolder = useCallback(async () => {
    const selectedPath = await window.api.openDirectory()
    if (selectedPath) {
      setNewPaths((prev) => (prev.includes(selectedPath) ? prev : [...prev, selectedPath]))
    }
  }, [])

  const handleRemoveFolder = useCallback((path: string) => {
    setNewPaths((prev) => prev.filter((p) => p !== path))
  }, [])

  const handleCreate = useCallback(async () => {
    if (!newName.trim() || newPaths.length === 0) return
    const ws = await createWorkspace(newName.trim(), newPaths)
    await openWorkspace(ws.id)
    await loadProjectState()
  }, [newName, newPaths, createWorkspace, openWorkspace, loadProjectState])

  const handleDeleteWorkspace = useCallback(
    async (e: MouseEvent, ws: Workspace) => {
      e.stopPropagation()
      const confirmed = window.confirm(
        `Delete workspace "${ws.name || 'Unnamed'}"?\nThis will not delete any project files.`
      )
      if (confirmed) {
        await deleteWorkspace(ws.id)
      }
    },
    [deleteWorkspace]
  )

  const handleCancelNew = useCallback(() => {
    setShowNewForm(false)
    setNewName('')
    setNewPaths([])
  }, [])

  // Keyboard navigation
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent): void {
      // Meta+N for new workspace
      if (e.metaKey && e.key === 'n') {
        e.preventDefault()
        setShowNewForm(true)
        return
      }

      if (showNewForm) return // Don't handle arrows when form is open

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((prev) => Math.min(prev + 1, sorted.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((prev) => Math.max(prev - 1, 0))
      } else if (e.key === 'Enter' && sorted.length > 0) {
        e.preventDefault()
        handleOpenWorkspace(sorted[selectedIndex])
      } else if ((e.key === 'Backspace' || e.key === 'Delete') && sorted.length > 0) {
        e.preventDefault()
        const ws = sorted[selectedIndex]
        const confirmed = window.confirm(
          `Delete workspace "${ws.name || 'Unnamed'}"?\nThis will not delete any project files.`
        )
        if (confirmed) {
          deleteWorkspace(ws.id)
        }
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [sorted, selectedIndex, showNewForm, handleOpenWorkspace])

  return (
    <div className={styles.overlay} ref={containerRef} data-testid="workspace-picker">
      <div className={styles.container}>
        <h1 className={styles.title}>Open a Workspace</h1>

        {sorted.length > 0 && (
          <p className={styles.subtitle}>Select a recent workspace or start fresh</p>
        )}

        {/* Workspace list */}
        {sorted.length > 0 ? (
          <div className={styles.list} role="listbox" aria-label="Workspaces">
            {sorted.map((ws, i) => {
              const folderNames = ws.projectPaths.map((p) => p.split('/').pop() || p)
              const isSelected = i === selectedIndex
              const isMostRecent = i === 0

              return (
                <div
                  key={ws.id}
                  role="option"
                  aria-selected={isSelected}
                  className={[
                    styles.item,
                    isSelected ? styles.itemSelected : '',
                    isMostRecent ? styles.itemMostRecent : ''
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => handleOpenWorkspace(ws)}
                  onMouseEnter={() => setSelectedIndex(i)}
                >
                  <div
                    className={styles.avatar}
                    style={{ backgroundColor: avatarColor(ws.name || 'W') }}
                  >
                    {(ws.name || 'W')[0].toUpperCase()}
                  </div>
                  <div className={styles.itemInfo}>
                    <div className={styles.itemName}>{ws.name || 'Unnamed Workspace'}</div>
                    <div className={styles.itemMeta}>
                      <span className={styles.itemFolders}>{folderNames.join(', ')}</span>
                      <span className={styles.itemDot}>&middot;</span>
                      <span>
                        {ws.projectPaths.length} project{ws.projectPaths.length !== 1 ? 's' : ''}
                      </span>
                      <span className={styles.itemDot}>&middot;</span>
                      <span className={styles.itemTime}>
                        {formatRelativeTime(ws.lastOpenedAt)}
                      </span>
                    </div>
                  </div>
                  <button
                    className={styles.deleteBtn}
                    onClick={(e) => handleDeleteWorkspace(e, ws)}
                    aria-label={`Delete workspace ${ws.name || 'Unnamed'}`}
                    title="Delete workspace"
                  >
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z" />
                      <path fillRule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z" />
                    </svg>
                  </button>
                </div>
              )
            })}
          </div>
        ) : (
          !showNewForm && (
            <div className={styles.empty}>No workspaces yet. Create one to get started.</div>
          )
        )}

        {/* New workspace form */}
        {showNewForm && (
          <div className={styles.form} data-testid="new-workspace-form">
            <div className={styles.formTitle}>New Workspace</div>
            <input
              ref={nameInputRef}
              className={styles.formInput}
              type="text"
              placeholder="Workspace name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.preventDefault()
                  handleCancelNew()
                }
                if (e.key === 'Enter' && newName.trim() && newPaths.length > 0) {
                  e.preventDefault()
                  handleCreate()
                }
              }}
            />
            {newPaths.length > 0 && (
              <div className={styles.formFolders}>
                {newPaths.map((p) => (
                  <div key={p} className={styles.formFolderItem}>
                    <span>{p.split('/').pop() || p}</span>
                    <button
                      className={styles.formFolderRemove}
                      onClick={() => handleRemoveFolder(p)}
                      aria-label={`Remove ${p}`}
                    >
                      x
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className={styles.formActions}>
              <button className={styles.btnSmallSecondary} onClick={handleAddFolder}>
                Add folders
              </button>
              {newPaths.length > 0 && (
                <button
                  className={styles.btnSmallPrimary}
                  onClick={handleCreate}
                  disabled={!newName.trim()}
                >
                  Create
                </button>
              )}
              <button className={styles.btnCancel} onClick={handleCancelNew}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className={styles.actions}>
          <button className={styles.btnPrimary} onClick={() => setShowNewForm(true)}>
            New Workspace
          </button>
          <button className={styles.btnSecondary} onClick={handleOpenSingleProject}>
            Open Single Project
          </button>
        </div>

        {/* Keyboard hints */}
        {sorted.length > 0 && !showNewForm && (
          <div className={styles.hint}>
            <kbd className={styles.hintKbd}>&uarr;</kbd>
            <kbd className={styles.hintKbd}>&darr;</kbd> navigate{' '}
            <kbd className={styles.hintKbd}>Enter</kbd> open{' '}
            <kbd className={styles.hintKbd}>&#9003;</kbd> delete{' '}
            <kbd className={styles.hintKbd}>&#8984;N</kbd> new workspace
          </div>
        )}
      </div>
    </div>
  )
}
