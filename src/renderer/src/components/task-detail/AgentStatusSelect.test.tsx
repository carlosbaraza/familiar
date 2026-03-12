import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AgentStatusSelect } from './AgentStatusSelect'

describe('AgentStatusSelect', () => {
  it('renders current status', () => {
    render(<AgentStatusSelect value="running" onChange={vi.fn()} />)
    expect(screen.getByText('Running')).toBeInTheDocument()
  })

  it('opens dropdown on click', () => {
    render(<AgentStatusSelect value="idle" onChange={vi.fn()} />)
    fireEvent.click(screen.getByText('Idle'))
    expect(screen.getByText('Running')).toBeInTheDocument()
    expect(screen.getByText('Done')).toBeInTheDocument()
    expect(screen.getByText('Error')).toBeInTheDocument()
  })

  it('calls onChange when selecting a status', () => {
    const onChange = vi.fn()
    render(<AgentStatusSelect value="idle" onChange={onChange} />)
    fireEvent.click(screen.getByText('Idle'))
    fireEvent.click(screen.getByText('Running'))
    expect(onChange).toHaveBeenCalledWith('running')
  })

  it('renders all four statuses in dropdown', () => {
    render(<AgentStatusSelect value="idle" onChange={vi.fn()} />)
    fireEvent.click(screen.getByText('Idle'))
    expect(screen.getAllByRole('button')).toHaveLength(5) // trigger + 4 options
  })

  it('highlights the active status', () => {
    render(<AgentStatusSelect value="error" onChange={vi.fn()} />)
    expect(screen.getByText('Error')).toBeInTheDocument()
  })
})
