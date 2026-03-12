import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PrioritySelect } from './PrioritySelect'

// Mock PriorityIcon since it's a presentational SVG component
vi.mock('@renderer/components/common', () => ({
  PriorityIcon: ({ priority }: { priority: string }) => (
    <span data-testid={`priority-icon-${priority}`} />
  )
}))

describe('PrioritySelect', () => {
  const onChange = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the current priority label', () => {
    render(<PrioritySelect value="high" onChange={onChange} />)
    expect(screen.getByText('High')).toBeInTheDocument()
  })

  it('renders priority icon for the current value', () => {
    render(<PrioritySelect value="urgent" onChange={onChange} />)
    expect(screen.getByTestId('priority-icon-urgent')).toBeInTheDocument()
  })

  it('does not show dropdown initially', () => {
    render(<PrioritySelect value="medium" onChange={onChange} />)
    expect(screen.getAllByText('Medium')).toHaveLength(1)
  })

  it('opens dropdown on click', () => {
    render(<PrioritySelect value="none" onChange={onChange} />)
    fireEvent.click(screen.getByText('None'))

    expect(screen.getByText('Urgent')).toBeInTheDocument()
    expect(screen.getByText('High')).toBeInTheDocument()
    expect(screen.getByText('Medium')).toBeInTheDocument()
    expect(screen.getByText('Low')).toBeInTheDocument()
  })

  it('calls onChange when selecting a priority', () => {
    render(<PrioritySelect value="none" onChange={onChange} />)
    fireEvent.click(screen.getByText('None'))
    fireEvent.click(screen.getByText('High'))

    expect(onChange).toHaveBeenCalledWith('high')
  })

  it('closes dropdown after selecting a priority', () => {
    render(<PrioritySelect value="none" onChange={onChange} />)
    fireEvent.click(screen.getByText('None'))
    fireEvent.click(screen.getByText('Urgent'))

    expect(screen.queryByText('High')).not.toBeInTheDocument()
  })

  it('closes dropdown on outside click', () => {
    render(<PrioritySelect value="none" onChange={onChange} />)
    fireEvent.click(screen.getByText('None'))

    expect(screen.getByText('Urgent')).toBeInTheDocument()

    fireEvent.mouseDown(document.body)

    expect(screen.queryByText('Urgent')).not.toBeInTheDocument()
  })

  it('toggles dropdown on repeated clicks', () => {
    render(<PrioritySelect value="low" onChange={onChange} />)

    // Open - click the trigger button
    const trigger = screen.getByText('Low')
    fireEvent.click(trigger)
    expect(screen.getByText('Urgent')).toBeInTheDocument()

    // Close - click the trigger again (use getAllByText since 'Low' appears in trigger + dropdown)
    fireEvent.click(screen.getAllByText('Low')[0])
    expect(screen.queryByText('Urgent')).not.toBeInTheDocument()
  })

  it('renders all five priority options in dropdown', () => {
    render(<PrioritySelect value="medium" onChange={onChange} />)
    fireEvent.click(screen.getByText('Medium'))

    expect(screen.getByText('Urgent')).toBeInTheDocument()
    expect(screen.getByText('High')).toBeInTheDocument()
    expect(screen.getAllByText('Medium').length).toBeGreaterThanOrEqual(2)
    expect(screen.getByText('Low')).toBeInTheDocument()
    expect(screen.getByText('None')).toBeInTheDocument()
  })

  it('renders priority icons for all options in dropdown', () => {
    render(<PrioritySelect value="none" onChange={onChange} />)
    fireEvent.click(screen.getByText('None'))

    expect(screen.getByTestId('priority-icon-urgent')).toBeInTheDocument()
    expect(screen.getByTestId('priority-icon-high')).toBeInTheDocument()
    expect(screen.getByTestId('priority-icon-medium')).toBeInTheDocument()
    expect(screen.getByTestId('priority-icon-low')).toBeInTheDocument()
    // Two 'none' icons: trigger + dropdown option
    expect(screen.getAllByTestId('priority-icon-none').length).toBeGreaterThanOrEqual(2)
  })
})
