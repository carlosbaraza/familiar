import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ActivityEntryComponent } from './ActivityEntry'
import type { ActivityEntry } from '@shared/types'

function makeEntry(overrides: Partial<ActivityEntry> = {}): ActivityEntry {
  return {
    id: 'entry_1',
    timestamp: new Date().toISOString(),
    type: 'note',
    message: 'Test note message',
    ...overrides
  }
}

describe('ActivityEntryComponent', () => {
  it('renders the entry message', () => {
    render(<ActivityEntryComponent entry={makeEntry({ message: 'Fixed the bug' })} />)
    expect(screen.getByText('Fixed the bug')).toBeInTheDocument()
  })

  it('renders the timestamp as relative time', () => {
    render(<ActivityEntryComponent entry={makeEntry()} />)
    expect(screen.getByText('just now')).toBeInTheDocument()
  })

  it('renders icon for status_change type', () => {
    const { container } = render(
      <ActivityEntryComponent entry={makeEntry({ type: 'status_change' })} />
    )
    expect(container.textContent).toContain('\u2194')
  })

  it('renders icon for agent_event type', () => {
    const { container } = render(
      <ActivityEntryComponent entry={makeEntry({ type: 'agent_event' })} />
    )
    expect(container.textContent).toContain('\u2699')
  })

  it('renders icon for note type', () => {
    const { container } = render(
      <ActivityEntryComponent entry={makeEntry({ type: 'note' })} />
    )
    expect(container.textContent).toContain('\u270E')
  })

  it('renders icon for created type', () => {
    const { container } = render(
      <ActivityEntryComponent entry={makeEntry({ type: 'created' })} />
    )
    expect(container.textContent).toContain('\u2795')
  })

  it('renders icon for updated type', () => {
    const { container } = render(
      <ActivityEntryComponent entry={makeEntry({ type: 'updated' })} />
    )
    expect(container.textContent).toContain('\u270F')
  })

  it('renders older timestamps correctly', () => {
    const oldDate = new Date()
    oldDate.setHours(oldDate.getHours() - 3)
    render(<ActivityEntryComponent entry={makeEntry({ timestamp: oldDate.toISOString() })} />)
    expect(screen.getByText('3h ago')).toBeInTheDocument()
  })
})
