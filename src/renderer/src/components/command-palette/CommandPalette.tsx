import { useCallback, useState, useEffect, useMemo } from 'react'
import { Command } from 'cmdk'
import { useUIStore } from '../../stores/ui-store'
import { useTaskStore } from '../../stores/task-store'
import { useWorkspaceStore } from '../../stores/workspace-store'
import { useNotificationStore } from '../../stores/notification-store'
import { formatRelativeTime } from '../../lib/format-time'
import { buildSearchSnippet } from './search-snippet'
import type { Task, TaskStatus, ProjectSettings } from '@shared/types'
import type { ProjectInfo } from '../../stores/workspace-store'

type WorkspaceTask = Task & { projectPath: string }

const COLUMN_LABELS: { status: TaskStatus; label: string }[] = [
  { status: 'todo', label: 'Todo' },
  { status: 'in-progress', label: 'In Progress' },
  { status: 'in-review', label: 'In Review' },
  { status: 'done', label: 'Done' },
  { status: 'archived', label: 'Archive' }
]

// Key used for the document cache and task lookup. Task IDs are only unique
// within a single project, so we prefix with projectPath when searching across
// worktrees/projects.
function taskKey(projectPath: string, taskId: string): string {
  return `${projectPath}::${taskId}`
}

// A label shown next to a task to identify which project/worktree it belongs
// to. Worktrees are always labeled (even when only one project is open) so the
// user can tell them apart from the main workspace. Plain projects only need a
// label when multiple projects are open.
type ProjectLabel =
  | { kind: 'worktree'; text: string }
  | { kind: 'project'; text: string }
  | null

function getProjectLabel(
  projectPath: string,
  openProjects: ProjectInfo[]
): ProjectLabel {
  const project = openProjects.find((p) => p.path === projectPath)

  // Worktree entry — always label, regardless of how many projects are open.
  if (project?.isWorktree) {
    for (const p of openProjects) {
      const wt = p.worktrees?.find((w) => w.path === projectPath)
      if (wt) {
        const text = openProjects.length > 1 ? `${p.name} / ${wt.slug}` : wt.slug
        return { kind: 'worktree', text }
      }
    }
    // Fallback: we know it's a worktree but we couldn't find its parent in the
    // list. Use the basename so the user still sees *something* meaningful.
    return {
      kind: 'worktree',
      text: project.name || projectPath.split('/').pop() || projectPath
    }
  }

  // Plain project — only label when disambiguation is needed.
  if (openProjects.length <= 1) return null
  if (project) return { kind: 'project', text: project.name }
  return {
    kind: 'project',
    text: projectPath.split('/').pop() || projectPath
  }
}

// Ordering weight for the default (no-query) task list: tasks in `in-review`
// come before `in-progress`, so "finished, waiting for review" work is always
// at the top of the palette. Unknown statuses sort after both.
const DEFAULT_STATUS_ORDER: Record<string, number> = {
  'in-review': 0,
  'in-progress': 1
}

export function CommandPalette(): React.JSX.Element | null {
  const open = useUIStore((s) => s.commandPaletteOpen)
  const toggleCommandPalette = useUIStore((s) => s.toggleCommandPalette)
  const openTaskDetail = useUIStore((s) => s.openTaskDetail)
  const toggleSidebar = useUIStore((s) => s.toggleSidebar)
  const openSettings = useUIStore((s) => s.openSettings)
  const setFocusedColumn = useUIStore((s) => s.setFocusedColumn)
  const saveProjectTaskState = useUIStore((s) => s.saveProjectTaskState)

  const activeTaskId = useUIStore((s) => s.activeTaskId)

  const projectState = useTaskStore((s) => s.projectState)
  const addTask = useTaskStore((s) => s.addTask)

  const openProjects = useWorkspaceStore((s) => s.openProjects)
  const activeProjectPath = useWorkspaceStore((s) => s.activeProjectPath)

  // Workspace-wide notifications — used to highlight tasks with unread notices
  // and to sort notified tasks to the top of the default view.
  const workspaceNotifications = useNotificationStore((s) => s.workspaceNotifications)
  const localNotifications = useNotificationStore((s) => s.notifications)

  // Map from task key → the latest unread notification timestamp for that task.
  // Used both to mark tasks as notified and to sort by most recent notification.
  const unreadByTask = useMemo(() => {
    const map = new Map<string, number>()
    const add = (projectPath: string | undefined | null, taskId: string | undefined, timestamp: string | undefined): void => {
      if (!taskId) return
      const path = projectPath ?? activeProjectPath
      if (!path) return
      const key = taskKey(path, taskId)
      const ts = timestamp ? new Date(timestamp).getTime() : 0
      const existing = map.get(key) ?? 0
      if (ts > existing) map.set(key, ts)
    }
    for (const n of workspaceNotifications) {
      if (n.read) continue
      add(n.projectPath, n.taskId, n.createdAt)
    }
    for (const n of localNotifications) {
      if (n.read) continue
      add(activeProjectPath, n.taskId, n.createdAt)
    }
    return map
  }, [workspaceNotifications, localNotifications, activeProjectPath])

  const [settings, setSettings] = useState<ProjectSettings | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [documentCache, setDocumentCache] = useState<Record<string, string>>({})
  const [allTasks, setAllTasks] = useState<WorkspaceTask[]>([])

  useEffect(() => {
    if (open && window.api?.readSettings) {
      window.api.readSettings().then(setSettings).catch(() => setSettings(null))
    }
  }, [open])

  // Load tasks from ALL open projects/worktrees when the palette opens. Falls
  // back to the active project's tasks if the workspace IPC is unavailable
  // (e.g. older preload or test environments).
  useEffect(() => {
    if (!open) return
    let cancelled = false
    const listAll = window.api?.workspaceListAllTasks
    if (listAll) {
      listAll()
        .then((tasks) => {
          if (!cancelled) setAllTasks(tasks)
        })
        .catch(() => {
          if (!cancelled && projectState && activeProjectPath) {
            setAllTasks(
              projectState.tasks.map((t) => ({ ...t, projectPath: activeProjectPath }))
            )
          }
        })
    } else if (projectState && activeProjectPath) {
      setAllTasks(
        projectState.tasks.map((t) => ({ ...t, projectPath: activeProjectPath }))
      )
    }
    return () => {
      cancelled = true
    }
  }, [open, projectState, activeProjectPath])

  // Load task document content for EVERY task in the workspace when the
  // palette opens, so we can search inside docs across projects/worktrees.
  const taskIdsKey = allTasks.map((t) => taskKey(t.projectPath, t.id)).join(',')
  useEffect(() => {
    if (!open) return
    const readCross = window.api?.workspaceReadTaskDocument
    const readLocal = window.api?.readTaskDocument
    if (!readCross && !readLocal) return
    let cancelled = false
    Promise.all(
      allTasks.map(async (t) => {
        try {
          let content = ''
          if (readCross) {
            content = await readCross(t.projectPath, t.id)
          } else if (readLocal && t.projectPath === activeProjectPath) {
            // Fallback for environments without the workspace-scoped IPC.
            content = await readLocal(t.id)
          }
          return [taskKey(t.projectPath, t.id), content ?? ''] as const
        } catch {
          return [taskKey(t.projectPath, t.id), ''] as const
        }
      })
    ).then((entries) => {
      if (!cancelled) setDocumentCache(Object.fromEntries(entries))
    })
    return () => {
      cancelled = true
    }
    // taskIdsKey captures the task set; allTasks ref changes every render but ids rarely do.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, taskIdsKey, activeProjectPath])

  // Reset the query when the palette closes so the next open starts fresh.
  useEffect(() => {
    if (!open) setSearchQuery('')
  }, [open])

  const handleClose = useCallback(() => {
    if (open) toggleCommandPalette()
  }, [open, toggleCommandPalette])

  // Open a task, switching the active project first if the task lives in
  // another open worktree/project. Mirrors the AgentSwapWidget flow.
  const handleOpenTask = useCallback(
    async (task: WorkspaceTask) => {
      if (task.projectPath && task.projectPath !== activeProjectPath) {
        if (activeProjectPath) {
          saveProjectTaskState(activeProjectPath)
        }
        await useWorkspaceStore.getState().switchProject(task.projectPath)
        await useTaskStore.getState().loadProjectState()
        await useNotificationStore.getState().loadNotifications()
        await useNotificationStore.getState().loadWorkspaceNotifications()
      }
      openTaskDetail(task.id)
      handleClose()
    },
    [activeProjectPath, openTaskDetail, saveProjectTaskState, handleClose]
  )

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
  // Results include a `projectLabel` so the palette can disambiguate tasks that
  // come from different worktrees/projects open in the workspace.
  //
  // Default (no query): show tasks with unread notifications FIRST (any status),
  // followed by `in-review`, then `in-progress`. All other statuses are hidden
  // until the user searches. As soon as any query is entered, every task is
  // considered.
  //
  // Default ordering:
  //   1. Tasks with unread notifications — sorted by notification timestamp desc
  //   2. In-review tasks — sorted by updatedAt desc
  //   3. In-progress tasks — sorted by updatedAt desc
  const taskResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    const isEmptyQuery = q === ''
    type Result = {
      task: WorkspaceTask
      projectLabel: ProjectLabel
      snippet: ReturnType<typeof buildSearchSnippet> | null
      hasUnread: boolean
      unreadAt: number
    }
    const results: Result[] = []
    for (const task of allTasks) {
      const key = taskKey(task.projectPath, task.id)
      const doc = documentCache[key] ?? ''
      const projectLabel = getProjectLabel(task.projectPath, openProjects)
      const unreadAt = unreadByTask.get(key) ?? 0
      const hasUnread = unreadAt > 0
      if (isEmptyQuery) {
        const isActive = task.status === 'in-progress' || task.status === 'in-review'
        if (!hasUnread && !isActive) continue
        results.push({ task, projectLabel, snippet: null, hasUnread, unreadAt })
        continue
      }
      const titleHit = task.title.toLowerCase().includes(q) || task.id.toLowerCase().includes(q)
      const snippet = buildSearchSnippet(doc, q)
      if (!titleHit && !snippet) continue
      results.push({ task, projectLabel, snippet, hasUnread, unreadAt })
    }
    if (isEmptyQuery) {
      results.sort((a, b) => {
        // 1. Unread notifications always first
        if (a.hasUnread !== b.hasUnread) return a.hasUnread ? -1 : 1
        if (a.hasUnread && b.hasUnread) {
          // Newest notification first
          return b.unreadAt - a.unreadAt
        }
        // 2. Then group by status (in-review before in-progress)
        const weightA = DEFAULT_STATUS_ORDER[a.task.status] ?? 99
        const weightB = DEFAULT_STATUS_ORDER[b.task.status] ?? 99
        if (weightA !== weightB) return weightA - weightB
        // 3. Within the same status, most recently updated first
        return (
          new Date(b.task.updatedAt).getTime() - new Date(a.task.updatedAt).getTime()
        )
      })
    }
    return results
  }, [allTasks, documentCache, searchQuery, openProjects, unreadByTask])

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
                {taskResults.map(({ task, projectLabel, snippet, hasUnread }) => (
                  <Command.Item
                    key={`${task.projectPath}::${task.id}`}
                    value={`task-${task.projectPath}-${task.id}`}
                    onSelect={() => {
                      void handleOpenTask(task)
                    }}
                    style={hasUnread ? styles.itemTaskNotified : styles.itemTask}
                    data-has-unread={hasUnread || undefined}
                  >
                    <span style={styles.itemIcon}>
                      <StatusDot status={task.status} />
                    </span>
                    <span style={styles.taskBody}>
                      <span style={styles.taskTitleRow}>
                        <span style={styles.itemLabel}>{task.title}</span>
                        {projectLabel && (
                          <span
                            style={
                              projectLabel.kind === 'worktree'
                                ? styles.worktreeBadge
                                : styles.projectBadge
                            }
                            title={
                              projectLabel.kind === 'worktree'
                                ? `Worktree: ${projectLabel.text}`
                                : `In ${projectLabel.text}`
                            }
                            data-testid="command-palette-project-badge"
                            data-kind={projectLabel.kind}
                          >
                            {projectLabel.kind === 'worktree' && (
                              <BranchIcon />
                            )}
                            {projectLabel.text}
                          </span>
                        )}
                      </span>
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

function BranchIcon(): React.JSX.Element {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      <circle cx="4" cy="3" r="1.5" />
      <circle cx="4" cy="13" r="1.5" />
      <circle cx="12" cy="6" r="1.5" />
      <path d="M4 4.5 V 11.5" />
      <path d="M12 7.5 C 12 10.5, 10 11, 5.5 12.5" />
    </svg>
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
    alignItems: 'center',
    justifyContent: 'center',
    padding: '6vh 4vw',
    // Must be above --z-modal (400) so the palette can float on top of
    // the TaskDetail overlay when opened from inside a task view.
    zIndex: 'var(--z-command-palette)' as unknown as number,
    animation: 'cmdkFadeIn 120ms ease'
  },
  wrapper: {
    width: '70vw',
    maxWidth: 1100,
    minWidth: 480,
    height: '70vh',
    maxHeight: '85vh',
    display: 'flex',
    flexDirection: 'column',
    borderRadius: 10,
    border: '1px solid var(--border)',
    backgroundColor: 'var(--bg-surface)',
    boxShadow: '0 16px 70px rgba(0, 0, 0, 0.5)',
    overflow: 'hidden'
  },
  command: {
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
  },
  input: {
    width: '100%',
    padding: '16px 20px',
    fontSize: 16,
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    color: 'var(--text-primary)',
    backgroundColor: 'transparent',
    border: 'none',
    borderBottom: '1px solid var(--border)',
    outline: 'none',
    boxSizing: 'border-box',
    flexShrink: 0
  },
  list: {
    flex: 1,
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
  // Matches the board TaskCard `.cardNotified` look: an orange (--priority-high)
  // rounded outline that calls out tasks with unread notifications. We inset
  // the item inside the list padding (8px on each side) so the outline has
  // breathing room and doesn't touch the list edges.
  itemTaskNotified: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
    padding: '8px 14px',
    margin: '2px 8px',
    fontSize: 13,
    color: 'var(--text-primary)',
    cursor: 'pointer',
    borderRadius: 8,
    border: '1px solid var(--priority-high)',
    boxShadow: '0 0 0 1px var(--priority-high)',
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
  taskTitleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    minWidth: 0
  },
  projectBadge: {
    flexShrink: 0,
    fontSize: 10,
    padding: '1px 6px',
    borderRadius: 10,
    backgroundColor: 'var(--bg-elevated)',
    color: 'var(--text-tertiary)',
    border: '1px solid var(--border)',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: 220
  },
  worktreeBadge: {
    flexShrink: 0,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    fontSize: 10,
    padding: '1px 6px 1px 5px',
    borderRadius: 10,
    backgroundColor: 'rgba(139, 92, 246, 0.12)',
    color: 'var(--text-secondary)',
    border: '1px solid rgba(139, 92, 246, 0.35)',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: 260
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
