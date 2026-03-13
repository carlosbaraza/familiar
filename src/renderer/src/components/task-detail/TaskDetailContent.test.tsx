import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { useUIStore } from '@renderer/stores/ui-store'
import { TaskDetailContent } from './TaskDetailContent'
import type { Task } from '@shared/types'

// Mock heavy child components
vi.mock('@renderer/components/editor', () => ({
  BlockEditor: ({ taskId, initialContent }: any) => (
    <div data-testid="block-editor">
      Editor for {taskId}: {initialContent}
    </div>
  )
}))

vi.mock('@renderer/components/terminal/TerminalPanel', () => ({
  TerminalPanel: ({ taskId }: any) => (
    <div data-testid="terminal-panel">Terminal for {taskId}</div>
  )
}))

vi.mock('./ActivityTimeline', () => ({
  ActivityTimeline: ({ taskId }: any) => (
    <div data-testid="activity-timeline">Activity for {taskId}</div>
  )
}))

vi.mock('./TaskFiles', () => ({
  TaskFiles: ({ taskId }: any) => (
    <div data-testid="task-files">Files for {taskId}</div>
  )
}))

vi.mock('./TaskDetailHeader', () => ({
  TaskDetailHeader: ({ task }: any) => (
    <div data-testid="task-detail-header">{task.title}</div>
  )
}))

vi.mock('./SplitPanel', () => ({
  SplitPanel: ({ left, right }: any) => (
    <div data-testid="split-panel">
      <div data-testid="split-left">{left}</div>
      <div data-testid="split-right">{right}</div>
    </div>
  )
}))

const mockWatchUnsub = vi.fn()
const mockApi = {
  readTaskDocument: vi.fn(),
  watchProjectDir: vi.fn().mockReturnValue(mockWatchUnsub)
}

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'tsk_abc',
    title: 'Test task',
    status: 'todo',
    priority: 'none',
    labels: [],
    agentStatus: 'idle',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    sortOrder: 0,
    ...overrides
  }
}

const defaultProps = {
  task: makeTask(),
  onUpdate: vi.fn(),
  onClose: vi.fn()
}

beforeEach(() => {
  vi.clearAllMocks()
  mockWatchUnsub.mockClear()
  mockApi.watchProjectDir.mockReturnValue(mockWatchUnsub)
  ;(window as any).api = { ...((window as any).api ?? {}), ...mockApi }
  mockApi.readTaskDocument.mockResolvedValue('# Hello')
  useUIStore.setState({
    editorPanelWidth: 400,
    setEditorPanelWidth: vi.fn()
  })
})

describe('TaskDetailContent', () => {
  it('shows loading state before document loads', () => {
    // Make readTaskDocument hang
    mockApi.readTaskDocument.mockReturnValue(new Promise(() => {}))
    render(<TaskDetailContent taskId="tsk_abc" {...defaultProps} />)

    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('renders BlockEditor after document loads', async () => {
    mockApi.readTaskDocument.mockResolvedValue('# Hello')
    render(<TaskDetailContent taskId="tsk_abc" {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByTestId('block-editor')).toBeInTheDocument()
    })
    expect(screen.getByText(/Editor for tsk_abc/)).toBeInTheDocument()
  })

  it('renders TaskDetailHeader in the sidebar', async () => {
    render(<TaskDetailContent taskId="tsk_abc" {...defaultProps} />)

    expect(screen.getByTestId('task-detail-header')).toBeInTheDocument()
    expect(screen.getByText('Test task')).toBeInTheDocument()
  })

  it('renders TerminalPanel', async () => {
    render(<TaskDetailContent taskId="tsk_abc" {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByTestId('terminal-panel')).toBeInTheDocument()
    })
    expect(screen.getByText('Terminal for tsk_abc')).toBeInTheDocument()
  })

  it('renders ActivityTimeline', async () => {
    render(<TaskDetailContent taskId="tsk_abc" {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByTestId('activity-timeline')).toBeInTheDocument()
    })
    expect(screen.getByText('Activity for tsk_abc')).toBeInTheDocument()
  })

  it('handles document load failure gracefully', async () => {
    mockApi.readTaskDocument.mockRejectedValue(new Error('Not found'))
    render(<TaskDetailContent taskId="tsk_abc" {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByTestId('block-editor')).toBeInTheDocument()
    })
  })

  it('loads document for the given taskId', async () => {
    render(<TaskDetailContent taskId="tsk_xyz" {...defaultProps} />)

    await waitFor(() => {
      expect(mockApi.readTaskDocument).toHaveBeenCalledWith('tsk_xyz')
    })
  })

  it('renders inside a SplitPanel', () => {
    render(<TaskDetailContent taskId="tsk_abc" {...defaultProps} />)
    expect(screen.getByTestId('split-panel')).toBeInTheDocument()
  })

  it('subscribes to file watcher for external document changes', async () => {
    render(<TaskDetailContent taskId="tsk_abc" {...defaultProps} />)

    await waitFor(() => {
      expect(mockApi.watchProjectDir).toHaveBeenCalled()
    })
  })

  it('re-reads document when file watcher fires', async () => {
    render(<TaskDetailContent taskId="tsk_abc" {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByTestId('block-editor')).toBeInTheDocument()
    })

    // Simulate external change
    mockApi.readTaskDocument.mockResolvedValue('# Updated externally')
    const watchCallback = mockApi.watchProjectDir.mock.calls[0][0]
    await watchCallback()

    await waitFor(() => {
      expect(screen.getByText(/Updated externally/)).toBeInTheDocument()
    })
  })

  it('unsubscribes from file watcher on unmount', async () => {
    const { unmount } = render(<TaskDetailContent taskId="tsk_abc" {...defaultProps} />)

    await waitFor(() => {
      expect(mockApi.watchProjectDir).toHaveBeenCalled()
    })

    unmount()
    expect(mockWatchUnsub).toHaveBeenCalled()
  })

  it('re-loads document when taskId changes', async () => {
    const { rerender } = render(<TaskDetailContent taskId="tsk_first" {...defaultProps} />)

    await waitFor(() => {
      expect(mockApi.readTaskDocument).toHaveBeenCalledWith('tsk_first')
    })

    rerender(<TaskDetailContent taskId="tsk_second" {...defaultProps} />)

    await waitFor(() => {
      expect(mockApi.readTaskDocument).toHaveBeenCalledWith('tsk_second')
    })
  })
})
