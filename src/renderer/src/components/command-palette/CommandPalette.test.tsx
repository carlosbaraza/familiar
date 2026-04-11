import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { CommandPalette } from './CommandPalette'
import { useUIStore } from '@renderer/stores/ui-store'
import { useTaskStore } from '@renderer/stores/task-store'
import { useWorkspaceStore } from '@renderer/stores/workspace-store'
import type { ProjectState, Task } from '@shared/types'

const PROJECT_A = '/tmp/project-a'

// Default document content returned by the readTaskDocument mock.
const DEFAULT_DOCS: Record<string, string> = {
  [`${PROJECT_A}::tsk_test01`]:
    'Original prompt: investigate the login flow and fix the authentication bug.',
  [`${PROJECT_A}::tsk_test02`]:
    'Need to add unit tests for the billing module including snapshot coverage.'
}

interface ApiMockOptions {
  docs?: Record<string, string>
  allTasks?: (Task & { projectPath: string })[]
}

function installApiMock(overrides: ApiMockOptions = {}): void {
  const docs = overrides.docs ?? DEFAULT_DOCS
  const allTasks = overrides.allTasks
  window.api = {
    readSettings: vi.fn().mockResolvedValue({ codingAgent: 'other' }),
    readTaskDocument: vi.fn(async (taskId: string) => docs[`${PROJECT_A}::${taskId}`] ?? ''),
    workspaceListAllTasks: vi.fn(async () => {
      if (allTasks) return allTasks
      const state = useTaskStore.getState().projectState
      if (!state) return []
      return state.tasks.map((t) => ({ ...t, projectPath: PROJECT_A }))
    }),
    workspaceReadTaskDocument: vi.fn(
      async (projectPath: string, taskId: string) => docs[`${projectPath}::${taskId}`] ?? ''
    ),
    workspaceSetActiveProject: vi.fn(async () => {})
  } as unknown as typeof window.api
}

// cmdk uses ResizeObserver and scrollIntoView which are not available in jsdom
beforeAll(() => {
  if (typeof globalThis.ResizeObserver === 'undefined') {
    globalThis.ResizeObserver = class ResizeObserver {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    }
  }
  if (typeof Element.prototype.scrollIntoView === 'undefined') {
    Element.prototype.scrollIntoView = function () {}
  }
})

function resetStores(): void {
  useUIStore.setState({
    commandPaletteOpen: false,
    taskDetailOpen: false,
    activeTaskId: null,
    focusedColumnIndex: 0,
    focusedTaskIndex: 0,
    sidebarOpen: true,
    editorPanelWidth: 50,
    filters: {
      search: '',
      priority: [],
      labels: [],
      agentStatus: []
    }
  })

  const now = Date.now()
  const mockState: ProjectState = {
    version: 1,
    projectName: 'Test Project',
    tasks: [
      {
        id: 'tsk_test01',
        title: 'Fix authentication bug',
        status: 'in-progress',
        priority: 'high',
        labels: ['bug'],
        agentStatus: 'running',
        createdAt: new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
        sortOrder: 0
      },
      {
        id: 'tsk_test02',
        title: 'Add unit tests',
        status: 'in-review',
        priority: 'medium',
        labels: ['testing'],
        agentStatus: 'idle',
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
        sortOrder: 0
      },
      {
        id: 'tsk_test03',
        title: 'Archived task about payments',
        status: 'archived',
        priority: 'low',
        labels: [],
        agentStatus: 'idle',
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
        sortOrder: 0
      },
      {
        id: 'tsk_test04',
        title: 'Backlog idea about payments',
        status: 'todo',
        priority: 'low',
        labels: [],
        agentStatus: 'idle',
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
        sortOrder: 0
      }
    ],
    columnOrder: ['todo', 'in-progress', 'in-review', 'done', 'archived'],
    labels: [{ name: 'bug', color: '#ef4444' }, { name: 'testing', color: '#6b7280' }]
  }

  useTaskStore.setState({
    projectState: mockState,
    isLoading: false,
    error: null
  })

  useWorkspaceStore.setState({
    openProjects: [{ path: PROJECT_A, name: 'project-a' }],
    activeProjectPath: PROJECT_A
  })
}

describe('CommandPalette', () => {
  beforeEach(() => {
    resetStores()
    installApiMock()
  })

  it('renders nothing when closed', () => {
    const { container } = render(<CommandPalette />)
    expect(container.innerHTML).toBe('')
  })

  it('renders palette when open', () => {
    useUIStore.setState({ commandPaletteOpen: true })
    render(<CommandPalette />)
    expect(screen.getByPlaceholderText('Search tasks, documents, commands...')).toBeInTheDocument()
  })

  it('shows only active (in-progress and in-review) tasks by default', async () => {
    useUIStore.setState({ commandPaletteOpen: true })
    render(<CommandPalette />)
    // In-progress task (tsk_test01) — shown
    await waitFor(() => {
      expect(screen.getByText('Fix authentication bug')).toBeInTheDocument()
    })
    // In-review task (tsk_test02) — shown
    expect(screen.getByText('Add unit tests')).toBeInTheDocument()
    // Archived and todo tasks — hidden
    expect(screen.queryByText('Archived task about payments')).not.toBeInTheDocument()
    expect(screen.queryByText('Backlog idea about payments')).not.toBeInTheDocument()
  })

  it('shows tasks from every status once the user starts searching', async () => {
    useUIStore.setState({ commandPaletteOpen: true })
    render(<CommandPalette />)
    await waitFor(() => {
      expect(screen.getByText('Fix authentication bug')).toBeInTheDocument()
    })

    const input = screen.getByPlaceholderText('Search tasks, documents, commands...')
    fireEvent.change(input, { target: { value: 'payments' } })

    // Both non-active tasks matching the query should now appear
    expect(screen.getByText('Archived task about payments')).toBeInTheDocument()
    expect(screen.getByText('Backlog idea about payments')).toBeInTheDocument()
    // The in-progress/in-review tasks should NOT match "payments"
    expect(screen.queryByText('Fix authentication bug')).not.toBeInTheDocument()
    expect(screen.queryByText('Add unit tests')).not.toBeInTheDocument()
  })

  it('shows created and updated dates for each task', async () => {
    useUIStore.setState({ commandPaletteOpen: true })
    render(<CommandPalette />)

    // Task 1: createdAt 3 days ago, updatedAt 2 hours ago
    await waitFor(() => {
      expect(screen.getByText('Updated 2h ago')).toBeInTheDocument()
    })
    expect(screen.getByText('Created 3d ago')).toBeInTheDocument()

    // Two active tasks are shown by default (in-progress + in-review)
    expect(screen.getAllByText(/^Updated /)).toHaveLength(2)
    expect(screen.getAllByText(/^Created /)).toHaveLength(2)
  })

  it('shows action items', () => {
    useUIStore.setState({ commandPaletteOpen: true })
    render(<CommandPalette />)
    expect(screen.getByText('Create Task')).toBeInTheDocument()
    expect(screen.getByText('Toggle Sidebar')).toBeInTheDocument()
  })

  it('shows navigation items for all columns', () => {
    useUIStore.setState({ commandPaletteOpen: true })
    render(<CommandPalette />)
    expect(screen.getByText('Go to Todo')).toBeInTheDocument()
    expect(screen.getByText('Go to In Progress')).toBeInTheDocument()
    expect(screen.getByText('Go to Done')).toBeInTheDocument()
  })

  it('has an input field that accepts text', () => {
    useUIStore.setState({ commandPaletteOpen: true })
    render(<CommandPalette />)
    const input = screen.getByPlaceholderText('Search tasks, documents, commands...')
    fireEvent.change(input, { target: { value: 'Fix' } })
    expect((input as HTMLInputElement).value).toBe('Fix')
  })

  it('filters tasks by title', async () => {
    useUIStore.setState({ commandPaletteOpen: true })
    render(<CommandPalette />)
    // Wait for the async tasks load first, otherwise the filter runs against
    // an empty task list.
    await waitFor(() => {
      expect(screen.getByText('Fix authentication bug')).toBeInTheDocument()
    })
    const input = screen.getByPlaceholderText('Search tasks, documents, commands...')
    fireEvent.change(input, { target: { value: 'authentication' } })
    expect(screen.getByText('Fix authentication bug')).toBeInTheDocument()
    expect(screen.queryByText('Add unit tests')).not.toBeInTheDocument()
  })

  it('searches inside task documents and shows a highlighted snippet', async () => {
    useUIStore.setState({ commandPaletteOpen: true })
    render(<CommandPalette />)
    // Wait for documents to load
    await waitFor(() => {
      expect(window.api.workspaceReadTaskDocument).toHaveBeenCalled()
    })

    const input = screen.getByPlaceholderText('Search tasks, documents, commands...')
    // "billing" appears only inside task 2's document.md, not in either title
    fireEvent.change(input, { target: { value: 'billing' } })

    await waitFor(() => {
      expect(screen.getByText('Add unit tests')).toBeInTheDocument()
    })
    expect(screen.queryByText('Fix authentication bug')).not.toBeInTheDocument()

    // The highlighted match should be rendered as a <mark>
    const marks = document.querySelectorAll('mark')
    const hasBillingMark = Array.from(marks).some((m) => m.textContent === 'billing')
    expect(hasBillingMark).toBe(true)
  })

  it('filters actions by query', () => {
    useUIStore.setState({ commandPaletteOpen: true })
    render(<CommandPalette />)
    const input = screen.getByPlaceholderText('Search tasks, documents, commands...')
    fireEvent.change(input, { target: { value: 'sidebar' } })
    expect(screen.getByText('Toggle Sidebar')).toBeInTheDocument()
    expect(screen.queryByText('Create Task')).not.toBeInTheDocument()
  })

  it('does not show Run Doctor when no active task', () => {
    useUIStore.setState({ commandPaletteOpen: true, activeTaskId: null })
    render(<CommandPalette />)
    expect(screen.queryByText('Run Doctor')).not.toBeInTheDocument()
    expect(screen.queryByText('Run Doctor (Auto-fix)')).not.toBeInTheDocument()
  })

  it('shows Run Doctor commands when a task is active', () => {
    // Mock window.api.readSettings
    window.api = {
      readSettings: vi.fn().mockResolvedValue({ codingAgent: 'claude-code' })
    } as unknown as typeof window.api

    useUIStore.setState({ commandPaletteOpen: true, activeTaskId: 'tsk_test01' })
    render(<CommandPalette />)
    expect(screen.getByText('Run Doctor')).toBeInTheDocument()
    expect(screen.getByText('Run Doctor (Auto-fix)')).toBeInTheDocument()
  })

  it('dispatches run-doctor event on Run Doctor select', () => {
    window.api = {
      readSettings: vi.fn().mockResolvedValue({ codingAgent: 'other' })
    } as unknown as typeof window.api

    useUIStore.setState({ commandPaletteOpen: true, activeTaskId: 'tsk_test01' })
    render(<CommandPalette />)

    const listener = vi.fn()
    window.addEventListener('run-doctor', listener)

    const item = screen.getByText('Run Doctor')
    fireEvent.click(item)

    expect(listener).toHaveBeenCalledTimes(1)
    const detail = (listener.mock.calls[0][0] as CustomEvent).detail
    expect(detail.taskId).toBe('tsk_test01')
    expect(detail.command).toBe('familiar doctor')

    window.removeEventListener('run-doctor', listener)
  })

  describe('multi-project search', () => {
    const PROJECT_B = '/tmp/project-b'

    const makeCrossProjectTasks = (): (Task & { projectPath: string })[] => [
      {
        id: 'tsk_test01',
        title: 'Fix authentication bug',
        status: 'in-progress',
        priority: 'high',
        labels: ['bug'],
        agentStatus: 'running',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        sortOrder: 0,
        projectPath: PROJECT_A
      },
      {
        id: 'tsk_otherp1',
        title: 'Refactor billing webhook',
        // Active status so the task appears in the default (no-query) view.
        status: 'in-review',
        priority: 'medium',
        labels: [],
        agentStatus: 'idle',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        sortOrder: 0,
        projectPath: PROJECT_B
      }
    ]

    beforeEach(() => {
      useWorkspaceStore.setState({
        openProjects: [
          { path: PROJECT_A, name: 'project-a' },
          { path: PROJECT_B, name: 'project-b' }
        ],
        activeProjectPath: PROJECT_A
      })
    })

    it('shows tasks from every open project/worktree', async () => {
      installApiMock({
        allTasks: makeCrossProjectTasks(),
        docs: {
          [`${PROJECT_A}::tsk_test01`]: 'authentication bug notes',
          [`${PROJECT_B}::tsk_otherp1`]: 'billing webhook refactor plan'
        }
      })
      useUIStore.setState({ commandPaletteOpen: true })
      render(<CommandPalette />)

      await waitFor(() => {
        expect(screen.getByText('Refactor billing webhook')).toBeInTheDocument()
      })
      expect(screen.getByText('Fix authentication bug')).toBeInTheDocument()
    })

    it('renders a project badge next to each task when multiple projects are open', async () => {
      installApiMock({ allTasks: makeCrossProjectTasks() })
      useUIStore.setState({ commandPaletteOpen: true })
      render(<CommandPalette />)

      await waitFor(() => {
        expect(screen.getByText('Refactor billing webhook')).toBeInTheDocument()
      })
      const badges = screen.getAllByTestId('command-palette-project-badge')
      const labels = badges.map((el) => el.textContent)
      expect(labels).toContain('project-a')
      expect(labels).toContain('project-b')
    })

    it('matches document content inside a task from another project', async () => {
      installApiMock({
        allTasks: makeCrossProjectTasks(),
        docs: {
          [`${PROJECT_A}::tsk_test01`]: 'unrelated notes',
          [`${PROJECT_B}::tsk_otherp1`]: 'search hit: polymorphic payload'
        }
      })
      useUIStore.setState({ commandPaletteOpen: true })
      render(<CommandPalette />)

      await waitFor(() => {
        expect(window.api.workspaceReadTaskDocument).toHaveBeenCalledWith(
          PROJECT_B,
          'tsk_otherp1'
        )
      })

      const input = screen.getByPlaceholderText('Search tasks, documents, commands...')
      fireEvent.change(input, { target: { value: 'polymorphic' } })

      await waitFor(() => {
        expect(screen.getByText('Refactor billing webhook')).toBeInTheDocument()
      })
      expect(screen.queryByText('Fix authentication bug')).not.toBeInTheDocument()
      const marks = document.querySelectorAll('mark')
      expect(
        Array.from(marks).some((m) => m.textContent === 'polymorphic')
      ).toBe(true)
    })

    it('switches active project when selecting a task from another project', async () => {
      const switchProject = vi.fn(async () => {})
      const loadProjectState = vi.fn(async () => {})
      const saveProjectTaskState = vi.fn()
      const loadNotifications = vi.fn(async () => {})
      const loadWorkspaceNotifications = vi.fn(async () => {})

      useWorkspaceStore.setState({
        openProjects: [
          { path: PROJECT_A, name: 'project-a' },
          { path: PROJECT_B, name: 'project-b' }
        ],
        activeProjectPath: PROJECT_A,
        switchProject
      })
      useTaskStore.setState({ loadProjectState } as unknown as Partial<
        ReturnType<typeof useTaskStore.getState>
      > as never)

      // Inject notification-store stubs via dynamic import to avoid tight coupling.
      const { useNotificationStore } = await import('@renderer/stores/notification-store')
      useNotificationStore.setState({
        loadNotifications,
        loadWorkspaceNotifications
      } as unknown as Partial<ReturnType<typeof useNotificationStore.getState>> as never)

      useUIStore.setState({
        commandPaletteOpen: true,
        saveProjectTaskState
      } as unknown as Partial<ReturnType<typeof useUIStore.getState>> as never)

      installApiMock({ allTasks: makeCrossProjectTasks() })
      render(<CommandPalette />)

      await waitFor(() => {
        expect(screen.getByText('Refactor billing webhook')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Refactor billing webhook'))

      await waitFor(() => {
        expect(switchProject).toHaveBeenCalledWith(PROJECT_B)
      })
      expect(loadProjectState).toHaveBeenCalled()
      expect(saveProjectTaskState).toHaveBeenCalledWith(PROJECT_A)
    })

    it('does not switch project when selecting a task in the active project', async () => {
      const switchProject = vi.fn(async () => {})
      useWorkspaceStore.setState({
        openProjects: [
          { path: PROJECT_A, name: 'project-a' },
          { path: PROJECT_B, name: 'project-b' }
        ],
        activeProjectPath: PROJECT_A,
        switchProject
      })

      installApiMock({ allTasks: makeCrossProjectTasks() })
      useUIStore.setState({ commandPaletteOpen: true })
      render(<CommandPalette />)

      await waitFor(() => {
        expect(screen.getByText('Fix authentication bug')).toBeInTheDocument()
      })
      fireEvent.click(screen.getByText('Fix authentication bug'))

      // Give pending microtasks a chance to fire.
      await new Promise((r) => setTimeout(r, 0))
      expect(switchProject).not.toHaveBeenCalled()
    })
  })

  it('does not render project badges when only one project is open', async () => {
    useUIStore.setState({ commandPaletteOpen: true })
    render(<CommandPalette />)
    await waitFor(() => {
      expect(screen.getByText('Fix authentication bug')).toBeInTheDocument()
    })
    expect(screen.queryAllByTestId('command-palette-project-badge')).toHaveLength(0)
  })

  it('dispatches run-doctor event with claude flags for claude-code agent', async () => {
    let resolveSettings: (value: unknown) => void
    const settingsPromise = new Promise((resolve) => { resolveSettings = resolve })
    window.api = {
      readSettings: vi.fn().mockReturnValue(settingsPromise)
    } as unknown as typeof window.api

    useUIStore.setState({ commandPaletteOpen: true, activeTaskId: 'tsk_test01' })
    const { unmount } = render(<CommandPalette />)

    // Resolve settings and wait for state update
    resolveSettings!({ codingAgent: 'claude-code' })
    await vi.waitFor(() => {
      // Settings promise resolved, state should be updated after re-render
    })
    // Allow React to process the state update
    await new Promise((r) => setTimeout(r, 0))

    const listener = vi.fn()
    window.addEventListener('run-doctor', listener)

    const item = screen.getByText('Run Doctor (Auto-fix)')
    fireEvent.click(item)

    expect(listener).toHaveBeenCalledTimes(1)
    const detail = (listener.mock.calls[0][0] as CustomEvent).detail
    expect(detail.taskId).toBe('tsk_test01')
    expect(detail.command).toContain('familiar doctor --auto-fix')
    expect(detail.command).toContain('claude')

    window.removeEventListener('run-doctor', listener)
    unmount()
  })
})
