import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { KanbanColumn } from './KanbanColumn'
import type { Snippet } from '@shared/types'

// Mock dnd-kit
vi.mock('@dnd-kit/core', () => ({
  useDroppable: () => ({ isOver: false, setNodeRef: vi.fn() })
}))
vi.mock('@dnd-kit/sortable', () => ({
  SortableContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  verticalListSortingStrategy: {}
}))

// Mock window.api
;(window as any).api = {
  readTaskDocument: vi.fn().mockResolvedValue('')
}

const defaultProps = {
  status: 'todo' as const,
  tasks: [],
  onTaskClick: vi.fn(),
  onMultiSelect: vi.fn(),
  onCreateTask: vi.fn(),
  alwaysShowInput: true
}

const testSnippets: Snippet[] = [
  { title: 'Start', command: '/familiar', pressEnter: true },
  { title: 'Test', command: 'npm test', pressEnter: true }
]

describe('KanbanColumn — snippet toggles', () => {
  it('shows snippet toggles below create input when allSnippets provided', () => {
    render(<KanbanColumn {...defaultProps} allSnippets={testSnippets} />)

    expect(screen.getByText('Auto-run on create:')).toBeInTheDocument()
    expect(screen.getByText('Start')).toBeInTheDocument()
    expect(screen.getByText('Test')).toBeInTheDocument()
  })

  it('does not show snippet toggles when allSnippets is empty', () => {
    render(<KanbanColumn {...defaultProps} allSnippets={[]} />)

    expect(screen.queryByText('Auto-run on create:')).not.toBeInTheDocument()
  })

  it('all snippets are enabled by default', () => {
    render(<KanbanColumn {...defaultProps} allSnippets={testSnippets} />)

    const startBtn = screen.getByText('Start').closest('button')!
    const testBtn = screen.getByText('Test').closest('button')!

    // Both should have the check mark (enabled)
    expect(startBtn.textContent).toContain('✓')
    expect(testBtn.textContent).toContain('✓')
  })

  it('clicking a toggle disables the snippet', () => {
    render(<KanbanColumn {...defaultProps} allSnippets={testSnippets} />)

    const startBtn = screen.getByText('Start').closest('button')!
    fireEvent.click(startBtn)

    // After clicking, the check mark should be gone
    expect(startBtn.textContent).not.toContain('✓')
  })

  it('clicking a disabled toggle re-enables it', () => {
    render(<KanbanColumn {...defaultProps} allSnippets={testSnippets} />)

    const startBtn = screen.getByText('Start').closest('button')!
    fireEvent.click(startBtn) // disable
    fireEvent.click(startBtn) // re-enable

    expect(startBtn.textContent).toContain('✓')
  })

  it('passes enabled snippets when creating a task', () => {
    const onCreateTask = vi.fn()
    render(
      <KanbanColumn
        {...defaultProps}
        onCreateTask={onCreateTask}
        allSnippets={testSnippets}
      />
    )

    // Disable the second snippet
    const testBtn = screen.getByText('Test').closest('button')!
    fireEvent.click(testBtn)

    // Type a task title and press Enter
    const textarea = screen.getByPlaceholderText(/Task title/i)
    fireEvent.change(textarea, { target: { value: 'New task' } })
    fireEvent.keyDown(textarea, { key: 'Enter' })

    expect(onCreateTask).toHaveBeenCalledWith(
      'New task',
      undefined,
      [testSnippets[0]] // Only the first snippet (Start) should be enabled
    )
  })

  it('passes undefined enabledSnippets when all are disabled', () => {
    const onCreateTask = vi.fn()
    render(
      <KanbanColumn
        {...defaultProps}
        onCreateTask={onCreateTask}
        allSnippets={testSnippets}
      />
    )

    // Disable both snippets
    const startBtn = screen.getByText('Start').closest('button')!
    const testBtn = screen.getByText('Test').closest('button')!
    fireEvent.click(startBtn)
    fireEvent.click(testBtn)

    const textarea = screen.getByPlaceholderText(/Task title/i)
    fireEvent.change(textarea, { target: { value: 'New task' } })
    fireEvent.keyDown(textarea, { key: 'Enter' })

    expect(onCreateTask).toHaveBeenCalledWith('New task', undefined, undefined)
  })
})
