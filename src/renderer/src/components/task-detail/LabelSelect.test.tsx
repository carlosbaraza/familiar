import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useTaskStore } from '@renderer/stores/task-store'
import { LabelSelect } from './LabelSelect'

describe('LabelSelect', () => {
  const onToggle = vi.fn()
  const mockUpdateProjectLabels = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    useTaskStore.setState({
      projectState: {
        version: 1,
        projectName: 'test',
        tasks: [],
        columnOrder: ['todo', 'in-progress', 'in-review', 'done', 'archived'],
        labels: [
          { name: 'bug', color: '#ef4444' },
          { name: 'feature', color: '#3b82f6' },
          { name: 'chore', color: '#6b7280' }
        ]
      },
      updateProjectLabels: mockUpdateProjectLabels
    })
  })

  it('renders trigger button with + text', () => {
    render(<LabelSelect taskLabels={[]} onToggle={onToggle} />)
    expect(screen.getByTitle('Add label')).toBeInTheDocument()
    expect(screen.getByText('+')).toBeInTheDocument()
  })

  it('does not show dropdown initially', () => {
    render(<LabelSelect taskLabels={[]} onToggle={onToggle} />)
    expect(screen.queryByPlaceholderText('Search or create label...')).not.toBeInTheDocument()
  })

  it('opens dropdown on click', () => {
    render(<LabelSelect taskLabels={[]} onToggle={onToggle} />)
    fireEvent.click(screen.getByTitle('Add label'))

    expect(screen.getByPlaceholderText('Search or create label...')).toBeInTheDocument()
  })

  it('shows all project labels in dropdown', () => {
    render(<LabelSelect taskLabels={[]} onToggle={onToggle} />)
    fireEvent.click(screen.getByTitle('Add label'))

    expect(screen.getByText('bug')).toBeInTheDocument()
    expect(screen.getByText('feature')).toBeInTheDocument()
    expect(screen.getByText('chore')).toBeInTheDocument()
  })

  it('shows checkmark for active labels', () => {
    render(<LabelSelect taskLabels={['bug']} onToggle={onToggle} />)
    fireEvent.click(screen.getByTitle('Add label'))

    expect(screen.getByText('\u2713')).toBeInTheDocument()
  })

  it('calls onToggle when clicking a label', () => {
    render(<LabelSelect taskLabels={[]} onToggle={onToggle} />)
    fireEvent.click(screen.getByTitle('Add label'))
    fireEvent.click(screen.getByText('bug'))

    expect(onToggle).toHaveBeenCalledWith('bug')
  })

  it('filters labels based on search input', () => {
    render(<LabelSelect taskLabels={[]} onToggle={onToggle} />)
    fireEvent.click(screen.getByTitle('Add label'))

    const input = screen.getByPlaceholderText('Search or create label...')
    fireEvent.change(input, { target: { value: 'feat' } })

    expect(screen.getByText('feature')).toBeInTheDocument()
    expect(screen.queryByText('bug')).not.toBeInTheDocument()
    expect(screen.queryByText('chore')).not.toBeInTheDocument()
  })

  it('shows create option for new label', () => {
    render(<LabelSelect taskLabels={[]} onToggle={onToggle} />)
    fireEvent.click(screen.getByTitle('Add label'))

    const input = screen.getByPlaceholderText('Search or create label...')
    fireEvent.change(input, { target: { value: 'newlabel' } })

    expect(screen.getByText(/Create/)).toBeInTheDocument()
    expect(screen.getByText(/newlabel/)).toBeInTheDocument()
  })

  it('does not show create option if label already exists', () => {
    render(<LabelSelect taskLabels={[]} onToggle={onToggle} />)
    fireEvent.click(screen.getByTitle('Add label'))

    const input = screen.getByPlaceholderText('Search or create label...')
    fireEvent.change(input, { target: { value: 'bug' } })

    expect(screen.queryByText(/Create/)).not.toBeInTheDocument()
  })

  it('creates and toggles new label on Enter', () => {
    render(<LabelSelect taskLabels={[]} onToggle={onToggle} />)
    fireEvent.click(screen.getByTitle('Add label'))

    const input = screen.getByPlaceholderText('Search or create label...')
    fireEvent.change(input, { target: { value: 'newlabel' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(mockUpdateProjectLabels).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ name: 'newlabel' })])
    )
    expect(onToggle).toHaveBeenCalledWith('newlabel')
  })

  it('closes dropdown on Escape', () => {
    render(<LabelSelect taskLabels={[]} onToggle={onToggle} />)
    fireEvent.click(screen.getByTitle('Add label'))

    expect(screen.getByPlaceholderText('Search or create label...')).toBeInTheDocument()

    const input = screen.getByPlaceholderText('Search or create label...')
    fireEvent.keyDown(input, { key: 'Escape' })

    expect(screen.queryByPlaceholderText('Search or create label...')).not.toBeInTheDocument()
  })

  it('closes dropdown on outside click', () => {
    render(<LabelSelect taskLabels={[]} onToggle={onToggle} />)
    fireEvent.click(screen.getByTitle('Add label'))

    expect(screen.getByPlaceholderText('Search or create label...')).toBeInTheDocument()

    fireEvent.mouseDown(document.body)

    expect(screen.queryByPlaceholderText('Search or create label...')).not.toBeInTheDocument()
  })

  it('shows "No labels" when no project labels exist and no search', () => {
    useTaskStore.setState({
      projectState: {
        version: 1,
        projectName: 'test',
        tasks: [],
        columnOrder: ['todo', 'in-progress', 'in-review', 'done', 'archived'],
        labels: []
      }
    })

    render(<LabelSelect taskLabels={[]} onToggle={onToggle} />)
    fireEvent.click(screen.getByTitle('Add label'))

    expect(screen.getByText('No labels')).toBeInTheDocument()
  })

  it('does not add empty label name', () => {
    render(<LabelSelect taskLabels={[]} onToggle={onToggle} />)
    fireEvent.click(screen.getByTitle('Add label'))

    const input = screen.getByPlaceholderText('Search or create label...')
    fireEvent.change(input, { target: { value: '   ' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(mockUpdateProjectLabels).not.toHaveBeenCalled()
    expect(onToggle).not.toHaveBeenCalled()
  })

  it('opens color picker when clicking color button', () => {
    render(<LabelSelect taskLabels={[]} onToggle={onToggle} />)
    fireEvent.click(screen.getByTitle('Add label'))

    const colorBtns = screen.getAllByTitle('Change color')
    fireEvent.click(colorBtns[0])

    // 9 preset color swatches should appear
    const container = document.querySelector('[class*="colorPicker"]')
    expect(container).toBeTruthy()
  })
})
