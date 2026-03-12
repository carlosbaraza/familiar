import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TerminalTabs } from './TerminalTabs'
import type { TerminalPane } from '@shared/types/terminal'

function makePane(overrides: Partial<TerminalPane> = {}): TerminalPane {
  return {
    id: 'pane-1',
    sessionName: 'familiar-tsk_test-0',
    title: 'Terminal 1',
    ...overrides
  }
}

describe('TerminalTabs', () => {
  const defaultProps = {
    taskId: 'tsk_test01',
    panes: [makePane()],
    activePane: 'pane-1',
    onSelectPane: vi.fn(),
    onAddPane: vi.fn(),
    onClosePane: vi.fn()
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders a tab for each pane', () => {
    const panes = [
      makePane({ id: 'pane-1', title: 'Terminal 1' }),
      makePane({ id: 'pane-2', title: 'Terminal 2' })
    ]
    render(<TerminalTabs {...defaultProps} panes={panes} />)

    expect(screen.getByText('Terminal 1')).toBeInTheDocument()
    expect(screen.getByText('Terminal 2')).toBeInTheDocument()
  })

  it('calls onSelectPane when a tab is clicked', () => {
    render(<TerminalTabs {...defaultProps} />)

    fireEvent.click(screen.getByText('Terminal 1'))
    expect(defaultProps.onSelectPane).toHaveBeenCalledWith('pane-1')
  })

  it('does not show close button when there is only one pane', () => {
    render(<TerminalTabs {...defaultProps} />)

    // The close button renders as "\u00d7" text
    expect(screen.queryByText('\u00d7')).not.toBeInTheDocument()
  })

  it('shows close button when there are multiple panes', () => {
    const panes = [
      makePane({ id: 'pane-1', title: 'Terminal 1' }),
      makePane({ id: 'pane-2', title: 'Terminal 2' })
    ]
    render(<TerminalTabs {...defaultProps} panes={panes} />)

    // Should have two close buttons (one per tab)
    const closeButtons = screen.getAllByText('\u00d7')
    expect(closeButtons).toHaveLength(2)
  })

  it('calls onClosePane when close button is clicked', () => {
    const panes = [
      makePane({ id: 'pane-1', title: 'Terminal 1' }),
      makePane({ id: 'pane-2', title: 'Terminal 2' })
    ]
    render(<TerminalTabs {...defaultProps} panes={panes} />)

    const closeButtons = screen.getAllByText('\u00d7')
    fireEvent.click(closeButtons[0])
    expect(defaultProps.onClosePane).toHaveBeenCalledWith('pane-1')
  })

  it('close button click does not trigger tab selection (stopPropagation)', () => {
    const panes = [
      makePane({ id: 'pane-1', title: 'Terminal 1' }),
      makePane({ id: 'pane-2', title: 'Terminal 2' })
    ]
    render(<TerminalTabs {...defaultProps} panes={panes} />)

    const closeButtons = screen.getAllByText('\u00d7')
    fireEvent.click(closeButtons[0])

    // onClosePane should be called but onSelectPane should NOT be called
    expect(defaultProps.onClosePane).toHaveBeenCalledWith('pane-1')
    expect(defaultProps.onSelectPane).not.toHaveBeenCalled()
  })

  it('renders add button with title "New terminal"', () => {
    render(<TerminalTabs {...defaultProps} />)

    const addButton = screen.getByTitle('New terminal')
    expect(addButton).toBeInTheDocument()
    expect(addButton.textContent).toBe('+')
  })

  it('calls onAddPane when add button is clicked', () => {
    render(<TerminalTabs {...defaultProps} />)

    fireEvent.click(screen.getByTitle('New terminal'))
    expect(defaultProps.onAddPane).toHaveBeenCalledOnce()
  })

  it('applies active styling to the active pane tab', () => {
    const panes = [
      makePane({ id: 'pane-1', title: 'Terminal 1' }),
      makePane({ id: 'pane-2', title: 'Terminal 2' })
    ]
    render(<TerminalTabs {...defaultProps} panes={panes} activePane="pane-2" />)

    // The active tab should have the active background color
    const tab2 = screen.getByText('Terminal 2').closest('button')!
    expect(tab2.style.backgroundColor).toBe('rgb(26, 26, 39)')

    // The inactive tab should have transparent background
    const tab1 = screen.getByText('Terminal 1').closest('button')!
    expect(tab1.style.backgroundColor).toBe('transparent')
  })
})
