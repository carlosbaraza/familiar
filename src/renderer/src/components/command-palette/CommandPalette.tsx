import { useCallback, useState, useEffect, useMemo } from 'react'
import { Command } from 'cmdk'
import { useUIStore } from '../../stores/ui-store'
import { useTaskStore } from '../../stores/task-store'
import { formatRelativeTime } from '../../lib/format-time'
import { buildSearchSnippet } from './search-snippet'
import type { TaskStatus, ProjectSettings } from '@shared/types'

const COLUMN_LABELS: { status: TaskStatus; label: string }[] = [
  { status: 'todo', label: 'Todo' },
  { status: 'in-progress', label: 'In Progress' },
  { status: 'in-review', label: 'In Review' },
  { status: 'done', label: 'Done' },
  { status: 'archived', label: 'Archive' }
]

export function CommandPalette(): React.JSX.Element | null {
  const open = useUIStore((s) => s.commandPaletteOpen)
  const toggleCommandPalette = useUIStore((s) => s.toggleCommandPalette)
  const openTaskDetail = useUIStore((s) => s.openTaskDetail)
  const toggleSidebar = useUIStore((s) => s.toggleSidebar)
  const openSettings = useUIStore((s) => s.openSettings)
  const setFocusedColumn = useUIStore((s) => s.setFocusedColumn)

  const activeTaskId = useUIStore((s) => s.activeTaskId)

  const projectState = useTaskStore((s) => s.projectState)
  const addTask = useTaskStore((s) => s.addTask)
  const tasks = projectState?.tasks ?? []

  const [settings, setSettings] = useState<ProjectSettings | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [documentCache, setDocumentCache] = useState<Record<string, string>>({})

  useEffect(() => {
    if (open && window.api?.readSettings) {
      window.api.readSettings().then(setSettings).catch(() => setSettings(null))
    }
  }, [open])

  // Load task document content when palette opens so we can search inside docs.
  const taskIdsKey = tasks.map((t) => t.id).join(',')
  useEffect(() => {
    if (!open) return
    const readDoc = window.api?.readTaskDocument
    if (!readDoc) return
    let cancelled = false
    Promise.all(
      tasks.map(async (t) => {
        try {
          const content = await readDoc(t.id)
          return [t.id, content ?? ''] as const
        } catch {
          return [t.id, ''] as const
        }
      })
    ).then((entries) => {
      if (!cancelled) setDocumentCache(Object.fromEntries(entries))
    })
    return () => {
      cancelled = true
    }
    // taskIdsKey captures the task set; tasks ref changes every render but ids rarely do.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, taskIdsKey])

  // Reset the query when the palette closes so the next open starts fresh.
  useEffect(() => {
    if (!open) setSearchQuery('')
  }, [open])

  const handleClose = useCallback(() => {
    if (open) toggleCommandPalette()
  }, [open, toggleCommandPalette])

  const handleRunDoctor = useCallback((autoFix: boolean) => {
    if (!activeTaskId) return
    const isClaudeCode = settings?.codingAgent === 'claude-code'
    let command: string
    if (isClaudeCode) {
      const flags = autoFix ? ' --allow-dangerously-skip-permissions --permission-mode bypassPermissions' : ''
      const doctorFlags = autoFix ? ' --auto-fix' : ''
      command = `familiar doctor${doctorFlags} | claude${flags}`
    } else {
      command = 'familiar doctor'
    }
    window.dispatchEvent(new CustomEvent('run-doctor', { detail: { taskId: activeTaskId, command } }))
    handleClose()
  }, [activeTaskId, settings, handleClose])

  // Compute task results, filtering by title/id/document content and attaching snippets.
  const taskResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return tasks
      .map((task) => {
        const doc = documentCache[task.id] ?? ''
        if (q === '') {
          return { task, snippet: null as ReturnType<typeof buildSearchSnippet> | null }
        }
        const titleHit = task.title.toLowerCase().includes(q) || task.id.toLowerCase().includes(q)
        const snippet = buildSearchSnippet(doc, q)
        if (!titleHit && !snippet) return null
        return { task, snippet }
      })
      .filter((r): r is { task: typeof tasks[number]; snippet: ReturnType<typeof buildSearchSnippet> | null } => r !== null)
  }, [tasks, documentCache, searchQuery])

  // Simple substring filter for static items (actions, navigation).
  const matchesQuery = useCallback(
    (...haystacks: string[]) => {
      const q = searchQuery.trim().toLowerCase()
      if (q === '') return true
      return haystacks.some((h) => h.toLowerCase().includes(q))
    },
    [searchQuery]
  )

  if (!open) return null

  const showActions = {
    create: matchesQuery('Create Task', 'create new task'),
    toggleSidebar: matchesQuery('Toggle Sidebar'),
    openSettings: matchesQuery('Open Settings', 'preferences'),
    runDoctor: matchesQuery('Run Doctor', 'environment check diagnostic'),
    runDoctorAutoFix: matchesQuery('Run Doctor Auto-fix', 'environment check diagnostic')
  }
  const navResults = COLUMN_LABELS.filter((col) => matchesQuery(`Go to ${col.label}`, col.label))

  const hasAnyAction =
    showActions.create ||
    showActions.toggleSidebar ||
    showActions.openSettings ||
    (activeTaskId && (showActions.runDoctor || showActions.runDoctorAutoFix))

  return (
    <div style={styles.overlay} onClick={handleClose}>
      <div style={styles.wrapper} onClick={(e) => e.stopPropagation()}>
        <Command style={styles.command} label="Command palette" shouldFilter={false}>
          <Command.Input
            style={styles.input}
            placeholder="Search tasks, documents, commands..."
            autoFocus
            value={searchQuery}
            onValueChange={setSearchQuery}
          />
          <Command.List style={styles.list}>
            <Command.Empty style={styles.empty}>No results found.</Command.Empty>

            {/* Tasks section */}
            {taskResults.length > 0 && (
              <Command.Group heading="Tasks" style={styles.group}>
                {taskResults.map(({ task, snippet }) => (
                  <Command.Item
                    key={task.id}
                    value={`task-${task.id}`}
                    onSelect={() => {
                      openTaskDetail(task.id)
                      handleClose()
                    }}
                    style={styles.itemTask}
                  >
                    <span style={styles.itemIcon}>
                      <StatusDot status={task.status} />
                    </span>
                    <span style={styles.taskBody}>
                      <span style={styles.itemLabel}>{task.title}</span>
                      {snippet && (
                        <span style={styles.snippet} title="Match in task document">
                          <span>{snippet.before}</span>
                          <mark style={styles.snippetMark}>{snippet.match}</mark>
                          <span>{snippet.after}</span>
                        </span>
                      )}
                    </span>
                    <span
                      style={styles.itemMeta}
                      title={`Created ${new Date(task.createdAt).toLocaleString()}\nUpdated ${new Date(task.updatedAt).toLocaleString()}`}
                    >
                      <span style={styles.itemMetaLine}>
                        Updated {formatRelativeTime(task.updatedAt)}
                      </span>
                      <span style={styles.itemMetaLineDim}>
                        Created {formatRelativeTime(task.createdAt)}
                      </span>
                    </span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {/* Actions section */}
            {hasAnyAction && (
              <Command.Group heading="Actions" style={styles.group}>
                {showActions.create && (
                  <Command.Item
                    value="action-create-task"
                    onSelect={async () => {
                      await addTask('New task')
                      handleClose()
                    }}
                    style={styles.item}
                  >
                    <span style={styles.itemIcon}>+</span>
                    <span style={styles.itemLabel}>Create Task</span>
                    <span style={styles.shortcut}>
                      <kbd style={styles.kbd}>C</kbd>
                    </span>
                  </Command.Item>
                )}
                {showActions.toggleSidebar && (
                  <Command.Item
                    value="action-toggle-sidebar"
                    onSelect={() => {
                      toggleSidebar()
                      handleClose()
                    }}
                    style={styles.item}
                  >
                    <span style={styles.itemIcon}>&laquo;</span>
                    <span style={styles.itemLabel}>Toggle Sidebar</span>
                    <span style={styles.shortcut}>
                      <kbd style={styles.kbd}>&#8984;</kbd>
                      <kbd style={styles.kbd}>B</kbd>
                    </span>
                  </Command.Item>
                )}
                {showActions.openSettings && (
                  <Command.Item
                    value="action-open-settings"
                    onSelect={() => {
                      openSettings()
                      handleClose()
                    }}
                    style={styles.item}
                  >
                    <span style={styles.itemIcon}>&#9881;</span>
                    <span style={styles.itemLabel}>Open Settings</span>
                    <span style={styles.shortcut}>
                      <kbd style={styles.kbd}>&#8984;</kbd>
                      <kbd style={styles.kbd}>,</kbd>
                    </span>
                  </Command.Item>
                )}
                {activeTaskId && showActions.runDoctor && (
                  <Command.Item
                    value="action-run-doctor"
                    onSelect={() => handleRunDoctor(false)}
                    style={styles.item}
                  >
                    <span style={styles.itemIcon}>&#9829;</span>
                    <span style={styles.itemLabel}>Run Doctor</span>
                  </Command.Item>
                )}
                {activeTaskId && showActions.runDoctorAutoFix && (
                  <Command.Item
                    value="action-run-doctor-auto-fix"
                    onSelect={() => handleRunDoctor(true)}
                    style={styles.item}
                  >
                    <span style={styles.itemIcon}>&#9889;</span>
                    <span style={styles.itemLabel}>Run Doctor (Auto-fix)</span>
                  </Command.Item>
                )}
              </Command.Group>
            )}

            {/* Navigation section */}
            {navResults.length > 0 && (
              <Command.Group heading="Navigation" style={styles.group}>
                {navResults.map((col) => {
                  const idx = COLUMN_LABELS.findIndex((c) => c.status === col.status)
                  return (
                    <Command.Item
                      key={col.status}
                      value={`nav-${col.status}`}
                      onSelect={() => {
                        setFocusedColumn(idx)
                        handleClose()
                      }}
                      style={styles.item}
                    >
                      <span style={styles.itemIcon}>
                        <StatusDot status={col.status} />
                      </span>
                      <span style={styles.itemLabel}>Go to {col.label}</span>
                    </Command.Item>
                  )
                })}
              </Command.Group>
            )}
          </Command.List>
        </Command>
      </div>
    </div>
  )
}

function StatusDot({ status }: { status: TaskStatus }): React.JSX.Element {
  const colorMap: Record<TaskStatus, string> = {
    todo: 'var(--status-todo)',
    'in-progress': 'var(--status-in-progress)',
    'in-review': 'var(--status-in-review)',
    done: 'var(--status-done)',
    archived: 'var(--status-archived)'
  }
  return (
    <span
      style={{
        display: 'inline-block',
        width: 8,
        height: 8,
        borderRadius: '50%',
        backgroundColor: colorMap[status] ?? 'var(--agent-idle)'
      }}
    />
  )
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingTop: '20vh',
    zIndex: 400,
    animation: 'cmdkFadeIn 120ms ease'
  },
  wrapper: {
    width: '100%',
    maxWidth: 560,
    borderRadius: 8,
    border: '1px solid var(--border)',
    backgroundColor: 'var(--bg-surface)',
    boxShadow: '0 16px 70px rgba(0, 0, 0, 0.5)',
    overflow: 'hidden'
  },
  command: {
    width: '100%',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
  },
  input: {
    width: '100%',
    padding: '14px 18px',
    fontSize: 15,
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    color: 'var(--text-primary)',
    backgroundColor: 'transparent',
    border: 'none',
    borderBottom: '1px solid var(--border)',
    outline: 'none',
    boxSizing: 'border-box'
  },
  list: {
    maxHeight: 420,
    overflowY: 'auto',
    padding: '8px 0'
  },
  empty: {
    padding: '24px 18px',
    color: 'var(--text-tertiary)',
    fontSize: 13,
    textAlign: 'center'
  },
  group: {
    padding: '4px 0'
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '8px 18px',
    fontSize: 13,
    color: 'var(--text-primary)',
    cursor: 'pointer',
    borderRadius: 0,
    transition: 'background-color 100ms ease'
  },
  itemTask: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
    padding: '8px 18px',
    fontSize: 13,
    color: 'var(--text-primary)',
    cursor: 'pointer',
    borderRadius: 0,
    transition: 'background-color 100ms ease'
  },
  itemIcon: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 20,
    color: 'var(--text-secondary)',
    fontSize: 14,
    flexShrink: 0,
    marginTop: 2
  },
  itemLabel: {
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  taskBody: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    flex: 1,
    minWidth: 0
  },
  snippet: {
    fontSize: 11,
    color: 'var(--text-tertiary)',
    lineHeight: 1.4,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    whiteSpace: 'normal',
    wordBreak: 'break-word'
  },
  snippetMark: {
    backgroundColor: 'rgba(250, 204, 21, 0.28)',
    color: 'var(--text-primary)',
    padding: '0 2px',
    borderRadius: 2
  },
  itemMeta: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 2,
    color: 'var(--text-tertiary)',
    fontSize: 11,
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    flexShrink: 0,
    lineHeight: 1.2,
    marginLeft: 8
  },
  itemMetaLine: {
    color: 'var(--text-secondary)'
  },
  itemMetaLineDim: {
    color: 'var(--text-tertiary)',
    fontSize: 10
  },
  shortcut: {
    display: 'flex',
    gap: 4,
    flexShrink: 0
  },
  kbd: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 20,
    height: 20,
    padding: '0 5px',
    fontSize: 11,
    fontFamily: "'SF Mono', 'Fira Code', monospace",
    color: 'var(--text-secondary)',
    backgroundColor: 'var(--bg-elevated)',
    borderRadius: 4,
    border: '1px solid var(--border)'
  }
}
