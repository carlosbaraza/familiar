import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useTaskStore } from '@renderer/stores/task-store'
import { TaskDetailHeader } from './TaskDetailHeader'
import type { Task } from '@shared/types'

// Mock child components
vi.mock('./StatusSelect', () => ({
  StatusSelect: ({ value, onChange }: any) => (
    <button data-testid="status-select" onClick={() => onChange('in-progress')}>
      Status: {value}
    </button>
  )
}))

vi.mock('./PrioritySelect', () => ({
  PrioritySelect: ({ value, onChange }: any) => (
    <button data-testid="priority-select" onClick={() => onChange('high')}>
      Priority: {value}
    </button>
  )
}))

vi.mock('./LabelSelect', () => ({
  LabelSelect: ({ taskLabels, onToggle }: any) => (
    <button data-testid="label-select" onClick={() => onToggle('bug')}>
      Labels: {taskLabels.join(', ')}
    </button>
  )
}))

vi.mock('@renderer/components/common', () => ({
  Tooltip: ({ children }: any) => <>{children}</>
}))

const mockApi = {
  getProjectRoot: vi.fn().mockResolvedValue('/tmp/project'),
  openPath: vi.fn().mockResolvedValue(undefined)
}

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'tsk_test01',
    title: 'Test task title',
    status: 'todo',
    priority: 'none',
    labels: [],
    agentStatus: 'idle',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    sortOrder: 0,
    ...overrides
  }
}

describe('TaskDetailHeader', () => {
  const onUpdate = vi.fn()
  const onClose = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    ;(window as any).api = { ...((window as any).api ?? {}), ...mockApi }
    useTaskStore.setState({
      projectState: {
        version: 1,
        projectName: 'test',
        tasks: [],
        columnOrder: ['todo', 'in-progress', 'in-review', 'done', 'archived'],
        labels: [
          { name: 'bug', color: '#ef4444' },
          { name: 'feature', color: '#3b82f6' }
        ]
      }
    })
  })

  it('renders the task title in a textarea', () => {
    render(<TaskDetailHeader task={makeTask()} onUpdate={onUpdate} onClose={onClose} />)
    const textarea = screen.getByDisplayValue('Test task title')
    expect(textarea).toBeInTheDocument()
    expect(textarea.tagName).toBe('TEXTAREA')
  })

  it('renders timestamps', () => {
    render(<TaskDetailHeader task={makeTask()} onUpdate={onUpdate} onClose={onClose} />)
    expect(screen.getByText(/Created/)).toBeInTheDocument()
    expect(screen.getByText(/Updated/)).toBeInTheDocument()
  })

  it('renders Status, Priority, and Labels sections', () => {
    render(<TaskDetailHeader task={makeTask()} onUpdate={onUpdate} onClose={onClose} />)

    expect(screen.getByText('Status')).toBeInTheDocument()
    expect(screen.getByText('Priority')).toBeInTheDocument()
    expect(screen.getByText('Labels')).toBeInTheDocument()
  })

  it('renders StatusSelect with correct value', () => {
    render(
      <TaskDetailHeader
        task={makeTask({ status: 'in-progress' })}
        onUpdate={onUpdate}
        onClose={onClose}
      />
    )
    expect(screen.getByText('Status: in-progress')).toBeInTheDocument()
  })

  it('renders PrioritySelect with correct value', () => {
    render(
      <TaskDetailHeader
        task={makeTask({ priority: 'high' })}
        onUpdate={onUpdate}
        onClose={onClose}
      />
    )
    expect(screen.getByText('Priority: high')).toBeInTheDocument()
  })

  it('calls onUpdate with new status when StatusSelect changes', () => {
    render(<TaskDetailHeader task={makeTask()} onUpdate={onUpdate} onClose={onClose} />)
    fireEvent.click(screen.getByTestId('status-select'))
    expect(onUpdate).toHaveBeenCalledWith({ status: 'in-progress' })
  })

  it('calls onUpdate with new priority when PrioritySelect changes', () => {
    render(<TaskDetailHeader task={makeTask()} onUpdate={onUpdate} onClose={onClose} />)
    fireEvent.click(screen.getByTestId('priority-select'))
    expect(onUpdate).toHaveBeenCalledWith({ priority: 'high' })
  })

  it('calls onUpdate with toggled label when LabelSelect toggles', () => {
    render(<TaskDetailHeader task={makeTask()} onUpdate={onUpdate} onClose={onClose} />)
    fireEvent.click(screen.getByTestId('label-select'))
    expect(onUpdate).toHaveBeenCalledWith({ labels: ['bug'] })
  })

  it('removes label when toggling an existing label', () => {
    render(
      <TaskDetailHeader
        task={makeTask({ labels: ['bug', 'feature'] })}
        onUpdate={onUpdate}
        onClose={onClose}
      />
    )
    fireEvent.click(screen.getByTestId('label-select'))
    // 'bug' is already in labels, so toggle removes it
    expect(onUpdate).toHaveBeenCalledWith({ labels: ['feature'] })
  })

  it('updates title on blur', () => {
    render(<TaskDetailHeader task={makeTask()} onUpdate={onUpdate} onClose={onClose} />)
    const textarea = screen.getByDisplayValue('Test task title')
    fireEvent.change(textarea, { target: { value: 'New title' } })
    fireEvent.blur(textarea)
    expect(onUpdate).toHaveBeenCalledWith({ title: 'New title' })
  })

  it('does not update title if unchanged', () => {
    render(<TaskDetailHeader task={makeTask()} onUpdate={onUpdate} onClose={onClose} />)
    const textarea = screen.getByDisplayValue('Test task title')
    fireEvent.blur(textarea)
    expect(onUpdate).not.toHaveBeenCalled()
  })

  it('updates title on Enter key', () => {
    render(<TaskDetailHeader task={makeTask()} onUpdate={onUpdate} onClose={onClose} />)
    const textarea = screen.getByDisplayValue('Test task title')
    fireEvent.change(textarea, { target: { value: 'Updated via Enter' } })
    fireEvent.keyDown(textarea, { key: 'Enter' })
    expect(onUpdate).toHaveBeenCalledWith({ title: 'Updated via Enter' })
  })

  it('reverts title on Escape key', () => {
    render(<TaskDetailHeader task={makeTask()} onUpdate={onUpdate} onClose={onClose} />)
    const textarea = screen.getByDisplayValue('Test task title')
    fireEvent.change(textarea, { target: { value: 'Changed title' } })
    fireEvent.keyDown(textarea, { key: 'Escape' })
    // The value should be reverted
    expect(textarea).toHaveValue('Test task title')
    expect(onUpdate).not.toHaveBeenCalled()
  })

  it('renders close button (x) that calls onClose', () => {
    render(<TaskDetailHeader task={makeTask()} onUpdate={onUpdate} onClose={onClose} />)

    // The close button renders the x character
    const buttons = screen.getAllByRole('button')
    const closeButton = buttons.find((b) => b.textContent?.includes('\u2715'))
    expect(closeButton).toBeTruthy()
    fireEvent.click(closeButton!)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('renders existing labels with remove buttons', () => {
    render(
      <TaskDetailHeader
        task={makeTask({ labels: ['bug', 'feature'] })}
        onUpdate={onUpdate}
        onClose={onClose}
      />
    )

    expect(screen.getByText('bug')).toBeInTheDocument()
    expect(screen.getByText('feature')).toBeInTheDocument()
  })

  it('opens task folder when folder button is clicked', () => {
    render(<TaskDetailHeader task={makeTask()} onUpdate={onUpdate} onClose={onClose} />)

    // Find the folder button (first button with svg)
    const buttons = screen.getAllByRole('button')
    // The folder button is the one before the close button (x)
    const folderBtn = buttons.find(
      (b) => b.querySelector('svg') !== null
    )
    expect(folderBtn).toBeTruthy()
    fireEvent.click(folderBtn!)

    expect(mockApi.getProjectRoot).toHaveBeenCalled()
  })

  it('trims whitespace from title before updating', () => {
    render(<TaskDetailHeader task={makeTask()} onUpdate={onUpdate} onClose={onClose} />)
    const textarea = screen.getByDisplayValue('Test task title')
    fireEvent.change(textarea, { target: { value: '  Trimmed title  ' } })
    fireEvent.blur(textarea)
    expect(onUpdate).toHaveBeenCalledWith({ title: 'Trimmed title' })
  })

  it('does not update with empty title', () => {
    render(<TaskDetailHeader task={makeTask()} onUpdate={onUpdate} onClose={onClose} />)
    const textarea = screen.getByDisplayValue('Test task title')
    fireEvent.change(textarea, { target: { value: '' } })
    fireEvent.blur(textarea)
    // Should revert to original, not call update with empty
    expect(onUpdate).not.toHaveBeenCalled()
  })
})
