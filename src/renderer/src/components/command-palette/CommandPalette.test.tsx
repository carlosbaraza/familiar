import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { CommandPalette } from './CommandPalette'
import { useUIStore } from '@renderer/stores/ui-store'
import { useTaskStore } from '@renderer/stores/task-store'
import type { ProjectState } from '@shared/types'

// Default document content returned by the readTaskDocument mock.
const DEFAULT_DOCS: Record<string, string> = {
  tsk_test01: 'Original prompt: investigate the login flow and fix the authentication bug.',
  tsk_test02: 'Need to add unit tests for the billing module including snapshot coverage.'
}

function installApiMock(overrides: Partial<{ docs: Record<string, string> }> = {}): void {
  const docs = overrides.docs ?? DEFAULT_DOCS
  window.api = {
    readSettings: vi.fn().mockResolvedValue({ codingAgent: 'other' }),
    readTaskDocument: vi.fn(async (taskId: string) => docs[taskId] ?? '')
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
        status: 'todo',
        priority: 'medium',
        labels: ['testing'],
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

  it('shows task list in palette', () => {
    useUIStore.setState({ commandPaletteOpen: true })
    render(<CommandPalette />)
    expect(screen.getByText('Fix authentication bug')).toBeInTheDocument()
    expect(screen.getByText('Add unit tests')).toBeInTheDocument()
  })

  it('shows created and updated dates for each task', () => {
    useUIStore.setState({ commandPaletteOpen: true })
    render(<CommandPalette />)

    // Task 1: createdAt 3 days ago, updatedAt 2 hours ago
    expect(screen.getByText('Updated 2h ago')).toBeInTheDocument()
    expect(screen.getByText('Created 3d ago')).toBeInTheDocument()

    // Task 2: old static date — should render month/day from formatRelativeTime
    // Just make sure two "Updated" and two "Created" labels are rendered
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
      expect(window.api.readTaskDocument).toHaveBeenCalled()
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
