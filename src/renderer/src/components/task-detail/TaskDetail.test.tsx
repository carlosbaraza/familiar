import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useTaskStore } from '@renderer/stores/task-store'
import { useUIStore } from '@renderer/stores/ui-store'
import { useNotificationStore } from '@renderer/stores/notification-store'
import { TaskDetail } from './TaskDetail'
import type { Task } from '@shared/types'

// Mock child component to isolate TaskDetail logic
vi.mock('./TaskDetailContent', () => ({
  TaskDetailContent: ({ taskId, task, onClose }: any) => (
    <div data-testid="task-detail-content">
      <span>{task.title}</span>
      <span>{taskId}</span>
      <button onClick={onClose}>Close</button>
    </div>
  )
}))

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'tsk_test01',
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

describe('TaskDetail', () => {
  const onClose = vi.fn()
  const task = makeTask()

  beforeEach(() => {
    vi.clearAllMocks()
    useTaskStore.setState({
      projectState: {
        version: 1,
        projectName: 'test',
        tasks: [task],
        columnOrder: ['todo', 'in-progress', 'in-review', 'done', 'archived'],
        labels: []
      }
    })
    useNotificationStore.setState({
      notifications: [],
      loading: false
    })
  })

  it('renders task detail content when task exists', () => {
    render(<TaskDetail taskId="tsk_test01" visible={true} onClose={onClose} />)

    expect(screen.getByTestId('task-detail-content')).toBeInTheDocument()
    expect(screen.getByText('Test task')).toBeInTheDocument()
  })

  it('shows "Task not found" when task does not exist', () => {
    render(<TaskDetail taskId="tsk_nonexistent" visible={true} onClose={onClose} />)

    expect(screen.getByText('Task not found')).toBeInTheDocument()
  })

  it('renders close button in not-found state', () => {
    render(<TaskDetail taskId="tsk_nonexistent" visible={true} onClose={onClose} />)

    const closeBtn = screen.getByText('Close')
    fireEvent.click(closeBtn)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose on Escape key when visible', () => {
    render(<TaskDetail taskId="tsk_test01" visible={true} onClose={onClose} />)

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('does not call onClose on Escape key when not visible', () => {
    render(<TaskDetail taskId="tsk_test01" visible={false} onClose={onClose} />)

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).not.toHaveBeenCalled()
  })

  it('does not call onClose on Escape when command palette is open on top', () => {
    useUIStore.setState({ commandPaletteOpen: true })
    render(<TaskDetail taskId="tsk_test01" visible={true} onClose={onClose} />)

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).not.toHaveBeenCalled()

    // Clean up so subsequent tests see a closed palette
    useUIStore.setState({ commandPaletteOpen: false })
  })

  it('does not call onClose on Escape when settings is open on top', () => {
    useUIStore.setState({ settingsOpen: true })
    render(<TaskDetail taskId="tsk_test01" visible={true} onClose={onClose} />)

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).not.toHaveBeenCalled()

    useUIStore.setState({ settingsOpen: false })
  })

  it('has hidden visibility when not visible', () => {
    const { container } = render(
      <TaskDetail taskId="tsk_test01" visible={false} onClose={onClose} />
    )

    const overlay = container.firstChild as HTMLElement
    expect(overlay.style.visibility).toBe('hidden')
    expect(overlay.style.pointerEvents).toBe('none')
  })

  it('has visible visibility when visible', () => {
    const { container } = render(
      <TaskDetail taskId="tsk_test01" visible={true} onClose={onClose} />
    )

    const overlay = container.firstChild as HTMLElement
    expect(overlay.style.visibility).toBe('visible')
    expect(overlay.style.pointerEvents).toBe('auto')
  })

  it('marks notifications as read when visible and has unread notifications', () => {
    const markReadByTaskId = vi.fn()
    useNotificationStore.setState({
      notifications: [
        { id: 'n1', taskId: 'tsk_test01', title: 'Test', body: '', read: false, timestamp: '' }
      ],
      markReadByTaskId
    })

    render(<TaskDetail taskId="tsk_test01" visible={true} onClose={onClose} />)

    expect(markReadByTaskId).toHaveBeenCalledWith('tsk_test01')
  })

  it('does not mark notifications as read when not visible', () => {
    const markReadByTaskId = vi.fn()
    useNotificationStore.setState({
      notifications: [
        { id: 'n1', taskId: 'tsk_test01', title: 'Test', body: '', read: false, timestamp: '' }
      ],
      markReadByTaskId
    })

    render(<TaskDetail taskId="tsk_test01" visible={false} onClose={onClose} />)

    expect(markReadByTaskId).not.toHaveBeenCalled()
  })

  it('passes taskId to TaskDetailContent', () => {
    render(<TaskDetail taskId="tsk_test01" visible={true} onClose={onClose} />)

    expect(screen.getByText('tsk_test01')).toBeInTheDocument()
  })
})
