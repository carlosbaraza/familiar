import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { StatusSelect } from './StatusSelect'

describe('StatusSelect', () => {
  const onChange = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the current status label', () => {
    render(<StatusSelect value="todo" onChange={onChange} />)
    expect(screen.getByText('Todo')).toBeInTheDocument()
  })

  it('renders In Progress label for in-progress status', () => {
    render(<StatusSelect value="in-progress" onChange={onChange} />)
    expect(screen.getByText('In Progress')).toBeInTheDocument()
  })

  it('does not show dropdown initially', () => {
    render(<StatusSelect value="todo" onChange={onChange} />)
    // Only one "Todo" (the trigger), not a dropdown list
    expect(screen.getAllByText('Todo')).toHaveLength(1)
  })

  it('opens dropdown on click', () => {
    render(<StatusSelect value="todo" onChange={onChange} />)
    fireEvent.click(screen.getByText('Todo'))

    // All statuses should be visible
    expect(screen.getByText('In Progress')).toBeInTheDocument()
    expect(screen.getByText('In Review')).toBeInTheDocument()
    expect(screen.getByText('Done')).toBeInTheDocument()
    expect(screen.getByText('Archive')).toBeInTheDocument()
  })

  it('calls onChange when selecting a status', () => {
    render(<StatusSelect value="todo" onChange={onChange} />)
    fireEvent.click(screen.getByText('Todo'))
    fireEvent.click(screen.getByText('In Progress'))

    expect(onChange).toHaveBeenCalledWith('in-progress')
  })

  it('closes dropdown after selecting a status', () => {
    render(<StatusSelect value="todo" onChange={onChange} />)
    fireEvent.click(screen.getByText('Todo'))
    fireEvent.click(screen.getByText('Done'))

    // Dropdown should be closed, only trigger visible
    expect(screen.queryByText('In Progress')).not.toBeInTheDocument()
  })

  it('closes dropdown on outside click', () => {
    render(<StatusSelect value="todo" onChange={onChange} />)
    fireEvent.click(screen.getByText('Todo'))

    // Verify dropdown is open
    expect(screen.getByText('In Progress')).toBeInTheDocument()

    // Click outside
    fireEvent.mouseDown(document.body)

    expect(screen.queryByText('In Progress')).not.toBeInTheDocument()
  })

  it('toggles dropdown on repeated clicks', () => {
    render(<StatusSelect value="todo" onChange={onChange} />)

    // Open
    fireEvent.click(screen.getByText('Todo'))
    expect(screen.getByText('In Progress')).toBeInTheDocument()

    // Close - use getAllByText since 'Todo' appears in both trigger and dropdown
    fireEvent.click(screen.getAllByText('Todo')[0])
    expect(screen.queryByText('In Progress')).not.toBeInTheDocument()
  })

  it('renders all five status options in dropdown', () => {
    render(<StatusSelect value="todo" onChange={onChange} />)
    fireEvent.click(screen.getByText('Todo'))

    // The trigger + dropdown option for 'Todo'
    expect(screen.getAllByText('Todo').length).toBeGreaterThanOrEqual(2)
    expect(screen.getByText('In Progress')).toBeInTheDocument()
    expect(screen.getByText('In Review')).toBeInTheDocument()
    expect(screen.getByText('Done')).toBeInTheDocument()
    expect(screen.getByText('Archive')).toBeInTheDocument()
  })
})
