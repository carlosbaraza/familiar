import { useState, useEffect, useCallback } from 'react'
import { useWorkspaceStore } from '@renderer/stores/workspace-store'
import type { Workspace } from '@shared/types'

export function WorkspacesSettings(): React.JSX.Element {
  const workspaces = useWorkspaceStore((s) => s.workspaces)
  const loadWorkspaces = useWorkspaceStore((s) => s.loadWorkspaces)
  const updateWorkspace = useWorkspaceStore((s) => s.updateWorkspace)
  const deleteWorkspace = useWorkspaceStore((s) => s.deleteWorkspace)
  const createWorkspace = useWorkspaceStore((s) => s.createWorkspace)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newPaths, setNewPaths] = useState('')

  useEffect(() => {
    loadWorkspaces()
  }, [loadWorkspaces])

  const handleEditStart = useCallback((ws: Workspace) => {
    setEditingId(ws.id)
    setEditingName(ws.name)
  }, [])

  const handleEditSave = useCallback(
    async (id: string) => {
      if (editingName.trim()) {
        await updateWorkspace(id, { name: editingName.trim() })
      }
      setEditingId(null)
      setEditingName('')
    },
    [editingName, updateWorkspace]
  )

  const handleEditCancel = useCallback(() => {
    setEditingId(null)
    setEditingName('')
  }, [])

  const handleDelete = useCallback(
    async (ws: Workspace) => {
      const confirmed = window.confirm(
        `Delete workspace "${ws.name || 'Unnamed'}"? This will not delete any project files.`
      )
      if (confirmed) {
        await deleteWorkspace(ws.id)
      }
    },
    [deleteWorkspace]
  )

  const handleCreate = useCallback(async () => {
    const name = newName.trim()
    if (!name) return
    const paths = newPaths
      .split('\n')
      .map((p) => p.trim())
      .filter(Boolean)
    await createWorkspace(name, paths)
    setNewName('')
    setNewPaths('')
    setShowCreateForm(false)
  }, [newName, newPaths, createWorkspace])

  const formatDate = (iso: string): string => {
    try {
      return new Date(iso).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })
    } catch {
      return iso
    }
  }

  return (
    <div style={styles.section}>
      <h2 style={styles.sectionTitle}>Workspaces</h2>
      <p style={styles.settingDescription}>Manage saved multi-project workspaces</p>

      {workspaces.length === 0 && !showCreateForm && (
        <p style={styles.emptyState} data-testid="workspaces-empty">
          No saved workspaces
        </p>
      )}

      {workspaces.length > 0 && (
        <div style={styles.workspaceList} data-testid="workspaces-list">
          {workspaces.map((ws) => (
            <div key={ws.id} style={styles.workspaceRow} data-testid={`workspace-row-${ws.id}`}>
              <div style={styles.workspaceInfo}>
                {editingId === ws.id ? (
                  <input
                    style={styles.inlineInput}
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleEditSave(ws.id)
                      if (e.key === 'Escape') handleEditCancel()
                    }}
                    autoFocus
                    data-testid="workspace-name-input"
                  />
                ) : (
                  <span style={styles.workspaceName}>{ws.name || 'Unnamed workspace'}</span>
                )}
                <span style={styles.workspaceMeta}>
                  {ws.projectPaths.length} project{ws.projectPaths.length !== 1 ? 's' : ''}
                  {' \u00B7 '}
                  Last opened {formatDate(ws.lastOpenedAt)}
                </span>
                {ws.projectPaths.length > 0 && (
                  <span style={styles.workspacePaths}>
                    {ws.projectPaths.join(', ')}
                  </span>
                )}
              </div>
              <div style={styles.workspaceActions}>
                {editingId === ws.id ? (
                  <>
                    <button
                      style={styles.iconButton}
                      onClick={() => handleEditSave(ws.id)}
                      title="Save"
                      data-testid="workspace-save-btn"
                    >
                      &#10003;
                    </button>
                    <button
                      style={styles.iconButton}
                      onClick={handleEditCancel}
                      title="Cancel"
                    >
                      &#10005;
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      style={styles.iconButton}
                      onClick={() => handleEditStart(ws)}
                      title="Edit name"
                      data-testid="workspace-edit-btn"
                    >
                      &#9998;
                    </button>
                    <button
                      style={styles.iconButton}
                      onClick={() => handleDelete(ws)}
                      title="Delete workspace"
                      data-testid="workspace-delete-btn"
                    >
                      &#128465;
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreateForm && (
        <div style={styles.createForm} data-testid="workspace-create-form">
          <input
            style={styles.textInput}
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Workspace name"
            data-testid="workspace-new-name"
          />
          <textarea
            style={{ ...styles.textInput, minHeight: 60, resize: 'vertical' as const }}
            value={newPaths}
            onChange={(e) => setNewPaths(e.target.value)}
            placeholder="Project paths (one per line)"
            data-testid="workspace-new-paths"
          />
          <div style={styles.createFormActions}>
            <button
              style={styles.cancelButton}
              onClick={() => {
                setShowCreateForm(false)
                setNewName('')
                setNewPaths('')
              }}
            >
              Cancel
            </button>
            <button
              style={styles.createButton}
              onClick={handleCreate}
              disabled={!newName.trim()}
              data-testid="workspace-create-submit"
            >
              Create
            </button>
          </div>
        </div>
      )}

      {!showCreateForm && (
        <button
          style={styles.addButton}
          onClick={() => setShowCreateForm(true)}
          data-testid="workspace-create-btn"
        >
          + Create Workspace
        </button>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties & Record<string, unknown>> = {
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px'
  },
  sectionTitle: {
    fontSize: '13px',
    fontWeight: 600,
    color: 'var(--text-tertiary)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    margin: 0
  },
  settingDescription: {
    fontSize: '12px',
    color: 'var(--text-tertiary)',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    margin: 0
  },
  emptyState: {
    fontSize: '13px',
    color: 'var(--text-tertiary)',
    fontStyle: 'italic',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    margin: 0
  },
  workspaceList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  workspaceRow: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    padding: '10px 12px',
    borderRadius: '6px',
    border: '1px solid var(--border)',
    backgroundColor: 'var(--bg-surface)',
    gap: '12px'
  },
  workspaceInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '3px',
    flex: 1,
    minWidth: 0
  },
  workspaceName: {
    fontSize: '13px',
    fontWeight: 500,
    color: 'var(--text-primary)',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
  },
  workspaceMeta: {
    fontSize: '11px',
    color: 'var(--text-tertiary)',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
  },
  workspacePaths: {
    fontSize: '11px',
    color: 'var(--text-tertiary)',
    fontFamily: "'SF Mono', 'Fira Code', monospace",
    opacity: 0.7,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const
  },
  workspaceActions: {
    display: 'flex',
    gap: '4px',
    flexShrink: 0
  },
  iconButton: {
    background: 'none',
    border: 'none',
    color: 'var(--text-tertiary)',
    fontSize: '14px',
    cursor: 'pointer',
    padding: '2px 6px',
    borderRadius: '4px',
    lineHeight: 1
  },
  inlineInput: {
    padding: '2px 6px',
    fontSize: '13px',
    fontWeight: 500,
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    borderRadius: '4px',
    border: '1px solid var(--border)',
    backgroundColor: 'var(--bg-primary)',
    color: 'var(--text-primary)',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box' as const
  },
  textInput: {
    padding: '8px 12px',
    fontSize: '13px',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    borderRadius: '6px',
    border: '1px solid var(--border)',
    backgroundColor: 'var(--bg-surface)',
    color: 'var(--text-primary)',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box' as const
  },
  createForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    padding: '12px',
    borderRadius: '6px',
    border: '1px solid var(--border)',
    backgroundColor: 'var(--bg-surface)'
  },
  createFormActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '8px'
  },
  cancelButton: {
    padding: '6px 14px',
    fontSize: '12px',
    fontWeight: 500,
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    borderRadius: '5px',
    border: '1px solid var(--border)',
    backgroundColor: 'var(--bg-surface)',
    color: 'var(--text-secondary)',
    cursor: 'pointer'
  },
  createButton: {
    padding: '6px 14px',
    fontSize: '12px',
    fontWeight: 500,
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    borderRadius: '5px',
    border: '1px solid rgba(99, 102, 241, 0.4)',
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    color: '#818cf8',
    cursor: 'pointer'
  },
  addButton: {
    padding: '8px 14px',
    fontSize: '12px',
    fontWeight: 500,
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    borderRadius: '5px',
    border: '1px dashed var(--border)',
    backgroundColor: 'transparent',
    color: 'var(--text-tertiary)',
    cursor: 'pointer',
    textAlign: 'left' as const
  }
}
